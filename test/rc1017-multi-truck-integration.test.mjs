import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('.github/rc1016/build-three-env.mjs','utf8');

function count(haystack,needle){return haystack.split(needle).length-1;}
function functionSlice(name,max=30000){
  const start=html.indexOf('function '+name+'(');
  assert.notEqual(start,-1,name+' fehlt');
  return html.slice(start,start+max);
}

test('RC1017: Mehr-LKW-Modell wird vom aktuellen Drei-Umgebungen-Build ausgeliefert',()=>{
  assert.match(build,/rc1017-multi-truck\.js/);
});

test('RC1017: Browserintegration nutzt ausschließlich den bestehenden buildStowPlan als Kapazitätsquelle',()=>{
  assert.match(html,/function\s+rc1017FitRows\s*\(/);
  assert.match(html,/rc1017FitRows[\s\S]{0,2500}buildStowPlan\s*\(/);
  assert.match(html,/rc1017FitRows[\s\S]{0,2500}overflowCm/);
  assert.equal(count(html,'function rc1017FitRows('),1);
});

test('RC1017: Teilsendungen werden am finalen Saved-Objekt vor dem State-Write synchronisiert und validiert',()=>{
  assert.match(html,/function\s+rc1017SyncSubShipments\s*\(/);
  assert.match(html,/requiredTruckCount/);
  assert.match(html,/subShipments/);
  assert.match(html,/multiTruckLocked/);
  assert.match(html,/validatePartition/);
  const persist=functionSlice('persistShipment');
  assert.match(persist,/rc1017SyncSubShipments\(saved\)/);
  assert.match(persist,/rc1017SyncSubShipments\(saved\)[\s\S]{0,2500}s\.shipments/);
});

test('RC1017: operative Teilsendungsaktivität sperrt automatische Neuverteilung',()=>{
  assert.match(html,/function\s+rc1017SubShipmentLocked\s*\(/);
  assert.match(html,/pickupHistory/);
  assert.match(html,/podFiles/);
  assert.match(html,/Die LKW-Aufteilung ist bereits in Verwendung/);
});

test('RC1017: Mehr-LKW-Zusammenfassung ist an den bestehenden Stauplanbereich angebunden',()=>{
  assert.match(html,/function\s+renderRc1017SubShipments\s*\(/);
  assert.match(html,/Sendung ['"+]?\+?[^\n]{0,120} von /);
  assert.match(html,/rc380StowPlan|rc363BlockStow/);
});
