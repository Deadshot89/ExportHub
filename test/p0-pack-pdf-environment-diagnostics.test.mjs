import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const viewer=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
const pack=fs.readFileSync('assets/pack-notification-shipment.js','utf8');

function viewerAt(hostname,environment){
  const root={location:{hostname,origin:'https://'+hostname},ExportHUBClean:{runtime:{environment}}};
  vm.runInNewContext(viewer,{window:root,URL,Uint8Array});
  return root.ExportHUBDocumentBlob1059;
}
function detail(){
  const root={};
  const source=pack.replace('  root.ExportHUBPackShipment=Object.freeze(',
    '  root.__P0_PACK_DOCUMENT_FAILURE_DETAIL__=packDocumentFailureDetail;root.ExportHUBPackShipment=Object.freeze(');
  assert.notEqual(source,pack);
  vm.runInNewContext(source,{window:root,URL,Uint8Array,setTimeout,clearTimeout,Date,Intl});
  return root.__P0_PACK_DOCUMENT_FAILURE_DETAIL__;
}
test('P0 production document API cannot inherit stale TESTSERVICE runtime on official production domain',()=>{
  for(const host of ['www.exporthub360.de','exporthub360.de','www.exporthub360.com','exporthub360.com']){
    const helper=viewerAt(host,'testservice');
    assert.equal(helper.environment(),'production',host);
    const blob='rc1059/production/aa/'+('a'.repeat(64));
    assert.match(helper.endpoint({blobName:blob}),/environment=production$/);
  }
});
test('P0 TESTSERVICE documents retain isolated TESTSERVICE scope',()=>{
  assert.equal(viewerAt('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net','testservice').environment(),'testservice');
});
test('P0 Pack PDF errors show safe actionable HTTP/auth/PDF category without exposing token or blob path',()=>{
  const classify=detail();
  assert.equal(classify(new Error('Lieferschein konnte nicht geladen werden (HTTP 404)')),' (HTTP 404)');
  assert.equal(classify({code:'DOCUMENT_API_LOGIN_REDIRECT',message:'redirect'}),' (DOCUMENT_API_LOGIN_REDIRECT)');
  assert.equal(classify({code:'DOCUMENT_NOT_PDF',message:'invalid signature'}),' (DOCUMENT_NOT_PDF)');
  assert.equal(classify(new Error('ExportHUB login required.')),' (ExportHUB login required)');
  assert.equal(classify(new Error('Invalid ExportHUB document reference')),' (Invalid ExportHUB document reference)');
  assert.equal(classify(new Error('Original document is unavailable')),' (Document unavailable)');
  assert.equal(classify(new Error('Authorization: Bearer SECRET rc1059/production/aa/SENSITIVE')),'');
});
