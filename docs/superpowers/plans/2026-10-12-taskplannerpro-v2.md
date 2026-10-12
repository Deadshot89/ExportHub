# TaskPlannerPro V2 Implementation Plan

> **Required sub-skill:** `superpowers:test-driven-development`

**Goal:** Replace the fragmented ExportHUB task/planner behavior with one compatible TaskPlannerPro V2 engine while preserving all existing task data, hotpath behavior, security boundaries, and release safety.

**Architecture:** Keep `state.tasks` as the active concrete task store and extend it with canonical V2 fields. Add series/templates/calendar/settings/archive state through the existing tasks rights module. Build independent V2 core, recurrence, planner, workflow and projection modules around the existing RC1014 lifecycle/runtime owner instead of creating a competing task store. Migrate incrementally and fail closed on collisions or unverifiable data changes.

**Tech stack:** JavaScript ES modules/IIFE browser assets, Node 20 `node:test`, existing ExportHUB build/pretest scripts, Azure state API, current HTML/CSS application shell.

**Spec:** `docs/superpowers/specs/2026-10-12-taskplannerpro-v2-design.md`

**Global constraints:**
- No direct production/main changes during implementation.
- Existing tasks/series/data must not be lost.
- `Europe/Berlin` time semantics; due time defaults to 16:15.
- Persisted TaskPlanner V2 keys remain in the existing tasks rights module.
- Existing RC994/RC996 planner drag hotpath must remain local/no full render.
- No D365/API dependency.
- All feature work follows RED -> minimal implementation -> GREEN -> relevant regression -> commit.

**Review focus:** data preservation, single task owner/store, recurrence identity, holiday/workday correctness, DnD performance, permission isolation, workflow matching ambiguity, public-link exposure, migration rollback.

---

## Delivery status

- Task 1 – V2 core and migration adapter: implemented and regression-verified.
- Task 2 – recurrence and workday calendar: implemented and regression-verified.
- Task 3 – Planner V2 engine and dependencies: implemented and regression-verified.
- Task 4 – task detail, templates, reminders and base UI: implemented and regression-verified.
- Task 5 – workweek/month UI and single Planner-owner cutover: implemented on `taskplannerpro/v2-task5`; explicit V2 contracts, legacy task regressions, RC994/RC996 drag contracts, state guard, strict i18n and full repository regression all green before integration.
- Task 6 onward: pending.

---

## Task 1: V2 Core, compatibility adapter and migration safety

**Files:**
- Create: `assets/taskplanner-v2-core.js`
- Create: `test/taskplanner-v2-core.test.mjs`
- Create: `test/taskplanner-v2-migration.test.mjs`
- Modify: `assets/rc1014-task-lifecycle.js`
- Modify: `assets/rc1014-task-runtime.js`
- Modify: state rights/API wiring discovered in RC1490/RC1492 implementation
- Modify: `.github/rc1112/build-three-env.mjs`

**Interfaces:**
- Produces `globalThis.ExportHUBTaskCoreV2`.
- Keeps `state.tasks` authoritative for active concrete tasks.
- Adds/normalizes `schemaVersion`, V2 times, priority/status, series identity, history, completion metadata.
- Adds fail-closed migration report and verified migration-backup path.

- [x] Write RED normalization/migration/compatibility tests.
- [x] Implement minimal V2 core and compatibility adapter.
- [x] Wire state rights and verified backup.
- [x] Run targeted plus full repository regression.

---

## Task 2: Recurrence Engine and Workday Calendar

**Files:**
- Create: `assets/taskplanner-v2-recurrence.js`
- Create: `test/taskplanner-v2-recurrence.test.mjs`
- Create: `test/taskplanner-v2-calendar.test.mjs`
- Modify: `assets/rc1014-task-lifecycle.js`
- Modify: builder/pretest wiring.

**Interfaces:**
- Produces recurrence validation/materialization and NRW/company workday calendar helpers.
- Deterministic `occurrenceKey` prevents duplicate materialization while allowing overlapping open occurrences.

- [x] RED recurrence/calendar contracts.
- [x] Implement supported recurrence rule set and dynamic NRW holidays.
- [x] Preserve completed occurrences; future-only series mutation.
- [x] Regression verification.

---

## Task 3: Planner V2 engine, dependencies and week draft

**Files:**
- Create: `assets/taskplanner-v2-planner.js`
- Create: `assets/taskplanner-v2-runtime-bridge.js`
- Create: `test/taskplanner-v2-planner.test.mjs`
- Create: `test/taskplanner-v2-runtime-bridge.test.mjs`
- Modify: build/pretest wiring.

**Interfaces:**
- Planner sorts overdue before stored P0-P3 without rewriting priority.
- Dependency validation rejects cycles/fails closed.
- Week draft is non-mutating until explicit apply.
- Manual planner moves stay protected unless explicitly overridden.
- Runtime bridge moves only `plannedAt`; `dueAt` remains intact.

- [x] RED planner/dependency/week-draft tests.
- [x] Implement Planner V2.
- [x] Protect RC994/RC996 hotpath.
- [x] Full regression verification.

