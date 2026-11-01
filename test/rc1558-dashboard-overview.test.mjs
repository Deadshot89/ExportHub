import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8');
const css=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8');
const i18n=fs.readFileSync('assets/i18n/rc1558-dashboard-overview.js','utf8');

function load(lang='de'){
  const win={document:undefined};
  win.ExportHUBI18n={language:()=>lang,t:key=>key};
  const ctx=vm.createContext({window:win,globalThis:win,console});
  vm.runInContext(i18n,ctx);
  vm.runInContext(runtime,ctx);
  return win;
}

const NOW=new Date(2026,9,17,9,0);
function at(h,m=0,dayOffset=0){return new Date(2026,9,17+dayOffset,h,m).toISOString()}
function fakeApi(shipments,tasks){
  const done=s=>/erledigt|abgeschlossen|archiviert|storniert/i.test(s.status||'');
  return{
    shipmentOpenList:()=>shipments.filter(s=>!done(s)),
    taskOpenList:()=>tasks,
    dueTask:t=>!!t.dueAt&&new Date(t.dueAt)<=new Date(2026,9,17,23,59),
    shipmentNeedsDocuments:s=>/wartet auf abd/i.test(s.status)||!(s.documents||[]).some(d=>/lieferschein/i.test(d.type||'')),
    shipmentNeedsPickup:s=>/bereit|erstellt|wartet auf abd/i.test(s.status),
    shipmentNeedsPod:s=>/abgeholt/i.test(s.status)&&!/pod vorhanden/i.test(s.status)
  };
}
const LS=[{type:'Lieferschein'}];
const shipments=[
  {id:'S3',ref:'C3',customerName:'Kunde C',destinationCountry:'no',status:'Wartet auf ABD',plannedPickupDate:at(13),rows:[{count:2},{qty:3}],documents:LS},
  {id:'S1',ref:'A1',customerName:'Kunde A',destinationCountry:'DE',status:'Bereit zur Abholung',plannedPickupDate:at(8),rows:[{count:4}],documents:LS},
  {id:'S2',ref:'B2',customerName:'Kunde B',status:'Abgeholt',plannedPickupDate:at(10),rows:[],documents:[]},
  {id:'S4',ref:'D4',customerName:'Kunde D',status:'Storniert',plannedPickupDate:at(11),documents:LS},
  {id:'S5',ref:'E5',customerName:'Kunde E',status:'Erstellt',plannedPickupDate:at(9,0,1),documents:LS}
];
const tasks=[
  {title:'Später',dueAt:at(9,0,3)},
  {title:'Überfällig',dueAt:at(9,0,-1)},
  {title:'Heute',dueAt:at(15)},
  {title:'Ohne Datum'}
];

test('RC1558 Build bindet CSS, I18n und Runtime idempotent nach RC1371 und vor RC1306 ein',()=>{
  assert.match(build,/const RC1558_OVERVIEW_STYLE_TAG='<link id="exporthub-rc1558-overview-style"[^']*rc1558-dashboard-overview\.css\?v=1666/);
  assert.match(build,/const RC1558_OVERVIEW_I18N_TAG='<script id="exporthub-rc1558-overview-i18n"[^']*i18n\/rc1558-dashboard-overview\.js\?v=1725/);
  assert.match(build,/const RC1558_OVERVIEW_SCRIPT_TAG='<script id="exporthub-rc1558-overview-script"[^']*rc1558-dashboard-overview\.js\?v=1667/);
  assert.match(build,/function patchRc1558DashboardOverview\(html,file\)/);
  const a=build.indexOf('html=patchRc1371Dashboard(html,file);');
  const b=build.indexOf('html=patchRc1558DashboardOverview(html,file);');
  const c=build.indexOf('html=patchRc1306LayoutEngine(html,file);');
  assert.ok(a>=0&&b>a&&c>b,'RC1558 muss zwischen RC1371 und RC1306 gepatcht werden');
  assert.match(build,/'assets\/rc1558-dashboard-overview\.css'/);
  assert.match(build,/'assets\/rc1558-dashboard-overview\.js'/);
});

