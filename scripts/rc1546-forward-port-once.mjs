import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const oldRef='origin/perf/rc1505-sync-rerender';
const branch='perf/rc1546-no-rerender-current-main';
const workflow='.github/workflows/rc1546-forward-port-once.yml';
const self='scripts/rc1546-forward-port-once.mjs';

function run(cmd,args,options={}){
  return execFileSync(cmd,args,{stdio:options.capture?'pipe':'inherit',encoding:options.capture?'utf8':undefined});
}
function read(file){return fs.readFileSync(file,'utf8')}
function write(file,text){fs.mkdirSync(file.split('/').slice(0,-1).join('/')||'.',{recursive:true});fs.writeFileSync(file,text,'utf8')}
function count(source,needle){return source.split(needle).length-1}
function replaceOnce(file,before,after,label){
  let source=read(file);
  if(source.includes(after))return;
  const hits=count(source,before);
  if(hits!==1)throw new Error(`${label}: erwarteter Anker 1x, gefunden ${hits} in ${file}`);
  source=source.replace(before,after);
  write(file,source);
}

console.log('RC1546: alten Performance-Branch nur als Test-/Referenzquelle laden');
run('git',['fetch','--no-tags','origin',`perf/rc1505-sync-rerender:refs/remotes/${oldRef}`]);

const referenceFiles=[
  'test/rc1505-save-confirmation-render-gate.test.mjs',
  'test/rc1506-production-loader-cache.test.mjs',
  'test/rc1507-i18n-save-confirmation-gate.test.mjs',
  'test/rc1508-multi-truck-save-watch-gate.test.mjs',
  'test/rc1509-production-loader-cache-safety.test.mjs',
  'test/rc1510-customer-contacts-offview-sync-gate.test.mjs',
  'test/rc1511-customer-delete-offview-sync-gate.test.mjs',
  'test/rc1512-document-viewer-offview-sync-gate.test.mjs',
  'test/rc1513-abd-self-service-offview-sync-gate.test.mjs',
  'test/rc1514-exportexperte-handoff-offview-sync-gate.test.mjs',
  'test/rc1515-abd-export-offview-sync-gate.test.mjs',
  'e2e/specs/rc1516-browser-runtime-performance.spec.mjs',
  'e2e/specs/rc1517-save-confirmation-no-rerender.spec.mjs'
];
for(const file of referenceFiles){
  const content=run('git',['show',`${oldRef}:${file}`],{capture:true});
  write(file,content);
}

