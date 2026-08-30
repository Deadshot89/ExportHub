# ExportHUB Professional 0.3.0

Professional 0.3 bleibt vollständig von ExportHUB Internal getrennt. Der interne Datenbestand wird nur lokal gelesen und als schreibgeschützte Professional-Struktur normalisiert.

## Neu in 0.3

- strukturiertes Dokument-Migrationsregister für POD, Lieferschein, ABD, CMR, Ladeliste, Rechnung und sonstige Dokumente
- jedes eindeutige Dokument erhält Referenz, Quelle, Speicherstatus, Migrationsstatus, Priorität und Cutover-Sperre
- eingebettete Dateien werden per SHA-256 verifiziert
- Remote-Dokumente werden nach ExportHUB-API, SharePoint oder externer HTTP-Quelle klassifiziert
- POD-Dokumente besitzen ein eigenes P0-Gate: ein Cutover bleibt blockiert, solange ein POD nicht vollständig gesichert ist
- ABD-Dokumente aus `abdRequests` werden anhand der Referenz wieder der richtigen Sendung zugeordnet
- Dokumentregister kann separat und ohne rohe Remote-URLs heruntergeladen werden
- bestehende Read-only-Ansichten für Mandant, Benutzer/Rollen, Kunden und Sendungen bleiben erhalten
- Legacy-Passwörter werden weiterhin nicht übernommen

## Sicherheits-Gates

`READ_ONLY_READY` bedeutet: Der Bestand ist vollständig zugeordnet und darf schreibgeschützt geprüft werden.

`CUTOVER_READY` ist strenger. Remote-Dateien, fehlende Dateiinhalte oder nicht vollständig gesicherte POD-Dokumente blockieren den Cutover.

## Migration testen

1. Unter **Migration** bei einem Legacy-Backup die Quellversion bestätigen, z. B. RC826.
2. Mandantenname eintragen.
3. Backup auswählen.
4. Inventur prüfen.
5. **Migrationspaket prüfen & erzeugen** starten.
6. Bei `READ_ONLY_READY` Kunden, Sendungen und Dokumentregister prüfen.
7. Das separate Dokumentregister zeigt alle noch offenen Dateien priorisiert an.
8. Ein produktiver Cutover ist in 0.3 weiterhin deaktiviert.

CLI:

`npm run analyze -- /pfad/backup.json /pfad/migration.json --source-version RC826 --tenant "Firma"`

Danach:

`npm run verify -- /pfad/backup.json /pfad/migration.json --source-version RC826`

## Datenverlustschutz

- keine Änderungen an ExportHUB Internal
- keine automatische Löschung
- keine automatische Datenbankmigration
- vollständiger Source Snapshot plus SHA-256
- Source Pointer für jede Migration
- doppelte Quellstände werden dokumentiert, aber nicht doppelt angelegt
- POD- und Abholsperren bleiben erhalten
- Remote-URLs werden im separaten sicheren Dokumentregister nicht ausgegeben
