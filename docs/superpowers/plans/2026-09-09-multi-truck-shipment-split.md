# ExportHUB Mehr-LKW-Sendungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine bestehende ExportHUB-Hauptsendung automatisch in mehrere unabhängig abholbare LKW-Ladeeinheiten aufteilen, sobald LDM oder Gewicht die konfigurierten LKW-Grenzen überschreiten, mit eigenem QR-Code, Ladeliste, Stauplan und POD je Teil-LKW.

**Architecture:** Die bestehende Hauptsendung bleibt der führende Datensatz in `shipments`. Unter `shipment.multiTruck.loadUnits` werden stabile Ladeeinheiten geführt; die Clientlogik berechnet den Split deterministisch aus kanonischen Colli-Daten, während API-/Merge-Logik Teil-LKW verlustgeschützt persistiert. Öffentliche Pickup-Zugänge werden weiterhin über den bestehenden Public-Access-Pfad erzeugt und zusätzlich an `shipment.id`, `loadUnit.id` und `splitVersion` gebunden.

**Tech Stack:** Statisches ExportHUB-Frontend in `TESTVERSION.html`/`index.html`, Node.js >=20, Node Test Runner, Azure Static Web Apps Functions/CommonJS-API, Azure Blob Storage, bestehende Public-Access-/Pickup-Logik.

**Spec:** `docs/superpowers/specs/2026-09-09-multi-truck-shipment-split-design.md`

## Global Constraints

- Die bestehende 6-stellige ExportHUB-Referenz bleibt die Referenz der Hauptsendung.
- Keine zweite Hauptsendung für weitere LKW erzeugen; Teil-LKW leben unter `shipment.multiTruck.loadUnits`.
- Standardprofil: `13.6 LDM` und `24000 kg`, später administrativ änderbar.
- Kapazitätsprüfung verwendet LDM **und** Gewicht; eine Überschreitung einer Grenze erzeugt einen weiteren LKW.
- Kein Colli darf doppelt zugeordnet oder verloren gehen.
- Bereits abgeholte Teil-LKW dürfen durch spätere Änderungen nie verändert oder entfernt werden.
- Jeder Teil-LKW erhält eigenen QR-Code, eigene Ladeliste, eigenen Stauplan, eigenen Abholstatus und eigenen POD.
- Hauptstatus `Abgeholt` erst, wenn alle aktiven Teil-LKW mindestens abgeholt sind; `POD vorhanden` erst, wenn alle aktiven Teil-LKW einen POD haben.
- ABD-Sperren der Hauptsendung gelten für alle Teil-LKW.
- Pickup-Tokens bleiben aus dem normalen Team-State entfernt und werden serverseitig an `shipment.id`, `loadUnit.id` und `splitVersion` gebunden.
- Bestehende Ein-LKW-Sendungen bleiben rückwärtskompatibel.
- `main` und Produktion werden während der Feature-Entwicklung nicht direkt verändert.

---

### Task 1: Reine Mehr-LKW-Domänenlogik mit deterministischem Split

**Files:**
- Create: `api/shared/multi-truck.js`
- Create: `test/rc1017-multi-truck-domain.test.mjs`

**Interfaces:**
- Consumes: normalisierte Colli-Zeilen mit `id`, `type`, `count`, `weight`, `ldm`.
- Produces: `normalizePhysicalUnits(rows)`, `splitIntoLoadUnits(rows, profile, options)`, `summarizeLoadUnits(loadUnits)`, `deriveMultiTruckProgress(loadUnits)`.

- [ ] **Step 1: Write the failing domain tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { splitIntoLoadUnits, summarizeLoadUnits, deriveMultiTruckProgress } = require('../api/shared/multi-truck.js');

const profile={id:'standard-truck',name:'Standard-LKW',maxLdm:13.6,maxWeightKg:24000,active:true};

test('RC1017: 20 Paletten werden ohne Verlust deterministisch auf mehrere LKW verteilt',()=>{
  const rows=[{id:'r1',type:'Euro Palette',count:20,weight:16000,ldm:16}];
  const first=splitIntoLoadUnits(rows,profile,{shipmentId:'s1',ref:'ABC123',splitVersion:1});
  const second=splitIntoLoadUnits(rows,profile,{shipmentId:'s1',ref:'ABC123',splitVersion:1});
  assert.deepEqual(first,second);
  assert.equal(first.length,2);
  const sum=summarizeLoadUnits(first);
  assert.equal(sum.count,20);
  assert.equal(sum.weightKg,16000);
  assert.equal(sum.ldm,16);
});

