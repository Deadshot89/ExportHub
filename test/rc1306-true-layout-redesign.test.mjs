import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1306-layout-engine.js','utf8');
const css=fs.readFileSync('assets/rc1306-layout-engine.css','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const browserGate=fs.readFileSync('.github/workflows/rc1306-layout-browser.yml','utf8');
const playwrightConfig=fs.readFileSync('playwright.config.mjs','utf8');

test('RC1306: layout engine moves live nodes and never clones functional blocks',()=>{
  assert.match(runtime,/function move\(node,parent\)/);
  assert.match(runtime,/parent\.appendChild\(node\)/);
  assert.doesNotMatch(runtime,/cloneNode\s*\(/);
  assert.match(runtime,/originals=new WeakMap\(\)/);
  assert.match(runtime,/function restoreAll\(\)/);
  assert.match(runtime,/restoreNode\(managed\[i\]\)/);
});

test('RC1306: shipment create has three genuinely different compositions',()=>{
  assert.match(runtime,/function businessShipment\(shell,b\)/);
  assert.match(runtime,/function glassShipment\(shell,b\)/);
  assert.match(runtime,/function neonShipment\(shell,b\)/);
  assert.match(runtime,/rc1306-business-center/);
  assert.match(runtime,/rc1306-glass-mosaic/);
  assert.match(runtime,/rc1306-neon-telemetry/);
  assert.match(runtime,/rc363BlockCustomer/);
  assert.match(runtime,/rc363BlockShipment/);
  assert.match(runtime,/rc573ColliCard/);
  assert.match(runtime,/rc363BlockDocuments/);
  assert.match(runtime,/rc363BlockStow/);
  assert.match(runtime,/rc363BlockAbdDecision/);
  assert.match(runtime,/rc363BlockMail/);
  assert.match(runtime,/rc363BlockActions/);
});

test('RC1306: classic restores the original DOM arrangement',()=>{
  assert.match(runtime,/if\(mode==='classic'\)return/);
  assert.match(runtime,/restoreAll\(\);\s*var mode=design\(\)/);
  assert.match(runtime,/o\.next&&o\.next\.parentNode===o\.parent/);
});

test('RC1306: rest of application also receives structural layouts',()=>{
  assert.match(runtime,/function genericLayout\(mode\)/);
  assert.match(runtime,/rc1306-generic-primary/);
  assert.match(runtime,/rc1306-generic-secondary/);
  assert.match(css,/\.rc1306-generic-body\{[\s\S]*grid-template-columns:minmax\(0,1fr\) 320px/);
  assert.match(css,/data-eh-layout-mode="glass"[\s\S]*rc1306-generic-body/);
  assert.match(css,/data-eh-layout-mode="neon"[\s\S]*rc1306-generic-body/);
});

test('RC1306: each design uses materially different geometry',()=>{
  assert.match(css,/\.rc1306-business-workspace\{[\s\S]*grid-template-columns:180px minmax\(0,1fr\) 340px/);
  assert.match(css,/\.rc1306-glass-mosaic\{[\s\S]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css,/\.rc1306-neon-workspace\{[\s\S]*grid-template-columns:190px minmax\(0,1fr\) 320px/);
  assert.match(css,/\.rc1306-business-center \.rc1306-zone--identity\{[\s\S]*grid-template-columns:minmax\(0,\.95fr\) minmax\(0,1\.05fr\)/);
  assert.match(css,/\.rc1306-neon-core-top\{[\s\S]*grid-template-columns:minmax\(0,\.9fr\) minmax\(0,1\.1fr\)/);
});

test('RC1306: mobile composition collapses deliberately instead of shrinking desktop',()=>{
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.rc1306-glass-mosaic\{[\s\S]*grid-template-columns:1fr!important/);
  assert.match(css,/\.rc1306-business-center \.rc1306-zone--identity/);
  assert.match(css,/\.rc1306-neon-core-top/);
});

test('RC1306: layout engine reacts to design attribute changes without observing its own moves',()=>{
  assert.match(runtime,/attributeFilter:\['data-eh-design'\]/);
  assert.match(runtime,/attributeName==='data-eh-design'/);
  assert.match(runtime,/if\(observer\)observer\.disconnect\(\)/);
  assert.match(runtime,/observer\.observe\(d\.body,\{childList:true,subtree:true\}\)/);
  assert.match(runtime,/originals\.delete\(managed\[i\]\)/);
});

test('RC1306: explicit design changes bypass render debounce',()=>{
  assert.match(runtime,/addEventListener\('exporthub:designchange',apply\)/);
  assert.match(runtime,/addEventListener\('exporthub:viewchange',schedule\)/);
  assert.match(runtime,/addEventListener\('exporthub:rendered',schedule\)/);
});

test('RC1310: explicit design changes do not schedule a duplicate observer rebuild',()=>{
  assert.match(runtime,/var lastAppliedDesign='';/);
  assert.match(runtime,/lastAppliedDesign=mode;/);
  assert.match(runtime,/attributeName==='data-eh-design'&&design\(\)!==lastAppliedDesign/);
});

test('RC1308: multi-layout browser gate covers all five configured target viewports',()=>{
  assert.match(browserGate,/npx playwright test e2e\/specs\/rc1306-layout-redesign\.spec\.mjs/);
  for(const project of ['mobile-small','mobile-standard','tablet','laptop','desktop']){
    assert.ok(browserGate.includes('--project='+project),'missing workflow project '+project);
    assert.ok(playwrightConfig.includes("name:'"+project+"'"),'missing project '+project);
  }
  for(const viewport of ['width:360,height:800','width:390,height:844','width:768,height:1024','width:1366,height:768','width:1920,height:1080']){
    assert.ok(playwrightConfig.includes(viewport),'missing viewport '+viewport);
  }
});

test('RC1306: generated layout navigation is localized',()=>{
  assert.match(runtime,/ExportHUBI18n/);
  assert.match(runtime,/layout\.shipmentProcess/);
  assert.match(runtime,/layout\.customerRecipient/);
  assert.match(runtime,/layout\.saveOutput/);
  assert.doesNotMatch(runtime,/Sendungsprozess|Kunde|Empfänger|Sendungsdaten|Dokumente|Speichern|Ausgabe/);
});

test('RC1306: release build injects and ships layout assets',()=>{
  assert.match(build,/RC1306_LAYOUT_STYLE_TAG/);
  assert.match(build,/RC1306_LAYOUT_SCRIPT_TAG/);
  assert.match(build,/patchRc1306LayoutEngine/);
  assert.match(build,/rc1306-layout-engine\.css\?v=1306/);
  assert.match(build,/rc1306-layout-engine\.js\?v=1306/);
  assert.match(build,/'assets\/rc1306-layout-engine\.css'/);
  assert.match(build,/'assets\/rc1306-layout-engine\.js'/);
});
