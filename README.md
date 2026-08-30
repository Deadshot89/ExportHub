# ExportHUB Professional 0.2.0

Professional 0.2 ist weiterhin vollständig von ExportHUB Internal getrennt. Der aktuelle interne Datenbestand wird ausschließlich lokal gelesen und als schreibgeschützte Professional-Vorschau normalisiert.

## Neu in 0.2

- akzeptiert aktuelle `ExportHUB_BACKUP`-Dateien und ältere Legacy-Backups mit `state + users`
- Quellversion kann für Legacy-Backups ausdrücklich bestätigt werden, z. B. RC826
- `shipments` und `savedShipments` werden auf eindeutige Sendungen zusammengeführt statt doppelt angelegt
- aktueller `processStatus` wird vor historischen Hilfsfeldern erhalten
- Abholung/POD/Signatur bleiben als Sperre erhalten
- `podCloudBackupWebUrl` und weitere Remote-POD-Felder werden als externe Dokumentquelle erkannt
- Benutzer und Rollen werden als Read-only-Vorschau übernommen
- alte Passwörter werden nicht in die normalisierte Professional-Benutzerstruktur übernommen; Anmeldung erfordert später eine Neuvergabe
- Kunden, Sendungen und Benutzer können nach erfolgreicher lokaler Prüfung direkt in den entsprechenden Professional-Bereichen angesehen werden
- Source Snapshot bleibt unverändert; keine Schreibverbindung zu Internal

## Sicherheits-Gates

`READ_ONLY_READY` bedeutet: Alle relevanten Quellobjekte sind einem Professional-Zielobjekt zugeordnet und die schreibgeschützte Migration kann geprüft werden.

`CUTOVER_READY` ist deutlich strenger. Remote-Dateien und Dokumente ohne gesicherten Inhalt blockieren den Cutover weiterhin.

## Migration testen

1. Unter **Migration** optional die Quellversion eintragen, wenn der Alt-Export keine eigene Versionsmetadaten besitzt.
2. Mandantenname für die Vorschau eintragen.
3. Backup auswählen.
4. Inventur und Statusverteilung kontrollieren.
5. **Migrationspaket prüfen & erzeugen** starten.
6. Erst bei `READ_ONLY_READY` die Read-only-Bereiche Mandanten, Benutzer, Kunden und Sendungen prüfen.
7. Ein produktiver Cutover ist in 0.2 weiterhin deaktiviert.

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
- doppelte Quellstände werden dokumentiert, aber nicht doppelt als neue Sendung angelegt
- POD- und Abholsperren werden nicht aufgehoben
