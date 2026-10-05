import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1435 Pickup: POD-Archive bleiben hinter einem nicht ausgeführten Lazy-Selector',()=>{
  const beforeHandler=source.slice(0,source.indexOf('module.exports=async function'));
  assert.match(beforeHandler,/function podArchiveFor\(record\)\{const base=require\(['"]\.\.\/shared\/pod-archive['"]\)/);
  assert.match(beforeHandler,/return require\(['"]\.\.\/shared\/pod-archive-rc1432['"]\)/);
  const withoutSelector=beforeHandler.replace(/function podArchiveFor\(record\)\{[^\n]*\}/,'');
  assert.doesNotMatch(withoutSelector,/require\(['"]\.\.\/shared\/pod-archive(?:-rc1432)?['"]\)/,'POD-Archive dürfen außerhalb des Lazy-Selectors nicht beim Modulimport geladen werden');
  assert.doesNotMatch(beforeHandler,/podArchiveFor\s*\(/g&&/^$/,'');
});

test('RC1435 Pickup: POD-Selector wird ausschließlich in vollständigen Abholpfaden aufgerufen',()=>{
  const calls=source.match(/podArchive=podArchiveFor\(rec\)/g)||[];
  assert.equal(calls.length,2,'POD-Selector darf nur im Recovery-Complete- und Complete-Pfad aufgerufen werden');
  const recoveryStart=source.indexOf("if(completeOf(current)||current.status==='confirmed'){");
  const recoveryEnd=source.indexOf("const signature=",recoveryStart);
  assert.ok(recoveryStart>=0&&recoveryEnd>recoveryStart,'Recovery-Complete-Pfad fehlt');
  assert.match(source.slice(recoveryStart,recoveryEnd),/podArchive=podArchiveFor\(rec\)/);
  const archiveStart=source.indexOf("let archiveResult=null,archiveFailure='',podArchive=null;");
  const completeStart=source.indexOf('if(complete){',archiveStart);
  const completeEnd=source.indexOf('const backup=',completeStart);
  assert.ok(archiveStart>=0&&completeStart>archiveStart&&completeEnd>completeStart,'vollständiger POD-Pfad fehlt');
  const block=source.slice(completeStart,completeEnd);
  assert.match(block,/podArchive=podArchiveFor\(rec\)/);
  assert.match(block,/ensureAutomaticPod/);
  assert.match(source,/podArchive&&typeof podArchive\.automaticPod==='function'/);
});

test('RC1435 Pickup: ABD wählt das Zwei-Signatur-POD, Nicht-ABD bleibt beim Standard-POD',()=>{
  const start=source.indexOf('function podArchiveFor(record)');
  const end=source.indexOf('module.exports=async function',start);
  assert.ok(start>=0&&end>start,'POD-Selector fehlt');
  const selector=source.slice(start,end);
  assert.match(selector,/const base=require\(['"]\.\.\/shared\/pod-archive['"]\)/);
  assert.match(selector,/store\.abdPresent\(record\)/);
  assert.match(selector,/record\.abdPresent===true/);
  assert.match(selector,/return require\(['"]\.\.\/shared\/pod-archive-rc1432['"]\)/);
  assert.match(selector,/return base/);
});