test('RC1017: einzelne übergroße Einheit blockiert automatische Planung',()=>{
  assert.throws(()=>splitIntoLoadUnits([{id:'r1',type:'Maschine',count:1,weight:25000,ldm:5}],profile,{shipmentId:'s1',ref:'ABC123',splitVersion:1}),/Manuelle Ladeplanung erforderlich/);
});

test('RC1017: Fortschritt wird aus Teil-LKW abgeleitet',()=>{
  const progress=deriveMultiTruckProgress([{status:'Abgeholt'},{status:'Bereit zur Abholung'}]);
  assert.equal(progress.pickedUp,1);
  assert.equal(progress.total,2);
  assert.equal(progress.label,'1/2 abgeholt');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/rc1017-multi-truck-domain.test.mjs`

Expected: FAIL because `api/shared/multi-truck.js` does not exist.

- [ ] **Step 3: Implement the minimal deterministic splitter**

```js
'use strict';

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function round3(v){return Math.round((num(v)+Number.EPSILON)*1000)/1000}
function stableId(shipmentId,splitVersion,index){return `${shipmentId||'shipment'}:load:${splitVersion}:${index+1}`}

function normalizePhysicalUnits(rows){
  const out=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const count=Math.max(0,Math.trunc(num(row.count||row.qty||row.anzahl||row.quantity)));
    if(!count)continue;
    const totalWeight=num(row.weight||row.gewicht),totalLdm=num(row.ldm);
    for(let i=0;i<count;i++)out.push({
      sourceRowId:String(row.id||row._syncId||`row-${out.length+1}`),
      sourceUnitIndex:i,
      type:String(row.type||row.packaging||row.verpackung||row.name||''),
      count:1,
      weightKg:i===count-1?round3(totalWeight-round3((totalWeight/count)*(count-1))):round3(totalWeight/count),
      ldm:i===count-1?round3(totalLdm-round3((totalLdm/count)*(count-1))):round3(totalLdm/count)
    });
  }
  return out;
}

function splitIntoLoadUnits(rows,profile,options={}){
  if(!profile||profile.active===false||num(profile.maxLdm)<=0||num(profile.maxWeightKg)<=0)throw new Error('Kein aktives LKW-Profil verfügbar');
  const units=normalizePhysicalUnits(rows),loads=[];
  for(const unit of units){
    if(unit.ldm>num(profile.maxLdm)||unit.weightKg>num(profile.maxWeightKg))throw new Error(`Manuelle Ladeplanung erforderlich: ${unit.sourceRowId}`);
    let load=loads[loads.length-1];
    if(!load||round3(load.totalLdm+unit.ldm)>num(profile.maxLdm)||round3(load.totalWeightKg+unit.weightKg)>num(profile.maxWeightKg)){
      load={id:stableId(options.shipmentId,options.splitVersion||1,loads.length),sequence:loads.length+1,total:0,displayLabel:'',sourceAssignments:[],rows:[],totalCount:0,totalWeightKg:0,totalLdm:0,status:'Erstellt',pickup:{},pod:{},generatedDocuments:[],stowPlan:null};
      loads.push(load);
    }
    load.sourceAssignments.push({sourceRowId:unit.sourceRowId,sourceUnitIndex:unit.sourceUnitIndex});
    load.rows.push(unit);
    load.totalCount+=1;load.totalWeightKg=round3(load.totalWeightKg+unit.weightKg);load.totalLdm=round3(load.totalLdm+unit.ldm);
  }
  for(const load of loads){load.total=loads.length;load.displayLabel=`${options.ref||''} · LKW ${load.sequence} von ${loads.length}`.trim()}
  return loads;
}

function summarizeLoadUnits(loadUnits){return (loadUnits||[]).reduce((a,l)=>({count:a.count+num(l.totalCount),weightKg:round3(a.weightKg+num(l.totalWeightKg)),ldm:round3(a.ldm+num(l.totalLdm))}),{count:0,weightKg:0,ldm:0})}
function deriveMultiTruckProgress(loadUnits){const rows=(loadUnits||[]).filter(x=>x&&x.status!=='Storniert'),total=rows.length,pickedUp=rows.filter(x=>/Abgeholt|POD vorhanden|Abgeschlossen|Archiviert/i.test(String(x.status))).length,pod=rows.filter(x=>/POD vorhanden|Abgeschlossen|Archiviert/i.test(String(x.status))).length;return{total,pickedUp,pod,label:total?`${pickedUp}/${total} abgeholt`:'0/0 abgeholt'}}
module.exports={normalizePhysicalUnits,splitIntoLoadUnits,summarizeLoadUnits,deriveMultiTruckProgress};
```

- [ ] **Step 4: Run the domain tests and verify GREEN**

Run: `node --test test/rc1017-multi-truck-domain.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/shared/multi-truck.js test/rc1017-multi-truck-domain.test.mjs
git commit -m "feat: add deterministic multi-truck split engine"
```

---

### Task 2: Verlustgeschützte Persistenz und Merge je Ladeeinheit

**Files:**
- Modify: `api/shared/merge.js`
- Create: `test/rc1017-multi-truck-merge.test.mjs`

**Interfaces:**
- Consumes: `shipment.multiTruck.splitVersion`, `shipment.multiTruck.loadUnits[]` aus Task 1.
- Produces: `mergeShipmentProtected()` mit ID-basiertem Schutz für `multiTruck.loadUnits`.

- [ ] **Step 1: Write failing merge tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { mergeState }=require('../api/shared/merge.js');

test('RC1017: ältere Clientkopie darf abgeholten LKW nicht zurücksetzen',()=>{
  const server={shipments:[{id:'s1',ref:'ABC123',updatedAt:'2026-09-09T12:00:00Z',multiTruck:{splitVersion:2,loadUnits:[{id:'l1',status:'Abgeholt',updatedAt:'2026-09-09T12:00:00Z'}]}}]};
  const incoming={shipments:[{id:'s1',ref:'ABC123',updatedAt:'2026-09-09T13:00:00Z',multiTruck:{splitVersion:2,loadUnits:[{id:'l1',status:'Bereit zur Abholung',updatedAt:'2026-09-09T11:00:00Z'}]}}]};
  const merged=mergeState(server,incoming,{});
  assert.equal(merged.shipments[0].multiTruck.loadUnits[0].status,'Abgeholt');
});

test('RC1017: leeres loadUnits-Array löscht bestehenden Split nicht',()=>{
  const server={shipments:[{id:'s1',ref:'ABC123',multiTruck:{splitVersion:2,loadUnits:[{id:'l1',status:'Erstellt'}]}}]};
  const incoming={shipments:[{id:'s1',ref:'ABC123',multiTruck:{splitVersion:2,loadUnits:[]}}]};
  const merged=mergeState(server,incoming,{});
  assert.equal(merged.shipments[0].multiTruck.loadUnits.length,1);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-merge.test.mjs`

Expected: at least one assertion fails because `multiTruck.loadUnits` is not yet specially merged.

- [ ] **Step 3: Add ID-based load-unit merge**

Implement inside `api/shared/merge.js`:

```js
function mergeLoadUnits(serverUnits,incomingUnits){
  const map=new Map();
  const ingest=(list)=>{for(const unit of Array.isArray(list)?list:[]){if(!unit||!unit.id)continue;const current=map.get(unit.id);if(!current){map.set(unit.id,clone(unit));continue}const cts=timestamp(current),uts=timestamp(unit);const newer=uts>=cts?unit:current,older=uts>=cts?current:unit;const merged=Object.assign({},clone(older),clone(newer));if(shipmentStatusRank(older.status)>shipmentStatusRank(newer.status))merged.status=older.status;['pickup','pod'].forEach(k=>{if(isObject(current[k])||isObject(unit[k]))merged[k]=Object.assign({},clone(current[k])||{},clone(unit[k])||{})});if((current.generatedDocuments||[]).length&&!(unit.generatedDocuments||[]).length)merged.generatedDocuments=clone(current.generatedDocuments);map.set(unit.id,merged)}};
  ingest(serverUnits);ingest(incomingUnits);return Array.from(map.values()).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0));
}
```

Then integrate it in `mergeShipmentProtected()` so an empty/newer partial copy cannot erase `multiTruck`, and a newer explicit `splitVersion` may only replace non-progressed units while progressed units are preserved.

- [ ] **Step 4: Run merge and existing regression tests**

Run: `node --test test/rc1017-multi-truck-merge.test.mjs test/*.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/shared/merge.js test/rc1017-multi-truck-merge.test.mjs
git commit -m "feat: protect multi-truck load units during sync"
```

---

### Task 3: Clientseitige Kapazitätsberechnung und automatische Teil-LKW-Erzeugung

**Files:**
- Modify: `TESTVERSION.html`
- Create: `test/rc1017-multi-truck-client.test.mjs`

**Interfaces:**
- Consumes: bestehende `canonicalColliCard`, `addRow`, `removeRow`, Shipment-Draft-/Save-Pfad und sichtbare Colli-Felder.
- Produces: eindeutiger Scriptblock `exporthub-rc1017-multi-truck`, Funktionen `rc1017TruckProfile()`, `rc1017CollectRows()`, `rc1017RecalculateSplit()`, `rc1017ApplySplitToShipment(shipment)`.

- [ ] **Step 1: Write failing structural/client tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC1017: Mehr-LKW-Clientblock und Kernfunktionen sind eindeutig vorhanden',()=>{
  assert.equal((html.match(/id="exporthub-rc1017-multi-truck"/g)||[]).length,1);
  for(const fn of ['rc1017TruckProfile','rc1017CollectRows','rc1017RecalculateSplit','rc1017ApplySplitToShipment'])assert.match(html,new RegExp(`function\\s+${fn}\\s*\\(`));
});

