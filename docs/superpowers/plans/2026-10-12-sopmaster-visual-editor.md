# SOPMaster Visual Guide & Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend ExportHUB’s existing real SOP screenshots into step-level visual guides and provide an admin editor for steps, customer overlays, screenshot assignments, annotations and stable tour targets.

**Architecture:** Reuse the RC1018 real-PNG screenshot pipeline and `stepId` association instead of replacing it. A visual contract validates screenshot metadata and annotations; the existing SOP UI renders zoomable annotated guides; a separate editor manages step order, images and tour-target selection while saving through the existing versioned SOP model.

**Tech Stack:** Browser JavaScript/IIFE globals, existing SOP UI/CSS, Playwright/Chromium screenshot generation, Node 20 `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-12-sopmaster-training-tour-system-design.md`

## Global Constraints

- Existing RC1018 screenshot files and mappings remain valid.
- Automatic/system screenshots are produced only from Demo/Training data, never from productive customer data.
- A missing image is explicit (`placeholder`/coverage warning); never synthesize a fake screenshot to make coverage green.
- Multiple images per step are supported.
- Visuals stay bound to stable `stepId` values.
- The editor modifies draft versions only; released versions remain immutable history.
- Admins must not have to hand-write CSS selectors for tour targets.
- No product action handler is changed by image/editor functionality.

## Review Focus

- Missing/broken PNG must render a readable fallback without crashing the SOP page.
- Visual referencing a removed/renamed `stepId` must be reported as orphaned, not silently moved.
- Multiple screenshots on one step must retain deterministic order.
- Target picker clicked on an element without `data-tour-key` must mark the step technically incomplete instead of storing a brittle selector.
- Image zoom/annotations must remain readable and closable on 360px mobile viewport and with keyboard-only navigation.

---

### Task 1: Visual Contract and Annotation Schema

**Files:**
- Create: `assets/sop/rc1502-sop-visuals.js`
- Create: `test/rc1502-sop-visuals.test.mjs`

**Interfaces:**
- Consumes: SOP document/step visuals.
- Produces: `ExportHubSopVisuals.normalize(visual)`, `validateForDocument(document)`, `visualsForStep(document,stepId)`.

