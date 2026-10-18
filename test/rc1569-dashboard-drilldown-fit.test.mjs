import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8').replace(/\r\n/g,'\n');
const css=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8').replace(/\r\n/g,'\n');
const i18n=fs.readFileSync('assets/i18n/rc1558-dashboard-overview.js','utf8');
const rc1371i18n=fs.readFileSync('assets/i18n/rc1371-dashboard-personalization.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8').replace(/\r\n/g,'\n');

function loadOverview(){
  const window={addEventListener(){},setInterval(){},setTimeout(){},requestAnimationFrame(){},document:null};
  vm.runInNewContext(runtime,{window,Date,Intl,console});
  return window.ExportHUBDashboardOverview1558;
}
function packs(src,root){const r={};vm.runInNewContext(src,{[root]:r,window:r,globalThis:r});return r}

test('RC1569 jede Kachel liefert genau die Datensätze, die sie zählt',()=>{
  const api={
    shipmentOpenList:()=>[{id:'S1',status:'Wartet auf ABD'},{id:'S2',status:'Bereit zur Abholung'},{id:'S3',status:'Abgeholt',podFiles:[]}],
    taskOpenList:()=>[{id:'T1',dueDate:'2026-10-17'},{id:'T2',dueDate:'2026-10-30'}],
    dueTask:t=>t.dueDate<='2026-10-18',
    shipmentNeedsDocuments:s=>s.id==='S2',
    shipmentNeedsPod:s=>s.id==='S3'
  };
  const model=loadOverview().buildModel(api,[{id:'S2',status:'Bereit zur Abholung',plannedPickupDate:'2026-10-18T14:00:00'}],new Date('2026-10-18T10:00:00'));
  const ids=k=>model.sets[k].map(x=>x.id);
  assert.deepEqual(ids('abd'),['S1']);
  assert.deepEqual(ids('documents'),['S2']);
  assert.deepEqual(ids('pod'),['S3']);
  assert.deepEqual(ids('open'),['S1','S2','S3']);
  assert.deepEqual(ids('today'),['S2']);
  assert.deepEqual(ids('tasks'),['T1']);
  for(const k of model.kpis)assert.equal(model.sets[k.id].length,k.value,k.id+': Kachelwert und Filtermenge gleich');
});

test('RC1569 Kachel-Klick öffnet die Funktion mit Filter, Filter wird live angewendet und wieder entfernt',()=>{
  assert.match(runtime,/var k=target\.closest\('\[data-rc1558-kpi\]'\);if\(k\)\{e\.preventDefault\(\);startDrill\(k\.getAttribute\('data-rc1558-kpi'\),k\.getAttribute\('data-rc1558-route'\)\);return\}/);
  assert.match(runtime,/if\(view!==drill\.view\)\{if\(drill\.seen\)clearDrill\(\);return\}/,'Bereichswechsel hebt den Filter auf');
  assert.match(runtime,/w\.toggleTaskCard\(\{preventDefault:function\(\)\{\},stopPropagation:function\(\)\{\}\},id\)/,'Erledigt nutzt den normalen Aufgabenweg');
  assert.match(runtime,/if\(drill&&drill\.cache&&now-drill\.cache\.at<400\)return drill\.cache\.records;/,'Filtermenge höchstens alle 400 ms neu berechnet');
  assert.match(css,/body\[data-rc1569-drill="shipments"\] #content \[data-rc1569-out="1"\]\{display:none!important\}/);
  assert.match(css,/body\[data-rc1569-drill="tasks"\] #content > :not\(#rc1569Drill\):not\(\.page-head\)\{display:none!important\}/);
});

test('RC1569 Dashboard bleibt auf einer Seite: Höhe aus freiem Bildschirm, Übersicht nimmt den Rest',()=>{
  assert.match(runtime,/h=Math\.floor\(w\.innerHeight-\(c\.getBoundingClientRect\(\)\.top\+\(w\.scrollY\|\|w\.pageYOffset\|\|0\)\)-16\);if\(h<460\)on=false/);
  assert.match(runtime,/c\.getAttribute\('data-rc1371-editing'\)!=='1'&&w\.innerWidth>=1024/,'nicht im Bearbeiten-Modus und nicht auf dem Handy');
  assert.match(css,/#content:not\(\[data-rc1371-editing="1"\]\)\{\n\s*display:grid!important;grid-template-columns:repeat\(12,minmax\(0,1fr\)\)!important;grid-template-rows:minmax\(0,1fr\)!important;/);
  assert.match(css,/height:var\(--rc1569-fit-h\)!important;max-height:var\(--rc1569-fit-h\)!important/);
  assert.match(css,/> #rc1558Overview#rc1558Overview\{grid-row:1!important;align-self:stretch!important;height:auto!important;min-height:300px!important;display:flex!important/);
});

test('RC1569 Filter-Texte und Schnellzugriff-Namen in allen sechs Sprachen',()=>{
  const overview=packs(i18n,'ExportHUBDashboardOverview1558I18n').ExportHUBDashboardOverview1558I18n;
  const quick=packs(rc1371i18n,'ExportHUBDashboard1371I18n').ExportHUBDashboard1371I18n;
  const drillKeys=['filter','shipments','shipment','tasks','task','clear','emptyShipments','emptyTasks','done','open','overdue','due','noDue'].map(k=>'dashboard.overview.drill.'+k);
  for(const lang of ['de','en','pl','es','fr','it']){
    for(const key of drillKeys)assert.notEqual(overview.t(key,null,lang),key,lang+': '+key);
    for(const key of ['nav.shipment','nav.shipmentoverview','nav.notifications','nav.sop','nav.abd'])assert.notEqual(quick.t(key,null,lang),key,lang+': '+key);
  }
});

test('RC1569 Build: Dashboard-Aufgaben erkennen Zuweisung per Benutzer-ID und dueAt',()=>{
  const start=build.indexOf('\nfunction patchWorkspaceTaskOwnership(');
  const patch=new Function('return '+build.slice(start+1,build.indexOf('\n}\n',start)+2))();
  const sample="function workspaceTaskForUser(t){var own=low(workspaceTaskOwner(t)),u=1}\nfunction workspaceTaskDate(t){var keys=['dueDate','due','date','plannedDate','targetDate','deadline'];return 1}";
  const out=patch(sample,'demo.html');
  assert.match(out,/function workspaceTaskForUserId\(t\)/);
  assert.match(out,/function workspaceTaskForUser\(t\)\{if\(workspaceTaskForUserId\(t\)\)return true;var own=/);
  assert.match(out,/\['dueDate','dueAt','due','date','plannedDate','plannedAt','targetDate','deadline'\]/);
  assert.match(build,/html=patchNotificationTaskDetails\(html,file\);\n\s*html=patchWorkspaceTaskOwnership\(html,file\);/);
  assert.throws(()=>patch('kein dashboard','x.html'),/RC1569 workspaceTaskForUser 0x gefunden/);
});
