# TaskPlannerPro V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden ExportHUB-Aufgabenbereich verlustfrei auf eine kanonische TaskPlannerPro-V2-Engine mit Wiederholungen, Feiertagen, Wochen-/Monatsplanung, Workflow-Automatisierung, Archiv, Dashboard- und Mobile-Projektionen umstellen.

**Architecture:** Der bestehende `state.tasks`-Pfad bleibt die aktive Instanzquelle und wird durch fokussierte V2-Module normalisiert statt durch einen zweiten Store ersetzt. `assets/rc1014-task-lifecycle.js` und `assets/rc1014-task-runtime.js` bleiben Kompatibilitätsfassaden für vorhandene Verbraucher, delegieren Fachlogik aber schrittweise an V2; `.github/rc1112/build-three-env.mjs` bindet die V2-Assets in alle Build-Umgebungen ein. Serverrechte, Migration und öffentlicher Read-only-Zugriff werden fail-closed abgesichert.

**Tech Stack:** Vanilla JavaScript/IIFE Browser Runtime, Node.js 20+ `node:test`, Azure Static Web Apps Functions/CommonJS, Azure Blob State Store, bestehendes ExportHUB i18n- und Build-System.

**Spec:** `docs/superpowers/specs/2026-10-12-taskplannerpro-v2-design.md`

## Global Constraints

- `main` und Produktion bleiben während Entwicklung und TESTSERVICE-Verifikation unverändert.
- Keine direkte D365-Integration.
- Geschäftszeitzone ist `Europe/Berlin`.
- Fehlt eine konkrete Fälligkeitsuhrzeit, gilt 16:15 Uhr.
- Bestehende Aufgaben, Serien, Verknüpfungen, manuelle Moves und erledigte Historie dürfen nicht verloren gehen.
- `state.tasks` bleibt die aktive konkrete Aufgabeninstanzquelle; es entsteht kein zweiter Browser-/IndexedDB-/LocalStorage-Taskstore.
- Neue persistierte Task-Keys gehören serverseitig zum Rechtebereich `tasks`; unbekannte persistierte Keys bleiben fail-closed.
- Drag & Drop darf keinen unnötigen Planner-Vollrender auslösen.
- UI-only Änderungen lösen keinen Azure-Save aus.
- Überfälligkeit verändert weder gespeicherte Priorität noch ursprüngliches `dueAt`.
- Mehrdeutige Workflow-Zuordnung erledigt keine Aufgabe automatisch.
- `manual_decision` bei Feiertagen führt nie zu einer stillen automatischen Verschiebung.
- Neue Übersetzungen werden in DE/EN/PL/ES/FR/IT ergänzt und durch den bestehenden i18n-Audit geprüft.

## Review Focus

1. **DST/Zeitzonen-Grenzen:** Aufgaben um Sommer-/Winterzeit und 16:15-Default müssen in `Europe/Berlin` auf demselben lokalen Arbeitstag bleiben. → Task 1/2 Tests.
2. **Legacy-Serien ohne stabile IDs:** Migration darf zwei echte Aufgaben nicht zusammenführen und keine künstliche Dublette erzeugen. → Task 1 Migrationstests.
3. **Paralleländerung während automatischer Erledigung:** Event-Reconcile darf fremde Änderungen nicht überschreiben und dasselbe `eventId` nicht zweimal anwenden. → Task 6 Tests.
4. **Große Archive:** Planner/Monatsansicht dürfen `taskArchive` nicht komplett rendern oder für normale Tagesfilter durchlaufen. → Task 8 Performance-Tests.
5. **Öffentliche Links:** widerrufene, falsche oder TESTSERVICE/Produktion-fremde Tokens dürfen keinerlei interne Taskdaten preisgeben. → Task 7 Security-Tests.

---

## Task 1: V2-Kern, Legacy-Adapter und migrationssichere Persistenz

**Files:**
- Create: `assets/taskplanner-v2-core.js`
- Create: `test/taskplanner-v2-core.test.mjs`
- Create: `test/taskplanner-v2-migration.test.mjs`
- Modify: `assets/rc1014-task-lifecycle.js`
- Modify: `assets/rc1014-task-runtime.js`
- Modify: `api/exporthub-state/index.js`
- Modify: `.github/rc1112/build-three-env.mjs`

