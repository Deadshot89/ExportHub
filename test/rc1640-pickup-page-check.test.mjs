import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('pickup.html','utf8');
const css=page.slice(0,page.indexOf('</style>'));

test('RC1640: hidden-Attribut gewinnt gegen label/form/.section display:grid',()=>{
  assert.match(css,/(^|[\s}])\[hidden\]\{display:none!important\}/m);
  for(const id of ['recoverySection','containerSection','customsDocumentsField','returnLabel'])assert.match(page,new RegExp('id="'+id+'"[^>]*hidden'));
  assert.match(page,/<form id="form" hidden>/);
});

test('RC1640: Teilabholung braucht wie der Server keine Containerdokumentation',()=>{
  assert.match(page,/function unlockDriverAfterColli\(\)/);
  assert.match(page,/if\(mode==='complete'&&containerRequired&&!seal\)/);
  assert.match(page,/if\(mode==='complete'&&containerRequired&&\(!containerPhotos\.loaded\|\|!containerPhotos\.number\|\|!containerPhotos\.sealed\)\)/);
  assert.match(page,/if\(n>0&&n<open\)\{colliOk=true;setConfirmMode\('partial'\)/);
  assert.match(page,/if\(n===open\)\{colliOk=true;setConfirmMode\('complete'\)/);
  assert.match(page,/partial\.hidden=colliMode!=='partial'/);
  assert.match(page,/complete\.hidden=colliMode==='partial'/);
});

test('RC1640: Containerfoto kann nach Upload oder Fehler erneut ausgewählt werden',()=>{
  assert.match(page,/finally\(function\(\)\{containerUploadBusy=false;if\(input\)input\.value=''\}\)/);
});

test('RC1640: Kundenname aus pickup-status (customer) und Europaletten nur bei ausgegebenen Paletten',()=>{
  assert.match(page,/typeof data\.customer==='string'\?q\(data\.customer\):''/);
  assert.match(page,/returnLabel\.hidden=!\(Number\(data&&data\.palletOut\)>0\)/);
});

test('RC1640: Blindzählung – erwartete, abgeholte und offene Colli-Menge erscheinen nie auf der Seite',()=>{
  for(const id of ['expectedColli','collectedColli','remainingColli'])assert.doesNotMatch(page,new RegExp('id="'+id+'"'));
  assert.doesNotMatch(page,/getElementById\('colli'\)\.max=/);
  assert.doesNotMatch(page,/'\+(open|expected|remainingBefore|rest)\+'/);
  assert.doesNotMatch(page,/\(open-n\)/);
  assert.match(page,/id="modeComplete" type="radio" name="pickupMode" value="complete" checked/);
  assert.match(page,/id="modePartial" type="radio" name="pickupMode" value="partial"/);
  assert.match(page,/addEventListener\('click',function\(\)\{checkColli\(selectedPickupMode\(\)\)\}\)/);
});
