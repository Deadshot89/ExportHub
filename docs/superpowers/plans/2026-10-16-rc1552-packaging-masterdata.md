# ExportHUB360 RC1552 Packaging Master Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ExportHUB360's parallel packaging lists with one centrally managed packaging master-data source while keeping historical shipments immutable and preserving QR, print, AVIS, pickup and shipping behavior.

**Architecture:** Canonical records live in `state.packagingTypes` inside the existing team-state. A pure shared domain module owns normalization, migration, CRUD, usage detection and snapshot semantics; an authenticated API wraps those functions with admin authorization and audit logging. Browser clients consume one collection-level store/event, while QR pack-station reads reuse the same domain normalization without introducing a second authority.

**Tech Stack:** Node.js >=20, CommonJS Azure Functions, vanilla JavaScript/HTML/CSS, existing ExportHUB team-state/auth-store, node:test, Playwright, existing RC1112 three-environment build.

**Spec:** `docs/superpowers/specs/2026-10-16-rc1552-packaging-masterdata-design.md`

## Global Constraints
- Canonical runtime collection is `state.packagingTypes`.
- `state.colliTypes` is migration/compatibility input only after RC1552.
- `assets/packaging-catalog.js` must not remain an independent production packaging list.
- E3 remains `43 × 31 × 31 cm` and `0.06 LDM` unless a later explicit business change says otherwise.
- New selections expose active packaging only; historical rows may continue to show inactive packaging.
- Historical display order is `packagingSnapshot` → persisted row label/type → current master lookup as last-resort compatibility fallback.
- Normal users may read/select but may not mutate packaging master data; write authorization is server-side.
- No full application reload after packaging CRUD.
- Existing shipment status, QR token semantics, pickup authorization, document count/order, AVIS tokens, dimensions/weight calculations and unrelated UI behavior must not change.
- New UI strings use existing i18n for `de`, `en`, `pl`, `es`, `fr`, `it`.
- RC1552 is 100% only after successful production deployment and production live verification.

## Review Focus
- **Legacy duplicate collision:** `Europalette`, `EUROPALETTE`, punctuation/space variants and catalog aliases must converge without dropping a used historical label. Covered in Task 1 migration tests.
- **Concurrent admin writes:** stale updates must not silently overwrite another admin's change; state mutation remains protected by the existing team-state optimistic retry path. Covered in Task 2 API tests.
- **Unrelated old-shipment edit:** saving a note/customer field must not refresh an unchanged packaging snapshot from renamed master data. Covered in Task 5 snapshot tests.
- **Anonymous QR data minimization:** pack-station `packaging-list` must expose active selection fields/dimensions only, never audit/admin metadata. Covered in Task 6 API tests.
- **Delete false-negative:** any persisted use must block hard delete and cause deactivation; ambiguous legacy label references err on history preservation rather than deletion. Covered in Task 2 usage tests.

---

### Task 1: Canonical packaging domain and idempotent migration

**Files:**
- Create: `api/shared/packaging-masterdata.js`
- Create: `api/shared/packaging-seed.js`
- Modify: `assets/packaging-catalog.js`
- Test: `test/rc1552-packaging-masterdata-model.test.mjs`
- Test: `test/packaging-catalog.test.mjs`
- Test: `test/rc1005-e3-packaging-precedence.test.mjs`

**Interfaces:**
- Produces `normalizePackagingName(value) -> string`.
- Produces `normalizePackagingCode(value) -> string`.
- Produces `migratePackagingState(state, options?) -> {state, changed, conflicts}`; mutates only the supplied state object/clone, is idempotent, imports legacy `colliTypes`, catalog migration seeds and protected E3.
- Produces `listPackaging(state, {includeInactive=false}={}) -> PackagingType[]`.
- Produces `publicPackaging(item) -> {id,name,code,description,active,lengthCm,widthCm,heightCm,ldm}`.
- Produces `snapshotPackaging(item) -> {name,code,description,lengthCm,widthCm,heightCm,ldm}`.
- Produces `resolveHistoricalPackaging(row, state?) -> {id,name,code,description,lengthCm,widthCm,heightCm,ldm}|null` with snapshot-first precedence.
- `assets/packaging-catalog.js` remains only a compatibility adapter/alias helper; it must not own the production entries array after this task.

