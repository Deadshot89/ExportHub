# RC1550 SOP-Neuaufbau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible legacy SOP-Handbuch with a clean active SOP directory containing only newly created SOPs, starting with the fully illustrated BSH/Neff/Gaggenau transport-registration SOP and an empty DHL carrier group.

**Architecture:** Keep the existing SOP model, editor, Guided Workspace, visuals, versioning, permissions and learning runtimes, but replace the *active catalog contract* and remove hard dependencies on `SOP-EH-xxx`. The new catalog becomes authoritative after the historical RC1007/RC1016 bootstrap, while reconciliation strips non-canonical legacy SOPs from the active view. UI grouping changes from the old area/handbook presentation to category → group → SOP.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, Node.js 20 test runner, Playwright, existing ExportHUB i18n runtime, existing SOPMaster/Guided Workspace modules.

**Spec:** `docs/superpowers/specs/2026-10-16-sop-rebuild-design.md`

## Global Constraints

- The visible term **“SOP-Handbuch”** must be removed from the productive SOP UI.
- Old active `SOP-EH-xxx` documents must not appear in normal navigation or search.
- New top-level SOP categories are exactly: **Kunden-SOPs**, **Versanddienstleister**, **Prozess-SOPs**.
- Initial productive customer SOP path: **Kunden-SOPs > BSH-Gruppe > Transportanmeldung BSH-Gruppe**.
- Initial carrier path: **Versanddienstleister > DHL**; no existing DHL test fixture may be published as a real SOP.
- The BSH SOP covers BSH, Neff and Gaggenau.
- BSH registration should be done by 13:00, latest 13:30.
- `WPA` means one-way pallet and is always non-stackable.
- The existing Guided Workspace, permissions, versioning, visual zoom, editor foundations, training/exam infrastructure and responsive behavior remain available.
- No old SOP content is silently migrated into a new SOP.
- Git history is sufficient as rollback/history; no visible legacy archive is required.
- All six ExportHUB languages remain structurally complete.
- No unrelated ExportHUB functions or designs may be changed.
- Progress may show 100% only after successful production deploy and live verification.

## Review Focus

1. **Old persisted `isoSops` state:** legacy `SOP-EH-xxx` entries must not reappear just because a browser still has old state; Task 1 and Task 5 pin this.
2. **Empty carrier group:** DHL must remain visible as a group even with zero published SOPs, without fabricating a DHL SOP; Task 4 pins this.
3. **Removed direct links:** opening an old SOP number must show a clear unavailable/not-found state, not silently open BSH; Task 4 and Task 8 pin this.
4. **BSH image failures/mobile sizing:** all eleven screenshots must render responsively and image-load failures must degrade to the existing safe placeholder; Task 3 and Task 8 pin this.
5. **Existing SOPMaster consumers:** Guided Workspace/coverage/tour readers must reconcile state against the new canonical catalog instead of reading stale state directly; Task 5 pins this.

---

## File Structure

### New files

- `assets/sop/rc1550-sop-active-catalog.js` — authoritative new catalog with category metadata and the released BSH SOP.
- `assets/sop/screenshots/bsh/bsh-01-portal.png`
- `assets/sop/screenshots/bsh/bsh-02-function.png`
- `assets/sop/screenshots/bsh/bsh-03-customer-start.png`
- `assets/sop/screenshots/bsh/bsh-04-plant-number.png`
- `assets/sop/screenshots/bsh/bsh-05-plant-select.png`
- `assets/sop/screenshots/bsh/bsh-06-date-time.png`
- `assets/sop/screenshots/bsh/bsh-07-packaging.png`
- `assets/sop/screenshots/bsh/bsh-08-exporthub-ref.png`
- `assets/sop/screenshots/bsh/bsh-09-delivery-notices.png`
- `assets/sop/screenshots/bsh/bsh-10-create-shipment-number.png`
- `assets/sop/screenshots/bsh/bsh-11-success-number.png`
- `.github/rc1550/integrate-sop-rebuild.mjs` — final-build integration/copy step.
- `test/rc1550-sop-model.test.mjs`
- `test/rc1550-sop-catalog.test.mjs`
- `test/rc1550-sop-assets.test.mjs`
- `test/rc1550-sop-runtime-isolation.test.mjs`
- `test/rc1550-sop-build.test.mjs`
- `e2e/specs/sop-rebuild.spec.mjs`

