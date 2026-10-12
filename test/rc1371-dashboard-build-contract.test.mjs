import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const release=JSON.parse(fs.readFileSync('release-version.json','utf8'));

const styleId='exporthub-rc1371-dashboard-style';
const i18nId='exporthub-rc1371-dashboard-i18n';
const scriptId='exporthub-rc1371-dashboard-script';

test('RC1371 Build definiert eindeutige Dashboard-Asset-Tags',()=>{
  assert.match(build,/const RC1371_DASHBOARD_STYLE_TAG=/);
  assert.match(build,/const RC1371_DASHBOARD_I18N_TAG=/);
  assert.match(build,/const RC1371_DASHBOARD_SCRIPT_TAG=/);
  assert.match(build,new RegExp(`id=["']${styleId}["']`));
  assert.match(build,new RegExp(`id=["']${i18nId}["']`));
  assert.match(build,new RegExp(`id=["']${scriptId}["']`));
  assert.match(build,/rc1371-dashboard-personalization\.css\?v=1371/);
  assert.match(build,/i18n\/rc1371-dashboard-personalization\.js\?v=1371/);
  assert.match(build,/rc1371-dashboard-personalization\.js\?v=1371/);
});

test('RC1371 Dashboard wird idempotent vor RC1306 in den Head eingebunden',()=>{
  assert.match(build,/function patchRc1371Dashboard\(html,file\)/);
  assert.match(build,/injectDeferredRuntimeInHead\(html,RC1371_DASHBOARD_STYLE_TAG,'exporthub-rc1371-dashboard-style'\)/);
  assert.match(build,/injectDeferredRuntimeInHead\(html,RC1371_DASHBOARD_I18N_TAG,'exporthub-rc1371-dashboard-i18n'\)/);
  assert.match(build,/injectDeferredRuntimeInHead\(html,RC1371_DASHBOARD_SCRIPT_TAG,'exporthub-rc1371-dashboard-script'\)/);
  const dashboardAt=build.indexOf('html=patchRc1371Dashboard(html,file);');
  const layoutAt=build.indexOf('html=patchRc1306LayoutEngine(html,file);');
  assert.ok(dashboardAt>=0,'RC1371 patch call missing');
  assert.ok(layoutAt>=0,'RC1306 patch call missing');
  assert.ok(dashboardAt<layoutAt,'RC1371 must be patched before RC1306');
});

test('RC1371 Build kopiert Runtime und CSS; I18n-Pack bleibt im bestehenden rekursiven i18n-Copy',()=>{
  assert.match(build,/'assets\/rc1371-dashboard-personalization\.css'/);
  assert.match(build,/'assets\/rc1371-dashboard-personalization\.js'/);
  assert.match(build,/fs\.cpSync\(path\.join\(ROOT,'assets\/i18n'\),path\.join\(OUT,'assets\/i18n'\),\{recursive:true,force:true\}\)/);
});

test('RC1371 Patch läuft für Produktion TESTSERVICE und Demo',()=>{
  assert.match(build,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)patchHtml\(file\)/);
});

test('RC1371 verändert den sichtbaren Release-Marker nicht stillschweigend',()=>{
  assert.equal(release.visibleRelease,'RC1370');
  assert.equal(release.technicalBuild,'RC1112');
  assert.doesNotMatch(build,/VISIBLE_VERSION\s*=\s*['"]RC1371['"]/);
});
