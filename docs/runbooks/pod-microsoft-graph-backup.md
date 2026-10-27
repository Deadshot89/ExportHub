# ExportHUB POD-Zweitsicherung – Azure-Archiv und optionales Microsoft 365

Stand: RC1224

## Ziel

Die verpflichtende POD-Sicherung verwendet seit RC1220 zwei serverseitige Azure-Speicherziele:

1. Primärspeicher: `exporthub-pod`
2. Zweitsicherung: `exporthub-pod-backup`

Die Zweitsicherung wird content-addressed gespeichert und beim Wiederfinden über SHA-256-Metadaten und Dateigröße verifiziert. Ein bereits vorhandenes Archivobjekt wird nicht überschrieben.

Microsoft 365 / Microsoft Graph ist **nicht mehr Voraussetzung** für eine vollständige POD-Sicherung. Graph kann optional als zusätzliche dritte Kopie aktiviert werden.

## Verbindliche Betriebslogik

- Ein POD gilt mit erfolgreichem Primärspeicher und verifiziertem Azure-Archiv als **technisch in Azure archiviert** (`archiveSaved=true`).
- Die zusätzlich vereinbarte **unabhängige SharePoint-Notfallsicherung** ist erst mit `driveSaved=true` bestätigt. `archiveSaved=true` darf in der Benutzeroberfläche nicht als erfolgreiche SharePoint-Kopie ausgegeben werden.
- Der Reconcile-Workflow `.github/workflows/rc1144-pod-backup-reconcile.yml` holt fehlende Archivkopien nach.
- In PRODUCTION muss der Reconcile mit `pendingCount=0` und `errorCount=0` enden.
- Microsoft-365-Fehler dürfen eine bereits erfolgreiche Azure-Primär- und Archivkopie nicht wieder als ungesichert markieren.
- Offene SharePoint-Kopien müssen im Sicherungsworkflow getrennt **fehlschlagen**, bis das echte Ziel erreichbar ist; der Produktivabholvorgang und die unveränderliche Originaldatei bleiben erhalten.

## Azure-Konfiguration

Standardmäßig verwendet das Archiv denselben Azure Storage Account wie der Primärspeicher, aber einen separaten Container.

Optional kann mit

- `EXPORTHUB_POD_BACKUP_CONNECTION_STRING`

ein separater Azure Storage Account für die Archivkopie hinterlegt werden. Das erhöht die Ausfallsicherheit gegenüber Problemen auf Storage-Account-Ebene.

Der Containername ist standardmäßig:

- `exporthub-pod-backup`

## Microsoft 365 automatisch aktivieren

Sobald das explizite Microsoft-365-POD-Ziel vollständig konfiguriert ist, wird die zusätzliche Drive-Kopie automatisch verwendet. Der historische Schalter `EXPORTHUB_POD_M365_ENABLED` ist seit RC1386 kein Sperrschalter mehr und darf eine konfigurierte POD-Ablage nicht deaktivieren.

Die Microsoft-365-Kopie bleibt technisch nachgelagert und darf die verpflichtende Azure-Primär- und Archivkopie bei einem Graph-Fehler nicht blockieren.

Mögliche Graph-Werte sind unter anderem:

- `EXPORTHUB_GRAPH_TENANT_ID`
- `EXPORTHUB_GRAPH_CLIENT_ID`
- `EXPORTHUB_GRAPH_CLIENT_SECRET`
- `EXPORTHUB_POD_DRIVE_ID`
- `EXPORTHUB_POD_FOLDER_ID`

Graph-Zugangsdaten und Secrets dürfen niemals in Frontend-Dateien, Browser-State, Logs, Issues oder Repository-Dateien geschrieben werden.

## Reconcile-Abnahme

Für PRODUCTION gilt als erfolgreicher Nachweis:

- HTTP 2xx
- `ok=true`
- `pendingCount=0`
- `errorCount=0`

Gezielte Nachweise für eine Referenz müssen den Status `saved-now` oder `already-saved` liefern.

## Live-Nachweis RC1220–RC1222

Nach dem erfolgreichen Produktionsdeploy wurden die zuvor offenen PODs mit dem neuen Azure-Archiv nachgesichert:

- erster erfolgreicher Production-Reconcile: 25 ausgewählt, 25 gespeichert, 0 offen, 0 Fehler
- spätere Reconcile-Läufe: weiterhin 0 Fehler
- aktuellster geprüfter Lauf: 0 offene POD-Sicherungen

Damit ist Microsoft Graph kein P0-Blocker mehr.

## Unvollständige SharePoint-Notfallsicherung (Issue #999)

Das seit 23.10.2026 nachgewiesene Fehlerbild `GRAPH_DIRECT_PATH_TARGET_FAILED` mit Graph-Provider-Code `ResourceNotFound` bedeutet: **Die unabhängige SharePoint-Kopie ist nicht nachgewiesen**, auch wenn der Azure-Reconcile technisch erfolgreich abgeschlossen wurde.

Zur Entstörung unter berechtigtem Zugriff den konfigurierten Zielbenutzer, den tatsächlichen Zielordner und die Microsoft-Graph-Zugriffsrechte lesend prüfen. Keine Zugangsdaten, Kundendokumente oder Originalunterschriften in Tickets oder Logs ausgeben. Erst einen freigegebenen TESTSERVICE-POD zum tatsächlichen Ziel übertragen und wieder zurücklesen; danach den Bestand nachholen. Der gefährliche produktive POD-Status-Massenaudit bleibt deaktiviert (Issue #899).
