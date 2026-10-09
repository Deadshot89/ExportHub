import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1460-shipment-view-files-avis-preview.js','utf8');
const loadingList=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');

test('RC1461: POD-Dateien werden in der Sendungsansicht als eigene sichtbare Kachel gerendert',()=>{
  assert.match(runtime,/data-exporthub-pod-tile/);
  assert.match(runtime,/POD · Abholnachweis/);
  assert.match(runtime,/data-exporthub-pod-file/);
  assert.match(runtime,/arr\(sh&&sh\.podFiles\)/);
  assert.match(runtime,/arr\(sh&&sh\.subShipments\)/);
  assert.match(runtime,/arr\(sub&&sub\.podFiles\)/);
});

test('RC1468: POD-Nachweis ist nur am Bildschirm einspaltig und überschreibt den A4-Druck nicht',()=>{
  assert.match(runtime,/@media screen\{\.rc1305-pickup-grid\{grid-template-columns:1fr!important/);
  assert.doesNotMatch(runtime,/@media print\{[\s\S]*?\.rc1305-pickup-grid\{grid-template-columns:1fr!important/);
  assert.match(loadingList,/@media print\{[\s\S]*?\.rc1305-pickup-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
});

test('RC1468: große Fahrerunterschrift bleibt Bildschirmdarstellung; A4 nutzt die kompakte RC1379-Signatur',()=>{
  assert.match(runtime,/@media screen\{[\s\S]*?\.rc1305-pickup-signature\{grid-column:1\/-1!important;min-height:46mm!important/);
  assert.match(runtime,/@media screen\{[\s\S]*?\.rc1305-signature-image\{[^}]*height:38mm!important;max-height:38mm!important/);
  assert.doesNotMatch(runtime,/@media print\{[\s\S]*?\.rc1305-signature-image\{[^}]*height:38mm!important/);
  assert.match(loadingList,/@media print\{[\s\S]*?\.rc1305-signature-image\{max-height:11mm!important/);
});

test('RC1468: Shipment-View-POD-Kachel selbst bleibt im Druck ausgeblendet',()=>{
  assert.match(runtime,/@media print\{\.exporthub-pod-proof-tile\{display:none!important\}\}/);
});

test('RC1461: Runtime bleibt syntaktisch gültig',()=>{
  const check=spawnSync(process.execPath,['--check','assets/rc1460-shipment-view-files-avis-preview.js'],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
});