### Existing files to modify

- `assets/sop/rc1007-sop-model.js`
- `assets/sop/rc1007-sop-ui.js`
- `assets/sop/rc1007-sop.css`
- `assets/sop/rc1505-sop-coverage.js`
- `assets/sop/rc1506-sop-coverage-runtime.js`
- `assets/sop/rc1544-sop-guided-workspace.js`
- `assets/i18n/de.json`
- `assets/i18n/en.json`
- `assets/i18n/pl.json`
- `assets/i18n/es.json`
- `assets/i18n/fr.json`
- `assets/i18n/it.json`
- `.github/packmeldungen/build-three-env.mjs`
- `.github/workflows/sopmaster-core-verify.yml`
- `test/rc1007-sop-ui.test.mjs`
- `test/rc1009-sop-selection-ui.test.mjs`
- `e2e/specs/navigation.spec.mjs`
- `e2e/specs/sopmaster-guided-workspace.spec.mjs`

Historical RC1016 files stay in git for reproducibility but are no longer the final active productive catalog.

---

### Task 1: Generalize the SOP model from `SOP-EH-xxx` to canonical document identities

**Files:**
- Modify: `assets/sop/rc1007-sop-model.js`
- Create: `test/rc1550-sop-model.test.mjs`
- Update compatibility assertions only if required: `test/rc1009-sop-selection-ui.test.mjs`

**Interfaces:**
- Consumes: `storedDocuments: SopDocument[]`, `canonicalDocuments: SopDocument[]`.
- Produces: unchanged public API `ExportHubIsoSopModel.reconcileCatalog(storedDocuments, canonicalDocuments)`.
- Produces: unchanged public API `ExportHubIsoSopModel.filterDocuments(documents, filters)` with expanded searchable metadata.
- Canonical identity is now `text(doc.number)` rather than the regex `^SOP-EH-\d{3}$`.

- [ ] **Step 1: Write failing reconciliation tests**

Add tests asserting:

```js
const canonical=[{
  number:'SOP-CUST-BSH-001',
  type:'customer',
  category:'customer',
  group:'BSH-Gruppe',
  title:'Transportanmeldung BSH-Gruppe',
  version:'1.0',
  status:'Freigegeben'
}];

const result=model.reconcileCatalog([
  {number:'SOP-EH-060',type:'process',title:'Alt'},
  {number:'SOP-CUST-BSH-001',type:'customer',title:'Gespeichert',version:'1.0'}
],canonical);

assert.deepEqual(result.map(x=>x.number),['SOP-CUST-BSH-001']);
```

Also assert that a stored customer overlay is preserved **only** when its `baseProcessSop`/`baseSopNumber` points to a canonical SOP.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test test/rc1550-sop-model.test.mjs
```

Expected: FAIL because reconciliation currently filters by `SOP-EH-xxx`.

- [ ] **Step 3: Generalize `reconcileCatalog`**

Replace regex-based canonical/stored selection with exact canonical-number matching. Preserve version/audit merge behavior. Do not return stored non-canonical process documents. Preserve stored customer overlays only when their base SOP is still canonical.

- [ ] **Step 4: Expand `filterDocuments` search metadata**

Keep existing query/area/status behavior and add these searchable fields when present:

```text
category
group
provider
customerIds[]
carrierIds[]
```

Do not introduce fuzzy search.

- [ ] **Step 5: Verify new and historical model tests**

Run:

```bash
node --test \
  test/rc1550-sop-model.test.mjs \
  test/rc1009-sop-selection-ui.test.mjs \
  test/rc1500-sop-model-migration.test.mjs \
  test/rc1010-sop-release-readiness.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/sop/rc1007-sop-model.js test/rc1550-sop-model.test.mjs test/rc1009-sop-selection-ui.test.mjs
