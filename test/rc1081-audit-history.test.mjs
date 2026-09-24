import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const authStore=fs.readFileSync('api/shared/auth-store.js','utf8');
const authApi=fs.readFileSync('api/exporthub-auth/index.js','utf8');
const runtime=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const shipmentHistory=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const customerHistory=fs.readFileSync('assets/rc1080-customer-history.js','utf8');
const profile=fs.readFileSync('assets/rc1079-profile-settings.js','utf8');

test('RC1081: Audit-Protokoll hält 12 Monate und begrenzt die Größe',()=>{
  assert.match(authStore,/365 \* 86400000/);
  assert.match(authStore,/slice\(-4999\)/);
  assert.match(authStore,/team\.state\.auditLog\.push/);
});

test('RC1081: Abmeldung wird mit Benutzer im Audit protokolliert',()=>{
  const start=authApi.indexOf('async function logout');
  const end=authApi.indexOf('async function updateProfile');
  const block=authApi.slice(start,end);
  assert.match(block,/LOGOUT/);
  assert.match(block,/loggedOutSession/);
  assert.match(block,/auth\.addAudit/);
  assert.match(block,/displayName/);
});

test('RC1081: administrativ beendete Sitzungen werden protokolliert',()=>{
  const start=authApi.indexOf('async function adminTerminateSessions');
  const block=authApi.slice(start,start+3200);
  assert.match(block,/SESSIONS_TERMINATED/);
  assert.match(block,/terminated: result\.result/);
  assert.match(block,/current\.user\.name/);
});

test('RC1087: zentrale Historie führt Sendungen, Kunden, Aufgaben, Palettenkonto und Audit zusammen',()=>{
  assert.match(runtime,/history\.title/);
  assert.match(runtime,/arr\(s\.auditLog\)/);
  assert.match(runtime,/ExportHUBShipmentHistory1071/);
  assert.match(runtime,/shipmentHistory/);
  assert.match(runtime,/customerHistory/);
  assert.match(runtime,/arr\(s\.tasks\)/);
  assert.match(runtime,/arr\(s\.palletAccount\)/);
  for(const key of ['history.allUsers','history.allActions','history.allObjects','history.allData','history.searchPlaceholder','history.subtitle']) assert.match(runtime,new RegExp(key.replace(/[.]/g,'\\.')));
  assert.match(runtime,/data-rc1084-history-table/);
  assert.match(runtime,/exporthub:language-changed/);
});

test('RC1087: Historie ist eine eigene Ansicht und nicht mehr an Archiv gebunden',()=>{
  assert.match(runtime,/function historyView\(\)/);
  assert.match(runtime,/v==='history'/);
  assert.match(runtime,/if\(!historyView\(\)\)\{if\(old\)old\.remove\(\);return false\}/);
  assert.doesNotMatch(runtime,/function archiveView\(\)/);
});

