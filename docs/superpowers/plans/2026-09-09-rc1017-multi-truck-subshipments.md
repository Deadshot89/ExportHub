# RC1017 Multi-Truck Subshipments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExportHUB soll bei einer Sendung, die nicht in einen LKW passt, automatisch stabile LKW-Teilsendungen mit eigener Ladeliste, eigenem QR/Pickup-Kontext und eigenem Abhol-/POD-Status erzeugen; zusätzlich erhält der Abholkalender die freigegebene Farb- und Kundenanzeigeregel.

**Architecture:** Die bestehende Hauptsendung bleibt kanonische Kunden-/Export-Einheit. Ein neues reines Mehr-LKW-Modul partitioniert physische Colli deterministisch über einen Adapter zur bestehenden Stauplan-/Kapazitätslogik. Teilsendungen werden innerhalb der Hauptsendung persistiert und durch Merge-, Pickup- und Statuslogik serverseitig gegen stale Clients geschützt; bestehende QR-, POD-, Avis-, ABD- und Dokumentenmechanismen werden wiederverwendet statt dupliziert.

**Tech Stack:** Vanilla JavaScript/HTML/CSS, Node.js >=20, `node:test`, Azure Functions CommonJS unter `api/`, Azure Blob Storage über bestehende Stores, bestehende ExportHUB Drei-Umgebungen-Build-/Deploy-Pipeline.

**Spec:** `docs/superpowers/specs/2026-09-09-rc1017-multi-truck-subshipments-design.md`

**Additional approved spec:** `docs/superpowers/specs/2026-09-09-rc1017-calendar-visual-addendum.md`

## Global Constraints

- Entwicklung auf `rc1017-multi-truck-subshipments`; `main` nicht direkt verändern.
- Produktion, TESTSERVICE und Demo müssen beim späteren Release denselben geprüften Quellstand erhalten.
- Der heutige Ein-LKW-Ablauf bleibt unverändert, wenn alle Colli in ein Fahrzeug passen.
- Eine Hauptsendung bleibt genau eine Kunden-/Export-Sendung; Teilsendungen sind ausschließlich operative LKW-Untereinheiten.
- Jede Teilsendung benötigt eine stabile eigene `subShipmentId`, eigenen QR-/Pickup-Kontext, eigene Ladeliste und eigenen Pickup-/POD-Status.
- Die Summe der Teilsendungsmengen muss exakt der Hauptsendungsmenge entsprechen; keine physische Einheit darf doppelt vorkommen.
- Mengenaufteilung ist nur ganzzahlig; eine einzelne physische Einheit (`count = 1`) wird nie künstlich geteilt.
- Die bestehende Stauplan-/Kapazitätslogik bleibt die einzige Quelle für die Frage, ob eine LKW-Ladung passt. RC1017 baut keinen konkurrierenden Kapazitätsrechner.
- Ab erster operativer Teilsendungsaktivität (Pickup begonnen/gespeichert, abgeholt oder POD vorhanden) ist die Aufteilung gesperrt.
- ABD, Kunden-Avis, Kunden-/Empfängerstamm und sendungsbezogene Dokumente bleiben auf Hauptsendungsebene.
- Bestehende RC995/RC998/RC1014/RC1016 Sicherheits- und Persistenzregeln für öffentliche Links, PIN, Pickup, POD und stale Clients bleiben verbindlich.
- Öffentliche Tokens dürfen nicht in kanonischen Team-State-Sendungen persistiert werden.
- Der Abholkalender zeigt fixe Abholungen grün, Sendungen blau und auf jeder Sendungskarte explizit den Kundennamen.
- Den sichtbaren historischen Release-Marker `RC1013` nicht nebenbei ändern. Ein Markerwechsel erfolgt nur, wenn der bestehende Drei-Umgebungen-Releasevertrag in Task 8 bewusst und vollständig migriert wird.

---

### Task 1: Abholkalender – blaue Sendungen, grünes FIX, Kundenname sichtbar

**Files:**
- Modify: `assets/abholkalender.js`
- Modify: `assets/abholkalender.css`
- Create: `test/rc1017-calendar-visuals.test.mjs`

**Interfaces:**
- Consumes: bestehende `shipmentCustomer(shipment)`, `renderShipmentCard(shipment)`, Klassen `pickup-item-fix`, `pickup-item-shipment`.
- Produces: unveränderte Kalenderdatenlogik mit expliziter Kundenbeschriftung und eindeutiger Farbsemantik.

- [ ] **Step 1: Failing visual contract test schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync('assets/abholkalender.js','utf8');
const css = fs.readFileSync('assets/abholkalender.css','utf8');

