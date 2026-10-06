import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const pickup=read('pickup.html');
const confirm=read('api/pickup-confirm-v2/index.js');
const publicRuntime=read('assets/rc1018-public-language.js');
const loadingList=read('assets/rc1305-loading-list-print.js');
const pod1432=read('api/shared/pod-archive-rc1432.js');

test('RC1456: ABD nutzt nur die Uebergabe-Checkbox und keine zweite Unterschrift',()=>{
  assert.match(pickup,/id="customsDocumentsConfirmed" type="checkbox"/);
  assert.match(pickup,/Zolldokumente wurden an den Fahrer übergeben/);
  assert.doesNotMatch(pickup,/customsSignatureOpen|customsSignatureData|customsSignaturePreview/);
  assert.doesNotMatch(publicRuntime,/customsSignatureOpen|customsSignatureData|customsSignaturePreview/);
});

test('RC1456: Server verlangt die ABD-Uebergabebestaetigung statt Zollunterschrift',()=>{
  assert.match(confirm,/CUSTOMS_DOCUMENTS_CONFIRMATION_REQUIRED/);
  assert.match(confirm,/customsDocumentsReceived===true/);
  assert.match(confirm,/customsDocumentsConfirmed===true/);
  assert.match(confirm,/abdDocumentsHandedOver===true/);
  assert.doesNotMatch(confirm,/CUSTOMS_SIGNATURE_REQUIRED/);
  assert.doesNotMatch(confirm,/saveCustomsDocumentsSignature\(clients/);
  assert.doesNotMatch(confirm,/customsDocumentsSignatureDataUrl|abdHandoverSignatureDataUrl|customsSignatureDataUrl/);
});

test('RC1456: Ladeliste und POD enthalten genau eine Fahrerunterschrift',()=>{
  assert.match(loadingList,/rc1305-signature-primary/);
  assert.doesNotMatch(loadingList,/rc1305-signature-customs|data-rc1432-customs-signature|ensureCustomsSignatureField|customsSignatureUrl/);
  assert.doesNotMatch(pod1432,/customsSignatureBuffer|customsSignatureType|customsDocumentsSignatureBlobName|Zolldokumente erhalten/);
});
