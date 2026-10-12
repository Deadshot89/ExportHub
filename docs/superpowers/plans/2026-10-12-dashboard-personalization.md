# ExportHUB360 Dashboard-Personalisierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das bestehende ExportHUB360-Dashboard wird vollständig personalisierbar, ohne bestehende Dashboard-Fachlogik, Kennzahlen, Rechte, Datenquellen oder Navigationen zu duplizieren oder zu verändern.

**Architecture:** Eine neue, isolierte RC1371-Dashboard-Runtime übernimmt ausschließlich Widget-Erkennung, Layout-State, Benutzer-Persistenz, Edit-Mode, Widget-Bibliothek und Responsive-Grid. Bestehende Dashboard-DOM-Knoten werden wiederverwendet und nicht geklont; RC1306 erhält nur einen kleinen Integrationshook, damit die generische Theme-Layout-Engine das Dashboard nicht gleichzeitig umsortiert. Die Fachwerte bleiben vollständig im vorhandenen Dashboard-Renderer.

**Tech Stack:** Vanilla JavaScript, CSS Grid, bestehendes ExportHUB-I18n, localStorage nur für benutzerbezogenen Darstellungszustand, Node `node:test`, Playwright, bestehender RC1112-Drei-Umgebungen-Build.

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-personalization-design.md`

## Global Constraints

- Bestehende Dashboard-KPI-/Status-/Aufgaben-/Sendungslogik bleibt fachlich unverändert.
- Offene Sendungen bleiben im Dashboard genau die noch nicht abgeholten Sendungen.
- Persönliche Aufgaben bleiben nach angemeldetem Benutzer und aktueller Woche gefiltert; Rückstand bleibt sichtbar.
- Bestehende Modul-/Rechteprüfungen bleiben die einzige Berechtigungsquelle.
- Keine neue API-Abfrage oder zweite KPI-Berechnung nur für Personalisierung.
- Keine funktionalen DOM-Knoten klonen; bestehende Knoten werden bewegt oder über CSS angeordnet.
- Dashboard-Persistenz enthält ausschließlich Darstellungszustand und bleibt strikt benutzerbezogen.
- Fehlt eine stabile Benutzeridentität, wird kein persistenter anonymer Layout-State geschrieben.
- `classic`, `modern`, `glass` und `neon` bleiben funktionsfähig; neue CSS-Regeln sind auf den Dashboard-Bereich gescoped.
- Kein neues großes UI-Framework und kein `transition: all` auf Drag-/Resize-relevanten Elementen.
- `main` wird erst nach vollständigen Node-, Build-, I18n-, Browser- und Regressionstests berührt.
- Ein erfolgreicher Branch-/TESTSERVICE-Test ist kein Produktionsnachweis.

## Review Focus

1. **Benutzerwechsel im selben Browser:** Layout A darf niemals für Benutzer B geladen oder überschrieben werden; Test gehört zu Task 1.
2. **Theme-Wechsel während Edit-Mode:** RC1306 und RC1371 dürfen keine Knoten duplizieren, verlieren oder gegeneinander verschieben; Test gehört zu Task 4 und Task 7.
3. **Gespeichertes Widget nach Rechteentzug:** Ein zuvor gespeichertes Widget muss trotz Layout-State verborgen bleiben; Test gehört zu Task 2.
4. **Dashboard-Neurender während Drag/Resize:** der fachliche Renderer darf keine doppelte Karte, verlorenen Listener oder Vollseiten-Rebuild-Schleife erzeugen; Test gehört zu Task 3 und Task 7.
5. **Veralteter/defekter localStorage-State:** ungültige JSON-Daten, unbekannte IDs und alte Größen dürfen das Dashboard nicht blockieren; Test gehört zu Task 1.

---

### Task 1: Layout-State und benutzerbezogene Persistenz

**Files:**
- Create: `assets/rc1371-dashboard-personalization.js`
- Create: `test/rc1371-dashboard-personalization-state.test.mjs`

**Interfaces:**
- Consumes: `window.__EXPORTHUB_GET_CURRENT_USER__`, `window.ExportHUBClean.runtime.user`, `window.currentUser`, `window.__EXPORTHUB_GET_STATE__` nur zur Ermittlung einer stabilen Benutzeridentität.
- Produces: `window.ExportHUBDashboard1371` mit `version`, `normalizeLayout(raw, registry)`, `resolveUserIdentity()`, `layoutStorageKey(userId)`, `readLayout(userId, registry)`, `writeLayout(userId, state)`, `resetLayout(userId)`, `templateLayout(name, registry)`.
- Layout schema: `{schema:'v1', template:'standard|management|operativ|kompakt|analyse', widgets:[{id,visible,size,order}]}`.
- Größen: exakt `S|M|L|XL`.

- [ ] **Step 1: Write the failing state-model tests**

Create tests named:
- `RC1371 trennt Layout-State strikt nach Benutzer`
- `RC1371 schreibt ohne stabile Benutzeridentität keinen persistenten State`
- `RC1371 repariert ungültige Größen auf defaultSize`
- `RC1371 ignoriert unbekannte Widget-IDs`
- `RC1371 fällt bei defektem JSON auf Standard zurück`
- `RC1371 reset löscht nur den aktuellen Benutzer-Key`
- `RC1371 liefert alle fünf Vorlagen`

Assertions must pin the storage key prefix to `exporthub.dashboard.layout.v1.` and verify that two identities produce different keys and independent states.

- [ ] **Step 2: Run the state tests and verify RED**

Run: `node --test test/rc1371-dashboard-personalization-state.test.mjs`

Expected: FAIL because `assets/rc1371-dashboard-personalization.js` and `ExportHUBDashboard1371` do not exist yet.

- [ ] **Step 3: Implement the minimal state API**

Implement the functions listed in **Interfaces**. `resolveUserIdentity()` must prefer immutable login/user identifiers over display names. `writeLayout()` returns `false` and performs no write when the user id is empty. `normalizeLayout()` must intersect stored IDs and sizes with the current registry instead of trusting persisted data.

- [ ] **Step 4: Run the state tests and verify GREEN**

Run: `node --test test/rc1371-dashboard-personalization-state.test.mjs`

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add assets/rc1371-dashboard-personalization.js test/rc1371-dashboard-personalization-state.test.mjs
git commit -m "feat: add dashboard personalization state model"
```

