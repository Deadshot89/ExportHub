# ExportHUB360 Packmeldungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExportHUB360 erhält einen loginfreien QR-Packplatz-Prozess, der pro Scan eine isolierte Pack-Session erzeugt, Packdaten und Lieferscheine übernimmt, daraus eine interne Aufgabe plus Benachrichtigung erzeugt und anschließend eine reguläre Sendung inklusive AVIS-fähiger Dokumente vorbefüllt.

**Architecture:** Der öffentliche Packbereich wird als eigener anonymer Einstieg `/pack/<token>` mit einem fokussierten Azure-Functions-Backend umgesetzt. Pack-Session und Packmeldung werden serverseitig getrennt vom Browserzustand geführt, Dokumente nutzen den bestehenden Blob-Dokumentpfad, und die interne Bearbeitung wird in die vorhandene Aufgabenruntime `rc1014` sowie die bestehende Sendungs- und AVIS-Logik integriert. D365 bleibt vollständig unberührt.

**Tech Stack:** Azure Static Web Apps, Node.js 20 CommonJS Azure Functions, bestehende ExportHUB-State-/Auth-/Blob-Infrastruktur, Vanilla JavaScript/CSS, `node:test`, Playwright E2E, bestehender Drei-Umgebungs-Build über `.github/rc1112/build-three-env.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-08-packmeldungen-design.md`

## Global Constraints

- Keine D365-API und keine D365-Anpassung.
- Kein Login für Packer.
- Jeder QR-Scan erzeugt eine neue, unabhängige Pack-Session.
- Zwei gleichzeitige Scans desselben Packtisch-QR dürfen sich niemals gegenseitig überschreiben.
- Eine Packmeldung ist noch keine Sendung; erst der interne Benutzer erzeugt die Sendung.
- Mehrere Lieferscheine pro Packmeldung sind erlaubt.
- Zulässige Uploads in V1: PDF, JPG/JPEG, PNG.
- Doppelklick/Retry desselben Submit erzeugt maximal eine Packmeldung und eine Aufgabe.
- Hochgeladene Dokumente werden bei Sendungserstellung referenziert, nicht unnötig physisch dupliziert.
- In-App-Benachrichtigung und Badge für neue Packmeldungen sind verpflichtend.
- Zweiter Klick auf `Sendung erstellen` öffnet die bestehende Sendung statt eine Dublette anzulegen.
- AVIS zeigt nur ausdrücklich freigegebene Dokumente.
- Der öffentliche Packbereich darf keine internen ExportHUB-Daten, Aufgaben oder Sendungen offenlegen.
- Produktion wird erst nach Testservice-E2E und Regression bestehender Aufgaben-, Sendungs-, Druck- und AVIS-Prozesse freigegeben.

## Review Focus

- **Parallelität:** zwei nahezu gleichzeitige Sessions desselben Packtisch-Tokens müssen vollständig getrennte Daten und Dokumente behalten; Test in Task 2 und E2E in Task 8.
- **Replay/Doppelsubmit:** Reload, Doppelklick oder Netzretry nach Submit darf keine zweite Aufgabe erzeugen; Test in Task 3 und E2E in Task 8.
- **Dateisicherheit:** manipulierte Dateiendung, falscher MIME-Typ oder zu große Datei muss serverseitig abgelehnt werden; Test in Task 3.
- **Sendungs-Dublette:** wiederholtes `Sendung erstellen` muss dieselbe Shipment-ID öffnen; Test in Task 6 und E2E in Task 8.
- **AVIS-Leak:** interne, nicht freigegebene Packdokumente dürfen auf der Kundenseite nie erscheinen; Test in Task 7 und E2E in Task 8.

---

## File Structure