console.log('RC1546: RC1505 Save-ACK Render-Gate direkt in den Builder schreiben');
{
  const file='.github/rc1112/build-three-env.mjs';
  let source=read(file);
  const functionName='function patchRc1505SaveConfirmationRenderGate(html,file){';
  if(!source.includes(functionName)){
    const insertBefore='function patchTaskDetailTab(html,file){';
    const at=source.indexOf(insertBefore);
    if(at<0)throw new Error('RC1546 Builder-Einfügeanker fehlt');
    const patch=`function patchRc1505SaveConfirmationRenderGate(html,file){
  const syncBefore="reason:reason||'poll',remote:true";
  const syncAfter="reason:reason||'poll',remote:true,concurrentMerge:options.concurrentMerge===true";
  if(!html.includes(syncAfter)){
    const hits=html.split(syncBefore).length-1;
    if(hits!==1)throw new Error(file+': RC1505 Sync-Metadaten-Anker '+hits+'x gefunden');
    html=html.replace(syncBefore,syncAfter);
  }
  const applyBefore="applyRemoteDocument(authoritative,'save-confirmation',{allowWhileSaving:true})";
  const applyAfter="applyRemoteDocument(authoritative,'save-confirmation',{allowWhileSaving:true,concurrentMerge:authoritative&&authoritative.concurrentMerge===true})";
  let afterCount=html.split(applyAfter).length-1;
  if(afterCount!==2){
    const hits=html.split(applyBefore).length-1;
    if(hits!==2)throw new Error(file+': RC1505 Save-Confirmation-Apply-Anker '+hits+'x gefunden');
    html=html.split(applyBefore).join(applyAfter);
    afterCount=html.split(applyAfter).length-1;
  }
  if(afterCount!==2)throw new Error(file+': RC1505 concurrentMerge nicht an beide Save-Pfade weitergegeben');
  const shipmentBefore="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{},localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true;if(localSaveConfirmation)return;if(detail.remote===true)scheduleRemoteMerge(0)})";
  const shipmentAfter="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{},localSaveConfirmation=detail.remote===true&&detail.reason==='save-confirmation'&&window.__EXPORTHUB_SHIPMENT_SAVE_TX__===true,saveConfirmationNoMerge=detail.remote===true&&detail.reason==='save-confirmation'&&detail.concurrentMerge!==true;if(saveConfirmationNoMerge)return;if(localSaveConfirmation)return;if(detail.remote===true)scheduleRemoteMerge(0)})";
  if(!html.includes(shipmentAfter)){
    const hits=html.split(shipmentBefore).length-1;
    if(hits!==1)throw new Error(file+': RC1505 Shipment-Sync-Anker '+hits+'x gefunden');
    html=html.replace(shipmentBefore,shipmentAfter);
  }
  const postBefore="window.addEventListener('exporthub:sync',function(){schedulePost(220,true)})";
  const postAfter="window.addEventListener('exporthub:sync',function(event){var detail=event&&event.detail||{};if(detail.reason==='save-confirmation'&&detail.concurrentMerge!==true)return;schedulePost(220,true)})";
  if(!html.includes(postAfter)){
    const hits=html.split(postBefore).length-1;
    if(hits!==1)throw new Error(file+': RC1505 Postprocessing-Anker '+hits+'x gefunden');
    html=html.replace(postBefore,postAfter);
  }
  return html;
}

`;
    source=source.slice(0,at)+patch+source.slice(at);
  }
  const call='html=patchRc1505SaveConfirmationRenderGate(html,file);';
  if(!source.includes(call)){
    const anchor='html=patchRc1418ShipmentSaveNoRerender(html,file);';
    const hits=count(source,anchor);
    if(hits!==1)throw new Error(`RC1546 Builder-Call-Anker ${hits}x gefunden`);
    source=source.replace(anchor,anchor+'\n  '+call);
  }
  write(file,source);
}

console.log('RC1546: i18n Save-ACK direkt im Runtime-Source begrenzen');
{
  const file='assets/rc1267-i18n.js';
  const before="['exporthub:sync','exporthub:customer-updated','exporthub:shipment-updated','exporthub:task-updated'].forEach(function(name){w.addEventListener(name,function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()})});";
  const helper="function isNoMergeSaveConfirmation(event){var detail=event&&event.detail||{};return detail.remote===true&&detail.reason==='save-confirmation'&&detail.concurrentMerge!==true}";
  const after=helper+"\n"+
    "w.addEventListener('exporthub:sync',function(event){if(isNoMergeSaveConfirmation(event))return;repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});\n"+
    "w.addEventListener('exporthub:customer-updated',function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});\n"+
    "w.addEventListener('exporthub:shipment-updated',function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});\n"+
    "w.addEventListener('exporthub:task-updated',function(){repairContaminatedGoodsDescription();buildDynamicIndex();ensureSelector();if(d.body)queueFullTranslation()});";
  replaceOnce(file,before,after,'RC1507 i18n');
}

console.log('RC1546: Off-View Timer/Remounts begrenzen');
replaceOnce(
  'assets/rc1063-abd-blob-viewer-compat.js',
  "try{w.addEventListener('exporthub:sync',function(){scheduleViewerRefresh(false)})}catch(_){}",
  "try{w.addEventListener('exporthub:sync',function(){if(!w.document||!w.document.getElementById('rc786ReferenceFilesPanel'))return;scheduleViewerRefresh(false)})}catch(_){}",
  'RC1512 Dokumentviewer'
);
replaceOnce(
  'assets/rc1092-customer-mail-contacts.js',
  'function activate(){syncObserver();schedule()}',
  'function activate(){if(!customerFolderVisible()){syncObserver();return false}syncObserver();schedule();return true}',
  'RC1510 Kundenkontakte'
);
replaceOnce(
  'assets/rc1126-customer-delete.js',
  'function activate(){syncObserver();schedule()}',
  'function activate(){if(!customerView()){syncObserver();return false}syncObserver();schedule();return true}',
  'RC1511 Kunden löschen'
);
replaceOnce(
  'assets/rc1294-abd-self-service.js',
  'function activate(){syncObserver();schedule()}',
  'function activate(){if(syncObserver())schedule()}',
  'RC1513 ABD Self-Service'
);

