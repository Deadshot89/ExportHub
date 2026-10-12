# SOPMaster Training, Exam & Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed training environment, guided practice, exam scoring and version-bound employee learning progress without allowing training to mutate productive ExportHUB data.

**Architecture:** Training is a mode over the same effective SOP/tour definition, but it is permitted only in ExportHUB’s isolated Demo environment and uses Demo state/simulated outcomes. Exam mode reuses action observation/validation while suppressing guidance. Progress is stored as a separate state collection keyed by user + SOP + version so historical attempts survive future SOP releases.

**Tech Stack:** Browser JavaScript/IIFE globals, existing Demo environment/state, Node 20 `node:test`, shared-state merge semantics, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-10-12-sopmaster-training-tour-system-design.md`

## Global Constraints

- `training` and `exam` sessions that can mutate workflow state are allowed only when the resolved data environment is exactly `demo`.
- Starting training from Production/TESTSERVICE may navigate/open the Demo training entry, but must never monkeypatch or intercept productive action handlers.
- Real mail, Avis, QR-token generation, pallet bookings, destructive deletes, external portal actions and irreversible productive mutations are never executed by training code.
- Simulated outcomes must be visibly marked as simulation.
- Exam uses the same effective SOP version and validation rules as guided mode; it does not maintain a second answer/process definition.
- Exam pass/fail is based on required steps/checks/final state; elapsed time is recorded but is not a default pass criterion.
- Productive permissions are never elevated by SOP/training roles.

## Review Focus

- User starts Training from Production: system must fail closed or route to Demo without executing the requested productive action first.
- Browser refresh during a Demo training session: safe session can resume without turning into productive mode.
- A newer SOP version is released: old progress remains historical and does not automatically mark the new version complete.
- Repeated exam attempts must append history rather than overwrite the previous attempt.
- Hidden exam guidance must not remain visible/accessible in rendered DOM as merely CSS-hidden solution text.

---

### Task 1: Training Environment Contract

**Files:**
- Create: `assets/sop/rc1503-sop-training.js`
- Create: `test/rc1503-sop-training.test.mjs`

**Interfaces:**
- Consumes: environment resolver/current application state, effective SOP and tour engine.
- Produces: `ExportHubSopTraining.canStart(context)`, `start({sop,context})`, `simulate(effect,payload)`, `end()`.

- [ ] **Step 1: Write RED tests** for `demo` success, `production` reject, `testservice` reject, missing environment reject and simulation of mail/Avis/QR/status/pallet/external portal effects.
- [ ] **Step 2: Run** `node --test test/rc1503-sop-training.test.mjs` and verify RED.
- [ ] **Step 3: Implement** environment gate and a fixed allowlist of simulation adapters; unknown side effects fail closed.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): enforce demo-only training sandbox`.

### Task 2: Training UI and Guided Practice

**Files:**
- Create: `assets/sop/rc1503-sop-training.css`
- Modify: `assets/sop/rc1501-sop-tour-ui.js`
- Modify: `assets/sop/rc1007-sop-ui.js`
- Create: `test/rc1503-sop-training-ui.test.mjs`

**Interfaces:**
- Consumes: `ExportHubSopTraining` + `ExportHubSopTour`.
- Produces: visible Training mode shell and guided session actions.

- [ ] **Step 1: RED-test** full-width `TRAININGSMODUS` warning, “Keine produktiven Daten werden verändert”, guided instructions and simulated-result labels.
- [ ] **Step 2: Implement** the training shell; do not use only a small badge. Preserve keyboard/mobile behavior.
- [ ] **Step 3: Add `Training starten`** from an eligible SOP. When invoked outside Demo, use the explicit Demo training launch path; do not start locally.
- [ ] **Step 4: Run** unit/accessibility tests; expect PASS.
- [ ] **Step 5: Commit** `feat(sop): add guided training experience`.

### Task 3: Exam Scoring Engine