---

## Task 4: Task detail, templates, reminders and base responsive UI

**Files:**
- Create/modify: `assets/taskplanner-v2-ui.js`
- Modify: `assets/taskplanner-v2.css`
- Create: TaskPlanner V2 UI/reminder/i18n tests and preparation scripts.
- Modify: builder/pretest wiring.

**Interfaces:**
- Detail sidepanel exposes canonical V2 fields/checklist/history.
- Saved task cancellation keeps task record rather than physical deletion.
- Template extraction strips instance state/history and resets checklist.
- Reminder slots 09:00, 13:00, 15:30 with idempotent delivery ledger.
- Compact/detailed preference stored per user.

- [x] RED detail/template/reminder tests.
- [x] Implement responsive base UI.
- [x] Add DE/EN/PL/ES/FR/IT parity and strict i18n compliance.
- [x] Regression verification.

---

## Task 5: Arbeitswoche, Monatsansicht und Planner-UI-Cutover

**Files:**
- Create: `assets/taskplanner-v2-planner-ui.js`
- Create: `test/taskplanner-v2-planner-ui.test.mjs`
- Create: `scripts/taskplanner-v2-cutover-pretest.mjs`
- Create: `scripts/taskplanner-v2-planner-i18n-pretest.mjs`
- Create: `test/taskplanner-v2-planner-i18n.test.mjs`
- Modify: `assets/taskplanner-v2.css`
- Modify: `scripts/taskplanner-v2-pretest.mjs`
- Modify: `scripts/rc1462-pretest.mjs`
- Modify: `.github/rc1112/build-three-env.mjs` through idempotent pretest patching.
- Modify: `TESTVERSION.html` through idempotent cutover preparation.

**Interfaces:**
- Current workweek and next workweek are visibly separated; workweek uses Mon-Fri drop targets.
- Overdue tasks render in a distinct section with whole-card overdue treatment.
- Daily summary follows the requested compact wording.
- Month view consumes `ExportHUBTaskPlannerV2.monthProjection({tasks,year,month,now,calendar})` and renders day aggregates only.
- DnD delegates a single occurrence move to `ExportHUBRC1014TaskRuntime.plannerV2.moveTaskOccurrence`; the UI does not rewrite `dueAt`.
- Legacy planner `render()` returns early to `ExportHUBTaskUIV2.renderPlannerPage` when the V2 cutover owner is available.

- [x] **Step 1: RED current/next-week, overdue, daily-summary, month and DnD contracts.**
- [x] **Step 2: Implement responsive workweek/month UI extension.**
- [x] **Step 3: Wire single-owner cutover into generated TESTSERVICE/build path.**
- [x] **Step 4: Add six-language planner UI translations and strict audit coverage.**
- [x] **Step 5: Verify V2 contracts, RC1014, RC994/RC996, state security, i18n and full repository regression.**

Verification checkpoint: branch run `38296102476` for commit `d08150d3ffa3e255131ba8c378e798985350ee8f` completed successfully across every configured CI stage before integration.

---

## Task 6: Workflow Event Router und automatische sichere Erledigung

**Files:**
- Create: `assets/taskplanner-v2-workflow.js`
- Create: `test/taskplanner-v2-workflow.test.mjs`
- Modify: `assets/rc1014-task-lifecycle.js`
- Modify: `assets/rc1014-task-runtime.js`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: only the concrete shipment/document action modules that own confirmed domain transitions discovered during implementation; do not bind to render events.

**Interfaces:**
- Consumes: Core `completeTask`, task workflow bindings, domain IDs.
- Produces: `globalThis.ExportHUBTaskWorkflowV2` with `normalizeEvent(event)`, `match(event,tasks)`, `apply(event,state,ctx)`, `emit(event,ctx)`, `processedKey(event)`.

- [ ] **Step 1: Write RED structured matching tests**

Create scenarios for `shipment.created`, `shipment.picked`, `shipment.registered`, `shipment.dispatched`, `document.created`, `document.approved`, `customer.process.completed`.

Assert customer name alone never qualifies; configured identifiers such as customerId + shipmentId/ref + process/workflow/taskType/date scope determine candidates.

- [ ] **Step 2: Write RED ambiguity/idempotency/concurrency tests**

Assert:
- one unique candidate → complete;
- zero → no mutation;
- two unresolved candidates → no mutation + `Zuordnung prüfen` result;
- repeated same `eventId` → no second history/save;
- task already changed/done → no destructive overwrite;
- unrelated tasks remain byte-equivalent.

