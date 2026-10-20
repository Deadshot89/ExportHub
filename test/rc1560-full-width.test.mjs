import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1560-full-width.css','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const index=fs.readFileSync('index.html','utf8');

test('RC1560 hebt die Breitenbegrenzung von #content und allen bekannten View-Wrappern auf',()=>{
  for(const selector of ['html body[data-eh-theme] #content','#content.rc776-shipment-view','#content.rc871-diagnostics-view','#content[data-rc360-customers="1"]',
    '#rc363FixedShipmentLayout','#rc573ShipmentShell','#rc626Inspections.ihk-center','.rc344-root','.rc524-update-view','.rc807-search-page','.rc894-full-stack','.rc1009-sop-shell'])
    assert.ok(css.includes(selector),selector+' fehlt');
  assert.match(css,/max-width:none!important/);
});

test('RC1560 wirkt nur am Bildschirm: Druck, A4-Dokumente und LKW-Grafik bleiben unverändert',()=>{
  const body=css.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  assert.match(body,/^@media screen\{[\s\S]*\}$/);
  assert.doesNotMatch(css,/rc390-page|rc390-load|rc574-truck|@media print/);
});

test('RC1560 ist spezifischer als die ursprüngliche Design-Grenze von 1720px',()=>{
  assert.match(index,/body\[data-eh-theme\] #content\{width:100%!important;max-width:1720px!important/);
  // html body[data-eh-theme] #content (1,1,2) > body[data-eh-theme] #content (1,1,1)
  assert.ok(css.includes('html body[data-eh-theme] #content'));
});

test('RC1560 wird im Build als letztes Stylesheet nach RC1306 eingebunden und mitkopiert',()=>{
  assert.match(build,/const RC1560_FULL_WIDTH_STYLE_TAG='<link id="exporthub-rc1560-full-width" rel="stylesheet" href="\/assets\/rc1560-full-width\.css\?v=1560">'/);
  const a=build.indexOf('html=patchRc1306LayoutEngine(html,file);'),b=build.indexOf('html=patchRc1560FullWidth(html,file);');
  assert.ok(a>=0&&b>a,'RC1560 muss nach RC1306 gepatcht werden');
  assert.match(build,/'assets\/rc1560-full-width\.css'/);
});