- [ ] **Step 1: Write failing model tests** asserting normalization rejects case-only duplicates, migration merges catalog/legacy duplicates, E3 is `43/31/31/0.06`, inactive state is retained, and running migration twice produces the same `packagingTypes` set.

- [ ] **Step 2: Run the focused model tests and verify RED**

Run: `node --test test/rc1552-packaging-masterdata-model.test.mjs test/packaging-catalog.test.mjs test/rc1005-e3-packaging-precedence.test.mjs`

Expected: FAIL because the RC1552 domain/migration interfaces do not exist and the catalog is still authoritative.

- [ ] **Step 3: Implement `api/shared/packaging-seed.js`** with migration-only canonical pallet seeds/aliases and the protected E3 value. Keep this module server/domain-facing; consumers do not read it as a runtime list.

- [ ] **Step 4: Implement `api/shared/packaging-masterdata.js`** with the interfaces above, stable `PKG-...` ids for migrated known entries, duplicate conflict reporting and no silent loss of legacy records.

- [ ] **Step 5: Convert `assets/packaging-catalog.js` into a compatibility adapter** that delegates list/get to `window.ExportHUBPackagingStore` when present and otherwise provides alias/normalization behavior only; remove the independent production `entries` authority.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test test/rc1552-packaging-masterdata-model.test.mjs test/packaging-catalog.test.mjs test/rc1005-e3-packaging-precedence.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/shared/packaging-masterdata.js api/shared/packaging-seed.js assets/packaging-catalog.js test/rc1552-packaging-masterdata-model.test.mjs test/packaging-catalog.test.mjs test/rc1005-e3-packaging-precedence.test.mjs
git commit -m "RC1552: centralize packaging domain"
```

### Task 2: Authenticated packaging CRUD, audit and safe delete/archive

**Files:**
- Create: `api/packaging-masterdata/index.js`
- Create: `api/packaging-masterdata/function.json`
- Modify: `api/shared/packaging-masterdata.js`
- Test: `test/rc1552-packaging-masterdata-api.test.mjs`

**Interfaces:**
- Uses `auth.validateSession(req)`, `auth.isAdmin(user)`, `auth.mutateTeamForRequest(req, mutator)`, `auth.addAudit(team,type,actor,details)`.
- GET `/api/packaging-masterdata?includeInactive=0|1` returns `{ok:true,items,canEdit}`; `includeInactive=1` is honored only for admins.
- POST body `{action:'create'|'duplicate', ...}`.
- PATCH body `{action:'update'|'activate'|'deactivate', id, ...}`.
- DELETE body `{id}`.
- Produces domain functions `createPackaging`, `updatePackaging`, `duplicatePackaging`, `setPackagingActive`, `usageOfPackaging`, `deleteOrArchivePackaging`.
- Every mutation returns `before`/`after` to the API so audit entries contain immutable change evidence.

- [ ] **Step 1: Write failing API tests** for create, update, duplicate, activation, deactivation, normalized-name/code duplicate rejection, normal-user 403 mutations, normal-user active-only GET, admin inactive GET, and audit before/after values.

- [ ] **Step 2: Add failing usage/delete tests** covering unused hard delete, id-based used reference, legacy-label used reference, pack notification/task use, and ambiguous legacy matches choosing deactivation instead of hard delete.

- [ ] **Step 3: Add a concurrent-mutation contract test** proving the endpoint uses `auth.mutateTeamForRequest` rather than direct blob overwrite and leaves unrelated state keys intact.

- [ ] **Step 4: Run focused API tests and verify RED**

Run: `node --test test/rc1552-packaging-masterdata-api.test.mjs`

Expected: FAIL because endpoint/CRUD interfaces do not exist.

- [ ] **Step 5: Implement the domain mutation functions** in `api/shared/packaging-masterdata.js`; validation: required trimmed name, case-insensitive normalized name uniqueness across active/inactive, optional case-insensitive code uniqueness, bounded description, boolean active, positive finite optional dimensions/LDM.

- [ ] **Step 6: Implement `api/packaging-masterdata/index.js`** using the existing session/team object for GET and `mutateTeamForRequest` for writes. Admin is the only write role. Use audit types `packaging.created`, `packaging.updated`, `packaging.activated`, `packaging.deactivated`, `packaging.deleted`.

- [ ] **Step 7: Implement delete response semantics**: `{deleted:true,archived:false}` for never-used data; `{deleted:false,archived:true,item}` plus the required history-preservation message for used data.

- [ ] **Step 8: Run focused API tests and verify GREEN**

Run: `node --test test/rc1552-packaging-masterdata-api.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/packaging-masterdata api/shared/packaging-masterdata.js test/rc1552-packaging-masterdata-api.test.mjs
git commit -m "RC1552: add packaging masterdata API"
```

### Task 3: Shared browser packaging store and no-reload propagation

**Files:**
- Create: `assets/rc1552-packaging-store.js`
- Modify: `assets/packaging-catalog.js`
- Test: `test/rc1552-packaging-store.test.mjs`
- Modify: `.github/rc1112/build-three-env.mjs`

**Interfaces:**
- Produces `window.ExportHUBPackagingStore` with `load(options?)`, `items()`, `activeItems()`, `get(idOrName)`, `replace(items)`, `upsert(item)`, `remove(id)`, `subscribe(fn)`.
- Emits browser event `exporthub:packaging-masterdata-changed` with `{reason,itemId}`.
- `load()` calls `/api/packaging-masterdata` with the existing authenticated fetch/session conventions; it must not navigate or reload the document.
- Existing `ExportHubPackagingCatalog.list/get` delegates to this store once loaded.

- [ ] **Step 1: Write failing store tests** for deduped active choices, lookup by id/name/code, subscribe/unsubscribe, create/update propagation and absence of `location.reload`, navigation or global render calls.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/rc1552-packaging-store.test.mjs`

