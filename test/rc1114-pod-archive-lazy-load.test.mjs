import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1114 Pickup: POD-Archiv wird nicht mehr beim Modulimport geladen',()=>{
  const beforeHandler=source.slice(0,source.indexOf('module.exports=async function'));
  assert.doesNotMatch(beforeHandler,/require\(['"]\.\.\/shared\/pod-archive['"]\)/);
});

test('RC1114 Pickup: POD-Archiv wird nur im vollständigen Abholpfad geladen',()=>{
  const marker="if(complete){";
  const start=source.indexOf(marker,source.indexOf("let archiveResult"));
  assert.ok(start>=0,'vollständiger POD-Pfad fehlt');
  const block=source.slice(start,source.indexOf('const backup=',start));
  assert.match(block,/podArchive=require\(['"]\.\.\/shared\/pod-archive['"]\)/);
  assert.match(block,/ensureAutomaticPod/);
  assert.match(source,/podArchive&&typeof podArchive\.automaticPod==='function'/);
});