**Interfaces:**
- Consumes: existing `state.tasks`, `_teamSyncMeta`, `ExportHUBClean.queueSave/save`, current user/company/environment context.
- Produces: `globalThis.ExportHUBTaskCoreV2` with `normalizeTask(input,ctx)`, `normalizeState(state,ctx)`, `migrateState(state,ctx)`, `derive(task,now)`, `completeTask(task,options)`, `reopenTask(task,options)`, `cancelTask(task,options)`, `archiveCompleted(state,now)`, `historyEntry(action,options)`.
- Compatibility: `ExportHUBRC1014Tasks.normalizeTask()` and `ExportHUBRC1014TaskRuntime.prepareTasks()` continue to exist and delegate to V2 where applicable.

- [ ] **Step 1: Write the failing core tests**

Add tests asserting:
- legacy `date/day/dueDate/plannedDate/targetDate` are normalized without deleting source values;
- statuses map to `planned/open/in_progress/waiting/waiting_feedback/blocked/done/cancelled`;
- priorities map to P0–P3 while legacy P4 safely becomes P3 unless a preserved compatibility field is needed;
- missing due-time becomes local 16:15 Europe/Berlin;
- `derive()` marks overdue without changing `dueAt` or `priority`;
- `completeTask()` appends history and sets `completionMode`;
- checklist completion is not required for task completion.

Run: `node --test --test-concurrency=1 test/taskplanner-v2-core.test.mjs`

Expected: FAIL because `assets/taskplanner-v2-core.js`/API do not exist.

- [ ] **Step 2: Write the failing migration tests**

Create fixtures covering:
- two same-title tasks with different shipment refs stay separate;
- old recurring IDs/series aliases map deterministically;
- manual planned dates survive;
- done tasks/history survive byte-equivalent for untouched business fields;
- migration report returns counts before/after, collisions, created series links and unresolved relationships;
- any unresolved collision makes `report.safe === false`.

Run: `node --test --test-concurrency=1 test/taskplanner-v2-migration.test.mjs`

Expected: FAIL because migration is not implemented.

- [ ] **Step 3: Implement `ExportHUBTaskCoreV2`**

Implement pure functions in `assets/taskplanner-v2-core.js`; no network/storage calls inside the module. Use explicit `Europe/Berlin` local-date helpers and preserve legacy aliases during compatibility phase.

- [ ] **Step 4: Convert RC1014 lifecycle/runtime into compatibility consumers**

Update `assets/rc1014-task-lifecycle.js` so `normalizeTask`, sorting/derived status and completion use `ExportHUBTaskCoreV2`; remove independent recurrence creation from `reconcile()` once Task 2 supplies the new recurrence engine. Keep public RC1014 exports used by existing tests/consumers.

Update `assets/rc1014-task-runtime.js` so `prepareTasks()` still persists only on genuine changes and continues using the caller-provided `state.tasks` callback.

- [ ] **Step 5: Add server-side state-key authorization and migration backup mode**

In `api/exporthub-state/index.js` map `taskSeries`, `taskTemplates`, `taskCalendar`, `taskSettings`, `taskArchive` and task migration metadata to the existing `tasks` permission domain.

Add admin-only `mode=task-migration-backup` that snapshots the current team document into the environment-specific recovery prefix and returns `{ok,environment,revision,backupBlob}` without changing the team state.

- [ ] **Step 6: Inject core runtime through the current build**

Modify `.github/rc1112/build-three-env.mjs` to load `taskplanner-v2-core.js` before `rc1014-task-lifecycle.js`/`rc1014-task-runtime.js` in production-candidate, TESTSERVICE and demo builds. Do not modify production release markers.

- [ ] **Step 7: Verify Task 1**

Run:
`node --test --test-concurrency=1 test/taskplanner-v2-core.test.mjs test/taskplanner-v2-migration.test.mjs test/rc1014-task-runtime-integration.test.mjs test/rc1054-task-shared-source.test.mjs`

Expected: PASS; RC1014 single-store/reconcile contracts remain green.

- [ ] **Step 8: Commit**

`git add assets/taskplanner-v2-core.js assets/rc1014-task-lifecycle.js assets/rc1014-task-runtime.js api/exporthub-state/index.js .github/rc1112/build-three-env.mjs test/taskplanner-v2-core.test.mjs test/taskplanner-v2-migration.test.mjs && git commit -m "feat: add TaskPlannerPro V2 core and safe migration"`

