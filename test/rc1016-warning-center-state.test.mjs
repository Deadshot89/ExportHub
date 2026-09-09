import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const ROOT=process.cwd();
const BUILD='.github/rc1016/build-three-env.mjs';

function build(){
  execFileSync(process.execPath,[BUILD],{cwd:ROOT,stdio:'pipe'});
}

function rc885StateSource(html){
  const start=html.indexOf('if(window.__EXPORTHUB_RC885_CLEAN_WORKSPACE__) return;');
  assert.notEqual(start,-1,'RC885 Warncenter/Arbeitsplatz wurde im Build nicht gefunden.');
  const end=html.indexOf('function firstArray',start);
  assert.notEqual(end,-1,'RC885 Datenquellenblock wurde im Build nicht gefunden.');
  return html.slice(start,end);
}

function executeGetState(source,window){
  const start=source.indexOf('function getState()');
  assert.notEqual(start,-1,'RC885 getState wurde nicht gefunden.');
  const fn=source.slice(start).trim();
  const context={window};
  runInNewContext(`window.__rc1016GetState=(${fn});`,context);
  return context.window.__rc1016GetState();
}

test('RC1016 Warncenter liest den kanonischen Laufzeit-State in allen drei Umgebungen',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(`dist-rc1016/${file}`,'utf8');
    const source=rc885StateSource(html);
    assert.match(source,/typeof window\.__EXPORTHUB_GET_STATE__==='function'/,`${file}: Warncenter ignoriert __EXPORTHUB_GET_STATE__.`);
    assert.match(source,/window\.state&&typeof window\.state==='object'/,`${file}: Warncenter ignoriert den gebundenen Objekt-State.`);

    const canonicalState={shipments:[{id:'WARN-1',status:'Abgeholt'}]};
    assert.equal(
      executeGetState(source,{__EXPORTHUB_GET_STATE__:()=>canonicalState}),
      canonicalState,
      `${file}: Warncenter erhält den kanonischen Laufzeit-State nicht.`
    );

    const boundState={shipments:[{id:'WARN-2',status:'Bereit zur Abholung'}]};
    assert.equal(
      executeGetState(source,{state:boundState}),
      boundState,
      `${file}: Warncenter erhält den gebundenen Objekt-State nicht.`
    );
  }
});
