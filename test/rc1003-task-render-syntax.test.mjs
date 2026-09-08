import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function canonicalRuntimeScripts(file){
  const html=fs.readFileSync(file,'utf8');
  const marker=html.indexOf('window.__EXPORTHUB_CANONICAL_MODULE_MANIFEST__=');
  assert.ok(marker>=0,`${file}: Canonical-Manifest fehlt`);
  const open=html.lastIndexOf('<script',marker);
  const bodyStart=html.indexOf('>',open)+1;
  const close=html.indexOf('</script',marker);
  assert.ok(open>=0&&bodyStart>open&&close>marker,`${file}: Canonical-Manifest-Scriptblock unvollstaendig`);

  const window={};
  vm.runInNewContext(html.slice(bodyStart,close),{window},{timeout:2000,filename:`${file}:manifest`});
  const manifest=window.__EXPORTHUB_CANONICAL_MODULE_MANIFEST__;
  assert.ok(Array.isArray(manifest)&&manifest.length,`${file}: Canonical-Manifest ist leer`);

  const scripts=[];
  for(const entry of manifest){
    let captured=[];
    const runtimeWindow={ExportHUBClean:{runScripts(items){captured=items;return null}}};
    vm.runInNewContext(entry.code,{window:runtimeWindow},{timeout:2000,filename:`${file}:${entry.src||'canonical'}`});
    for(const item of captured||[]){
      assert.equal(typeof item.code,'string',`${file}: Canonical-Laufzeitcode fehlt`);
      assert.doesNotThrow(()=>new vm.Script(item.code,{filename:`${file}:runtime-${item.id}.js`}),`${file}: Canonical-Laufzeitcode ${item.id} ist syntaktisch defekt`);
      scripts.push(item.code);
    }
  }
  return scripts;
}

for(const file of ['TESTVERSION.html','index.html']){
  test(`RC1003 ${file}: Aufgaben-Laufzeitmodul ist vollstaendig`,()=>{
    const scripts=canonicalRuntimeScripts(file);
    const src=scripts.find(code=>code.includes('function tasks(){'));
    assert.ok(src,`${file}: aktives Aufgaben-Laufzeitmodul fehlt`);

    for(const name of [
      'taskManualDistinctRC874',
      'taskDisplayKeyRC874',
      'taskDedupeScoreRC874',
      'dedupeVisibleTasksRC874',
      'taskGroupStateRC874'
    ]){
      assert.match(src,new RegExp(`function\\s+${name}\\s*\\(`),`${file}: ${name} fehlt im aktiven Aufgabenmodul`);
    }
    assert.match(src,/const\s+TASK_GROUP_STORE_RC874\s*=/,`${file}: TASK_GROUP_STORE_RC874 fehlt im aktiven Aufgabenmodul`);
    assert.match(src,/dedupeVisibleTasksRC874\(rawOpen\)/,`${file}: Aufgaben-Renderpfad verwendet das Dedupe nicht mehr`);
    assert.match(src,/taskGroupStateRC874\(\)/,`${file}: Gruppenstatus wird nicht mehr gelesen`);
  });
}
