import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');

test('RC1435/RC1455 Pickup: Standard-POD-Archiv bleibt hinter einem nicht ausgeführten Lazy-Selector',()=>{
  const beforeHandler=source.slice(0,source.indexOf('module.exports=async function'));
  assert.match(beforeHandler,/function podArchiveFor\(\)\{return require\(['"]\.\.\/shared\/pod-archive['"]\)\}/);
  assert.doesNotMatch(beforeHandler,/pod-archive-rc1432/,'RC1455 darf den alten Zwei-Signatur-POD-Pfad nicht erneut laden');
  const withoutSelector=beforeHandler.replace(/function podArchiveFor\(\)\{[^\n]*\}/,'');
  assert.doesNotMatch(withoutSelector,/require\(['"]\.\.\/shared\/pod-archive(?:-rc1432)?['"]\)/,'POD-Archive dürfen außerhalb des Lazy-Selectors nicht beim Modulimport geladen werden');
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

test('RC1455 Pickup: ABD und Nicht-ABD verwenden denselben Ein-Signatur-POD bei erhaltenem Lazy-Load-Schutz',()=>{
  const start=source.indexOf('function podArchiveFor()');
  const end=source.indexOf('module.exports=async function',start);
  assert.ok(start>=0&&end>start,'POD-Selector fehlt');
  const selector=source.slice(start,end);
  assert.match(selector,/return require\(['"]\.\.\/shared\/pod-archive['"]\)/);
  assert.doesNotMatch(selector,/pod-archive-rc1432/);
  assert.doesNotMatch(selector,/abdPresent/,'POD-Auswahl darf nicht wieder nach ABD in einen Zwei-Signatur-Pfad verzweigen');
});
