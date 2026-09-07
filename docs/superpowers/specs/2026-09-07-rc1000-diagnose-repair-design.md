# RC1000 Diagnose-Reparatur Design

## Ziel

Die in `ExportHUB_Fehlerdiagnose_2026-09-07.json` dokumentierten Fehler werden auf dem isolierten Branch `rc1000-clean-navigation-search` behoben, ohne `main` oder Produktion direkt zu verändern.

## Diagnosebasis

Die Diagnose zeigt vier technische Fehlerblöcke:

1. Wiederholte `410 Gone` bei `GET /api/pickup-status` in mehreren Ansichten (`shipment`, `shipmentoverview`, `cmr`, `customerfolder`, `tasks`, `rights`, `diagnostics`).
2. Langsame bzw. abbrechende State-Aufrufe (`POST /api/exporthub-state?mode=save&ack=1`, `POST /api/exporthub-state?mode=meta`) mit Full-Reads, Upload-Zeiten und Abbrüchen bis 30 Sekunden.
3. Große DOM-Rebuilds und Long Tasks bis über 8 Sekunden, insbesondere in `shipment`, `shipmentoverview`, `tasks`, `customerfolder` und `abd`.
4. `409 Conflict` bei `POST /api/loader-pins-admin` sowie unnötig langsame PIN-Verwaltungsaufrufe.

## Architektur

### QR-Abholung

Der Client darf `pickup-status` nur für serverseitig bestätigte, sichere Pickup-Tokens abfragen. Ein lokal erzeugter oder historischer Token darf nicht als registriert gelten. Nach `pickup-init` wird ausschließlich der vom Server bestätigte Token gespeichert und für QR-Link sowie Statusabfrage verwendet. Ungültige/abgelaufene Tokens werden nicht in einer Polling-Schleife weiter abgefragt.

Die bestehende RC995-Sicherheitsarchitektur bleibt erhalten: 48-Hex-Pickup-Token, serverseitige Public-Access-Registrierung, getrennte Umgebungen, One-Time-/Ablauflogik, keine Wiederbelebung alter unsicherer Links.

### State-Speichern

State-Schreibvorgänge werden so reduziert, dass identische bzw. unmittelbar aufeinanderfolgende Saves zusammengeführt werden. Full-Reads werden nur verwendet, wenn die Merge-/Konfliktlogik sie tatsächlich benötigt. Bereits vorhandene Memory-/Revision-Informationen werden bevorzugt. Fehlerhafte Parallel-Saves dürfen keinen erneuten Render- oder Save-Sturm auslösen.

### Rendering

Die betroffenen Views werden gegen Mehrfach-Render in derselben Ereigniskette gehärtet. Status-Polling, State-Save und View-Render dürfen sich nicht gegenseitig mehrfach triggern. Bestehende Rendering-Funktionen bleiben erhalten; Ziel ist Coalescing/Deduplizierung statt UI-Umbau.

### Verlader-PINs

Ein `409 PIN_EXISTS` bleibt fachlich korrekt, wird aber clientseitig als verständlicher Dublettenfall behandelt und darf keine generische Netzwerkfehlerkaskade erzeugen. Gleichzeitige Storage-Updates behalten die vorhandene ETag-/Retry-Logik. Wiederholte Listen-/Save-Aufrufe werden reduziert.

## Betroffene Dateien

Voraussichtlich:
- `index.html`
- `TESTVERSION.html`
- `api/shared/public-access-store.js`
- `api/pickup-init/index.js`
- `api/pickup-status/index.js`
- `api/exporthub-state/index.js`
- `api/loader-pins-admin/index.js`
- `api/shared/loader-pin-store.js`
- neue RC1000-Regressionstests und ein TESTSERVICE-Workflow

Falls während der Ursachenanalyse ein Materialisierer die aktive Quelle einer Änderung besitzt, wird dieser statt nur des generierten Artefakts korrigiert.

## Tests

Vor jeder Korrektur wird ein reproduzierbarer Test für den jeweiligen Fehlerfall ergänzt. Mindestens zu prüfen:
- QR-Statusabfrage nur für bestätigten Server-Token.
- Kein wiederholtes Polling nach `410` für denselben Token.
- `pickup-init` und direkt folgende `pickup-status`-Abfrage verwenden denselben 48-Hex-Token.
- State-Saves werden bei identischem Stand dedupliziert bzw. zusammengeführt.
- View-Render wird innerhalb einer Ereigniskette coalesced.
- `PIN_EXISTS` wird fachlich behandelt, ohne Retry-/Render-Schleife.
- bestehende Baseline-, RC995-, RC998- und RC1000-Verträge bleiben grün.

## Deployment und Freigabe

Zuerst wird ausschließlich `rc1000-clean-navigation-search` geändert. Danach laufen alle relevanten Tests. Anschließend wird nur TESTSERVICE deployt und live geprüft. `main` und Produktion bleiben unverändert, bis der Nutzer ausdrücklich eine spätere Produktionsfreigabe erteilt.

## Erfolgskriterien

Der Reparaturblock gilt erst als abgeschlossen, wenn:
- die neuen Regressionstests grün sind,
- die bestehenden Regressionstests grün sind,
- TESTSERVICE erfolgreich deployt ist,
- Pickup-Seite und API live erreichbar sind,
- ein frisch erzeugter QR-Code auf TESTSERVICE mit dem serverregistrierten Token funktioniert,
- keine künstlichen RED-Abbrüche mehr im Reparaturworkflow vorhanden sind.