{
  const file='assets/rc1328-multi-truck-ui-refresh.js';
  let source=read(file);
  const before=`function scheduleCurrent(){return watchCurrent(50)}

function onSaved(event){
 var detail=event&&event.detail||{},sh=detail.shipment;
 schedule(sh)
}

w.addEventListener('exporthub:shipment-saved',onSaved);
['exporthub:viewchange','exporthub:rendered','exporthub:sync','exporthub:state-loaded','exporthub:shipment-updated'].forEach(function(name){
 w.addEventListener(name,scheduleCurrent)
});
w.addEventListener('click',function(event){
 var target=event&&event.target,button=target&&target.closest&&target.closest('#rc363SaveShipment');
 if(button)watchCurrent(50)
},true);`;
  const after=`function shouldWatchCurrent(){
 if(panel())return false;
 if(card())return true;
 var s=state();if(!s)return false;
 var current=[s.shipment,s.currentShipment,s.selectedShipment].filter(Boolean);
 if(current.some(hasMultiTruck))return true;
 var ref=activeReference(s);if(!ref)return false;
 return arr(s.shipments).some(function(sh){return refOf(sh)===ref&&hasMultiTruck(sh)})
}
function scheduleCurrent(){return shouldWatchCurrent()?watchCurrent(50):false}

function onSaved(event){
 var detail=event&&event.detail||{},sh=detail.shipment;
 if(sh&&!hasMultiTruck(sh))return false;
 return schedule(sh)
}
function isNoMergeSaveConfirmation(event){var detail=event&&event.detail||{};return detail.remote===true&&detail.reason==='save-confirmation'&&detail.concurrentMerge!==true}

w.addEventListener('exporthub:shipment-saved',onSaved);
w.addEventListener('exporthub:sync',function(event){if(isNoMergeSaveConfirmation(event))return;scheduleCurrent()});
['exporthub:viewchange','exporthub:rendered','exporthub:state-loaded','exporthub:shipment-updated'].forEach(function(name){
 w.addEventListener(name,scheduleCurrent)
});
w.addEventListener('click',function(event){
 var target=event&&event.target,button=target&&target.closest&&target.closest('#rc363SaveShipment');
 if(button)scheduleCurrent()
},true);`;
  if(!source.includes(after)){
    const hits=count(source,before);
    if(hits!==1)throw new Error(`RC1508 Mehr-LKW-Anker ${hits}x gefunden`);
    source=source.replace(before,after);
    write(file,source);
  }
}

replaceOnce(
  'assets/rc1499-abd-export.js',
  " var d=root.document;if(!d||!d.documentElement)return false;ensureStyle();schedule();bindObserver();return true\n}\nfunction remount(){if(root.setTimeout)root.setTimeout(mount,0);else mount()}",
  " var d=root.document;if(!d||!d.documentElement)return false;if(!observerHost()){disconnectObserver();return false}ensureStyle();schedule();bindObserver();return true\n}\nfunction remount(){if(!observerHost()){disconnectObserver();return false}if(root.setTimeout)root.setTimeout(mount,0);else mount();return true}",
  'RC1515 ABD Export'
);
replaceOnce(
  'assets/rc1499-exportexperte-handoff.js',
  "  var d=root.document;if(!d||!d.documentElement)return false;ensureStyle();ensureExport();schedule();bindObserver();return true\n}\nfunction remount(){if(root.setTimeout)root.setTimeout(mount,0);else mount()}",
  "  var d=root.document;if(!d||!d.documentElement)return false;if(!observerHost()){disconnectObserver();return false}ensureStyle();ensureExport();schedule();bindObserver();return true\n}\nfunction remount(){if(!observerHost()){disconnectObserver();return false}if(root.setTimeout)root.setTimeout(mount,0);else mount();return true}",
  'RC1514 Exportexperte Handoff'
);