---

### Task 2: Widget-Registry, Bestandsschutz und Berechtigungsadapter

**Files:**
- Modify: `assets/rc1371-dashboard-personalization.js`
- Create: `test/rc1371-dashboard-widget-registry.test.mjs`

**Interfaces:**
- Consumes: Task-1-State-API; existing `window.canView(module)` when present; current Dashboard DOM only.
- Produces: `registerWidget(definition)`, `registry()`, `discoverDashboardRoot()`, `discoverWidgets(root)`, `canUseWidget(definition)`, `resolveStableWidgetId(node)`.
- Registry definition: `{id,titleKey,category,defaultSize,allowedSizes,requiredModule,detailModule,selector}`.

- [ ] **Step 1: Write failing registry/permission tests**

Tests must prove:
- current dashboard nodes are referenced, never cloned;
- widget IDs are stable and unique;
- `canUseWidget()` delegates to existing `canView()` when `requiredModule` exists;
- a stored widget whose permission is now denied is omitted from the visible layout;
- widgets without permission are absent from the add-library;
- the runtime does not contain replacement implementations of `shipmentDashboardOpenList`, `workspaceTaskVisible`, `workspaceTaskForUser`, `dashboardShipmentPickedUp` or other KPI/task business calculations;
- every currently detected dashboard card is either registered with a stable ID or explicitly preserved as a fixed system block, never silently removed.

- [ ] **Step 2: Run registry tests and verify RED**

Run: `node --test test/rc1371-dashboard-widget-registry.test.mjs`

Expected: FAIL because registry/discovery/permission APIs are missing.

- [ ] **Step 3: Implement registry and adapters**

Use existing DOM IDs/data attributes/action anchors as first choice for stable IDs. Do not derive persistence IDs from translated visible text. If an existing block has no stable structural anchor, keep it visible as a non-removable system block until an explicit stable selector is added; never bind it to an order-based ID that could later point to another KPI.

Initial semantic categories must support the spec categories, while current ExportHUB dashboard blocks such as Arbeitsfokus, offene Sendungen, fällige Aufgaben, Warncenter and Benachrichtigungscenter remain linked to their existing nodes and existing detail/navigation behavior.

- [ ] **Step 4: Run registry tests and existing dashboard business-rule tests**

Run:
```bash
node --test test/rc1371-dashboard-widget-registry.test.mjs \
  test/rc1044-dashboard-open-shipments.test.mjs \
  test/rc1045-dashboard-due-tasks.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add assets/rc1371-dashboard-personalization.js test/rc1371-dashboard-widget-registry.test.mjs
git commit -m "feat: register existing dashboard widgets safely"
```

---

### Task 3: Edit-Mode, Drag/Reorder, Resize und Widget-Bibliothek

