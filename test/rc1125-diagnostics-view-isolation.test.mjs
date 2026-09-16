import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const diagnostics=require('../assets/rc1013-diagnostics.js');

const runtime=fs.readFileSync('assets/rc1013-diagnostics.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

function fakeWindow(view,host){
  return {
    __EXPORTHUB_GET_STATE__:()=>({view}),
    document:{
      hidden:false,
      getElementById(id){return id==='rc1013-diagnostics-enhanced'&&host&&!host.removed?host:null},
      querySelector(){return null}
    }
  };
}

test('RC1125: Fehlerdiagnose ist strikt auf die View diagnostics begrenzt',()=>{
  const start=runtime.indexOf('function diagnosticsVisible(win)');
  const end=runtime.indexOf('function style(win)',start);
  assert.ok(start>=0&&end>start,'diagnosticsVisible-Funktion fehlt');
  const visibleBlock=runtime.slice(start,end);
  assert.match(visibleBlock,/var view=currentView\(win\);\s*if\(view\)return view==='diagnostics'/);
  assert.doesNotMatch(visibleBlock,/querySelectorAll/);
  assert.doesNotMatch(visibleBlock,/fehlerdiagnose/i);
  assert.match(runtime,/function removeDiagnosticsHost\(win\)/);
});

test('RC1125: vorhandener Diagnoseblock wird beim Wechsel in Benutzer entfernt',async()=>{
  const host={removed:false,remove(){this.removed=true}};
  const result=await diagnostics.refresh(fakeWindow('rights',host));
  assert.equal(result,false);
  assert.equal(host.removed,true,'Diagnoseblock blieb außerhalb der Diagnose-Ansicht sichtbar');
});

test('RC1125: Diagnoseansicht entfernt ihren eigenen Diagnoseblock nicht',async()=>{
  const host={removed:false,remove(){this.removed=true}};
  const win=fakeWindow('diagnostics',host);
  win.ExportHUBDiagnosticsCloud864={isGlobalAdmin:()=>false};
  const result=await diagnostics.refresh(win);
  assert.equal(result,false);
  assert.equal(host.removed,false,'Diagnoseblock wurde in der Diagnose-Ansicht unerwartet entfernt');
});

test('RC1125: finaler RC1112 Build erzwingt neuen Diagnose-Cache-Key',()=>{
  assert.match(build,/assets\\\/rc1013-diagnostics\\\.js\\\?v=1085/);
  assert.match(build,/assets\/rc1013-diagnostics\.js\?v=1125/);
  assert.match(workflow,/assets\/rc1013-diagnostics\.js\?v=1125/);
  assert.match(workflow,/__EXPORTHUB_RC1125_DIAGNOSTICS_VIEW_ISOLATION__/);
});
