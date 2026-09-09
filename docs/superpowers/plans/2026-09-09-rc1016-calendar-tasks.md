# RC1016 Kalender und Aufgaben Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den getesteten RC1014-Aufgaben- und Kalenderstand sicher auf RC1015 portieren, den aktiven Aufgaben-Renderer unterstützen und Produktion, TESTSERVICE und Demo als gemeinsame RC1016-Version ausgeben.

**Architecture:** RC1016 startet vom grünen RC1015-Branch. Die fachlich stabilen RC1014-Assets werden übernommen, der Runtime-Adapter wird für beide Kartenrenderer korrigiert und ein neuer RC1016-Drei-Umgebungen-Build ergänzt die Komponenten nach dem bestehenden RC1013/RC1015-Build. Der Browser-Test prüft echte Demo-Ansichten statt nur Quelltextverträge.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js 24 im GitHub-Workflow, Node-Test-Runner, Playwright Chromium, bestehende Azure Functions.

**Spec:** `docs/superpowers/specs/2026-09-09-rc1016-calendar-tasks-design.md`

## Global Constraints

- Ausgangspunkt ist RC1015 Commit `a34bf4819f2c38a257f8618462fda0f461bd2aa9`.
- Entwicklung erfolgt auf `rc1016-calendar-sop`; `main` wird bis zur vollständigen Verifikation nicht direkt verändert.
- Produktion, TESTSERVICE und Demo müssen am Ende dieselbe Versionskennung RC1016 tragen.
- RC1015 Lieferavis, QR-Abholung, Diagnose, Gate41 und Storage-Resilienz dürfen nicht regressieren.
- Aufgaben bleiben im vorhandenen `state.tasks` Store; kein zweiter Aufgaben-Store.
- Demo bleibt datenisoliert und darf keine Produktivdaten schreiben.
- Keine neue Laufzeitabhängigkeit im Produktiv-Frontend.

---

### Task 1: RC1014-Fachkomponenten auf RC1016-Basis übernehmen

**Files:**
- Create: `assets/rc1014-task-lifecycle.js`
- Create: `assets/rc1014-task-runtime.js`
- Create: `assets/rc1014-task-ui.css`
- Create: `assets/rc1014-shipment-overview.js`
- Create: `assets/rc1014-shipment-overview.css`
- Create: `assets/rc1014-demo-bridge.js`
- Create: `test/rc1014-task-lifecycle.test.mjs`
- Create: `test/rc1014-task-runtime-integration.test.mjs`
- Create: `test/rc1014-task-design.test.mjs`
- Create: `test/rc1014-task-android.test.mjs`
- Create: `test/rc1014-shipment-overview-meta.test.mjs`
- Create: `test/rc1014-demo-environment.test.mjs`
- Create: `test/rc1014-demo-session-calendar.test.mjs`

**Interfaces:**
- Consumes: bestehendes `state.tasks`, `openShipment`, `ExportHUBAndroid`, `ExportHUBClean`.
- Produces: `globalThis.ExportHUBRC1014Tasks` und `globalThis.ExportHUBRC1014TaskRuntime`.

- [ ] **Step 1: Stabile Dateien aus `rc1014-tasks-final` unverändert auf den RC1016-Zweig übernehmen.**

Die Quell-SHAs müssen den geprüften RC1014-Dateien entsprechen, bevor der Renderer-Fix angewendet wird.

- [ ] **Step 2: Lifecycle-Test ausführen.**

Run: `node --test test/rc1014-task-lifecycle.test.mjs`

Expected: 10 Tests PASS.

- [ ] **Step 3: Runtime-Integration ausführen.**

Run: `node --test test/rc1014-task-runtime-integration.test.mjs`

Expected: 4 Tests PASS, sobald der RC1016-Build aus Task 3 vorhanden ist; bis dahin darf nur die fehlende Builddatei die Integration blockieren.

- [ ] **Step 4: Commit.**

```bash
git add assets/rc1014-* test/rc1014-*
git commit -m "RC1016: Aufgaben- und Kalenderkomponenten auf RC1015 übernehmen"
```

---

### Task 2: Aktiven Aufgaben-Renderer per TDD unterstützen

**Files:**
- Modify: `test/rc1014-task-design.test.mjs`
- Modify: `assets/rc1014-task-runtime.js`

**Interfaces:**
- Consumes: DOM-Karten mit `.rc229-task-card.rc628-unified-task` oder `.task-card`.
- Produces: `enhanceTaskCards(tasks, ctx) -> number` für beide Rendererfamilien.

