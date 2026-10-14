# SOPMaster Coverage, Integration & Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit SOP coverage reporting, integrate all SOPMaster modules into ExportHUB’s current three-environment build and release the feature only after full SOP, browser, TESTSERVICE and protected core-process regression gates are green.

**Architecture:** An explicit function registry describes which ExportHUB views/actions require a process SOP, image, tour or exam. A coverage scanner compares that registry with released effective SOP metadata and renders red/yellow/green/blue/purple status plus a percentage. Integration is performed on top of the current release builder after rebasing, followed by Demo, TESTSERVICE and only then Production verification.

**Tech Stack:** Browser JavaScript/IIFE globals, Node 20 `node:test`, Playwright E2E, existing three-environment build/release workflow.

**Spec:** `docs/superpowers/specs/2026-10-12-sopmaster-training-tour-system-design.md`

## Global Constraints

- Coverage uses an explicit registry; no blind DOM crawling and no automatic inference that every button is a business process.
- Only released process/customer content counts as complete for normal users.
- Optional functions are not counted as missing unless registry metadata marks them required.
- A customer-specific required rule without a released overlay is visible as incomplete.
- RC/version numbers in this plan are provisional; implementation rebases on latest `main` and reserves the next available RC range before code changes.
- Build integration must use the current canonical three-environment builder at execution time, not resurrect an obsolete RC builder.
- Production is not attempted until unit/contract tests, browser E2E and TESTSERVICE smoke are all green on the exact release SHA.
- Existing shipment/save/QR/status/ABD/pickup/POD/print/Avis/login tests may not be weakened to make SOPMaster green.

## Review Focus

- Registry points to a retired/archived SOP: scanner must report missing/incomplete, not green.
- Required `stepId` or `data-tour-key` no longer exists after a UI change: scanner must surface a broken mapping.
- Optional process is absent: coverage denominator must remain correct.
- Required screenshot file path exists in metadata but file is missing from build: coverage/release gate must fail.
- Production and TESTSERVICE load different SOPMaster assets/manifest versions: release must fail closed.

---

### Task 1: Explicit Function Registry

**Files:**
- Create: `assets/sop/rc1504-sop-function-registry.js`
- Create: `test/rc1504-sop-function-registry.test.mjs`

**Interfaces:**
- Produces: `ExportHubSopFunctionRegistry.entries` with `{id,view,action,sopNumber,stepId,targetKey,requiredImage,requiredTour,requiredExam,required,customerScoped}` and `get(id)`.

- [ ] **Step 1: Write RED tests** for unique IDs, valid required fields, no duplicate `view+action` required mappings and known pilot SOP/step references.
- [ ] **Step 2: Run** `node --test test/rc1504-sop-function-registry.test.mjs`; expect RED.
- [ ] **Step 3: Implement** registry entries beginning with all existing 24 process areas and the pilot deep flows; explicitly mark optional capabilities.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): register SOP-required ExportHUB functions`.

### Task 2: Coverage Scanner

**Files:**
- Create: `assets/sop/rc1504-sop-coverage.js`
- Create: `test/rc1504-sop-coverage.test.mjs`

**Interfaces:**
- Consumes: registry, released SOP documents, overlays, visuals and stable target metadata.
- Produces: `ExportHubSopCoverage.scan({registry,documents,customerId}) -> {items,counts,percentage}`.

**Status Contract:** `missing='red'`, `incomplete='yellow'`, `complete='green'`, `tour='blue'`, `image='purple'` with independent capability flags so a process can be green and also blue/purple.

- [ ] **Step 1: Write RED tests** for missing SOP, missing step, missing image file/metadata, missing target, exam validation gap, archived document and customer-overlay gap.
- [ ] **Step 2: Run** and verify RED.
- [ ] **Step 3: Implement** deterministic scanner and denominator: required registry items only; no DOM crawl.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): calculate SOP coverage and gaps`.

### Task 3: Coverage/Admin UI

**Files:**
- Create: `assets/sop/rc1504-sop-coverage-ui.js`
- Create: `assets/sop/rc1504-sop-coverage.css`
- Modify: `assets/sop/rc1007-sop-ui.js`
- Create: `test/rc1504-sop-coverage-ui.test.mjs`

**Interfaces:**
- Consumes: coverage result.
- Produces: dashboard with percentage, counts, filters and links to affected SOP/step/editor.