Run: `node --test --test-concurrency=1 test/taskplanner-v2-workflow.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement event router**

Store processed event identifiers in bounded task/migration metadata, not a separate browser store. `apply()` returns explicit patches and ambiguous IDs.

- [ ] **Step 4: Wire confirmed website actions**

At actual successful business transitions dispatch `ExportHUBTaskWorkflowV2.emit(...)` with stable IDs. Do not infer completion from a button click before the underlying process confirms success.

- [ ] **Step 5: Canonical immediate refresh**

After a genuine task mutation dispatch one `exporthub:tasks-updated` event containing changed task IDs/change kind. Tasks, planner, dashboard/customer projections patch from this event; no reload.

- [ ] **Step 6: Verify and commit**

Run workflow test plus existing shipment/document regression tests for each touched action module and `npm test` targeted through `--test-name-pattern` where available.

Commit: `git commit -m "feat: add TaskPlannerPro workflow event automation"`

---

## Task 7: Sichere öffentliche Read-only-Aufgabenlinks

**Files:**
- Create: `api/task-public/index.js`
- Create: `api/task-public/function.json`
- Create: `assets/task-public-read.js`
- Create: `task.html`
- Create: `test/taskplanner-v2-public-link.test.mjs`
- Modify: `assets/taskplanner-v2-core.js`
- Modify: `assets/taskplanner-v2-ui.js`
- Modify: `.github/rc1112/build-three-env.mjs`

**Interfaces:**
- Consumes: task public-link metadata containing token hash, revocation, field whitelist; Azure team-state read primitives/patterns.
- Produces: authenticated UI actions `createPublicLink(taskId,fields,ctx)` / `revokePublicLink(taskId,ctx)` and unauthenticated `GET /api/task-public?token=<opaque>` returning only whitelisted read data.

- [ ] **Step 1: Write RED token/security tests**

Assert:
- token generated with `crypto.getRandomValues`/server crypto, never `Math.random`;
- only hash is persisted;
- invalid/revoked token returns 404/410 without task metadata;
- internal IDs, comments, history, workflow IDs and contacts are never returned unless explicitly allowed by the spec whitelist;
- response exposes no mutation method;
- environment is derived from request host/evidence and cannot be switched by query parameter.

- [ ] **Step 2: Implement API and public page**

`task.html` is standalone read-only UI. No internal app bootstrap/auth state is exposed to an anonymous visitor.

- [ ] **Step 3: Implement authenticated create/revoke controls**

Controls live in task detail; changes persist through normal task state path and append history.

- [ ] **Step 4: Verify and commit**

Run: `node --test --test-concurrency=1 test/taskplanner-v2-public-link.test.mjs test/rc1088-release-hardening.test.mjs`

Expected: PASS.

Commit: `git commit -m "feat: add secure read-only task links"`

---

## Task 8: Dashboard, Kunde, Archiv/Statistik und Performance-Projektionen

**Files:**
- Create: `assets/taskplanner-v2-projections.js`
- Create: `test/taskplanner-v2-projections.test.mjs`
- Create: `test/taskplanner-v2-performance.test.mjs`
- Modify: `assets/taskplanner-v2-ui.js`
- Modify: `assets/taskplanner-v2.css`
- Modify: `assets/rc1014-task-runtime.js`
- Modify: `.github/rc1112/build-three-env.mjs`

**Interfaces:**
- Consumes: active tasks, bounded archive pages, derived task states.
- Produces: `globalThis.ExportHUBTaskProjectionsV2` with `today(state,ctx)`, `week(state,ctx)`, `dashboard(state,ctx)`, `customer(customerId,state,ctx)`, `archive(query,state,ctx)`, `stats(query,state,ctx)`, `index(state,ctx)`.

- [ ] **Step 1: Write RED projection tests**

Dashboard must produce: Heute, Diese Woche, Überfällig, Kritisch, Erledigt, Wartet, weekly `{done,total,percent}`, overload status.

Customer projection must separate active/upcoming and paginated history by `customerId`, not customer name.

Archive projection must paginate/filter by customer/process/series/completion mode.

- [ ] **Step 2: Write RED performance contracts**

Use large synthetic data (e.g. 5k active + 50k archived) and assert planner/today/week index functions do not iterate/render archive entries; month returns day aggregates before card details; repeated identical projection uses stable cached signature; UI-only filter changes do not call persist.

- [ ] **Step 3: Implement projections and indexes**

Use bounded active windows, archive pagination and lazy month detail reads.

- [ ] **Step 4: Integrate dashboard/customer/mobile UI**

Dashboard KPIs and customer task/history surfaces read these projections. Mobile keeps all task actions and uses agenda-first layout.

- [ ] **Step 5: Verify and commit**

Run projection/performance/UI tests plus full task regression.

Commit: `git commit -m "feat: add TaskPlannerPro projections and archive statistics"`

---

## Task 9: Release hardening, migration dry-run and cutover

**Files:**
- Create: `test/taskplanner-v2-release.test.mjs`
- Modify: release/verification scripts only as needed by the current repository convention.

- [ ] Run verified task snapshot and dry-run migration.
- [ ] Abort on unresolved identity collisions, count mismatch, or broken relation/history checks.
- [ ] Rebase/merge latest `main`, including any production changes made in parallel, then rerun full regression.
- [ ] Verify production/TESTSERVICE separation and no task migration on production without explicit release action.
- [ ] Run final task, planner, recurrence, holiday, workflow, public-link, projection, security, i18n and full repository suites.
- [ ] Produce before/after release report and only then prepare production release.
