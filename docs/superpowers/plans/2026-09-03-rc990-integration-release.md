# RC990 Integration & TESTSERVICE Release Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die RC990-Arbeitspakete zusammenführen, vollständig regressionsprüfen und genau einmal in den TESTSERVICE deployen, ohne Produktion direkt zu verändern.

**Architecture:** Release Center, Design/Layout und Rendering/Navigation werden unabhängig testbar implementiert, danach auf demselben RC990-Stand integriert. Der bestehende TESTSERVICE-Deployworkflow bleibt maßgeblich; vor Live-Bestätigung müssen Node-Tests, Renderintegrität, API-Smoke, Runtime/Auth/Storage/State-Probes und HTTP-200-Versionschecks grün sein.

**Tech Stack:** Node.js >=20, `node:test`, GitHub Actions, Azure Static Web Apps CLI/runtime, HTML/CSS/Vanilla JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-03-rc990-large-ux-design.md`

## Global Constraints
- Ein gemeinsames RC990-Release; kein direkter Produktionsdeploy.
- `/test` und `/TESTVERSION.html` müssen RC990 mit HTTP 200 liefern.
- Auth/API-Erreichbarkeit muss nach Deploy geprüft werden.
- QR/PIN, Kunden-Avis, CMR/PDF-Fachlogik, Versandkostenformeln, ABD-Regeln und Statuskette werden nicht fachlich umgebaut.
- Keine D365-Integration.
- Temporäre Apply-/Audit-Workflows dürfen nicht als dauerhafte aktive Produktionslogik zurückbleiben.

---

### Task 1: RC990-Gesamtvertrag ergänzen

**Files:**
- Create: `test/rc990-integration.test.mjs`
- Read: `test/rc990-release-center.test.mjs`, `test/rc990-design-system.test.mjs`, `test/rc990-render-navigation.test.mjs`
- Modify later: `TESTVERSION.html`

**Interfaces:**
- Produces: release-wide assertions for version, protected subsystem markers and absence of duplicate RC990 layers.

- [ ] **Step 1: Integrationstest schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('TESTVERSION.html','utf8');
const build=Number((html.match(/version:'RC(\d+)'/)||[])[1]||0);

test('RC990: integrierter Build ist RC990 oder höher',()=>assert.ok(build>=990));

test('RC990: jeder kanonische RC990-Layer existiert nur einmal',()=>{
  assert.equal((html.match(/id=["']rc990-design-system["']/g)||[]).length,1);
  assert.equal((html.match(/function\s+rc990CaptureReleaseViewport\s*\(/g)||[]).length,1);
  assert.equal((html.match(/function\s+rc990CaptureUiState\s*\(/g)||[]).length,1);
});

test('RC990: geschützte Fachbereiche werden nicht als neue RC990-Subsysteme dupliziert',()=>{
  assert.doesNotMatch(html,/rc990[^\n]{0,180}(?:qrToken|pickupPin|gate41Rate|cmrGenerator|abdRule)/i);
});
```

- [ ] **Step 2: RED vor finaler Integration ausführen**

Run: `node --test test/rc990-integration.test.mjs`

Expected: FAIL until RC990 implementation/version is present.

- [ ] **Step 3: Commit**

```bash
git add test/rc990-integration.test.mjs
git commit -m "RC990 RED: Gesamtintegration absichern"
```

### Task 2: Versionsmarker auf RC990 setzen und alle Teilverträge gemeinsam ausführen

**Files:**
- Modify: `TESTVERSION.html` Build source near the canonical `var BUILD=Object.freeze(...)` block (~line 311 on RC980 baseline)
- Tests: all RC971–RC990 tests

**Interfaces:**
- Produces BUILD `{version:'RC990', cache:'990', loginReturn:'/TESTVERSION.html?v=990'}`.

- [ ] **Step 1: Version exakt setzen**

```js
var BUILD=Object.freeze({version:'RC990',cache:'990',loginReturn:'/TESTVERSION.html?v=990'});
```

Do not change the production `RELEASE` marker as part of TESTSERVICE development.

- [ ] **Step 2: Alle RC971–RC990 Regressionen ausführen**

Run:

```bash
node --test \
  test/rc971-global-form-field-standard.test.mjs \
  test/rc972-field-exception-audit.test.mjs \
  test/rc973-long-text-autogrow.test.mjs \
  test/rc975-global-render-integrity.test.mjs \
  test/rc976-render-fallback-recovery.test.mjs \
  test/rc977-colli-typography.test.mjs \
  test/rc978-shipment-fluid-layout.test.mjs \
  test/rc979-shipment-inner-density.test.mjs \
  test/rc980-colli-row-stability.test.mjs \
  test/rc990-release-center.test.mjs \
  test/rc990-design-system.test.mjs \
  test/rc990-render-navigation.test.mjs \
  test/rc990-integration.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 3: Gesamtes Repository-Testscript ausführen**

Run: `npm test`

Expected: PASS, 0 failures.

- [ ] **Step 4: Whitespace/diff sanity**

Run: `git diff --check`

Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add TESTVERSION.html test/rc990-*.test.mjs
git commit -m "RC990: Großupdate integrieren"
```

