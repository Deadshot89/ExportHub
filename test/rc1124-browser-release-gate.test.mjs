import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const requiredFiles=[
  'playwright.config.mjs',
  'e2e/helpers/exporthub-browser.mjs',
  'e2e/specs/navigation.spec.mjs',
  'e2e/specs/notifications.spec.mjs',
  'e2e/specs/public-smoke.spec.mjs'
];

function read(file){return fs.readFileSync(file,'utf8')}

test('RC1124: Browser-Gate-Dateien sind vollständig vorhanden',()=>{
  for(const file of requiredFiles)assert.ok(fs.existsSync(file),file+' fehlt');
});

test('RC1124: Playwright konfiguriert alle fünf verbindlichen Viewports und Fehlerartefakte',()=>{
  const config=read('playwright.config.mjs');
  for(const [w,h] of [[360,800],[390,844],[768,1024],[1366,768],[1920,1080]]){
    assert.match(config,new RegExp('width\\s*:\\s*'+w+'[\\s\\S]{0,100}height\\s*:\\s*'+h),w+'x'+h+' fehlt');
  }
  assert.match(config,/workers\s*:\s*1/);
  assert.match(config,/retries\s*:\s*0/);
  assert.match(config,/timeout\s*:\s*45_?000/);
  assert.match(config,/trace\s*:\s*LIVE\?['"]off['"]\s*:\s*['"]retain-on-failure['"]/);
  assert.match(config,/screenshot\s*:\s*['"]only-on-failure['"]/);
  assert.match(config,/dist-rc1112/);
  assert.match(config,/4173/);
});

test('RC1124: Browser-Helfer schützen Navigation, Quellcode-Leaks, Overflow und Laufzeitfehler',()=>{
  const helper=read('e2e/helpers/exporthub-browser.mjs');
  for(const name of ['waitReady','openExportHubView','assertNoSourceLeak','assertNoHorizontalOverflow','attachRuntimeGuards','assertRuntimeClean']){
    assert.match(helper,new RegExp('export\\s+(?:async\\s+)?function\\s+'+name+'\\b'),name+' fehlt');
  }
  for(const marker of ['normalizeActionButtons','RC824_SOP_DETAILS','about:blank']){
    assert.ok(helper.includes(marker),'Leak-Marker '+marker+' fehlt');
  }
  assert.match(helper,/pageerror/);
  assert.match(helper,/console/);
  assert.match(helper,/requestfailed/);
  assert.match(helper,/boundingBox/);
  assert.match(helper,/viewportSize/);
  assert.match(helper,/intersects/);
  assert.match(helper,/scrollIntoViewIfNeeded/);
  assert.match(helper,/menuOpened/);
  assert.match(helper,/viewport&&viewport\.width>=768/);
  assert.match(helper,/EXPORTHUB_E2E_STATIC==='1'/);
  assert.match(helper,/EXPORTHUB_E2E_LIVE==='1'/);
  assert.match(helper,/markerReady/);
  assert.match(helper,/typeof window\.setView==='function'/);
  assert.match(helper,/document\.querySelector\('\[data-view\],\[data-target\],\[data-nav\]'\)/);
  assert.match(helper,/timeout:20_000/);
  assert.match(helper,/data-exporthub-view/);
  assert.match(helper,/demoContext/);
  assert.match(helper,/intentionalDemoBlock/);
  assert.match(helper,/https\?:\\\/\\\/\[\^\\s\]\+\\\/demo/);
  assert.match(helper,/RC1033 Lieferavis Fast-Path exporthub:\(\?:viewchange\|rendered\) Error: Diese Außenwirkung ist in der Fake-Demo absichtlich deaktiviert/);
});

test('RC1124: TESTSERVICE Browser-Gate liegt zwingend vor Produktion',()=>{
  const workflow=read(workflowPath);
  const testservice=workflow.indexOf('- name: Deploy ExportHUB TESTSERVICE');
  const gate=workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const production=workflow.indexOf('- name: Deploy ExportHUB production');
  assert.ok(testservice>=0,'TESTSERVICE-Deploy fehlt');
  assert.ok(gate>testservice,'TESTSERVICE Browser Gate muss nach TESTSERVICE-Deploy laufen');
  assert.ok(production>gate,'Produktion darf erst nach grünem TESTSERVICE Browser Gate laufen');
  assert.match(workflow,/'e2e\/\*\*'/);
  assert.match(workflow,/'playwright\.config\.mjs'/);
  assert.match(workflow,/npm install --no-save @playwright\/test@1\.55\.0/);
  assert.match(workflow,/npx playwright install --with-deps chromium/);
  assert.match(workflow,/RC1124 Lokales Browser-Gate/);
  assert.match(workflow,/Live RC1122 HTML-Integrität prüfen/);
  assert.match(workflow,/actions\/upload-artifact@v7/);
  assert.match(workflow,/retention-days:\s*14/);
});

test('RC1124: Produktion führt nur read-only Browser-Smokes aus',()=>{
  const workflow=read(workflowPath);
  const prod=workflow.indexOf('- name: Deploy ExportHUB production');
  const smoke=workflow.indexOf('- name: RC1124 Produktion Read-only Browser Smoke');
  assert.ok(prod>=0&&smoke>prod,'Produktions-Smoke muss nach dem Deploy liegen');
  const block=workflow.slice(smoke,workflow.indexOf('\n      - name:',smoke+10)>0?workflow.indexOf('\n      - name:',smoke+10):undefined);
  assert.match(block,/public-smoke\.spec\.mjs/);
  assert.doesNotMatch(block,/navigation\.spec\.mjs|notifications\.spec\.mjs/);
});


test('RC1124: aktuelle Lieferavis-Runtimes werden wirklich in RC1112 ausgeliefert',()=>{
  const build=read('.github/rc1112/build-three-env.mjs');
  const workflow=read(workflowPath);
  for(const rel of [
    'assets/rc1027-lieferavis-immediate.js',
    'assets/rc1037-lieferavis-timing-diagnostics.js',
    'assets/rc1049-abd-avis-policy.js'
  ]){
    assert.ok(build.includes(rel),'RC1112 Build kopiert nicht: '+rel);
    assert.ok(workflow.includes('test -s dist-rc1112/'+rel),'Deploy-Vertrag prüft nicht: '+rel);
  }
});

test('RC1124: QR-Abholung enthält syntaktisch gültige Inline-Skripte',()=>{
  const pickup=read('pickup.html');
  const tagRx=new RegExp('<script\\b([^>]*)>([\\s\\S]*?)<\\/script>','gi');
  const scripts=[...pickup.matchAll(tagRx)].filter(m=>!(/\\bsrc\\s*=/.test(m[1])));
  assert.ok(scripts.length>0,'pickup.html enthält kein Inline-Skript');
  for(const [index,match] of scripts.entries()){
    assert.doesNotThrow(()=>new Function(match[2]),'pickup.html Inline-Skript '+index+' ist syntaktisch ungültig');
  }
  assert.ok(pickup.includes("pickup(?:=|\\/)([A-Za-z0-9_-]{6,160})"),'Legacy-QR-Hashroute fehlt');
  assert.ok(pickup.includes("/pickup(?:\\.html)?\\/([A-Za-z0-9_-]{6,160})"),'Legacy-QR-Pfadroute fehlt');
});