git commit -m "refactor: make SOP catalog reconciliation canonical"
```

---

### Task 2: Create the new active SOP catalog with BSH and category metadata

**Files:**
- Create: `assets/sop/rc1550-sop-active-catalog.js`
- Create: `test/rc1550-sop-catalog.test.mjs`

**Interfaces:**
- Consumes: existing `globalThis.ExportHubIsoSopCatalog` only as a bootstrap prerequisite; does not copy its active documents.
- Produces: `globalThis.ExportHubIsoSopCatalog` with:
  - `version: 'RC1550'`
  - `documents`
  - `categories`
  - `byNumber`
  - `get(number)`
- Productive BSH number: `SOP-CUST-BSH-001`.

- [ ] **Step 1: Write failing catalog tests**

Assert exact active structure:

```js
assert.equal(catalog.version,'RC1550');
assert.deepEqual(catalog.documents.map(d=>d.number),['SOP-CUST-BSH-001']);
assert.equal(catalog.documents.some(d=>/^SOP-EH-\d{3}$/.test(d.number)),false);
assert.deepEqual(catalog.categories.map(c=>c.id),['customer','carrier','process']);
assert.equal(catalog.get('SOP-EH-060'),null);
```

Assert groups:
- customer → `BSH-Gruppe`
- carrier → `DHL`
- process → no invented SOP required.

Assert the DHL group contains zero productive documents.

- [ ] **Step 2: Run RED**

```bash
node --test test/rc1550-sop-catalog.test.mjs
```

Expected: FAIL because the RC1550 catalog does not exist.

- [ ] **Step 3: Implement `SOP-CUST-BSH-001`**

Create the released version `1.0` with:
- `type: 'customer'`
- `category: 'customer'`
- `group: 'BSH-Gruppe'`
- `customerIds: ['BSH','NEFF','GAGGENAU']`
- title `Transportanmeldung BSH-Gruppe`
- portal URL `https://vendor.bsh-partner.com/su_launch/index.html#Shell-home`
- status `Freigegeben`.

Use exactly eight work steps:

1. Portal öffnen.
2. Transportanmeldung starten.
3. Werk und Termin erfassen.
4. Verpackung auswählen.
5. ExportHUB-Referenz hinterlegen.
6. Lieferavis anlegen.
7. Sendungsnummer erzeugen.
8. ExportHUB und Kundenmail aktualisieren.

Embed the source rules:
- registration preferably by 13:00, latest 13:30;
- only “Transportanmeldungen und Lieferavise”;
- remember plant number;
- `WPA = Einwegpalette`, always non-stackable;
- all delivery notes with quantities;
- shipment number to ExportHUB360 info and customer email;
- send all delivery notes to customer.

Add the five documented final checks from the optimized SOP.

- [ ] **Step 4: Attach eleven visual records**

Use the exact paths from Task 3 and map them in order to the relevant step IDs. Multiple images per step are allowed. Every visual must use:

```js
{
  type:'screenshot',
  stepId:'...',
  src:'/assets/sop/screenshots/bsh/...',
  caption:'...',
  required:true
}
```

- [ ] **Step 5: Verify GREEN**

```bash
node --test test/rc1550-sop-catalog.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/sop/rc1550-sop-active-catalog.js test/rc1550-sop-catalog.test.mjs
git commit -m "feat: add clean RC1550 SOP catalog with BSH"
```

---

### Task 3: Publish the optimized BSH screenshots as real web assets

**Files:**
- Source attachment: `/mnt/data/SOP_BSH_Neff_Gaggenau_Bilder_optimiert.docx`
- Create 11 PNG files under: `assets/sop/screenshots/bsh/`
- Create: `test/rc1550-sop-assets.test.mjs`

**Interfaces:**
- Consumes the eleven images embedded in the approved optimized Word SOP.
- Produces stable browser paths referenced by `rc1550-sop-active-catalog.js`.

