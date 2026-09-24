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

Jeder Lauf schreibt einen neuen Snapshot und überschreibt keine vorhandene Sicherung.

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

## Release-Nachweis

Für die Release-Abnahme gilt:

- RC1267-Regression vollständig grün,
- Build erfolgreich,
- Daily-Snapshot nach Deployment erfolgreich und zurückgelesen,
- Workflowplan für Daily/Monthly/Yearly vorhanden,
- RC1234 Restore-Drill weiterhin grün.