test('RC1087: finaler Build lädt Historie als eigenen Reiter in Produktion TESTSERVICE und Demo',()=>{
  assert.match(build,/RC1081_AUDIT_HISTORY_TAG/);
  assert.match(build,/assets\/rc1081-audit-history\.js\?v=1087/);
  assert.match(build,/auditHistory:\{version:'RC1087'/);
  assert.match(build,/view:'history'/);
  assert.match(build,/view:'history',label:'Historie',right:'history'/);
  assert.match(build,/patchHistoryNavigation\(html,file\)/);
});

test('RC1081: zentrale History kann gedruckt und als CSV exportiert werden',()=>{
  assert.match(runtime,/history\.csvExport/);
  assert.match(runtime,/common\.print/);
  assert.match(runtime,/function exportCsv\(/);
  assert.match(runtime,/text\/csv;charset=utf-8/);
  assert.match(runtime,/function printHistory\(/);
  assert.match(runtime,/@page\{size:A4 landscape/);
});

test('RC1081: Namensänderung durch Administrator wird getrennt von Rechteänderungen protokolliert',()=>{
  assert.match(authApi,/USER_DISPLAY_NAME_UPDATED_BY_ADMIN/);
  assert.match(authApi,/previousName: beforeName/);
  assert.match(authApi,/displayName: afterName/);
  assert.match(runtime,/USER_DISPLAY_NAME_UPDATED_BY_ADMIN:'history\.audit\.USER_DISPLAY_NAME_UPDATED_BY_ADMIN'/);
});

test('RC1087: zentrale Historie liest alle Sendungssammlungen inklusive abgeleiteter Ereignisse',()=>{
  for(const key of ['shipments','savedShipments','shipmentArchive','archivedShipments','salesSharedShipments','sharedShipments']){
    assert.match(runtime,new RegExp(key));
  }
  assert.match(runtime,/shipmentEvents\(sh\)/);
  assert.match(runtime,/ExportHUBShipmentHistory1071/);
  assert.match(runtime,/pushUnique\(map,shipmentEvent\(sh,e\)\)/);
});

test('RC1087: Filterung nach Zeitraum, Bereich, Aktion, Benutzer und Objekt ist vollständig',()=>{
  for(const marker of [
    "FILTER.type!=='all'",
    "FILTER.subtype!=='all'",
    "FILTER.actor!=='all'",
    "FILTER.entity!=='all'",
    "FILTER.from",
    "FILTER.to",
    "FILTER.query"
  ]) assert.match(runtime,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(runtime,/data-rc1081-reset/);
});

test('RC1267: sichtbare Aktionsnamen verwenden zentrale Translation Keys und technische Subtypen bleiben intern',()=>{
  for(const marker of [
    "created:'history.shipment.created'",
    "'mail-sent':'history.shipment.mail-sent'",
    "'work-start':'history.shipment.work-start'",
    "'pickup-plan':'history.shipment.pickup-plan'",
    "'customer-created':'history.customer.customer-created'",
    "LOGIN_FAILED:'history.audit.LOGIN_FAILED'",
    "DIAGNOSTIC_AUTOFIX_FIXED:'history.audit.DIAGNOSTIC_AUTOFIX_FIXED'"
  ]) assert.ok(runtime.includes(marker),marker+' fehlt');
  assert.match(runtime,/function actionLabel\(e\)/);
  assert.match(runtime,/actionTitle\(e\),area:typeLabel\(e\.type\)/);
  assert.match(runtime,/function shipmentLegacyCode\(raw\)/);
  assert.match(runtime,/FILTER=\{query:'',type:'all',subtype:'all',actor:'all',entity:'all',days:0/);
});

test('RC1087: alle verfügbaren Aktionen werden ohne interne Scroll-Begrenzung als Tabelle gelistet',()=>{
  assert.match(runtime,/data-rc1084-history-table/);
  assert.doesNotMatch(runtime,/max-height:620px/);
  assert.match(runtime,/history\.count/);
});

test('RC1087: sichtbaren Historienansichten sind vollständig deutsch',()=>{
  assert.match(shipmentHistory,/>HISTORIE<\/span>/);
  assert.match(customerHistory,/>HISTORIE<\/span>/);
  assert.doesNotMatch(shipmentHistory,/>HISTORY<\/span>/);
  assert.doesNotMatch(customerHistory,/>HISTORY<\/span>/);
  assert.match(profile,/Historie-Einträge/);
  assert.doesNotMatch(profile,/History-Einträge/);
});

test('RC1087: Aufgaben werden aus belastbaren Erstellungs- und Abschlussdaten abgeleitet',()=>{
  assert.match(runtime,/function taskEvents\(t\)/);
  assert.match(runtime,/'task-created':'history\.task\.task-created'/);
  assert.match(runtime,/'task-completed':'history\.task\.task-completed'/);
  assert.match(runtime,/'task-cancelled':'history\.task\.task-cancelled'/);
  assert.match(runtime,/completedAt\|\|t\.doneAt\|\|t\.closedAt/);
  assert.match(runtime,/completedBy\|\|t\.doneBy\|\|t\.closedBy/);
  assert.match(runtime,/history\.actor\.systemPod/);
  assert.match(runtime,/history\.actor\.systemPickup/);
});

test('RC1087: Palettenkonto wird nur bei gespeichertem Datum oder Zeitpunkt in der Historie geführt',()=>{
  assert.match(runtime,/function palletEvents\(p,index\)/);
  assert.match(runtime,/p\.at\|\|p\.createdAt\|\|p\.bookedAt\|\|p\.bookingAt\|\|p\.timestamp\|\|p\.date/);
  assert.match(runtime,/if\(!at\)return\[\]/);
  assert.match(runtime,/'pallet-in':'history\.pallet\.pallet-in'/);
  assert.match(runtime,/'pallet-out':'history\.pallet\.pallet-out'/);
  assert.match(runtime,/'pallet-exchange':'history\.pallet\.pallet-exchange'/);
  assert.match(runtime,/palletType/);
  assert.match(runtime,/shipmentRef\|\|p\.reference\|\|p\.ref/);
});

test('RC1087: Aufgaben und Palettenkonto sind eigene filterbare Historienbereiche',()=>{
  assert.match(runtime,/task:'history\.type\.task'/);
  assert.match(runtime,/pallet:'history\.type\.pallet'/);
  assert.match(build,/'taskDerived','palletAccount'/);
  assert.match(runtime,/countType\(events,'task'\)/);
  assert.match(runtime,/countType\(events,'pallet'\)/);
});

test('RC1087: reine Datumswerte werden ohne erfundene Uhrzeit angezeigt',()=>{
  assert.match(runtime,/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  assert.match(runtime,/dateStyle:'short'/);
});

test('RC1267: Verlader-PIN Verwaltungsaktionen verwenden lokalisierbare Audit-Keys',()=>{
  for(const marker of [
    "LOADER_PIN_CREATED:'history.audit.LOADER_PIN_CREATED'",
    "LOADER_PIN_UPDATED:'history.audit.LOADER_PIN_UPDATED'",
    "LOADER_PIN_STATUS_CHANGED:'history.audit.LOADER_PIN_STATUS_CHANGED'",
    "LOADER_PIN_DELETED:'history.audit.LOADER_PIN_DELETED'"
  ]) assert.ok(runtime.includes(marker),marker+' fehlt');
  assert.match(runtime,/entity='Verlader-PIN'/);
  assert.match(runtime,/history\.entity\.loaderPin/);
  assert.match(runtime,/details\.loaderName\|\|details\.loaderId/);
  assert.doesNotMatch(runtime,/details\.pin/);
});