**Neu**
- `pack.html` — loginfreie, mobile Packmaske ohne ExportHUB-Navigation.
- `assets/pack-notification.css` — ausschließlich Layout der Packmaske.
- `assets/pack-notification.js` — öffentlicher Pack-Client: Session anlegen, Form validieren, Dateien hochladen, Submit, Bestätigung.
- `api/shared/pack-notification-store.js` — Packtisch-, Session- und Packmeldungsmodell, Token-Hashing, Status, Parallelitäts-/Idempotenzlogik.
- `api/pack-notification/index.js` — öffentlicher API-Einstieg für Session, Upload-Metadaten und Submit.
- `api/pack-notification/function.json` — HTTP-Trigger.
- `assets/pack-notification-internal.js` — interne Aufgaben-Detailansicht, Dokumentaktionen und Sendungsübergabe.
- `assets/pack-notification-internal.css` — interne Packmeldungsdarstellung.
- `test/pack-notification-store.test.mjs` — Token, Sessionisolation, Status, Idempotenz.
- `test/pack-notification-api.test.mjs` — API-Vertrag, Uploadvalidierung, Submit/Retry.
- `test/pack-notification-task.test.mjs` — Aufgaben-/Benachrichtigungsprojektion.
- `test/pack-notification-shipment.test.mjs` — Übergabe in bestehende Sendung ohne Dublette.
- `test/pack-notification-avis.test.mjs` — Dokumentfreigabe für AVIS.
- `e2e/specs/pack-notification.spec.mjs` — End-to-End QR → Aufgabe → Sendung → AVIS.

**Ändern**
- `api/shared/document-blob-store.js` — Packmeldungen als weitere Dokumentwurzel unterstützen, ohne bestehende Shipment-/ABD-Pfade zu ändern.
- `api/exporthub-state/index.js` — neue Collections `packNotifications` und ggf. `packStations`/`packSessions` in erlaubter State-Synchronisierung erhalten; bestehende Konflikt-/ETag-Logik wiederverwenden.
- `assets/rc1014-task-lifecycle.js` — `Packmeldungen` als eigener System-/Aufgabentyp akzeptieren, ohne bestehende Gruppen zu verändern.
- `assets/rc1014-task-runtime.js` — Packmeldungsaufgabe öffnen, Badge/ungelesen behandeln und interne Detailansicht delegieren.
- `assets/rc1014-task-ui.css` — Packmeldungs-Badge/Metadaten im bestehenden Aufgabenlayout ergänzen.
- `assets/i18n/de.json`, `en.json`, `pl.json`, `es.json`, `fr.json`, `it.json` — Texte für Packmeldung, Benachrichtigung, Fehler und Aktionen.
- `index.html` — interne Packmeldungsruntime/CSS laden; bestehende Navigation bleibt erhalten.
- `TESTVERSION.html` — identische interne Integration für Testservice.
- `staticwebapp.config.json` — `/pack/*` auf `pack.html` rewriten und aus Navigation-Fallback ausschließen; sichere Header analog zu `/avis/*`/`/pickup`.
- `.github/rc1112/build-three-env.mjs` — neue Assets/öffentliche Packseite in alle Build-Artefakte übernehmen und Cache-Key/Vertrag prüfen.
- `RELEASE_MANIFEST.txt` — neue Dateien in den Release-Vertrag aufnehmen.
- `e2e/specs/notifications.spec.mjs` — sicherstellen, dass Packmeldungen den bestehenden Zähler korrekt erweitern und keine Ghost-/Doppelaufgabe erzeugen.
- `e2e/specs/shipment-create.spec.mjs` — Pack-Herkunftsreferenz darf normalen Shipment-Save/Reload nicht beschädigen.

---

### Task 1: Packtisch- und Session-Domänenmodell

**Files:**
- Create: `api/shared/pack-notification-store.js`
- Test: `test/pack-notification-store.test.mjs`

**Interfaces:**
- Produces:
  - `hashStationToken(token: string) -> string`
  - `validateStationToken(state, token) -> station`
  - `createSession(state, stationId, now) -> { state, session }`
  - `getSession(state, sessionId) -> session|null`
  - `expireSession(state, sessionId, now) -> { state, session }`
  - `submitSession(state, sessionId, payload, now) -> { state, notification, created }`
  - `referenceFor(notificationId, createdAt) -> string`