### Task 3: Diff-Sicherheitsreview gegen geschützte Bereiche

**Files:**
- Review: `TESTVERSION.html`, tests, any temporary workflow/helper files created during implementation
- Compare baseline: RC980 feature commit `641c8b771cc19881a82bdf2dd10a790b19fe8b6e` or the exact RC980 main baseline resolved at execution start.

**Interfaces:**
- Produces no runtime interface; this is a release gate.

- [ ] **Step 1: Geänderte Dateien auflisten**

Run: `git diff --name-only <RC980_BASELINE>..HEAD`

Expected: implementation is limited to planned RC990 files, tests, spec/plan docs and deliberate TESTSERVICE support files.

- [ ] **Step 2: Protected-path review**

Search the diff for changes around QR/PIN, customers avis, CMR/PDF, Gate41/UPS formulas, ABD/status business rules and production config. Any such code change must be reverted unless it is a proven no-semantic-change selector/formatting dependency required by RC990.

- [ ] **Step 3: No naive structural insertion**

Verify no implementation workflow/script uses unconstrained `rfind('</head>')` or `rfind('</body>')` on `TESTVERSION.html`. If structural insertion is required, use parser-aware location or search `</head>` before the structural `<body>` position with assertions.

- [ ] **Step 4: Remove temporary apply/audit artifacts not needed after merge**

Delete temporary one-shot workflows/scripts after their output is committed and verified. Keep permanent RC990 regression tests.

- [ ] **Step 5: Rerun full tests after cleanup**

Run: `npm test && git diff --check`

Expected: PASS/exit 0.

### Task 4: Independent committed-state verification

**Files:**
- Create or update a permanent/temporary GitHub Actions regression workflow only if needed for an independent clean checkout.
- Verify exact committed `main`/RC990 candidate SHA.

**Interfaces:**
- Produces clean-checkout evidence, not runtime code.

- [ ] **Step 1: Fresh checkout regression workflow runs `npm test` plus explicit RC971–RC990 list**

The workflow must checkout the exact candidate commit and run Node >=20.

- [ ] **Step 2: Confirm workflow result**

Expected: every test passes, 0 fail; logs show RC990-specific tests executed.

- [ ] **Step 3: Verify commit diff**

Fetch the candidate commit/compare output and confirm the runtime change set matches the plan.

### Task 5: TESTSERVICE deploy exactly once for the final candidate

**Files:**
- Use existing TESTSERVICE workflow: `.github/workflows/exporthub-testservice-final-artifact-fix.yml` (or the current active equivalent discovered at execution time)
- Test config: `staticwebapp.testservice.config.json`
- Do not modify production `staticwebapp.config.json` merely to trigger TESTSERVICE.

**Interfaces:**
- Produces live TESTSERVICE RC990 at stable host.

- [ ] **Step 1: Trigger TESTSERVICE using the established non-production trigger mechanism**

Use a harmless TESTSERVICE-only config/workflow trigger if necessary. Do not change production app files just to force a run.

- [ ] **Step 2: Preflight must identify RC990**

Expected log evidence includes `erkannte Testversion = RC990`, valid JSON config, Node 20 API runtime and JS syntax checks.

- [ ] **Step 3: API runtime smoke must pass**

Expected: Node v20.x; required API modules load; `@azure/storage-blob` dependency resolves; auth probe runtimeReady=true.

- [ ] **Step 4: Azure deploy must succeed**

Expected: SWA CLI deployment returns the named `testservice` host.

- [ ] **Step 5: Live probes must pass**

Expected:
- `/TESTVERSION.html?...` → HTTP 200, RC990
- `/test?...` → HTTP 200, RC990
- `/api/exporthub-auth-probe` → HTTP 200 JSON, runtime ready on Node 20.x
- auth bootstrap/status → HTTP 200 and storage reachable
- state route → HTTP 200/400/401/403 accepted as route-reachable; not 404/5xx

- [ ] **Step 6: Final evidence capture**

Record final candidate SHA, deploy run ID/job ID, complete regression count and stable TESTSERVICE URL.

### Task 6: Completion gate

**Files:**
- No new runtime file required.

- [ ] **Step 1:** Confirm Release Center position retention contract passes.
- [ ] **Step 2:** Confirm design-system contract passes and RC977–RC980 remain green.
- [ ] **Step 3:** Confirm render/navigation contract passes and RC975/RC976 remain green.
- [ ] **Step 4:** Confirm full `npm test` has zero failures on the committed candidate.
- [ ] **Step 5:** Confirm TESTSERVICE direct and `/test` both serve RC990 HTTP 200.
- [ ] **Step 6:** Confirm production files were not directly promoted; production remains controlled by Release Center.
