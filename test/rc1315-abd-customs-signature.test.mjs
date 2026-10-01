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

test('RC1379: ABD zeigt auf der Abholseite nur noch eine Pflichtbestaetigung statt zweiter Unterschrift',()=>{
  assert.match(pickup,/id="customsDocumentsField" hidden/);
  assert.match(pickup,/id="customsDocumentsConfirmed" type="checkbox"/);
  assert.match(pickup,/Zolldokumente wurden an den Fahrer übergeben/);
  assert.match(pickup,/function customsDocumentsConfirmationNeeded\(data\)/);
  assert.match(pickup,/customsDocumentsRequired=customsDocumentsConfirmationNeeded\(data\)/);
  assert.doesNotMatch(pickup,/customsSignatureField|customsSignatureOpen|customsSignatureData|customsSignaturePreview/);
});

test('RC1379: ABD-Erkennung basiert weiter auf erzeugtem Dokument und nicht nur auf ABD-Pflicht',()=>{
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

test('RC1379: API erzwingt die ABD-Uebergabebestaetigung ohne zweite Unterschrift',()=>{
  assert.match(confirm,/CUSTOMS_DOCUMENTS_CONFIRMATION_REQUIRED/);
  assert.match(confirm,/customsDocumentsReceived===true/);
  assert.match(confirm,/customsDocumentsConfirmed===true/);
  assert.match(confirm,/abdDocumentsHandedOver===true/);
  assert.doesNotMatch(confirm,/CUSTOMS_SIGNATURE_REQUIRED/);
  assert.doesNotMatch(confirm,/saveCustomsDocumentsSignature\(clients/);
  assert.doesNotMatch(confirm,/customsDocumentsSignatureDataUrl/);
  assert.match(store,/customsDocumentsConfirmationRequired:abd/);
  assert.match(store,/customsDocumentsSignatureRequired:false/);
});

test('RC1379: POD-Ladeliste zeigt wieder genau eine Fahrerunterschrift mit Verlader und Kennzeichen',()=>{
  assert.match(loadingList,/rc1305-meta-loader/);
  assert.match(loadingList,/rc1305-meta-plate/);
  assert.match(loadingList,/rc1305-signature-primary/);
  assert.match(loadingList,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(loadingList,/grid-column:span 3!important/);
  assert.doesNotMatch(loadingList,/rc1305-signature-customs/);
  assert.doesNotMatch(loadingList,/data-rc1315-customs-signature/);
  assert.doesNotMatch(loadingList,/ensureCustomsSignatureField/);
});

test('RC1379: automatischer POD enthaelt keine zweite Zoll-Unterschrift mehr',()=>{
  assert.doesNotMatch(podArchive,/heading\('Zolldokumente erhalten'\)/);
  assert.doesNotMatch(podArchive,/customsSignatureBuffer|customsSignatureType/);
  assert.match(podArchive,/createPodPdf\(record, signatureBuffer, signatureType\)/);
});

test('RC1379: API-Texte verlangen nur noch die Uebergabebestaetigung',()=>{
  for(const lang of ['de','en','pl','es','fr','it']){
    const api=JSON.parse(fs.readFileSync('api/shared/i18n/'+lang+'.json','utf8'));
    const value=String(api['api.pickup.customsSignatureRequired']||'');
    assert.ok(value,lang+' API-Text fehlt');
    assert.doesNotMatch(value,/zweite.*unterschrift|second.*signature|deuxième.*signature|segunda.*firma|seconda.*firma|drugim.*podpisem/i);
  }
});

test('RC1379: geaenderte Pickup- und POD-Dateien sind syntaktisch gueltig',()=>{
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

test('RC1318: unterschriebene Ladelisten bleiben auch nach technischer Pickup-Sperre lesbar',()=>{
  assert.match(publicAccess,/allowUsedPickupDocument=false/);
  assert.match(publicAccess,/usedPickupDocument=record\.kind==='pickup'&&allowUsed===true&&allowUsedPickupDocument===true&&!!record\.usedAt/);
  assert.match(publicAccess,/!usedPickupDocument\)throw error\('ACCESS_REVOKED'/);
  assert.match(pickupPod,/allowUsed:true,allowUsedPickupDocument:true/);
});
