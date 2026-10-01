import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const pickup=fs.readFileSync('pickup.html','utf8');
const store=fs.readFileSync('api/shared/pickup-store.js','utf8');
const status=fs.readFileSync('api/pickup-status/index.js','utf8');
const confirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1356 P0: QR-Abholung zeigt Zoll-Unterschrift bei vorhandenem oder abgeschlossenem ABD',()=>{
  assert.match(pickup,/id="customsSignatureField" hidden/);
  assert.match(pickup,/Zolldokumente erhalten[^<]*Unterschrift Fahrer/);
  assert.match(pickup,/function customsSignatureNeeded\(data\)/);
  assert.match(pickup,/customsDocumentsSignatureRequired===true\|\|data\.abdPresent===true/);
  assert.match(pickup,/abgeschlossen/);
  assert.match(pickup,/customsSignatureRequired=customsSignatureNeeded\(data\)/);
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

test('RC1356 P0: Abschluss bleibt ohne Zoll-Unterschrift gesperrt und speichert sie mit',()=>{
  assert.match(status,/resolveShipmentAbdConfig/);
  assert.match(confirm,/CUSTOMS_SIGNATURE_REQUIRED/);
  assert.match(confirm,/customsDocumentsSignatureDataUrl/);
  assert.match(confirm,/saveCustomsDocumentsSignature/);
  assert.match(pickup,/customsSignatureRequired&&!\/\^data:image/);
});

test('RC1356: geänderte QR-Pickup-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/shared/pickup-store.js','api/pickup-status/index.js','api/pickup-confirm-v2/index.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
  const scripts=[...pickup.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  assert.ok(scripts.length>0,'Pickup-Script fehlt');
  for(const script of scripts)new Function(script);
});