**Files:**
- Create: `assets/sop/rc1503-sop-exam.js`
- Create: `test/rc1503-sop-exam.test.mjs`

**Interfaces:**
- Consumes: effective SOP, tour action stream and validator results.
- Produces: `ExportHubSopExam.start({sop,userId})`, `recordAction(action)`, `requestHelp()`, `finish(finalContext) -> result`.

**Result Shape:** `{passed,correctSteps,errors,skippedSteps,helpCount,startedAt,completedAt,durationMs,finalStateOk}`.

- [ ] **Step 1: Write RED tests** for a clean pass, wrong action, skipped required step, out-of-order required step, missing final condition, help counting and time-not-affecting-pass.
- [ ] **Step 2: Run** and verify RED.
- [ ] **Step 3: Implement** deterministic scoring from `exam.relevant`, required checks and final-state validation.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(sop): score hands-on SOP exams`.

### Task 4: Exam UI Without Solutions

**Files:**
- Modify: `assets/sop/rc1501-sop-tour-ui.js`
- Create: `assets/sop/rc1503-sop-exam.css`
- Create: `test/rc1503-sop-exam-ui.test.mjs`

**Interfaces:**
- Consumes: `ExportHubSopExam` session/result.
- Produces: exam task shell and final result report.

- [ ] **Step 1: RED-test** that exam markup contains the task and progress shell but not instruction text, target highlight, tips, expected-result solution or hidden solution DOM.
- [ ] **Step 2: Implement** exam rendering with only task-level context and neutral progress/status feedback.
- [ ] **Step 3: Render final result** with `✅ Bestanden` or `❌ Noch nicht bestanden`, correct/errors/skipped/help summary.
- [ ] **Step 4: Run** exam UI + accessibility tests; expect PASS.
- [ ] **Step 5: Commit** `feat(sop): add solution-free exam mode`.

### Task 5: Version-Bound Employee Progress

**Files:**
- Create: `assets/sop/rc1503-sop-progress.js`
- Modify: `api/shared/merge.js`
- Create: `test/rc1503-sop-progress.test.mjs`
- Extend: relevant merge test for the shared state layer selected after rebase.

**Interfaces:**
- Consumes: state collection `sopLearningProgress`, user ID, SOP number/version, tour/training/exam events.
- Produces: `ExportHubSopProgress.key(userId,sopNumber,version)`, `get`, `markViewed`, `markStarted`, `markCompleted`, `recordTourCompletion`, `recordExamAttempt`, `recordHelp`.

- [ ] **Step 1: Write RED tests** for key separation by user/SOP/version, append-only `examAttempts`, old-version preservation and merge of concurrent independent progress records.
- [ ] **Step 2: Run** progress/merge tests and verify RED.
- [ ] **Step 3: Implement** progress transforms and register `sopLearningProgress` in the established shared-state merge strategy without changing shipment merge behavior.
- [ ] **Step 4: Run** progress, merge and existing state conflict tests; expect PASS.
- [ ] **Step 5: Commit** `feat(sop): persist versioned employee learning progress`.

### Task 6: Training/Exam Browser E2E

**Files:**
- Create: `e2e/specs/sopmaster-training-exam.spec.mjs`

**Interfaces:**
- Consumes: Demo build with Tasks 1-5.
- Produces: browser proof that training is isolated and exam evaluates user actions.

- [ ] **Step 1: E2E training**: enter from SOP → verify Demo/Training banner → complete guided pilot flow → assert simulated side effect and no productive endpoint/token is used.
- [ ] **Step 2: E2E exam**: start same SOP in exam mode → verify no hints/highlight → perform pass → verify result/progress.
- [ ] **Step 3: E2E failure**: perform wrong/skip flow → verify `Noch nicht bestanden` and diagnostic summary.
- [ ] **Step 4: Run** desktop and mobile-standard projects; expect PASS.
- [ ] **Step 5: Run** `npm test`, `npm run test:accessibility`, then commit `test(sop): verify isolated training and exam flows`.
