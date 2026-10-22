import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const pickup=fs.readFileSync('pickup.html','utf8');
const store=fs.readFileSync('api/shared/pickup-store.js','utf8');
const status=fs.readFileSync('api/pickup-status/index.js','utf8');
const confirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1379 P0: QR-Abholung zeigt bei vorhandenem oder abgeschlossenem ABD die Pflichtbestaetigung',()=>{
  assert.match(pickup,/id="customsDocumentsField" hidden/);
  assert.match(pickup,/id="customsDocumentsConfirmed" type="checkbox"/);
  assert.match(pickup,/function customsDocumentsConfirmationNeeded\(data\)/);
  assert.match(pickup,/data\.customsDocumentsConfirmationRequired===true\|\|data\.abdPresent===true/);
  assert.match(pickup,/abgeschlossen/);
  assert.match(pickup,/customsDocumentsRequired=customsDocumentsConfirmationNeeded\(data\)/);
  assert.doesNotMatch(pickup,/customsSignatureField|customsSignatureOpen|customsSignatureData/);
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
  // Retain mandatory ABD even when an older QR snapshot has no ABD fields.
  // The pickup must only accept a stored document, never a stale status label.
  assert.match(block,/record&&record\.abdRequired===true/);
  assert.match(block,/matchingShipments\.some\(x=>x\.abdRequired===true/);
  assert.match(block,/requests\.length>0/);
  assert.match(block,/matchingShipments\.concat\(requests,\[record\]\)/);
  assert.match(block,/await rc1622StoredAbd\(candidate,documents,c\.environment,verifiedCache\)/);
  assert.doesNotMatch(block,/const present=abdPresent\(sh\)/);
});

test('RC1378 P0: abgeschlossene ABD-Anfrage mit generischem status wird serverseitig wie in der UI erkannt',()=>{
  const start=store.indexOf('async function resolveShipmentAbdConfig');
  const end=store.indexOf('function mergeContainerPhotos',start);
  assert.ok(start>=0&&end>start);
  const block=store.slice(start,end);
  // A completed request is found by shipment identity but cannot authorize
  // pickup without a real attached ABD (see functional RC1622 test cases).
  assert.match(block,/requests=\(Array\.isArray\(state\.abdRequests\)/);
  assert.match(block,/\.filter\(sameRequest\)/,'ABD-Anfragen müssen über linkedShipmentId oder Referenz widerspruchsfrei zugeordnet werden');
  assert.match(block,/shipments\.filter\(sameShipment\)/,'Sendungen benötigen eine widerspruchsfreie ID-/Referenzzuordnung');
  assert.match(block,/req=requests\.length\?requests\[requests\.length-1\]:null/);
assert.match(block,/matchingShipments\.concat\(requests,\[record\]\)/);
  assert.match(block,/await rc1622StoredAbd\(candidate,documents,c\.environment,verifiedCache\)/);
  assert.match(block,/abdStatus:sanitizeText\(first\(req\|\|sh\|\|record/);
  assert.doesNotMatch(block,/const reqPresent=abdPresent\(req\)/);
});

test('RC1377 P0: ältere ABD-Datenform wird bei bestehenden Sendungen erkannt',()=>{
  const start=store.indexOf('function abdPresent(source)');
  const end=store.indexOf('async function resolveShipmentAbdConfig',start);
  const block=store.slice(start,end);
  assert.match(block,/legacyAbd=source\.abd/);
  assert.match(block,/typeof legacyAbd==='object'/);
});

test('RC1379 P0: Abschluss bleibt ohne ABD-Uebergabebestaetigung gesperrt, aber ohne zweite Unterschrift',()=>{
  assert.match(status,/resolveShipmentAbdConfig/);
  assert.match(confirm,/CUSTOMS_DOCUMENTS_CONFIRMATION_REQUIRED/);
  assert.match(confirm,/customsDocumentsReceived===true/);
  assert.match(confirm,/customsDocumentsConfirmed===true/);
  assert.doesNotMatch(confirm,/CUSTOMS_SIGNATURE_REQUIRED|saveCustomsDocumentsSignature\(clients|customsDocumentsSignatureDataUrl/);
  assert.match(pickup,/customsDocumentsRequired&&!customsConfirmed/);
});

test('RC1379: geänderte QR-Pickup-Dateien bleiben syntaktisch gültig',()=>{
  for(const file of ['api/shared/pickup-store.js','api/pickup-status/index.js','api/pickup-confirm-v2/index.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
  const scripts=[...pickup.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  assert.ok(scripts.length>0,'Pickup-Script fehlt');
  for(const script of scripts)new Function(script);
});
