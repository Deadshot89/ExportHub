import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}
function read(file){return fs.readFileSync(file,'utf8')}

test('RC1418: lokaler Save-Confirmation-Sync löst keinen Remote-Merge der Sendungsmaske aus',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1112/'+file);
    assert.match(
      html,
      /localSaveConfirmation=detail\.remote===true&&detail\.reason==='save-confirmation'&&window\.__EXPORTHUB_SHIPMENT_SAVE_TX__===true/,
      file+': lokaler Save-Confirmation-Guard fehlt'
    );
    assert.match(html,/if\(localSaveConfirmation\)return;if\(detail\.remote===true\)scheduleRemoteMerge\(0\)/,file+': echter Remote-Sync muss erhalten bleiben');
    assert.doesNotMatch(
      html,
      /addEventListener\('exporthub:sync',function\(event\)\{if\(event&&event\.detail&&event\.detail\.remote===true\)scheduleRemoteMerge\(0\)\}\)/,
      file+': alter unbedingter Remote-Merge ist noch aktiv'
    );
  }
});

test('RC1418: Live-Browsertest verlangt identisches Sendungslayout vor und nach Speichern',()=>{
  const spec=read('e2e/specs/shipment-create.spec.mjs');
  assert.match(spec,/__RC1418_LAYOUT_NODE__=document\.getElementById\('rc363FixedShipmentLayout'\)/);
  assert.match(spec,/__RC1418_LAYOUT_NODE__===document\.getElementById\('rc363FixedShipmentLayout'\)/);
  assert.match(spec,/Speichern darf das montierte Sendungslayout nicht ersetzen/);
});
