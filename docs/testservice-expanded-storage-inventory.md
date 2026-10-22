# TESTSERVICE: Erweiterte Speicherinventur vor der 0-Euro-Migration

Stand: 22.10.2026. Die reine Teamstate-Inventur in
`TESTSERVICE Storage Inventory` ist **kein vollständiger TESTSERVICE-Bestand**.
Diese zweite, strikt manuelle Inventur erfasst zusätzlich fünf Speicherbereiche.
Der Workflow löscht, verschiebt, verändert oder lädt **keine Blob-Inhalte** herunter.

## Im Anwendungscode nachgewiesene Speicherziele

| Datentyp | Azure Container (Code-Standard) | Nur lesbarer TESTSERVICE-Prefix | Quellcode |
|---|---|---|---|
| Teamstate, Test-Backups und Einstellungen | `exporthub-teamdata` (real bestätigt) | `testservice/` | `api/exporthub-state/index.js`, `api/shared/auth-store.js` |
| Digitale Lieferscheine und Dokumente | `exporthub-documents` | `rc1059/testservice/` | `api/shared/document-blob-store.js` |
| Containerfotos | `exporthub-documents` | `testservice/` | `api/shared/container-document-store.js` |
| QR-Abholdatensätze | `exporthub-pickup` | `rc995/testservice/` | `api/shared/pickup-store.js` |
| ABD-Analyse: hochgeladene Rechnungen (Quarantäne) | `exporthub-abd-quarantine` | `rc1294/testservice/` | `api/abd-analysis/index.js` |
| POD, Fahrer-/Zollunterschriften | `exporthub-pod` | `rc995/testservice/` | `api/shared/pickup-store.js`, `api/shared/pod-archive.js` |
| Separate POD-Archivkopien | `exporthub-pod-backup` | `rc1220/testservice/` | `api/shared/pod-archive.js` |

**Wichtig:** Nur das Konto `exporthubtestde89` und der Teamcontainer
`exporthub-teamdata` sind bislang ausdrücklich bestätigt. Bei den
fünf anderen Containern handelt es sich um Quellcode-Standards, **nicht** um
live geprüfte Azure-Ressourcen. Der POD-Archivspeicher kann in einem
**anderen Speicherkonto** liegen. Für jedes Ziel ist der tatsächliche
Azure-Endpunkt erst zu bestätigen.

## Ausführung und Secrets

Workflow: `.github/workflows/testservice-expanded-storage-inventory.yml`.
Manuell unter Actions -> TESTSERVICE Extended Storage Inventory -> Run workflow -> main.

Nur dedizierte, möglichst containerbeschränkte Read/List-Zugänge
mit Ablaufdatum verwenden. Niemals in Git, Chat oder Issues kopieren.
Vor der ersten Ausführung müssen die folgenden GitHub-Actions-Secrets
hinterlegt sein:

- `EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING` (bestehender Teamzugang)
- `EXPORTHUB_TEST_DOCUMENTS_INVENTORY_CONNECTION_STRING`
- `EXPORTHUB_TEST_PICKUP_INVENTORY_CONNECTION_STRING`
- `EXPORTHUB_TEST_POD_INVENTORY_CONNECTION_STRING`
- `EXPORTHUB_TEST_ABD_INVENTORY_CONNECTION_STRING`
- `EXPORTHUB_TEST_POD_BACKUP_INVENTORY_CONNECTION_STRING`

Zusätzlich fünf GitHub-Actions-Variablen für die jeweils **zuvor bestätigten**
Azure-Speicherkonten (nur Accountnamen, keine Zugangsdaten):

- `EXPORTHUB_TEST_DOCUMENTS_ACCOUNT`
- `EXPORTHUB_TEST_PICKUP_ACCOUNT`
- `EXPORTHUB_TEST_POD_ACCOUNT`
- `EXPORTHUB_TEST_ABD_ACCOUNT`
- `EXPORTHUB_TEST_POD_BACKUP_ACCOUNT`

