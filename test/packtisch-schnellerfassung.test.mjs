import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');

test('Packtisch: Schritte, Stepper, Kamera und Maße übernehmen sind auf beiden Packseiten vorhanden',()=>{
  for(const file of ['pack.html','assets/pack.html']){
    const html=read(file);
    assert.match(html,/id="packProgress"/,file);
    for(const step of ['shipment','dimensions','documents'])assert.match(html,new RegExp(`data-pack-step="${step}"`),file+': '+step);
    assert.match(html,/id="packCountMinus"/,file);assert.match(html,/id="packCountPlus"/,file);
    assert.match(html,/id="packCopyDimensions"[^>]*hidden/,file);
    assert.match(html,/id="packCamera"[^>]*accept="image\/\*"[^>]*capture="environment"/,file);
    assert.match(html,/id="packNextShipment"/,file);
    assert.match(html,/pack-notification\.css\?v=2/,file);
  }
});

test('Packtisch: [hidden] gewinnt gegen display-Regeln (Hinweis „Kunde nicht gefunden“ war sonst immer sichtbar)',()=>{
  const css=read('assets/pack-notification.css');
  assert.match(css,/\.pack-customer-manual\{display:flex/);
  assert.match(css,/\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.pack-card\{overflow:clip\}/,'overflow:hidden würde die feste Aktionsleiste (sticky) aushebeln');
  assert.match(css,/\.pack-actions\{position:sticky;bottom:0/);
  assert.match(css,/max-width:640px\)\{input,select,textarea\{font-size:16px/,'iOS zoomt sonst bei jedem Feld');
});

test('Packtisch: offene Pflichtangaben werden benannt, Kamera und Dateiauswahl teilen den Upload',()=>{
  const js=read('assets/pack-notification.js');
  assert.match(js,/function missingSteps\(\)/);
  assert.match(js,/tr\('pack\.missing',\{items:missing\.items\.join\(' · '\)\}\)/);
  assert.match(js,/els\.files\.addEventListener\('change',\(\)=>addFiles\(els\.files\)\)/);
  assert.match(js,/els\.camera\.addEventListener\('change',\(\)=>addFiles\(els\.camera\)\)/);
  assert.match(js,/els\.next\.addEventListener\('click',openNewShipment\)/);
});

test('Packtisch: neue Texte gibt es in allen sechs Sprachen',()=>{
  const win={};const ctx=vm.createContext({window:win,globalThis:win});
  vm.runInContext(read('assets/i18n/pack-notification.js'),ctx);
  const packs=win.ExportHUBPackI18n.packs;
  const keys=['pack.countDecrease','pack.countIncrease','pack.copyDimensions','pack.takePhoto','pack.takePhotoHint','pack.nextShipment','pack.missing','pack.missing.customerConfirm','pack.missing.packageType','pack.missing.weight','pack.draft.openCount'];
  for(const lang of ['de','en','pl','es','fr','it'])for(const key of keys)assert.ok(packs[lang][key],lang+': '+key);
  for(const lang of ['de','en','pl','es','fr','it'])assert.match(packs[lang]['pack.missing'],/\{\{items\}\}/,lang);
});

test('Menü: Packmeldungen steht direkt unter dem Dashboard und wird als Hauptpunkt gezeichnet',()=>{
  const js=read('assets/rc1579-menu-redesign.js'),css=read('assets/rc1579-menu-redesign.css');
  assert.match(js,/\{key:'start',flat:true,accent:'#2563eb',views:\['dashboard','packnotifications','notifications'\]\}/);
  assert.doesNotMatch(js,/'pickupcalendar','packnotifications'\]/);
  assert.match(css,/:not\(\[data-view="notifications"\]\):not\(\[data-view="packnotifications"\]\)\{margin-left:14px/);
});

test('Dashboard: Kachel „Vom Packtisch“ zählt neue und geprüfte Packmeldungen und öffnet den Eingang',()=>{
  const win={document:undefined};
  win.ExportHUBI18n={language:()=>'de',t:key=>key};
  win.ExportHUBPackNotificationNav={};
  win.__EXPORTHUB_GET_STATE__=()=>({packNotifications:[{id:'a',status:'new'},{id:'b',status:'new'},{id:'c',status:'in_review'},{id:'d',status:'shipment_created'},{id:'e',status:'cancelled'}]});
  const ctx=vm.createContext({window:win,globalThis:win,console});
  vm.runInContext(read('assets/i18n/rc1558-dashboard-overview.js'),ctx);
  vm.runInContext(read('assets/rc1558-dashboard-overview.js'),ctx);
  const api={shipmentOpenList:()=>[],taskOpenList:()=>[],dueTask:()=>false,shipmentNeedsDocuments:()=>false,shipmentNeedsPod:()=>false};
  const model=win.ExportHUBDashboardOverview1558.buildModel(api,[],new Date(2026,9,23,9,0));
  const pack=model.kpis[0];
  assert.equal(pack.id,'pack');assert.equal(pack.value,3);assert.equal(pack.tone,'warn');assert.equal(pack.route,'packnotifications');
  assert.equal(model.kpis.length,7);
  const html=win.ExportHUBDashboardOverview1558.renderHtml(model,null);
  assert.match(html,/data-rc1558-route="packnotifications">/,'kein Drill-down, die Kachel öffnet den Eingang');
  delete win.ExportHUBPackNotificationNav;
  assert.equal(win.ExportHUBDashboardOverview1558.buildModel(api,[],new Date()).kpis.length,6,'ohne Pack-Runtime bleibt es bei sechs Kacheln');
  assert.match(read('assets/rc1558-dashboard-overview.css'),/\.rc1558-kpis:has\(>\.rc1558-kpi:nth-child\(7\)\)\{grid-template-columns:repeat\(7,minmax\(0,1fr\)\)\}/);
});

test('Eingang: Neue und geprüfte Packmeldungen stehen oben, Admins können den Packtisch direkt öffnen',()=>{
  const internal=read('assets/pack-notification-internal.js'),admin=read('assets/pack-station-admin.js');
  assert.match(internal,/sort\(\(a,b\)=>inboxRank\(a\)-inboxRank\(b\)\|\|/);
  assert.match(admin,/data-pack-station-action="open-station"/);
  assert.match(admin,/if\(action==='open-station'\)openStation\(section\)/);
  assert.match(admin,/#packNotificationInbox \[hidden\]\{display:none!important\}/,'Inbox-Kopf und Liste müssen im QR-Tab wirklich verschwinden');
  assert.match(admin,/if\(globalAdmin\(\)\)shell\.insertAdjacentHTML\('beforeend',panelHtml\(\)\)/,'QR-Bereich liegt in der Inbox-Spalte');
});

test('Pack-QR-Code: Drucken über verstecktes Frame statt leerem noopener-Popup, Link direkt öffnen',()=>{
  const admin=read('assets/pack-station-admin.js');
  const start=admin.indexOf('function printQr('),print=admin.slice(start,admin.indexOf('\n',start));
  assert.doesNotMatch(print,/root\.open\(/,'window.open mit noopener liefert null, der Druck blieb leer');
  assert.match(print,/createElement\('iframe'\)/);
  assert.match(print,/contentWindow\.print\(\)/);
  assert.match(admin,/class="pack-qr-open" href="'\+esc\(data\.url\)\+'" target="_blank" rel="noopener"/);
});