**Files:**
- Modify: `assets/rc1371-dashboard-personalization.js`
- Create: `test/rc1371-dashboard-edit-mode.test.mjs`

**Interfaces:**
- Consumes: registry and layout-state from Tasks 1–2.
- Produces: `mount(root)`, `unmount()`, `enterEditMode()`, `exitEditMode()`, `addWidget(id)`, `hideWidget(id)`, `moveWidget(id, beforeId)`, `resizeWidget(id, size)`, `applyTemplate(name)`, `restoreStandard()`, `openLibrary()`, `closeLibrary()`.
- Events: `exporthub:dashboard-layoutchange` after a committed reorder/resize/add/hide/template operation; no event on every pointermove.

- [ ] **Step 1: Write failing interaction tests**

Tests must cover:
- entering edit mode adds controls only once;
- leaving edit mode removes edit controls without replacing business nodes;
- add/hide/move/resize update only layout state;
- invalid sizes are rejected by the widget's `allowedSizes`;
- template switch overwrites only personal layout state;
- `restoreStandard()` deletes only dashboard layout preference;
- pointer movement does not call `writeLayout()` until drop/commit;
- keyboard controls can move a widget up/down without drag;
- repeated `mount()` after `exporthub:rendered` is idempotent and does not duplicate controls.

- [ ] **Step 2: Run edit-mode tests and verify RED**

Run: `node --test test/rc1371-dashboard-edit-mode.test.mjs`

Expected: FAIL because interaction API is missing.

- [ ] **Step 3: Implement edit mode and library**

Use event delegation on one dashboard personalization root. Dragging may use native Pointer/Drag APIs, but state commits only at drop/end. On touch/smartphone expose deterministic move up/down controls. The library search filters registry metadata in-memory and must not fetch dashboard data.

Add optional quick-access widgets only as links to existing modules via `setView()` after `canView()` succeeds; do not reimplement target functions.

- [ ] **Step 4: Run interaction tests and dashboard regression tests**

Run:
```bash
node --test test/rc1371-dashboard-edit-mode.test.mjs \
  test/rc1044-dashboard-open-shipments.test.mjs \
  test/rc1045-dashboard-due-tasks.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add assets/rc1371-dashboard-personalization.js test/rc1371-dashboard-edit-mode.test.mjs
git commit -m "feat: add dashboard edit mode and widget library"
```

---

### Task 4: Responsive Grid, Theme-Kompatibilität und RC1306-Integration

**Files:**
- Create: `assets/rc1371-dashboard-personalization.css`
- Modify: `assets/rc1306-layout-engine.js`
- Create: `test/rc1371-dashboard-layout-integration.test.mjs`

**Interfaces:**
- Consumes: `window.ExportHUBDashboard1371`, `currentView()` and existing RC1306 design/layout lifecycle.
- Produces: dashboard ownership hook `ExportHUBDashboard1371.ownsLayout()` and theme-aware `applyTheme(mode)`/`remount()` behavior.
- DOM scope: only the active dashboard container receives `data-eh-dashboard-personalized="1"` and RC1371 CSS.

- [ ] **Step 1: Write failing integration/layout tests**

Tests must prove:
- RC1306 skips its generic dashboard re-parenting only when `currentView()==='dashboard'` and RC1371 reports ownership;
- non-dashboard views keep existing RC1306 behavior unchanged;
- existing functional nodes are never cloned;
- RC1371 grid maps S/M/L/XL to CSS grid spans rather than pixels;
- desktop supports the full grid, tablet reduced spans, smartphone one-column layout;
- no global selector changes classic or other non-dashboard pages;
- CSS contains no `transition: all` for dashboard drag/resize elements;
- switching `classic → modern → glass → neon → classic` can remount without duplicate cards or controls.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `node --test test/rc1371-dashboard-layout-integration.test.mjs`

Expected: FAIL because RC1371 CSS and RC1306 ownership hook are missing.

- [ ] **Step 3: Implement CSS and the minimal RC1306 hook**

RC1306 must remain the owner for every non-dashboard generic view and all shipment layouts. The hook must be a narrow guard, not a second dashboard renderer. RC1371 CSS must use existing ExportHUB/theme variables where available and theme-specific selectors under `html[data-eh-design] [data-eh-dashboard-personalized="1"]` only.

- [ ] **Step 4: Run integration plus existing RC1306 tests**