Alle sechs Zugänge und fünf Accountnamen werden vor dem ersten Azure-Aufruf
überprüft. Es gibt keinen Fallback zu produktiven App-Secrets. Der HTTPS-
Host des jeweiligen Zugangs muss exakt dem bestätigten Azure-Konto entsprechen.
Fehlende Zugänge, falsche Konten, fehlende Byte-Metadaten oder Listenfehler
lassen den gesamten Lauf ohne vollständigen Bericht scheitern.

Ergebnis: Nur Anzahl und logische Größe nach bekannten Bereichen sowie
Live/Version/Snapshot/Deleted. Keine Dateinamen, Sendungsreferenzen,
Dokumente, persönliche Metadaten, SAS-URLs oder Secrets. JSON-Actions-
Artefakt wird nach 7 Tagen entfernt. **Read/List kann Azure-Transaktionskosten
verursachen.**

## Was noch zwingend fehlt

1. Azure-Konten/Container, zugehörige Kostenstellen, Tarif und
   möglicherweise weitere bisher unbekannte Testressourcen live zuordnen.
2. Geteilte Authentifizierung aus `auth-sessions.json` und produktiven
   Teamzuständen vor einer Trennung ausdrücklich behandeln; kein Abschalten
   gemeinsam genutzter Ressourcen.
3. Sicherungsmanifest mit SHA-256, gesichertem externem Archiv, vollständigem
   Readback und isolierter Wiederherstellung.
4. Danach kostenloses Ziel anhand der **wirklich benötigten** Datenmenge,
   Schreiblast, Dateigrößen und Limits wählen. Ein Free-Tarif ist kein
   generelles Gratisarchiv für hunderte GiB.
5. Login, Sendungen, Dokumente, Abholungen, POD, Signaturen, Backup und
   Restore auf TESTSERVICE live testen.
6. Test-exklusive Rechnungspositionen erst nach Freigabe stilllegen.
   **0 EUR nur nach tatsächlicher Azure-Abrechnungsprüfung melden.**

Die 188,15 GiB des gesamten Kontos sind weiterhin **kein Nachweis** für
die Größe des TESTSERVICE-Bestandes. Auch die summierten logischen Bytes
der Inventur sind nicht identisch mit abrechenbaren Bytes.

## Bewertung der Speicher-Aktivität (nicht der Löschbarkeit)

Die aggregierte Inventur zeigt zusätzlich, wie sich der logisch erfasste Bestand
nach `lastModified` auf die letzten 30 Tage, Tage 31–90, älter als 90 Tage und
Einträge mit unbekanntem Datum verteilt. Diese Berechnung erfolgt nur aus
Azure-Metadaten, ohne Datei-Download und ohne Veröffentlichung von Blobnamen.

Getrennt werden `liveLogicalBytes` und `historicalLogicalBytes`
(Snapshots, Versionen und als gelöscht gelistete Datensätze) gemeldet.
Die Summen bleiben **logische** Größen; sie sind ausdrücklich keine
abrechnungsfähige Azure-Speicher- oder Kostenberechnung.

Bei aktivierter Blob-Versionierung kann auch die **aktuelle** Azure-Version eine
`versionId` besitzen. Sie wird nur bei `isCurrentVersion=true` zu den Live-Daten
gerechnet. Alte Versionen, Snapshots und gelöschte Einträge gehören zur
Historie. Die Metadaten werden weder verändert noch für Löschungen genutzt.

**Kein Löschrecht aus Alter ableiten:** Auch mehr als 90 Tage alte
Unterschriften, Lieferpapiere, POD-Dateien, Sendungs- und Backupdaten dürfen
nicht automatisch entfernt werden. Erst Datenzuordnung, gesicherte
Archivierung, Nachweis der gesetzlichen/fachlichen Aufbewahrung,
vollständiger Readback und isolierter Restore erlauben eine gesondert
freizugebende Maßnahme. Unbekannte Metadaten bleiben sichtbar.


## RC1627 – automatische, nur lesende Team-Teilinventur ohne zusätzliche Secrets