- [ ] **Step 1: Write failing store tests** for active/deactivated station tokens, unpredictable session IDs, two sessions from one station, no cross-session mutation, session expiry, and repeat submit returning the same notification with `created:false`.
- [ ] **Step 2: Run** `node --test test/pack-notification-store.test.mjs` and confirm RED because the module does not exist.
- [ ] **Step 3: Implement the minimal store** using `crypto.randomUUID()`/`randomBytes`, SHA-256 token hashes only, statuses `new|editing|submitted|expired` and Packmeldungsstatus `new|in_review|shipment_created|registration_in_progress|registered|ready_for_dispatch|completed|cancelled`.
- [ ] **Step 4: Run the focused tests** and require PASS.
- [ ] **Step 5: Commit** `feat: add pack station session model`.

---

### Task 2: Persistenz, State-Isolation und Parallelität

**Files:**
- Modify: `api/exporthub-state/index.js`
- Modify: `api/shared/document-blob-store.js`
- Test: `test/pack-notification-store.test.mjs`
- Test: `test/p0-state-conditional-write-conflict.test.mjs`

**Interfaces:**
- Consumes Task 1 store functions.
- Produces persistent state collections `packStations`, `packSessions`, `packNotifications`; `document-blob-store` accepts document collections attached to `packNotifications` without touching existing shipment document identities.

- [ ] **Step 1: Extend failing tests** with two concurrent state snapshots that each create a distinct session for the same station and are merged/retried through the existing conditional-write path without losing either session.
- [ ] **Step 2: Run** `node --test test/pack-notification-store.test.mjs test/p0-state-conditional-write-conflict.test.mjs` and confirm the new assertions fail.
- [ ] **Step 3: Add the smallest state/document integration** so pack collections survive read/write and document externalization while preserving the existing ETag/conflict semantics.
- [ ] **Step 4: Run both tests** and require PASS.
- [ ] **Step 5: Commit** `feat: persist isolated pack sessions`.

---

### Task 3: Öffentliche Pack-API inklusive Upload- und Replay-Schutz

**Files:**
- Create: `api/pack-notification/index.js`
- Create: `api/pack-notification/function.json`
- Test: `test/pack-notification-api.test.mjs`

**Interfaces:**
- HTTP actions:
  - `POST /api/pack-notification?action=session` body `{ stationToken }` -> `{ sessionId, stationName, expiresAt }`
  - `POST /api/pack-notification?action=submit` body `{ stationToken, sessionId, idempotencyKey, customer, deliveryNoteReference, packageType, packageCount, totalWeight, packages[], note, documents[] }` -> `{ reference, notificationId, created }`
- `documents[]` reuses the existing blob-document metadata shape after verified storage.

- [ ] **Step 1: Write failing API tests** for valid token/session creation, invalid/deactivated token, missing required fields, zero/negative weight/dimensions, PDF/JPEG/PNG acceptance, extension/MIME mismatch rejection, configurable max-size rejection, expired session, and same idempotency key submitted twice.
- [ ] **Step 2: Run** `node --test test/pack-notification-api.test.mjs` and confirm RED.
- [ ] **Step 3: Implement session and submit actions** with no ExportHUB login requirement, but token validation, per-session ownership, rate limiting hook, MIME/size validation, sanitized filenames, and atomic task/notification creation in the saved state.
- [ ] **Step 4: Ensure notification failure does not delete the saved Packmeldung/task**; store a retryable notification marker instead.
- [ ] **Step 5: Run focused tests** and require PASS.
- [ ] **Step 6: Commit** `feat: add public pack notification api`.

---

### Task 4: Loginfreie QR-Packmaske

**Files:**
- Create: `pack.html`
- Create: `assets/pack-notification.js`
- Create: `assets/pack-notification.css`
- Modify: `staticwebapp.config.json`
- Test: `test/pack-notification-api.test.mjs`
- E2E: `e2e/specs/pack-notification.spec.mjs`

**Interfaces:**
- URL: `/pack/<packstation-token>`.
- Client creates a fresh server session on every page load/scan and never reuses another tab's session.
- Required UI fields: Kunde, Lieferscheinnummer/Referenz, Packstücktyp, Anzahl, Gesamtgewicht, Länge/Breite/Höhe pro Packstück, mindestens ein Lieferschein; optional Bemerkung and weitere Lieferscheine.

