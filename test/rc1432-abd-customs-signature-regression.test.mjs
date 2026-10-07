import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function read(path){return fs.readFileSync(path,'utf8')}

const confirm=read('api/pickup-confirm-v2/index.js');
const publicRuntime=read('assets/rc1018-public-language.js');
const loadingList=read('assets/rc1305-loading-list-print.js');
const pod=read('api/shared/pod-archive.js');

test('RC1432→RC1455: ABD-Abholung verlangt Übergabebestätigung statt zweiter Fahrerunterschrift',()=>{
  assert.match(confirm,/CUSTOMS_DOCUMENTS_CONFIRMATION_REQUIRED/);
  assert.match(confirm,/customsDocumentsReceived===true/);
  assert.match(confirm,/customsDocumentsConfirmed===true/);
  assert.match(confirm,/abdDocumentsHandedOver===true/);
  assert.doesNotMatch(confirm,/CUSTOMS_SIGNATURE_REQUIRED|customsDocumentsSignatureDataUrl|abdHandoverSignatureDataUrl|saveCustomsDocumentsSignature\(clients/);
});

test('RC1432→RC1455: öffentliche Runtime darf die entfernte zweite ABD-Unterschrift nicht erneut injizieren',()=>{
  assert.doesNotMatch(publicRuntime,/__EXPORTHUB_RC1432_PICKUP_CUSTOMS_SIGNATURE__/);
  assert.doesNotMatch(publicRuntime,/customsSignatureOpen|customsSignatureData|customsDocumentsSignatureDataUrl|abdHandoverSignatureDataUrl/);
  assert.doesNotMatch(publicRuntime,/zweite(?:n|r)?\s+Unterschrift|second\s+signature/i);
});

test('RC1432→RC1455: Ladeliste behält genau den primären Fahrer-Signaturblock',()=>{
  assert.match(loadingList,/rc1305-signature-primary/);
  assert.doesNotMatch(loadingList,/rc1305-signature-customs|data-rc1432-customs-signature|customsDocumentsSignature/);
});

test('RC1432→RC1455: automatischer POD verwendet ausschließlich die Fahrerunterschrift',()=>{
  assert.match(pod,/createPodPdf\(record, signatureBuffer, signatureType\)/);
  assert.doesNotMatch(pod,/customsSignatureBuffer|customsSignatureType|customsDocumentsSignatureBlobName/);
});

test('RC1432→RC1455: geänderte JS-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/pickup-confirm-v2/index.js','assets/rc1018-public-language.js','assets/rc1305-loading-list-print.js','api/shared/pod-archive.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
