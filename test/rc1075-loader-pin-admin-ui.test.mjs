import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1075-loader-pin-admin.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const api=fs.readFileSync('api/loader-pins-admin/index.js','utf8');
const i18nDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

test('RC1075: Verlader-PIN Verwaltung nutzt ausschließlich den geschützten Admin-Endpunkt',()=>{
  assert.match(runtime,/ENDPOINT='\/api\/loader-pins-admin'/);
  for(const action of ['list','create','update','toggle','delete']) assert.match(runtime,new RegExp("call\\('"+action+"'"));
  assert.match(runtime,/X-ExportHUB-Token/);
  assert.match(runtime,/Authorization='Bearer '/);
  assert.doesNotMatch(runtime,/localStorage\.setItem\([^)]*pin/i);
});

test('RC1075: PIN-Verwaltung wird nur globalen Administratoren in Einstellungen gezeigt',()=>{
  assert.match(runtime,/function globalAdmin\(\)/);
  assert.match(runtime,/function settingsVisible\(\)/);
  assert.match(runtime,/if\(!globalAdmin\(\)\|\|!settingsVisible\(\)\)/);
  assert.match(runtime,/loaderPin\.subtitle/);
  assert.equal(i18nDe['loaderPin.subtitle'],'Persönliche vierstellige PINs für QR-Abholung und Location-Buchung verwalten.');
  assert.match(api,/Nur globale Administratoren dürfen Verlader-PINs verwalten/);
});

test('RC1076: Funktionsadministrator wird nicht fälschlich als Global Admin erkannt',()=>{
  let current={role:'Funktionsadministrator',globalAdmin:false,permissions:[]};
  const window={__EXPORTHUB_GET_CURRENT_USER__:()=>current};
  const sandbox={window,console,URLSearchParams};
  window.window=window;
  vm.runInNewContext(runtime,sandbox,{filename:'rc1075-loader-pin-admin.js'});
  const client=window.ExportHUBRC1075LoaderPins;
  assert.equal(client.globalAdmin(),false);
  current={role:'Benutzer',isAdmin:true,admin:true,globalAdmin:false,permissions:[]};
  assert.equal(client.globalAdmin(),false);
  current={role:'Globaler Administrator',globalAdmin:true,permissions:['*']};
  assert.equal(client.globalAdmin(),true);
});


test('RC1075: PINs sind vierstellig und standardmäßig verdeckt',()=>{
  const sandbox={window:{},console,URLSearchParams};
  sandbox.window.window=sandbox.window;
  vm.runInNewContext(runtime,sandbox,{filename:'rc1075-loader-pin-admin.js'});
  const client=sandbox.window.ExportHUBRC1075LoaderPins;
  assert.ok(client);
  assert.equal(client.validPin('1234'),true);
  assert.equal(client.validPin('123'),false);
  assert.equal(client.validPin('12a4'),false);
  assert.match(runtime,/input\.type='password'/);
  assert.match(runtime,/loaderPin\.show/);
});

test('RC1075: finaler Release bindet Admin-UI nur in Produktion und TESTSERVICE ein',()=>{
  assert.match(build,/RC1075_LOADER_PIN_TAG/);
  assert.match(build,/assets\/rc1075-loader-pin-admin\.js\?v=1075/);
  assert.match(build,/if\(file!==\'demo\.html\'\)html=injectBeforeHeadClose\(html,RC1075_LOADER_PIN_TAG/);
  assert.match(build,/assets\/rc1075-loader-pin-admin\.js/);
});


test('RC1087: Verlader-PIN Änderungen werden serverseitig auditiert ohne PIN-Wert',()=>{
  for(const marker of ['LOADER_PIN_CREATED','LOADER_PIN_UPDATED','LOADER_PIN_STATUS_CHANGED','LOADER_PIN_DELETED']) assert.match(api,new RegExp(marker));
  assert.match(api,/auditStore\.addAudit/);
  assert.match(api,/loaderId:/);
  assert.match(api,/loaderName:/);
  const start=api.indexOf('async function auditPinChange');
  const end=api.indexOf('module.exports',start);
  const block=api.slice(start,end);
  assert.doesNotMatch(block,/payload\.pin|\bpin\s*:/);
  assert.match(api,/X-ExportHUB-Loader-Pin-Audit/);
});


test('RC1087: fehlgeschlagenes Historien-Audit wird nach PIN-Änderungen sichtbar gemeldet',()=>{
  assert.match(runtime,/function mutationStatus\(box,data,successKey\)/);
  assert.match(runtime,/data\.auditStored===false/);
  assert.match(runtime,/loaderPin\.auditWarning/);
  assert.match(i18nDe['loaderPin.auditWarning'],/Fehlerdiagnose prüfen/);
  assert.match(runtime,/data-kind="warning"/);
});
