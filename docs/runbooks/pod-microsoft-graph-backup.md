# ExportHUB POD-Sicherung – Azure, unveränderliches Archiv und SharePoint

Stand: RC1455

## Ziel

Für digitale Abholnachweise gilt ab RC1455 ein verlustsicherer Mehrfachspeicher-Vertrag:

1. Digitale Fahrerunterschrift und – bei ABD – die Unterschrift „Zolldokumente erhalten“ werden im primären Azure-POD-Speicher gespeichert.
2. Dieselben Signaturbytes werden zusätzlich unveränderlich im getrennten Azure-POD-Archiv gespeichert und per Read-back, SHA-256 und Dateigröße verifiziert.
3. Aus den Abholdaten wird die signierte POD-Ladeliste erzeugt und im primären Azure-POD-Speicher abgelegt.
4. Die POD-PDF wird zusätzlich unveränderlich im Azure-Archiv gesichert.
5. Die signierte POD-PDF muss zusätzlich in das konfigurierte Microsoft-365-/SharePoint-Ziel kopiert werden.

Eine temporäre SharePoint-/Graph-Störung darf die bereits erfasste digitale Unterschrift niemals verwerfen oder eine erneute Fahrerunterschrift verlangen. Azure Primärspeicher + unveränderliches Archiv schützen den Originalnachweis, bis die SharePoint-Kopie automatisch nachgeholt wurde.

## Verbindliche Betriebslogik

- Eine erfasste digitale Unterschrift gilt erst als gespeichert, nachdem Primärblob und unveränderliche Archivkopie bytegenau bestätigt wurden.
- Existiert beim Retry bereits dieselbe Signatur, wird sie nicht überschrieben; stattdessen wird der vorhandene Inhalt erneut gegen Hash und Größe geprüft.
- Ein POD darf erst dann als **vollständig gesichert** gemeldet werden, wenn `azureSaved=true`, `archiveSaved=true` und `driveSaved=true` bestätigt sind.
- Fehlt die SharePoint-Kopie, bleibt der Status `pending-sharepoint` und der Reconcile-Workflow versucht die Kopie erneut.
- Die Website zeigt Azure-/Archiv-/SharePoint-Status getrennt und darf bei fehlendem SharePoint-Nachweis keinen falschen grünen Komplettstatus anzeigen.
- Bestehende archivierte PODs mit alten kurzlebigen Pickup-Token-URLs werden über den RC1340-Reconcile wieder auf den dauerhaften internen Dokumentpfad verlinkt.
- Ein abgelaufener öffentlicher Pickup-Token wird **nicht** künstlich reaktiviert.

## Azure-Konfiguration

Primärcontainer:

- `exporthub-pod`

Unveränderliche Archivkopie:

- `exporthub-pod-backup`

Optional kann mit

- `EXPORTHUB_POD_BACKUP_CONNECTION_STRING`

ein separater Azure Storage Account für die Archivkopie hinterlegt werden. Das erhöht die Ausfallsicherheit gegenüber Problemen auf Storage-Account-Ebene.

## SharePoint / Microsoft Graph

Das SharePoint-Ziel wird serverseitig über Microsoft Graph aufgelöst. Bevorzugt werden ein explizit konfiguriertes Drive-/Folder-Ziel der vorgesehenen Dokumentbibliothek; bestehende kompatible Zielauflösungen bleiben erhalten.

Relevante Konfigurationswerte sind unter anderem:

- `EXPORTHUB_GRAPH_TENANT_ID`
- `EXPORTHUB_GRAPH_CLIENT_ID`
- `EXPORTHUB_GRAPH_CLIENT_SECRET`
- `EXPORTHUB_POD_DRIVE_USER`
- `EXPORTHUB_POD_FOLDER`
- `EXPORTHUB_POD_DRIVE_ID`
- `EXPORTHUB_POD_FOLDER_ID`

Graph-Zugangsdaten, Zugriffstoken und Secrets dürfen niemals in Frontend-Dateien, Browser-State, Logs, Issues oder Repository-Dateien geschrieben werden.

## Reconcile-Abnahme

Der Workflow `.github/workflows/rc1144-pod-backup-reconcile.yml` führt offene Azure-, Archiv-, Relink- und SharePoint-Arbeiten nach.

Für PRODUCTION gilt als erfolgreicher Nachweis:

- HTTP 2xx
- `ok=true`
- keine verpflichtende offene Sicherungsarbeit
- `pendingCount=0`
- `errorCount=0`
- keine offene SharePoint-Nachsicherung

Gezielte Nachweise für eine Referenz dürfen `saved-now` oder `already-saved` erst liefern, wenn auch die SharePoint-Kopie bestätigt ist.

## Fehlerfall

Wenn SharePoint oder Microsoft Graph vorübergehend nicht erreichbar ist:

- die Abholung und digitale Unterschrift bleiben gespeichert,
- das Original bleibt im Azure-Primärspeicher und im unveränderlichen Archiv erhalten,
- der POD bleibt als `pending-sharepoint` sichtbar,
- der Wartungsworkflow versucht die SharePoint-Kopie erneut,
- es wird kein falscher vollständiger Sicherungsstatus gesetzt.

Wenn eine vorhandene Primär- oder Archivkopie bei der Integritätsprüfung nicht zu den erfassten Originalbytes passt, schlägt der Vorgang fail-closed fehl; eine abweichende Signatur wird niemals still überschrieben.
