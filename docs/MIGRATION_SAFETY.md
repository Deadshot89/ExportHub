# Migrationssicherheit Professional 0.2

1. Das Originalbackup wird niemals verändert.
2. Die komplette Quelldatei erhält SHA-256.
3. Jede Quelle erhält einen Source Pointer.
4. `shipments` und `savedShipments` werden nicht blind addiert, sondern auf eindeutige Sendungen gemappt.
5. Der aktuell gespeicherte Prozessstatus hat bei der Bestandsübernahme Vorrang vor veralteten historischen Hilfsfeldern.
6. POD-Dateien, POD-Status, Signatur- und Abholnachweise werden unabhängig voneinander als Evidenz geprüft.
7. Eine Sendung mit Abhol- oder POD-Evidenz bleibt in Professional gesperrt.
8. Remote-Dokumente müssen vor einem Cutover separat gesichert und verifiziert werden.
9. Legacy-Passwörter werden nicht in die normalisierten Professional-Benutzer übernommen.
10. `READ_ONLY_READY` erlaubt nur die Bestandsprüfung. Es ist keine Produktionsfreigabe.