- [ ] **Step 1: Write asset tests**

Assert all eleven files exist, start with the PNG signature, are non-empty, and have positive width/height.

Also assert the catalog references exactly those eleven paths and no missing file.

- [ ] **Step 2: Run RED**

```bash
node --test test/rc1550-sop-assets.test.mjs
```

Expected: FAIL because the PNGs are absent.

- [ ] **Step 3: Extract the approved images without substituting screenshots**

Extract `word/media/image1.png` through `image11.png` from the optimized Word file and rename them according to the File Structure section.

Do not replace them with generated mockups or screenshots from a different portal state.

- [ ] **Step 4: Verify dimensions and mapping**

Expected original approved image dimensions, in order:

```text
967x1095
408x498
1518x411
430x166
2259x286
2668x432
981x231
1054x170
1788x587
1024x152
1086x432
```

The test may permit lossless metadata differences but must fail on zero-size/corrupt images.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/rc1550-sop-assets.test.mjs test/rc1550-sop-catalog.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/sop/screenshots/bsh test/rc1550-sop-assets.test.mjs
git commit -m "feat: add approved BSH SOP screenshots"
```

---

### Task 4: Replace the handbook UI with the new category/group directory

**Files:**
- Modify: `assets/sop/rc1007-sop-ui.js`
- Modify: `assets/sop/rc1007-sop.css`
- Modify: `test/rc1007-sop-ui.test.mjs`
- Modify: `test/rc1009-sop-selection-ui.test.mjs`
- Modify: six locale JSON files.

**Interfaces:**
- Consumes: `ExportHubIsoSopCatalog.categories`, canonical `documents`, existing rights.
- Produces: same `ExportHubIsoSopUi` public functions (`renderOverview`, `renderWorkspace`, `renderDocument`, `mount`, etc.).
- New presentation hierarchy: category → group → SOP.
- Legacy `area` remains a fallback only when a catalog has no categories metadata.

- [ ] **Step 1: Rewrite UI tests to the new product contract**

Replace assertions for `SOP-Handbuch`/75-system-SOP presentation with assertions for:
- `SOP / Arbeitsanweisungen`
- `Kunden-SOPs`
- `Versanddienstleister`
- `Prozess-SOPs`
- `BSH-Gruppe`
- `DHL`
- `Transportanmeldung BSH-Gruppe`
- no visible `SOP-EH-060`.

Assert DHL renders an empty-group message and no fake SOP button.

- [ ] **Step 2: Add direct-link failure test**

Call `renderWorkspace` with `activeNumber:'SOP-EH-060'` against the RC1550 documents and assert:
- an unavailable/not-found message is rendered;
- `SOP-CUST-BSH-001` is **not** silently opened as fallback.

- [ ] **Step 3: Run RED**

```bash
node --test test/rc1007-sop-ui.test.mjs test/rc1009-sop-selection-ui.test.mjs
```

Expected: FAIL on old handbook/area rendering.

- [ ] **Step 4: Implement category/group rendering**

Add focused helpers inside `rc1007-sop-ui.js` for:
- category metadata lookup;
- group lookup;
- visible documents per group;
- active-document resolution.

Do not fork a second SOP UI.

- [ ] **Step 5: Preserve current document rendering and image zoom**

Do not replace `renderVisual`, dialog zoom, image-error fallback, version display or permissions. The new directory only changes discovery/navigation and not the approved document detail renderer.

- [ ] **Step 6: Add responsive styles**

Add `.rc1550-*`/existing scoped SOP styles for:
- category cards/tabs;
- groups;
- empty DHL state;
- mobile stacking below 760px;
- no horizontal overflow.

No global selectors outside the SOP namespace.

- [ ] **Step 7: Update six-language copy**

In all six locale files replace handbook wording such as `sop.backHandbook` with directory wording and add keys for:
- SOP / Work instructions
- customer SOPs
- carriers
- process SOPs
- no released SOPs in this group
- SOP no longer available.

Keep BSH/DHL proper names untranslated.

- [ ] **Step 8: Verify UI and i18n**

```bash
node --test test/rc1007-sop-ui.test.mjs test/rc1009-sop-selection-ui.test.mjs
npm run verify:i18n
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add assets/sop/rc1007-sop-ui.js assets/sop/rc1007-sop.css assets/i18n/*.json test/rc1007-sop-ui.test.mjs test/rc1009-sop-selection-ui.test.mjs
git commit -m "feat: replace SOP handbook with work-instruction directory"
```

---

### Task 5: Prevent stale persisted legacy SOPs from leaking through secondary runtimes

**Files:**
- Modify: `assets/sop/rc1505-sop-coverage.js`
- Modify: `assets/sop/rc1506-sop-coverage-runtime.js`
- Modify: `assets/sop/rc1544-sop-guided-workspace.js`
- Create: `test/rc1550-sop-runtime-isolation.test.mjs`

**Interfaces:**
- Consumes: current application `state.isoSops`, `ExportHubIsoSopCatalog.documents`, `ExportHubIsoSopModel.reconcileCatalog`.
- Produces: every reader sees canonical reconciled active documents.

- [ ] **Step 1: Write RED tests for stale state**

Provide state containing:
- `SOP-EH-060`
- another old process SOP
- BSH stored copy

and canonical catalog containing only `SOP-CUST-BSH-001`.

Assert each runtime document resolver returns only BSH.

- [ ] **Step 2: Run RED**

```bash
node --test test/rc1550-sop-runtime-isolation.test.mjs
```

Expected: FAIL because coverage/Guided Workspace currently prefer raw `state.isoSops`.

- [ ] **Step 3: Reconcile instead of trusting raw state**

In each affected resolver:
1. get canonical documents;
2. get stored state documents;
3. call `model.reconcileCatalog(stored, canonical)` when available;
4. fall back to canonical, not stale stored, on reconciliation failure.

Do not mutate unrelated application state from a read-only resolver.

- [ ] **Step 4: Verify existing Guided Workspace behavior**

Run:

```bash
node --test \
  test/rc1550-sop-runtime-isolation.test.mjs \
  test/rc1544-sop-guided-workspace.test.mjs \
  test/rc1505-sop-coverage.test.mjs \
  test/rc1506-sop-coverage-runtime.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/sop/rc1505-sop-coverage.js assets/sop/rc1506-sop-coverage-runtime.js assets/sop/rc1544-sop-guided-workspace.js test/rc1550-sop-runtime-isolation.test.mjs
git commit -m "fix: isolate active SOP catalog from stale legacy state"
```

---

### Task 6: Remove handbook wording from active navigation and browser helpers

**Files:**
- Modify: `e2e/specs/navigation.spec.mjs`
- Modify: `e2e/specs/sopmaster-guided-workspace.spec.mjs`
- Update active browser helpers/specs that still use `SOP-Handbuch` as a visible navigation fallback.
- Historical docs/spec documents are not rewritten.

**Interfaces:**
- Productive navigation label remains discoverable as `SOP` / localized work-instruction wording.
- Guided Workspace primary production SOP becomes `SOP-CUST-BSH-001`.

- [ ] **Step 1: Change navigation candidates**

Remove `SOP-Handbuch` from active browser navigation candidates. Keep only current real labels such as `SOP` / `SOP & Portale` if the main navigation still legitimately uses them.

- [ ] **Step 2: Repoint Guided Workspace E2E to BSH**

Change default SOP number to:

```js
const SOP='SOP-CUST-BSH-001';
```

Assert:
- guided shell visible;
- BSH title visible;
- first step visible;
- at least one real BSH image visible;
- no horizontal overflow.

- [ ] **Step 3: Scan active code/test surface**

Run:

```bash
rg -n "SOP-Handbuch|SOP handbook|manual SOP|podręcznika SOP|manuale SOP" \
  assets e2e browser test \
  --glob '!assets/sop/rc1016-sop-consolidation.js'
```

Classify every match:
- user-visible active copy → change;
- historical compatibility source/test explicitly isolated from production → may remain only if it cannot render in RC1550.

- [ ] **Step 4: Run targeted browser-helper tests**

Run the relevant Node navigation/SOP UI tests and ensure no active UI expectation depends on handbook wording.

- [ ] **Step 5: Commit**

```bash
git add e2e/specs/navigation.spec.mjs e2e/specs/sopmaster-guided-workspace.spec.mjs assets/i18n
git commit -m "test: move active SOP navigation off handbook terminology"
```

---

### Task 7: Integrate RC1550 after the historical catalog in every final build

**Files:**
- Create: `.github/rc1550/integrate-sop-rebuild.mjs`
- Modify: `.github/packmeldungen/build-three-env.mjs`
- Create: `test/rc1550-sop-build.test.mjs`

**Interfaces:**
- Produces `integrateSopRebuild(root, out)`.
- Copies:
  - `assets/sop/rc1550-sop-active-catalog.js`
  - `assets/sop/screenshots/bsh/*.png`
- Injects one deferred script marker, e.g. `exporthub-rc1550-sop-active-catalog`.
- Injection must occur after historical catalog decorators (`rc1016`/`rc1018`) and before consumers can render the SOP view.

- [ ] **Step 1: Write build tests**

For `index.html`, `TESTVERSION.html`, and `demo.html`, assert:
- RC1550 script marker exists exactly once;
- its source is `/assets/sop/rc1550-sop-active-catalog.js?v=1550`;
- it appears after the legacy catalog/consolidation marker;
- BSH assets exist in the built output.

- [ ] **Step 2: Run RED**

```bash
node --test test/rc1550-sop-build.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement idempotent integration**

Follow the RC1544 pattern:
- copy assets;
- locate the last real `</head>`/`</body>` safely;
- avoid duplicate injection;
- throw a clear error when the expected SOP bootstrap anchor is missing.

- [ ] **Step 4: Wire the final pack/production builder**

In `.github/packmeldungen/build-three-env.mjs` call:

```js
finalizeAutoUpdate({root,out});
integrateGuidedWorkspace(root,out);
integrateSopRebuild(root,out);
```

If runtime order requires RC1550 before Guided Workspace execution, the injected HTML script order—not the Node function call order—must be asserted in the test.

- [ ] **Step 5: Build and verify**

```bash
node .github/packmeldungen/build-three-env.mjs
node --test test/rc1550-sop-build.test.mjs test/rc1544-sop-guided-build.test.mjs test/rc1544-sop-guided-injection.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/rc1550 .github/packmeldungen/build-three-env.mjs test/rc1550-sop-build.test.mjs
git commit -m "build: integrate RC1550 SOP catalog into final environments"
```

---

### Task 8: Add production-facing BSH/DHL browser regression coverage

**Files:**
- Create: `e2e/specs/sop-rebuild.spec.mjs`
- Modify: `e2e/specs/sopmaster-guided-workspace.spec.mjs`
- Modify: `.github/workflows/sopmaster-core-verify.yml`

**Interfaces:**
- Uses existing `appEntry`, `waitReady`, `openExportHubView`, `assertNoHorizontalOverflow`.
- Tests the built demo/testservice package, not a mocked DOM-only page.

- [ ] **Step 1: Add directory E2E**

Desktop + mobile assertions:
- open SOP view;
- `SOP-Handbuch` not visible;
- all three categories visible;
- BSH group visible;
- DHL group visible;
- BSH SOP opens.

- [ ] **Step 2: Add BSH content E2E**

Assert:
- title `Transportanmeldung BSH-Gruppe`;
- eight guided steps;
- deadline text includes 13:00 and 13:30;
- WPA rule visible on its step;
- real screenshot visible;
- zoom button opens dialog;
- no horizontal overflow.

- [ ] **Step 3: Add search isolation E2E**

Search `BSH` → BSH result remains.
Search `SOP-EH-060` → no old SOP result.
Search `DHL` → DHL group remains visible but no fabricated SOP.

- [ ] **Step 4: Add removed-direct-link E2E**

Attempt to select/open `SOP-EH-060` through the supported view state/path used by the app. Assert clear unavailable state and no automatic opening of BSH.

- [ ] **Step 5: Add workflow coverage**

Extend `.github/workflows/sopmaster-core-verify.yml` path filters for:
- `assets/sop/rc1550-*`
- `assets/sop/screenshots/bsh/**`
- `test/rc1550-*`
- `e2e/specs/sop-rebuild.spec.mjs`
- `.github/rc1550/**`

Add the new E2E spec to the desktop/mobile browser job.

- [ ] **Step 6: Run browser tests**

```bash
EXPORTHUB_E2E_STATIC=1 \
EXPORTHUB_E2E_ENTRY=/demo.html \
EXPORTHUB_E2E_PUBLIC_ENV=testservice \
npx playwright test \
  e2e/specs/sop-rebuild.spec.mjs \
  e2e/specs/sopmaster-guided-workspace.spec.mjs \
  e2e/specs/navigation.spec.mjs \
  --project=desktop \
  --project=mobile-standard
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add e2e/specs/sop-rebuild.spec.mjs e2e/specs/sopmaster-guided-workspace.spec.mjs .github/workflows/sopmaster-core-verify.yml
git commit -m "test: protect new SOP directory and BSH workflow"
```

---

### Task 9: Full regression, release gate, deploy and live verification

**Files:**
- No product changes unless a failing gate reveals a defect.
- Any corrective change gets its own focused test and commit.

**Interfaces:**
- Uses the repository's current release and production workflows.
- Completion status remains below 100% until live production passes.

- [ ] **Step 1: Run targeted SOP regression**

```bash
node --test --test-concurrency=1 \
  test/rc1550-sop-model.test.mjs \
  test/rc1550-sop-catalog.test.mjs \
  test/rc1550-sop-assets.test.mjs \
  test/rc1550-sop-runtime-isolation.test.mjs \
  test/rc1550-sop-build.test.mjs \
  test/rc1544-sop-guided-workspace.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full Node regression**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run i18n verification**

```bash
npm run verify:i18n
```

Expected: PASS.

- [ ] **Step 4: Run release verification**

```bash
npm run verify:release
```

Expected: PASS.

- [ ] **Step 5: Rebuild the final three-environment package**

```bash
node .github/packmeldungen/build-three-env.mjs
```

Expected: successful build with RC1550 asset/script markers in all three application HTML outputs.

- [ ] **Step 6: Run final static Playwright regression**

Run Task 8's desktop/mobile command and the current protected browser suites required by the release workflow.

Expected: PASS with no runtime errors, source leaks or horizontal overflow.

- [ ] **Step 7: Create/merge the implementation PR only after all gates are green**

The PR must state:
- old handbook hidden/removed from active UI;
- active catalog now contains only newly created SOPs;
- BSH is the first released customer SOP;
- DHL is an empty carrier group pending a separately approved SOP;
- old SOP direct links return unavailable;
- no unrelated functions changed.

- [ ] **Step 8: Production deploy through the normal production workflow**

Deploy the exact tested merge commit. Do not manually patch production outside the normal workflow.

- [ ] **Step 9: Live production verification**

On production, verify:
1. SOP view opens.
2. “SOP-Handbuch” is absent.
3. Kunden-SOPs / Versanddienstleister / Prozess-SOPs are visible.
4. BSH-Gruppe opens.
5. `Transportanmeldung BSH-Gruppe` opens.
6. All eight steps are accessible in order.
7. Images load and zoom.
8. DHL group is visible without a fake SOP.
9. Search does not return `SOP-EH-060`.
10. Desktop and smartphone show no overlap/overflow.

- [ ] **Step 10: Mark project 100% only now**

Before successful live verification the progress bar must remain below 100%.

- [ ] **Step 11: Final commit/status note if needed**

Record the deployed commit and live-verification result in the project/release status without changing product code merely for bookkeeping.
