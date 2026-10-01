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

test('RC1385: ABD zeigt auf der Abholseite nur noch eine Pflicht-Bestätigung statt einer zweiten Unterschrift',()=>{
  assert.match(pickup,/id="customsDocumentsField" class="customs-confirm" hidden/);
  assert.match(pickup,/id="customsDocumentsReceived" type="checkbox"/);
  assert.match(pickup,/Zolldokumente übergeben/);
  assert.match(pickup,/data\.customsDocumentsConfirmationRequired===true\|\|data\.abdPresent===true/);
  assert.match(pickup,/customsDocumentsRequired&&!customsConfirmed/);
  assert.doesNotMatch(pickup,/customsSignatureOpen|customsSignatureData|customsSignaturePreview|customsSignatureSaved/);
  assert.match(status,/resolveShipmentAbdConfig/);
});

test('RC1385: ABD-Erkennung basiert weiterhin auf tatsächlich erzeugtem Dokument',()=>{
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

test('RC1385: API erzwingt die Zollübergabe als boolesche Bestätigung und speichert keine zweite Signatur',()=>{
  assert.match(confirm,/CUSTOMS_DOCUMENTS_CONFIRMATION_REQUIRED/);
  assert.match(confirm,/customsDocumentsReceived/);
  assert.match(confirm,/customsDocumentsConfirmedAt/);
  assert.match(confirm,/abdPresent&&!customsConfirmed/);
  assert.doesNotMatch(confirm,/customsDocumentsSignatureDataUrl|abdHandoverSignatureDataUrl|saveCustomsDocumentsSignature|CUSTOMS_SIGNATURE_REQUIRED/);
  assert.match(store,/customsDocumentsConfirmationRequired:abd/);
  const publicStart=store.indexOf('function publicRecord');
  const publicEnd=store.indexOf('function parseSignature',publicStart);
  const publicBlock=store.slice(publicStart,publicEnd);
  assert.doesNotMatch(publicBlock,/customsDocumentsSignatureRequired|customsDocumentsSignatureStored/);
  assert.doesNotMatch(store,/async function saveCustomsDocumentsSignature/);
});

test('RC1385: Ladeliste und automatischer POD enthalten ausschließlich die normale Fahrerunterschrift',()=>{
  assert.match(loadingList,/var signature=safeSignatureSource/);
  assert.match(loadingList,/var signHtml=signature\?'<img class="rc1305-signature-image"/);
  assert.match(loadingList,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(loadingList,/rc1305-pickup-signature\{grid-column:span 2!important/);
  assert.doesNotMatch(loadingList,/customsSignatureUrl|ensureCustomsSignatureField|data-rc1315-customs-signature|rc1305-signature-customs/);
  assert.match(podArchive,/heading\('Fahrerunterschrift'\)/);
  assert.doesNotMatch(podArchive,/heading\('Zolldokumente erhalten'\)|customsSignatureBuffer|customsSignatureType/);
  assert.doesNotMatch(pickupPod,/wantCustomsSignature|customsDocumentsSignatureBlobName/);
});

test('RC1385: API-Übersetzungen beschreiben eine Bestätigung und keine zweite Unterschrift',()=>{
  for(const lang of ['de','en','pl','es','fr','it']){
    const api=JSON.parse(fs.readFileSync('api/shared/i18n/'+lang+'.json','utf8'));
    const message=api['api.pickup.customsDocumentsConfirmationRequired'];
    assert.ok(message,lang+' Bestätigungstext fehlt');
    assert.ok(!api['api.pickup.customsSignatureRequired'],lang+' alter Signature-Key darf nicht mehr aktiv sein');
    assert.doesNotMatch(message,/zweite|second|drugim|segunda|deuxième|seconda/i);
  }
});

test('RC1385: geänderte JavaScript-Dateien sind syntaktisch gültig',()=>{
  for(const file of ['api/shared/pickup-store.js','api/pickup-status/index.js','api/pickup-init/index.js','api/pickup-confirm-v2/index.js','api/pickup-pod/index.js','assets/rc1305-loading-list-print.js','api/shared/pod-archive.js']){
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