test('RC1558 nutzt die kanonischen RC885-Prädikate statt eigener KPI-Berechnung',()=>{
  assert.match(build,/RC1558_WORKSPACE_MARKER='window\.__EXPORTHUB_RC885_CLEAN_WORKSPACE__ = true;'/);
  for(const fn of ['shipmentOpenList','taskOpenList','dueTask','shipmentNeedsDocuments','shipmentNeedsPickup','shipmentNeedsPod','routeTo'])
    assert.match(build,new RegExp(fn+':'+fn+'[,}]'),fn+' fehlt im RC885-Export');
  assert.match(build,/RC885-Workspace-Anker '\+count\+'x statt genau 1x/);
  const index=fs.readFileSync('index.html','utf8'),testservice=fs.readFileSync('TESTVERSION.html','utf8');
  assert.equal(index.split('window.__EXPORTHUB_RC885_CLEAN_WORKSPACE__ = true;').length-1,1);
  assert.equal(testservice.split('window.__EXPORTHUB_RC885_CLEAN_WORKSPACE__ = true;').length-1,1);
  assert.match(runtime,/w\.ExportHUBWorkspace885/);
  assert.doesNotMatch(runtime,/function shipmentNeedsDocuments|function shipmentNeedsPod/);
});

test('RC1558 Kennzahlen zählen heutige Abholungen, ABD-Sperren, Dokumente, POD und fällige Aufgaben',()=>{
  const w=load();
  const model=w.ExportHUBDashboardOverview1558.buildModel(fakeApi(shipments,tasks),shipments,NOW);
  const k=Object.fromEntries(model.kpis.map(x=>[x.id,x]));
  assert.equal(k.today.value,3,'stornierte und morgige Abholungen zählen nicht');
  assert.equal(k.today.sub,'1 erledigt · 2 offen');
  assert.equal(k.open.value,3,'abgeholte Sendungen zaehlen nicht als offen');
  assert.equal(k.abd.value,1);assert.equal(k.abd.tone,'crit');
  assert.equal(k.documents.value,2);assert.equal(k.documents.tone,'warn');
  assert.equal(k.pod.value,1);assert.equal(k.pod.tone,'warn');
  assert.equal(k.tasks.value,2);assert.equal(k.tasks.sub,'1 überfällig');
  assert.equal(k.tasks.route,'tasks');
});

test('RC1666 Dashboard zeigt AV fehlt mit historischen, offenen Aufgaben und Drill-Down',()=>{
  const w=load('de'),api=w.ExportHUBDashboardOverview1558;
  const historical={id:'task:av-missing:HIST01',sourceType:'av_missing',linkedShipmentRef:'HIST01',title:'Ausgangsvermerk nicht vorhanden · HIST01',status:'offen',dueDate:'2026-10-15'};
  const done={id:'task:av-missing:OLD001',sourceType:'av_missing',status:'erledigt',done:true};
  const other={id:'task:normal',sourceType:'manual',title:'Normal',dueAt:at(12)};
  const openTasks=[historical,other];
  w.__EXPORTHUB_GET_STATE__=()=>({tasks:[historical,done,other]});
  const model=api.buildModel(fakeApi(shipments,openTasks),shipments,NOW);
  const kpi=model.kpis.find(k=>k.id==='avMissing');
  assert.equal(kpi.value,1);
  assert.equal(kpi.route,'tasks');
  assert.equal(kpi.tone,'warn');
  assert.deepEqual(Array.from(model.sets.avMissing,t=>t.id),[historical.id]);
  const html=api.renderHtml(model);
  assert.match(html,/AV fehlt/);
  assert.match(html,/data-rc1558-kpi="avMissing"/);
  assert.match(html,/Ausgangsvermerke nachreichen/);
  assert.ok(!model.sets.avMissing.includes(done),'abgeschlossene AV-Aufgaben dürfen nicht gezählt werden');
});

test('RC1558 Tagestabelle ist nach Uhrzeit sortiert und zeigt Colli, Land, Lieferschein und Status-Ton',()=>{
  const w=load();
  const model=w.ExportHUBDashboardOverview1558.buildModel(fakeApi(shipments,tasks),shipments,NOW);
  assert.deepEqual(Array.from(model.today,r=>r.ref),['A1','B2','C3']);
  const c3=model.today[2];
  assert.equal(c3.colli,5);assert.equal(c3.country,'NO');assert.equal(c3.abd,true);assert.equal(c3.tone,'crit');
  assert.equal(model.today[0].tone,'info');assert.equal(model.today[1].tone,'ok');
  assert.equal(model.today[1].deliveryNote,false);
});

test('RC1558 Hinweise sind nach Dringlichkeit sortiert und je Sendung nur einmal gelistet',()=>{
  const w=load();
  const model=w.ExportHUBDashboardOverview1558.buildModel(fakeApi(shipments,tasks),shipments,NOW);
  assert.deepEqual(Array.from(model.attention,a=>a.ref+':'+a.tone),['C3:crit','B2:warn']);
  assert.equal(model.attentionTotal,2);
});

