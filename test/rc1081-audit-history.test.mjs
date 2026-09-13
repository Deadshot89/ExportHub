import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const authStore=fs.readFileSync('api/shared/auth-store.js','utf8');
const authApi=fs.readFileSync('api/exporthub-auth/index.js','utf8');
const runtime=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

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

test('RC1081: zentrale History führt Audit, Sendungen und Kunden zusammen',()=>{
  assert.match(runtime,/Zentrale Aktivitäts- und Audit-History/);
  assert.match(runtime,/arr\(s\.auditLog\)/);
  assert.match(runtime,/shipmentHistory/);
  assert.match(runtime,/customerHistory/);
  assert.match(runtime,/Alle Benutzer/);
  assert.match(runtime,/12 Monate/);
  assert.match(runtime,/Suche nach Benutzer, Referenz, Kunde, Aktion/);
});

test('RC1081: zentrale History ist auf den Archivbereich begrenzt',()=>{
  assert.match(runtime,/function archiveView\(\)/);
  assert.match(runtime,/if\(!archiveView\(\)\)\{if\(old\)old\.remove\(\);return false\}/);
});

test('RC1081: finaler Build lädt zentrale Audit-History in Produktion TESTSERVICE und Demo',()=>{
  assert.match(build,/RC1081_AUDIT_HISTORY_TAG/);
  assert.match(build,/assets\/rc1081-audit-history\.js\?v=1081/);
  assert.match(build,/auditHistory:\{version:'RC1081'/);
});


test('RC1081: zentrale History kann gedruckt und als CSV exportiert werden',()=>{
  assert.match(runtime,/CSV exportieren/);
  assert.match(runtime,/Drucken/);
  assert.match(runtime,/function exportCsv\(/);
  assert.match(runtime,/text\/csv;charset=utf-8/);
  assert.match(runtime,/function printHistory\(/);
  assert.match(runtime,/@page\{size:A4 landscape/);
});


test('RC1081: Namensänderung durch Administrator wird getrennt von Rechteänderungen protokolliert',()=>{
  assert.match(authApi,/USER_DISPLAY_NAME_UPDATED_BY_ADMIN/);
  assert.match(authApi,/previousName: beforeName/);
  assert.match(authApi,/displayName: afterName/);
  assert.match(runtime,/USER_DISPLAY_NAME_UPDATED_BY_ADMIN:'Anzeigename durch Administrator geändert'/);
});


test('RC1081: zentrale History liest alle Sendungssammlungen und dedupliziert erst auf Ereignisebene',()=>{
  for(const key of ['shipments','savedShipments','shipmentArchive','archivedShipments','salesSharedShipments','sharedShipments']){
    assert.match(runtime,new RegExp(key));
  }
  assert.match(runtime,/pushUnique\(map,shipmentEvent\(sh,e\)\)/);
});
