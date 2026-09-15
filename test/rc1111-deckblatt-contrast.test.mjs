import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

test('RC1111: Deckblatt erhält gezielten Paletten-Kontrast',()=>{
  assert.match(source,/function patchDeckblattContrast\(html,file\)/);
  assert.match(source,/\.rc352-cover/);
  assert.match(source,/linear-gradient\(180deg,#dbeafe 0,#dbeafe 52mm,#eef6ff 52mm,#eef6ff 100%\)/);
  assert.match(source,/border:4mm solid #08245d!important/);
  assert.match(source,/print-color-adjust:exact!important/);
});

test('RC1111: Referenzfeld wird als dunkler Blickfang ausgegeben',()=>{
  assert.match(source,/\.rc352-cover-ref/);
  assert.match(source,/background:#08245d/);
  assert.match(source,/color:#fff!important/);
});

test('RC1111: Änderung bleibt auf das Deckblatt begrenzt',()=>{
  const start=source.indexOf('function patchDeckblattContrast(html,file){');
  const end=source.indexOf('\nfunction patchPackagingGroups',start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.doesNotMatch(block,/\.rc352-load/);
  assert.doesNotMatch(block,/\.rc352-cmr/);
  assert.doesNotMatch(block,/\.rc352-sign/);
  assert.match(source,/otherDocumentsUnchanged:true/);
  assert.match(source,/qrDocumentsUnchanged:true/);
  assert.match(source,/rc352-cover \.rc352-qr-slot\{background:#fff!important/,'QR-Weißraum muss trotz farbigem Deckblatt weiß bleiben');
});
