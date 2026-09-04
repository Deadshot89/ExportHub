# RC997 ExportHUB Website Finalisierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bestehende ExportHUB-Website auf Basis des vollständig grünen RC996-Standes in einem großen RC997-Abschlussblock fachlich und technisch abnahmebereit machen.

**Architecture:** RC997 verändert keine Grundarchitektur. Aktive bestehende Blöcke in `TESTVERSION.html`, den externen Seiten, Azure Functions und der Android-Hülle werden über neue Abschlussverträge geprüft und nur dort minimal korrigiert, wo ein RED-Test einen realen Defekt nachweist. Der TESTSERVICE-Build wird als eigene RC997-Ausgabe erzeugt; Produktion bleibt bis zur separaten Release-Center-Freigabe auf RC990.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js 20 / `node:test`, Azure Functions Node 20, Azure Static Web Apps CLI 2.0.10, Android Java 17 / SDK 36 / Gradle 9.5.

**Spec:** `docs/superpowers/specs/2026-09-04-rc997-website-final-design.md`

## Global Constraints

- Entwicklung ausschließlich auf `rc997-website-final` bis zum geprüften Integrationsschritt.
- `main` bleibt bis zum vollständig grünen Branch-Gate unverändert.
- Produktion bleibt auf RC990; `production-version.js` bleibt `window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC990';`.
- Kein Direktdeploy nach Produktion; Produktionsfreigabe nur über Release Center.
- Keine D365-Schnittstelle oder direkte D365-Verknüpfung.
- Keine neuen Reparaturblöcke über bestehenden aktiven Blöcken; korrigiert wird die aktive Implementierung.
- RC995-Sicherheitslogik für QR-Abholung, PIN, POD und Kunden-Avis darf nicht abgeschwächt werden.
- RC996-Verträge für Aufgabenstatus, State-Merge, Drei-Umgebungen und Android bleiben grün.
- TESTSERVICE und Demo bleiben von Produktion getrennt.

---

### Task 1: RC997 RED-Abschlussverträge und Baseline-Audit

**Files:**
- Create: `.github/rc997/rc997-ui-contract.test.mjs`
- Create: `.github/rc997/rc997-shipment-contract.test.mjs`
- Create: `.github/rc997/rc997-external-contract.test.mjs`
- Read: `TESTVERSION.html`
- Read: `pickup.html`
- Read: `customer-avis.html`
- Read: `staticwebapp.testservice.config.json`

**Interfaces:**
- Consumes: RC996-Quellstand und die vorhandenen RC990/RC995/RC996-Marker.
- Produces: drei präzise RED/GREEN-Verträge für UI, Sendungsfluss und externe Flows.

- [ ] **Step 1: UI-Vertrag anlegen.** Der Test liest `TESTVERSION.html`, extrahiert Funktionen wie die bestehenden Tests und verlangt mindestens diese Eigenschaften:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
const build=Number((html.match(/version:'RC(\d+)'/)||[])[1]||0);
const count=(rx)=>(html.match(rx)||[]).length;

