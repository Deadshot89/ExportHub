# ExportHUB – Azure Security App Settings Runbook

Stand: RC1192 / Issues #215 und #231

## Ziel

Dieses Runbook beschreibt die sichere Konfiguration der zwei noch fehlenden serverseitigen ExportHUB-Sicherheitswerte:

- `EXPORTHUB_CUSTOMER_PORTAL_KEY` für TESTSERVICE und PRODUCTION, mit getrennten Werten je Umgebung.
- `EXPORTHUB_AUTH_SIGNING_SECRET` für PRODUCTION.

Kein echter Secret-Wert darf in GitHub, Chat, Browser-State, Screenshots, Tickets, Workflow-Logs oder Frontend-Dateien übernommen werden.

Microsoft dokumentiert Azure Static Web Apps Application Settings als backendseitige Umgebungsvariablen. Im Azure-Portal werden sie unter **Settings → Environment variables** verwaltet. Quelle:
https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings

## Aktueller Live-Stand

### TESTSERVICE

Host:
`ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net`

- Kundenportal-Readiness: `CUSTOMER_PORTAL_NOT_CONFIGURED`
- `EXPORTHUB_CUSTOMER_PORTAL_KEY`: fehlt
- Auth-Signing: bereits dediziert konfiguriert; nicht im Rahmen dieses Runbooks ändern.

### PRODUCTION

Host:
`wonderful-forest-0f315e310.7.azurestaticapps.net`

- `EXPORTHUB_CUSTOMER_PORTAL_KEY`: vor Produktionsfreigabe separat konfigurieren.
- `EXPORTHUB_AUTH_SIGNING_SECRET`: fehlt laut RC1050 Storage Probe.
- Storage und Runtime sind erreichbar; der Signing-Fallback nutzt aktuell noch das Storage-Secret.

## Sicherheitsregeln

1. Für TESTSERVICE und PRODUCTION niemals denselben Kundenportal-Key verwenden.
2. Kundenportal-Key und Auth-Signing-Secret niemals wiederverwenden.
3. Werte lokal erzeugen und direkt in Azure eintragen.
4. Werte niemals in `api/local.settings.example.json`, GitHub Secrets, Issues oder Workflowdateien kopieren, solange der aktuelle ExportHUB-Betriebsweg Azure Static Web Apps App Settings verwendet.
5. Vor dem Speichern die gewählte Azure-Umgebung kontrollieren.
6. Nur Statusfelder wie `configured=true` oder `signingSecretConfigured=true` dürfen in Logs erscheinen; nie der Wert selbst.

## 1. Sichere Werte lokal erzeugen

Empfehlung: je Secret mindestens 48 zufällige Bytes erzeugen. Das liegt über der technischen Mindestlänge des Kundenportal-Keys von 32 Zeichen.

### Windows PowerShell

Ausgabe nur lokal anzeigen und direkt in Azure übernehmen:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Diesen Vorgang für jeden benötigten Wert separat wiederholen.

Benötigt werden drei unterschiedliche Werte:

- TESTSERVICE → `EXPORTHUB_CUSTOMER_PORTAL_KEY`
- PRODUCTION → `EXPORTHUB_CUSTOMER_PORTAL_KEY`
- PRODUCTION → `EXPORTHUB_AUTH_SIGNING_SECRET`

Den bereits vorhandenen TESTSERVICE-Wert für `EXPORTHUB_AUTH_SIGNING_SECRET` nicht verändern.

## 2. TESTSERVICE Kundenportal-Key setzen

1. Azure Portal öffnen.
2. Die ExportHUB Static Web App öffnen.
3. Unter **Settings** → **Environment variables** öffnen.
4. Die Umgebung auswählen, die den TESTSERVICE-Host
   `ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net`
   bedient.
5. **+ Add** wählen.
6. Name exakt:
   `EXPORTHUB_CUSTOMER_PORTAL_KEY`
7. Den lokal erzeugten TESTSERVICE-Wert einfügen.
8. **Apply** wählen.
9. Noch einmal **Apply** wählen, um die Änderung zu speichern.
10. Den Wert danach nicht in Notizen, Issue-Kommentare oder Screenshots übernehmen.

## 3. PRODUCTION Kundenportal-Key setzen

1. In derselben Static Web App **Environment variables** öffnen.
2. Die Produktionsumgebung auswählen, die den Host
   `wonderful-forest-0f315e310.7.azurestaticapps.net`
   bedient.
3. **+ Add** wählen.
4. Name exakt:
   `EXPORTHUB_CUSTOMER_PORTAL_KEY`
5. Einen **anderen**, separat erzeugten Wert als im TESTSERVICE eintragen.
6. **Apply** und anschließend erneut **Apply**.

Der Produktionswert darf nicht aus dem TESTSERVICE kopiert werden.

## 4. PRODUCTION Auth-Signing-Secret setzen