console.log('RC1546: SHA-/versionssicheren Produktions-HTML-Cache anwenden');
{
  const file='infra/production-loader.html';
  let source=read(file);
  const startBefore="<script>(function(){'use strict';var API='/api/exporthub-release',written=false;";
  const startAfter="<script>(function(){'use strict';var API='/api/exporthub-release';var HTML_CACHE='exporthub-production-html-v1';var written=false;";
  if(!source.includes(startAfter)){
    const hits=count(source,startBefore);
    if(hits!==1)throw new Error(`RC1506 Loader-Start ${hits}x gefunden`);
    source=source.replace(startBefore,startAfter);
  }
  const tailBefore="(async function(){try{progress(32,'Produktionsstatus wird geprüft …');var m=JSON.parse(await get(API+'?action=active&channel=production&_='+Date.now())),v=String(m.version||'').trim().toUpperCase();if(!/^RC\\d+$/.test(v))throw new Error('Im Release-Center ist keine Produktionsversion freigegeben.');progress(58,'Produktion '+v+' wird geladen …');var h=await get(API+'?action=html&channel=production&_='+Date.now(),'text/html');progress(86,'Oberfläche wird vorbereitet …');inject(h,v)}catch(e){fail(e&&e.message||String(e))}})();})();</script></body></html>";
  const tailAfter="function cacheableRelease(meta){return !!(meta&&String(meta.version||'').trim()&&String(meta.sha||'').trim())}\nfunction releaseCacheKey(meta){meta=meta||{};return '/__exporthub_release_cache__/production/'+encodeURIComponent(String(meta.version||''))+'/'+encodeURIComponent(String(meta.sha||''))}\nasync function getReleaseHtml(meta){if(!cacheableRelease(meta)||!('caches' in window))return get(API+'?action=html&channel=production&_='+Date.now(),'text/html');var key=releaseCacheKey(meta),cache=null;try{cache=await caches.open(HTML_CACHE);var hit=await cache.match(key);if(hit){var cached=await hit.text();if(/<html[\\s>]/i.test(cached)&&cached.indexOf('exporthub-canonical-build-source')>=0)return cached}}catch(_){}var response=await fetch(API+'?action=html&channel=production&_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{Accept:'text/html'}});if(response.ok&&cache){try{cache.put(key,response.clone()).catch(function(){})}catch(_){}}var text=await response.text();if(!response.ok)throw new Error(text||('HTTP '+response.status));return text}\n(async function(){try{progress(32,'Produktionsstatus wird geprüft …');var m=JSON.parse(await get(API+'?action=active&channel=production&_='+Date.now())),v=String(m.version||'').trim().toUpperCase();if(!/^RC\\d+$/.test(v))throw new Error('Im Release-Center ist keine Produktionsversion freigegeben.');progress(58,'Produktion '+v+' wird geladen …');var h=await getReleaseHtml(m);progress(86,'Oberfläche wird vorbereitet …');inject(h,v)}catch(e){fail(e&&e.message||String(e))}})();})();</script></body></html>";
  if(!source.includes('function cacheableRelease(meta)')){
    const hits=count(source,tailBefore);
    if(hits!==1)throw new Error(`RC1506/1509 Loader-Tail ${hits}x gefunden`);
    source=source.replace(tailBefore,tailAfter);
  }
  write(file,source);
}

const pretest=read('scripts/rc1462-pretest.mjs');
if(pretest.includes('applyRc1505SaveConfirmationRenderGate')||pretest.includes('applyRc1507I18nSaveConfirmationGate')){
  throw new Error('RC1546 Performance-Fix darf nicht wieder als Pretest-Mutation umgesetzt sein');
}