---

## Task 2: Wiederholungs-Engine und Workday Calendar

**Files:**
- Create: `assets/taskplanner-v2-recurrence.js`
- Create: `test/taskplanner-v2-recurrence.test.mjs`
- Create: `test/taskplanner-v2-calendar.test.mjs`
- Modify: `assets/rc1014-task-lifecycle.js`
- Modify: `.github/rc1112/build-three-env.mjs`

**Interfaces:**
- Consumes: `ExportHUBTaskCoreV2`, `state.taskSeries`, `state.taskCalendar`, existing `state.tasks`.
- Produces: `globalThis.ExportHUBTaskRecurrenceV2` with `validateRule(rule)`, `nrwHolidays(year)`, `calendar(stateCalendar)`, `isWorkday(date,calendar)`, `moveWorkdays(date,offset,calendar)`, `resolveHoliday(date,policy,calendar)`, `occurrences(series,range,calendar)`, `materialize({series,tasks,range,calendar,now})`.

- [ ] **Step 1: Write RED recurrence cases**

Test exactly:
- daily;
- Monday + Thursday;
- every 2 weeks Wednesday;
- second Tuesday in month;
- first workday;
- last workday;
- 3 workdays before month end;
- X workdays after month start;
- monthly/yearly across year boundary;
- previous occurrence may remain open while next is created;
- same `occurrenceKey` never materializes twice;
- changing series affects only unfinished future occurrences.

Run: `node --test --test-concurrency=1 test/taskplanner-v2-recurrence.test.mjs`

Expected: FAIL.

- [ ] **Step 2: Write RED calendar/holiday cases**

Test NRW holidays for at least 2026, 2027, 2028 and a later arbitrary year; weekend + company holiday + shutdown; consecutive non-working days; all four policies. Assert `manual_decision` returns conflict metadata and no replacement date.

Run: `node --test --test-concurrency=1 test/taskplanner-v2-calendar.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement recurrence/calendar module**

Use deterministic local-date arithmetic, no unbounded future generation. `materialize()` default range is current ISO workweek through end of next workweek; preview callers may request a bounded larger range.

- [ ] **Step 4: Remove old RC1014 next-occurrence ownership**

Keep compatibility export `nextOccurrence()` only as a delegate into V2. `reconcile()` must no longer independently generate recurrence instances.

- [ ] **Step 5: Inject recurrence runtime after core and before lifecycle**

Update `.github/rc1112/build-three-env.mjs` with deterministic load order.

- [ ] **Step 6: Verify and commit**

Run: `node --test --test-concurrency=1 test/taskplanner-v2-recurrence.test.mjs test/taskplanner-v2-calendar.test.mjs test/rc1014-task-lifecycle.test.mjs test/rc1014-task-runtime-integration.test.mjs`

Expected: PASS.

Commit: `git commit -m "feat: add TaskPlannerPro recurrence and workday engine"`

---

## Task 3: Planner Engine, Abhängigkeiten und verbindlicher Wochenplan

**Files:**
- Create: `assets/taskplanner-v2-planner.js`
- Create: `test/taskplanner-v2-planner.test.mjs`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: `assets/rc1014-task-runtime.js`

**Interfaces:**
- Consumes: Core derived task data, recurrence/calendar engine, current active task instances.
- Produces: `globalThis.ExportHUBTaskPlannerV2` with `validateDependencies(tasks)`, `buildWeekDraft(input)`, `applyWeekDraft(state,draft,options)`, `recalculateWeek(input)`, `weekSummary(draft)`, `monthProjection(input)`.

- [ ] **Step 1: Write RED planner ordering and dependency tests**

Assert effective order: overdue → P0/P1/P2/P3 → latest completion/due date → dependency constraints → manual/fixed planning → workday constraints.

Test dependency cycles are rejected; open predecessor marks dependent task blocked/at-risk but does not silently overwrite a manual date.

- [ ] **Step 2: Write RED draft/apply/replan tests**

Assert:
- draft does not mutate persisted tasks;
- summary counts planned, auto-moved, holiday conflicts, dependency conflicts, manual changes;
- `applyWeekDraft()` is the first operation that writes planned dates;
- manual overrides survive recalculation by default;
- overwrite requires explicit `allowManualOverride:true`;
- `manual_decision` holiday conflict prevents final apply until resolved;
- overloaded week is detected when due/fixed constraints cannot be satisfied, without enforcing an arbitrary hourly cap.

Run: `node --test --test-concurrency=1 test/taskplanner-v2-planner.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement planner engine**

