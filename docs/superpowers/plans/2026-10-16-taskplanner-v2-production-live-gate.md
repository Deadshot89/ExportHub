# TaskPlanner V2 Production Live Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated, read-only Production live acceptance gate for TaskPlannerPro V2 so a release proves the V2 runtime and UI render correctly in the deployed Production build without mutating task state or server data.

**Architecture:** Add one Playwright Production smoke that waits for the committed TaskPlanner V2 globals, renders a representative task entirely inside an isolated DOM sandbox using an in-memory state, and verifies task list/detail output plus runtime cleanliness. Wire that spec into the manual Production Release after the generic Production browser smoke; do not call any TaskPlanner mutation/persist/public-link APIs.

**Tech Stack:** JavaScript, Node.js test runner, Playwright 1.63, GitHub Actions, ExportHUB static runtime.

**Spec:** `docs/superpowers/taskplannerpro-v2-progress.md`

## Global Constraints

- Production validation must be read-only and must not change `state.tasks`, server state, public links, reminders, completion state, or task settings.
- Existing TaskPlanner V2 UI, data model, design, recurrence, planner, workflow, and persistence behavior must remain unchanged.
- The Production gate must run only for the explicit Production release flow and use the already deployed Production origin.
- A failure must block the Production Release from being reported successful.
- 100% may only be reported after the updated release workflow itself has been deployed and the new TaskPlanner Production live gate has passed on Production.

## Review Focus

- TaskPlanner globals load late: gate must poll instead of assuming they exist at DOMContentLoaded.
- Read-only guarantee: the spec must call only render/detail APIs with local in-memory state and observe no new POST/PUT/PATCH/DELETE request during its sandbox operation.
- Existing Production page state: sandbox must use a unique root and clean it up without touching the real TaskPlanner DOM.
- Environment isolation: live gate must skip unless `EXPORTHUB_E2E_PUBLIC_ENV=production`.
- Runtime failures: page errors during the smoke must fail the test.

---

### Task 1: Add dedicated TaskPlanner V2 Production read-only acceptance

**Files:**
- Create: `test/rc1547-taskplanner-v2-production-live-gate.test.mjs`
- Create: `e2e/specs/taskplanner-v2-production.spec.mjs`
- Modify: `.github/workflows/exporthub-production-release.yml`

**Interfaces:**
- Consumes: `window.ExportHUBTaskCoreV2`, `window.ExportHUBTaskUIV2`, `ExportHUBTaskUIV2.renderTasks(target,ctx)`, `ExportHUBTaskUIV2.renderDetail(target,taskId,ctx)`.
- Produces: Production Release step `RC1547 TaskPlanner V2 Production Read-only Liveprüfung` and Playwright spec `e2e/specs/taskplanner-v2-production.spec.mjs`.

- [ ] **Step 1: Write the failing workflow contract test**

Assert that the Production Release workflow contains the RC1547 read-only step, Production live environment, exact TaskPlanner Playwright spec command, and a failure-artifact step keyed to the RC1547 step.

- [ ] **Step 2: Run the targeted contract and verify RED**

Run: `node --test test/rc1547-taskplanner-v2-production-live-gate.test.mjs`
Expected: FAIL because the RC1547 Production step/spec is absent.

- [ ] **Step 3: Add the read-only Playwright Production smoke**

Create a representative in-memory task equivalent to the existing TaskPlanner V2 UI test fixture. Navigate to Production, poll for V2 globals, create `#rc1547-taskplanner-sandbox`, invoke only `renderTasks` and `renderDetail`, assert V2 version `2.0`, one task card, title/customer/due-time/detail/checklist/history presence, capture `pageerror`, and assert zero new POST/PUT/PATCH/DELETE requests after sandbox tracking starts. Remove the sandbox at the end.

- [ ] **Step 4: Wire the gate into Production Release**

Add `RC1547 TaskPlanner V2 Production Read-only Liveprüfung` after the generic RC1124 Production browser smoke and before dashboard personalization, with the same live Production environment variables. Add a conditional RC1547 browser artifact upload on failure.

- [ ] **Step 5: Run targeted contract, TaskPlanner unit tests, full repository regression, and PR CI**

Expected: all pass with zero failures.

- [ ] **Step 6: Merge through PR, run Main Verification and TESTSERVICE, then explicit Production Release**

Expected: Production Release reaches success and the RC1547 live step itself reports success before the item is marked 100%.
