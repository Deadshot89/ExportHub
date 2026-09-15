import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/shared/pod-archive.js','utf8');

test('RC1114 POD: pdf-lib wird nur beim tatsächlichen PDF-Erzeugen geladen',()=>{
  const before=source.slice(0,source.indexOf('async function createPodPdf'));
  assert.doesNotMatch(before,/require\(['"]pdf-lib['"]\)/,'pdf-lib darf den QR/PIN-Importpfad nicht mehr blockieren');
  const start=source.indexOf('async function createPodPdf');
  const end=source.indexOf('async function readAutomaticPodBuffer',start);
  const block=source.slice(start,end);
  assert.match(block,/require\(['"]pdf-lib['"]\)/);
  assert.match(block,/PDFDocument\.create\(\)/);
});

test('RC1114 POD: Azure-API deklariert pdf-lib weiterhin als Runtime-Abhängigkeit',()=>{
  const pkg=JSON.parse(fs.readFileSync('api/package.json','utf8'));
  assert.equal(pkg.dependencies['pdf-lib'],'1.17.1');
});