Keep the planner pure: it returns drafts/patches; persistence remains in runtime/UI layer.

- [ ] **Step 4: Add runtime mutation helpers**

Extend `ExportHUBRC1014TaskRuntime` with `applyTaskPatch(id,patch,ctx)`, `applyWeekPlan(draft,ctx)`, `moveTaskOccurrence(id,plannedAt,ctx)`; these update only changed instances, append history and call the existing persist callback once.

- [ ] **Step 5: Preserve existing drag performance contract**

Do not replace `rc946TaskPointerDayAt`, optimistic target selection, or RC994 local reconcile with a full render path. Runtime move helper must be callable from the current hotpath.

- [ ] **Step 6: Verify and commit**

Run: `node --test --test-concurrency=1 test/taskplanner-v2-planner.test.mjs test/rc994-drag-performance.test.mjs .github/rc996/tasks-contract.test.mjs`

Expected: PASS.

Commit: `git commit -m "feat: add TaskPlannerPro week planning engine"`

---

## Task 4: Aufgaben-, Template-, Reminder- und Detailmodell

**Files:**
- Create: `assets/taskplanner-v2-ui.js`
- Create: `assets/taskplanner-v2.css`
- Create: `test/taskplanner-v2-task-ui.test.mjs`
- Create: `test/taskplanner-v2-reminders.test.mjs`
- Modify: `assets/rc1014-task-runtime.js`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: `assets/i18n/de.json`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/pl.json`
- Modify: `assets/i18n/es.json`
- Modify: `assets/i18n/fr.json`
- Modify: `assets/i18n/it.json`

**Interfaces:**
- Consumes: Core/runtime/planner APIs and state collections `taskTemplates`, `taskSettings`.
- Produces: `globalThis.ExportHUBTaskUIV2` with `renderTasks(root,ctx)`, `renderDetail(root,taskId,ctx)`, `saveTask(form,ctx)`, `saveTemplate(template,ctx)`, `templateFromTask(task)`, `reminderCandidates(now,state,user)` and UI event handlers.

- [ ] **Step 1: Write RED task editor/detail tests**

Assert fields for title, customer, area/process, status, priority, start/planned/due/latest completion, recurrence, holiday policy, contact, checklist, comments, dependencies and upcoming occurrences.

Assert default due time 16:15, compact/detailed user preference, task completion optional comment, cancellation instead of destructive delete, checklist progress reset on recurrence.

- [ ] **Step 2: Write RED reminder tests**

Test default slots 09:00/13:00/15:30, per-task channel selection, per-user settings, idempotency key `{taskId, reminder occurrence, user, environment}`, and no duplicate reminder from repeated render/focus/sync events.

- [ ] **Step 3: Implement responsive tasks/detail UI**

Desktop uses right sidepanel without leaving planner context. Tablet/mobile switch to one-column/agenda-friendly layouts; touch targets remain large and no horizontal overflow is allowed.

- [ ] **Step 4: Implement templates and recurrence preview**

`templateFromTask()` strips status, completed data, occurrence identity, instance history and checklist completion state. UI shows next occurrence plus bounded preview.

- [ ] **Step 5: Add i18n keys in all six locales**

Add matching key sets for statuses, priorities, planner controls, recurrence rules, holiday policies, reminders, template actions, migration/conflict messages and public-read labels.

- [ ] **Step 6: Build-load CSS/UI and verify**

Update `.github/rc1112/build-three-env.mjs` to load CSS and UI after core/planner runtimes.

Run: `node --test --test-concurrency=1 test/taskplanner-v2-task-ui.test.mjs test/taskplanner-v2-reminders.test.mjs test/rc1003-task-render-syntax.test.mjs && npm run i18n:audit:strict`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `git commit -m "feat: add TaskPlannerPro task detail templates and reminders"`

---

## Task 5: Arbeitswoche, Monatsansicht und UI-Cutover auf einen Planner-Owner

**Files:**
- Modify: `assets/taskplanner-v2-ui.js`
- Modify: `assets/taskplanner-v2.css`
- Create: `test/taskplanner-v2-planner-ui.test.mjs`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: `TESTVERSION.html` only if the current build source cannot be patched safely through the builder; do not duplicate logic in `index.html`.

**Interfaces:**
- Consumes: `ExportHUBTaskPlannerV2.monthProjection`, runtime mutation helpers, task UI detail sidepanel.
- Produces: `renderPlanner(root,ctx)` as the sole visible owner of the planning view; existing planner entry points delegate to it.

- [ ] **Step 1: Write RED planner UI contracts**

Assert:
- tabs `Arbeitswoche` and `Monat`;
- overdue area above normal planning;
- current and next week are visually distinct;
- holiday/shutdown days visible and unavailable for normal auto-planning;
- draft/apply/recalculate controls and summary are present;
- month view uses day summaries and lazy task detail;
- long titles/checklists do not overflow.

- [ ] **Step 2: Implement a single planner view owner**

Patch the active planner renderer in the current release build so it delegates to `ExportHUBTaskUIV2.renderPlanner`. Remove/disable superseded parallel planner rendering rather than stacking a second DOM owner.

- [ ] **Step 3: Reuse the existing pointer hotpath**

Map existing `pointerup -> moveTask` flow into `moveTaskOccurrence()` while retaining real `elementFromPoint()` day hit detection and local DOM movement. Do not call a full `render()` after drop.

- [ ] **Step 4: Verify responsive/accessibility behavior**

Test representative 320, 768, 1024 and desktop layout contracts; sidepanel focus enters/restores predictably; planner background remains visible on desktop.

- [ ] **Step 5: Verify and commit**

Run: `node --test --test-concurrency=1 test/taskplanner-v2-planner-ui.test.mjs test/rc994-drag-performance.test.mjs .github/rc996/tasks-contract.test.mjs test/rc1001-task-tiles-cleanup.test.mjs`

Expected: PASS.

Commit: `git commit -m "feat: cut planner UI over to TaskPlannerPro V2"`

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

- [ ] **Step 3: Implement archive rollover**

`archiveCompleted()` moves done tasks older than seven calendar days from active `state.tasks` to compact `state.taskArchive`, preserving stats/history identity and preventing duplicate archive IDs.

- [ ] **Step 4: Wire Dashboard and Kundenansicht to shared projections**

Replace duplicated task calculations in those views with projection API. Preserve surrounding non-task dashboard/customer features.

- [ ] **Step 5: Verify and commit**

Run: `node --test --test-concurrency=1 test/taskplanner-v2-projections.test.mjs test/taskplanner-v2-performance.test.mjs test/rc994-drag-performance.test.mjs`

Expected: PASS.

Commit: `git commit -m "feat: add TaskPlannerPro shared projections and archive"`

---

## Task 9: Migrationsrehearsal, Build-/i18n-Hardening und vollständige Regression

**Files:**
- Create: `scripts/taskplanner-v2-migration-audit.mjs`
- Create: `test/taskplanner-v2-release.test.mjs`
- Modify: `scripts/rc1462-pretest.mjs`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: release notes/manifest source used by the current branch only; do not change production-visible release marker.

**Interfaces:**
- Consumes: all previous TaskPlannerPro V2 modules and migration report.
- Produces: deterministic pretest/build gate that refuses a release candidate when migration/data-integrity/task runtime contracts fail.

- [ ] **Step 1: Write RED release gate**

Assert build contains V2 assets in production-candidate/TESTSERVICE/demo in correct load order; production marker remains unchanged; source maps/temporary fixtures are not shipped; required APIs/assets are copied.

- [ ] **Step 2: Implement migration audit script**

Given a JSON state snapshot, print/return before/after counts for active, done, series, customer/shipment links, unresolved collisions and safe flag. Exit non-zero when `safe !== true`.

- [ ] **Step 3: Add pretest orchestration**

`scripts/rc1462-pretest.mjs` must verify V2 build transforms are idempotently prepared but must not mutate production markers or live Azure data.

- [ ] **Step 4: Run focused suite**

Run:
`node --test --test-concurrency=1 test/taskplanner-v2-*.test.mjs test/rc1014-task-*.test.mjs test/rc1054-task-shared-source.test.mjs test/rc994-drag-performance.test.mjs .github/rc996/tasks-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run full project gates**

