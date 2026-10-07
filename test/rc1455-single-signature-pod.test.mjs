import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pickup=fs.readFileSync('pickup.html','utf8');
const confirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');
const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const print=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const publicLanguage=fs.readFileSync('assets/rc1018-public-language.js','utf8');

test('RC1455: ABD uses handover checkbox and never asks for a second signature',()=>{
  assert.match(pickup,/id="customsDocumentsConfirmed"/);
  assert.match(pickup,/eine zweite Unterschrift ist nicht erforderlich/);
  assert.doesNotMatch(pickup,/customsSignatureOpen|customsSignatureData|customsSignatureSaved/);
  assert.match(confirm,/customsDocumentsReceived===true|customsDocumentsConfirmed===true|abdDocumentsHandedOver===true/);
  assert.doesNotMatch(confirm,/CUSTOMS_SIGNATURE_REQUIRED|saveCustomsDocumentsSignature|customsDocumentsSignatureDataUrl|abdHandoverSignatureDataUrl|customsSignatureDataUrl/);
});

test('RC1455: public pickup runtime cannot re-inject the removed second signature',()=>{
  assert.doesNotMatch(publicLanguage,/__EXPORTHUB_RC1432_PICKUP_CUSTOMS_SIGNATURE__/);
  assert.doesNotMatch(publicLanguage,/customsSignatureOpen|customsSignatureData|customsDocumentsSignatureDataUrl|abdHandoverSignatureDataUrl/);
  assert.doesNotMatch(publicLanguage,/zweite(?:n|r)?\s+Unterschrift|second\s+signature/i);
});

test('RC1455: signed POD is generated from the driver signature only',()=>{
  assert.match(confirm,/saveDriverSignature/);
  assert.match(confirm,/require\('\.\.\/shared\/pod-archive'\)/);
  assert.doesNotMatch(confirm,/pod-archive-rc1432/);
  assert.doesNotMatch(archive,/customsSignatureBuffer|customsDocumentsSignatureBlobName/);
});

test('RC1455: loading list prints only the driver signature',()=>{
  assert.match(print,/rc1305-signature-primary/);
  assert.doesNotMatch(print,/rc1305-signature-customs|data-rc1432-customs-signature|customsDocumentsSignature/);
});