- [ ] **Step 1: RED-test** labels `SOP fehlt`, `SOP unvollständig`, `SOP vollständig`, `interaktive Tour vorhanden`, `Bildanleitung vorhanden`, percentage and non-color text/icon status.
- [ ] **Step 2: Implement** coverage panel in SOP admin workspace with filters for area/status/customer/capability.
- [ ] **Step 3: Add direct navigation** from an issue row to SOP/step or customer overlay editor.
- [ ] **Step 4: Run** UI/accessibility tests and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): show actionable SOP coverage dashboard`.

### Task 4: Full SOPMaster Browser Suite

**Files:**
- Create: `e2e/specs/sopmaster-full.spec.mjs`
- Reuse: `e2e/specs/sopmaster-tour.spec.mjs`, `sopmaster-visual-editor.spec.mjs`, `sopmaster-training-exam.spec.mjs`

**Interfaces:**
- Consumes: all prior SOPMaster packages.
- Produces: end-to-end proof across SOP, image, tour, training, exam, progress, overlay and coverage.

- [ ] **Step 1: Add one consolidated happy-path E2E** for SOP-EH-060: context lookup → customer overlay → image guide → guided tour → training → exam → progress → coverage green/blue/purple.
- [ ] **Step 2: Add failure E2E** for missing target/image and verify admin coverage goes yellow/red without breaking normal SOP rendering.
- [ ] **Step 3: Run** `desktop`, `mobile-standard` and `tablet`; expect PASS.
- [ ] **Step 4: Run** `npm run test:accessibility`; expect PASS.
- [ ] **Step 5: Commit** `test(sop): add full SOPMaster browser coverage`.

### Task 5: Rebase and Three-Environment Build Integration

**Files:**
- Create/Modify after rebase: `.github/<next-rc>/build-three-env.mjs`
- Create: `test/<next-rc>-sopmaster-build.test.mjs`
- Create in build output: `<next-rc>-manifest.json`

**Interfaces:**
- Consumes: latest canonical builder and all SOPMaster assets.
- Produces: identical SOPMaster module set in `index.html`, `TESTVERSION.html`, `demo.html` with manifest identity.

- [ ] **Step 1: Rebase feature implementation branch onto latest `main`** and reserve next non-conflicting RC; update only RC-specific filenames/markers, not public interfaces defined by plans.
- [ ] **Step 2: RED-test** all three HTML outputs contain exactly one load of each SOPMaster runtime/CSS asset in dependency order.
- [ ] **Step 3: Implement current-builder integration** by extending the latest three-environment build chain; do not fork production logic unnecessarily.
- [ ] **Step 4: Assert manifest** contains SOPMaster asset versions, `activeWorkflows:24`, coverage registry release and training environment policy.
- [ ] **Step 5: Run build test + `npm test`** and expect PASS.
- [ ] **Step 6: Commit** `build(sop): integrate SOPMaster into three environments`.

### Task 6: Protected Core-Process Regression Gate

**Files:**
- Modify only current release-gate test/workflow files selected after rebase.
- Do not modify product tests solely to accommodate SOPMaster.

**Interfaces:**
- Consumes: current ExportHUB release suite.
- Produces: explicit evidence SOPMaster did not regress protected workflows.

- [ ] **Step 1: Run existing core suites** for shipment create/save, reload/persistence, QR activation/status persistence, ABD, pickup, POD, print, Avis, login/navigation and state merge.
- [ ] **Step 2: If any protected test fails, fix implementation code**; do not weaken expected behavior.
- [ ] **Step 3: Run** `npm run verify:release` and the full Playwright smoke suite used by the current release branch; expect PASS.
- [ ] **Step 4: Record exact SHA and test commands/results** in release evidence.
- [ ] **Step 5: Commit** `test(sop): gate ExportHUB core flows after SOPMaster` if gate configuration/evidence files changed.

### Task 7: TESTSERVICE Before Production

**Files:**
- Modify only current deployment workflow/gate selected after rebase.

**Interfaces:**
- Consumes: exact release SHA from Task 6.
- Produces: TESTSERVICE evidence for same SHA and asset manifest.

- [ ] **Step 1: Deploy exact candidate SHA to TESTSERVICE** through the current approved workflow.
- [ ] **Step 2: Run live smoke**: SOP overview/document, customer overlay, real user-driven tour, image zoom, Demo-training launch, exam shell, progress read/write and coverage dashboard.
- [ ] **Step 3: Verify core smoke**: save/reload/QR/status/ABD/pickup/POD/print/Avis/login/navigation on TESTSERVICE where supported.
- [ ] **Step 4: Verify TESTSERVICE manifest/hash** matches release candidate; no stale SOPMaster asset allowed.
- [ ] **Step 5: Mark candidate release-ready only if every mandatory test is green.**

### Task 8: Production Release and Final Acceptance

**Files:**
- No feature-code changes in this task; use current release workflow and release evidence.

**Interfaces:**
- Consumes: green TESTSERVICE candidate.
- Produces: production verification and final SOPMaster status report.

- [ ] **Step 1: Promote the exact green candidate** via the normal Production workflow; no ad-hoc direct file deployment.
- [ ] **Step 2: Verify production manifest/build SHA** equals the approved candidate.
- [ ] **Step 3: Run production-safe smoke** for SOP rendering/context/tour entry/image/coverage and existing production-safe core checks.
- [ ] **Step 4: Produce final report** with SOP-system progress bar, customer/process/image/tour status, missing SOPs, fixed defects, Before/After and completion percentage.
- [ ] **Step 5: Do not report 100%** if any required registry item, release gate, TESTSERVICE check or production smoke remains open.
