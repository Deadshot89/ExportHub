# RC1017 Mehr-LKW-Sendungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExportHUB teilt übergroße Sendungen automatisch in mehrere unabhängige LKW-Ladeeinheiten auf, jeweils mit eigener Ladeliste, eigenem Stauplan, eigenem QR-/Pickup-Prozess und eigenem POD, während die Hauptsendung eine einzige 6-stellige ExportHUB-Referenz behält.

**Architecture:** Die fachliche Split-Logik wird als eigener browserseitiger Runtime-Baustein umgesetzt und speichert die Ladeeinheiten unter `shipment.multiTruck.loadUnits`. Serverseitig werden Merge- und Pickup-Pfade so erweitert, dass `loadUnitId` und `splitVersion` geschützt bleiben und Pickup/POD nur die jeweilige Ladeeinheit verändern. Der bestehende Drei-Umgebungen-Build bindet dieselben RC1017-Runtime-Dateien in Produktion-Kandidat, TESTSERVICE und Demo ein.

**Tech Stack:** Node.js >=20, Browser-JavaScript, Azure Functions/CommonJS, Azure Blob Storage, Node `node:test`, bestehender ExportHUB-Drei-Umgebungen-Build.

**Spec:** `docs/superpowers/specs/2026-09-09-multi-truck-shipment-split-design.md`

## Global Constraints

- Bestehende 6-stellige Hauptreferenz bleibt unverändert.
- Standard-LKW: `maxLdm = 13.6`, `maxWeightKg = 24000`.
- Kapazität muss LDM **und** Gewicht einhalten.
- Jede physische Colli-Einheit wird genau einer Ladeeinheit zugeordnet.
- Abgeholte Ladeeinheiten dürfen durch Neuaufteilung oder Merge nie verschwinden oder zurückgesetzt werden.
- Jeder Pickup-QR ist an `shipmentId`, `loadUnitId` und `splitVersion` gebunden.
- Klartext-Pickup-Tokens dürfen nicht im Team-State persistiert werden.
- ABD-Sperre der Hauptsendung blockiert alle Teil-LKW.
- Produktion-Kandidat, TESTSERVICE und Demo erhalten denselben RC1017-Runtime-Stand.
- `main` und Produktion werden während der Feature-Entwicklung nicht direkt verändert.

---

### Task 1: Deterministische Mehr-LKW-Split-Engine

**Files:**
- Create: `assets/rc1017-multi-truck.js`
- Create: `test/rc1017-multi-truck-core.test.mjs`

**Interfaces:**
- Produces: `window.ExportHUBRC1017MultiTruck`
- Produces: `normalizeProfile(profile) -> {id,name,maxLdm,maxWeightKg,active}`
- Produces: `splitShipment(shipment, profile, previousMultiTruck?) -> {ok,multiTruck,error}`
- Produces: `deriveProgress(loadUnits) -> {pickedUp,pod,total,label,status}`

- [ ] **Step 1: Write the failing core tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function engine(){
  const sandbox={window:{},console};
  vm.runInNewContext(fs.readFileSync('assets/rc1017-multi-truck.js','utf8'),sandbox);
  return sandbox.window.ExportHUBRC1017MultiTruck;
}

test('30 identische Paletten werden verlustfrei auf mehrere LKW verteilt',()=>{
  const api=engine();
  const result=api.splitShipment({id:'s1',ref:'ABC123',rows:[{id:'r1',type:'Euro Palette',count:30,weight:15000,ldm:6}]},{id:'standard',name:'Standard-LKW',maxLdm:13.6,maxWeightKg:24000,active:true});
  assert.equal(result.ok,true);
  assert.equal(result.multiTruck.loadUnits.reduce((n,u)=>n+u.totalCount,0),30);
  assert.equal(result.multiTruck.loadUnits.reduce((n,u)=>n+u.totalWeightKg,0),15000);
  assert.equal(result.multiTruck.loadUnits.reduce((n,u)=>n+u.totalLdm,0),6);
});

