import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {compactStateForStorage}=require('../api/shared/state-compaction.js');
const packaging=require('../api/shared/packaging-admin-store.js');

function clone(v){return JSON.parse(JSON.stringify(v))}
function block(html,tag,id){
  const m=html.match(new RegExp('<'+tag+'[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</'+tag+'>'));
  return m?m[1]:'';
}

test('Speichern: Kompaktierung klont den Teamstand nur einmal und lässt die Eingabe unverändert',()=>{
  const customer={id:'C1',name:'Kunde'};
  const state={shipments:[{id:'S1',customer:clone(customer),customerData:clone(customer),rows:[{packageType:'Europalette'}]}],savedShipments:[{id:'S1',customer:clone(customer)}],abdRequests:[{id:'A1',rc313Docs:[{id:'D'}],rc312Docs:[{id:'D'}]}]};
  const before=clone(state);
  const out=compactStateForStorage(state);
  assert.deepEqual(state,before,'Eingangsdaten dürfen nicht mutiert werden');
  assert.notEqual(out.shipments[0],state.shipments[0]);
  assert.equal('customerData' in out.shipments[0],false);
  assert.equal('rc312Docs' in out.abdRequests[0],false);
  const source=fs.readFileSync('api/shared/state-compaction.js','utf8');
  const collection=source.slice(source.indexOf('function compactCollection('),source.indexOf('function compactStateForStorage('));
  assert.doesNotMatch(collection,/clone\(/,'Einträge der bereits kopierten Liste dürfen nicht erneut geklont werden');
  assert.match(source,/applyPackagingSnapshots\(out,\{owned:true\}\)/);
});

test('Speichern: applyPackagingSnapshots bleibt ohne owned-Option kopierend',()=>{
  const state={packagingTypes:[{id:'P1',name:'Europalette',active:true}],shipments:[{id:'S1',rows:[{packageType:'Europalette'}]}]};
  const before=clone(state);
  const copied=packaging.applyPackagingSnapshots(state);
  assert.deepEqual(state,before,'Standardaufruf darf die Eingabe nicht verändern');
  const owned=clone(state);
  const inPlace=packaging.applyPackagingSnapshots(owned,{owned:true});
  assert.equal(inPlace,owned,'mit owned:true wird die übergebene Kopie direkt angereichert');
  assert.deepEqual(inPlace,copied);
});

for(const file of ['index.html','TESTVERSION.html']){
  const html=fs.readFileSync(file,'utf8');

  test(`Ladezeit ${file}: Auto-Grow misst nur nach Änderungen mit Textarea-Bezug`,()=>{
    const js=block(html,'script','exporthub-rc973-autogrow-long-text');
    assert.match(js,/function holdsTextarea\(node\)/);
    const observer=js.slice(js.indexOf('new MutationObserver('));
    assert.match(observer,/holdsTextarea\(r\.addedNodes\[j\]\)/,'neue Knoten ohne Textarea dürfen keinen Scan auslösen');
    assert.match(observer,/r\.type==='attributes'&&holdsTextarea\(r\.target\)/,'Attributänderungen ohne Textarea dürfen keinen Scan auslösen');
  });

  test(`Ladezeit ${file}: Dashboard sucht Sendungen je Durchlauf über einen Index`,()=>{
    const start=html.indexOf('function dashboardTaskIsTestRC818(t){');
    const fn=html.slice(start,html.indexOf('\n',start));
    assert.match(fn,/dashboardShipmentLookupRC818\(\)/);
    assert.doesNotMatch(fn,/\.find\(/,'keine lineare Suche über alle Sendungen je Aufgabe');
    assert.match(html,/Promise\.resolve\(\)\.then\(function\(\)\{dashboardShipmentIndexRC818=null\}\)/,'Index gilt nur für den laufenden Durchlauf');
  });

  test(`Ladezeit ${file}: Aufgaben-Master merkt sich normalisierte Werte nur innerhalb von ensureWeek`,()=>{
    assert.match(html,/rc874FactsMemo=new Map\(\);\n try\{MASTER\.forEach/);
    assert.match(html,/\}\)\}finally\{rc874FactsMemo=null\}/);
    assert.match(html,/function attach\(t,m,w,weekStart\)\{\n if\(rc874FactsMemo\)rc874FactsMemo\.delete\(t\);/,'geänderte Aufgaben müssen neu bewertet werden');
  });

  test(`Ladezeit ${file}: Mail-Status wählt die beste Sendung ohne Sortierung aller Sendungen`,()=>{
    const start=html.indexOf('function currentShipment(){var st=states()[0]');
    const fn=html.slice(start,html.indexOf('\n',start));
    assert.ok(start>=0,'currentShipment fehlt');
    assert.doesNotMatch(fn,/candidates\.sort\(/);
    assert.match(fn,/if\(n>bestScore\)\{best=sh;bestScore=n\}/,'bei Gleichstand gewinnt die erste Sendung wie bei der stabilen Sortierung');
  });
}