Expected: FAIL because store does not exist.

- [ ] **Step 3: Implement `assets/rc1552-packaging-store.js`** with collection-level replacement/update and event dispatch only after successful API/state changes.

- [ ] **Step 4: Update RC1112 build** so the store is copied/injected before RC1552 consumers in production, testservice and local distribution outputs.

- [ ] **Step 5: Run focused tests and RC1112 build**

Run: `node --test test/rc1552-packaging-store.test.mjs && node .github/rc1112/build-three-env.mjs`

Expected: PASS and build exits 0.

- [ ] **Step 6: Commit**

```bash
git add assets/rc1552-packaging-store.js assets/packaging-catalog.js .github/rc1112/build-three-env.mjs test/rc1552-packaging-store.test.mjs
git commit -m "RC1552: add live packaging client store"
```

### Task 4: Management → Stammdaten → Verpackungen admin UI

**Files:**
- Create: `assets/rc1552-packaging-admin.js`
- Create: `assets/rc1552-packaging-admin.css`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: `assets/i18n/de.json`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/pl.json`
- Modify: `assets/i18n/es.json`
- Modify: `assets/i18n/fr.json`
- Modify: `assets/i18n/it.json`
- Test: `test/rc1552-packaging-admin-ui.test.mjs`
- Test: `test/rc1552-packaging-i18n.test.mjs`

**Interfaces:**
- Consumes `window.ExportHUBPackagingStore` and existing current-user/admin helpers.
- Adds admin navigation path `Management → Stammdaten → Verpackungen` without exposing mutation controls to normal users.
- Management table fields: name, code, description, active/inactive, updatedAt, updatedBy, actions.
- Search matches name/code/description; status filter values `active|inactive|all`; sort supports at least name/status/updatedAt.
- Create/edit form fields are exactly the requested RC1552 user-editable set: name, code, description, active. Existing migrated dimensions/LDM remain preserved but are not added as new editable UI scope.

- [ ] **Step 1: Write failing UI contract tests** for navigation, admin-only actions, columns, add/edit/duplicate/activate/deactivate/delete flows, required confirmation copy, success messages, search/filter/sort and mobile-safe layout.

- [ ] **Step 2: Write failing i18n coverage test** requiring all RC1552 keys in all six locale files and no hard-coded management copy in the runtime except fallback diagnostics.

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test test/rc1552-packaging-admin-ui.test.mjs test/rc1552-packaging-i18n.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Implement admin UI runtime/CSS** using existing ExportHUB visual conventions. CRUD success updates the store/table in place and preserves scroll/focus where practical.

- [ ] **Step 5: Add six-language strings** including create/update success, delete question, used-delete archive notice, validation/status/action labels.

- [ ] **Step 6: Wire assets through RC1112 build** after the shared packaging store.

- [ ] **Step 7: Run focused UI/i18n tests and strict i18n verification**

Run: `node --test test/rc1552-packaging-admin-ui.test.mjs test/rc1552-packaging-i18n.test.mjs && npm run verify:i18n`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add assets/rc1552-packaging-admin.js assets/rc1552-packaging-admin.css assets/i18n .github/rc1112/build-three-env.mjs test/rc1552-packaging-admin-ui.test.mjs test/rc1552-packaging-i18n.test.mjs
git commit -m "RC1552: add packaging management UI"
```

