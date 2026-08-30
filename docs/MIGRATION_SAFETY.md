# ExportHUB Professional – Migrationssicherheit (P0)

## Unverhandelbare Regel

Kein Kunde, keine Sendung, kein POD und kein Dokument darf durch die Migration verloren gehen, überschrieben oder stillschweigend verworfen werden.

## Quelle

Professional 0.1 akzeptiert für eine vollständige Bestandsmigration ausschließlich ein ExportHUB-Backup mit `type = ExportHUB_BACKUP`. Das aktuelle interne ExportHUB erzeugt dieses Format mit vollständigem `state` und `users`.

## Sicherheitsprinzip

1. Das Originalbackup wird nur gelesen.
2. Für das komplette Originalbackup wird SHA-256 berechnet.
3. Das komplette Originalbackup wird unverändert als `sourceSnapshot` in das Migrationspaket übernommen.
4. Zusätzlich entsteht ein normalisiertes Professional-Modell. Es ersetzt die Quelle nicht.
5. Jeder normalisierte Datensatz besitzt einen `sourcePointer` zurück zur Quelle.
6. Eingebettete Dokumentdateien werden mit SHA-256 inventarisiert.
7. Nur remote referenzierte Dokumente werden ausdrücklich als `REMOTE_CAPTURE_REQUIRED` markiert.
8. Ein späterer Produktiv-Cutover bleibt blockiert, solange irgendein Dokument nicht verifiziert wurde.

## Zwei Freigabestufen

### READ_ONLY_READY

Darf erreicht werden, wenn alle erkannten Kunden, Sendungsquellen, Benutzer und Dokumentobjekte einem Professional-Datensatz zugeordnet sind und eingebettete Dateiinhalte fehlerfrei gehasht wurden.

Das bedeutet nur: Der Bestand darf in Professional als schreibgeschützte Migrationskopie betrachtet werden.

### CUTOVER_READY

Darf erst erreicht werden, wenn zusätzlich alle remote gespeicherten Dokumente/PODs tatsächlich erfasst und verifiziert wurden und keine Dokumentinhalte fehlen.

Professional 0.1 führt keinen Cutover aus.

## Rollback

Die interne ExportHUB-Instanz bleibt unverändert. Ein Professional-Migrationspaket schreibt niemals in den alten Bestand zurück. Ein Rollback besteht daher zunächst schlicht darin, Professional nicht freizugeben und die interne Instanz weiterzuverwenden.
