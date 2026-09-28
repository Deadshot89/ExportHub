import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

let built=false;
function build(){
  if(built)return;
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  built=true;
}
function renderer(html,file){
  const startMarker='function renderRc1017SubShipments(result){';
  const nextMarker='function rc1017SyncSubShipments(target){';
  const start=html.indexOf(startMarker),end=html.indexOf(nextMarker,start);
  assert.ok(start>=0&&end>start,file+': Mehr-LKW-Renderer fehlt');
  return html.slice(start,end);
}

test('RC1329 P0: finaler Build enthält keinen Mehr-LKW-Stub mehr',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const block=renderer(html,file);
    for(const marker of [
      "section.id='rc1017-subshipments'",
      'data-rc1329-multi-truck-rendered',
      'data-rc1017-subshipment',
      'rc1017-qr-subshipment',
      'rc1017-print-subshipment',
      'rc1017-stow-subshipment',
      'card.appendChild(section)'
    ])assert.ok(block.includes(marker),file+': '+marker+' fehlt');
    assert.ok(block.length>1500,file+': Renderer ist verdächtig kurz und könnte wieder ein Stub sein');
  }
});

test('RC1329 P0: Save-Refresh und vollständiger Renderer sind gemeinsam im finalen Paket',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    assert.match(html,/assets\/rc1328-multi-truck-ui-refresh\.js\?v=1333/);
    assert.match(renderer(html,file),/card\.appendChild\(section\)/);
  }
});

test('RC1329 P0: ursprünglicher TESTSERVICE-E2E prüft weiterhin den echten Teilsendungsbereich',()=>{
  const spec=fs.readFileSync('e2e/specs/multi-truck-live.spec.mjs','utf8');
  assert.match(spec,/#rc1017-subshipments/);
  assert.match(spec,/data-rc1017-subshipment/);
  assert.match(spec,/rc1017-qr-subshipment/);
  assert.match(spec,/rc1017-print-subshipment/);
  assert.match(spec,/rc1017-stow-subshipment/);
});

test('RC1329 P0: Builder bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
});