In der PRODUCTION-Umgebung:

1. **+ Add** wählen.
2. Name exakt:
   `EXPORTHUB_AUTH_SIGNING_SECRET`
3. Einen neuen, unabhängigen Zufallswert eintragen.
4. **Apply** und anschließend erneut **Apply**.
5. `EXPORTHUB_STORAGE_CONNECTION_STRING` nicht ändern.

RC1186 ist für diese Migration ausgelegt:
- vorhandene serverseitig gespeicherte Legacy-Sessions können weiterhin über ihren gespeicherten Token-Hash aufgelöst werden,
- neue Signed Sessions verwenden das dedizierte Secret,
- der alte Storage-Key wird danach nicht mehr als Signed-Fallback akzeptiert.

## 5. Abnahme Kundenportal-Key – Issue #215

Nach dem Speichern beider Kundenportal-Werte den normalen Drei-Umgebungen-Deploy auf `main` neu ausführen.

Erwartete Reihenfolge:

1. Main Contract grün.
2. Lokaler Browser-Gate grün.
3. TESTSERVICE Deploy grün.
4. TESTSERVICE Browser-Gate grün.
5. **RC1170 TESTSERVICE Kundenportal-Verschlüsselung prüfen**:
   - HTTP 200
   - `ok=true`
   - `configured=true`
   - `environment=testservice`
6. Produktionsdeploy darf erst danach laufen.
7. **RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen**:
   - HTTP 200
   - `ok=true`
   - `configured=true`
   - `environment=production`
8. Danach die restlichen Produktions-Livechecks vollständig grün abwarten.

Issue #215 erst schließen, wenn zusätzlich Speichern, Re-Auth-Anzeige und Löschen der Kundenportal-Zugangsdaten funktional geprüft wurden.

## 6. Abnahme Production Signing Secret – Issue #231

Nach dem Speichern von `EXPORTHUB_AUTH_SIGNING_SECRET` in PRODUCTION:

1. Workflow **RC1050 Storage Probe** ausführen oder den nächsten automatischen Lauf abwarten.
2. PRODUCTION `/api/exporthub-auth-probe` muss weiterhin `ok=true` und `runtimeReady=true` liefern.
3. PRODUCTION muss jetzt `signingSecretConfigured=true` melden.
4. TESTSERVICE muss weiterhin `signingSecretConfigured=true` melden.
5. Login mit einem normalen Benutzer prüfen.
6. Reload/F5 prüfen.
7. Mindestens eine bereits bestehende Sitzung prüfen.
8. Neue Anmeldung prüfen.
9. Keine Secret-Werte dürfen im Probe-Output erscheinen.

Issue #231 erst danach schließen.

## 7. Rollback

### Kundenportal-Key

Falls die Readiness nach dem Eintrag weiter `configured=false` meldet:

- zuerst Environment-Auswahl und exakten Variablennamen prüfen,
- nicht den Secret-Wert in Logs ausgeben,
- nicht den Release-Gate umgehen,
- Produktionsdeploy blockiert lassen.

Ein bereits zum Verschlüsseln produktiver Zugangsdaten verwendeter Kundenportal-Key darf nicht leichtfertig ersetzt oder gelöscht werden, weil vorhandene verschlüsselte Datensätze sonst nicht mehr entschlüsselt werden können.

### Auth-Signing-Secret

Bei einem unerwarteten Auth-Problem nach Aktivierung:

- Storage-Setting nicht verändern,
- zuerst Auth-Probe und Login prüfen,
- Änderung am Signing-Secret nur kontrolliert zurücknehmen,
- mit erneuter Anmeldung einzelner Benutzer rechnen, insbesondere für Sessions, die nach Aktivierung des dedizierten Secrets ausgestellt wurden,
- Ursache dokumentieren, ohne den Secret-Wert zu protokollieren.

## 8. Abschlusskriterien

### #215 darf geschlossen werden, wenn

- TESTSERVICE Kundenportal-Readiness grün,
- PRODUCTION Kundenportal-Readiness grün,
- Produktionsdeploy vollständig durchgelaufen,
- funktionale Kundenportal-Abnahme grün,
- kein Schlüsselmaterial in Repo, Browser oder Logs.

### #231 darf geschlossen werden, wenn

- PRODUCTION `signingSecretConfigured=true`,
- Login, Reload und bestehende Sitzung geprüft,
- TESTSERVICE unverändert grün,
- kein Secret-Wert in Logs oder Repository.

## POD-Zweitsicherung

Issue #210 ist abgeschlossen. Die verpflichtende POD-Zweitsicherung verwendet seit RC1220 Azure Primärspeicher plus separates Azure-Archiv. Microsoft 365 ist nur noch optional.

Aktueller Betriebsweg:

`docs/runbooks/pod-microsoft-graph-backup.md`
