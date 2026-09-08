# RC1003 Android Notification Direct Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android-Benachrichtigungen, insbesondere Fehlerdiagnosen, öffnen direkt eine sichere native Detailansicht ohne erneute Website-Anmeldung; der normale ExportHUB-Arbeitsbereich bleibt weiterhin rollen- und mandantengeschützt.

**Architecture:** Ein eigener Notification-Entry-Pfad trennt den eingeschränkten Direktzugriff vom normalen WebView-Login. Der Server stellt kurzlebige, einmalig nutzbare und umgebungsgebundene Tokens bereit; Android öffnet diese in einer separaten nativen Activity und zeigt nur die minimierten, für genau diesen Eintrag freigegebenen Daten.

**Tech Stack:** Android Java, Azure Functions / Node.js CommonJS, bestehende Node-Contract-Tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-08-android-notification-direct-open-design.md`

## Global Constraints

- `main` und Produktion während Entwicklung und Test nicht direkt verändern.
- Produktion, TESTSERVICE und Demo bleiben strikt getrennt.
- Notification-Entry-Tokens sind kurzlebig, einmalig und nur für genau ein Zielobjekt gültig.
- Kein Notification-Entry darf eine allgemeine Website-Session erzeugen oder freie Navigation erlauben.
- Abgelaufene, manipulierte, bereits verwendete oder umgebungsfremde Tokens werden abgelehnt.
- Normale Navigation in ExportHUB bleibt anmeldungs- und rollenpflichtig.

---

### Task 1: Sicherheitsvertrag für Notification-Entry

**Files:**
- Create: `test/rc1003-notification-entry.test.mjs`
- Create: `api/shared/notification-entry-store.js`
- Create: `api/notification-entry/index.js`
- Create: `api/notification-entry/function.json`

**Interfaces:**
- Produces: `issueNotificationEntry(input, now?) -> { token, expiresAt }`
- Produces: `consumeNotificationEntry(token, expectedEnvironment, now?) -> { ok, status, entry? }`
- Produces HTTP: `POST /api/notification-entry` with `{ token, environment }` returning only minimized notification detail data.

- [ ] **Step 1: Write the failing token-contract test**

Create a Node test that imports `issueNotificationEntry` and `consumeNotificationEntry` and asserts: valid token succeeds once; second use returns `used`; expired token returns `expired`; changed token returns `invalid`; `testservice` token consumed as `production` returns `environment_mismatch`; returned `entry` contains only `type`, `severity`, `title`, `body`, `reference`, `area`, `createdAt`, `allowedActions`, `environment`, `targetId` and no company-wide state/session object.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/rc1003-notification-entry.test.mjs`
Expected: FAIL because `api/shared/notification-entry-store.js` does not exist.

- [ ] **Step 3: Implement minimal secure token store**

Use `crypto.randomBytes(32)` for token material, SHA-256 for storage lookup, constant-time-safe validation where applicable, an in-memory map fallback for test/runtime process scope, explicit `expiresAt`, `usedAt`, `environment`, `targetId`, and a fixed allow-list serializer for public detail fields. Do not store or log the raw token after issuing it.

- [ ] **Step 4: Implement the Azure Function wrapper**

`api/notification-entry/index.js` accepts only POST, validates `token` and `environment`, calls `consumeNotificationEntry`, maps invalid/expired/used/environment mismatch to 401/410/409/403 without leaking target/company data, and returns the minimized detail payload on success.

- [ ] **Step 5: Run the test and verify GREEN**

Run: `node --test test/rc1003-notification-entry.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `RC1003: sicheren Notification-Entry hinzufügen`.

---

### Task 2: Android öffnet Notification-Entry nativ statt Web-Login

**Files:**
- Create: `test/rc1003-android-direct-open.test.mjs`
- Create: `android-app/app/src/main/java/de/exporthub/test/NotificationDetailActivity.java`
- Modify: `android-app/app/src/main/java/de/exporthub/test/NotificationHelper.java`
- Modify: `android-app/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Notification intent extras: `exporthub_environment`, `exporthub_notification_token`, `exporthub_notification_type`.
- `NotificationDetailActivity` consumes those extras, calls `/api/notification-entry`, renders native title/status/body/reference/area/time and exposes only server-declared actions.

- [ ] **Step 1: Write failing Android contract test**