test('RC1558 Aufgaben sind nach Fälligkeit sortiert; ohne Datum zuletzt',()=>{
  const w=load();
  const model=w.ExportHUBDashboardOverview1558.buildModel(fakeApi(shipments,tasks),shipments,NOW);
  assert.deepEqual(Array.from(model.tasks,t=>t.title),['Überfällig','Heute','Später','Ohne Datum']);
  assert.equal(model.tasks[0].late,true);assert.equal(model.tasks[1].today,true);
});

test('RC1558 rendert Status nicht in <tr>/<td>, damit der RC913-Statussync die Markierung nicht überschreibt',()=>{
  const w=load();
  const api=w.ExportHUBDashboardOverview1558;
  const html=api.renderHtml(api.buildModel(fakeApi(shipments,tasks),shipments,NOW));
  assert.doesNotMatch(html,/<t[rdh][\s>]|<table/);
  assert.match(html,/role="table"/);
  assert.match(html,/class="rc1558-pill" data-tone="crit">Wartet auf ABD</);
  assert.doesNotMatch(html,/class="[^"]*\b(card|metric|kpi-card|dashboard-card)\b/,'RC1371 darf die Übersicht nicht als eigene Kachel umsortieren');
  assert.match(html,/data-rc1558-route="tasks"/);
  assert.match(html,/data-rc1558-shipment="S3"/);
});

test('RC1558 maskiert Kundendaten im HTML',()=>{
  const w=load();
  const api=w.ExportHUBDashboardOverview1558;
  const evil=[{id:'X',ref:'<b>R</b>',customerName:'"><img src=x onerror=alert(1)>',status:'Erstellt',plannedPickupDate:at(12),documents:LS}];
  const html=api.renderHtml(api.buildModel(fakeApi(evil,[]),evil,NOW));
  assert.doesNotMatch(html,/<img|<b>R/);
  assert.match(html,/&lt;b&gt;R&lt;\/b&gt;/);
});

test('RC1558 Sprachpakete decken alle sechs Sprachen mit identischen Schlüsseln ab',()=>{
  const w=load();
  const {supported,packs}=w.ExportHUBDashboardOverview1558I18n;
  assert.deepEqual(Array.from(supported),['de','en','pl','es','fr','it']);
  const keys=Object.keys(packs.de).sort();
  for(const lang of supported){
    assert.deepEqual(Object.keys(packs[lang]).sort(),keys,lang+' hat abweichende Schlüssel');
    for(const key of keys)assert.ok(packs[lang][key]&&packs[lang][key].trim(),lang+': '+key+' ist leer');
  }
  for(const key of runtime.match(/'dashboard\.overview\.[a-zA-Z.]+'/g).map(s=>s.slice(1,-1)).filter(k=>!k.endsWith('.')))
    assert.ok(keys.includes(key),'Runtime-Schlüssel fehlt in de: '+key);
  for(const id of ['today','open','abd','avMissing','documents','pod','tasks'])assert.ok(keys.includes('dashboard.overview.kpi.'+id));
});

test('RC1558 Englisch übersetzt Kennzahlen und kanonische Status',()=>{
  const w=load('en');
  const api=w.ExportHUBDashboardOverview1558;
  const html=api.renderHtml(api.buildModel(fakeApi(shipments,tasks),shipments,NOW));
  assert.match(html,/Pickups today/);
  assert.match(html,/>Awaiting export declaration</);
  assert.match(html,/>Ready for pickup</);
  assert.doesNotMatch(html,/Abholungen heute/);
});

test('RC1558 Kopfzeile begrüßt nach Tageszeit, zeigt Kalenderwoche und Stand; Nullwerte sind ruhig',()=>{
  const w=load();
  const api=w.ExportHUBDashboardOverview1558;
  const model=api.buildModel(fakeApi(shipments,tasks),shipments,NOW);
  const morning=api.renderHtml(model,{now:new Date(2026,9,17,8,5),userName:'Tobias Muster'});
  assert.match(morning,/Guten Morgen, Tobias</);
  assert.match(morning,/KW 42/);
  assert.match(morning,/Stand 08:05/);
  assert.match(api.renderHtml(model,{now:new Date(2026,9,17,19,0),userName:''}),/>Guten Abend</,'ohne Namen kein hängendes Komma');
  assert.equal(api.isoWeek(new Date(2026,0,1)),1);
  assert.equal(api.isoWeek(new Date(2027,0,1)),53);
  assert.equal((morning.match(/<svg class="rc1558-icon"/g)||[]).length,7,'ein Symbol pro Kennzahl');
  const empty=api.renderHtml(api.buildModel(fakeApi([],[]),[],NOW),{now:NOW,userName:'A'});
  assert.equal((empty.match(/data-zero="1"/g)||[]).length,7);
  assert.match(empty,/rc1558-empty-icon/);
  assert.doesNotMatch(api.renderHtml(model),/rc1558-hello/,'ohne Meta keine Kopfzeile');
});

