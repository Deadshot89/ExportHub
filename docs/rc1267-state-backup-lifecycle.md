# RC1267 – State Backup Lifecycle

## Zweck

RC1267 ergänzt für den zentralen ExportHUB-State einen eigenständigen, zeitgesteuerten Sicherungsweg. Die bestehenden Wartungs- und POD-Backups bleiben unverändert bestehen.

## Zeitplan

Der Workflow `.github/workflows/rc1267-state-backup.yml` läuft täglich um 01:17 UTC und zusätzlich nach einem erfolgreichen Drei-Umgebungen-Deployment.

Die automatische Staffelung lautet:

- täglich: immer ein Daily-Snapshot
- monatlich: am 1. Kalendertag zusätzlich ein Monthly-Snapshot
- jährlich: am 1. Januar zusätzlich ein Yearly-Snapshot

Der Workflow kann außerdem manuell mit `auto`, `daily`, `monthly`, `yearly` oder `all` gestartet werden.

## Ablage

Produktion:

- `state-backups/daily/YYYY/MM/DD/`
- `state-backups/monthly/YYYY/MM/`
- `state-backups/yearly/YYYY/`

TESTSERVICE:

- `testservice/state-backups/daily/YYYY/MM/DD/`
- `testservice/state-backups/monthly/YYYY/MM/`
- `testservice/state-backups/yearly/YYYY/`

Produktions-Backups sowie monatliche und jährliche Sicherungen erzeugen bei jedem Lauf einen neuen Snapshot. Bestehende Sicherungen werden nicht überschrieben.

### RC1624 – Redundante TESTSERVICE-Tagessicherungen vermeiden

Nur für **TESTSERVICE + daily** wird vor dem Upload geprüft, ob am **gleichen UTC-Kalendertag** bereits eine in Azure vorhandene Sicherung mit exakt demselben SHA-256-Wert existiert.

- Ein vorhandener Blob wird nur dann wiederverwendet, wenn Azure die Backup-Metadaten (`purpose`, `environment`, `tier`, `sha256`) passend bestätigt und sein kompletter Inhalt erneut gelesen sowie bytegenau per SHA-256 verifiziert wurde.
- Bei identischem, intaktem Backup erfolgt **kein zweiter Upload** und es wird kein zusätzlicher Blobstand angelegt. Der Workflow erhält weiterhin `backupVerified=true` und `backupReadBackVerified=true`; `reusedVerifiedExisting=true` kennzeichnet die Wiederverwendung.
- Geänderter Team-State, ein neuer UTC-Tag oder fehlende Wiederverwendungskandidaten lösen weiterhin einen neuen vollständigen Upload mit Readback aus. Bei fehlender LIST-Berechtigung bleibt der alte Backup-Pfad erhalten.
- Ein beschädigter Wiederverwendungskandidat löst `BACKUP_VERIFY_FAILED` aus, statt ihn fälschlich als sicher auszugeben.
- **PRODUCTION**, TESTSERVICE-`monthly` und TESTSERVICE-`yearly` bleiben unverändert. Es wird nichts gelöscht und keine Aufbewahrungsfrist verkürzt.

Damit können identische TESTSERVICE-Zustände nach mehreren Releases am selben Tag weniger zusätzliche Sicherungsversionen erzeugen. Der tatsächliche Kosteneffekt ist erst durch die Azure-Messung belegbar; LIST/Readback können Transaktionsgebühren verursachen. Dies ist kein Nachweis für 0 € laufende Kosten.

## Retention

Die Sicherungen tragen eine Mindestaufbewahrung als Metadaten:

- täglich: mindestens 35 Tage
- monatlich: mindestens 730 Tage
- jährlich: mindestens 2555 Tage

RC1267 führt bewusst **keine automatische Löschung** von State-Backups durch. Damit kann eine spätere, separat freigegebene Archiv-/Purge-Regel keine Sicherungen unbemerkt aus dem Backup-Lifecycle entfernen.

## Integritätsprüfung

Ein Backup gilt nur als erfolgreich, wenn:

