# ExportHUB AVIS-Mail – Microsoft Graph Mail.Send freigeben

Seit RC1434 öffnen Lieferavis und AVIS-Erinnerung aus der Sendungsübersicht einen vorbereiteten Outlook-Mailentwurf, genau wie die reguläre Anmeldung. Empfänger, Sales-/Kunden-CC, Tobias sowie die Pflicht-CC der Anmeldung werden übernommen. Der Benutzer prüft und sendet in Outlook; ExportHUB protokolliert nur das Öffnen mit Benutzer und Zeit. Für diesen Ablauf ist keine Graph-Mail-App und kein Login für das Despatch-Postfach erforderlich.

Dieses Runbook gilt weiterhin für die separate automatische Benachrichtigung bei Kunden-Uploads und den optionalen direkten Mail-Endpunkt. Deren Graph-Readiness wird im Release sichtbar diagnostiziert, blockiert den verpflichtend geprüften Outlook-Ablauf aber nicht. Eine fehlgeschlagene Upload-Mail-Diagnose ist keine Versandbestätigung.

Stand: 07.11.2026 · Update AVIS-Mail-Authentifizierung

## Ausgangslage

ExportHUB verwendet Microsoft Graph mit Client-Credentials. Historisch fehlte einem ausgestellten App-Token die Application-Rolle `Mail.Send`. Im Produktionsrelease vom 07.11.2026 trat zusätzlich `GRAPH_AUTH_FAILED` auf (`authenticated=false`). Zuerst muss die Token-Ausstellung funktionieren; erst danach ist die Berechtigungsprüfung aussagekräftig.

Erforderliche Berechtigung:

- Resource: Microsoft Graph
- Typ: Application
- Name: `Mail.Send`
- Permission ID: `b633e1c5-b582-4048-a93e-9f11b44c7e96`
- Admin Consent: erforderlich

## Wichtig

- Nicht `Delegated permissions` verwenden.
- Keine Client-Secrets in GitHub, Issues, Screenshots oder Frontend-Dateien kopieren.
- Die tatsächliche AVIS-Mail-App über `EXPORTHUB_MAIL_GRAPH_CLIENT_ID` (dediziert) oder `EXPORTHUB_GRAPH_CLIENT_ID` (gemeinsam) identifizieren.
- Falls TESTSERVICE und PRODUCTION unterschiedliche Client-IDs verwenden, muss die Freigabe für beide App-Registrierungen erfolgen.

## Schritt 0 – sichere App-Anmeldedaten prüfen (vor Mail.Send)

1. In **Azure Static Web Apps → Konfiguration/Umgebungsvariablen** die *Namen* der gesetzten Mail-Einstellungen prüfen; Werte und Secrets niemals in Tickets oder Chats kopieren.
2. Die AVIS-Mail-Anmeldung verwendet entweder das vollständige dedizierte Tripel
   `EXPORTHUB_MAIL_GRAPH_TENANT_ID`, `EXPORTHUB_MAIL_GRAPH_CLIENT_ID`, `EXPORTHUB_MAIL_GRAPH_CLIENT_SECRET`
   **oder** das vollständige gemeinsame Tripel
   `EXPORTHUB_GRAPH_TENANT_ID`, `EXPORTHUB_GRAPH_CLIENT_ID`, `EXPORTHUB_GRAPH_CLIENT_SECRET`.
   Wenn eine dedizierte Mail-Einstellung vorhanden ist, müssen **alle drei** Mail-Werte zu derselben Entra-App gehören. Gemischte Tenant-/App-/Secret-Kombinationen sind nicht zulässig.
3. Die Application (client) ID und Directory (tenant) ID mit der **für AVIS-Mail konfigurierten** Entra-App abgleichen, nicht ungeprüft mit der SharePoint-/POD-App.
4. Bei abgelaufenem oder widerrufenem Secret ein neues **Client-Secret-Value** aus Entra in das passende serverseitige Azure-App-Setting übernehmen (nicht die Secret-ID). Keine Werte im Browser-Frontend, in GitHub-Dateien oder in Workflow-Logs ablegen.
5. Den signierten Workflow **ExportHUB AVIS-Mail Verify** mit `send_test=false` ausführen. Erst bei `authenticated=true` und `audienceOk=true` die `Mail.Send`-Berechtigung prüfen. `GRAPH_AUTH_FAILED` bedeutet **nicht automatisch fehlenden Admin-Consent**.
6. Die Diagnose enthält nur `authFailureCategory` und `upstreamStatus`, zum Beispiel `CLIENT_SECRET_EXPIRED`, `CLIENT_SECRET_REJECTED`, `APPLICATION_NOT_FOUND`, `TENANT_NOT_FOUND` oder `TOKEN_ENDPOINT_UNAVAILABLE`. Keine Microsoft-Entra-Rohantworten veröffentlichen.

## Entra-Schritte

1. Microsoft Entra Admin Center öffnen.
2. Zu **Identity > Applications > App registrations** wechseln.
3. Die ExportHUB-App anhand ihrer **Application (client) ID** auswählen.
   - Maßgeblich ist `EXPORTHUB_MAIL_GRAPH_CLIENT_ID`, falls das dedizierte Mail-Tripel konfiguriert ist; sonst `EXPORTHUB_GRAPH_CLIENT_ID`.
4. **API permissions** öffnen.
5. **Add a permission** wählen.
6. **Microsoft Graph** wählen.
7. **Application permissions** wählen.
8. Nach `Mail.Send` suchen und ausschließlich **Mail.Send** hinzufügen.
9. Zur Übersicht **API permissions** zurückkehren.
10. **Grant admin consent for <Tenant>** wählen und bestätigen.
11. Prüfen, dass der Status für `Mail.Send` als **Granted for <Tenant>** angezeigt wird.

## Empfohlene Begrenzung

`Mail.Send` als Application Permission kann grundsätzlich das Senden als Benutzer im Tenant erlauben. Wenn organisatorisch möglich, den App-Zugriff in Exchange Online zusätzlich auf das tatsächlich verwendete ExportHUB-Senderpostfach begrenzen.

## Verifikation nach dem Consent

GitHub > Repository **Deadshot89/ExportHub** > **Actions** > **ExportHUB AVIS-Mail Verify** > **Run workflow**.

### Stufe 1 – Readiness

- `send_test = false`
- Erwartet:
  - TESTSERVICE: HTTP 200
  - PRODUCTION: HTTP 200
  - `configured=true`
  - `authenticated=true`
  - `audienceOk=true`
  - `mailSendGranted=true`

Wenn hier weiterhin `GRAPH_MAIL_PERMISSION_MISSING` erscheint, wurde der Consent für die falsche App oder den falschen Tenant erteilt oder der neue Token enthält die Rolle noch nicht.

### Stufe 2 – echter interner Sendetest

Workflow erneut starten:

- `send_test = true`

Der Sendetest verwendet denselben dedizierten AVIS-Absendervertrag wie der produktive AVIS-Versand (`EXPORTHUB_AVIS_MAIL_SENDER`, Fallback `DespatchNettetal@essentra.com`). Der Workflow darf ausschließlich eine klar markierte Testmail an

`DespatchNettetal@essentra.com`

senden.

Die Testmail enthält keine Kundendaten und keine Kundendokumente.

Erwartet:

- TESTSERVICE Readiness: grün
- PRODUCTION Readiness: grün
- PRODUCTION interner Sendetest: grün
- `mailProbe.ok=true`

## Abschluss

Issue #449 erst schließen, wenn beide Readiness-Prüfungen und der interne Production-Sendetest erfolgreich waren.
