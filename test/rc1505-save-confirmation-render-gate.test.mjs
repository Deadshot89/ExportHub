import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}
function read(file){return fs.readFileSync(file,'utf8')}

test('RC1505: lokale Save-Bestätigung ohne Paralleländerung löst keinen Shipment-Remote-Patch aus',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1112/'+file);
    assert.match(
      html,
      /saveConfirmationNoMerge=detail\.remote===true&&detail\.reason==='save-confirmation'&&detail\.concurrentMerge!==true/,
      file+': Save-Confirmation ohne Paralleländerung wird noch nicht als lokales ACK erkannt'
    );
    assert.match(
      html,
      /if\(saveConfirmationNoMerge\)return;/,
      file+': lokales ACK kann weiterhin den Shipment-Remote-Patch auslösen'
    );
    assert.match(
      html,
      /if\(detail\.remote===true\)scheduleRemoteMerge\(0\)/,
      file+': echter Remote-Sync muss erhalten bleiben'
    );
  }
});

test('RC1505: lokale No-Merge-ACKs starten keine zweite große Prozess-Nachbearbeitung',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1112/'+file);
    assert.match(
      html,
      /addEventListener\('exporthub:sync',function\(event\)\{var detail=event&&event\.detail\|\|\{\};if\(detail\.reason==='save-confirmation'&&detail\.concurrentMerge!==true\)return;schedulePost\(220,true\)\}\)/,
      file+': lokale No-Merge-ACKs lösen weiterhin schedulePost(220,true) aus'
    );
  }
});

test('RC1505: Save-Sync transportiert Paralleländerungs-Metadaten bis zum UI-Listener',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1112/'+file);
    assert.match(
      html,
      /reason:reason\|\|'poll',remote:true,concurrentMerge:options\.concurrentMerge===true/,
      file+': exporthub:sync verliert concurrentMerge-Metadaten'
    );
    const guardedApply=(html.match(/applyRemoteDocument\(authoritative,'save-confirmation',\{allowWhileSaving:true,concurrentMerge:authoritative&&authoritative\.concurrentMerge===true\}\)/g)||[]).length;
    assert.equal(guardedApply,2,file+': beide Save-Confirmation-Apply-Pfade müssen concurrentMerge explizit weitergeben');
  }
});