### Task 5: Shipment searchable selector and immutable packaging snapshot

**Files:**
- Create: `assets/rc1552-packaging-shipment.js`
- Modify: `.github/rc1112/build-three-env.mjs`
- Test: `test/rc1552-packaging-shipment.test.mjs`
- Modify/Test: `test/rc1171-shipment-create-ui-e2e.test.mjs`
- Modify: `e2e/specs/shipment-create.spec.mjs`

**Interfaces:**
- Consumes `ExportHUBPackagingStore.activeItems()`.
- Produces `window.ExportHUBPackagingShipment.applySelection(row, packaging)` and `snapshotRows(shipment, previousShipment?)`.
- On explicit selection, row stores `packagingTypeId`, `packagingSnapshot` and the current persisted display label (`type`/existing canonical row field) together.
- `snapshotRows` preserves an existing row snapshot when packaging was not explicitly changed; it never refreshes snapshot solely because master name/code changed.
- Searchable selector filters by name/code, is keyboard accessible, and excludes inactive choices while preserving an already-selected inactive historical value.

- [ ] **Step 1: Write failing snapshot tests** for new save snapshot, rename/new shipment sees new name, old shipment keeps old snapshot, unrelated old-shipment edit preserves snapshot, explicit packaging change creates a new snapshot.

- [ ] **Step 2: Add failing selector contract tests** for active-only options, searchable name/code, no duplicates, and no page reload/global rerender.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test test/rc1552-packaging-shipment.test.mjs test/rc1171-shipment-create-ui-e2e.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Implement shipment adapter** at the existing RC363 Colli row/read-save boundary; do not create a parallel shipment save pipeline.

- [ ] **Step 5: Extend browser shipment-create spec** to create/select an RC1552 packaging type, save, reopen and assert persisted snapshot/label.

- [ ] **Step 6: Run focused unit/contract and browser shipment test**

Run: `node --test test/rc1552-packaging-shipment.test.mjs test/rc1171-shipment-create-ui-e2e.test.mjs && npx playwright test e2e/specs/shipment-create.spec.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add assets/rc1552-packaging-shipment.js .github/rc1112/build-three-env.mjs test/rc1552-packaging-shipment.test.mjs test/rc1171-shipment-create-ui-e2e.test.mjs e2e/specs/shipment-create.spec.mjs
git commit -m "RC1552: snapshot shipment packaging"
```

### Task 6: QR pack-station uses canonical active packaging

**Files:**
- Modify: `api/pack-notification/index.js`
- Modify: `assets/pack-notification.js`
- Modify: `pack.html`
- Modify: `assets/pack.html`
- Test: `test/pack-notification-customer-search.test.mjs`
- Test: `test/pack-notification-page.test.mjs`
- Test: `test/rc1514-pack-read-contention.test.mjs`
- Create: `test/rc1552-packaging-packstation.test.mjs`

**Interfaces:**
- `packaging-list` consumes `migratePackagingState(clone(state))` + `listPackaging(...,{includeInactive:false})`; it remains read-only.
- Pack-station response fields are limited to `id,name,code,length,width,height,ldm` (plus stable selection source marker if current client requires it); no description/audit/actor fields unless explicitly needed by UI.
- Pack submission/draft stores `packagingTypeId` and `packagingSnapshot` while retaining current `packageType` compatibility text.

