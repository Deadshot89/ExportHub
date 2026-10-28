# ExportHUB360 POD-Sicherung – Azure-Archiv und SharePoint-Notfallkopie

Stand: RC1713 – Betriebsregeln und Nachweis

## Ziel und zwei getrennte Nachweise

Jeder echte digitale POD ist die **vollständige, unterschriebene Ladeliste**. Das Original darf bei einem Ausfall der Nachsicherung weder überschrieben noch neu mit einer fehlenden/abweichenden Unterschrift gerendert werden.

1. **Technisches Azure-Archiv:** Das Original liegt im Primärspeicher `exporthub-pod` und wird content-addressed in `exporthub-pod-backup` gesichert. Die Archivdatei wird über SHA-256 und Dateigröße geprüft. Ein vorhandenes Archivoriginal wird nicht blind überschrieben.
2. **Vereinbarte unabhängige SharePoint-Notfallsicherung:** Das **gleiche** Original wird zusätzlich in Microsoft 365 abgelegt und nach dem Upload über Graph zurückgelesen. Erst bei bestätigter Datei-ID, übereinstimmendem SHA-256 und Rücklesezeitpunkt ist die SharePoint-Kopie nachgewiesen.

**Wichtig:** `archiveSaved=true` bedeutet **nur** „Azure-Archiv erfolgreich“. Es bedeutet **nicht** „SharePoint-Sicherung erfolgreich“. Ein entsprechender SharePoint-Status darf ausschließlich aus einer bestätigten Graph-Kopie entstehen (`driveSaved=true`, `driveItemId`, `driveVerifiedHash`, `driveVerifiedAt`). Eine offene oder fehlerhafte SharePoint-Kopie wird sichtbar als **ausstehend** geführt, nicht als vollständig gesichert.

## Abläufe und Fehlerverhalten

- Die Abholung und das signierte Original werden nicht durch einen späteren SharePoint-Ausfall gelöscht, überschrieben oder zurückgesetzt. Azure-Archiv und SharePoint-Kopie werden **separat** bewertet.
- `.github/workflows/rc1144-pod-backup-reconcile.yml` prüft die Azure-Archivkopie und holt fehlende SharePoint-Kopien nach, soweit technisch möglich.
- `pendingCount`, `errorCount`, `archiveSaved` und die separaten SharePoint-Kennzahlen sind zu kontrollieren. Der Workflow meldet eine noch ausstehende konfigurierte SharePoint-Kopie als **unvollständig** – auch wenn die Azure-Archivkopie bereits bestätigt ist.
- Ein HTTP-200-Reconcile, `ok=true` oder „0 offene Azure-Archive“ ist **kein Nachweis** einer vollständigen SharePoint-Sicherung.
- Niemals fiktive PDFs, neue Ladelisten oder künstliche Unterschriften für historische PODs erzeugen. Historische beschädigte oder widersprüchliche POD-Statusfälle bleiben zur Einzelfallprüfung offen (Issue #899).

## Azure-Archiv-Konfiguration

Das Azure-Archiv verwendet standardmäßig denselben Azure Storage Account wie der POD-Primärspeicher, jedoch einen anderen Container `exporthub-pod-backup`. Optional kann `EXPORTHUB_POD_BACKUP_CONNECTION_STRING` einen unabhängigen Azure Storage Account anbinden. Dies verbessert die Ausfallsicherheit, ersetzt aber **nicht** die gesondert vereinbarte SharePoint-Notfallkopie.

## Microsoft Graph – Ziel und Berechtigungen

Erforderlich sind die Azure-seitig geschützten Werte:

- `EXPORTHUB_GRAPH_TENANT_ID`
- `EXPORTHUB_GRAPH_CLIENT_ID`
- `EXPORTHUB_GRAPH_CLIENT_SECRET`

Die Zielauflösung kann per eindeutigem `EXPORTHUB_POD_DRIVE_USER` + `EXPORTHUB_POD_FOLDER` oder über das vollständige Paar `EXPORTHUB_POD_DRIVE_ID` + `EXPORTHUB_POD_FOLDER_ID` erfolgen (ID-Paar-Readiness ab RC1712). Halbe ID-Paare bleiben unzulässig. Der historische Schalter `EXPORTHUB_POD_M365_ENABLED` darf eine vollständig konfigurierte Zielablage nicht blockieren.

Geheimnisse, reale Kundendokumente und Unterschriften gehören **niemals** in GitHub Issues, Workflow-Logs oder öffentliche Dateien.

## Bekannter Graph-Zielfehler – Issue #999

`GRAPH_DIRECT_PATH_TARGET_FAILED` mit Provider-Code `ResourceNotFound` weist nach, dass der bisherige Zielpfad nicht erfolgreich beschrieben werden konnte. Dies **beweist nicht**, ob der Ordner fehlt oder ob App-Berechtigungen, Benutzer-/Drive-Zuordnung oder der Pfad falsch sind.

Sicherer Prüfablauf:

1. Unter berechtigtem Zugriff Graph-Ziel und Berechtigungen **nur lesend** prüfen. Der RC1144-Workflow unterstützt hierfür `graphTargetDiagnostic=true`; der reine Diagnoseaufruf führt keine POD-Nachsicherung aus.
2. Drive-ID, Folder-ID und die tatsächlich vorhandenen Ordner serverseitig bestätigen, ohne vertrauliche Kennungen im Issue abzulegen.
3. Erst im freigegebenen TESTSERVICE einen zulässigen Original-Test-POD hochladen, über Graph zurücklesen und seinen SHA-256-Hash mit der gespeicherten Originaldatei vergleichen.
4. Die noch offenen Kopien kontrolliert nachholen. Status erst nach tatsächlicher Graph-Rücklesebestätigung als `driveSaved=true` behandeln.

**Nicht** den produktiven POD-Status-Massenaudit aktivieren. Keine pauschalen Änderungen an den 89 historischen Fällen, keine Ersetzung von signierten Originaldateien.

## Abnahme

Azure-Archiv und SharePoint müssen jeweils einzeln vollständig belegt sein. Ein erfolgreicher Produktionsrelease oder eine bestandene PR-CI ersetzt weder einen authentifizierten Original-PDF-Abruf noch den unabhängigen SharePoint-Readback. Offene SharePoint-Kopien bleiben bis zum echten Nachweis als offen dokumentiert.