Run:
```bash
node --test test/rc1371-dashboard-layout-integration.test.mjs \
  test/rc1306-true-layout-redesign.test.mjs \
  test/rc1443-classic-layout-observer.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add assets/rc1371-dashboard-personalization.css assets/rc1306-layout-engine.js test/rc1371-dashboard-layout-integration.test.mjs
git commit -m "feat: integrate personalized dashboard with layout themes"
```

---

### Task 5: Vollständige I18n für Dashboard-Personalisierung

**Files:**
- Modify: `assets/i18n/de.json`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/pl.json`
- Modify: `assets/i18n/es.json`
- Modify: `assets/i18n/fr.json`
- Modify: `assets/i18n/it.json`
- Modify: `assets/rc1371-dashboard-personalization.js`
- Create: `test/rc1371-dashboard-i18n.test.mjs`

**Interfaces:**
- Consumes: existing `window.ExportHUBI18n.t(key)`.
- Produces: `dashboard.personalize.*` translation namespace for editor, library, templates, sizes, categories, statuses, tooltips and accessibility labels.

- [ ] **Step 1: Write failing I18n contract test**

Define one canonical key list including at least:
`edit`, `done`, `addWidget`, `hideWidget`, `moveUp`, `moveDown`, `size`, `sizeS`, `sizeM`, `sizeL`, `sizeXL`, `restoreStandard`, `searchWidgets`, `template`, `templateStandard`, `templateManagement`, `templateOperative`, `templateCompact`, `templateAnalysis`, category keys and status text keys.

Assert every canonical key exists in all six locale files and the runtime uses translation keys rather than hard-coded German UI copy.

- [ ] **Step 2: Run I18n test and verify RED**

Run: `node --test test/rc1371-dashboard-i18n.test.mjs`

Expected: FAIL due to missing keys.

- [ ] **Step 3: Add translations and wire runtime labels**

All editor/library labels, button titles, ARIA labels, empty states and status text must resolve through `ExportHUBI18n.t()` with a safe key fallback.

- [ ] **Step 4: Run dashboard I18n and full I18n verification**

Run:
```bash
node --test test/rc1371-dashboard-i18n.test.mjs
npm run verify:i18n
```

Expected: PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add assets/i18n/*.json assets/rc1371-dashboard-personalization.js test/rc1371-dashboard-i18n.test.mjs
git commit -m "feat: localize dashboard personalization"
```

---

### Task 6: RC1112 Build-/Asset-Vertrag

**Files:**
- Modify: `.github/rc1112/build-three-env.mjs`
- Create: `test/rc1371-dashboard-build-contract.test.mjs`

**Interfaces:**
- Consumes: current RC1112 `injectDeferredRuntimeInHead()` and asset-copy contract.
- Produces: exactly one RC1371 stylesheet and one RC1371 deferred script in `index.html`, `TESTVERSION.html` and `demo.html`; both assets copied into every built environment.

- [ ] **Step 1: Write failing build-contract tests**

Assert:
- dedicated style/script tag constants exist;
- tags use unique IDs;
- dashboard runtime loads before RC1306 generic layout processing can claim the dashboard;
- build patch is idempotent and injects each tag exactly once;
- asset copy list contains both RC1371 files;
- all three environments are patched;
- visible release/version marker is not silently changed by this task.

- [ ] **Step 2: Run build-contract test and verify RED**

Run: `node --test test/rc1371-dashboard-build-contract.test.mjs`

Expected: FAIL because RC1112 does not ship RC1371 assets yet.

- [ ] **Step 3: Add RC1371 injection/copy contract**

Use the existing RC1112 injection helper and preserve the current release-version mechanism. Do not inline the dashboard runtime into `index.html`.

- [ ] **Step 4: Run contract test and execute the real build**

Run:
```bash
node --test test/rc1371-dashboard-build-contract.test.mjs
node .github/rc1112/build-three-env.mjs
```

Expected: both commands exit 0; generated environments contain exactly one RC1371 CSS/script reference each.

- [ ] **Step 5: Commit**

```bash
git add .github/rc1112/build-three-env.mjs test/rc1371-dashboard-build-contract.test.mjs
git commit -m "build: ship dashboard personalization runtime"
```

---

### Task 7: Browser-/Responsive-/Regression-Gate

**Files:**
- Create: `e2e/specs/rc1371-dashboard-personalization.spec.mjs`
- Modify: `.github/workflows/rc1306-layout-browser.yml`

**Interfaces:**
- Consumes: `appEntry`, `waitReady`, `openExportHubView`, `assertNoHorizontalOverflow`, runtime guards from `e2e/helpers/exporthub-browser.mjs`; RC1371 public runtime API.
- Produces: browser coverage for current dashboard, persistence interactions and all five configured Playwright viewport projects.