- [ ] **Step 1: Update failing pack API tests** so canonical `packagingTypes` wins, legacy `colliTypes` is migration fallback only, inactive is excluded and E3 remains protected.

- [ ] **Step 2: Add failing privacy/read-contention tests** proving `packaging-list` leaks no audit/admin metadata and does not invoke state mutation/write serialization.

- [ ] **Step 3: Add failing draft/submit snapshot tests** for `packagingTypeId`, snapshot and backward-compatible `packageType`.

- [ ] **Step 4: Run focused tests and verify RED**

Run: `node --test test/pack-notification-customer-search.test.mjs test/pack-notification-page.test.mjs test/rc1514-pack-read-contention.test.mjs test/rc1552-packaging-packstation.test.mjs`

Expected: FAIL.

- [ ] **Step 5: Implement API/client integration** using the canonical domain and searchable pack-station choices; update pack page load order so compatibility catalog/store is available before `pack-notification.js`.

- [ ] **Step 6: Run focused pack tests and verify GREEN**

Run: `node --test test/pack-notification-customer-search.test.mjs test/pack-notification-page.test.mjs test/rc1514-pack-read-contention.test.mjs test/rc1552-packaging-packstation.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/pack-notification/index.js assets/pack-notification.js pack.html assets/pack.html test/pack-notification-customer-search.test.mjs test/pack-notification-page.test.mjs test/rc1514-pack-read-contention.test.mjs test/rc1552-packaging-packstation.test.mjs
git commit -m "RC1552: use packaging masterdata at pack station"
```

### Task 7: Historical output and downstream shipping consumers

**Files:**
- Modify: `assets/rc1027-lieferavis-immediate.js`
- Modify: `api/shared/pod-archive.js`
- Modify: `api/exporthub-state/index.js`
- Modify only where current build requires historical print/loading-list row resolution: `index.html`, `TESTVERSION.html`, `.github/rc1112/build-three-env.mjs`
- Test: `test/rc1552-packaging-history-output.test.mjs`
- Test: `test/rc1548-shipping-cost-autofill.test.mjs`
- Test: existing print/loading-list regression tests discovered by repository search during implementation

**Interfaces:**
- Historical output uses one equivalent resolver contract: `packagingSnapshot.name` first, then persisted legacy row label fields, current master only last.
- Shipping-cost/UPS calculations continue to consume the persisted row dimensions/count/weight and must not replace them from renamed master data.
- State sanitization/migration exposes canonical packaging choices without rewriting historical shipment rows.

- [ ] **Step 1: Write failing historical-output tests** with a shipment snapshot named `Einwegpalette` and a current master renamed to `Holz-Einwegpalette`; loading-list/print/AVIS/POD output must still contain `Einwegpalette`.

- [ ] **Step 2: Add failing legacy fallback tests** for old rows with only `type`/`packaging` and no snapshot; output remains unchanged.

- [ ] **Step 3: Extend shipping-cost regression** proving existing row dimensions are used after master rename/deactivation.

- [ ] **Step 4: Run focused tests and verify RED where snapshot precedence is missing**

Run: `node --test test/rc1552-packaging-history-output.test.mjs test/rc1548-shipping-cost-autofill.test.mjs`

Expected: at least the new snapshot-precedence assertions fail before implementation.

- [ ] **Step 5: Implement the smallest historical resolver changes** in the existing render/extraction boundaries. Do not change document count/order/layout or shipping formulas.

- [ ] **Step 6: Run historical + print/loading-list + shipping regressions**

Run: `node --test test/rc1552-packaging-history-output.test.mjs test/rc1548-shipping-cost-autofill.test.mjs test/*print*.test.mjs test/*load*.test.mjs`

Expected: PASS for matching repository tests; if shell glob includes no file, run the explicitly discovered print/loading-list test paths instead.

- [ ] **Step 7: Commit**

```bash
git add assets/rc1027-lieferavis-immediate.js api/shared/pod-archive.js api/exporthub-state/index.js index.html TESTVERSION.html .github/rc1112/build-three-env.mjs test/rc1552-packaging-history-output.test.mjs test/rc1548-shipping-cost-autofill.test.mjs
git commit -m "RC1552: preserve historical packaging output"
```

