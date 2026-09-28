import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1331: Mehr-LKW-Datenpersistenz ist vom UI-Render isoliert',()=>{
  assert.match(build,/function patchRc1331MultiTruckSaveIsolation\(html,file\)/);
  assert.match(build,/function rc1331RenderRc1017SubShipmentsSafe\(result\)/);
  assert.match(build,/try\{return renderRc1017SubShipments\(result\)\}catch\(e\)/);
  assert.match(build,/RC1331 Mehr-LKW UI-Render/);
});

test('RC1331: nur der Sync-Pfad nutzt den fehlertoleranten Renderer',()=>{
  assert.match(build,/block=block\.replace\(\/renderRc1017SubShipments\\\(\/g,'rc1331RenderRc1017SubShipmentsSafe\('\)/);
  assert.match(build,/direkter UI-Render kann Save weiterhin abbrechen/);
  assert.match(build,/Save-isolierter Renderer fehlt/);
});

test('RC1331: Isolation wird nach dem kanonischen RC1329-Renderer angewendet',()=>{
  const patchHtml=build.slice(build.indexOf('function patchHtml(file){'));
  const rendererAt=patchHtml.indexOf('html=patchRc1329MultiTruckRenderer(html,file)');
  const isolateAt=patchHtml.indexOf('html=patchRc1331MultiTruckSaveIsolation(html,file)');
  assert.ok(rendererAt>=0);
  assert.ok(isolateAt>rendererAt);
});
