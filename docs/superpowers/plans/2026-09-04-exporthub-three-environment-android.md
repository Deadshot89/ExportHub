# ExportHUB Drei-Umgebungen und Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produktion, TESTSERVICE und Demo konsistent bereitstellen und die Android-App als gemeinsamen Wrapper mit Umgebungswahl und nativen Benachrichtigungen abschließen.

**Architecture:** Ein reproduzierbarer RC996-Build erzeugt aus dem bestehenden ExportHUB-Stand die TESTSERVICE- und Demo-Ausgaben und bereitet denselben Einbau für die Produktionsfreigabe vor. Gemeinsame kleine Assets übernehmen Umgebungsanzeige, App-Zugang und Demo-Isolation; die Android-App öffnet explizit Produktion, TESTSERVICE oder Demo und bleibt ein einzelnes Paket.

**Tech Stack:** Statisches HTML/JavaScript, Node.js 20 Build-/Contract-Tests, Azure Static Web Apps, Android Java 17 / SDK 36.

**Spec:** `docs/superpowers/specs/2026-09-04-exporthub-three-environment-android-design.md`

## Global Constraints

- Produktion bleibt bis zur Release-Center-Freigabe unverändert live.
- TESTSERVICE und Demo dürfen keine Produktionsdaten schreiben.
- Demo darf weder Produktions- noch TESTSERVICE-Teamstände lesen oder schreiben.
- Android bleibt eine App; keine getrennten APKs.
- D365 bleibt vollständig außen vor.
- HTTPS bleibt Pflicht; Cleartext bleibt deaktiviert.
- RC995 Sicherheitslogik für Pickup/Kunden-Avis darf nicht geschwächt werden.

---

### Task 1: RC996 Contract und reproduzierbarer Web-Build

**Files:**
- Create: `.github/rc996/rc996-three-env.test.mjs`
- Create: `.github/rc996/build-three-env.mjs`
- Create: `assets/exporthub-environment-hub.js`
- Create: `assets/exporthub-demo-bootstrap.js`

**Interfaces:**
- Consumes: `TESTVERSION.html`, bestehende Produktions-/TESTSERVICE-Hosts.
- Produces: `dist-rc996/index.html`, `dist-rc996/TESTVERSION.html`, `dist-rc996/demo.html` sowie gemeinsame Assets.

- [ ] **Step 1: Write the failing contract test**
  - Fordert exakt drei Umgebungen: production, testservice, demo.
  - Fordert App-Zugang auf allen drei erzeugten Seiten.
  - Fordert Demo-Bootstrap vor der ExportHUB-Anwendungslogik.
  - Fordert Demo-Netzwerksperre für `/api/` mit ausschließlich lokalen Fake-Antworten.
  - Fordert sichtbare Umgebungskennzeichnung und mobile `touch-action: manipulation`.
- [ ] **Step 2: Run contract on CI and verify RED.**
- [ ] **Step 3: Implement minimal build and assets.**
  - Build kopiert den bestehenden Teststand statt Fachlogik zu duplizieren.
  - `index.html` im Build ist nur Release-Kandidat; die live Produktionsdatei wird nicht überschrieben.
  - Demo erhält Fake-Kunden, Fake-Sendungen, Fake-Aufgaben, Fake-Benachrichtigungen und Fake-Warnungen sowie eigene localStorage-Präfixe.
- [ ] **Step 4: Run contract and existing Node tests; verify GREEN.**
- [ ] **Step 5: Commit.**

### Task 2: TESTSERVICE-Deployment um RC996-Build und Demo erweitern

**Files:**
- Modify: `.github/workflows/exporthub-testservice.yml`
- Create: `.github/workflows/rc996-three-env.yml`

**Interfaces:**
- Consumes: `.github/rc996/build-three-env.mjs`.
- Produces: TESTSERVICE root = RC996-Testseite; `/TESTVERSION.html` = RC996-Testseite; `/demo.html` = isolierte Demo.

- [ ] **Step 1: Extend RED contract for workflow paths and build invocation.**
- [ ] **Step 2: Verify RED on branch CI.**
- [ ] **Step 3: Add RC996 build step before payload deployment.**
  - Demo/assets müssen in Payload enthalten sein.
  - Produktionssnapshot bleibt unverändert vom Release-Gate kontrolliert.
