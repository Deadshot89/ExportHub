# ExportHUB Three Environment + Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produktion, TESTSERVICE, Demo und eine gemeinsame Android-App mit sauberer Umgebungswahl, mobiler Bedienung und nativen Benachrichtigungen fertigstellen.

**Architecture:** Ein gemeinsamer Web-Umgebungsbaustein kapselt Erkennung, Kennzeichnung und Wechsel zwischen Produktion, TESTSERVICE und Demo. Die Demo bleibt eine strikt isolierte Sandbox mit Fake-Daten. Die Android-App bekommt eine vorgeschaltete Umgebungswahl, behält den bestehenden WebView/Menu-Fix und ergänzt Android-Systembenachrichtigungen ohne Cloud-Push-Abhängigkeit.

**Tech Stack:** Statisches HTML/JavaScript, Node 20 Test Runner, Android Java/WebView, Android SDK 36, Java 17, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-04-exporthub-three-environment-android-design.md`

## Global Constraints

- Produktion wird nicht direkt veröffentlicht; Produktivänderungen bleiben Release-Center-gesteuert.
- TESTSERVICE und Demo dürfen unabhängig aktualisiert werden.
- Demo darf niemals echte Produktiv-/TESTSERVICE-Teamstände lesen oder schreiben.
- Keine D365-Integration.
- Eine gemeinsame Android-App, keine drei APKs.
- Android minSdk 29, targetSdk 36, Java 17.
- HTTPS bleibt Pflicht; Cleartext bleibt deaktiviert.

---

### Task 1: Three-environment contract

**Files:**
- Create: `test/rc996-environments.test.mjs`
- Create: `assets/exporthub-environments.js`
- Modify candidate: `index.html`
- Modify candidate: `TESTVERSION.html`

**Interfaces:**
- Produces `window.ExportHUBEnvironment` with `current()`, `targets()` and `open(name)`.

- [ ] Write failing Node contract tests for production/test/demo markers and three targets.
- [ ] Run tests and confirm RED.
- [ ] Implement the shared environment module and candidate-page inclusion.
- [ ] Run tests and confirm GREEN.

### Task 2: Isolated Demo

**Files:**
- Create: `demo.html`
- Create: `assets/exporthub-demo.js`
- Extend: `test/rc996-environments.test.mjs`

**Interfaces:**
- Demo storage prefix: `exporthub-demo:` only.
- Demo network side effects are blocked/simulated.

- [ ] Add RED tests requiring fake customer/shipment/task/notification/warning content and blocked production/test persistence.
- [ ] Implement demo page and sandbox data layer.
- [ ] Verify GREEN.

### Task 3: Android environment selection and menu stability

**Files:**
- Modify: `android-app/app/src/main/java/de/exporthub/test/MainActivity.java`
- Modify: `android-app/app/build.gradle.kts`
- Modify: `android-app/APP_BUILD_INFO.txt`
- Extend: `test/rc996-environments.test.mjs`

**Interfaces:**
- Android environments: `production`, `testservice`, `demo`.
- Menu fix remains bound to `ehMenuBtn` using pointer/touch handling and MutationObserver rebinding.

- [ ] Add RED static contract tests for three Android targets and version RC996.
- [ ] Implement startup environment chooser and safe host/path allowlist.
- [ ] Preserve one-tap menu hook, upload/download/print/back/offline behavior.
- [ ] Verify GREEN.

### Task 4: Android native notifications

**Files:**
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/src/main/java/de/exporthub/test/MainActivity.java`
- Extend: `test/rc996-environments.test.mjs`

**Interfaces:**
- Android 13+ permission: `android.permission.POST_NOTIFICATIONS`.
- Notification channels: personal tasks and shipment warnings.
- Dedupe key includes environment + category + item key.

- [ ] Add RED tests for permission, channel separation and dedupe contract.
- [ ] Implement permission request, channels, JavaScript bridge and notification dedupe.
- [ ] Verify GREEN.

### Task 5: CI/build verification

**Files:**
- Create or modify: `.github/workflows/rc996-three-environments.yml`

**Interfaces:**
- Runs Node contract tests plus Android debug build on branch changes.

- [ ] Add workflow for RC996 branch/path changes.
- [ ] Run full Node tests.
- [ ] Run Android debug build.
- [ ] Verify candidate contains no direct production release marker change.
- [ ] Review diff and only then prepare merge/release handoff.
