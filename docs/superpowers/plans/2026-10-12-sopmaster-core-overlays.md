# SOPMaster Core & Customer Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing ExportHUB SOP model with one normalized step contract, versioned customer overlays and context resolution without replacing the existing 24 active workflows or their history.

**Architecture:** Keep `isoSops` as the persistence source. Customer overlays are normal versioned SOP documents with `type:'customer'`, `customerId` and `baseProcessSop`; process SOPs remain canonical. A dedicated normalizer and overlay resolver produce the effective SOP used later by image, tour, training and exam layers.

**Tech Stack:** Browser JavaScript/IIFE globals, Node 20 `node:test`, existing `ExportHubIsoSopModel`, existing RC1016/RC1018 SOP catalog.

**Spec:** `docs/superpowers/specs/2026-10-12-sopmaster-training-tour-system-design.md`

## Global Constraints

- Do not replace `ExportHubIsoSopModel`, `ExportHubIsoSopCatalog` or the 24 active RC1016 workflows.
- Preserve every stored `versions` entry and `auditTrail` entry.
- New fields default safely to disabled/empty values.
- Readers may consume only released overlays; editors/admins may inspect drafts.
- An invalid or ambiguous overlay fails closed and must not silently change a process.
- No productive shipment, QR, ABD, pickup, POD, Avis, mail, print, pallet or archive handler is modified in this package.
- No new npm dependency.

## Review Focus

- Legacy SOPs with only `sections.steps[].text` must normalize without mutating stored data.
- Duplicate step IDs must fail validation before release.
- Overlay references to missing base SOPs or missing step IDs must produce an explicit conflict.
- More than one released overlay for the same `customerId + baseProcessSop` must not be chosen arbitrarily.
- A reader without edit rights must never receive draft overlay content.

---

### Task 1: Unified Step Contract

**Files:**
- Create: `assets/sop/rc1500-sop-step-contract.js`
- Create: `test/rc1500-sop-step-contract.test.mjs`

**Interfaces:**
- Consumes: legacy step strings/objects from `sections.steps`.
- Produces: `ExportHubSopStepContract.normalizeStep(step,index)`, `normalizeSteps(steps)`, `validateSteps(steps)`.

- [ ] **Step 1: Write failing tests** for legacy string steps, legacy `{id,text}` steps, full structured steps, safe defaults and duplicate IDs.
- [ ] **Step 2: Run** `node --test test/rc1500-sop-step-contract.test.mjs` and verify RED because the global API does not exist.
- [ ] **Step 3: Implement** the three exported functions. Required defaults: `tour.enabled=false`, `training.enabled=false`, `exam.relevant=false`, arrays for checks/warnings/commonErrors/troubleshooting/visuals, deterministic `step-N` fallback IDs.
- [ ] **Step 4: Run** the test and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): add unified step contract`.

### Task 2: Extend Existing SOP Model Safely

**Files:**
- Modify: `assets/sop/rc1007-sop-model.js`
- Modify: `test/rc1007-sop-workflow.test.mjs`
- Create: `test/rc1500-sop-model-migration.test.mjs`

**Interfaces:**
- Consumes: `ExportHubSopStepContract` from Task 1.
- Produces: existing `ExportHubIsoSopModel` plus `normalizeDocument(document)` and stricter release validation.

- [ ] **Step 1: Add RED tests** proving existing version/audit history is byte-equivalent after normalization, new defaults are present, and duplicate step IDs reject release.
- [ ] **Step 2: Run** both SOP model tests and verify only the new assertions fail.
- [ ] **Step 3: Implement** normalization as a cloned view; do not rewrite existing historical versions. Add defaults `type:'process'`, `overlays:[]`, `tourConfig:{enabled:false}`, `trainingConfig:{enabled:false}`, `examConfig:{enabled:false}`.
- [ ] **Step 4: Run** `node --test test/rc1007-sop-workflow.test.mjs test/rc1500-sop-model-migration.test.mjs` and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): migrate SOP documents without losing history`.

### Task 3: Customer Overlay Resolver

**Files:**
- Create: `assets/sop/rc1500-sop-overlay.js`
- Create: `test/rc1500-sop-overlay.test.mjs`

**Interfaces:**
- Consumes: normalized process SOP + `isoSops` customer documents.
- Produces: `ExportHubSopOverlay.resolve({documents,baseSopNumber,customerId,rights}) -> {ok,document,overlay,conflicts}`.

- [ ] **Step 1: Write RED tests** for add-step, skip-step, warning/check enrichment, missing base, missing target step, draft overlay visibility and duplicate released overlays.
- [ ] **Step 2: Run** the overlay test and verify RED.
- [ ] **Step 3: Implement** deterministic merge rules: process SOP first; one released customer overlay second; additions retain customer-origin metadata; silent destructive replacement is forbidden.
- [ ] **Step 4: Run** the test and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): add versioned customer overlays`.

### Task 4: Context Resolver

**Files:**
- Create: `assets/sop/rc1500-sop-context.js`
- Create: `test/rc1500-sop-context.test.mjs`

**Interfaces:**
- Consumes: `{view,action,customerId,shipmentId,role}`, catalog documents and overlay resolver.
- Produces: `ExportHubSopContext.resolve(context,{documents,rights}) -> {matches,primary,effective}`.

- [ ] **Step 1: Write RED tests** for shipment/ABD context, customer overlay preference, no-match result, reader rights and role restriction.
- [ ] **Step 2: Run** and verify RED.
- [ ] **Step 3: Implement** explicit metadata matching only; no DOM crawling or fuzzy button inference.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): resolve SOPs from page and customer context`.

### Task 5: Core Regression Gate

**Files:**
- Modify: `test/rc1016-sop-consolidation.test.mjs`
- Modify: `test/rc1018-sop-image-coverage-complete.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: proof that 24 active SOPs, 75 legacy documents and RC1018 images remain intact.

- [ ] **Step 1: Add assertions** that all 24 canonical process SOPs normalize successfully and no existing screenshot mapping is lost.
- [ ] **Step 2: Run** `node --test test/rc1007-sop-workflow.test.mjs test/rc1016-sop-consolidation.test.mjs test/rc1018-sop-image-coverage-complete.test.mjs test/rc1500-sop-*.test.mjs`.
- [ ] **Step 3: Fix only SOP-core regressions** until all tests pass; do not weaken historical assertions.
- [ ] **Step 4: Run** `npm test` and expect zero failures.
- [ ] **Step 5: Commit** `test(sop): protect legacy catalog during SOPMaster migration`.
