# SOPMaster Interactive Tour Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guided SOP tour that highlights stable UI targets, requires the employee to perform the real action, and advances only after the defined resulting state is true.

**Architecture:** The engine consumes the normalized effective SOP from the core/overlay package. A validator owns all success conditions; the tour engine owns session state and event observation; a separate UI layer renders highlight, instruction, progress, pause/end controls and accessibility behavior. Productive handlers are observed, not replaced.

**Tech Stack:** Browser JavaScript/IIFE globals, DOM events/MutationObserver, Node 20 `node:test`, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-10-12-sopmaster-training-tour-system-design.md`

## Global Constraints

- Depends on `ExportHubSopStepContract`, `ExportHubSopOverlay` and `ExportHubSopContext` from the core plan.
- A click alone never proves completion when a result condition exists.
- Wrong actions never advance progress.
- Tour code must not invoke productive shipment/ABD/QR/etc. actions on behalf of the user.
- Stable `data-tour-key` is the supported target contract; selector fallback is temporary and reported as incomplete.
- Tour state must survive a normal in-app view rerender and explicit pause/resume.
- Keyboard focus and ARIA status are required.

## Review Focus

- Target element disappears/re-renders after navigation: engine must reacquire by `stableKey`.
- Duplicate `data-tour-key` values: step fails closed with a target ambiguity error.
- Correct click but failed state change: step stays open.
- Wrong navigation during a nonblocking step: show feedback but do not trap the user.
- Mobile target outside viewport: scroll safely and keep controls visible.

---

### Task 1: Tour Validator

**Files:**
- Create: `assets/sop/rc1501-sop-tour-validator.js`
- Create: `test/rc1501-sop-tour-validator.test.mjs`

**Interfaces:**
- Consumes: step checks + `{root,state,documents}` runtime context.
- Produces: `ExportHubSopTourValidator.evaluate(condition,context)` and `evaluateAll(conditions,context)` returning `{ok,reason,details}`.

- [ ] **Step 1: Write RED tests** for `element-visible`, `field-value`, `state`, `document-present`, missing key and unsupported condition.
- [ ] **Step 2: Run** `node --test test/rc1501-sop-tour-validator.test.mjs`; expect RED.
- [ ] **Step 3: Implement** explicit evaluators; unsupported/malformed conditions return `ok:false`, never implicit success.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): add fail-closed tour validation`.

### Task 2: Tour Session Engine

**Files:**
- Create: `assets/sop/rc1501-sop-tour-engine.js`
- Create: `test/rc1501-sop-tour-engine.test.mjs`

**Interfaces:**
- Consumes: effective SOP and validator.
- Produces: `ExportHubSopTour.start({sop,mode})`, `pause()`, `resume()`, `end()`, `current()`, `handleAction(eventDescriptor)`.

- [ ] **Step 1: Write RED tests** for start, correct action, wrong action, progress %, previous step, pause/resume and final completion.
- [ ] **Step 2: Run** and verify RED.
- [ ] **Step 3: Implement** in-memory session state with persisted lightweight resume marker; do not persist product data.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): add interactive tour session engine`.

### Task 3: Target Registry and Initial Stable Keys

**Files:**
- Create: `assets/sop/rc1501-sop-tour-targets.js`
- Modify: current generated-source/build patch owning SOP and shipment navigation (resolve exact current builder after rebase)
- Create: `test/rc1501-sop-tour-targets.test.mjs`

**Interfaces:**
- Produces: `ExportHubSopTourTargets.find(stableKey,root=document) -> {ok,element,error}`.

- [ ] **Step 1: RED-test** missing, unique and duplicate target keys.
- [ ] **Step 2: Add stable `data-tour-key` markers** for one complete pilot flow: SOP-Handbuch navigation and `SOP-EH-060` ABD entry path; markers must not alter event handlers.
- [ ] **Step 3: Run** target tests and existing shipment/ABD regression tests.
- [ ] **Step 4: Commit** `feat(sop): add stable tour target contract`.

### Task 4: Tour UI and Accessibility

**Files:**
- Create: `assets/sop/rc1501-sop-tour-ui.js`
- Create: `assets/sop/rc1501-sop-tour.css`
- Modify: `assets/sop/rc1007-sop-ui.js`
- Create: `test/rc1501-sop-tour-ui.test.mjs`

**Interfaces:**
- Consumes: `ExportHubSopTour.current()`.
- Produces: `ExportHubSopTourUi.mount(root)`, `render(session)`, `unmount()`.

- [ ] **Step 1: RED-test** rendered title, `Schritt X von Y`, percentage, instruction, tip, previous/pause/end buttons, ARIA live status and absence of automatic action buttons.
- [ ] **Step 2: Implement** overlay/highlight UI with safe scroll-to-target and responsive controls.
- [ ] **Step 3: Extend SOP document actions** with `▶ Anleitung starten` only when the effective SOP has enabled tour steps.
- [ ] **Step 4: Run** UI/unit tests and `npm run test:accessibility`.
- [ ] **Step 5: Commit** `feat(sop): render accessible guided tours`.

### Task 5: Browser E2E Pilot

**Files:**
- Create: `e2e/specs/sopmaster-tour.spec.mjs`
- Modify only if needed: `playwright.config.mjs`

**Interfaces:**
- Consumes: built demo/test environment and pilot SOP.
- Produces: browser proof for real user-driven actions.

- [ ] **Step 1: Write E2E**: open SOP → start tour → perform wrong action → verify no progress → perform right action → verify state condition → pause/resume → finish.
- [ ] **Step 2: Run** Playwright on `desktop` and `mobile-standard`; expect initial RED until runtime is integrated.
- [ ] **Step 3: Integrate tour assets into the current three-environment builder** using the existing RC1018-style injection pattern; demo must load the same tour code.
- [ ] **Step 4: Re-run** E2E on desktop/mobile and expect PASS.
- [ ] **Step 5: Run** `npm test` and commit `test(sop): verify interactive tour in browser`.
