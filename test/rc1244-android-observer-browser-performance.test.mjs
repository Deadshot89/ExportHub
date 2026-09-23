import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/exporthub-environment-hub.js','utf8');

test('RC1244: normaler Browser installiert keinen globalen Android-DOM-Observer',()=>{
  assert.match(source,/function androidBridgeReady\(\)\{return !!\(window\.ExportHUBAndroid&&typeof window\.ExportHUBAndroid\.notify==='function'\)\}/);
  assert.match(source,/if\(androidBridgeReady\(\)&&document\.documentElement&&window\.MutationObserver\)/);
});

test('RC1244: Benachrichtigungs-DOM-Scans brechen ohne Android-Bridge vor querySelector ab',()=>{
  const start=source.indexOf('function notifyAndroid(){');
  const end=source.indexOf('function diagnosticMarkerKey()',start);
  assert.ok(start>=0&&end>start,'notifyAndroid Block fehlt');
  const block=source.slice(start,end);
  assert.match(block,/if\(!androidBridgeReady\(\)\)return false/);
  assert.ok(block.indexOf('!androidBridgeReady()')<block.indexOf('countOf('),'Bridge-Guard muss vor DOM-Scans greifen');
});

test('RC1244: Android-Benachrichtigungen und Diagnose-Timer bleiben bei vorhandener Bridge aktiv',()=>{
  assert.match(source,/\['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:notifications-updated','exporthub:warnings-updated'\]/);
  assert.match(source,/window\.addEventListener\('exporthub:diagnostic',notifyDiagnostic\)/);
  assert.match(source,/scheduleDiagnostics\(4000,true\)/);
  assert.match(source,/new MutationObserver\(schedule\)/);
});

test('RC1244: Browser-Hub bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/exporthub-environment-hub.js'],{stdio:'pipe'});
});
