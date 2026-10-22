# TESTSERVICE: Bestandsaufnahme vor der Speichermigration

Stand: 22.10.2026. Ziel: 0 EUR laufende Testkosten, Daten und Historie erhalten.
Dieser PR stellt eine lesende Bestandsprüfung bereit. Er ändert weder den Tarif
noch Speicher, API, Backup-Zeitpläne oder Produktion. Eine Einsparung ist damit
noch nicht nachgewiesen.

## Aktuell bestätigte Abhängigkeiten in main

- `api/shared/auth-store.js`: Test-Teamstate liegt im Prefix `testservice/`;
  Sitzungen verwenden auch beim Testclient den gemeinsamen `AUTH_BLOB`.
  Reguläre Sessionvalidierung liest außerdem den Produktions-Teamstate;
  nur speziell signierte TESTSERVICE-E2E-Sitzungen nutzen dort den Teststate.
  Ein Austausch nur des Test-Teamstate entfernt daher nicht alle Abhängigkeiten.
- `api/shared/loader-pin-store.js` und `api/task-public/index.js` verwenden
  weitere Blob-Zugriffe für Testfunktionen.
- `.github/workflows/rc1267-state-backup.yml` erstellt auch TESTSERVICE-Backups.
  `docs/rc1267-state-backup-lifecycle.md` beschreibt die Verifikation und
  ausdrücklich keine automatische Löschung.

## Lesende Inventur

Nach Installation der vorhandenen API-Abhängigkeiten im Repository:

```bash
node --test test/testservice-storage-inventory.test.mjs
node scripts/testservice-storage-inventory.mjs
```

Konfiguration über sichere Umgebungsvariablen, niemals im Repository:

- `EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING`: dedizierter Zugang,
  vorzugsweise SAS mit ausschließlich Read/List und begrenzter Gültigkeit.
  Keine automatische Verwendung der Produktions-Verbindungszeichenfolge.
- `EXPORTHUB_TEST_INVENTORY_CONTAINER`: optionaler expliziter Containername;
  Standard ist der am 22.10.2026 bestätigte Container `exporthub-teamdata`.
- Konto-Sicherheitsprüfung: Der Workflow akzeptiert ausschließlich den Blob-Endpunkt
  des bestätigten Kontos `exporthubtestde89` über HTTPS. Falsche Konten werden
  vor jeder Azure-Abfrage abgewiesen.

Die Abfrage ist fest auf `testservice/` beschränkt und erfasst aktuelle Blobs,
Snapshots, Versionen und gelöschte Einträge. Sie lädt keine Inhalte herunter.
Ausgabe: zusammengefasste Größen und Anzahl nach Typ und festem Bereich;
keine Blobnamen, Dokumentinhalte, Zugangsdaten oder SAS-URLs.
Ein Fehler oder eine unbekannte Dateigröße beendet die Prüfung ohne vollständigen
Bericht. Leere Ergebnisse sind möglich und kein Beweis für einen leeren Testserver.
Jeder weitere Container und außerhalb des Prefix liegende Testbestand muss
separat zugeordnet werden. Read/List-Abfragen können Transaktionskosten auslösen.

## Grenzen und nächste Schritte

### Ausführung über GitHub Actions

Nach Integration dieses PRs steht unter Actions der Workflow
`TESTSERVICE Storage Inventory` zur Verfügung. Er läuft ausschließlich manuell
und nur auf `main`; er veröffentlicht keine Website und ändert keine Daten.

Einmalig unter Repository Settings → Secrets and variables → Actions das Secret
`EXPORTHUB_TEST_INVENTORY_CONNECTION_STRING` mit einem dedizierten Read/List-Zugang
zum bestätigten Speicher hinterlegen. Eine Container-SAS ist einer Account-Key-
Verbindungszeichenfolge vorzuziehen. Den Wert nicht in Chat, Issues oder Dateien
kopieren. Bei abweichendem Container die Repository-Variable
`EXPORTHUB_TEST_INVENTORY_CONTAINER` setzen. Der Standard ist jetzt
`exporthub-teamdata`; für ein anderes Azure-Konto ist eine separate, geprüfte
Codeänderung erforderlich. Ohne Secret bricht der Workflow vor
der Installation und Azure-Abfrage ab.

Anschließend Actions → TESTSERVICE Storage Inventory → Run workflow → main.
Die Zusammenfassung zeigt ausschließlich aggregierte Metadaten. Der JSON-Bericht
bleibt sieben Tage als Actions-Artefakt verfügbar. Es gibt keinen Zeitplan.
Die tatsächliche Azure-Inventur und der Workflow sind vor der ersten Ausführung
noch nicht live verifiziert. GitHub-Nutzung unterliegt den bestehenden Kontingenten;
dieser PR ändert kein Ausgabenlimit und bestellt keine Ressource.

`logicalBytes` ist kein Rechnungsbetrag: Snapshot-/Versionsblöcke können geteilt
sein. Der Lauf ist keine atomare Bestandsaufnahme, kein Archiv und kein Restoretest.
Die früher genannten 114 GiB sind in diesem PR nicht live bestätigt.

1. Tatsächliche Ressourcen, Tarif, Container und Abrechnung lesend abgleichen.
2. Testexklusive und geteilte Daten/Sitzungen eindeutig zuordnen.
3. Historie mit Manifest und Prüfsummen außerhalb des abzuschaltenden Speichers
   sichern; vollständigen Readback und isolierte Wiederherstellung nachweisen.
4. Zielsystem anhand von Datenvolumen, Dokumenten, parallelen Änderungen,
   Transaktionen, Backupbedarf und tatsächlich verfügbaren Freikontingenten wählen.
   Cosmos DB ist hier noch keine beschlossene oder verifizierte Lösung.
5. Testmigration samt Login, Sendungen, Dokumenten, QR-Abholung und Restore prüfen.
6. Erst danach testexklusive kostenpflichtige Ressourcen stilllegen. Gemeinsame
   Produktionsressourcen bleiben bestehen. 0 EUR erst anhand der tatsächlichen
   Abrechnung bestätigen.


## RC1626 – wiederholte TESTSERVICE-Auth-Reads ohne großen Blob-Download

Im Fast-Auth-Pfad wird für normale TESTSERVICE-Aufrufe weiterhin das bestehende
gemeinsame Auth- und Benutzer-System verwendet. Vorher lud jede abgeschlossene
Sitzungsprüfung den **vollen Team-State** erneut aus Azure, selbst wenn dieser
unverändert war. Das kann bei großen Dokumenten unnötigen Cloud-Read-Traffic
verursachen.

Die TESTSERVICE-only-Optimierung liest den Auth-/Session-Blob **bei jedem
Aufruf neu**. Beim großen Team-Blob ist eine Wiederverwendung nur zulässig,
wenn Azure selbst mittels HEAD einen **identischen ETag** bestätigt. Nach
Änderungen, ohne ETag, ohne HEAD-Unterstützung oder bei HEAD-Fehler wird der
gesamte Team-State frisch geladen; schlägt dieser GET fehl, schlägt auch die
Autorisierung fehl. Wiederverwendung nur innerhalb desselben laufenden
API-Prozesses und exakt desselben Blob-Clients.

Die normalen Produktionsaufrufe behalten den bisherigen vollen Leseweg.
Der tatsächliche finanzielle Effekt muss separat anhand der Azure-Zähler
für Bandwidth, Read Operations und Geo-Replication geprüft werden.
**Keine Umstellung auf LRS**, keine Aufbewahrungsänderung, keine Blob-Löschung,
keine vollständige Trennung von TESTSERVICE und Produktion, keine Garantie auf
0 EUR.