test('RC997 UI: Kandidat ist RC997 und kanonische RC990 Infrastruktur bleibt eindeutig',()=>{
  assert.ok(build>=997,`Build ist RC${build||0}`);
  assert.equal(count(/function\s+rc990ScheduleRender\s*\(/g),1);
  assert.equal(count(/function\s+rc990RememberView\s*\(/g),1);
  assert.equal(count(/function\s+rc990BackView\s*\(/g),1);
  assert.equal(count(/function\s+rc990FailOperation\s*\(/g),1);
});

test('RC997 UI: Warncenter und Benachrichtigungscenter bleiben getrennte Oberflächen',()=>{
  assert.match(html,/Warncenter/i);
  assert.match(html,/Benachrichtigungscenter/i);
  assert.match(html,/rc885WarningDrawer/);
  assert.match(html,/index236NotificationCenter/);
});
```

- [ ] **Step 2: Sendungsvertrag anlegen.** Er verlangt genau eine aktive Instanz der festen Sendungsbereiche und schützt Colli-/Langtext-/Drucklogik:

```js
for(const id of ['rc363BlockCustomer','rc363BlockShipment','rc363BlockColli','rc363BlockDocuments','rc363BlockStow','rc363BlockMail']){
  assert.equal((html.match(new RegExp(`id=["']${id}["']`,'g'))||[]).length,1,`${id} ist nicht eindeutig`);
}
assert.match(html,/function\s+canonicalColliCard\s*\(/);
assert.match(html,/function\s+canonicalMail\s*\(/);
assert.match(html,/function\s+printStow\s*\(/);
assert.match(html,/RC995_CUSTOMER_CONFIRMATION_AVIS_ONLY/);
assert.doesNotMatch(html,/data-rc995-customer-confirm-main/);
```

- [ ] **Step 3: External-Vertrag anlegen.** Er verlangt separate externe Seiten und korrekte TESTSERVICE-Routen:

```js
const cfg=fs.readFileSync('staticwebapp.testservice.config.json','utf8');
const pickup=fs.readFileSync('pickup.html','utf8');
const avis=fs.readFileSync('customer-avis.html','utf8');
assert.match(pickup,/Abholung bestätigen/);
assert.match(avis,/Kunden-Avis/);
assert.match(cfg,/"route"\s*:\s*"\/pickup"[\s\S]{0,300}"rewrite"\s*:\s*"\/pickup\.html"/);
assert.match(cfg,/"route"\s*:\s*"\/customer-avis"[\s\S]{0,300}"rewrite"\s*:\s*"\/customer-avis\.html"/);
assert.doesNotMatch(cfg,/"route"\s*:\s*"\/pickup\.html"[\s\S]{0,300}"rewrite"\s*:\s*"\/TESTVERSION\.html"/);
```

- [ ] **Step 4: RED ausführen.** Run:

```bash
node --test .github/rc997/rc997-ui-contract.test.mjs .github/rc997/rc997-shipment-contract.test.mjs .github/rc997/rc997-external-contract.test.mjs
```

Expected: mindestens der RC997-Buildmarker und die aktuell falsche TESTSERVICE-Pickup-Route schlagen fehl; Testsyntax selbst ist grün.

- [ ] **Step 5: Baseline-Sicherheitsläufe ausführen und Ergebnis protokollieren.** Run:

```bash
npm test
node --test .github/rc995/rc995-contract.test.mjs
node --test .github/rc995/rc995-flow.test.cjs
node --test .github/rc996/tasks-contract.test.mjs
node --test .github/rc996/state-merge-contract.test.mjs
node --test .github/rc996/rc996-three-env.test.mjs
node --test .github/rc996/android-contract.test.mjs
```

Expected: die bestehende RC996-Baseline bleibt grün; ausschließlich die neuen RC997-Verträge dürfen rot sein.

- [ ] **Step 6: Commit.**

```bash
git add .github/rc997
git commit -m "RC997 RED: Website-Abschlussverträge hinzufügen"
```

---

### Task 2: RC997-Versionierung und reproduzierbarer Drei-Umgebungen-Build

**Files:**
- Modify: `TESTVERSION.html` — nur kanonische BUILD-/Cache-Marker auf RC997 setzen.
- Create: `.github/rc997/build-three-env.mjs`
- Create: `.github/rc997/rc997-build-contract.test.mjs`
- Reuse unchanged: `assets/exporthub-environment-hub.js`
- Reuse unchanged initially: `assets/exporthub-demo-bootstrap.js`

**Interfaces:**
- Consumes: `TESTVERSION.html`, `index.html`, gemeinsame Umgebungs-/Demo-Assets.
- Produces: `dist-rc997/index.html`, `dist-rc997/TESTVERSION.html`, `dist-rc997/demo.html`, `dist-rc997/rc997-manifest.json`.

- [ ] **Step 1: RED-Buildvertrag schreiben.** Er verlangt `VERSION='RC997'`, `CACHE='997'`, `dist-rc997`, drei Umgebungsmarker sowie unveränderten Produktionsmarker RC990.

```js
const build=read('.github/rc997/build-three-env.mjs');
assert.match(build,/const VERSION='RC997'/);
assert.match(build,/const CACHE='997'/);
assert.match(build,/dist-rc997/);
assert.match(read('production-version.js'),/RC990/);
assert.doesNotMatch(read('production-version.js'),/RC997/);
```

- [ ] **Step 2: RED verifizieren.** Run:

```bash
node --test .github/rc997/rc997-build-contract.test.mjs
```

Expected: FAIL, weil RC997-Buildscript noch fehlt.

- [ ] **Step 3: RC997-Buildscript aus dem bewährten RC996-Aufbau ableiten.** Konkrete Konstanten:

```js
const OUT=path.join(ROOT,'dist-rc997');
const VERSION='RC997';
const CACHE='997';
const HUB_SRC='/assets/exporthub-environment-hub.js?v=997';
const DEMO_SRC='/assets/exporthub-demo-bootstrap.js?v=997';
```

Die erzeugten Script-IDs heißen `exporthub-rc997-env-config`, `exporthub-rc997-env-hub` und `exporthub-rc997-demo-bootstrap`. Das Manifest verwendet `schema:'exporthub-rc997-three-env-v1'`.

- [ ] **Step 4: `TESTVERSION.html` ausschließlich an den kanonischen Buildstellen auf RC997/997 anheben.** Keine neue Runtime-Schicht hinzufügen.

- [ ] **Step 5: Build und Vertrag grün prüfen.** Run:

```bash
node --check .github/rc997/build-three-env.mjs
node .github/rc997/build-three-env.mjs
node --test .github/rc997/rc997-build-contract.test.mjs
```

Expected: PASS und drei Dateien mit RC997-Umgebungsmarker.

- [ ] **Step 6: Commit.**

```bash
git add TESTVERSION.html .github/rc997/build-three-env.mjs .github/rc997/rc997-build-contract.test.mjs
git commit -m "RC997: reproduzierbaren Website-Build anlegen"
```

---

### Task 3: Navigation, Suche, Renderstabilität und Smartphone-Menü abschließen

**Files:**
- Modify: `TESTVERSION.html`
- Modify: `.github/rc997/rc997-ui-contract.test.mjs`
- Regression: `test/rc990-integration.test.mjs`
- Regression: `test/rc990-error-handling.test.mjs`
- Regression: `test/rc975-global-render-integrity.test.mjs`

**Interfaces:**
- Consumes: `rc990ScheduleRender`, `rc990RememberView`, `rc990BackView`, bestehende `data-index321-view` Navigation, sichtbare Suchsteuerung und `ehMenuBtn`.
- Produces: eindeutige View-Navigation, korrekte Treffer-Navigation, lokaler Render ohne Fokus-/Scrollverlust und Ein-Tap-Menü.

- [ ] **Step 1: Aktive Such- und Navigationshandler eindeutig lokalisieren.** Run:

```bash
rg -n "data-index321-view|ehMenuBtn|Suche|search|rc990RememberView|rc990BackView|rc990ScheduleRender" TESTVERSION.html
```

Nur Handler, die tatsächlich vom sichtbaren UI referenziert werden, dürfen geändert werden.

- [ ] **Step 2: Vertrag um Navigation erweitern.** Der Test sammelt alle `data-index321-view`-Ziele und verlangt mehrere unterschiedliche Views statt eines pauschalen Sendungsziels:

```js
const views=[...html.matchAll(/data-index321-view=["']([^"']+)["']/g)].map(m=>m[1]);
assert.ok(views.length>=6,'zu wenige Hauptnavigationseinträge');
assert.ok(new Set(views).size>=6,'Hauptnavigation zeigt nicht auf getrennte Views');
```

Zusätzlich muss der aktive Back-Pfad `rc990BackView` und der Renderpfad `rc990ScheduleRender` verwenden.

- [ ] **Step 3: Test ausführen und nur bestätigte Fehler reparieren.** Bei einem View-Fehler wird der vorhandene Click-/View-Handler korrigiert; es wird keine zweite Navigation eingeführt. Bei Suchfehlern muss der bestehende Trefferhandler das konkrete Trefferobjekt plus Zielview übergeben, nicht pauschal `shipment` setzen.

- [ ] **Step 4: Smartphone-Menü absichern.** Der sichtbare Menübutton erhält genau einen aktiven Pointer-/Click-Pfad mit `touch-action: manipulation`; mehrfaches Rebinding darf alte Listener nicht vervielfachen. Androids bestehender `pointerup`/`touchend`-Fix bleibt unverändert kompatibel.

- [ ] **Step 5: Render-/Fehlerregressionen ausführen.** Run:

```bash
node --test .github/rc997/rc997-ui-contract.test.mjs
node --test test/rc990-integration.test.mjs test/rc990-error-handling.test.mjs test/rc975-global-render-integrity.test.mjs
```

Expected: PASS, keine duplizierten RC990-Funktionen, keine stillen Fehlerpfade, keine geleakten Scriptblöcke.

- [ ] **Step 6: Commit.**

```bash
git add TESTVERSION.html .github/rc997/rc997-ui-contract.test.mjs
git commit -m "RC997: Navigation Suche und Rendering finalisieren"
```

---

### Task 4: Sendung, Kunden, Dokumente, ABD, Mail und Druck in einem Abschlusscluster prüfen

**Files:**
- Modify only when RED proves a defect: `TESTVERSION.html`
- Modify: `.github/rc997/rc997-shipment-contract.test.mjs`
- Regression: `test/rc973-long-text-autogrow.test.mjs`
- Regression: `test/rc980-colli-row-stability.test.mjs`
- Regression: `test/rc990-design-system.test.mjs`

**Interfaces:**
- Consumes: `canonicalColliCard`, `canonicalMail`, `addRow`, `printStow`, vorhandene Versand-/Dokument-/ABD-Fachlogik.
- Produces: vollständige stabile Sendungsmaske, lesbare Langtexte, korrekte Colli-Daten, ein Mailbereich, unveränderte QR/PDF-Sicherheitsregeln.

- [ ] **Step 1: Sendungsvertrag erweitern.** Er prüft sechs aktive Kernbereiche genau einmal, `addRow()` nur per `appendChild`, den Auto-Grow-Layer und den RC995-PDF-ohne-QR-Vertrag.

```js
const add=html.match(/function addRow\(\)\{([\s\S]*?)\}function removeRow/);
assert.ok(add,'addRow fehlt');
assert.match(add[1],/appendChild\(ownedRow\(index,r\)\)/);
assert.doesNotMatch(add[1],/innerHTML\s*=|replaceChildren\(|replaceWith\(/);
assert.match(html,/rc973-autogrow-long-text/);
assert.match(html,/RC995_PDF_NO_QR|rc995PdfMode/);
```

- [ ] **Step 2: Fachliche Marker auditieren.** Run:

```bash
rg -n "ABD|Wartet auf ABD|canonicalMail|rc363BlockMail|CC|CMR|Ladeliste|Gesamtausgabe|POD vorhanden|Abgeholt|read.?only|locked" TESTVERSION.html
```

Der aktive Code muss die bestehende Fachlogik verwenden. RC997 führt keine neue ABD-, CMR- oder Sperrengine ein.

- [ ] **Step 3: Nur RED-Stellen reparieren.** Typische zulässige Korrekturen sind falscher View-Aufruf, fehlende Feldübernahme, ein versehentlich doppelter Mailblock oder ein Druckaufruf, der den bestehenden Generator nicht erreicht. Die bestehenden RC973-/RC980-Stile bleiben Quelle der Feld-/Colli-Geometrie.

- [ ] **Step 4: Regressionen ausführen.** Run:

```bash
node --test .github/rc997/rc997-shipment-contract.test.mjs
node --test test/rc973-long-text-autogrow.test.mjs test/rc980-colli-row-stability.test.mjs test/rc990-design-system.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add TESTVERSION.html .github/rc997/rc997-shipment-contract.test.mjs
git commit -m "RC997: Sendungs und Dokumentflows finalisieren"
```

---

### Task 5: QR-Abholung, Kunden-Avis und TESTSERVICE-Routen korrigieren

**Files:**
- Modify: `staticwebapp.testservice.config.json`
- Modify only when existing RC995 tests expose a defect: `pickup.html`
- Modify only when existing RC995 tests expose a defect: `customer-avis.html`
- Modify only when existing RC995 tests expose a defect: `api/pickup-init/index.js`
- Modify only when existing RC995 tests expose a defect: `api/pickup-status/index.js`
- Modify only when existing RC995 tests expose a defect: `api/pickup-confirm-v2/index.js`
- Modify only when existing RC995 tests expose a defect: `api/pickup-pod/index.js`
- Modify only when existing RC995 tests expose a defect: `api/customer-avis/index.js`
- Test: `.github/rc997/rc997-external-contract.test.mjs`

**Interfaces:**
- Consumes: RC995 `public-access-store`, token hash/consume/lockout, Pickup-PIN, Avis-Session.
- Produces: echte separate `/pickup(.html)`- und `/customer-avis(.html)`-Seiten im TESTSERVICE, ohne Abschwächung der RC995-Sicherheit.

- [ ] **Step 1: Aktuellen konkreten Routingfehler als RED bestätigen.** Der vorhandene TESTSERVICE-Configstand rewritet `/pickup` bzw. `/pickup.html` auf `TESTVERSION.html`; der neue Vertrag muss deshalb rot sein.

- [ ] **Step 2: TESTSERVICE-Routen korrigieren.** Zielkonfiguration:

```json
{
  "route": "/pickup",
  "rewrite": "/pickup.html",
  "allowedRoles": ["anonymous"],
  "headers": {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-ExportHUB-Environment": "test"
  }
},
{
  "route": "/pickup.html",
  "allowedRoles": ["anonymous"],
  "headers": {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-ExportHUB-Environment": "test"
  }
},
{
  "route": "/customer-avis",
  "rewrite": "/customer-avis.html",
  "allowedRoles": ["anonymous"],
  "headers": {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-ExportHUB-Environment": "test"
  }
},
{
  "route": "/customer-avis.html",
  "allowedRoles": ["anonymous"],
  "headers": {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-ExportHUB-Environment": "test"
  }
}
```

Beide HTML-Pfade werden zusätzlich in `navigationFallback.exclude` aufgenommen.

- [ ] **Step 3: RC995-Sicherheit unverändert prüfen.** Run:

```bash
node --test .github/rc995/rc995-contract.test.mjs
node --test .github/rc995/rc995-flow.test.cjs
node --test .github/rc997/rc997-external-contract.test.mjs
```

Expected: PASS. Kein Roh-Token im Team-State, Pickup bleibt consume-/PIN-geschützt, Avis bleibt session-basiert.

- [ ] **Step 4: API-Syntax prüfen.** Run:

```bash
node --check api/shared/public-access-store.js
node --check api/shared/pickup-store.js
node --check api/pickup-init/index.js
node --check api/pickup-status/index.js
node --check api/pickup-confirm-v2/index.js
node --check api/pickup-pod/index.js
node --check api/customer-avis/index.js
```

- [ ] **Step 5: Commit.**

```bash
git add staticwebapp.testservice.config.json .github/rc997/rc997-external-contract.test.mjs pickup.html customer-avis.html api
git commit -m "RC997: externe Pickup und Avis Flows finalisieren"
```

---

### Task 6: Dashboard, Warn-/Benachrichtigungscenter, Aufgaben, Planer und Lager final absichern

**Files:**
- Modify only for confirmed RED: `TESTVERSION.html`
- Modify only for confirmed RED: `assets/exporthub-environment-hub.js`
- Modify: `.github/rc997/rc997-ui-contract.test.mjs`
- Regression: `.github/rc996/tasks-contract.test.mjs`
- Regression: `.github/rc996/state-merge-contract.test.mjs`
- Regression: `test/rc990-design-system.test.mjs`

**Interfaces:**
- Consumes: RC990 Design-System, `index236NotificationCenter`, `rc885WarningDrawer`, RC946/RC994 Drag-Reconcile, RC996 Task-Identity-Ledger.
- Produces: getrennte Center, kompakte Kacheln, stabiler Arbeitsfokus, performantes Drag-and-Drop und eindeutige Aufgaben.

- [ ] **Step 1: Center-Vertrag erweitern.** Er verlangt beide Center-IDs, unterschiedliche Zählerselektoren im Environment-Hub und keine Zusammenführung zu einem einzigen Meldungsstrom.

- [ ] **Step 2: Dashboard-/Dichte-Regeln gegen RC990-Design prüfen.** Es darf kein `height:100%`-Strecken von Karten und kein `transition:all`/Drag-Animationen geben. Arbeitsfokus wird im bestehenden Dashboardbereich positioniert statt durch einen neuen Overlay-Block.

- [ ] **Step 3: Aufgaben-/Planer-Verträge vollständig ausführen.** Run:

```bash
node --test .github/rc996/tasks-contract.test.mjs
node --test .github/rc996/state-merge-contract.test.mjs
node --test test/rc990-design-system.test.mjs
node --test .github/rc997/rc997-ui-contract.test.mjs
```

Expected: PASS; verschiedene Aufgaben derselben Sendung bleiben getrennt und Planner-Drag löst keinen Vollrender aus.

- [ ] **Step 4: Bei RED nur den vorhandenen aktiven Handler korrigieren und denselben Test erneut ausführen.** Kein zweites Aufgaben-/Lager-/Center-System anlegen.

- [ ] **Step 5: Commit.**

```bash
git add TESTVERSION.html assets/exporthub-environment-hub.js .github/rc997/rc997-ui-contract.test.mjs
git commit -m "RC997: Dashboard Aufgaben und Lager abschließen"
```

---

### Task 7: Android-Kompatibilität auf RC997 anheben

**Files:**
- Modify: `android-app/app/build.gradle.kts`
- Modify: `android-app/APP_BUILD_INFO.txt`
- Create: `.github/rc997/android-contract.test.mjs`
- Reuse unchanged unless RED proves otherwise: `android-app/app/src/main/java/de/exporthub/test/EnvironmentActivity.java`
- Reuse unchanged unless RED proves otherwise: `NotificationHelper.java`, `ReminderScheduler.java`, `ReminderReceiver.java`, `BootReceiver.java`, `AndroidManifest.xml`

**Interfaces:**
- Consumes: dieselben drei URLs und die RC996 Android-Brücke.
- Produces: upgradefähiges RC997-Debug-APK ohne Verlust von Menü, Upload, Download, Print, Zurücknavigation und Benachrichtigungen.

- [ ] **Step 1: RC997-Androidvertrag aus RC996 ableiten.** Alle bisherigen Feature-Assertions bleiben erhalten; nur Versionsassertionen werden auf RC997 erweitert:

```js
const gradle=read('android-app/app/build.gradle.kts');
assert.match(gradle,/applicationId\s*=\s*"de\.exporthub\.test"/);
assert.match(gradle,/versionCode\s*=\s*997/);
assert.match(gradle,/versionName\s*=\s*"1\.0-rc997"/);
assert.match(read('android-app/APP_BUILD_INFO.txt'),/RC997/);
```

- [ ] **Step 2: RED verifizieren.** Run:

```bash
node --test .github/rc997/android-contract.test.mjs
```

Expected: FAIL nur an 996→997-Versionierung.

- [ ] **Step 3: Version anheben.** In `build.gradle.kts`:

```kotlin
versionCode = 997
versionName = "1.0-rc997"
```

`APP_BUILD_INFO.txt` erhält `App-Version: 1.0-rc997` und `Release-Kandidat: RC997`; die drei URLs und Funktionsliste bleiben erhalten.

- [ ] **Step 4: Android-Verträge grün prüfen.** Run:

```bash
node --test .github/rc996/android-contract.test.mjs .github/rc997/android-contract.test.mjs
```

Der RC996-Vertrag wird dabei so angepasst, dass er die Application-ID und Features schützt, aber `versionCode >= 996` zulässt; er darf RC997 nicht wegen einer bewusst höheren Version blockieren.

- [ ] **Step 5: APK bauen.** Run:

```bash
cd android-app
gradle :app:assembleDebug --stacktrace
```

Expected: `app/build/outputs/apk/debug/app-debug.apk` vorhanden.

- [ ] **Step 6: Commit.**

```bash
git add android-app .github/rc996/android-contract.test.mjs .github/rc997/android-contract.test.mjs
git commit -m "RC997: Android Kandidat upgradefähig halten"
```

---

### Task 8: RC997 TESTSERVICE-Workflow mit vollständigem Live-Gate

**Files:**
- Create: `.github/workflows/rc997-website-final.yml`
- Create: `.github/rc997/rc997-workflow-contract.test.mjs`
- Reuse: `.github/rc997/build-three-env.mjs`
- Reuse: `staticwebapp.testservice.config.json`

**Interfaces:**
- Consumes: RC997-Verträge, RC995/RC996-Regressionen und Android-Projekt.
- Produces: sicherer TESTSERVICE-Deploy aus `rc997-website-final` bzw. später `main`, RC997-APK-Artefakt und Live-Beweis für interne/externe Seiten.

- [ ] **Step 1: Workflow-Vertrag RED schreiben.** Er verlangt:

```js
assert.match(src,/rc997-website-final/);
assert.match(src,/dist-rc997/);
assert.match(src,/\.rc997_testservice_app/);
assert.match(src,/swa deploy \.\/\.rc997_testservice_app/);
assert.match(src,/--env testservice/);
assert.match(src,/--api-location \.\/api/);
assert.doesNotMatch(src,/deployment_environment:\s*testservice/);
assert.doesNotMatch(src,/Azure\/static-web-apps-deploy@v1/);
assert.match(src,/pickup\.html/);
assert.match(src,/customer-avis\.html/);
assert.match(src,/api_code=.*curl -sS --connect-timeout/);
assert.doesNotMatch(src,/api_code=.*curl -sS -L/);
```

- [ ] **Step 2: Workflow aus dem bewährten RC996-SWA-CLI-Pfad ableiten.** Branches: `rc997-website-final` und `main`. Deployment-Job läuft nur auf diesen beiden Refs und ausschließlich mit `--env testservice`.

- [ ] **Step 3: Vollständiges Contract-Job-Gate einbauen.** Reihenfolge:

```bash
node --check .github/rc997/build-three-env.mjs
node --test .github/rc997/*.test.mjs
node --test .github/rc995/rc995-contract.test.mjs
node --test .github/rc995/rc995-flow.test.cjs
node --test .github/rc996/tasks-contract.test.mjs
node --test .github/rc996/state-merge-contract.test.mjs
node --test .github/rc996/rc996-three-env.test.mjs
node --test .github/rc996/android-contract.test.mjs
npm test
```

- [ ] **Step 4: Frontend-Artefakt `.rc997_testservice_app` erzeugen.** Es enthält RC997-Testseite als `index.html` und `TESTVERSION.html`, `demo.html`, `pickup.html`, `customer-avis.html`, `location.html`, `pod-notfall.html`, statische Assets und `staticwebapp.config.json`; `api` darf nicht in das Frontend-Artefakt kopiert werden.

- [ ] **Step 5: Android-Job baut `ExportHUB-RC997-Android`.** Pfad bleibt `android-app/app/build/outputs/apk/debug/app-debug.apk`.

- [ ] **Step 6: Sicheren SWA-Deploy ausführen.** Exakt:

```bash
swa deploy ./.rc997_testservice_app \
  --api-location ./api \
  --swa-config-location ./.rc997_testservice_app \
  --api-language node \
  --api-version 20 \
  --env testservice
```

- [ ] **Step 7: Live-Gate erweitern.** Root, `TESTVERSION.html`, `demo.html`, `pickup.html`, `customer-avis.html` folgen statischen Redirects maximal fünfmal; Auth-API folgt keinen Redirects. Erfolg verlangt HTTP 200 und Marker:

```bash
grep -q 'ExportHUB RC997 environment=testservice' "$root_file"
grep -q 'ExportHUB RC997 environment=testservice' "$test_file"
grep -q 'ExportHUB RC997 environment=demo' "$demo_file"
grep -q 'Abholung bestätigen' "$pickup_file"
grep -q 'Kunden-Avis' "$avis_file"
```

Auth-JSON muss weiterhin `ok === true` liefern.

- [ ] **Step 8: Produktionsguard einbauen.** Vor und nach Build/Deploy:

```bash
grep -q 'RC990' production-version.js
if grep -q 'RC997' production-version.js; then exit 1; fi
```

- [ ] **Step 9: Workflow-Vertrag lokal/CI grün prüfen und committen.**

```bash
node --test .github/rc997/rc997-workflow-contract.test.mjs
git add .github/workflows/rc997-website-final.yml .github/rc997/rc997-workflow-contract.test.mjs
git commit -m "RC997: vollständiges TESTSERVICE Abschlussgate hinzufügen"
```

---

### Task 9: Frischer Branch-Abschluss, TESTSERVICE-Liveprüfung und Integration nach `main`

**Files:**
- Test/verification only before integration.
- No modification to `production-version.js`.

**Interfaces:**
- Consumes: kompletter RC997-Branch.
- Produces: vollständig geprüften RC997-Stand auf `main`, weiterhin ohne Produktionsfreigabe.

- [ ] **Step 1: Branch-Workflow vollständig grün abwarten und jeden Job prüfen.** Erforderlich: Contracts success, Android build success, APK artifact success, TESTSERVICE deploy success, Live-Gate success.

- [ ] **Step 2: APK-Artefakt verifizieren.** Name `ExportHUB-RC997-Android`, nicht abgelaufen, Head-SHA entspricht exakt dem Branch-Head.

- [ ] **Step 3: Produktion frisch prüfen.** `production-version.js` muss exakt RC990 enthalten. Außerdem darf der Produktionsworkflow nicht durch RC997-Branchcommits ausgelöst worden sein.

- [ ] **Step 4: Branch gegen main vergleichen.** Voraussetzung: `behind_by = 0`. Alle RC997-Dateien und nur beabsichtigte aktive Reparaturen müssen im Diff erklärbar sein.

- [ ] **Step 5: Fast-forward nach `main` nur nach vollständig grünem Branch-Gate.** Kein Force-Push.

```bash
git checkout main
git merge --ff-only rc997-website-final
git push origin main
```

- [ ] **Step 6: Frischen RC997-Workflow auf `main` vollständig erneut prüfen.** Alle Contracts, APK, benannter TESTSERVICE-Deploy und Live-Gate müssen erneut success sein.

- [ ] **Step 7: Finalen Produktionsguard wiederholen.** Produktion bleibt RC990; RC997 wird erst in einem späteren, ausdrücklich freigegebenen Release-Center-Schritt Produktion.

- [ ] **Step 8: Abschlussbericht.** Nur mit frischer Evidenz melden: finaler Commit-SHA, Workflow-Run-ID, Contractstatus, APK-Artefakt, TESTSERVICE Root/Test/Demo/Pickup/Avis/Auth live grün und Produktion weiterhin RC990.

---

## Self-Review gegen die Spezifikation

- Navigation/Rendering/Suche/Smartphone: Tasks 1 und 3.
- Dashboard/Warncenter/Benachrichtigungscenter: Task 6.
- Sendung/Colli/Langtext/Sperren: Task 4.
- Kunden/Standorte/Dokumente: Task 4 plus Live-Gate Task 8.
- ABD/Mail: Task 4.
- Ladeliste/CMR/PDF/Gesamtausgabe: Task 4 plus bestehende RC995-/RC990-Regressionen.
- QR/PIN/POD/Avis: Task 5 plus RC995-Sicherheitsverträge.
- Aufgaben/Planer/Lager: Task 6 plus RC996-Verträge.
- Release Center/Produktion: Tasks 3, 8 und 9; Produktion bleibt RC990.
- Demo/Android: Tasks 2, 7 und 8.
- Professional-Migration, Datenbank, Blob-Neubau und D365 bleiben ausdrücklich außerhalb des RC997-Scopes.