- [ ] **Step 1: Add a failing public-route/UI contract test** asserting `/pack/*` rewrite, no ExportHUB login/navigation markup, responsive form controls, multiple documents, add/remove package rows, disabled submit until valid, and confirmation after successful submit.
- [ ] **Step 2: Run the focused contract/E2E smoke** and confirm RED.
- [ ] **Step 3: Implement the mobile-first page/client/CSS**; each tab owns only its server-returned `sessionId` and random `idempotencyKey`.
- [ ] **Step 4: Add submit lock** so button, Enter, reload retry, and delayed response cannot trigger a second logical submit.
- [ ] **Step 5: Run tests** including mobile viewport and horizontal-overflow guard.
- [ ] **Step 6: Commit** `feat: add qr pack station page`.

---

### Task 5: Packmeldung als ExportHUB-Aufgabe und Benachrichtigung

**Files:**
- Modify: `assets/rc1014-task-lifecycle.js`
- Modify: `assets/rc1014-task-runtime.js`
- Modify: `assets/rc1014-task-ui.css`
- Create: `assets/pack-notification-internal.js`
- Create: `assets/pack-notification-internal.css`
- Modify: `assets/i18n/de.json`, `en.json`, `pl.json`, `es.json`, `fr.json`, `it.json`
- Test: `test/pack-notification-task.test.mjs`
- Modify: `e2e/specs/notifications.spec.mjs`

**Interfaces:**
- Task shape uses `sourceType:'pack_notification'`, `sourceId:<packNotificationId>`, `sourceRef:<PK-reference>`, title `Neue Packmeldung · <customer>`, group `Packmeldungen`, status `open|in_progress|done|cancelled` while detailed Packmeldung status remains on the source record.
- Notification click opens the pack detail directly.

- [ ] **Step 1: Write failing task tests** asserting one submitted Packmeldung projects to exactly one task, unread count increments once, title is never generic, task survives normal roster cleanup, and opening/marking read clears only its unread marker.
- [ ] **Step 2: Run** `node --test test/pack-notification-task.test.mjs` and confirm RED.
- [ ] **Step 3: Extend lifecycle/runtime minimally** to support `Packmeldungen` without changing existing managed weekly tasks or current system groups' behavior.
- [ ] **Step 4: Implement internal detail renderer** showing Kunde, Packtisch, Zeitpunkt, Packstücke, Gewicht, Maße, Bemerkung and all Lieferscheine with open/download actions.
- [ ] **Step 5: Extend notification E2E** so existing count equals rendered cards including Packmeldungen and no duplicate/ghost cards appear.
- [ ] **Step 6: Run focused Node + Playwright tests** and require PASS.
- [ ] **Step 7: Commit** `feat: surface pack notifications as tasks`.

---

### Task 6: Aus Packmeldung eine bestehende Sendung vorbefüllen

**Files:**
- Modify: `assets/pack-notification-internal.js`
- Modify: existing shipment runtime in `index.html` only at the narrow bridge required to accept a prefill payload; prefer a dedicated helper asset if an existing public hook is available.
- Test: `test/pack-notification-shipment.test.mjs`
- Modify: `e2e/specs/shipment-create.spec.mjs`

**Interfaces:**
- `buildShipmentPrefill(packNotification) -> { customerQuery, deliveryNoteReference, rows, totalWeight, note, deliveryFiles, sourcePackNotificationId }`.
- `createOrOpenShipmentFromPack(notificationId)` creates only if `shipmentId` is empty; otherwise opens the linked shipment.

- [ ] **Step 1: Write failing tests** for customer/ref/pack rows/weight/note/document mapping and repeat click returning the same Shipment-ID.
- [ ] **Step 2: Run** `node --test test/pack-notification-shipment.test.mjs` and confirm RED.
- [ ] **Step 3: Implement the prefill bridge** using the existing shipment form/state and existing save flow; do not bypass validation, automatic reference generation, QR registration or normal status behavior.
- [ ] **Step 4: After successful real shipment save**, persist bidirectional linkage: Packmeldung `shipmentId` + status `shipment_created`; shipment `sourcePackNotificationId`.
- [ ] **Step 5: Extend shipment E2E** to verify save → reload → reopen still works when `sourcePackNotificationId` exists.
- [ ] **Step 6: Run focused and shipment regressions** and require PASS.
- [ ] **Step 7: Commit** `feat: create shipment from pack notification`.