- [ ] **Step 4: Run CI, existing RC995 flow and TESTSERVICE preflight.**
- [ ] **Step 5: Commit.**

### Task 3: Android-App auf RC996 und drei Umgebungen umstellen

**Files:**
- Modify: `android-app/app/src/main/java/de/exporthub/test/MainActivity.java`
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/build.gradle.kts`
- Modify: `android-app/APP_BUILD_INFO.txt`
- Modify: `.github/workflows/exporthub-android-test-app.yml`
- Create: `.github/rc996/android-contract.test.mjs`

**Interfaces:**
- Consumes: Produktion `https://wonderful-forest-0f315e310.7.azurestaticapps.net/`, TESTSERVICE `https://wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net/TESTVERSION.html`, Demo `https://wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net/demo.html`.
- Produces: ein Android-Paket mit Startauswahl und erneuter Umgebungswahl.

- [ ] **Step 1: Write failing Android source contract.**
  - Exakt drei Ziele.
  - Produktion nicht mehr pauschal blockiert.
  - Fremdhosts weiter extern.
  - vorhandener Ein-Tap-Menüfix bleibt vorhanden.
  - `POST_NOTIFICATIONS` im Manifest für Android 13+.
  - App-Version wird RC996.
- [ ] **Step 2: Verify RED in CI.**
- [ ] **Step 3: Implement environment chooser and notification channel/permission.**
  - Startdialog Produktion / TESTSERVICE / Demo.
  - aktuelle Umgebung persistent merken; Wechselmöglichkeit über Android-injizierten App-Schalter.
  - native Meldungen über AndroidBridge mit Deduplizierung je Umgebung.
- [ ] **Step 4: Build APK and run source contract; verify GREEN.**
- [ ] **Step 5: Commit.**

### Task 4: Benachrichtigungscenter/Warncenter an Android-Brücke koppeln

**Files:**
- Modify: `assets/exporthub-environment-hub.js`
- Modify: `.github/rc996/rc996-three-env.test.mjs`

**Interfaces:**
- Consumes: bestehende ExportHUB-Benachrichtigungs-/Warncenter-Zähler und DOM-Ereignisse.
- Produces: deduplizierte Android-Systemmeldungen, nur wenn `window.ExportHUBAndroid` vorhanden ist.

- [ ] **Step 1: Write RED assertions for strict center separation and Android bridge calls.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement observer/event adapter without changing existing business logic.**
  - persönliche Aufgaben = notification channel.
  - operative Sendungsprobleme = warning channel.
  - Web ohne Android bleibt unverändert.
- [ ] **Step 4: Verify GREEN plus existing notification contracts.**
- [ ] **Step 5: Commit.**

### Task 5: Produktionsfreigabe vorbereiten, aber nicht veröffentlichen

**Files:**
- Create: `.github/rc996/apply-production.mjs`
- Modify: `.github/rc996/rc996-three-env.test.mjs`

**Interfaces:**
- Consumes: freigegebenes `index.html` im Release-Center-Prozess und `assets/exporthub-environment-hub.js`.
- Produces: deterministischen RC996-Produktionskandidaten mit App-/Umgebungszugang und Demo-Link.

- [ ] **Step 1: Add RED contract proving current production marker/file is not mutated by ordinary TESTSERVICE build.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement idempotent production apply script.**
- [ ] **Step 4: Verify candidate generation and unchanged live production marker.**
- [ ] **Step 5: Commit.**

### Task 6: Gesamtverifikation

**Files:**
- Test only.

- [ ] **Step 1:** Run `npm test` under Node 20.
- [ ] **Step 2:** Run RC995 contract/flow tests.
- [ ] **Step 3:** Run both RC996 contracts.
- [ ] **Step 4:** Run Android debug build.
- [ ] **Step 5:** Verify TESTSERVICE deployment and live URLs for `/`, `/TESTVERSION.html`, `/demo.html`.
- [ ] **Step 6:** Confirm `production-version.js` remains RC990 until explicit Release-Center approval.
