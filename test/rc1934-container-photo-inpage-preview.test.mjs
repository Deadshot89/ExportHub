import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/rc1014-shipment-overview.js','utf8');
const css=fs.readFileSync('assets/rc1014-shipment-overview.css','utf8');

test('RC1934: photo preview is an in-page modal and never opens a browser tab',()=>{
  assert.doesNotThrow(()=>new Function(js));
  assert.doesNotMatch(js,/root\.open\(url,'_blank'/);
  assert.match(js,/function showContainerPhotoPreview\(/);
  assert.match(js,/dialog\.setAttribute\('role','dialog'\)/);
  assert.match(js,/dialog\.setAttribute\('aria-modal','true'\)/);
  assert.match(js,/doc\.body\.appendChild\(overlay\)/);
  assert.match(js,/if\(event\.key==='Escape'\)/);
  assert.match(js,/if\(event\.key==='Tab'\)/);
  assert.match(js,/closeButton\.focus\(\)/);
  assert.match(js,/URL\.revokeObjectURL\(url\)/);
  assert.match(js,/root\.addEventListener\('exporthub:viewchange',close/);
  assert.match(css,/\.rc1259-photo-preview-dialog/);
});

test('RC1934: preview and download keep the authorized photo endpoint and reject stale UI',()=>{
  assert.match(js,/async function fetchContainerBlob\(shipment,photo\)/);
  assert.match(js,/headers:apiHeaders\(\)/);
  assert.match(js,/if\(trigger&&trigger\.isConnected===false\)/);
  assert.match(js,/openContainerPhoto\(shipment,photo,false,open\)/);
  assert.match(js,/openContainerPhoto\(shipment,photo,true,down\)/);
  assert.match(js,/a\.download=q\(photo&&photo\.name\)/);
});