Run:
`npm run test:security`
`npm run test:accessibility`
`npm run verify:i18n`
`npm test`

Expected: all PASS. Any failure is fixed before proceeding.

- [ ] **Step 6: Build three environments and static integrity checks**

Run:
`node scripts/rc1462-pretest.mjs`
`node .github/rc1112/build-three-env.mjs`

Verify generated TESTSERVICE contains V2 assets and production-candidate is not automatically deployed/released.

- [ ] **Step 7: Commit**

Commit: `git commit -m "test: harden TaskPlannerPro V2 release gates"`

---

## Task 10: TESTSERVICE Datenmigration und Live-Abnahme

**Files:**
- No product-code changes unless a failing TESTSERVICE case reproduces a verified defect; any fix gets its own RED regression first.
- Evidence may be recorded in `docs/superpowers/taskplannerpro-v2-progress.md`.

**Interfaces:**
- Consumes: tested branch build, TESTSERVICE state, migration-backup endpoint.
- Produces: migration evidence and live acceptance report; no production release.

- [ ] **Step 1: Create TESTSERVICE backup**

Call admin-only task migration backup against TESTSERVICE and record returned blob/revision.

- [ ] **Step 2: Run migration preview against TESTSERVICE snapshot**

Require `safe:true`, zero unexplained loss, zero unresolved identity collisions, preserved customer/shipment links and preserved done/manual history.