The test reads the Java/manifest sources and asserts that `NotificationHelper` targets `NotificationDetailActivity` when a notification token exists; the manifest declares the Activity; the detail Activity contains no WebView and references `/api/notification-entry`; `EnvironmentActivity` remains the normal app workspace.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/rc1003-android-direct-open.test.mjs`
Expected: FAIL because `NotificationDetailActivity.java` is missing and `NotificationHelper` still targets `EnvironmentActivity`.

- [ ] **Step 3: Add token-aware notification intent**

Extend `NotificationHelper.show(...)` with a compatible overload accepting `notificationToken`. For a non-empty token, build the `PendingIntent` for `NotificationDetailActivity`; for legacy notifications without a token, preserve the existing `EnvironmentActivity` route behavior.

- [ ] **Step 4: Implement native detail Activity**

Create a lightweight Java Activity using native `LinearLayout`, `TextView`, `ProgressBar`, and `Button` components. Fetch the token detail with `HttpURLConnection` on a background thread, render only parsed allow-listed fields, show a native expiry/error message, and only launch `EnvironmentActivity` when the server includes the explicit `open_exporthub` action.

- [ ] **Step 5: Register Activity in manifest**

Declare it non-exported for internal notification intents unless an explicit verified HTTPS deep-link is added later. Keep existing launcher/environment configuration unchanged.

- [ ] **Step 6: Run contract test and Android build**

Run: `node --test test/rc1003-android-direct-open.test.mjs`
Then: `cd android-app && ./gradlew-local.sh :app:assembleDebug`
Expected: both PASS.

- [ ] **Step 7: Commit**

Commit message: `RC1003: Benachrichtigungen nativ direkt öffnen`.

---

### Task 3: Erzeugung von sicheren Einmal-Tokens für bestehende Diagnose-Benachrichtigungen

**Files:**
- Create: `test/rc1003-diagnostic-token-wiring.test.mjs`
- Modify: the existing diagnostic notification producer located by the current RC997 diagnostic contract, keeping its existing audience restriction for globale Administratoren.
- Modify: only the minimum shared notification payload builder needed to add `notificationToken` and `environment`.

**Interfaces:**
- Consumes: `issueNotificationEntry({ environment, type, severity, title, body, reference, area, createdAt, allowedActions, targetId })`.
- Produces push/local payload field `notificationToken` without embedding unrestricted route/session data.

- [ ] **Step 1: Write failing wiring test**

Assert that diagnostic notification creation invokes the notification-entry issuer, sets `type: 'diagnostic'`, binds the current environment, uses the diagnostic target identifier, and does not send a raw session token or unrestricted company state in the notification payload.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/rc1003-diagnostic-token-wiring.test.mjs`
Expected: FAIL because diagnostic payloads currently only carry normal route data.

- [ ] **Step 3: Wire token issuance into diagnostics**

Issue the token immediately before dispatching a diagnostic notification, with a short expiry window and `allowedActions` limited to `diagnostic_view` plus optionally `open_exporthub`. Preserve the existing global-admin-only recipient logic.

- [ ] **Step 4: Run diagnostic and historical notification contracts**

Run: `node --test test/rc1003-diagnostic-token-wiring.test.mjs .github/rc997/diagnostic-notifications-contract.test.mjs .github/rc997/android-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `RC1003: Diagnose-Push mit Einmalzugriff verbinden`.

---

### Task 4: Sicherheits- und Release-Gesamtprüfung

**Files:**
- Create: `.github/rc1003/rc1003-notification-security-contract.test.mjs`
- Create: `.github/workflows/rc1003-android-notification-direct-open.yml`

**Interfaces:**
- Workflow runs RC1003 tests, existing RC997 diagnostic/android contracts, baseline Node tests, and Android debug build on `rc1003-android-notification-direct-open`.

- [ ] **Step 1: Write failing release/security contract**

Assert that the workflow runs the exact RC1003 test files, the Android build, and existing RC997 notification regressions; assert that production deployment workflow files and `production-version.js` are not modified by RC1003 implementation.

- [ ] **Step 2: Run locally and verify RED**

Run: `node --test .github/rc1003/rc1003-notification-security-contract.test.mjs`
Expected: FAIL until the RC1003 workflow exists.

- [ ] **Step 3: Add isolated RC1003 workflow**

Trigger only on the RC1003 branch and manual dispatch. Do not deploy production. Run Node contract tests and Android assembleDebug; upload APK artifact only after green tests.

- [ ] **Step 4: Run all RC1003 and regression tests**

Run: `node --test test/rc1003-notification-entry.test.mjs test/rc1003-android-direct-open.test.mjs test/rc1003-diagnostic-token-wiring.test.mjs .github/rc1003/rc1003-notification-security-contract.test.mjs .github/rc997/diagnostic-notifications-contract.test.mjs .github/rc997/android-contract.test.mjs`
Then run existing root Node test suite and Android debug build.
Expected: all GREEN.

- [ ] **Step 5: Push workflow run and inspect exact failed step if any**

Do not blindly rerun a failed workflow. Read the existing run/job logs, fix the concrete cause, add/adjust a regression test, then run again.

- [ ] **Step 6: Commit**

Commit message: `RC1003: Direktzugriff vollständig absichern und prüfen`.