test('RC1017 Kalender: fixe Abholungen sind grün und Sendungen blau',()=>{
  assert.match(css,/\.pickup-item-fix\s*\{[^}]*background:[^;}]*(?:34,197,94|22,163,74|#(?:16a34a|22c55e))/i);
  assert.match(css,/\.pickup-item-shipment\s*\{[^}]*background:[^;}]*(?:37,99,235|59,130,246|#(?:2563eb|3b82f6))/i);
});

test('RC1017 Kalender: Sendungskarte nennt den Kunden explizit',()=>{
  assert.match(js,/recipientCustomerName/);
  assert.match(js,/Kunde:\s*<strong>/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-calendar-visuals.test.mjs`

Expected: FAIL, weil FIX-Karten aktuell nicht grün sind und der Kundenname nicht als `Kunde:` beschriftet wird.

- [ ] **Step 3: Kundenauflösung und Renderer minimal erweitern**

In `shipmentCustomer()` die Reihenfolge auf reale Kundenfelder erweitern:

```js
function shipmentCustomer(shipment){
  return String(shipment && (
    shipment.customerName ||
    shipment.customer ||
    shipment.recipientCustomerName ||
    shipment.recipient ||
    shipment.locationName
  ) || 'Ohne Kunde');
}
```

In `renderShipmentCard()` den Kunden eindeutig beschriften:

```js
const customer = shipmentCustomer(shipment);
// innerhalb pickup-item-grid:
`<span>Kunde: <strong>${esc(customer)}</strong></span>`
```

- [ ] **Step 4: Kartenfarben an bestehenden Typklassen setzen**

```css
.pickup-item-fix{background:rgba(34,197,94,.10);border-color:rgba(22,163,74,.28)}
.pickup-item-shipment{background:rgba(37,99,235,.09);border-color:rgba(37,99,235,.26)}
.pickup-badge-fix{background:rgba(34,197,94,.16);color:#166534}
.pickup-badge-shipment{background:rgba(37,99,235,.13);color:#1d4ed8}
```

Keine Datum-, Status-, Rechte- oder API-Änderung vornehmen.

- [ ] **Step 5: GREEN + Kalenderregressionen ausführen**

Run:

```bash
node --test test/rc1017-calendar-visuals.test.mjs
node --test test/rc1012-abholkalender-runtime-integration.test.mjs
npm test
```

Expected: alle Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/abholkalender.js assets/abholkalender.css test/rc1017-calendar-visuals.test.mjs
git commit -m "RC1017: Abholkalender farblich unterscheiden"
```

---

### Task 2: Reines Mehr-LKW-Datenmodell und deterministische Colli-Partition

**Files:**
- Create: `assets/rc1017-multi-truck.js`
- Create: `test/rc1017-multi-truck-model.test.mjs`

**Interfaces:**
- Consumes: kanonische Colli-Zeilen `{type,count,weight,ldm,l,w,h,...}` und einen `fitRows(rows)`-Adapter zur vorhandenen Stauplanlogik.
- Produces: `ExportHubMultiTruck.planSubShipments(input)` sowie reine Hilfen `normalizeRows`, `validatePartition`, `aggregateSubShipmentStatus`.

Definierte Schnittstelle:

```js
planSubShipments({
  shipmentId,
  rows,
  previousSubShipments = [],
  locked = false,
  fitRows
}) => {
  requiredTruckCount,
  subShipments,
  changed,
  locked
}
```

Jede Teilsendung:

```js
{
  subShipmentId: `${shipmentId}-TRUCK-${index+1}`,
  sequence: index + 1,
  total: n,
  label: `Sendung ${index+1} von ${n}`,
  rows: [{sourceRowId, count, type, weight, ldm, l, w, h}],
  totalColli,
  totalWeight,
  totalLdm,
  status: 'open',
  pickup: null,
  locked: false
}
```

- [ ] **Step 1: RED-Tests für Partition und Bestandsschutz schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadModel(){
  const code=fs.readFileSync('assets/rc1017-multi-truck.js','utf8');
  const sandbox={globalThis:{}};
  vm.runInNewContext(code,sandbox);
  return sandbox.globalThis.ExportHubMultiTruck;
}

test('RC1017: Ein-LKW-Sendung erzeugt keine operative Teilsendungsebene',()=>{
  const m=loadModel();
  const result=m.planSubShipments({shipmentId:'ABC123',rows:[{id:'r1',count:2,ldm:.4}],fitRows:()=>({fits:true})});
  assert.equal(result.requiredTruckCount,1);
  assert.equal(result.subShipments.length,0);
});

test('RC1017: Überkapazität verteilt ganze physische Einheiten ohne Verlust',()=>{
  const m=loadModel();
  const fitRows=rows=>({fits:rows.reduce((n,r)=>n+r.count,0)<=2});
  const result=m.planSubShipments({shipmentId:'ABC123',rows:[{id:'r1',count:3,weight:300,ldm:.6}],fitRows});
  assert.equal(result.requiredTruckCount,2);
  assert.deepEqual(result.subShipments.map(x=>x.totalColli),[2,1]);
  assert.equal(result.subShipments.flatMap(x=>x.rows).reduce((n,r)=>n+r.count,0),3);
});

test('RC1017: gesperrte Aufteilung bleibt identisch',()=>{
  const m=loadModel();
  const previous=[{subShipmentId:'ABC123-TRUCK-1',sequence:1,total:2,rows:[{sourceRowId:'r1',count:2}],locked:true},{subShipmentId:'ABC123-TRUCK-2',sequence:2,total:2,rows:[{sourceRowId:'r1',count:1}],locked:false}];
  const result=m.planSubShipments({shipmentId:'ABC123',rows:[{id:'r1',count:4}],previousSubShipments:previous,locked:true,fitRows:()=>({fits:true})});
  assert.deepEqual(result.subShipments,previous);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-multi-truck-model.test.mjs`

Expected: FAIL, Datei/Export existiert noch nicht.

- [ ] **Step 3: UMD-artiges reines Modell implementieren**

Grundstruktur:

```js
(function(root){
  'use strict';
  function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function count(v){ const n=Math.round(Number(v)); return Number.isFinite(n)&&n>0?n:0; }
  function rowId(row,index){ return String(row.id||row._syncId||`row-${index+1}`); }

  function explodePhysicalRows(rows){
    const units=[];
    (rows||[]).forEach((row,index)=>{
      const n=count(row.count||row.qty||row.quantity||row.anzahl||row.menge);
      for(let i=0;i<n;i++) units.push({sourceRowId:rowId(row,index),source:clone(row)});
    });
    return units;
  }

  function planSubShipments(input){
    const shipmentId=String(input&&input.shipmentId||'').trim();
    const fitRows=input&&input.fitRows;
    if(!shipmentId) throw new Error('SHIPMENT_ID_REQUIRED');
    if(typeof fitRows!=='function') throw new Error('FIT_ROWS_REQUIRED');
    if(input.locked) return {requiredTruckCount:Math.max(1,(input.previousSubShipments||[]).length),subShipments:clone(input.previousSubShipments||[]),changed:false,locked:true};
    // deterministische First-Fit-Verteilung physischer Einheiten; jede Kandidatenbelegung wird ausschließlich über fitRows geprüft.
  }

  root.ExportHubMultiTruck={planSubShipments,validatePartition,aggregateSubShipmentStatus};
})(typeof globalThis!=='undefined'?globalThis:this);
```

Implementiere bei `count > 1` ganzzahlige Aggregation derselben `sourceRowId` pro LKW; Gewicht/LDM proportional nach Stückzahl. Wenn alle Einheiten in einen LKW passen, `subShipments: []` zurückgeben.

- [ ] **Step 4: Validierung implementieren**

`validatePartition(rows, subShipments)` muss mindestens werfen bei:

```js
'PARTITION_COUNT_MISMATCH'
'DUPLICATE_PHYSICAL_UNIT'
'INVALID_SUBSHIPMENT_ID'
'INVALID_SUBSHIPMENT_SEQUENCE'
```

Die Testdaten müssen zusätzlich sicherstellen, dass Summe `count`, `weight` und `ldm` erhalten bleibt.

- [ ] **Step 5: GREEN + Gesamtregression**

Run:

```bash
node --test test/rc1017-multi-truck-model.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/rc1017-multi-truck.js test/rc1017-multi-truck-model.test.mjs
git commit -m "RC1017: Mehr-LKW-Partitionierungsmodell hinzufügen"
```

---

### Task 3: Browserintegration – Hauptsendung, Stauplanadapter, Persistenz und Sperre

**Files:**
- Modify: `index.html` around `canonicalColliCard`, `rc380StowPlan`, `printStow`, `activateQr`, shipment serialization/save path
- Modify: `.github/rc1013/build-three-env.mjs`
- Create: `test/rc1017-multi-truck-integration.test.mjs`

**Interfaces:**
- Consumes: `window.ExportHubMultiTruck.planSubShipments`, bestehende Colli-Erfassung und vorhandene Stauplan-/Kapazitätsfunktion.
- Produces: `shipment.subShipments`, `shipment.multiTruckLocked`, `shipment.requiredTruckCount`, UI-Hook `renderRc1017SubShipments(shipment)`.

- [ ] **Step 1: RED-Integrationsvertrag schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');

test('RC1017: Multi-Truck-Asset wird in allen gebauten Umgebungen ausgeliefert',()=>{
  assert.match(build,/rc1017-multi-truck\.js/);
  assert.match(html,/renderRc1017SubShipments/);
});

test('RC1017: Teilsendungen werden in der Hauptsendung persistiert',()=>{
  assert.match(html,/subShipments/);
  assert.match(html,/multiTruckLocked/);
  assert.match(html,/requiredTruckCount/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-multi-truck-integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Asset über bestehenden Drei-Umgebungen-Build einbinden**

In `.github/rc1013/build-three-env.mjs` das neue Asset wie die vorhandenen Kalender-/Diagnoseassets kopieren und in Produktion, TESTSERVICE und Demo einbinden:

```js
copy('assets/rc1017-multi-truck.js');
```

Der Script-Tag muss nach den Kernfunktionen verfügbar sein, bevor die RC1017-UI aufgerufen wird.

- [ ] **Step 4: Adapter zur bestehenden Stauplanlogik bauen**

Im aktiven `index.html`-Stauplanbereich genau eine Funktion ergänzen:

```js
function rc1017FitRows(rows){
  const result = /* vorhandene kanonische Stauplan-/Kapazitätsroutine mit diesen rows und aktuellem Fahrzeug */;
  return {fits:result.fits!==false,plan:result.plan||result,totalLdm:result.totalLdm,totalWeight:result.totalWeight};
}
```

Wichtig: Hier keine zweite Geometrieformel implementieren. Die Funktion muss die vorhandene Routine aufrufen, die heute den Stauplan erzeugt. Wenn die vorhandene Routine vor Änderung nicht als reine Funktion aufrufbar ist, zuerst nur deren bereits existierende Berechnung in einen kleinen wiederverwendbaren Helper extrahieren; Formeln unverändert lassen.

- [ ] **Step 5: Teilsendungen vor Speichern/Visual-Refresh berechnen**

```js
function rc1017SyncSubShipments(shipment){
  const previous=Array.isArray(shipment.subShipments)?shipment.subShipments:[];
  const locked=shipment.multiTruckLocked===true || previous.some(x=>x&&x.locked===true);
  const result=window.ExportHubMultiTruck.planSubShipments({
    shipmentId:String(shipment.id||shipment.shipmentId||shipment.ref||shipment.reference||''),
    rows:Array.isArray(shipment.rows)?shipment.rows:[],
    previousSubShipments:previous,
    locked,
    fitRows:rc1017FitRows
  });
  shipment.requiredTruckCount=result.requiredTruckCount;
  shipment.subShipments=result.subShipments;
  shipment.multiTruckLocked=result.locked;
  return result;
}
```

Vor Persistenz `validatePartition()` ausführen. Bei Fehler Speichern blockieren und verständlichen Diagnosefehler anzeigen.

- [ ] **Step 6: Sperrlogik anbinden**

`multiTruckLocked` muss `true` werden, sobald eine gespeicherte Teilsendung eine dieser Bedingungen erfüllt:

```js
sub.locked === true
sub.status === 'partial'
sub.status === 'confirmed'
sub.status === 'pod'
Array.isArray(sub.pickupHistory) && sub.pickupHistory.length > 0
Array.isArray(sub.podFiles) && sub.podFiles.length > 0
```

Bei gesperrtem Zustand Änderungen an `rows`, Fahrzeugtyp oder relevanten Maßen, die die Partition ändern würden, mit Meldung blockieren:

`Die LKW-Aufteilung ist bereits in Verwendung und kann nach begonnener Abholung nicht mehr automatisch geändert werden.`

- [ ] **Step 7: GREEN + vorhandene Stauplan-/Colli-Regressionen**

Run:

```bash
node --test test/rc1017-multi-truck-integration.test.mjs
node --test test/rc973-long-text-autogrow.test.mjs
node --test test/rc975-global-render-integrity.test.mjs
node --test test/rc978-shipment-fluid-layout.test.mjs
node --test test/rc980-colli-row-stability.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html .github/rc1013/build-three-env.mjs test/rc1017-multi-truck-integration.test.mjs
git commit -m "RC1017: Mehr-LKW-Modell in Sendung und Stauplan integrieren"
```

---

### Task 4: Server-Persistenz und Merge-Schutz für Teilsendungen

**Files:**
- Modify: `api/shared/merge.js`
- Create: `test/rc1017-subshipment-merge.test.mjs`

**Interfaces:**
- Consumes: vorhandenes `mergeShipmentProtected(serverItem,incomingItem)` und RC1016-Avis-Schutz.
- Produces: `rc1017ProtectSubShipments(out,serverItem,incomingItem)` ohne Abschwächung der bisherigen Merge-Regeln.

- [ ] **Step 1: RED-Test für stale Client schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');

test('RC1017: stale Client darf begonnene Teilsendung nicht zurücksetzen',()=>{
  const server={id:'S1',_syncUpdatedAt:'2026-09-09T13:00:00Z',subShipments:[{subShipmentId:'S1-TRUCK-1',status:'confirmed',locked:true,pickupHistory:[{id:'pickup-1'}]}],multiTruckLocked:true};
  const stale={id:'S1',_syncUpdatedAt:'2026-09-09T13:05:00Z',subShipments:[{subShipmentId:'S1-TRUCK-1',status:'open',locked:false,pickupHistory:[]}],multiTruckLocked:false};
  const out=merge.mergeShipmentProtected(server,stale);
  assert.equal(out.multiTruckLocked,true);
  assert.equal(out.subShipments[0].status,'confirmed');
  assert.equal(out.subShipments[0].pickupHistory.length,1);
});
```

Falls `mergeShipmentProtected` derzeit nicht exportiert ist, exportiere die bestehende Funktion zusätzlich ausschließlich für Test/Reuse, ohne das Laufzeitverhalten zu verändern.

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-subshipment-merge.test.mjs`

Expected: FAIL, stale Client überschreibt noch die Teilsendungsstruktur oder Helper ist nicht exportiert.

- [ ] **Step 3: Operativen Teilsendungs-Zeitstempel definieren**

```js
function rc1017SubShipmentOperationalTimestamp(sub){
  const candidates=[sub&&sub.confirmedAt,sub&&sub.lastPartialPickupAt,sub&&sub.podUpdatedAt,sub&&sub.updatedAt];
  if(Array.isArray(sub&&sub.pickupHistory)) for(const item of sub.pickupHistory) candidates.push(item&&item.confirmedAt);
  let latest=0;
  for(const value of candidates){const t=Date.parse(value||'');if(Number.isFinite(t)&&t>latest)latest=t;}
  return latest;
}
```

- [ ] **Step 4: Server-authoritative operative Felder schützen**

Pro `subShipmentId` sind bei neuerem serverseitigem operativem Zeitstempel mindestens zu schützen:

```js
[
  'status','locked','pickupHistory','collectedPickupCollis','pickupCollectedColliCount',
  'remainingPickupCollis','pickupRemainingColliCount','confirmedAt','lastPartialPickupAt',
  'podFiles','signatureBlobName','signatureStoredAt','pickupRegistered','pickupAccessKeyHash'
]
```

Raw Tokens gehören nicht in diese Liste und nicht in den Team State.

Wenn irgendeine Teilsendung operativ gesperrt ist, muss `out.multiTruckLocked = true` bleiben.

- [ ] **Step 5: RC1016-Avis-Regeln unverändert halten und GREEN prüfen**

Run:

```bash
node --test test/rc1017-subshipment-merge.test.mjs
node --test test/rc1016-lieferavis-persistence.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/shared/merge.js test/rc1017-subshipment-merge.test.mjs
git commit -m "RC1017: Teilsendungsstatus gegen stale Sync schützen"
```

---

### Task 5: QR-/Pickup-Registrierung pro Teilsendung

**Files:**
- Modify: `api/pickup-init/index.js`
- Modify: `api/pickup-status/index.js`
- Modify: `api/shared/pickup-store.js`
- Create: `test/rc1017-subshipment-pickup.test.mjs`

**Interfaces:**
- Consumes: bestehende `pickup-init`, `public-access-store.issue`, `pickup-store` Records.
- Produces: optionaler `subShipmentId` im Pickup-Record und Snapshot, wobei Ein-LKW-Aufrufe ohne `subShipmentId` unverändert funktionieren.

- [ ] **Step 1: RED-API-Test schreiben**

Nutze dasselbe Mock-Lademuster wie `test/rc1013-pickup-readonly-flow.test.mjs`. Prüfe:

```js
assert.equal(body.subShipmentId,'S1-TRUCK-2');
assert.equal(body.subShipmentLabel,'Sendung 2 von 2');
assert.equal(body.expectedColliCount,1);
assert.deepEqual(body.rows,[{id:'r1',count:1}]);
```

Zusätzlich muss ein zweiter Init für `S1-TRUCK-1` einen anderen Token/Access-Key erhalten.

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-subshipment-pickup.test.mjs`

Expected: FAIL, API kennt die Teilsendungsfelder noch nicht.

- [ ] **Step 3: `pickup-init` um optionalen Teilsendungs-Kontext erweitern**

Nach dem vorhandenen `src`-Parsing:

```js
const subShipmentId=text(src.subShipmentId||b.subShipmentId);
const subShipmentSequence=Math.max(0,Math.round(Number(src.subShipmentSequence||b.subShipmentSequence)||0));
const subShipmentTotal=Math.max(0,Math.round(Number(src.subShipmentTotal||b.subShipmentTotal)||0));
const subShipmentLabel=subShipmentId&&subShipmentSequence&&subShipmentTotal?`Sendung ${subShipmentSequence} von ${subShipmentTotal}`:'';
```

Wenn `subShipmentId` vorhanden ist, müssen `rows` bereits auf genau diese Teilsendung gefiltert sein. `subjectId` wird eindeutig:

```js
const pickupSubjectId=subShipmentId ? `${shipmentId}::${subShipmentId}` : shipmentId;
```

In `access.issue()` und Pickup-Record speichern:

```js
{shipmentId,subShipmentId,subShipmentSequence,subShipmentTotal,subShipmentLabel,reference,rows,expectedColliCount:expected}
```

- [ ] **Step 4: `publicRecord()` erweitert Teilsendungsmetadaten ausgeben**

In `api/shared/pickup-store.js`:

```js
subShipmentId:r.subShipmentId||'',
subShipmentSequence:Number(r.subShipmentSequence||0)||0,
subShipmentTotal:Number(r.subShipmentTotal||0)||0,
subShipmentLabel:r.subShipmentLabel||''
```

- [ ] **Step 5: `pickup-status` bleibt rückwärtskompatibel**

Keine neue Statuslogik im Endpoint; `store.publicRecord(record,token)` liefert die Teilsendungsmetadaten. Ein alter QR ohne `subShipmentId` bleibt identisch funktionsfähig.

- [ ] **Step 6: GREEN + öffentliche-Link-Regressionen**

Run:

```bash
node --test test/rc1017-subshipment-pickup.test.mjs
node --test test/rc1013-pickup-readonly-flow.test.mjs
node --test test/rc1014-diagnostics-integration.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/pickup-init/index.js api/pickup-status/index.js api/shared/pickup-store.js test/rc1017-subshipment-pickup.test.mjs
git commit -m "RC1017: eigene QR-Kontexte pro LKW-Teilsendung"
```

---

### Task 6: Pickup-Bestätigung in richtige Teilsendung schreiben und Hauptstatus aggregieren

**Files:**
- Modify: `api/pickup-confirm-v2/index.js`
- Modify: `api/shared/pickup-store.js`
- Extend: `test/rc1017-subshipment-pickup.test.mjs`

**Interfaces:**
- Consumes: Pickup-Record mit `shipmentId` + optional `subShipmentId`, bestehende `updateTeam(record,...)`.
- Produces: teilsendungsbezogene Pickup-Historie/POD und aggregierter Hauptsendungsstatus.

- [ ] **Step 1: RED-Test ergänzen – LKW 1 darf LKW 2 nicht abschließen**

```js
assert.equal(updatedShipment.subShipments[0].status,'confirmed');
assert.equal(updatedShipment.subShipments[0].locked,true);
assert.equal(updatedShipment.subShipments[1].status,'open');
assert.notEqual(updatedShipment.status,'Abgeholt');
```

Zweiter Pickup für LKW 2:

```js
assert.equal(updatedShipment.subShipments.every(x=>x.status==='confirmed'),true);
assert.equal(updatedShipment.status,'Abgeholt');
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-subshipment-pickup.test.mjs`

Expected: FAIL, `updateTeam()` aktualisiert aktuell nur Hauptsendungs-Pickupfelder.

- [ ] **Step 3: `updateTeam()` teilsendungsfähig machen**

Wenn `record.subShipmentId` leer ist: bestehenden Codepfad unverändert ausführen.

Wenn vorhanden:

```js
const subs=Array.isArray(sh.subShipments)?sh.subShipments:[];
const index=subs.findIndex(x=>String(x&&x.subShipmentId||'')===String(record.subShipmentId));
if(index<0) throw err('SUBSHIPMENT_NOT_FOUND','Teilsendung wurde in der Hauptsendung nicht gefunden.',409);
const next=Object.assign({},subs[index],{
  status:complete?'confirmed':(collected>0?'partial':'open'),
  locked:collected>0||complete,
  pickupHistory:history.map(/* vorhandenes sichere History-Mapping wiederverwenden */),
  collectedPickupCollis:collected,
  pickupCollectedColliCount:collected,
  remainingPickupCollis:remaining,
  pickupRemainingColliCount:remaining,
  confirmedAt:complete?(record.confirmedAt||null):null,
  lastPartialPickupAt:record.lastPartialPickupAt||null,
  podFiles:realPodFiles(record)
});
sh.subShipments=subs.map((x,i)=>i===index?next:x);
sh.multiTruckLocked=sh.subShipments.some(x=>x&&x.locked===true);
```

- [ ] **Step 4: Hauptstatus ausschließlich aggregieren**

```js
function aggregateShipmentFromSubs(sh){
  const subs=Array.isArray(sh.subShipments)?sh.subShipments:[];
  if(subs.length<2) return sh;
  const allPicked=subs.every(x=>x.status==='confirmed'||x.status==='pod'||x.status==='completed');
  const allPod=subs.every(x=>Array.isArray(x.podFiles)&&x.podFiles.length>0 || x.signatureBlobName);
  if(allPicked) sh.status='Abgeholt';
  else if(subs.some(x=>x.status==='partial'||x.status==='confirmed'||x.status==='pod'||x.status==='completed')) sh.status='Teilweise abgeholt';
  if(allPicked&&allPod) sh.podStatus='POD vorhanden';
  return sh;
}
```

Die bestehende spätere Abschlusslogik darf weiter `Abgeschlossen` setzen, aber nie bevor alle Teilsendungen ihre Pflichtbedingungen erfüllen.

- [ ] **Step 5: `pickup-confirm-v2` selbst nur den Record bestätigen lassen**

Die bestehende PIN-, Kennzeichen-, Colli-, Unterschrift- und Token-Consume-Logik bleibt unverändert. Teilsendungszuordnung erfolgt durch `record.subShipmentId` und `store.updateTeam()`.

- [ ] **Step 6: GREEN + Pickup-Regressionssuite**

Run:

```bash
node --test test/rc1017-subshipment-pickup.test.mjs
node --test test/rc1013-pickup-readonly-flow.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/pickup-confirm-v2/index.js api/shared/pickup-store.js test/rc1017-subshipment-pickup.test.mjs
git commit -m "RC1017: Pickup-Status je Teilsendung aggregieren"
```

---

### Task 7: Mehr-LKW-UI, eigene Ladelisten, eigener QR und eigener Stauplan je LKW

**Files:**
- Modify: `index.html` around `rc363BlockStow`, `printStow`, `activateQr`, Gesamt-/Ladelisten-Ausgabe and shipment overview
- Create: `test/rc1017-multi-truck-print-ui.test.mjs`

**Interfaces:**
- Consumes: persistierte `shipment.subShipments` und vorhandene `printStow()`/QR-Ausgabe.
- Produces: sichtbare Karten `Sendung X von Y`, teilsendungsgefilterte Ladelisten und QR-Aktionen.

- [ ] **Step 1: RED-Vertrag für UI und Druck schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');

test('RC1017: Mehr-LKW-UI hat getrennte operative Aktionen',()=>{
  for(const marker of ['rc1017-subshipments','Sendung ${sequence} von ${total}','rc1017-print-subshipment','rc1017-qr-subshipment']){
    assert.match(html,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('RC1017: Teilladeliste filtert Rows über subShipmentId',()=>{
  assert.match(html,/function\s+rc1017RowsForSubShipment\s*\(/);
  assert.match(html,/subShipmentId/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-multi-truck-print-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Mehr-LKW-Zusammenfassung im Stauplanbereich rendern**

```js
function renderRc1017SubShipments(shipment){
  const subs=Array.isArray(shipment&&shipment.subShipments)?shipment.subShipments:[];
  if(subs.length<2) return '';
  return `<section id="rc1017-subshipments"><h4>${subs.length} LKW erforderlich</h4>${subs.map(sub=>{
    const sequence=Number(sub.sequence||0),total=Number(sub.total||subs.length);
    return `<article class="rc1017-subshipment" data-sub-shipment-id="${esc(sub.subShipmentId)}">
      <strong>Sendung ${sequence} von ${total}</strong>
      <span>${sub.totalColli} Colli</span><span>${Number(sub.totalWeight||0).toFixed(1)} kg</span><span>${Number(sub.totalLdm||0).toFixed(2)} LDM</span>
      <span>${esc(sub.status||'open')}</span>
      <button type="button" data-action="rc1017-print-subshipment">Ladeliste</button>
      <button type="button" data-action="rc1017-qr-subshipment">QR-Code</button>
    </article>`;
  }).join('')}</section>`;
}
```

- [ ] **Step 4: Ladeliste/Stauplan auf Teilsendung filtern**

```js
function rc1017RowsForSubShipment(shipment,subShipmentId){
  const sub=(shipment.subShipments||[]).find(x=>x&&x.subShipmentId===subShipmentId);
  return sub?JSON.parse(JSON.stringify(sub.rows||[])):[];
}
```

Den bestehenden Ladelisten-/Stauplan-Renderer mit gefilterten Rows aufrufen. Im Dokumentkopf zusätzlich ausgeben:

```text
Hauptreferenz: ABC123
Sendung 1 von 2
```

Nur der QR-Code dieser Teilsendung darf auf deren Ladeliste erscheinen.

- [ ] **Step 5: QR-Aktion pro Teilsendung über bestehenden `pickup-init`-Flow**

Der Browser sendet an `/api/pickup-init`:

```js
{
  shipment: {
    ...sharedShipmentFields,
    shipmentId: mainShipmentId,
    subShipmentId: sub.subShipmentId,
    subShipmentSequence: sub.sequence,
    subShipmentTotal: sub.total,
    rows: sub.rows,
    expectedColliCount: sub.totalColli
  }
}
```

Den zurückgegebenen Raw Token nur im bestehenden kurzlebigen UI-/QR-Kontext verwenden; nicht in `shipment.subShipments` persistieren. Persistiert werden dürfen lediglich sichere Registrierungsmetadaten wie `pickupRegistered:true` und serverseitige Access-Key-Hash-Referenzen, soweit der bestehende Flow sie bereits vorsieht.

- [ ] **Step 6: Sendungsübersicht nur einmal rendern**

Hauptsendung bleibt eine Karte/Zeile. Zusatztext:

```js
const subs=Array.isArray(sh.subShipments)?sh.subShipments:[];
const picked=subs.filter(x=>['confirmed','pod','completed'].includes(String(x.status))).length;
const multiSummary=subs.length>1?`${subs.length} Teilsendungen / ${picked} von ${subs.length} abgeholt`:'';
```

Keine separaten Top-Level-Sendungen erzeugen.

- [ ] **Step 7: GREEN + Druck-/QR-/Renderregressionen**

Run:

```bash
node --test test/rc1017-multi-truck-print-ui.test.mjs
node --test test/rc975-global-render-integrity.test.mjs
node --test test/rc973-long-text-autogrow.test.mjs
node --test test/rc1013-pickup-readonly-flow.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html test/rc1017-multi-truck-print-ui.test.mjs
git commit -m "RC1017: Ladelisten und QR je LKW-Teilsendung"
```

---

### Task 8: Releasevertrag, Drei-Umgebungen-Build und vollständige Verifikation

**Files:**
- Modify as required by current build contract: `.github/rc1013/build-three-env.mjs`
- Modify as required by current main/deploy contract: `.github/workflows/rc1002-main-contract.yml`
- Modify as required by current three-env deploy contract: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`
- Modify as required by current testservice contract: `.github/workflows/exporthub-testservice.yml`
- Create: `test/rc1017-three-env-release.test.mjs`

**Interfaces:**
- Consumes: alle RC1017 Assets/API-Änderungen und den bestehenden RC1013 Drei-Umgebungen-Build.
- Produces: exakt denselben geprüften Quellstand in Produktion, TESTSERVICE und Demo.

- [ ] **Step 1: RED-Releasevertrag schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const build=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');

test('RC1017: Drei-Umgebungen-Build enthält Kalender und Multi-Truck-Asset',()=>{
  for(const asset of ['assets/abholkalender.js','assets/abholkalender.css','assets/rc1017-multi-truck.js']) assert.match(build,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc1017-three-env-release.test.mjs`

Expected: FAIL, solange das neue Asset nicht vollständig im Releasevertrag enthalten ist.

- [ ] **Step 3: Aktuellen Releasevertrag minimal erweitern**

Keine alte RC1012/RC1013 historische Regression löschen. Der aktuelle Build muss zusätzlich `assets/rc1017-multi-truck.js` in alle drei Ausgabepakete kopieren und einbinden.

Wenn der sichtbare Produktmarker weiterhin absichtlich `RC1013` ist, bleibt er unverändert. Falls er bewusst auf `RC1017` migriert werden soll, müssen in **derselben Änderung** alle produktiven Contract-, Build-, Live-Check- und Demo-Marker konsistent aktualisiert werden. Nie nur eine HTML-Datei umbenennen.

- [ ] **Step 4: Syntax- und gezielte Tests ausführen**

Run:

```bash
node --check api/shared/merge.js
node --check api/shared/pickup-store.js
node --check api/pickup-init/index.js
node --check api/pickup-status/index.js
node --check api/pickup-confirm-v2/index.js
node --test test/rc1017-calendar-visuals.test.mjs
node --test test/rc1017-multi-truck-model.test.mjs
node --test test/rc1017-multi-truck-integration.test.mjs
node --test test/rc1017-subshipment-merge.test.mjs
node --test test/rc1017-subshipment-pickup.test.mjs
node --test test/rc1017-multi-truck-print-ui.test.mjs
node --test test/rc1017-three-env-release.test.mjs
```

Expected: alle PASS.

- [ ] **Step 5: Vollständige Regression**

Run:

```bash
npm test
git diff --check
```

Expected: 0 Failures, kein Whitespace-Fehler.

- [ ] **Step 6: Build der drei Umgebungen ausführen**

Den bereits im Repository vorhandenen RC1013-Drei-Umgebungen-Build exakt über dessen bestehenden npm/node-Aufruf ausführen. Anschließend in den erzeugten `dist-rc1013`-Artefakten prüfen:

```bash
grep -R "rc1017-multi-truck.js" dist-rc1013
grep -R "abholkalender.css" dist-rc1013
grep -R "abholkalender.js" dist-rc1013
```

Expected: Produktion, TESTSERVICE und Demo enthalten alle drei Assets.

- [ ] **Step 7: Funktionsabnahme mit repräsentativen Fällen**

Automatisierte/fixture-basierte Abnahme muss diese Fälle enthalten:

1. 1 LKW passt -> keine Teilsendungs-UI, bestehender QR/Ladelistenpfad unverändert.
2. 3 physische Colli bei Kapazität 2 -> zwei Teilsendungen 2+1.
3. `count=1` wird nie geteilt.
4. Summe Colli/Gewicht/LDM bleibt exakt erhalten.
5. Zwei Teilsendungen haben unterschiedliche Pickup-Tokens.
6. Pickup LKW 1 verändert LKW 2 nicht.
7. Hauptstatus erst `Abgeholt`, wenn alle Teilsendungen abgeholt sind.
8. Stale Client kann Pickup/POD/Lock nicht zurücksetzen.
9. Nach erster Pickup-Aktivität ist Neupartitionierung gesperrt.
10. Eigene Ladeliste enthält nur Colli des jeweiligen LKW und `Sendung X von Y`.
11. Kunden-Avis bleibt Hauptsendungsflow.
12. Kalender: Sendung blau + Kundenname, FIX grün.

- [ ] **Step 8: Commit finalen Releasevertrag**

```bash
git add .github/rc1013/build-three-env.mjs .github/workflows test/rc1017-three-env-release.test.mjs
git commit -m "RC1017: Drei-Umgebungen-Releasevertrag absichern"
```

- [ ] **Step 9: Review vor Merge**

Prüfe `git diff main...HEAD` auf:

- keine Raw Public Tokens im Team State,
- keine zweite ABD-/Avis-/Kundenlogik,
- keine Top-Level-Duplikate der Hauptsendung,
- keine neue Kapazitätsformel parallel zum vorhandenen Stauplan,
- keine Abschwächung RC1016-Avis-Schutz,
- keine direkte einseitige Produktionsänderung.

Erst nach diesem Review PR erstellen/aktualisieren, Checks abwarten, squash-merge und anschließend den vorhandenen Drei-Umgebungen-Deploy verifizieren.

---

## Plan Self-Review

### Spec coverage

- Hauptsendung + Teilsendungsmodell: Tasks 2–3.
- Ganze physische Mengen, Verlust-/Doppelzuordnungsschutz: Task 2.
- vorhandene Stauplanlogik als Kapazitätsquelle: Task 3.
- Neuberechnung vor Pickup und Sperre danach: Tasks 2–4.
- eigene QR-/Pickup-Kontexte: Tasks 5–6.
- eigener POD-/Pickup-Status und Hauptstatusaggregation: Task 6.
- eigene Ladelisten/Staupläne/QR je LKW: Task 7.
- eine Hauptsendung in Übersicht: Task 7.
- ABD/Avis/Dokumente bleiben Hauptsendung: Global Constraints + Review Task 8.
- stale Client/RC1016-Bestandsschutz: Task 4.
- Ein-LKW-Rückwärtskompatibilität: Tasks 2, 3, 5, 8.
- Kalender blau/grün + Kundenname: Task 1.
- Produktion/TESTSERVICE/Demo gleicher Stand: Task 8.

### Placeholder scan

Der Plan enthält keine `TBD`, `TODO`, `implement later` oder unbestimmte Testschritte. Die einzige bewusst dynamische Stelle ist der Adapter zur **bereits vorhandenen** Stauplanroutine; dort ist ausdrücklich vorgeschrieben, die existierende Berechnung unverändert wiederzuverwenden und keine zweite Formel einzuführen.

### Type consistency

Verwendete Schlüssel bleiben durchgängig: `subShipmentId`, `sequence`, `total`, `rows`, `totalColli`, `totalWeight`, `totalLdm`, `status`, `locked`, `pickupHistory`, `podFiles`, `requiredTruckCount`, `multiTruckLocked`.