test('RC1558 Kopfband umschließt Begrüßung und Kennzahlen; Kopfzeile ohne <p>, Farben aus dem Design',()=>{
  const w=load();
  const api=w.ExportHUBDashboardOverview1558;
  const html=api.renderHtml(api.buildModel(fakeApi(shipments,tasks),shipments,NOW),{now:NOW,userName:'A'});
  assert.match(html,/^<div class="rc1558-top"><div class="rc1558-hello">[\s\S]*<div class="rc1558-kpis">[\s\S]*?<\/div><\/div><div class="rc1558-grid">/);
  const head=html.slice(0,html.indexOf('<div class="rc1558-kpis">'));
  assert.doesNotMatch(head,/<p[\s>]/,'Design-Schicht färbt jedes <p> mit !important grau');
  assert.match(css,/\.rc1558-top\{[\s\S]*?color-mix\(in srgb,var\(--rc1558-primary\)/);
  assert.match(css,/\.rc1558-top \.rc1558-kpi:focus-visible\{outline:3px solid #fff/);
});

test('RC1558 CSS blendet Arbeitsfokus und Heute-Kachel ab dem ersten Bild aus (Rückfall nur ohne Übersicht) und nutzt Design-Variablen',()=>{
  assert.match(css,/html body:not\(\[data-rc1558-fallback="1"\]\) #rc885Workspace/);
  assert.match(css,/html body:not\(\[data-rc1558-fallback="1"\]\) #content \.rc205-dashboard-grid > \[data-dashboard-widget="todayShipments"\]/);
  assert.match(runtime,/FALLBACK_FLAG='data-rc1558-fallback'/);
  assert.match(css,/var\(--pc-primary/);
  assert.match(css,/var\(--pc-danger/);
  assert.doesNotMatch(css,/transition:\s*all/);
  assert.match(css,/@media \(max-width:640px\)/);
});

test('RC1563 Übersicht wird synchron im MutationObserver eingehängt, nicht erst im nächsten Frame',()=>{
  // RC1574: the same synchronous callback also tidies up when the dashboard was left
  assert.match(runtime,/var mountIfMissing=function\(\)\{if\(leftDashboard\(\)\|\|\(!d\.getElementById\(SECTION_ID\)&&isDashboard\(\)&&hostRoot\(\)\)\)refreshNow\(\)\}/);
  assert.match(runtime,/new w\.MutationObserver\(mountIfMissing\)\.observe\(content,\{childList:true\}\)/);
  assert.match(runtime,/new w\.MutationObserver\(mountIfMissing\)\.observe\(d\.body,\{attributes:true,attributeFilter:\['data-exporthub-view','data-current-view'\]\}\)/);
});

test('RC1563 ein Bearbeiten-Button im Kopfband, RC205-Zeile nur im Bearbeiten-Modus, keine doppelte Backup-Karte',()=>{
  assert.match(css,/body\[data-exporthub-view="dashboard"\] #rc97DashboardPanelMount\{display:none!important\}/);
  assert.match(css,/html body\[data-rc1558-overview="1"\] #content:not\(\[data-rc1371-editing="1"\]\) > \.page-head/);
  assert.match(css,/#content:not\(\[data-rc1371-editing="1"\]\) > \.rc1371-dashboard-toolbar\{position:absolute!important;top:12px;right:14px/);
  // RC1573: the dashboard has its own "Dashboard bearbeiten" (tile panel); it replaces the RC1371 toolbar there
  assert.match(runtime,/data-rc1573-edit="1"/,'eigener Bearbeiten-Button im Kopfband');
  assert.doesNotMatch(runtime,/rc1558-customize/);
});

test('RC1563 Listen scrollen im Panel; Tabelle füllt die Höhe der rechten Spalte; Stufe für niedrige Bildschirme',()=>{
  assert.match(css,/\.rc1558-today \.rc1558-tablewrap\{flex:1 1 0;min-height:120px;overflow:auto/);
  assert.match(css,/\.rc1558-today \.rc1558-thead\{position:sticky;top:0/);
  assert.match(css,/\.rc1558-stack \.rc1558-list\{max-height:168px;overflow-y:auto/);
  assert.match(css,/@media \(min-width:1251px\) and \(max-height:960px\)/);
});

test('RC1565 Dashboard scrollt auch mit langen ABD- und Palettenlisten nicht',()=>{
  assert.match(css,/body\[data-rc1558-overview="1"\] #content \.rc205-dashboard-grid \.rc205-widget > \.rc205-list\{display:none!important\}/);
  assert.match(css,/\.rc1558-stack \.rc1558-list\{overflow-x:hidden\}/);
});
