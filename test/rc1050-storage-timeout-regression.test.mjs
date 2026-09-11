import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/shared/blob-rest.js','utf8');

test('RC1050: Azure Blob Requests bekommen ausreichend Zeit für große Team-State Writes',()=>{
  const m=source.match(/const STORAGE_TIMEOUT_MS\s*=\s*Math\.max\(5000,\s*Math\.min\((\d+),\s*Number\(process\.env\.EXPORTHUB_STORAGE_TIMEOUT_MS\s*\|\|\s*(\d+)\)\)\);/);
  assert.ok(m,'STORAGE_TIMEOUT_MS Konfiguration wurde nicht gefunden');
  assert.ok(Number(m[1])>=30000,'konfigurierbares Maximum muss mindestens 30 Sekunden zulassen');
  assert.ok(Number(m[2])>=20000,'Standard-Timeout muss mindestens 20 Sekunden betragen');
});

test('RC1050: Storage Timeout bleibt über EXPORTHUB_STORAGE_TIMEOUT_MS konfigurierbar',()=>{
  assert.match(source,/process\.env\.EXPORTHUB_STORAGE_TIMEOUT_MS/);
});
