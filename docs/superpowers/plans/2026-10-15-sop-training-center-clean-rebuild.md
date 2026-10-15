# SOP & Training Center Clean Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the complete legacy ExportHUB360 SOPMaster runtime, UI and SOP-specific data with a new SOP & Training Center whose demo business data can never reach productive persistence.

**Architecture:** Build the replacement under a new `assets/training-center/` namespace with its own data contract, UI, in-memory training state, target registry, tour engine and central write guard. The new persistent state is isolated under `sopTrainingCenter`; legacy `isoSops`, `sopLearningProgress`, `ExportHubIsoSopCatalog` and old `assets/sop/*` runtime are never fallback sources. Productive shipment/customer/ABD/QR/document/pickup paths remain functionally unchanged and are only observed or safely adapted during training.

**Tech Stack:** Existing vanilla HTML/CSS/JavaScript application, Node test runner, Playwright E2E, current three-environment build chain (`.github/rc1112` + `.github/rc1521` release integration), existing ExportHUB state API.

**Spec:** `docs/superpowers/specs/2026-10-15-sop-training-center-rebuild-design.md`

## Global Constraints

- No legacy SOP design, SOP content, SOP catalog, SOP screenshots, customer overlays, training definitions, favorites, recents, learning progress, versions or SOP audit data may be migrated into the new feature.
- No runtime reader in the new feature may consume `isoSops`, `sopLearningProgress`, `ExportHubIsoSopCatalog` or any old SOPMaster global as fallback.
- Productive shipments, customers, tasks, ABD/customs, documents, QR, pickups, loading lists, POD, pallet account and business history must remain unchanged.
- Demo business data is memory-only and must never enter the state-save API, LocalStorage, SessionStorage or productive business collections.
- The only training-related persistent payload is allowlisted learning metadata: `userId`, `trainingId`, `version`, `completed`, `progressPercent`, `completedAt`, `updatedAt`.
- The permanent training banner text is exactly `TRAININGSMODUS – KEINE PRODUKTIVDATEN` plus the approved explanatory sentence.
- UI must work on desktop/tablet/mobile, keyboard, screen reader and every current ExportHUB360 theme.
- Existing real field/button names are authoritative; do not invent labels where current components exist.
- The feature may not be reported as 100% until the exact release SHA is on production and the production smoke plus zero-demo-persistence proof pass.

## Review Focus

1. A malicious or accidental training write reaches `/api/exporthub-state` or another productive write path: it must be rejected before productive mutation and fail the test.
2. Reload/login after training resurrects demo customer/shipment/document/ABD data: no demo business object may exist after reload or server reread.
3. Legacy SOP state still renders when new state is empty: the new center must show an empty/new-system state, never a legacy fallback.
4. Legacy cleanup removes a non-SOP business property: before/after business snapshots must be byte-equivalent for protected collections.
5. Responsive tour panel obscures the required control or loses keyboard focus: E2E must prove usable target visibility and focus restoration on laptop/tablet/mobile.

---

### Task 1: New data contract and isolated persistent store

**Files:**
- Create: `assets/training-center/model.js`
- Create: `assets/training-center/store.js`
- Create: `api/shared/training-center.js`
- Modify: `api/shared/merge.js`
- Test: `test/training-center-model.test.mjs`
- Test: `test/training-center-persistence-policy.test.mjs`
- Test: `test/training-center-no-legacy-fallback.test.mjs`

**Interfaces:**
- Produces `globalThis.ExportHubTrainingCenterModel.normalizeCenter(value)` and `.normalizeLearningProgress(value)`.
- Produces `globalThis.ExportHubTrainingCenterStore.read(state)` and `.writeCenter(state, patch)` using only `state.sopTrainingCenter`.
- Server helper `sanitizeTrainingCenterPatch(value)` allowlists new SOP data and learning metadata and rejects demo business fields.