write('test/rc1546-performance-source-of-truth.test.mjs',`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
test('RC1546: No-Rerender-Fix ist direkt im Source-of-Truth statt im Pretest',()=>{
 const pretest=read('scripts/rc1462-pretest.mjs'),builder=read('.github/rc1112/build-three-env.mjs'),i18n=read('assets/rc1267-i18n.js');
 assert.doesNotMatch(pretest,/applyRc1505SaveConfirmationRenderGate|applyRc1507I18nSaveConfirmationGate/);
 assert.match(builder,/function patchRc1505SaveConfirmationRenderGate\\(html,file\\)/);
 assert.match(builder,/html=patchRc1505SaveConfirmationRenderGate\\(html,file\\);/);
 assert.match(i18n,/function isNoMergeSaveConfirmation\\(event\\)/);
});
test('RC1546: Off-View-Runtimes planen keine unnötige Sync-Arbeit',()=>{
 assert.match(read('assets/rc1063-abd-blob-viewer-compat.js'),/getElementById\\('rc786ReferenceFilesPanel'\\)\\)return/);
 assert.match(read('assets/rc1092-customer-mail-contacts.js'),/function activate\\(\\)\\{if\\(!customerFolderVisible\\(\\)\\)/);
 assert.match(read('assets/rc1126-customer-delete.js'),/function activate\\(\\)\\{if\\(!customerView\\(\\)\\)/);
 assert.match(read('assets/rc1294-abd-self-service.js'),/function activate\\(\\)\\{if\\(syncObserver\\(\\)\\)schedule\\(\\)\\}/);
 assert.match(read('assets/rc1499-abd-export.js'),/if\\(!observerHost\\(\\)\\)\\{disconnectObserver\\(\\);return false\\}/);
 assert.match(read('assets/rc1499-exportexperte-handoff.js'),/if\\(!observerHost\\(\\)\\)\\{disconnectObserver\\(\\);return false\\}/);
});
test('RC1546: Produktionsloader cached nur versionierte Releases mit SHA',()=>{
 const loader=read('infra/production-loader.html');
 assert.match(loader,/function cacheableRelease\\(meta\\)/);
 assert.match(loader,/String\\(meta\\.sha\\|\\|''\\)\\.trim\\(\\)/);
 assert.match(loader,/getReleaseHtml\\(m\\)/);
});
`);

write('.github/workflows/rc1546-performance-regression.yml',`name: RC1546 Performance No-Rerender

on:
  pull_request:
    branches: [main]
    paths:
      - '.github/rc1112/build-three-env.mjs'
      - 'assets/rc1063-abd-blob-viewer-compat.js'
      - 'assets/rc1092-customer-mail-contacts.js'
      - 'assets/rc1126-customer-delete.js'
      - 'assets/rc1267-i18n.js'
      - 'assets/rc1294-abd-self-service.js'
      - 'assets/rc1328-multi-truck-ui-refresh.js'
      - 'assets/rc1499-abd-export.js'
      - 'assets/rc1499-exportexperte-handoff.js'
      - 'infra/production-loader.html'
      - 'test/rc15*.test.mjs'
      - 'e2e/specs/rc1516-browser-runtime-performance.spec.mjs'
      - 'e2e/specs/rc1517-save-confirmation-no-rerender.spec.mjs'
      - '.github/workflows/rc1546-performance-regression.yml'
permissions:
  contents: read
jobs:
  performance:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '20'
          package-manager-cache: false
      - name: Release-Vorbereitung
        run: node scripts/rc1462-pretest.mjs
      - name: Targeted Node Performance Regression
        run: >-
          node --test --test-concurrency=1
          test/rc1505-save-confirmation-render-gate.test.mjs
          test/rc1506-production-loader-cache.test.mjs
          test/rc1507-i18n-save-confirmation-gate.test.mjs
          test/rc1508-multi-truck-save-watch-gate.test.mjs
          test/rc1509-production-loader-cache-safety.test.mjs
          test/rc1510-customer-contacts-offview-sync-gate.test.mjs
          test/rc1511-customer-delete-offview-sync-gate.test.mjs
          test/rc1512-document-viewer-offview-sync-gate.test.mjs
          test/rc1513-abd-self-service-offview-sync-gate.test.mjs
          test/rc1514-exportexperte-handoff-offview-sync-gate.test.mjs
          test/rc1515-abd-export-offview-sync-gate.test.mjs
          test/rc1546-performance-source-of-truth.test.mjs
      - name: Chromium installieren
        run: |
          npm install --no-save @playwright/test@1.63.0
          npx playwright install --with-deps chromium
      - name: Echter Browser – Runtime und DOM-Identität
        env:
          EXPORTHUB_E2E_STATIC: '1'
        run: >-
          npx playwright test
          e2e/specs/rc1516-browser-runtime-performance.spec.mjs
          e2e/specs/rc1517-save-confirmation-no-rerender.spec.mjs
          --project=laptop
`);

console.log('RC1546: Forward-Port anwenden und Hilfsdateien entfernen');
fs.rmSync(workflow,{force:true});
fs.rmSync(self,{force:true});
run('git',['config','user.name','github-actions[bot]']);
run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
run('git',['add','-A']);
run('git',['commit','-m','RC1546: No-Rerender Performance-Fix auf aktuellen main portieren']);
run('git',['push','origin',`HEAD:${branch}`]);
console.log('RC1546: Forward-Port committed und gepusht');
