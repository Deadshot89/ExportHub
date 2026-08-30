# ExportHUB Professional 0.1.0

Dies ist der erste getrennte Professional-Stand. Er ersetzt ExportHUB Internal nicht.

## Was bereits funktioniert

- moderne, modulare Professional-Shell
- lokale Analyse eines vorhandenen ExportHUB-Backups
- strikte Prüfung auf `type: ExportHUB_BACKUP`
- Inventur von Kunden, Sendungsquellen, Benutzern und Dokumenten
- Erkennung von POD-, Lieferschein-, ABD-, CMR- und sonstigen Dokumentobjekten
- SHA-256 für das komplette Originalbackup
- SHA-256 für eingebettete Dokumentinhalte
- Source-Pointer-Mapping für jeden normalisierten Datensatz
- vollständiger unveränderter `sourceSnapshot` im Migrationspaket
- getrennte Freigaben `READ_ONLY_READY` und `CUTOVER_READY`
- Remote-Dokumente/PODs blockieren den Cutover, bis deren Inhalt separat verifiziert wurde

## Was bewusst noch nicht funktioniert

- kein produktiver Login
- keine produktive Datenbank
- kein Schreiben in ExportHUB Internal
- kein automatischer Cutover
- keine Löschung oder Änderung des Altbestands

## Migration testen

1. Im aktuellen ExportHUB über **Backup** ein vollständiges JSON-Backup erzeugen.
2. Professional öffnen und den Bereich **Migration** wählen.
3. Backup auswählen.
4. `Migrationspaket prüfen & erzeugen` starten.
5. Der Bericht muss mindestens `READ_ONLY_READY` melden.
6. `CUTOVER_READY` ist absichtlich strenger und bleibt bei remote gespeicherten Dokumenten blockiert.

Alternativ per Node:

`npm run analyze -- /pfad/backup.json`

Danach:

`npm run verify -- /pfad/backup.json /pfad/ExportHUB_Professional_Migration_Package.json`

## Datenverlustschutz

Siehe `docs/MIGRATION_SAFETY.md`.