Der bereits vorhandene signierte RC1267-Backup-Workflow nutzt bei seinem
**regulären täglichen Zeitplan** denselben GitHub-OIDC-Nachweis wie bisher.
Zusätzlich kann er am TESTSERVICE-API-Endpunkt
`POST /api/state-maintenance` die Aktion
`inventory-testservice-team` aufrufen. Dieser Aufruf ist ausschließlich
für einen gültig signierten und auf `main` beschränkten Wartungsworkflow
zugelassen; für `production` liefert die Aktion einen Fehler.

Aus dem bestehenden Teamcontainer werden dabei nur Metadaten unter
`testservice/` per Azure LIST gelesen. Es gibt **keinen Download** des
Team-State-Dokuments und keine Datenänderung. Enthalten sind die
Anzahl und die logischen Bytes von aktuellen Dateien, historischen
Versionen, Snapshots und gelöschten Objekten.

Die Ausgabe enthält **keine Dateinamen, Containerpfade, Referenzen,
Kundendaten, Signaturen, Zugangsschlüssel oder Auth-Tokens**. Ergebnisse
erscheinen nur aggregiert in der GitHub-Actions-Zusammenfassung.
Unbekannte Größen, Überschreitungen der Abfragegrenze oder fehlerhafte
Antworten führen zu **keinem vollständigen Inventurbericht**. Ein
fehlgeschlagener Inventuraufruf lässt erfolgreich verifizierte
Sicherungen unberührt.

Diese automatisch erfasste **Team-Teilinventur** ersetzt **nicht** die
sechs getrennten Speicherbereiche aus RC1618/RC1620 und liefert
**keine Azure-Abrechnung**. Das Konto `exporthubtestde89` kann
weiterhin gemeinsam mit Produktion verwendet werden.
Alte Versionen sind keine Löschfreigabe. Erst gesichertes Archiv,
Restore-Nachweis, vollständige Ressourcenzuordnung und gesonderte
Freigabe erlauben einen Speicherwechsel oder Löschschritt.


## RC1631 – read-only Teilinventur aller bekannten TESTSERVICE-Präfixe

Der bereits signierte TESTSERVICE-Release kann nach bestandener GitHub-OIDC-
Prüfung neben dem Team-Prefix bis zu **sieben bekannte Präfixe in sechs
Containern** per Azure LIST erfassen (Team, Dokumente, Containerfotos, QR-
Abholung, POD, ABD-Rechnungsquarantäne, POD-Archivkopien). Der Code verwendet
die im betreffenden TESTSERVICE-API-Server bereits konfigurierten Azure-
Verbindungsdaten; POD-Backups verwenden – falls vorhanden – ihre separate
Konfiguration. Es werden **keine neuen Schlüssel angefordert oder offengelegt**.

Jedes Ergebnis ist entweder **gelistet** (vollständiger Metadaten-LIST für
dieses Präfix) oder **ungeprüft**. Unbekannte Größen, fehlende Container,
Berechtigungs-/Netzwerkprobleme und Zeitlimits werden ausdrücklich **nicht**
als null gespeicherte Dateien interpretiert. Der API-Bericht und die Actions-
Zusammenfassung enthalten keine Blobnamen, Kundendaten, Tokens,
Dateiinhalte oder originalen Azure-Fehlertexte. Es erfolgt **keine** Änderung
oder Löschung eines Blobs.

**Wichtige Einschränkung:** Die möglicherweise gemeinsame Nutzung eines
Speicherkontos mit Produktion sowie die realen Azure-Konten/Kosten je
Container werden durch LIST **nicht** nachgewiesen. Auch eine erfolgreiche
Auflistung aller bekannten Präfixe ist keine vollständige Inventur unbekannter
oder außerhalb dieser Konten liegender Daten. Historische Blob-Versionen
sind keine Freigabe zum Löschen. Der Betrieb kann geringe LIST-
Transaktionskosten verursachen. Die vorhandene, strikt konto- und
credentialverifizierende Offline-Inventur bleibt für eine
**belastbare Migration und 0-€-Abnahme** erforderlich.