1. der Snapshot vollständig hochgeladen wurde,
2. Azure Blob Storage einen ETag bestätigt,
3. der gespeicherte SHA-256-Wert wieder aus den Blob-Metadaten gelesen wird,
4. der komplette Snapshot zurückgelesen wird,
5. Byteanzahl und SHA-256 des Readbacks exakt mit dem Quell-State übereinstimmen.

Bei Abweichungen schlägt der Lauf fail-closed mit `BACKUP_VERIFY_FAILED` fehl.

## Autorisierung

Der Endpunkt `/api/state-maintenance` akzeptiert `scheduled-backup` nur mit einer signierten GitHub-OIDC-Identität des freigegebenen RC1267-Workflows auf `main`.

TESTSERVICE und Produktion bleiben getrennte Backup-Namensräume.

## Restore

Der bestehende RC1234-Restore-Drill bleibt die technische Wiederherstellungsprüfung.

Er läuft ausschließlich im TESTSERVICE und prüft:

- vollständigen Backup-Readback,
- SHA-256,
- Revision,
- Sendungsreferenzen,
- bytegenaue Wiederherstellung in einen isolierten Recovery-Blob.

Produktionsdaten werden durch den Restore-Drill nicht überschrieben.

## Betriebsüberwachung RC1491

Der Workflow `.github/workflows/rc1491-state-backup-restore-watchdog.yml` überwacht automatisch den letzten relevanten abgeschlossenen `main`-Lauf von RC1267. Für RC1137 wird gezielt der Job `TESTSERVICE State kompaktieren` des letzten relevanten abgeschlossenen `main`-Laufs bewertet, weil dort der Restore-Drill ausgeführt wird. Ein späterer, ausschließlich produktionsseitiger RC1137-Fehler wird deshalb nicht fälschlich als Restore-Drill-Fehler gemeldet.

Ein `workflow_run` kann regulär mit `conclusion=skipped` enden, wenn der vorgelagerte Deployment-Lauf die Bedingungen für Backup oder Restore nicht erfüllt. Ein solcher **neutraler workflow_run-Skip** gilt nicht als eigener Betriebsfehler und verdrängt deshalb nicht den davorliegenden relevanten Nachweis. Der Watchdog durchsucht dazu seitenweise bis zu 1000 abgeschlossene Läufe und verwendet den jüngsten Lauf, der nicht zugleich `event=workflow_run` und `conclusion=skipped` ist. Wird selbst innerhalb dieses begrenzten Rückblicks kein relevanter Lauf gefunden, bleibt die Prüfung bewusst fail-closed und meldet `missing`.

Diese Ausnahme gilt bewusst nur für neutrale `workflow_run`-Skips. Ein `skipped` aus einem geplanten oder manuellen Lauf sowie `failure`, `cancelled` und andere nicht erfolgreiche relevante Conclusions bleiben fail-closed und werden als Betriebsfehler behandelt.

Wenn das geplante State-Backup oder der TESTSERVICE-Restore-Job nicht erfolgreich ist, gilt das als Betriebsfehler. Es wird genau ein GitHub-Betriebs-Issue `[OPS] State Backup/Restore Watchdog` erstellt, wieder geöffnet oder aktualisiert. Wiederholte Fehler erzeugen dadurch keine fortlaufenden Duplikate.

Erst wenn Backup und TESTSERVICE-Restore-Drill wieder erfolgreich sind, wird der Betriebszustand als wiederhergestellt markiert und das offene Watchdog-Issue automatisch geschlossen.

Das Watchdog-Issue enthält nur Workflowname, Conclusion, Run-Nummer, Zeitbezug und GitHub-Actions-Link. Es werden keine Backup-Inhalte, State-Daten, Dokumente, Sendungsreferenzen, Hashwerte oder Secrets in das Betriebs-Issue übernommen.

Die bestehende fail-closed Sicherungs- und Restore-Logik wird durch RC1491 nicht verändert.

## Release-Nachweis

Für die Release-Abnahme gilt:

- RC1267-Regression vollständig grün,
- Build erfolgreich,
- Daily-Snapshot nach Deployment erfolgreich und zurückgelesen,
- Workflowplan für Daily/Monthly/Yearly vorhanden,
- RC1234 Restore-Drill weiterhin grün,
- RC1491 Watchdog-Regression vollständig grün.
