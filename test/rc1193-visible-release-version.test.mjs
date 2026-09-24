import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1193-visible-release.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const notes=fs.readFileSync('assets/rc1177-release-notes.js','utf8');
const spec=fs.readFileSync('e2e/specs/version-display.spec.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1265: sichtbare Release-Version wird beim Build aus dem aktuellen RC ermittelt',()=>{
  assert.match(runtime,/var VERSION='RC1112'/,'Quellruntime behält nur die technische Fallback-Version');
  assert.match(builder,/function resolveVisibleVersion\(\)/);
  assert.match(builder,/EXPORTHUB_VISIBLE_RELEASE_VERSION/);
  assert.ok(builder.includes("execFileSync('git',['log'"));
  assert.match(builder,/const VISIBLE_VERSION=resolveVisibleVersion\(\)/);
  assert.match(builder,/visibleRuntime\.replace\(\/var VERSION='RC\\d\+';\//);
  assert.match(builder,/releaseNotes\.replace\(\/return'RC\\d\+'\//);
  assert.doesNotMatch(builder,/visibleProductVersion:'RC1231/);
});

test('RC1265: Cache-Keys der sichtbaren Version sind nicht mehr auf RC1231 festgeschrieben',()=>{
  assert.match(builder,/rc1193-visible-release\.js\?v=\$\{VISIBLE_NUMBER\}/);
  assert.match(builder,/rc1177-release-notes\.js\?v=\$\{VISIBLE_NUMBER\}/);
  assert.doesNotMatch(builder,/rc1193-visible-release\.js\?v=1231/);
  assert.doesNotMatch(builder,/rc1177-release-notes\.js\?v=1231/);
});

test('RC1265: Login-Badge und TESTSERVICE-Warnbanner bleiben dynamisch patchbar',()=>{
  assert.match(runtime,/Aktuelle Version\\s\+RC\\d\+/);
  assert.match(runtime,/TESTSERVICE\\s\*·\\s\*RC\\d\+\\s\*·\\s\*NICHT PRODUKTION/);
  assert.match(runtime,/data-exporthub-version-label/);
  assert.match(runtime,/MutationObserver/);
});

test('RC1265: Release Notes nutzen die gebaute sichtbare Produktversion',()=>{
  assert.match(notes,/__EXPORTHUB_VISIBLE_RELEASE_VERSION__/);
  assert.match(notes,/return'RC1112'/);
  assert.match(builder,/releaseNotes=releaseNotes\.replace/);
  const fn=notes.slice(notes.indexOf('function version()'),notes.indexOf('function patch()'));
  assert.doesNotMatch(fn,/return'RC1231'/);
});

test('RC1265: Browser-Spec erwartet den aktuellen RC statt einer festen RC1231',()=>{
  assert.match(spec,/function expectedVisibleRelease\(\)/);
  assert.match(spec,/EXPORTHUB_EXPECTED_VISIBLE_RELEASE/);
  assert.ok(spec.includes("execFileSync('git',['log'"));
  assert.match(spec,/data-exporthub-visible-version/);
  assert.doesNotMatch(spec,/Aktuelle Version\\s\+RC1231/);
  assert.doesNotMatch(spec,/toHaveAttribute\('data-exporthub-visible-version','RC1231'\)/);
});

test('RC1265: lokale, TESTSERVICE- und Produktions-Browsergates prüfen die sichtbare Version',()=>{
  const local=workflow.slice(workflow.indexOf('- name: RC1124 Lokales Browser-Gate'),workflow.indexOf('- name: RC1124 Lokale Browser-Artefakte'));
  const live=workflow.slice(workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate'),workflow.indexOf('- name: RC1124 TESTSERVICE Browser-Artefakte'));
  const prod=workflow.slice(workflow.indexOf('- name: RC1124 Produktion Read-only Browser Smoke'),workflow.indexOf('- name: RC1124 Produktion Browser-Artefakte'));
  assert.match(local,/version-display\.spec\.mjs/);
  assert.match(live,/version-display\.spec\.mjs/);
  assert.match(prod,/version-display\.spec\.mjs/);
});

test('RC1265: statischer UI-Nachweis ignoriert erwartete fehlende API, Live-Gate bleibt streng',()=>{
  assert.match(spec,/EXPORTHUB_E2E_STATIC/);
  assert.match(spec,/assertRuntimeClean/);
  assert.match(spec,/if\(process\.env\.EXPORTHUB_E2E_STATIC!==['"]1['"]\)await assertRuntimeClean/);
});

test('RC1265: Runtime, Builder und Browser-Spec bleiben syntaktisch gültig',()=>{
  for(const file of ['assets/rc1193-visible-release.js','.github/rc1112/build-three-env.mjs','e2e/specs/version-display.spec.mjs','test/rc1193-visible-release-version.test.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
