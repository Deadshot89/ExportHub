import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadHelper(){
  const source=fs.readFileSync(new URL('../assets/rc1059-document-blob.js',import.meta.url),'utf8');
  const calls=[];
  const context={
    window:{ExportHUBClean:{runtime:{authToken:'TOKEN-1059'}},location:{hostname:'wonderful-forest-0f315e310.7.azurestaticapps.net'}},
    fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200,async blob(){return new Blob(['PDF'],{type:'application/pdf'})}}},
    Blob,
    URL:{createObjectURL(){return'blob:rc1059'},revokeObjectURL(){}},
    document:{body:{appendChild(){}},createElement(){return{click(){},remove(){},set href(v){this._href=v},get href(){return this._href}}}},
    setTimeout(){},
    console
  };
  context.window.window=context.window;
  context.window.fetch=context.fetch;
  context.window.URL=context.URL;
  context.window.document=context.document;
  context.window.setTimeout=context.setTimeout;
  vm.createContext(context);
  vm.runInContext(source,context);
  return{api:context.window.ExportHUBDocumentBlob1059,calls};
}

const hash='b'.repeat(64);

test('RC1059: Browser erkennt Blob-Dokument und behält Legacy-URL unverändert',()=>{
  const {api}=loadHelper();
  const blobDoc={storage:'blob',blobName:`rc1059/production/bb/${hash}`};
  assert.equal(api.isBlobDocument(blobDoc),true);
  assert.equal(api.legacyUrl({data:'data:application/pdf;base64,QUJD'}),'data:application/pdf;base64,QUJD');
  assert.equal(api.legacyUrl(blobDoc),'');
});

test('RC1059: Blob-Dokument wird mit ExportHUB-Session über geschützten Endpoint geladen',async()=>{
  const {api,calls}=loadHelper();
  const file={storage:'blob',blobName:`rc1059/production/bb/${hash}`,name:'LS.pdf'};
  const blob=await api.fetchBlob(file);
  assert.equal(blob.size,3);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/api\/exporthub-document\?blob=/);
  assert.match(calls[0].url,/environment=production/);
  assert.equal(calls[0].options.headers.Authorization,'Bearer TOKEN-1059');
  assert.equal(calls[0].options.cache,'no-store');
});

test('RC1059: index bindet gemeinsamen Blob-Helper vor den Dokumentpfaden ein',()=>{
  const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(source,/assets\/rc1059-document-blob\.js/);
  assert.match(source,/ExportHUBDocumentBlob1059/);
  assert.match(source,/overviewPodEvidence[\s\S]{0,1500}storage\s*===\s*['"]blob['"]/);
});

test('RC1059: ZIP-Pfad unterstützt asynchron geladene Blob-Dokumente',()=>{
  const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(source,/rc542DownloadShipmentZip\s*=\s*async function/);
  assert.match(source,/ExportHUBDocumentBlob1059[\s\S]{0,3000}fetchBytes|fetchBytes[\s\S]{0,3000}ExportHUBDocumentBlob1059/);
});