### Task 8: Whole-feature browser acceptance and release-contract gate

**Files:**
- Create: `e2e/specs/rc1552-packaging-masterdata.spec.mjs`
- Create: `test/rc1552-packaging-release-contract.test.mjs`
- Modify: `.github/rc1112/build-three-env.mjs`
- Modify: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml` only if a dedicated RC1552 browser gate cannot be expressed by the existing release test hook.

**Interfaces:**
- E2E fixture/admin flow creates a temporary packaging entry with a unique run id, verifies immediate selector availability, edits it, verifies historical snapshot, deletes unused, auto-deactivates used, reactivates, then cleans up only records safe to delete.
- Release contract scans built assets and fails if a new independent production packaging options array/catalog is introduced outside migration seed/compatibility code.

- [ ] **Step 1: Write the release-contract test** to require RC1552 assets/API in all three build outputs and reject independent hard-coded production packaging lists.

- [ ] **Step 2: Write Playwright acceptance coverage** for user acceptance criteria 1–13, including normal-user mutation denial and no horizontal overflow at `390×844` plus desktop `1366×768`.

- [ ] **Step 3: Run focused contract/E2E and fix only RC1552 defects**

Run: `node --test test/rc1552-packaging-release-contract.test.mjs && npx playwright test e2e/specs/rc1552-packaging-masterdata.spec.mjs`

Expected: PASS.

- [ ] **Step 4: Build all environments**

Run: `node .github/rc1112/build-three-env.mjs`

Expected: exit 0 and RC1552 assets/routes present in production/testservice/local build outputs.

- [ ] **Step 5: Commit**

```bash
git add e2e/specs/rc1552-packaging-masterdata.spec.mjs test/rc1552-packaging-release-contract.test.mjs .github/rc1112/build-three-env.mjs .github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml
git commit -m "RC1552: gate packaging masterdata release"
```

### Task 9: Full regression, production deployment and 100% proof

**Files:**
- Modify only defects found by verification; no opportunistic feature work.
- Update release/status documentation only after evidence exists.

**Interfaces:**
- Completion evidence consists of focused tests, full regression, release build, deployment success and production live checks.

- [ ] **Step 1: Run full repository regression**

Run: `npm test`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Run security/accessibility/i18n release verification**

Run: `npm run verify:release && npm run verify:i18n`

Expected: PASS.

- [ ] **Step 3: Re-run RC1552 browser acceptance against TESTSERVICE/release candidate** and verify criteria 1–14 before merge/deployment.

- [ ] **Step 4: Merge/deploy through the existing production workflow only after all gates are green.** Do not report 100% at merge time.

- [ ] **Step 5: Verify production live**: admin page CRUD, immediate new-shipment selection, historical rename isolation, unused delete, used-delete→inactive, reactivate, normal-user read-only, QR pack station, print/loading list and AVIS.

- [ ] **Step 6: Mark RC1552 100% only if Step 5 passes.** If deployment or live proof fails, leave the item below 100% and record the blocker.

- [ ] **Step 7: Final commit/status update if required**

```bash
git status --short
git log --oneline --decorate -10
```

Expected: clean branch after final approved fixes/status documentation.

## Acceptance Criteria Traceability

1. Add packaging → Tasks 2, 4, 8
2. Immediate new-shipment availability → Tasks 3, 5, 8
3. Edit packaging → Tasks 2, 4, 8
4. Edited value for new shipments → Tasks 3, 5, 8
5. Historical shipment unchanged → Tasks 5, 7, 8
6. Delete unused → Tasks 2, 4, 8
7. Used delete auto-deactivates → Tasks 2, 4, 8
8. Inactive not offered for new selection → Tasks 1, 3, 5, 6, 8
9. Reactivate → Tasks 2, 4, 8
10. Normal-user permissions → Tasks 2, 4, 8
11. Search/filter/sort → Task 4, 8
12. Print/loading-list regression → Task 7, 9
13. QR pack-station regression → Task 6, 8, 9
14. Build/full regression → Tasks 8, 9
15. Production deployment + live proof before 100% → Task 9
