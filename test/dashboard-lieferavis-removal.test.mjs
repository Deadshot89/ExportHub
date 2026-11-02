import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8');

function removeFn(view='dashboard'){
  const win={document:undefined,ExportHUBI18n:{language:()=> 'de',t:key=>key}};
  const ctx=vm.createContext({window:win,globalThis:win,console});
  vm.runInContext(runtime.replace('function refresh(){','w.__testRemoveDashboardLieferavis=removeDashboardLieferavis;\\nfunction refresh(){'.replace('\\n','\n')),ctx);
  win.document={body:{getAttribute:name=>name==='data-exporthub-view'?view:''}};
  return win.__testRemoveDashboardLieferavis;
}

function node(text,attributes={}){
  return{
    textContent:text,parentNode:{},removed:false,
    getAttribute:key=>attributes[key]||'',
    closest:()=>null,
    remove(){this.removed=true;this.parentNode=null}
  };
}
function root(cards,shortcuts){
  return{querySelectorAll:selector=>selector.includes('data-dashboard-widget]')?cards:shortcuts};
}

test('Dashboard entfernt Lieferavis-Kachel und Schnellzugriff, lässt andere Funktionen stehen',()=>{
  const avisCard=node('Lieferavis',{'data-dashboard-widget':'customeravis'});
  const shipmentCard=node('Offene Sendungen',{'data-dashboard-widget':'open'});
  const avisLink=node('Lieferavis öffnen');
  const taskLink=node('Aufgaben');
  const count=removeFn()(root([avisCard,shipmentCard],[avisLink,taskLink]));
  assert.equal(count,2);
  assert.equal(avisCard.removed,true);
  assert.equal(avisLink.removed,true);
  assert.equal(shipmentCard.removed,false);
  assert.equal(taskLink.removed,false);
});

test('Dashboard blendet weder Ausgangsvermerke noch operative Aufgaben aus',()=>{
  const avTask=node('AV fehlt');
  const task=node('Lieferavis: Kunde anrufen');
  assert.equal(removeFn()(root([], [avTask,task])),0);
  assert.equal(avTask.removed,false);
  assert.equal(task.removed,false);
});

test('Lieferavis bleibt in Sendungsansicht unverändert verfügbar',()=>{
  const avis=node('Lieferavis öffnen');
  assert.equal(removeFn('shipment')(root([], [avis])),0);
  assert.equal(avis.removed,false);
});

test('Lieferavis-Entfernung erfolgt bei Dashboard-Refresh und Nachrendern',()=>{
  assert.match(runtime,/bindTiles\(root\);\s*removeDashboardLieferavis\(root\)/);
  assert.match(runtime,/mountIfMissing\(\);if\(isDashboard\(\)\)removeDashboardLieferavis\(hostRoot\(\)\)/);
});
