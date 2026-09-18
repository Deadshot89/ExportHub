# ExportHUB POD-Zweitsicherung – Microsoft Graph Runbook

Stand: RC1166 / P0 Issue #210

## Ziel

Nach einer bestätigten Abholung wird der POD zuerst im ExportHUB-Azure-Speicher gesichert und anschließend automatisch nach Microsoft 365 in den vorgesehenen POD-Archivordner kopiert.

Die Azure-Primärsicherung funktioniert bereits. Die Microsoft-365-Zweitsicherung bleibt fail-closed, solange Microsoft Graph nicht vollständig konfiguriert ist.

## Aktueller Blocker

Folgende Backend-App-Settings fehlen aktuell sowohl im TESTSERVICE als auch in PRODUCTION:

- EXPORTHUB_GRAPH_TENANT_ID
- EXPORTHUB_GRAPH_CLIENT_ID
- EXPORTHUB_GRAPH_CLIENT_SECRET

Zusätzlich sollten Zielkonto und Zielordner explizit gepflegt werden:

- EXPORTHUB_POD_DRIVE_USER
- EXPORTHUB_POD_FOLDER = 003 Export/ExportHub/Abliefernachweise

Secret-Werte dürfen niemals im Repository, im Browser-State, in Logs oder in Frontend-Dateien abgelegt werden.

## 1. Microsoft Entra App Registration

Eine App Registration für die serverseitige ExportHUB-POD-Sicherung verwenden oder neu anlegen.

Benötigt:

- Directory (Tenant) ID → EXPORTHUB_GRAPH_TENANT_ID
- Application (Client) ID → EXPORTHUB_GRAPH_CLIENT_ID
- Client Secret → EXPORTHUB_GRAPH_CLIENT_SECRET

Der bestehende Code verwendet den OAuth-2.0-Client-Credentials-Flow mit:

- grant_type=client_credentials
- scope=https://graph.microsoft.com/.default

## 2. Microsoft Graph Berechtigung

Für den aktuell verwendeten Upload-Endpunkt auf ein Benutzerlaufwerk benötigt die App als Application Permission:

- Microsoft Graph → Files.ReadWrite.All

Danach Administratorzustimmung (Admin consent) erteilen.

Hinweis: Das ist für diesen Graph-Endpunkt die niedrigste dokumentierte Application Permission. Falls später auf einen dedizierten SharePoint-Site-/Drive-Ansatz umgestellt wird, sollte ein enger begrenztes Berechtigungsmodell geprüft werden.

## 3. Azure Static Web Apps App Settings

Die Werte müssen als serverseitige App Settings / Umgebungsvariablen hinterlegt werden. Sie sind dann nur für die Backend-API über process.env verfügbar.

Für jede tatsächlich verwendete Umgebung separat prüfen:

### TESTSERVICE

- EXPORTHUB_GRAPH_TENANT_ID
- EXPORTHUB_GRAPH_CLIENT_ID
- EXPORTHUB_GRAPH_CLIENT_SECRET
- EXPORTHUB_POD_DRIVE_USER
- EXPORTHUB_POD_FOLDER

### PRODUCTION

- EXPORTHUB_GRAPH_TENANT_ID
- EXPORTHUB_GRAPH_CLIENT_ID
- EXPORTHUB_GRAPH_CLIENT_SECRET
- EXPORTHUB_POD_DRIVE_USER
- EXPORTHUB_POD_FOLDER

Azure Portal:

1. Azure Static Web App öffnen.
2. Einstellungen / Environment variables bzw. Umgebungsvariablen öffnen.
3. Zielumgebung auswählen.
4. Werte hinzufügen.
5. Anwenden und speichern.
6. Keine Secrets in GitHub-Dateien kopieren.

## 4. Zielkonto prüfen

Das unter EXPORTHUB_POD_DRIVE_USER konfigurierte Microsoft-365-Konto muss ein erreichbares OneDrive-/Microsoft-365-Laufwerk besitzen.

Der aktuelle ExportHUB-Endpunkt schreibt über Microsoft Graph nach:

/users/{EXPORTHUB_POD_DRIVE_USER}/drive/root:/{EXPORTHUB_POD_FOLDER}/{POD-Datei}:/content

## 5. Technische Prüfung

Nach dem Speichern der Azure App Settings:

1. RC1144 POD Backup Reconcile manuell ausführen.
2. TESTSERVICE muss HTTP 2xx liefern.
3. PRODUCTION muss HTTP 2xx liefern.
4. graphConfigured darf nicht mehr false sein.
5. errorCount muss 0 sein.
6. pendingCount muss in PRODUCTION nach erfolgreicher Nachholung 0 erreichen.
7. Bereits offene PODs müssen in Microsoft 365 nachgezogen werden.

## 6. Funktionale Abnahme

Mit einer echten Testsendung:

1. QR-Abholung vollständig bestätigen.
2. Prüfen, dass ein echter POD erzeugt wird.
3. Sendungsübersicht muss Azure-Sicherung anzeigen.
4. Microsoft-365-Zweitsicherung muss anschließend als erfolgreich angezeigt werden.
5. Datei im Zielordner öffnen und PDF-Inhalt prüfen.
6. Dateiname und Referenz mit der Sendung vergleichen.
7. Keine Secrets oder technischen Rohfehler dürfen für normale Benutzer sichtbar sein.

## 7. Fehlerbilder

### GRAPH_NOT_CONFIGURED

Mindestens einer der drei Pflichtwerte Tenant ID, Client ID oder Client Secret fehlt in der Backend-Umgebung.

### 401 / invalid_client

Client-ID, Tenant-ID oder Client-Secret prüfen. Ablaufdatum des Client-Secrets prüfen.

### 403 / Authorization_RequestDenied

Graph Application Permission und Admin Consent prüfen.

### Drive-/User-Fehler

EXPORTHUB_POD_DRIVE_USER prüfen und sicherstellen, dass das Zielkonto ein nutzbares Microsoft-365-Laufwerk besitzt.

### Pending PODs

RC1144 erneut ausführen. Die Nachholung wählt offene Backups fair nach dem ältesten Versuch aus.

## Abnahmekriterium P0

Der P0 ist erst geschlossen, wenn gleichzeitig gilt:

- TESTSERVICE Graph konfiguriert
- PRODUCTION Graph konfiguriert
- RC1144 in beiden Umgebungen grün
- PRODUCTION pendingCount=0
- bestehende offene PODs nachgezogen
- mindestens ein neuer echter POD automatisch in Azure und Microsoft 365 gespeichert
