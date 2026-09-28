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

test('RC1326 P0: finaler Build rendert operative Mehr-LKW-Teilsendungen in allen drei Umgebungen',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const block=renderer(html,file);
    for(const marker of [
      "section.id='rc1017-subshipments'",
      'data-rc1326-multi-truck-rendered',
      'data-rc1017-subshipment',
      'rc1017-qr-subshipment',
      'rc1017-print-subshipment',
      'rc1017-stow-subshipment',
      'card.appendChild(section)'
    ])assert.ok(block.includes(marker),file+': '+marker+' fehlt im Mehr-LKW-Renderer');
    assert.doesNotMatch(
      block,
      /function renderRc1017SubShipments\(result\)\{[\s\S]*?if\(card\)\{[^}]*data-rc1017-multi-truck[^}]*\}\s*return count\s*\}/,
      file+': alter Stub-Renderer darf nicht ausgeliefert werden'
    );
  }
});

test('RC1326 P0: Live-E2E prüft den wiederhergestellten operativen Mehr-LKW-Bereich',()=>{
  const spec=fs.readFileSync('e2e/specs/multi-truck-live.spec.mjs','utf8');
  assert.match(spec,/#rc1017-subshipments/);
  assert.match(spec,/data-rc1017-subshipment/);
  assert.match(spec,/rc1017-qr-subshipment/);
  assert.match(spec,/rc1017-print-subshipment/);
  assert.match(spec,/rc1017-stow-subshipment/);
});

test('RC1326 P0: finaler Builder bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
});
