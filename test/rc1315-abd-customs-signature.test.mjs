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
const podArchive1432=fs.readFileSync('api/shared/pod-archive-rc1432.js','utf8');
const publicRuntime=fs.readFileSync('assets/rc1018-public-language.js','utf8');
const publicAccess=fs.readFileSync('api/shared/public-access-store.js','utf8');
const pickupPod=fs.readFileSync('api/pickup-pod/index.js','utf8');

test('RC1432: ABD zeigt auf der Abholseite wieder die zweite Fahrerunterschrift',()=>{
  assert.match(pickup,/id="customsDocumentsField" hidden/);
  assert.match(pickup,/function customsDocumentsConfirmationNeeded\(data\)/);
  assert.match(pickup,/customsDocumentsRequired=customsDocumentsConfirmationNeeded\(data\)/);
  assert.match(publicRuntime,/customsSignatureOpen/);
  assert.match(publicRuntime,/customsSignatureData/);
  assert.match(publicRuntime,/customsSignaturePreview/);
  assert.match(publicRuntime,/Zolldokumente erhalten/);
});

test('RC1432: ABD-Erkennung basiert weiter auf erzeugtem Dokument und nicht nur auf ABD-Pflicht',()=>{
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

test('RC1432: API erzwingt und speichert die zweite ABD-Fahrerunterschrift',()=>{
  assert.match(confirm,/CUSTOMS_SIGNATURE_REQUIRED/);
  assert.match(confirm,/customsDocumentsSignatureDataUrl/);
  assert.match(confirm,/abdHandoverSignatureDataUrl/);
  assert.match(confirm,/saveCustomsDocumentsSignature\(clients/);
  assert.match(confirm,/customsDocumentsSignatureStored:true/);
  assert.match(store,/async function saveCustomsDocumentsSignature/);
  assert.match(store,/customsDocumentsConfirmationRequired:abd/);
});

test('RC1432: POD-Ladeliste zeigt Fahrer- und Zollunterschrift kompakt nebeneinander',()=>{
  assert.match(loadingList,/rc1305-meta-loader/);
  assert.match(loadingList,/rc1305-meta-plate/);
  assert.match(loadingList,/rc1305-signature-primary/);
  assert.match(loadingList,/rc1305-signature-customs/);
  assert.match(loadingList,/data-rc1432-customs-signature/);
  assert.match(loadingList,/ensureCustomsSignatureField/);
  assert.match(loadingList,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(loadingList,/\.rc1305-pickup-signature\{grid-column:auto!important/);
});

test('RC1432: automatischer ABD-POD enthaelt beide Fahrerunterschriften ohne separate Zollseite',()=>{
  assert.match(podArchive1432,/Zolldokumente erhalten/);
  assert.match(podArchive1432,/customsSignatureBuffer/);
  assert.match(podArchive1432,/customsSignatureType/);
  assert.match(podArchive1432,/customsDocumentsSignatureBlobName/);
  assert.match(podArchive1432,/boxW=\(width-gap\)\/2/);
  assert.match(podArchive,/createPodPdf\(record, signatureBuffer, signatureType\)/);
});

test('RC1432: QR-Runtime erklaert die zweite ABD-Unterschrift in allen sechs Sprachen',()=>{
  for(const marker of ['de:','en:','pl:','es:','fr:','it:'])assert.match(publicRuntime,new RegExp(marker.replace(':','\\s*:\\s*\\{')));
  assert.match(publicRuntime,/zweiten Fahrerunterschrift/);
  assert.match(publicRuntime,/second signature/);
});

test('RC1432: geaenderte Pickup- und POD-Dateien sind syntaktisch gueltig',()=>{
  for(const file of ['api/shared/pickup-store.js','api/pickup-status/index.js','api/pickup-init/index.js','api/pickup-confirm-v2/index.js','assets/rc1018-public-language.js','assets/rc1305-loading-list-print.js','api/shared/pod-archive.js','api/shared/pod-archive-rc1432.js']){
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

test('RC1318: unterschriebene Ladelisten bleiben auch nach technischer Pickup-Sperre lesbar',()=>{
  assert.match(publicAccess,/allowUsedPickupDocument=false/);
  assert.match(publicAccess,/usedPickupDocument=record\.kind==='pickup'&&allowUsed===true&&allowUsedPickupDocument===true&&!!record\.usedAt/);
  assert.match(publicAccess,/!usedPickupDocument\)throw error\('ACCESS_REVOKED'/);
  assert.match(pickupPod,/allowUsed:true,allowUsedPickupDocument:true/);
});
