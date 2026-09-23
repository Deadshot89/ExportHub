# ExportHUB POD-Zweitsicherung – Azure-Archiv und optionales Microsoft 365

Stand: RC1224

## Ziel

Die verpflichtende POD-Sicherung verwendet seit RC1220 zwei serverseitige Azure-Speicherziele:

1. Primärspeicher: `exporthub-pod`
2. Zweitsicherung: `exporthub-pod-backup`

Die Zweitsicherung wird content-addressed gespeichert und beim Wiederfinden über SHA-256-Metadaten und Dateigröße verifiziert. Ein bereits vorhandenes Archivobjekt wird nicht überschrieben.

Microsoft 365 / Microsoft Graph ist **nicht mehr Voraussetzung** für eine vollständige POD-Sicherung. Graph kann optional als zusätzliche dritte Kopie aktiviert werden.

## Verbindliche Betriebslogik

- Ein POD gilt erst dann als vollständig gesichert, wenn Primärspeicher und Azure-Archiv erfolgreich bestätigt sind.
- Der Zustand wird über `archiveSaved=true` gespiegelt.
- Der Reconcile-Workflow `.github/workflows/rc1144-pod-backup-reconcile.yml` holt fehlende Archivkopien nach.
- In PRODUCTION muss der Reconcile mit `pendingCount=0` und `errorCount=0` enden.
- Microsoft-365-Fehler dürfen eine bereits erfolgreiche Azure-Primär- und Archivkopie nicht wieder als ungesichert markieren.

## Azure-Konfiguration

Standardmäßig verwendet das Archiv denselben Azure Storage Account wie der Primärspeicher, aber einen separaten Container.

Optional kann mit

- `EXPORTHUB_POD_BACKUP_CONNECTION_STRING`

ein separater Azure Storage Account für die Archivkopie hinterlegt werden. Das erhöht die Ausfallsicherheit gegenüber Problemen auf Storage-Account-Ebene.

Der Containername ist standardmäßig:

- `exporthub-pod-backup`

## Microsoft 365 optional aktivieren

Microsoft 365 wird nur verwendet, wenn

- `EXPORTHUB_POD_M365_ENABLED=true`

gesetzt ist und die erforderliche Graph-Konfiguration vollständig vorhanden ist.

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

## Optionales Microsoft-365-Fehlerbild

Falls Microsoft 365 zusätzlich aktiviert ist, können weiterhin Graph-spezifische Fehler auftreten. Diese betreffen nur die optionale Zusatzkopie. Die verpflichtende POD-Sicherung bleibt über Azure Primärspeicher + Azure Archiv definiert.