- [ ] **Step 3: Deploy only to TESTSERVICE through the existing safe release path**

Do not alter production-version/release marker.

- [ ] **Step 4: Live smoke scenarios**

Verify: create/edit/cancel/done, 16:15 default, recurrence Mo+Do, second Tuesday, last/first workday, 3 workdays before month-end, holiday manual conflict, drag one occurrence, week draft/apply/replan, month view, reminders, dependency, template, workflow unique completion, workflow ambiguity, public read-only link/revoke, dashboard/customer immediate refresh, mobile layout.

- [ ] **Step 5: Compare post-migration counts**

Compare TESTSERVICE before/after snapshot report. If counts/links differ outside documented intentional schema additions, restore from backup and block release.

- [ ] **Step 6: Final regression after live fixes**

Re-run all TaskPlannerPro tests + `npm test` + build.

- [ ] **Step 7: Commit evidence only**

Commit live test evidence/progress. Production remains a separate explicit user-approved Release-Center step.

---

## Task 11: Integration review and production-readiness handoff

**Files:**
- Update: `docs/superpowers/taskplannerpro-v2-progress.md`
- Update release notes on branch as required by current release workflow.

**Interfaces:**
- Consumes: all green automated and TESTSERVICE evidence.
- Produces: reviewed branch/PR ready for explicit release decision.

- [ ] **Step 1: Review branch diff for architectural regressions**

Confirm there is one task store, one recurrence owner, one visible planner owner, no render-triggered saves, no production marker change, no new insecure public endpoint.

- [ ] **Step 2: Verify spec coverage**

Map every section of the V2 spec to an implemented test/evidence item. Any uncovered requirement gets a test and implementation before readiness.

- [ ] **Step 3: Produce final status**

Report progress, Vorher/Nachher, Behoben, tests passed/fixed, migration evidence and only genuinely unresolved blockers.

- [ ] **Step 4: Open/prepare integration PR**

PR targets `main`, but do not merge/release to production without the normal explicit release decision.

## Plan Self-Review

- **Spec coverage:** Core/time/status/priority → Task 1; recurrence/calendar → Task 2; dependencies/week planning → Task 3; task detail/templates/reminders → Task 4; week/month UI → Task 5; workflow automation/sync → Task 6; public links → Task 7; dashboard/customer/archive/stats/performance/mobile projections → Task 8; full tests/migration/release → Tasks 9–11.
- **No parallel task store:** all persistent task data remains in authorized team state; public endpoint is read-only and task runtime has no local persistent store.
- **Type/name consistency:** `ExportHUBTaskCoreV2`, `ExportHUBTaskRecurrenceV2`, `ExportHUBTaskPlannerV2`, `ExportHUBTaskWorkflowV2`, `ExportHUBTaskUIV2`, `ExportHUBTaskProjectionsV2` are the only new module APIs referenced between tasks.
- **High-risk review focus covered:** timezone Task 1/2; legacy collisions Task 1; event idempotency/concurrency Task 6; large archive Task 8; public token isolation Task 7.
- **Scope:** no unrelated shipment/QR/POD/print redesign; those modules are touched only where a confirmed business transition must emit a task event.
