import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1267-i18n.js','utf8');

test('RC1507: lokale Save-Bestätigung ohne Paralleländerung überspringt schwere i18n-Neuübersetzung',()=>{
  assert.match(
    source,
    /function isNoMergeSaveConfirmation\(event\)\{var detail=event&&event\.detail\|\|\{\};return detail\.remote===true&&detail\.reason==='save-confirmation'&&detail\.concurrentMerge!==true\}/,
    'i18n benötigt denselben eindeutigen No-Merge-Save-ACK-Guard wie die Shipment-Render-Pfade'
  );
  assert.match(
    source,
    /w\.addEventListener\('exporthub:sync',function\(event\)\{if\(isNoMergeSaveConfirmation\(event\)\)return;repairContaminatedGoodsDescription\(\);buildDynamicIndex\(\);ensureSelector\(\);if\(d\.body\)queueFullTranslation\(\)\}\)/,
    'lokale Save-ACKs dürfen keinen kompletten Dynamic-Index-Rebuild und keine Full-Body-Übersetzung auslösen'
  );
});

test('RC1507: echte Datenänderungsereignisse behalten die vollständige i18n-Aktualisierung',()=>{
  for(const name of ['exporthub:customer-updated','exporthub:shipment-updated','exporthub:task-updated']){
    assert.match(source,new RegExp("w\\.addEventListener\\('"+name+"',function\\(\\)\\{repairContaminatedGoodsDescription\\(\\);buildDynamicIndex\\(\\);ensureSelector\\(\\);if\\(d\\.body\\)queueFullTranslation\\(\\)\\}\\)"),name+' muss weiterhin die vollständige i18n-Aktualisierung auslösen');
  }
});