- [ ] **Step 1:** Write failing tests proving an empty `sopTrainingCenter` never reads `isoSops`, `sopLearningProgress` or `ExportHubIsoSopCatalog`, and proving learning-progress objects discard every non-allowlisted property.
- [ ] **Step 2:** Run `node --test test/training-center-model.test.mjs test/training-center-persistence-policy.test.mjs test/training-center-no-legacy-fallback.test.mjs`; expect FAIL because the new modules do not exist.
- [ ] **Step 3:** Implement the new schema/store and server sanitizer; integrate only the new `sopTrainingCenter` branch into `api/shared/merge.js` without changing protected business collection merge semantics.
- [ ] **Step 4:** Rerun the three tests; expect PASS.
- [ ] **Step 5:** Commit as `feat(training-center): add isolated data contract`.

### Task 2: New SOP & Training Center shell and navigation

**Files:**
- Create: `assets/training-center/ui.js`
- Create: `assets/training-center/ui.css`
- Create: `assets/training-center/runtime.js`
- Test: `test/training-center-ui.test.mjs`
- Test: `e2e/specs/training-center-shell.spec.mjs`
- Modify: `assets/i18n/de.json`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/pl.json`
- Modify: `assets/i18n/es.json`
- Modify: `assets/i18n/fr.json`
- Modify: `assets/i18n/it.json`

**Interfaces:**
- `ExportHubTrainingCenterRuntime.mount(root, context)` owns the new SOP route view.
- `ExportHubTrainingCenterUi.render(center, options)` renders Standardprozesse, Kundenspezifische SOPs, Trainings, search, categories, favorites, recents and metadata.

- [ ] **Step 1:** Write failing UI/E2E tests for the three main areas, global search, category navigation, favorites/recents, responsive collapse, keyboard navigation and absence of legacy SOP CSS/classes/globals in the rendered center.
- [ ] **Step 2:** Run the targeted Node/UI tests and Playwright shell spec; expect FAIL.
- [ ] **Step 3:** Implement the completely new UI under `assets/training-center/`; add six-language keys without reusing old SOPMaster presentation components.
- [ ] **Step 4:** Run tests on laptop/tablet/mobile projects and all available theme fixtures; expect PASS and no horizontal overflow.
- [ ] **Step 5:** Commit as `feat(training-center): build new center UI`.

### Task 3: First standard SOP and customer deviation model

**Files:**
- Create: `assets/training-center/catalog/shipment-registration.js`
- Create: `assets/training-center/customer-sop.js`
- Create: `assets/training-center/screenshots.js`
- Test: `test/training-center-shipment-sop.test.mjs`
- Test: `test/training-center-customer-sop.test.mjs`

**Interfaces:**
- `ExportHubShipmentRegistrationSop` contains the approved 17 chapters and structured step fields.
- `ExportHubTrainingCustomerSop.resolve(baseProcess, customerSop)` returns the base SOP plus visibly separate deviations, never duplicated standard text.

- [ ] **Step 1:** Write failing tests for all 17 required chapters and per-step structured fields: title, short instruction, explanation, purpose, checkpoints, common errors, warnings, screenshot reference, route/target and both action buttons.
- [ ] **Step 2:** Pin current shipment behavior in the test: shipment reference is generated/read-only and must be checked, not manually entered.
- [ ] **Step 3:** Add customer-SOP tests requiring `baseProcessId`, every approved deviation section, and visible `Es gilt zusätzlich der Standardprozess …` output.
- [ ] **Step 4:** Implement the standard SOP, screenshot registry and customer-deviation resolver using current ExportHUB terminology only.
- [ ] **Step 5:** Run both tests; expect PASS, then commit `feat(training-center): add shipment SOP and customer deviations`.

### Task 4: Memory-only training state and hard write guard

**Files:**
- Create: `assets/training-center/training-state.js`
- Create: `assets/training-center/demo-adapter.js`
- Create: `assets/training-center/training-write-guard.js`
- Create: `assets/training-center/training-controller.js`
- Test: `test/training-center-memory-state.test.mjs`
- Test: `test/training-center-write-guard.test.mjs`
- Test: `e2e/specs/training-center-isolation.spec.mjs`

**Interfaces:**
- `TrainingState.start(seed)`, `.snapshot()`, `.mutate(fn)`, `.dispose()` hold demo data only in module memory.
- `TrainingWriteGuard.execute({mode, operation, payload, productive})` routes training business writes exclusively to `DemoAdapter`; direct productive execution while training throws `TRAINING_PRODUCTIVE_WRITE_BLOCKED`.
- `TrainingController.start(trainingId)`, `.pause()`, `.resume()`, `.restart()`, `.end()` coordinates lifecycle and disposal.

- [ ] **Step 1:** Write failing unit tests covering shipment/customer/task/ABD/document/loading-list/pickup/pallet/history write attempts and proving none calls the supplied productive function in training mode.
- [ ] **Step 2:** Add tests that stub LocalStorage/SessionStorage/state-save fetch and assert zero demo-business writes while permitting only sanitized learning metadata.
- [ ] **Step 3:** Implement memory state, demo adapter, write guard and controller.
- [ ] **Step 4:** Run the unit suite and isolation E2E including reload and relogin/server reread; expect PASS with no demo objects in any productive collection.
- [ ] **Step 5:** Commit as `feat(training-center): isolate training writes`.

### Task 5: New tour engine, stable target registry and training UI

**Files:**
- Create: `assets/training-center/target-registry.js`
- Create: `assets/training-center/integration/shipment-targets.js`
- Create: `assets/training-center/tour-engine.js`
- Create: `assets/training-center/tour-ui.js`
- Create: `assets/training-center/tour.css`
- Test: `test/training-center-tour-engine.test.mjs`
- Test: `test/training-center-targets.test.mjs`
- Test: `e2e/specs/training-center-tour.spec.mjs`

**Interfaces:**
- `TargetRegistry.register(key, resolver)` and `.find(key, root)` resolve unique stable targets; no coordinates.
- Shipment integration maps stable training keys to current real elements including `#rc380NewShipment`, `#shipmentCustomerSearch`, `#index289LocationSelect`, `#rc363BlockCustomer`, `#rc573ColliCard`, `#rc363WeightModal`, `#rc363BlockDocuments`, `#rc363BlockAbdDecision`, `#rc363SaveShipment` and annotates them with `data-training-target` without changing their productive behavior.
- `TourEngine.start({scenario,startStepId})`, `.handleAction(descriptor)`, `.current()`, `.pause()`, `.resume()`, `.restart()`, `.end()` advance only after action + state validation.

