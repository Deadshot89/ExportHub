# ExportHUB AVIS-Mail – Microsoft Graph Mail.Send freigeben

Seit RC1434 öffnen Lieferavis und AVIS-Erinnerung aus der Sendungsübersicht einen vorbereiteten Outlook-Mailentwurf, genau wie die reguläre Anmeldung. Empfänger, Sales-/Kunden-CC, Tobias sowie die Pflicht-CC der Anmeldung werden übernommen. Der Benutzer prüft und sendet in Outlook; ExportHUB protokolliert nur das Öffnen mit Benutzer und Zeit. Für diesen Ablauf ist keine Graph-Mail-App und kein Login für das Despatch-Postfach erforderlich.

Dieses Runbook gilt weiterhin für die separate automatische Benachrichtigung bei Kunden-Uploads und den optionalen direkten Mail-Endpunkt. Deren Graph-Readiness wird im Release sichtbar diagnostiziert, blockiert den verpflichtend geprüften Outlook-Ablauf aber nicht. Eine fehlgeschlagene Upload-Mail-Diagnose ist keine Versandbestätigung.

Stand: RC1440

## Ausgangslage

ExportHUB verwendet Microsoft Graph mit Client-Credentials. Die App authentifiziert sich bereits erfolgreich, aber der aktuelle Token enthält die Application-Rolle `Mail.Send` nicht.

Erforderliche Berechtigung:

- Resource: Microsoft Graph
- Typ: Application
- Name: `Mail.Send`
- Permission ID: `b633e1c5-b582-4048-a93e-9f11b44c7e96`
- Admin Consent: erforderlich

## Wichtig

- Nicht `Delegated permissions` verwenden.
- Keine Client-Secrets in GitHub, Issues, Screenshots oder Frontend-Dateien kopieren.
- Die richtige App-Registrierung über die in Azure hinterlegte `EXPORTHUB_GRAPH_CLIENT_ID` identifizieren.
- Falls TESTSERVICE und PRODUCTION unterschiedliche Client-IDs verwenden, muss die Freigabe für beide App-Registrierungen erfolgen.

## Entra-Schritte

1. Microsoft Entra Admin Center öffnen.
2. Zu **Identity > Applications > App registrations** wechseln.
3. Die ExportHUB-App anhand ihrer **Application (client) ID** auswählen.
   - Maßgeblich ist der Wert aus dem jeweiligen Azure App Setting `EXPORTHUB_GRAPH_CLIENT_ID`.
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