test('RC1017: Startprofil ist 13.6 LDM und 24000 kg',()=>{
  assert.match(html,/maxLdm\s*:\s*13\.6/);
  assert.match(html,/maxWeightKg\s*:\s*24000/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-client.test.mjs`

Expected: FAIL because RC1017 block is absent.

- [ ] **Step 3: Add the isolated client block**

Add exactly one script block to `TESTVERSION.html` that:

```js
function rc1017TruckProfile(){return {id:'standard-truck',name:'Standard-LKW',maxLdm:13.6,maxWeightKg:24000,active:true}}
function rc1017CollectRows(){
  return Array.from(document.querySelectorAll('#rows .colli-row,[data-colli-row]')).map((el,index)=>({
    id:el.dataset.rowId||`row-${index+1}`,
    type:(el.querySelector('[name*=type],[name*=packaging],select')||{}).value||'',
    count:Number((el.querySelector('[name*=count],[name*=qty],[name*=anzahl]')||{}).value||0),
    weight:Number((el.querySelector('[name*=weight],[name*=gewicht]')||{}).value||0),
    ldm:Number((el.querySelector('[name*=ldm]')||{}).value||0)
  }));
}
```

The recalculation must preserve a manual split until the user explicitly selects `Automatisch neu verteilen`; if any load unit is `Abgeholt` or higher, only unpicked remainder may be recalculated.

- [ ] **Step 4: Wire recalculation to Colli changes without rebuilding rows**

Attach delegated `input`/`change` handling to the existing Colli container and call `rc1017RecalculateSplit()` after `addRow()`/`removeRow()` completion. Do not use `innerHTML=` or replace the Colli container, preserving the RC997 row-stability contract.

- [ ] **Step 5: Run client and shipment regressions**

Run: `node --test test/rc1017-multi-truck-client.test.mjs .github/rc997/rc997-shipment-contract.test.mjs test/rc973-long-text-autogrow.test.mjs test/rc975-global-render-integrity.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc1017-multi-truck-client.test.mjs
git commit -m "feat: calculate multi-truck split from shipment colli"
```

---

### Task 4: Mehr-LKW-UI, manuelle Verschiebung und Hauptfortschritt

**Files:**
- Modify: `TESTVERSION.html`
- Create: `test/rc1017-multi-truck-ui.test.mjs`

**Interfaces:**
- Consumes: `shipment.multiTruck.loadUnits` aus Task 3.
- Produces: `#rc1017MultiTruckSummary`, Teil-LKW-Karten, manuelles Verschieben offener Colli, Aktion `Automatisch neu verteilen`.

- [ ] **Step 1: Write failing UI contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC1017: UI zeigt LKW-Anzahl, Auslastung und Neuverteilen-Aktion',()=>{
  assert.match(html,/rc1017MultiTruckSummary/);
  assert.match(html,/LKW \d+ von/i);
  assert.match(html,/Automatisch neu verteilen/i);
  assert.match(html,/Manuelle Ladeplanung erforderlich/i);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add compact summary and load-unit cards**

Render directly below `Colli / LDM`:

```html
<section id="rc1017MultiTruckSummary" aria-live="polite"></section>
```

For one LKW show `1 LKW`; for multiple show `N LKW erforderlich`. Each card shows `LKW X von N`, `LDM/maxLdm`, `kg/maxWeightKg`, status and contained Colli.

- [ ] **Step 4: Add guarded manual reassignment**

Provide a move action only for load units below `Abgeholt`. Before committing a move, recompute both affected load-unit totals and reject the move if either LDM or weight exceeds the profile. Set `multiTruck.manualAdjusted=true` after a successful move.

- [ ] **Step 5: Derive overview progress**

Extend the existing shipment overview renderer so a multi-truck shipment remains one shipment card/row and gains text such as `2 LKW · 1/2 abgeholt`.

- [ ] **Step 6: Run UI/regression tests and commit**

Run: `node --test test/rc1017-multi-truck-ui.test.mjs test/rc978-shipment-fluid-layout.test.mjs`

Expected: PASS.

```bash
git add TESTVERSION.html test/rc1017-multi-truck-ui.test.mjs
git commit -m "feat: add multi-truck planning interface"
```

---

### Task 5: Teil-LKW-Pickup-Token und QR-Isolation

**Files:**
- Modify: existing Public-Access/Pickup API module discovered by searching `pickupToken`, `public-access`, `activateQr` before editing
- Modify: `pickup.html`
- Modify: `TESTVERSION.html`
- Create: `test/rc1017-multi-truck-pickup.test.mjs`

**Interfaces:**
- Consumes: `shipment.id`, `loadUnit.id`, `multiTruck.splitVersion`.
- Produces: Pickup-Public-Access record scoped to one load unit; pickup page resolving only that load unit.

- [ ] **Step 1: Locate the active pickup token issue/read/consume path**

Run repository search for the exact active symbols before making changes:

```bash
git grep -n -E "pickupToken|activateQr|public-access|tokenHash|Pickup" -- api TESTVERSION.html pickup.html
```

Record the exact API file(s) in the implementation commit message; do not create a parallel token store.

- [ ] **Step 2: Write failing isolation tests**

Create tests asserting the token payload/record carries all three bindings:

```js
assert.equal(record.shipmentId,'s1');
assert.equal(record.loadUnitId,'l2');
assert.equal(record.splitVersion,3);
```

Also assert that a token for `l1` cannot mutate `l2`, and a token created for split version `2` is rejected after shipment split version becomes `3`.

- [ ] **Step 3: Extend the existing pickup token record**

Add `loadUnitId` and `splitVersion` to the existing record creation and validation. Validation must fail closed when a multi-truck shipment is accessed with missing or mismatching bindings.

- [ ] **Step 4: Scope pickup page data and actions**

Update `pickup.html` so multi-truck pickup displays `Hauptreferenz`, `LKW X von N`, only assigned Colli, that load unit's totals and Ladeliste. A successful confirmation updates only the selected `loadUnit.id` and then recomputes the parent shipment status.

- [ ] **Step 5: Invalidate stale QR records on re-split**

When `splitVersion` increments before pickup, mark/revoke existing public-access records for the prior split version before issuing new QR codes.

- [ ] **Step 6: Run pickup security regressions and commit**

Run all RC995 pickup/public-access tests plus the new RC1017 pickup test.

Expected: existing PIN/hash/lockout behavior remains green; RC1017 isolation tests pass.

```bash
git add api TESTVERSION.html pickup.html test/rc1017-multi-truck-pickup.test.mjs
git commit -m "feat: isolate pickup access per truck load unit"
```

---

### Task 6: Eigene Ladeliste, Gesamtdruck und Stauplan je LKW

**Files:**
- Modify: `TESTVERSION.html`
- Create: `test/rc1017-multi-truck-print-stow.test.mjs`

**Interfaces:**
- Consumes: `loadUnit.rows`, `loadUnit.totalWeightKg`, `loadUnit.totalLdm`, bestehende `printStow()`/Ladelisten-/PDF-Funktionen.
- Produces: `rc1017RenderLoadList(loadUnit)`, `rc1017PrintLoadUnit(loadUnitId)`, `rc1017PrintAllLoadUnits()`.

- [ ] **Step 1: Write failing print/stow contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC1017: jeder LKW hat eigene Ladelisten- und Stauplanfunktionen',()=>{
  for(const fn of ['rc1017RenderLoadList','rc1017PrintLoadUnit','rc1017PrintAllLoadUnits'])assert.match(html,new RegExp(`function\\s+${fn}\\s*\\(`));
  assert.match(html,/LKW X von N|LKW \$\{.*sequence/i);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-print-stow.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Render load-unit-specific load lists**

Build the load list from `loadUnit.rows` only. Header must contain the unchanged main reference and `LKW X von N`; totals must use `loadUnit.totalCount`, `totalWeightKg`, `totalLdm`.

- [ ] **Step 4: Reuse stow-plan logic with explicit row input**

Refactor the smallest possible seam around existing `printStow()` so the computation/render path can accept a row list. Legacy call without argument continues to use all rows; RC1017 calls it with one load unit's rows. Preserve the RC973/RC997 unique-function contracts.

- [ ] **Step 5: Implement ordered overall print**

For each load unit, create the explicit sequence `QR -> Ladeliste -> Stauplan/zugehörige Seiten`. Do not restore QR into ordinary PDF output; QR pages are intentional load-unit print pages only.

- [ ] **Step 6: Run print regressions and commit**

Run: `node --test test/rc1017-multi-truck-print-stow.test.mjs test/rc973-long-text-autogrow.test.mjs .github/rc997/rc997-shipment-contract.test.mjs`

Expected: PASS.

```bash
git add TESTVERSION.html test/rc1017-multi-truck-print-stow.test.mjs
git commit -m "feat: print separate load lists and stow plans per truck"
```

---

### Task 7: POD je Teil-LKW und abgeleiteter Hauptstatus

**Files:**
- Modify: active POD/pickup handling in `TESTVERSION.html` and the existing API module used for signed load-list/POD persistence
- Create: `test/rc1017-multi-truck-pod-status.test.mjs`

**Interfaces:**
- Consumes: `shipment.id`, `loadUnit.id`, Teil-LKW-Status/POD.
- Produces: eindeutige POD-Zuordnung und `rc1017DeriveParentStatus(shipment)`.

- [ ] **Step 1: Write failing POD/status tests**

Test these exact cases:

```js
assert.equal(parent([{status:'Abgeholt'},{status:'Bereit zur Abholung'}]),'Bereit zur Abholung');
assert.equal(parent([{status:'Abgeholt'},{status:'Abgeholt'}]),'Abgeholt');
assert.equal(parent([{status:'POD vorhanden'},{status:'Abgeholt'}]),'Abgeholt');
assert.equal(parent([{status:'POD vorhanden'},{status:'POD vorhanden'}]),'POD vorhanden');
```

Also assert a POD object includes `shipmentId` and `loadUnitId` and is rendered as `POD · LKW 1 von 2`.

- [ ] **Step 2: Run RED**

Run the new test and verify failure.

- [ ] **Step 3: Persist POD to the selected load unit only**

Extend the existing signed-loadlist/POD save record with `loadUnitId`. For legacy single-truck shipments, missing `loadUnitId` remains accepted.

- [ ] **Step 4: Derive parent shipment status**

Implement `rc1017DeriveParentStatus(shipment)` so partial pickup never prematurely advances the main shipment to `Abgeholt` and partial POD never advances it to `POD vorhanden`.

- [ ] **Step 5: Run POD/status regressions and commit**

Run new RC1017 tests plus existing pickup/POD tests.

```bash
git add TESTVERSION.html api test/rc1017-multi-truck-pod-status.test.mjs
git commit -m "feat: track pod and status per truck load unit"
```

---

### Task 8: ABD-Sperre, Fehlerzustände und Rückwärtskompatibilität

**Files:**
- Modify: `TESTVERSION.html`
- Create: `test/rc1017-multi-truck-guards.test.mjs`

**Interfaces:**
- Consumes: bestehende `Wartet auf ABD`-Logik, Multi-Truck-Splitzustand.
- Produces: Guard-Funktionen, die Teil-LKW-Abholung sperren und Alt-Sendungen unangetastet lassen.

- [ ] **Step 1: Write failing guard tests**

Tests müssen prüfen:

```js
// Kein Teil-LKW darf versandbereit werden, solange Hauptsendung auf ABD wartet.
assert.equal(canPickup({status:'Wartet auf ABD'}, {status:'Bereit zur Abholung'}),false);
// Bereits abgeholte Altsendungen werden nicht automatisch gesplittet.
assert.equal(shouldAutoSplit({status:'Abgeholt',multiTruck:null}),false);
// Entwurf/Erstellt darf bei Kapazitätsüberschreitung gesplittet werden.
assert.equal(shouldAutoSplit({status:'Erstellt'}),true);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/rc1017-multi-truck-guards.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add explicit guards**

Implement guards for missing profile, invalid Colli data, oversized single unit, stale/inconsistent split, ABD block and progressed legacy shipments. Visible user text must use `Manuelle Ladeplanung erforderlich` for unsplittable capacity cases.

- [ ] **Step 4: Run full Node test suite**

Run: `npm test`

Expected: all `test/*.test.mjs` pass.

- [ ] **Step 5: Run explicit legacy shipment contracts**

Run: `node --test .github/rc997/rc997-shipment-contract.test.mjs test/rc973-long-text-autogrow.test.mjs test/rc975-global-render-integrity.test.mjs test/rc978-shipment-fluid-layout.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc1017-multi-truck-guards.test.mjs
git commit -m "test: enforce multi-truck guards and compatibility"
```

---

### Task 9: Synchronisierte Website-Artefakte und Release-Verifikation

**Files:**
- Modify: `index.html` only through the repository's existing approved TESTVERSION-to-index release/build flow
- Modify: any existing version/release marker files required by that flow
- Test: existing release/website consistency tests and all RC1017 tests

**Interfaces:**
- Consumes: verified `TESTVERSION.html` implementation from Tasks 1-8.
- Produces: identical functional Mehr-LKW behavior in the repository's synchronized site artifact without creating a second divergent implementation.

- [ ] **Step 1: Identify the existing release synchronization workflow**

Search `.github/workflows`, release scripts and prior RC1015 commit history for the command/action that propagates the validated TESTVERSION changes to the deployed site artifact. Use that existing path; do not manually maintain two independent implementations.

- [ ] **Step 2: Run the synchronization on the feature branch**

Apply the RC1017-tested block through the existing workflow/script so `TESTVERSION.html` and the synchronized website artifact carry the same functional version.

- [ ] **Step 3: Verify no production deployment happened**

Confirm branch is `feature/multi-truck-shipment-split`, `main` SHA is unchanged from the pre-feature baseline, and no production deployment job was invoked.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm test
node --test .github/rc997/rc997-shipment-contract.test.mjs
```

Then run all repository-provided release/consistency tests discovered in Step 1.

Expected: all green.

- [ ] **Step 5: Commit synchronized artifacts**

```bash
git add TESTVERSION.html index.html production-version.js RELEASE_MANIFEST.txt .github test api
git commit -m "build: integrate RC1017 multi-truck shipments"
```

Only include files actually changed by the approved synchronization flow.

---

## Self-Review

### Spec coverage

- Deterministic split by LDM and weight: Task 1.
- Physical-unit splitting and sum preservation: Task 1.
- Stable nested `loadUnits`: Tasks 1-3.
- Loss-protected sync/merge: Task 2.
- Automatic recalculation and manual-adjustment protection: Tasks 3-4.
- Separate pickup QR and split-version invalidation: Task 5.
- Separate load list and stow plan: Task 6.
- Separate POD and parent status: Task 7.
- ABD, error and backward-compatibility guards: Task 8.
- Site synchronization and no-direct-production constraint: Task 9.

### Placeholder scan

No `TBD`, `TODO`, `implement later`, generic `add error handling`, or undefined cross-task interface is intentionally left in this plan. Task 5 and Task 9 require repository discovery because the exact active public-access/release implementation can move between RCs; each discovery step is constrained to existing active code and explicitly forbids parallel replacement paths.

### Type/name consistency

The plan consistently uses:

- `shipment.multiTruck`
- `multiTruck.splitVersion`
- `multiTruck.loadUnits`
- `loadUnit.id`
- `loadUnit.sequence`
- `loadUnit.total`
- `loadUnit.rows`
- `loadUnit.totalCount`
- `loadUnit.totalWeightKg`
- `loadUnit.totalLdm`
- `loadUnit.status`
- `loadUnit.pickup`
- `loadUnit.pod`

No later task renames these fields.