- [ ] **Step 1: Bestehenden RED-Test beibehalten und um Selektorverhalten ergänzen.**

Der Vertrag muss weiter enthalten:

```js
assert.match(runtime,/\.task-card/,'RC1014 muss neben RC229 auch die aktive task-card Klasse erkennen.');
assert.match(runtime,/data-rc1014-enhanced/,'aktive Karten müssen nach der Erweiterung eindeutig markiert werden.');
```

- [ ] **Step 2: Test ausführen und RED bestätigen.**

Run: `node --test test/rc1014-task-design.test.mjs`

Expected: FAIL bei „Karten-Enhancer unterstützt den tatsächlich aktiven task-card Renderer“.

- [ ] **Step 3: Minimalen Runtime-Fix implementieren.**

In `enhanceTaskCards` wird exakt dieser kompatible Selektor verwendet:

```js
const cards=Array.from(doc.querySelectorAll('.rc229-task-card.rc628-unified-task, .task-card'));
```

`cardTask`, Scope-Prüfung, Meta-Zeile und Öffnen-Aktion bleiben unverändert.

- [ ] **Step 4: Design-Test erneut ausführen.**

Run: `node --test test/rc1014-task-design.test.mjs`

Expected: 6 Tests PASS.

- [ ] **Step 5: Commit.**

```bash
git add assets/rc1014-task-runtime.js test/rc1014-task-design.test.mjs
git commit -m "RC1016: aktiven Aufgaben-Renderer unterstützen"
```

---

### Task 3: RC1016 Drei-Umgebungen-Build erstellen

**Files:**
- Create: `.github/rc1016/build-three-env.mjs`
- Create: `test/rc1016-release-sync.test.mjs`

**Interfaces:**
- Consumes: `.github/rc1013/build-three-env.mjs` und die RC1014-Fachassets.
- Produces: `dist-rc1016/index.html`, `dist-rc1016/TESTVERSION.html`, `dist-rc1016/demo.html`, `dist-rc1016/rc1016-manifest.json`.

- [ ] **Step 1: Release-Sync-Test schreiben.**

Der Test baut RC1016 und prüft für alle drei HTML-Dateien:

```js
for(const file of ['index.html','TESTVERSION.html','demo.html']){
  const html=read(`dist-rc1016/${file}`);
  assert.match(html,/RC1016/);
  assert.match(html,/rc1014-task-runtime\.js/);
  assert.match(html,/rc1015-lieferavis-mail-flow\.js/);
}
```

Zusätzlich muss `demo.html` `DATA_ENVIRONMENT='demo'` enthalten, Produktion und TESTSERVICE dürfen dies nicht enthalten.

- [ ] **Step 2: Test RED ausführen.**

Run: `node --test test/rc1016-release-sync.test.mjs`

Expected: FAIL, weil `.github/rc1016/build-three-env.mjs` noch fehlt.

- [ ] **Step 3: Buildscript anlegen.**

Das Script führt zuerst aus:

```js
execFileSync(process.execPath,['.github/rc1013/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
```

Danach kopiert es `dist-rc1013` nach `dist-rc1016`, setzt sichtbare Buildmarker auf RC1016, injiziert Task-/Shipment-Assets, patcht die Aufgabenquelle über `ExportHUBRC1014TaskRuntime.prepareTasks`, ergänzt in Demo die RC1014-Demo-Bridge und schreibt ein RC1016-Manifest.

- [ ] **Step 4: Release-Sync-Test GREEN ausführen.**

Run: `node --test test/rc1016-release-sync.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add .github/rc1016/build-three-env.mjs test/rc1016-release-sync.test.mjs
git commit -m "RC1016: Drei-Umgebungen-Build auf RC1015 aufsetzen"
```

---

### Task 4: Demo-Version und Kalenderverträge auf RC1016 anpassen

**Files:**
- Modify: `assets/rc1014-demo-bridge.js`
- Modify: `test/rc1014-demo-environment.test.mjs`
- Create: `test/rc1016-calendar-release.test.mjs`

**Interfaces:**
- Consumes: Demo-Fetch-Bridge und `/api/fixed-pickups`-Vertrag.
- Produces: Demo-State mit `serverVersion: 'RC1016'` und isolierten Demo-FIX-Daten.

- [ ] **Step 1: RC1016-Versionstest schreiben.**

```js
assert.match(bridge,/serverVersion\s*(?:=|:)\s*['"]RC1016['"]/);
```

Der Kalender-Test prüft im gebauten Demo, dass die Bridge `Fake Fix Nord`, `Fake Fix Export` und `Fake Fix Benelux` bereitstellt und Produktion/TESTSERVICE keine Demo-Datenumgebung setzen.