test('eine einzelne übergroße Einheit erzwingt manuelle Ladeplanung',()=>{
  const api=engine();
  const result=api.splitShipment({id:'s1',ref:'ABC123',rows:[{id:'r1',count:1,weight:25000,ldm:1}]},{id:'standard',name:'Standard-LKW',maxLdm:13.6,maxWeightKg:24000,active:true});
  assert.equal(result.ok,false);
  assert.equal(result.error.code,'MANUAL_LOAD_PLANNING_REQUIRED');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-core.test.mjs`

Expected: FAIL because `assets/rc1017-multi-truck.js` does not exist.

- [ ] **Step 3: Implement the minimal split engine**

Core contract:

```js
(function(w){
  'use strict';
  const DEFAULT_PROFILE=Object.freeze({id:'standard-truck',name:'Standard-LKW',maxLdm:13.6,maxWeightKg:24000,active:true});
  function splitShipment(shipment,profile,previous){ /* normalize rows -> physical units -> stable sequential packing -> totals */ }
  function deriveProgress(loadUnits){ /* aggregate pickup/POD progress without mutating units */ }
  w.ExportHUBRC1017MultiTruck={DEFAULT_PROFILE,normalizeProfile,splitShipment,deriveProgress};
})(window);
```

The implementation must split row totals proportionally per physical unit and correct the final unit with the exact remainder so total count/weight/LDM stay equal to the source shipment.

- [ ] **Step 4: Add tests for deterministic IDs, one-LKW compatibility, weight-bound split and LDM-bound split**

Stable load-unit ID rule:

```text
<shipment-id-or-ref>:split:<splitVersion>:truck:<sequence>
```

- [ ] **Step 5: Run GREEN**

Run: `node --test test/rc1017-multi-truck-core.test.mjs`

Expected: all RC1017 core tests PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: RC1017 Mehr-LKW Split-Engine`

---

### Task 2: Persistenz und verlustsicherer Merge je Ladeeinheit

**Files:**
- Modify: `api/shared/merge.js`
- Create: `test/rc1017-multi-truck-merge.test.mjs`

**Interfaces:**
- Produces inside merge module: `mergeMultiTruckProtected(serverValue,incomingValue)`
- Uses stable `loadUnit.id` as merge identity.

- [ ] **Step 1: Write failing merge tests**

Required cases:

```js
// newer empty client may not erase server loadUnits
// older client may not demote 'Abgeholt' to 'Bereit zur Abholung'
// newer splitVersion may replace only not-yet-picked-up units
// pickup, pod and generatedDocuments merge per loadUnit.id
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-merge.test.mjs`

Expected: FAIL because `mergeShipmentProtected` does not yet protect nested load units.

- [ ] **Step 3: Implement protected nested merge**

Add explicit RC1017 merge behavior before `mergeShipmentProtected` returns:

```js
if (isObject(serverItem.multiTruck) || isObject(incomingItem.multiTruck)) {
  out.multiTruck = mergeMultiTruckProtected(serverItem.multiTruck, incomingItem.multiTruck);
}
```

Rules:
- highest valid `splitVersion` wins for open units;
- any server unit at status rank `Abgeholt` or higher is preserved by ID;
- arrays `pickupHistory`, `podFiles`, `generatedDocuments` are additive-protective;
- no public token keys are copied into `multiTruck.loadUnits`.

- [ ] **Step 4: Run GREEN plus existing merge tests**

Run: `node --test test/rc1017-multi-truck-merge.test.mjs test/*.test.mjs`

Expected: RC1017 merge tests PASS and existing test suite remains green.

- [ ] **Step 5: Commit**

Commit message: `feat: RC1017 Mehr-LKW Merge-Schutz`

---

### Task 3: Separater QR-/Pickup-Datensatz pro LKW

**Files:**
- Modify: `api/shared/public-access-store.js`
- Modify: `api/pickup-init/index.js`
- Modify: `api/pickup-status/index.js`
- Modify: `api/pickup-confirm-v2/index.js`
- Modify: `api/shared/pickup-store.js`
- Modify only if required by tests: `api/pickup-pod/index.js`
- Create: `test/rc1017-multi-truck-pickup.test.mjs`

**Interfaces:**
- Pickup issue payload: `{shipmentId, reference, loadUnitId, splitVersion, rows, ...}`
- Public-access subject ID for multi-truck pickup: `<shipmentId>|load:<loadUnitId>|split:<splitVersion>`
- Pickup record fields: `loadUnitId`, `loadUnitSequence`, `loadUnitTotal`, `splitVersion`.

- [ ] **Step 1: Write RED tests**

Assert that two units from the same shipment create two independent public-access records and that confirming LKW 1 does not alter LKW 2.

Also assert stale split rejection:

```js
assert.equal(response.code,'PICKUP_SPLIT_OUTDATED');
```

when the requested token's `splitVersion` no longer matches the active load unit.

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-pickup.test.mjs`

Expected: FAIL because current pickup subject identity is only the shipment ID.

- [ ] **Step 3: Bind public access to the load unit**

In `pickup-init`, construct the subject identity from shipment and load unit; persist only derived token/hash identities as today.

Example snapshot fields:

```js
const snapshot={shipmentId,reference,loadUnitId,loadUnitSequence,loadUnitTotal,splitVersion,rows:store.clone(rows),expectedColliCount:expected};
```

- [ ] **Step 4: Update team-state writeback**

`pickup-store.updateTeam()` must locate `shipment.multiTruck.loadUnits.find(x=>x.id===record.loadUnitId)` and update pickup/POD/status there. It may derive the main shipment status only when all active units meet the corresponding threshold.

- [ ] **Step 5: Preserve old one-LKW QR behavior**

When `loadUnitId` is absent, existing single-shipment logic stays valid and all RC995/RC998/RC1014 pickup tests must continue to pass.

- [ ] **Step 6: Run GREEN and pickup regressions**

Run: `node --test test/rc1017-multi-truck-pickup.test.mjs test/rc1013-pickup-readonly-flow.test.mjs test/rc1014-reusable-public-links.test.mjs`

Expected: all PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: RC1017 eigener Pickup je LKW`

---

### Task 4: Sendungsoberfläche, Kapazitätsanzeige und manuelle Zuordnung

**Files:**
- Modify: `assets/rc1017-multi-truck.js`
- Create: `assets/rc1017-multi-truck.css`
- Create: `test/rc1017-multi-truck-ui.test.mjs`

**Interfaces:**
- Runtime attaches to existing `#rc363BlockColli` and `#rc363BlockStow` areas without duplicating canonical shipment blocks.
- UI marker: `data-rc1017-multi-truck-panel`.

- [ ] **Step 1: Write RED contract tests**

Tests require:
- capacity text for one truck;
- `N LKW erforderlich` for multi-truck;
- visible cards `LKW X von N`;
- no duplicate `rc363BlockColli` or `rc363BlockStow`;
- manual move sets `multiTruck.manualAdjusted=true`;
- editing capacity-relevant values after manual move sets `manualReviewRequired=true`.

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-ui.test.mjs`

Expected: FAIL because the RC1017 panel is not present.

- [ ] **Step 3: Implement runtime UI**

The external runtime observes the existing shipment form and reads canonical row values. It renders only an additive panel beneath Colli/LDM and a per-LKW selector inside the existing stow area.

Required copy:

```text
1 LKW · 9,8 / 13,6 LDM · 8.420 / 24.000 kg
2 LKW erforderlich
LKW 1 von 2
Automatisch neu verteilen
Manuelle Aufteilung prüfen
```

- [ ] **Step 4: Add guarded manual reassignment**

Moves are allowed only between not-yet-picked-up units and only when target LDM/weight remain within profile limits.

- [ ] **Step 5: Run GREEN**

Run: `node --test test/rc1017-multi-truck-ui.test.mjs test/rc997-*.test.mjs test/rc973-long-text-autogrow.test.mjs`

Expected: PASS without canonical-block duplication.

- [ ] **Step 6: Commit**

Commit message: `feat: RC1017 Mehr-LKW Oberfläche`

---

### Task 5: Eigene Ladeliste, Stauplan und POD-Kennzeichnung je LKW

**Files:**
- Modify: `assets/rc1017-multi-truck.js`
- Modify: `assets/rc1017-multi-truck.css`
- Modify: `pickup.html` only if the existing public renderer cannot show the new record fields
- Create: `test/rc1017-multi-truck-documents.test.mjs`

**Interfaces:**
- `buildLoadListModel(shipment,loadUnit)` returns only rows for that load unit.
- `buildPrintSequence(shipment)` returns ordered units with QR -> load list -> unit documents.
- `loadUnit.generatedDocuments` owns QR/load-list/stow-plan/POD metadata for that unit.

- [ ] **Step 1: Write RED document tests**

Assert:
- LKW 1 model contains no LKW 2 rows;
- headings contain `ABC123 · LKW 1 von 2`;
- totals are unit totals, not shipment totals;
- print sequence is `[QR1,Ladeliste1,...,QR2,Ladeliste2,...]`;
- POD display name is `POD · LKW X von N`.

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-documents.test.mjs`

Expected: FAIL because per-unit document models do not exist.

- [ ] **Step 3: Implement per-unit document/stow helpers**

Reuse existing load-list/stow rendering functions by temporarily supplying the selected unit's rows/model; do not fork the whole canonical renderer.

- [ ] **Step 4: Ensure QR pages remain explicit**

Do not re-enable generic QR inclusion in PDFs. The RC995 `PDF_NO_QR` contract remains unchanged; RC1017 creates deliberate per-unit QR pages only in the multi-truck total-print sequence.

- [ ] **Step 5: Run GREEN and print regressions**

Run: `node --test test/rc1017-multi-truck-documents.test.mjs .github/rc995/rc995-contract.test.mjs test/rc973-long-text-autogrow.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: RC1017 Ladelisten und Stauplan je LKW`

---

### Task 6: Gemeinsamer RC1017 Drei-Umgebungen-Build und Gesamtregression

**Files:**
- Modify: `.github/rc1013/build-three-env.mjs`
- Modify: `production-version.js`
- Create: `test/rc1017-three-environment.test.mjs`
- Generated for verification only: `dist-rc1013/index.html`, `dist-rc1013/TESTVERSION.html`, `dist-rc1013/demo.html`

**Interfaces:**
- New source constants:

```js
const MULTI_TRUCK_JS='/assets/rc1017-multi-truck.js?v=1017';
const MULTI_TRUCK_CSS='/assets/rc1017-multi-truck.css?v=1017';
```

- [ ] **Step 1: Write RED three-environment test**

```js
for(const file of ['index.html','TESTVERSION.html','demo.html']){
  test(`${file} lädt RC1017 Mehr-LKW`,()=>{
    const out=html(file);
    assert.match(out,/rc1017-multi-truck\.js\?v=1017/);
    assert.match(out,/rc1017-multi-truck\.css\?v=1017/);
  });
}
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-three-environment.test.mjs`

Expected: FAIL because the build does not yet copy/inject RC1017 assets.

- [ ] **Step 3: Extend the shared build**

Add script/style injection and copy both RC1017 assets. Set `VERSION='RC1017'` and `CACHE='1017'` in the release build, while retaining all RC1015 and prior runtime assets.

- [ ] **Step 4: Update production version probe on the feature branch**

Content:

```js
window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1017';
// RC1017 gemeinsamer Stand für Produktion, TESTSERVICE und Demo · Mehr-LKW-Sendungen mit separatem QR, Ladeliste, Stauplan und POD je Ladeeinheit
```

- [ ] **Step 5: Run complete build and regression suite**

Run:

```bash
node .github/rc1013/build-three-env.mjs
npm test
node --test .github/rc995/rc995-contract.test.mjs .github/rc995/rc995-flow.test.cjs .github/rc997/rc997-shipment-contract.test.mjs
```

Expected: all tests PASS, all three generated environments contain identical RC1017 multi-truck assets, and existing QR/Avis/ABD contracts stay green.

- [ ] **Step 6: Verify security markers**

Search generated/runtime code for:

```text
loadUnitId
splitVersion
PICKUP_SPLIT_OUTDATED
RC995_PDF_NO_QR
```

and verify no raw pickup token field is added below `multiTruck.loadUnits`.

- [ ] **Step 7: Commit**

Commit message: `build: RC1017 Mehr-LKW in drei Umgebungen integrieren`

---

## Final Acceptance

The implementation is complete only when all of these are demonstrated by tests:

1. A shipment below capacity remains a compatible one-LKW shipment.
2. A shipment above 13.6 LDM or 24,000 kg is split automatically.
3. Total count, LDM and weight across all load units exactly equal the main shipment totals.
4. Each load unit has its own QR/public-access identity.
5. LKW 1 can be picked up while LKW 2 remains open.
6. A stale QR from an older `splitVersion` is rejected.
7. Each load unit has an independent load list, stow plan and POD association.
8. Main shipment status advances only when all active load units meet the required status.
9. Picked-up load units survive stale-client merges and later open-unit re-splits.
10. Production-Kandidat, TESTSERVICE and Demo build the same RC1017 runtime without weakening existing ExportHUB regression contracts.