- [ ] **Step 1:** Write failing tests for all approved action types and for wrong action/target/validation failure never advancing progress.
- [ ] **Step 2:** Write target tests requiring exactly one element per key and rejection of missing/ambiguous targets.
- [ ] **Step 3:** Implement target registry, shipment annotations, tour engine and responsive UI with the exact permanent training banner, progress, completed/current/upcoming steps, Escape/end confirmation and focus restoration.
- [ ] **Step 4:** Run Node and E2E tour tests on desktop/tablet/mobile; verify the panel never covers the required target.
- [ ] **Step 5:** Commit as `feat(training-center): add interactive tour engine`.

### Task 6: “Meine erste Sendung” end-to-end scenario

**Files:**
- Create: `assets/training-center/scenarios/first-shipment.js`
- Test: `test/training-center-first-shipment.test.mjs`
- Test: `e2e/specs/training-center-first-shipment.spec.mjs`

**Interfaces:**
- `ExportHubTrainingScenarioFirstShipment` exposes 13 ordered training steps and a demo seed containing demo customer/recipient/shipment/colli/documents/customs information only.

- [ ] **Step 1:** Write failing contract tests for all 13 approved steps, including a deliberately missing document and an ABD/customs decision with deterministic validation.
- [ ] **Step 2:** Write E2E that completes the scenario through the real shipment UI while all mutations are served from memory-only demo state.
- [ ] **Step 3:** Implement the scenario and its validation functions without introducing fake productive field names.
- [ ] **Step 4:** Run the full scenario, end it, reload, relogin and reread server state; expect no demo customer/shipment/document/ABD/task/loading-list/pickup/pallet/history object.
- [ ] **Step 5:** Commit as `feat(training-center): add first shipment training`.

### Task 7: Build wiring, screenshot pipeline and legacy cutover safety

