import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const pickup=fs.readFileSync('pickup.html','utf8');
const confirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');
const status=fs.readFileSync('api/pickup-status/index.js','utf8');
const init=fs.readFileSync('api/pickup-init/index.js','utf8');
const store=fs.readFileSync('api/shared/pickup-store.js','utf8');
const loadingList=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const podArchive=fs.readFileSync('api/shared/pod-archive.js','utf8');
const publicAccess=fs.readFileSync('api/shared/public-access-store.js','utf8');
const pickupPod=fs.readFileSync('api/pickup-pod/index.js','utf8');

test('RC1315: zweite Fahrerunterschrift erscheint nur bei tatsächlich vorhandenem ABD',()=>{
  assert.match(pickup,/id="customsSignatureField" hidden/);
  assert.match(pickup,/Zolldokumente erhalten/);
  assert.match(pickup,/data\.customsDocumentsSignatureRequired===true\|\|data\.abdPresent===true/);
  assert.match(pickup,/customsField\.hidden=!customsSignatureRequired/);
  assert.match(pickup,/customsSignatureRequired&&!\/\^data:image/);
  assert.match(status,/resolveShipmentAbdConfig/);
});

test('RC1315: ABD-Erkennung basiert auf erzeugtem Dokument und nicht nur auf ABD-Pflicht',()=>{
  const start=store.indexOf('function abdPresent(source)');
  const end=store.indexOf('async function resolveShipmentAbdConfig',start);
  assert.ok(start>=0&&end>start,'abdPresent konnte nicht isoliert werden');
  const block=store.slice(start,end);
  assert.match(block,/abdFiles/);
  assert.match(block,/abdRef/);
  assert.match(block,/erstellt\|created/);
  assert.doesNotMatch(block,/abdRequired/);
  assert.match(init,/abdPresent:typeof store\.abdPresent/);
});

test('RC1315: API erzwingt und speichert Zollübergabe serverseitig',()=>{
  assert.match(confirm,/CUSTOMS_SIGNATURE_REQUIRED/);
  assert.match(confirm,/customsDocumentsSignatureDataUrl/);
  assert.match(confirm,/saveCustomsDocumentsSignature/);
  assert.match(confirm,/customsDocumentsReceived:abdPresent/);
  assert.match(store,/customs-documents-signature-/);
  assert.match(store,/kind:'customs-documents-receipt-signature'/);
  assert.match(store,/customsDocumentsSignatureBlobName/);
});

test('RC1315: Ladeliste und automatischer POD zeigen den Zollnachweis',()=>{
  assert.match(loadingList,/loadingListPrint\.customsDocumentsReceived/);
  assert.match(loadingList,/data-rc1315-customs-signature="1"/);
  assert.match(loadingList,/customsDocumentsSignatureBlobName/);
  assert.match(podArchive,/heading\('Zolldokumente erhalten'\)/);
  assert.match(podArchive,/record\.customsDocumentsSignatureBlobName/);
});

test('RC1315: beide Fahrerunterschriften sind als kompakter A4-Block nebeneinander begrenzt',()=>{
  assert.match(loadingList,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(loadingList,/data-rc1315-customs-required/);
  assert.match(loadingList,/rc1305-signature-primary/);
  assert.match(loadingList,/rc1305-signature-customs/);
  assert.match(loadingList,/grid-column:span 3!important/);
  assert.match(loadingList,/height:16\.5mm!important/);
  assert.match(loadingList,/max-height:9\.5mm!important/);
  assert.match(loadingList,/overflow:hidden!important/);
  assert.match(loadingList,/customsSignatureUrl/);
  assert.match(loadingList,/customsSignature','1/);
});

test('RC1315: Übersetzungsdateien enthalten den neuen Ladelisten- und API-Text',()=>{
  for(const lang of ['de','en','pl','es','fr','it']){
    const client=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    const api=JSON.parse(fs.readFileSync('api/shared/i18n/'+lang+'.json','utf8'));
    assert.ok(client['loadingListPrint.customsDocumentsReceived'],lang+' Ladelisten-Text fehlt');
    assert.ok(api['api.pickup.customsSignatureRequired'],lang+' API-Text fehlt');
  }
});

test('RC1315: geänderte JavaScript-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['api/shared/pickup-store.js','api/pickup-status/index.js','api/pickup-init/index.js','api/pickup-confirm-v2/index.js','assets/rc1305-loading-list-print.js','api/shared/pod-archive.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
  const scripts=[...pickup.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  assert.ok(scripts.length>0,'Pickup-Script fehlt');
  for(const script of scripts)new Function(script);
});


test('RC1316: bestätigte Pickup-PODs und Unterschriften bleiben nach Linkablauf lesbar',()=>{
  assert.match(publicAccess,/record\.kind==='pickup'&&allowUsed&&record\.usedAt/);
  assert.match(publicAccess,/ACCESS_EXPIRED/);
});


test('RC1317: fehlende primäre POD-Unterschrift wird aus revisionssicherem Archiv geladen',()=>{
  assert.match(pickupPod,/store\.podArchiveClient\(resolved\.environment\)/);
  assert.match(pickupPod,/archive\.podArchive\.getBlobClient\(blobName\)/);
  assert.match(pickupPod,/store\.readBuffer\(archiveBlob\)/);
});
