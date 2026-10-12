import fs from 'node:fs';

const file='.github/rc1112/build-three-env.mjs';
let src=fs.readFileSync(file,'utf8');

function replaceOne(before,after,label){
  const count=src.split(before).length-1;
  if(count!==1)throw new Error(`RC1371 ${label}: expected 1 anchor, got ${count}`);
  src=src.replace(before,after);
}

const constantsAnchor="const RC1306_LAYOUT_SCRIPT_TAG='<script id=\"exporthub-rc1306-layout-script\" defer src=\"/assets/rc1306-layout-engine.js?v=1306\"><\\/script>';\n";
const constantsAdd=constantsAnchor+
  "const RC1371_DASHBOARD_STYLE_TAG='<link id=\"exporthub-rc1371-dashboard-style\" rel=\"stylesheet\" href=\"/assets/rc1371-dashboard-personalization.css?v=1371\">';\n"+
  "const RC1371_DASHBOARD_I18N_TAG='<script id=\"exporthub-rc1371-dashboard-i18n\" defer src=\"/assets/i18n/rc1371-dashboard-personalization.js?v=1371\"><\\/script>';\n"+
  "const RC1371_DASHBOARD_SCRIPT_TAG='<script id=\"exporthub-rc1371-dashboard-script\" defer src=\"/assets/rc1371-dashboard-personalization.js?v=1371\"><\\/script>';\n";
replaceOne(constantsAnchor,constantsAdd,'tag constants');

const functionAnchor='function patchRc1306LayoutEngine(html,file){\n';
const dashboardPatch=`function patchRc1371Dashboard(html,file){
  html=injectDeferredRuntimeInHead(html,RC1371_DASHBOARD_STYLE_TAG,'exporthub-rc1371-dashboard-style');
  html=injectDeferredRuntimeInHead(html,RC1371_DASHBOARD_I18N_TAG,'exporthub-rc1371-dashboard-i18n');
  html=injectDeferredRuntimeInHead(html,RC1371_DASHBOARD_SCRIPT_TAG,'exporthub-rc1371-dashboard-script');
  if(!html.includes('rc1371-dashboard-personalization.css?v=1371'))throw new Error(file+': RC1371 Dashboard-CSS fehlt');
  if(!html.includes('i18n/rc1371-dashboard-personalization.js?v=1371'))throw new Error(file+': RC1371 Dashboard-I18n fehlt');
  if(!html.includes('rc1371-dashboard-personalization.js?v=1371'))throw new Error(file+': RC1371 Dashboard-Runtime fehlt');
  return html;
}

`+functionAnchor;
replaceOne(functionAnchor,dashboardPatch,'patch function');

const callAnchor="  html=patchRc1400MobileNavigationCache(html,file);\n  html=patchRc1306LayoutEngine(html,file);";
const callAdd="  html=patchRc1400MobileNavigationCache(html,file);\n  html=patchRc1371Dashboard(html,file);\n  html=patchRc1306LayoutEngine(html,file);";
replaceOne(callAnchor,callAdd,'patch call order');

const assetsAnchor="  'assets/rc1306-layout-engine.css',\n  'assets/rc1306-layout-engine.js',\n  'assets/rc1460-shipment-view-files-avis-preview.js'";
const assetsAdd="  'assets/rc1306-layout-engine.css',\n  'assets/rc1306-layout-engine.js',\n  'assets/rc1371-dashboard-personalization.css',\n  'assets/rc1371-dashboard-personalization.js',\n  'assets/rc1460-shipment-view-files-avis-preview.js'";
replaceOne(assetsAnchor,assetsAdd,'asset copy list');

for(const marker of [
  'RC1371_DASHBOARD_STYLE_TAG','RC1371_DASHBOARD_I18N_TAG','RC1371_DASHBOARD_SCRIPT_TAG',
  'function patchRc1371Dashboard(html,file)','html=patchRc1371Dashboard(html,file);',
  "'assets/rc1371-dashboard-personalization.css'","'assets/rc1371-dashboard-personalization.js'"
])if(!src.includes(marker))throw new Error('RC1371 verification missing: '+marker);

const rc1371At=src.indexOf('html=patchRc1371Dashboard(html,file);');
const rc1306At=src.indexOf('html=patchRc1306LayoutEngine(html,file);');
if(rc1371At<0||rc1306At<0||rc1371At>rc1306At)throw new Error('RC1371 must patch before RC1306');

fs.writeFileSync(file,src);
console.log('RC1371 dashboard build patch applied safely');