---

### Task 7: Lieferscheine intern downloaden und gezielt auf AVIS freigeben

**Files:**
- Modify: `api/customer-avis/index.js`
- Modify: `customer-avis.html` only where the existing AVIS document list is sourced/rendered.
- Modify: `assets/pack-notification-internal.js`
- Test: `test/pack-notification-avis.test.mjs`

**Interfaces:**
- Pack-origin documents retain the existing blob metadata plus `customerVisible:boolean` (default `false`) and origin metadata `source:'pack_notification'`.
- Internal download path continues through the existing protected document endpoint.
- AVIS response includes a pack-origin document only when it belongs to the linked shipment **and** `customerVisible===true`.

- [ ] **Step 1: Write failing AVIS tests** with two Pack-Lieferscheine where one is customer-visible and one internal-only.
- [ ] **Step 2: Run** `node --test test/pack-notification-avis.test.mjs` and confirm RED.
- [ ] **Step 3: Add internal toggle/action** to mark selected shipment document(s) customer-visible.
- [ ] **Step 4: Extend customer AVIS projection** to include only explicitly visible linked documents; preserve all existing AVIS upload/download/security checks.
- [ ] **Step 5: Run AVIS tests plus existing AVIS regressions** and require PASS.
- [ ] **Step 6: Commit** `feat: expose approved pack documents on avis`.

---

### Task 8: Vollständige E2E-, Build- und Release-Gates

**Files:**
- Create/complete: `e2e/specs/pack-notification.spec.mjs`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: `RELEASE_MANIFEST.txt`
- Modify: `index.html`, `TESTVERSION.html` asset bindings only through the established build mechanism
- Regression: `e2e/specs/notifications.spec.mjs`, `shipment-create.spec.mjs`, `public-smoke.spec.mjs`, AVIS/public-link tests, print tests.

**Interfaces:**
- End-to-end path: QR token → Session A + Session B concurrently → separate forms/documents → submit → exactly two tasks → notification opens correct task → create shipment from one task → second click opens same shipment → mark one document AVIS-visible → customer AVIS shows exactly that document.

- [ ] **Step 1: Complete failing Playwright E2E** for the full path, including two browser contexts/tabs using the same station token simultaneously.
- [ ] **Step 2: Run targeted E2E on Testservice** and confirm any remaining RED before release integration.
- [ ] **Step 3: Update the three-environment build** so Pack assets/page are present consistently without changing the browser tab title or unrelated runtime versions.
- [ ] **Step 4: Run Node tests:** `node --test test/pack-notification-*.test.mjs test/p0-state-conditional-write-conflict.test.mjs`.
- [ ] **Step 5: Run build:** `node .github/rc1112/build-three-env.mjs` followed by `git diff --check`.
- [ ] **Step 6: Run targeted Playwright regressions:** Packmeldung, notifications, shipment-create, public-smoke, AVIS/public links, print-documents.
- [ ] **Step 7: Verify Testservice manually with one realistic BSH-style case** containing at least two Lieferscheine and two Packstücke; no production QR is issued yet.
- [ ] **Step 8: Commit** `test: gate pack notification workflow`.

---

## Self-Review

- **Spec coverage:** QR/session model, no login, parallel scans, fields, multiple documents, idempotency, status, task, notification, shipment bridge, AVIS visibility, security, failure behavior and rollout each map to Tasks 1–8.
- **Type consistency:** `packNotificationId`, `sessionId`, `shipmentId`, `sourcePackNotificationId`, `customerVisible` and `sourceType:'pack_notification'` are used consistently across tasks.
- **Existing architecture:** task integration explicitly reuses `assets/rc1014-task-lifecycle.js`/`runtime.js`; documents reuse `document-blob-store.js`; state uses `exporthub-state`; AVIS uses `api/customer-avis`; build remains `.github/rc1112/build-three-env.mjs`.
- **Regression risk:** plan does not replace the current shipment or task engines and requires existing E2E gates before release.
- **Production safety:** no production deployment is part of implementation tasks before Testservice verification succeeds.
