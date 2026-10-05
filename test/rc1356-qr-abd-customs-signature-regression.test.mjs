import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const pickup=fs.readFileSync('pickup.html','utf8');
const publicRuntime=fs.readFileSync('assets/rc1018-public-language.js','utf8');
const store=fs.readFileSync('api/shared/pickup-store.js','utf8');
const status=fs.readFileSync('api/pickup-status/index.js','utf8');
const confirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');
const pod=fs.readFileSync('api/shared/pod-archive-rc1432.js','utf8');

test('RC1432 P1: QR-Abholung zeigt bei vorhandenem oder abgeschlossenem ABD die zweite Fahrerunterschrift',()=>{
  assert.match(pickup,/id="customsDocumentsField" hidden/);
  assert.match(pickup,/function customsDocumentsConfirmationNeeded\(data\)/);
  assert.match(pickup,/data\.customsDocumentsConfirmationRequired===true\|\|data\.abdPresent===true/);
  assert.match(pickup,/abgeschlossen/);
  assert.match(pickup,/customsDocumentsRequired=customsDocumentsConfirmationNeeded\(data\)/);
  assert.match(publicRuntime,/customsSignatureOpen/);
  assert.match(publicRuntime,/customsSignatureData/);
  assert.match(publicRuntime,/customsDocumentsSignatureDataUrl/);
  assert.match(publicRuntime,/Zolldokumente erhalten/);
});

test('RC1356 P0: abgeschlossener ABD-Status gilt serverseitig als tatsächlich vorhandenes ABD',()=>{
  const start=store.indexOf('function abdPresent(source)');
  const end=store.indexOf('async function resolveShipmentAbdConfig',start);
  assert.ok(start>=0&&end>start,'abdPresent konnte nicht isoliert werden');
  const block=store.slice(start,end);
  assert.match(block,/abgeschlossen/);
  assert.match(block,/wartet\|offen\|pending\|angefordert\|requested/);
  assert.match(store,/abdStatus:sanitizeText\(r\.abdStatus\|\|''/);
});

test('RC1377 P0: bestehende QR-Sendung behält ABD-Pflicht auch wenn Live-Sendung keine ABD-Felder mehr liefert',()=>{
  const start=store.indexOf('async function resolveShipmentAbdConfig');
  const end=store.indexOf('function mergeContainerPhotos',start);
  assert.ok(start>=0&&end>start,'ABD-Resolver konnte nicht isoliert werden');
  const block=store.slice(start,end);
  assert.match(block,/abdPresent\(sh\)\|\|reqPresent\|\|abdPresent\(record\)/);
  assert.doesNotMatch(block,/found\?\(abdPresent\(sh\)\|\|abdPresent\(req\)\):abdPresent\(record\)/);
});

test('RC1378 P0: abgeschlossene ABD-Anfrage mit generischem status wird serverseitig wie in der UI erkannt',()=>{
  const start=store.indexOf('async function resolveShipmentAbdConfig');
  const end=store.indexOf('function mergeContainerPhotos',start);
  const block=store.slice(start,end);
  assert.match(block,/first\(req,\['abdStatus','status','state'\]\)/);
  assert.match(block,/const reqPresent=abdPresent\(req\)\|\|/);
  assert.match(block,/completed\|done\|available\|erstellt\|created\|abgeschlossen/);
  assert.match(block,/const present=abdPresent\(sh\)\|\|reqPresent\|\|abdPresent\(record\)/);
});

test('RC1377 P0: ältere ABD-Datenform wird bei bestehenden Sendungen erkannt',()=>{
  const start=store.indexOf('function abdPresent(source)');
  const end=store.indexOf('async function resolveShipmentAbdConfig',start);
  const block=store.slice(start,end);
  assert.match(block,/legacyAbd=source\.abd/);
  assert.match(block,/typeof legacyAbd==='object'/);
});

test('RC1432 P1: Abschluss bleibt ohne zweite ABD-Unterschrift gesperrt und speichert sie sicher',()=>{
  assert.match(status,/resolveShipmentAbdConfig/);
  assert.match(confirm,/CUSTOMS_SIGNATURE_REQUIRED/);
  assert.match(confirm,/saveCustomsDocumentsSignature\(clients/);
  assert.match(confirm,/customsDocumentsSignatureDataUrl/);
  assert.match(confirm,/customsDocumentsSignatureStored:true/);
  assert.match(publicRuntime,/abdHandoverSignatureDataUrl/);
  assert.match(pod,/customsDocumentsSignatureBlobName/);
});

test('RC1432: geänderte QR-Pickup-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/shared/pickup-store.js','api/pickup-status/index.js','api/pickup-confirm-v2/index.js','assets/rc1018-public-language.js','api/shared/pod-archive-rc1432.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
  const scripts=[...pickup.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  assert.ok(scripts.length>0,'Pickup-Script fehlt');
  for(const script of scripts)new Function(script);
});
