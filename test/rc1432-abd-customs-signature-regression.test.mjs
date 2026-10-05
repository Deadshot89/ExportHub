import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function read(path){return fs.readFileSync(path,'utf8')}

const confirm=read('api/pickup-confirm-v2/index.js');
const store=read('api/shared/pickup-store.js');
const publicRuntime=read('assets/rc1018-public-language.js');
const loadingList=read('assets/rc1305-loading-list-print.js');
const pod=read('api/shared/pod-archive-rc1432.js');

test('RC1432: ABD-Abholung verlangt serverseitig die zweite Fahrerunterschrift',()=>{
  assert.match(confirm,/CUSTOMS_SIGNATURE_REQUIRED/);
  assert.match(confirm,/customsDocumentsSignatureDataUrl/);
  assert.match(confirm,/saveCustomsDocumentsSignature\(clients/);
  assert.match(store,/async function saveCustomsDocumentsSignature/);
  assert.match(store,/customsDocumentsConfirmationRequired:abd/);
});

test('RC1432: QR-Abholseite erfasst die zweite ABD-Unterschrift und sendet sie an pickup-confirm-v2',()=>{
  assert.match(publicRuntime,/customsDocumentsField/);
  assert.match(publicRuntime,/customsSignatureOpen/);
  assert.match(publicRuntime,/customsSignatureData/);
  assert.match(publicRuntime,/Zolldokumente erhalten/);
  assert.match(publicRuntime,/customsDocumentsSignatureDataUrl/);
  assert.match(publicRuntime,/abdHandoverSignatureDataUrl/);
});

test('RC1432: Ladeliste zeigt den ABD-Signaturnachweis nur bei vorhandenem ABD',()=>{
  assert.match(loadingList,/hasAbd\(sh,last\)/);
  assert.match(loadingList,/customsSignatureUrl/);
  assert.match(loadingList,/loadingListPrint\.customsDocumentsReceived/);
  assert.match(loadingList,/data-rc1432-customs-signature/);
});

test('RC1432: automatischer POD enthält die zweite Zoll-Unterschrift kompakt im Signaturbereich',()=>{
  assert.match(pod,/Zolldokumente erhalten/);
  assert.match(pod,/customsDocumentsSignatureBlobName/);
  assert.match(pod,/customsSignatureBuffer/);
  assert.match(pod,/boxW=\(width-gap\)\/2/);
});

test('RC1432: geänderte JS-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/pickup-confirm-v2/index.js','api/shared/pod-archive-rc1432.js','assets/rc1018-public-language.js','assets/rc1305-loading-list-print.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
