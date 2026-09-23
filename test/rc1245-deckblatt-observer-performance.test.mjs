import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1203-deckblatt-print.js','utf8');

test('RC1245: Deckblatt-Observer arbeitet außerhalb Sendungs-/Druckkontext nicht',()=>{
  assert.match(source,/function deckblattObserverRelevant\(\)/);
  assert.match(source,/if\(pendingMode\|\|shipmentCreateVisible\(\)\)return true/);
  assert.match(source,/\.rc390-cover,\.rc352-cover,\[data-rc1203-print-cover-only\],\[data-rc1203-print-cmr-only\]/);
  const observer=source.slice(source.indexOf("if(typeof MutationObserver!=='undefined')"),source.indexOf("w.ExportHUBRC1203Deckblatt"));
  assert.match(observer,/if\(!deckblattObserverRelevant\(\)\)return/);
  assert.ok(observer.indexOf('!deckblattObserverRelevant()')<observer.indexOf('removeLegacyExtraButtons()'),'Observer-Guard muss vor globalen DOM-Scans greifen');
});

test('RC1245: Event-Scheduler überspringt globale Deckblatt-Scans außerhalb relevanter Ansichten',()=>{
  const start=source.indexOf('function schedule(){');
  const end=source.indexOf('installOpenGuard();',start);
  const block=source.slice(start,end);
  assert.match(block,/if\(!deckblattObserverRelevant\(\)\)return/);
  assert.ok(block.indexOf('!deckblattObserverRelevant()')<block.indexOf('removeLegacyExtraButtons()'));
});

test('RC1245: direkter Druckpfad dekoriert Deckblatt weiterhin vor print',()=>{
  const start=source.indexOf('function wrapChildPrint(child)');
  const end=source.indexOf('function installOpenGuard()',start);
  const block=source.slice(start,end);
  assert.match(block,/child\.print=function\(\)\{/);
  assert.match(block,/decorateCover\(child\.document\)/);
  assert.match(block,/return nativePrint\(\)/);
});

test('RC1245: Runtime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1203-deckblatt-print.js'],{stdio:'pipe'});
});