- [ ] **Step 2: Tests RED ausführen.**

Run: `node --test test/rc1014-demo-environment.test.mjs test/rc1016-calendar-release.test.mjs`

Expected: FAIL an der noch vorhandenen RC1014-Versionskennung.

- [ ] **Step 3: Demo-Bridge auf RC1016-Kennung aktualisieren.**

Die Sessionversion und `serverVersion` werden auf `RC1016` gesetzt. Die fachlichen Fake-FIX-Daten bleiben unverändert.

- [ ] **Step 4: Tests GREEN ausführen.**

Run: `node --test test/rc1014-demo-environment.test.mjs test/rc1016-calendar-release.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add assets/rc1014-demo-bridge.js test/rc1014-demo-environment.test.mjs test/rc1016-calendar-release.test.mjs
git commit -m "RC1016: Demo-Kalender und Versionsvertrag synchronisieren"
```

---

### Task 5: Chromium-End-to-End-Test korrigieren und ausführen

**Files:**
- Create: `browser/rc1016-visual-functional.mjs`

**Interfaces:**
- Consumes: `dist-rc1016/demo.html`.
- Produces: `artifacts/rc1016-browser/*.png` und `artifacts/rc1016-browser/report.json`.

- [ ] **Step 1: Browser-Test aus RC1014 übernehmen und Kartenselektoren kompatibel machen.**

Für sichtbare Aufgaben gilt:

```js
const cards=page.locator('.rc229-task-card.rc628-unified-task, .task-card');
assert(await cards.count()>0,'Aufgabenansicht enthält keine Aufgabenkarten.');
const enhanced=page.locator('[data-rc1014-enhanced="1"] [data-rc1014-open-task], [data-rc1014-enhanced="1"][data-rc1014-open-task]');
assert(await enhanced.count()>0,'RC1016 Öffnen-Aktion fehlt in Aufgabenkarten.');
```

Der Test prüft weiterhin Desktop, Tablet, Mobile, Aufgaben, Sendungsübersicht, Abholkalender, Layout-Overflow und Consolefehler.

- [ ] **Step 2: Browser-Test lokal/CI gegen den RC1016-Demo-Build ausführen.**

Run nach Start eines lokalen Servers für `dist-rc1016`:

```bash
node browser/rc1016-visual-functional.mjs
```

Expected: 3 Viewports × 3 Ansichten, 0 Browserfehler.

- [ ] **Step 3: Screenshots als spätere Quelle für die SOP-Systembilder aufbewahren.**

Erwartete Dateien enthalten mindestens je einen Screenshot der Aufgabenansicht und des Abholkalenders in Desktop-Auflösung.

- [ ] **Step 4: Commit.**

```bash
git add browser/rc1016-visual-functional.mjs
git commit -m "test: RC1016 Aufgaben und Kalender im echten Browser prüfen"
```

---

### Task 6: RC1016 Workflow und vollständige Regression

**Files:**
- Create: `.github/workflows/rc1016-development.yml`

**Interfaces:**
- Consumes: alle RC1016-Tests und Buildskripte.
- Produces: einen nachvollziehbaren GitHub-Actions-Lauf mit Unit-, Browser- und Regressionsstatus.

- [ ] **Step 1: Workflow mit getrennten Jobs anlegen.**

`contracts` führt die RC1014/RC1016 Unit-Tests sowie QR-/Lieferavis-Regression aus. `browser` baut RC1016, installiert Playwright Chromium, startet `dist-rc1016` und führt den Browser-Test aus. Browser-Screenshots werden 30 Tage als Artifact gespeichert.

- [ ] **Step 2: Workflow durch Push auf `rc1016-calendar-sop` starten.**

Expected: beide Jobs PASS.

- [ ] **Step 3: Bei Fehlern ausschließlich den konkreten fehlerhaften Schritt analysieren und korrigieren.**

Kein Blind-Rerun. Ein erneuter Lauf erfolgt erst nach einer Code- oder Testkorrektur mit konkreter Ursache.

- [ ] **Step 4: Finalen Drei-Umgebungen-Stand prüfen.**

Alle drei HTML-Ausgaben müssen RC1016 tragen, Task-/Kalenderassets enthalten und den RC1015-Lieferavis-Flow weiterhin laden.

- [ ] **Step 5: Commit.**

```bash
git add .github/workflows/rc1016-development.yml
git commit -m "ci: RC1016 Kalender und Aufgaben vollständig prüfen"
```
