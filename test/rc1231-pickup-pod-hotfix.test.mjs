import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const read=(path)=>fs.readFileSync(path,'utf8');
const pickupStore=read('api/shared/pickup-store.js');
const podArchive=read('api/shared/pod-archive.js');
const documentApi=read('api/exporthub-document/index.js');
const documentHelper=read('assets/rc1059-document-blob.js');

test('RC1231: QR-Abholung initialisiert nur den primaeren Pickup-Speicher',()=>{
  const start=pickupStore.indexOf("async function clients(environment='production')");
  const end=pickupStore.indexOf("async function podArchiveClient",start);
  assert.ok(start>=0&&end>start,'clients()/podArchiveClient Trennung fehlt');
  const primary=pickupStore.slice(start,end);
  assert.doesNotMatch(primary,/backupConnectionString|POD_BACKUP_CONTAINER|podArchive|backupService/);
  assert.match(primary,/records\.createIfNotExists\(\)/);
  assert.match(primary,/pods\.createIfNotExists\(\)/);
  assert.match(primary,/team\.createIfNotExists\(\)/);
});

test('RC1231: POD-Archiv wird nur bei echter Backup-Arbeit initialisiert',()=>{
  assert.match(pickupStore,/async function podArchiveClient\(environment='production'\)/);
  assert.match(pickupStore,/podArchive\.createIfNotExists\(\)/);
  assert.match(pickupStore,/module\.exports=\{[^}]*podArchiveClient/);
  assert.match(podArchive,/await store\.podArchiveClient\(environment\)/);
  assert.match(podArchive,/await store\.podArchiveClient\(clients && clients\.environment \|\| record && record\.environment \|\| 'production'\)/);
  assert.doesNotMatch(podArchive,/got\.clients\.podArchive/);
});

test('RC1231: interner Dokument-Endpunkt erlaubt nur automatische POD-PDFs aus dem Pickup-Speicher',()=>{
  assert.match(documentApi,/await auth\.validateSession\(req\)/);
  assert.match(documentApi,/function validPickupPodBlobName/);
  assert.match(documentApi,/\/automatic\\\/\[\^\/\]\+\\\.pdf/);
  assert.match(documentApi,/pickupStore\.POD_CONTAINER/);
  assert.match(documentApi,/validPickupPodBlobName\(blobName\)\?pickupStore\.POD_CONTAINER:DOCUMENT_CONTAINER/);
});

test('RC1231: Browser-Viewer erkennt signierte automatische POD-Ladelisten, aber keine Fahrer-Signaturdateien',()=>{
  const window={
    location:{hostname:'wonderful-forest-0f315e310.7.azurestaticapps.net'},
    ExportHUBClean:{runtime:{environment:'production',authToken:'test-token'}},
    fetch:async()=>{throw new Error('not called')},
    URL:{},
    setTimeout:()=>{}
  };
  const context=vm.createContext({window,URL});
  vm.runInContext(documentHelper,context);
  const api=window.ExportHUBDocumentBlob1059;
  const key='a'.repeat(64);
  assert.equal(api.isBlobDocument({storage:'azure',blobName:`rc995/production/${key}/automatic/POD_REF123.pdf`}),true);
  assert.equal(api.isBlobDocument({storage:'pod',storageBlobName:`rc995/production/${key}/automatic/POD_REF123.pdf`}),true);
  assert.equal(api.isBlobDocument({storage:'azure',blobName:`rc995/production/${key}/driver-signature-1.jpg`}),false);
  assert.equal(api.endpoint({storage:'azure',blobName:`rc995/production/${key}/automatic/POD_REF123.pdf`}),`/api/exporthub-document?blob=rc995%2Fproduction%2F${key}%2Fautomatic%2FPOD_REF123.pdf&environment=production`);
});

test('RC1231: geaenderte Runtime-Dateien bleiben syntaktisch gueltig',()=>{
  for(const path of [
    'api/shared/pickup-store.js',
    'api/shared/pod-archive.js',
    'api/exporthub-document/index.js',
    'assets/rc1059-document-blob.js'
  ]){
    execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
  }
});
