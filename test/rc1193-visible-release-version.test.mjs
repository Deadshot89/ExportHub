import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1193-visible-release.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const notes=fs.readFileSync('assets/rc1177-release-notes.js','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1193: sichtbare Release-Version ist von der stabilen RC1112 Buildkette getrennt',()=>{
  assert.match(runtime,/var VERSION='RC1193'/);
  assert.match(runtime,/__EXPORTHUB_VISIBLE_RELEASE_VERSION__=VERSION/);
  assert.match(builder,/const VERSION='RC1112'/,'technische Buildkette muss RC1112 bleiben');
  assert.match(builder,/rc1193-visible-release\.js\?v=1193/);
  assert.match(builder,/visibleProductVersion:'RC1193/);
});

test('RC1193: Login-Badge und TESTSERVICE-Warnbanner werden korrigiert',()=>{
  assert.match(runtime,/Aktuelle Version\\s\+RC\\d\+/);
  assert.match(runtime,/TESTSERVICE\\s\*·\\s\*RC\\d\+\\s\*·\\s\*NICHT PRODUKTION/);
  assert.match(runtime,/data-exporthub-version-label/);
  assert.match(runtime,/MutationObserver/);
});

test('RC1193: Release Notes bevorzugen sichtbare Produktversion und fallen nicht auf RC1112 zurück',()=>{
  assert.match(notes,/__EXPORTHUB_VISIBLE_RELEASE_VERSION__/);
  assert.match(notes,/return'RC1193'/);
  const fn=notes.slice(notes.indexOf('function version()'),notes.indexOf('function patch()'));
  assert.doesNotMatch(fn,/return'RC1112'/);
});

test('RC1193: lokale, TESTSERVICE- und Produktions-Browsergates prüfen die sichtbare Version',()=>{
  const local=workflow.slice(workflow.indexOf('- name: RC1124 Lokales Browser-Gate'),workflow.indexOf('- name: RC1124 Lokale Browser-Artefakte'));
  const live=workflow.slice(workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate'),workflow.indexOf('- name: RC1124 TESTSERVICE Browser-Artefakte'));
  const prod=workflow.slice(workflow.indexOf('- name: RC1124 Produktion Read-only Browser Smoke'),workflow.indexOf('- name: RC1124 Produktion Browser-Artefakte'));
  assert.match(local,/version-display\.spec\.mjs/);
  assert.match(live,/version-display\.spec\.mjs/);
  assert.match(prod,/version-display\.spec\.mjs/);
});

test('RC1193: statischer UI-Nachweis ignoriert erwartete fehlende API, Live-Gate bleibt streng',()=>{
  const spec=fs.readFileSync('e2e/specs/version-display.spec.mjs','utf8');
  assert.match(spec,/EXPORTHUB_E2E_STATIC/);
  assert.match(spec,/assertRuntimeClean/);
  assert.match(spec,/if\(process\.env\.EXPORTHUB_E2E_STATIC!==['"]1['"]\)await assertRuntimeClean/);
});

test('RC1193: TESTSERVICE-Warnbanner wird nur auf echtem Live-Testservice verlangt',()=>{
  const spec=fs.readFileSync('e2e/specs/version-display.spec.mjs','utf8');
  assert.match(spec,/EXPORTHUB_E2E_LIVE===['"]1['"]/);
  assert.match(spec,/-testservice\\\./);
  assert.doesNotMatch(spec,/TESTVERSION\/i\.test\(entry\)/);
});

test('RC1193: Runtime und Browser-Spec bleiben syntaktisch gültig',()=>{
  for(const file of ['assets/rc1193-visible-release.js','e2e/specs/version-display.spec.mjs','test/rc1193-visible-release-version.test.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