- [ ] **Step 1: Write failing tests** for screenshot, placeholder, multiple visuals, annotations (`focus`, `arrow`, `marker`, `caption`, `crop`, `expectedResult`), orphaned `stepId`, missing `src` and deterministic ordering.
- [ ] **Step 2: Run** `node --test test/rc1502-sop-visuals.test.mjs` and verify RED because the API does not exist.
- [ ] **Step 3: Implement** normalization/validation without rewriting existing RC1018 visuals; missing optional annotation arrays default to `[]`.
- [ ] **Step 4: Run** the test and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): add visual guide contract`.

### Task 2: Zoomable Annotated Step Images

**Files:**
- Modify: `assets/sop/rc1007-sop-ui.js`
- Modify: `assets/sop/rc1007-sop.css`
- Create: `test/rc1502-sop-visual-ui.test.mjs`

**Interfaces:**
- Consumes: `ExportHubSopVisuals.visualsForStep`.
- Produces: visual DOM with zoom dialog/lightbox, annotation overlay and expected-result caption.

- [ ] **Step 1: Write RED UI-contract tests** for image/caption, annotation data attributes, zoom button, dialog semantics, keyboard close and fallback rendering.
- [ ] **Step 2: Run** the UI test and verify the new assertions fail while legacy SOP tests still pass.
- [ ] **Step 3: Implement** accessible zoom/annotation rendering; preserve print behavior and existing `<figure>` fallback behavior.
- [ ] **Step 4: Run** `node --test test/rc1007-sop-workflow.test.mjs test/rc1502-sop-visual-ui.test.mjs` and `npm run test:accessibility`; expect PASS.
- [ ] **Step 5: Commit** `feat(sop): render zoomable annotated guides`.

### Task 3: Safe Screenshot Manifest and Capture Pipeline

**Files:**
- Create: `browser/rc1502-sop-screenshots.mjs`
- Create: `assets/sop/rc1502-sop-screenshot-manifest.js`
- Create: `test/rc1502-sop-screenshot-manifest.test.mjs`
- Create/Update generated PNGs under: `assets/sop/screenshots/`

**Interfaces:**
- Consumes: Demo build, explicit screenshot manifest entries `{sopNumber,stepId,view,targetKey,file,caption}`.
- Produces: real PNGs and `ExportHubSopScreenshotManifest.entries`.

- [ ] **Step 1: Write RED tests** requiring every manifest entry to use `/assets/sop/screenshots/*.png`, reference an existing SOP/step and point to a real file after capture.
- [ ] **Step 2: Implement manifest** for the pilot flows first (SOP-EH-060 ABD plus SOP-handbook/editor), retaining RC1018 images as valid existing coverage.
- [ ] **Step 3: Implement Playwright capture** from `demo.html`; assert demo environment before writing any PNG.
- [ ] **Step 4: Run capture and tests**; verify no Data-URI SVGs and no duplicate image hashes for distinct required captures.
- [ ] **Step 5: Commit** `feat(sop): generate step-level demo screenshots`.

### Task 4: Draft Step and Customer-Overlay Editor

**Files:**
- Create: `assets/sop/rc1502-sop-editor.js`
- Create: `assets/sop/rc1502-sop-editor.css`
- Modify: `assets/sop/rc1007-sop-ui.js`
- Create: `test/rc1502-sop-editor.test.mjs`

**Interfaces:**
- Consumes: `ExportHubIsoSopModel`, `ExportHubSopStepContract`, `ExportHubSopOverlay`, `ExportHubSopVisuals`.
- Produces: `ExportHubSopEditor.createDraft`, `copyDocument`, `addStep`, `moveStep`, `removeStep`, `updateStep`, `createCustomerOverlay`, `assignVisual`.

- [ ] **Step 1: Write RED tests** for draft-only editing, add/move/delete, copy, overlay creation, image assignment and preservation of released version history.
- [ ] **Step 2: Run** editor tests and verify RED.
- [ ] **Step 3: Implement** immutable transforms returning updated document copies; route saving through the existing SOP state persistence path.
- [ ] **Step 4: Add editor UI** to the existing SOP admin workspace with explicit customer/process type, change reason and validation summary.
- [ ] **Step 5: Run** editor + legacy workflow tests; expect PASS.
- [ ] **Step 6: Commit** `feat(sop): add structured SOP and customer overlay editor`.

### Task 5: Tour Target Picker

**Files:**
- Modify: `assets/sop/rc1502-sop-editor.js`
- Modify: `assets/sop/rc1502-sop-editor.css`
- Modify: `test/rc1502-sop-editor.test.mjs`
- Create: `e2e/specs/sopmaster-target-picker.spec.mjs`

**Interfaces:**
- Consumes: `ExportHubSopTourTargets.find` from the tour plan.
- Produces: `ExportHubSopEditor.beginTargetPick(stepId)`, `cancelTargetPick()`, and saved `target.stableKey`.

- [ ] **Step 1: RED-test** target pick success and missing-key failure.
- [ ] **Step 2: Implement selection mode**: user clicks the actual element; editor reads only `data-tour-key`; selector is derived as `[data-tour-key="…"]`.
- [ ] **Step 3: Add a test-run action** that resolves the saved target and reports unique/missing/duplicate status.
- [ ] **Step 4: Run Playwright** for desktop and mobile-standard target picker; expect PASS.
- [ ] **Step 5: Commit** `feat(sop): select tour targets from the real UI`.

### Task 6: Visual/Editor Regression Gate

**Files:**
- Modify: `test/rc1018-sop-system-images.test.mjs`
- Modify: `test/rc1018-sop-image-coverage-complete.test.mjs`
- Create: `e2e/specs/sopmaster-visual-editor.spec.mjs`

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: proof that old RC1018 images remain valid while new step images/editor functions work.

- [ ] **Step 1: Extend existing image tests** to explicitly preserve all current RC1018 mappings/hashes as valid inputs.
- [ ] **Step 2: E2E** create draft → add/reorder step → assign screenshot → pick target → save draft → reload → verify draft data; released base remains unchanged.
- [ ] **Step 3: Run** desktop + mobile Playwright, SOP image tests, `npm run test:accessibility`, then `npm test`.
- [ ] **Step 4: Fix only visual/editor regressions** without loosening historical image assertions.
- [ ] **Step 5: Commit** `test(sop): gate visual guide and editor regressions`.
