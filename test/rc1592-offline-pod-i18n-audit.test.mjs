import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const audit=fs.readFileSync('scripts/i18n-audit.mjs','utf8');
const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
const registeredGerman=new Set(Object.values(de));
const patterns=audit.split('\n').filter(line=>line.startsWith('const GERMAN_HINT=')||line.startsWith('const UI_CONTEXT='));
const from=audit.indexOf('function compact('),to=audit.indexOf('function scanVisibleKeys(');
assert.ok(patterns.length===2&&from>=0&&to>from);
const sandbox={};
vm.runInNewContext([
  'const TRACE=false;function diag(){}',
  ...patterns,
  audit.slice(from,to),
  'globalThis.auditGerman=scanVisibleGerman;'
].join('\n'),sandbox);
const scan=sandbox.auditGerman;

test('Offline POD: reviewed static and counter-based translations are not false audit failures',()=>{
  const html=fs.readFileSync('pod-notfall.html','utf8');
  assert.deepEqual([...scan({rel:'pod-notfall.html'},html,registeredGerman)],[]);
  for(const key of [
    'emergency.pod.noneComplete',
    'legacyPattern.emergencyPodVaultLoaded',
    'legacyPattern.emergencyPodFolderLoaded',
    'legacyPattern.emergencyPodZipCreated'
  ])assert.ok(typeof de[key]==='string'&&de[key].length>0,key+' must be a real translation');
});

test('Offline POD: new untranslated messages stay reportable',()=>{
  const misses=scan({rel:'pod-notfall.html'},"button.textContent='Bitte eine neue Sendung anmelden.';",registeredGerman);
  assert.ok(misses.length>0,'a new, unregistered POD message must remain an audit failure');
  const otherPage=scan({rel:'pickup.html'},"root.innerHTML='<div class=\\\"empty\\\">Keine vollständigen POD-PDFs geladen.</div>';",registeredGerman);
  assert.ok(otherPage.length>0,'offline exception must not hide unrelated pages');
});
