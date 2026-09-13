import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1075-loader-pin-admin.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const api=fs.readFileSync('api/loader-pins-admin/index.js','utf8');

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
  assert.match(runtime,/Persönliche vierstellige PINs für QR-Abholung und Location-Buchung verwalten/);
  assert.match(api,/Nur globale Administratoren dürfen Verlader-PINs verwalten/);
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
  assert.match(runtime,/Anzeigen/);
});

test('RC1075: finaler Release bindet Admin-UI nur in Produktion und TESTSERVICE ein',()=>{
  assert.match(build,/RC1075_LOADER_PIN_TAG/);
  assert.match(build,/assets\/rc1075-loader-pin-admin\.js\?v=1075/);
  assert.match(build,/if\(file!==\'demo\.html\'\)html=injectBeforeHeadClose\(html,RC1075_LOADER_PIN_TAG/);
  assert.match(build,/assets\/rc1075-loader-pin-admin\.js/);
});