- [ ] **Step 1: Write failing Playwright scenarios**

Scenarios:
1. dashboard opens with all existing system widgets still present;
2. edit mode opens once and exposes add/resize/reorder controls;
3. move + resize + reload preserves the same personal layout;
4. second simulated user identity does not inherit first user's layout;
5. permission-denied widget cannot be enabled from library;
6. standard restore returns to default ordering without altering dashboard data;
7. theme cycle `classic/modern/glass/neon/classic` has no duplicate nodes;
8. mobile uses safe move controls and no horizontal page overflow;
9. hidden widget is not duplicated or re-created by layout interaction;
10. dashboard KPI/action click continues to open the existing underlying detail/navigation path.

- [ ] **Step 2: Run one desktop project and verify RED**

Run: `npx playwright test e2e/specs/rc1371-dashboard-personalization.spec.mjs --project=desktop`

Expected: FAIL because browser integration is not yet complete or workflow does not include the new spec.

- [ ] **Step 3: Complete browser hooks only as required by failing scenarios**

Do not add new business data adapters. Fix only mount lifecycle, accessibility hooks, deterministic test selectors and interaction issues exposed by the browser tests.

- [ ] **Step 4: Extend the existing layout-browser workflow**

Add RC1371 JS/CSS, RC1306 integration, locale files and the new spec to the workflow paths. Run the RC1371 spec on `mobile-small`, `mobile-standard`, `tablet`, `laptop`, and `desktop` just as RC1306 already validates layout viewports.

- [ ] **Step 5: Run all five viewport projects**

Run:
```bash
for p in mobile-small mobile-standard tablet laptop desktop; do
  npx playwright test e2e/specs/rc1371-dashboard-personalization.spec.mjs --project="$p" || exit 1
done
```

Expected: every project PASS, no horizontal overflow, no runtime guard errors.

- [ ] **Step 6: Commit**

```bash
git add e2e/specs/rc1371-dashboard-personalization.spec.mjs .github/workflows/rc1306-layout-browser.yml assets/rc1371-dashboard-personalization.js
git commit -m "test: gate personalized dashboard across viewports"
```

---

### Task 8: Vollständige Release-Regression und Abnahme

**Files:**
- Modify only if a failing test demonstrates an RC1371 regression; otherwise no product-file change.

**Interfaces:**
- Consumes: complete branch implementation from Tasks 1–7.
- Produces: verified branch evidence only; no production claim.

- [ ] **Step 1: Run focused dashboard tests**

Run:
```bash
node --test \
  test/rc1371-dashboard-personalization-state.test.mjs \
  test/rc1371-dashboard-widget-registry.test.mjs \
  test/rc1371-dashboard-edit-mode.test.mjs \
  test/rc1371-dashboard-layout-integration.test.mjs \
  test/rc1371-dashboard-i18n.test.mjs \
  test/rc1371-dashboard-build-contract.test.mjs \
  test/rc1044-dashboard-open-shipments.test.mjs \
  test/rc1045-dashboard-due-tasks.test.mjs \
  test/rc1306-true-layout-redesign.test.mjs \
  test/rc1443-classic-layout-observer.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 2: Run full Node release verification**

Run: `npm run verify:release`

Expected: exit 0. Any unrelated red test must be named and investigated before merge; do not report the branch as green while the suite is red.

- [ ] **Step 3: Run full I18n verification**

Run: `npm run verify:i18n`

Expected: exit 0.

- [ ] **Step 4: Run the current RC1112 three-environment build**

Run: `node .github/rc1112/build-three-env.mjs`

Expected: exit 0 with RC1371 assets present in all generated environments and no release-contract mismatch.

- [ ] **Step 5: Run complete RC1371 browser matrix**

Run the five commands from Task 7 again against the freshly generated environment.

Expected: PASS in all projects.

- [ ] **Step 6: Compare branch against base for scope**

Review diff and confirm changes are limited to:
- RC1371 dashboard JS/CSS;
- narrow RC1306 dashboard-ownership hook;
- six locale files;
- RC1112 build contract;
- RC1371 tests/E2E/workflow;
- approved docs/spec/plan.

No shipment/status/task business logic should change.

- [ ] **Step 7: Final branch review before merge**

Verify acceptance criteria from the spec one by one. Record any remaining issue as open; do not merge or claim production success until all required checks are green.

- [ ] **Step 8: Commit only test-driven follow-up fixes, if any**

Use a focused message such as:

```bash
git commit -m "fix: close dashboard personalization regressions"
```

Do not create an empty completion commit.