**Files:**
- Create: `.github/training-center/build-three-env.mjs`
- Modify: `.github/rc1521/build-three-env.mjs`
- Create: `browser/training-center-screenshots.mjs`
- Create: `assets/training-center/legacy-cleanup.js`
- Test: `test/training-center-build.test.mjs`
- Test: `test/training-center-legacy-cleanup-safety.test.mjs`
- Test: `test/training-center-release-contract.test.mjs`

**Interfaces:**
- New build integration copies/injects only `assets/training-center/*` for the replacement feature and removes old SOPMaster runtime tags from final `index.html`, `TESTVERSION.html`, `demo.html`.
- `legacyCleanup(state)` removes only explicitly allowlisted legacy SOP-specific top-level/state keys and returns protected business collections unchanged.

- [ ] **Step 1:** Write a failing build contract asserting new assets exist in all three builds and no old `assets/sop/rc1007*`, `rc1010*`, `rc1016*`, `rc1018*`, `rc1501*`, `rc1502*`, `rc1503*`, `rc1505*`, `rc1506*` runtime script/style tags remain.
- [ ] **Step 2:** Write cleanup safety tests that snapshot shipments/customers/tasks/ABD/documents/loading lists/pickups/POD/pallet/history before cleanup and assert deep equality after cleanup, while `isoSops`, `sopLearningProgress` and other enumerated legacy SOP keys are removed.
- [ ] **Step 3:** Implement the replacement build wrapper, screenshot generator and narrowly allowlisted cleanup.
- [ ] **Step 4:** Generate safe screenshots from demo/test data and run build + cleanup + release contract tests; expect PASS.
- [ ] **Step 5:** Commit as `build(training-center): wire clean SOP replacement`.

### Task 8: Remove legacy runtime source/wiring and run full release gates

**Files:**
- Delete from shipping/runtime: legacy `assets/sop/*` implementation files and obsolete SOPMaster-specific build/runtime tests after the new build no longer references them.
- Modify: `.github/workflows/exporthub-testservice.yml`
- Add/modify: release workflow tests required by current production path.
- Verify existing: `e2e/specs/shipment-create.spec.mjs` plus current QR, ABD, customs/documents, pickup, loading-list and POD suites.
- Create: `e2e/specs/training-center-production-contract.spec.mjs`

**Interfaces:**
- Release gate accepts one exact SHA only after new center tests + legacy absence + productive regression + zero-demo-persistence are green.

- [ ] **Step 1:** Remove old SOP runtime source/wiring only after Task 7 proves the replacement build is independent; repository history/docs remain available in Git history but no old SOP runtime/data is shipped or read.
- [ ] **Step 2:** Run all new unit/contract tests, six-language checks, three-environment build and Playwright responsive suites.
- [ ] **Step 3:** Run TESTSERVICE training leak test and the existing productive shipment/save/QR/status/ABD/customs/documents/pickup/loading-list/POD regression suite without weakening any assertion.
- [ ] **Step 4:** Compare protected productive business collections before/after legacy cleanup and after a complete training; require exact preservation.
- [ ] **Step 5:** Deploy only the exact green release SHA through the existing production path; run production smoke verifying new center visible, old SOP unreachable, training banner/isolation operational and normal shipment creation still works.
- [ ] **Step 6:** Only after Step 5 passes, mark project progress 100%; otherwise leave below 100% with the failing gate named.
- [ ] **Step 7:** Commit final release wiring as `release(training-center): replace legacy SOP system`.

## Plan self-review result

- Spec coverage: all approved UI, new data model, customer deviations, screenshots, tour contract, strict demo isolation, progress, accessibility, cutover, tests and 100%-only-on-production requirements map to Tasks 1–8.
- No legacy data migration is present; legacy state appears only in negative/fallback/cleanup tests.
- Training business data has no persistent interface at all; persistence accepts only allowlisted learning metadata.
- The highest-risk interfaces (write guard, legacy cleanup, real shipment regression and release SHA) each have dedicated unit/E2E/release gates.
- The plan intentionally uses a runtime shipment target integration layer instead of modifying productive shipment behavior merely to add training selectors.