# TESTSERVICE: Erweiterte Speicherinventur vor der 0-Euro-Migration

Stand: 22.10.2026. Die reine Teamstate-Inventur in
`TESTSERVICE Storage Inventory` ist **kein vollständiger TESTSERVICE-Bestand**.
Diese zweite, strikt manuelle Inventur erfasst zusätzlich vier Speicherbereiche.
Der Workflow löscht, verschiebt, verändert oder lädt **keine Blob-Inhalte** herunter.

## Im Anwendungscode nachgewiesene Speicherziele

| Datentyp | Azure Container (Code-Standard) | Nur lesbarer TESTSERVICE-Prefix | Quellcode |
|---|---|---|---|
| Teamstate, Test-Backups und Einstellungen | `exporthub-teamdata` (real bestätigt) | `testservice/` | `api/exporthub-state/index.js`, `api/shared/auth-store.js` |
| Digitale Lieferscheine und Dokumente | `exporthub-documents` | `rc1059/testservice/` | `api/shared/document-blob-store.js` |
| Containerfotos | `exporthub-documents` | `testservice/` | `api/shared/container-document-store.js` |
| QR-Abholdatensätze | `exporthub-pickup` | `rc995/testservice/` | `api/shared/pickup-store.js` |
| POD, Fahrer-/Zollunterschriften | `exporthub-pod` | `rc995/testservice/` | `api/shared/pickup-store.js`, `api/shared/pod-archive.js` |
| Separate POD-Archivkopien | `exporthub-pod-backup` | `rc1220/testservice/` | `api/shared/pod-archive.js` |

**Wichtig:** Nur das Konto `exporthubtestde89` und der Teamcontainer
`exporthub-teamdata` sind bislang ausdrücklich bestätigt. Bei den
vier anderen Containern handelt es sich um Quellcode-Standards, **nicht** um
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
- `EXPORTHUB_TEST_POD_BACKUP_INVENTORY_CONNECTION_STRING`

Zusätzlich vier GitHub-Actions-Variablen für die jeweils **zuvor bestätigten**
Azure-Speicherkonten (nur Accountnamen, keine Zugangsdaten):

- `EXPORTHUB_TEST_DOCUMENTS_ACCOUNT`
- `EXPORTHUB_TEST_PICKUP_ACCOUNT`
- `EXPORTHUB_TEST_POD_ACCOUNT`
- `EXPORTHUB_TEST_POD_BACKUP_ACCOUNT`

Alle fünf Zugänge und vier Accountnamen werden vor dem ersten Azure-Aufruf
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
