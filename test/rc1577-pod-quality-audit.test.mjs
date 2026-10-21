import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/pickup-store.js');
const podArchive=require('../api/shared/pod-archive.js');
const integrity=require('../api/shared/pod-integrity-audit.js');
const audit=require('../api/shared/pod-quality-audit.js');
const auth=require('../api/shared/auth-store.js');
const handler=require('../api/pod-quality-audit/index.js');

const KEY='a'.repeat(64),KEY2='b'.repeat(64),KEY3='c'.repeat(64);
const pdfData='data:application/pdf;base64,'+Buffer.from('%PDF-1.7\n'+'x'.repeat(64)).toString('base64');

function withStubs(stubs,fn){
  const saved=stubs.map(([obj,name])=>[obj,name,obj[name]]);
  stubs.forEach(([obj,name,value])=>{obj[name]=value});
  return Promise.resolve().then(fn).finally(()=>saved.forEach(([obj,name,value])=>{obj[name]=value}));
}

test('RC1577: Klassifizierung trennt in Ordnung, neu erzeugen, Abgeholt, selbst prüfen und markiert',()=>{
  const current={readable:true,renderLayout:'RC1595'},old={readable:true,renderLayout:''},broken={readable:false,renderLayout:'RC1595'};
  assert.equal(audit.POD_RENDER_LAYOUT,'RC1595');
  assert.deepEqual(audit.classify({},{files:[current],signatureStored:true,hasToken:true}),{verdict:'ok',reason:'CURRENT_LAYOUT'});
  assert.deepEqual(audit.classify({},{files:[{readable:true,manualUpload:true}]}),{verdict:'ok',reason:'MANUAL_UPLOAD'});
  assert.deepEqual(audit.classify({},{files:[old],signatureStored:true,hasToken:true}),{verdict:'regenerate',reason:'OLD_LAYOUT'});
  assert.deepEqual(audit.classify({},{files:[broken],signatureStored:true,hasToken:true}),{verdict:'regenerate',reason:'POD_NOT_READABLE'});
  assert.deepEqual(audit.classify({},{files:[],signatureStored:false,hasToken:true}),{verdict:'review',reason:'NO_POD_FILE',missing:'SIGNATURE_NOT_STORED'});
  assert.deepEqual(audit.classify({},{files:[old],signatureStored:true,hasToken:false}),{verdict:'review',reason:'OLD_LAYOUT',missing:'PICKUP_TOKEN_MISSING'});
  assert.deepEqual(audit.classify({subShipments:[{},{}]},{files:[old]}),{verdict:'manual',reason:'MULTI_TRUCK'});
  assert.deepEqual(audit.classify({podReviewRequired:true},{files:[current]}),{verdict:'flagged',reason:'REVIEW_FLAGGED'});
});

test('RC1577: Bericht liest nur und prüft jede Sendung mit POD',async()=>{
  const state={customers:[],shipments:[
    {ref:'OK1',status:'POD vorhanden',pickupToken:'t1',pickupAccessKeyHash:KEY,podFiles:[{name:'ok.pdf',blobName:'ok',type:'application/pdf',renderLayout:'RC1595'}]},
    {ref:'OLD1',status:'POD vorhanden',pickupToken:'t2',pickupAccessKeyHash:KEY,podFiles:[{name:'old.pdf',blobName:'old',type:'application/pdf'}]},
    {ref:'BAD1',status:'POD vorhanden',pickupToken:'t3',pickupAccessKeyHash:KEY2,podFiles:[{name:'bad.pdf',blobName:'missing',type:'application/pdf'}]},
    {ref:'PICK1',status:'Abgeholt',podFiles:[]},
    {ref:'FLAG1',status:'Abgeholt',podReviewRequired:true,podFiles:[]},
    {ref:'MULTI1',status:'POD vorhanden',subShipments:[{},{}],podFiles:[]},
    {ref:'MAN1',status:'POD vorhanden',pickupAccessKeyHash:KEY3,podFiles:[{name:'scan.pdf',type:'application/pdf',manualUpload:true,data:pdfData}]}
  ]};
  const writes=[];
  const fakeClients={team:{getBlockBlobClient:()=>({})},pods:{}};
  await withStubs([
    [store,'clients',async()=>fakeClients],
    [store,'readJson',async()=>({value:{state},etag:'1'})],
    [store,'writeJson',async()=>{writes.push('team');}],
    [store,'mutateRecord',async()=>{writes.push('record');}],
    [store,'getRecord',async key=>({record:key===KEY?{signatureBlobName:'sig',confirmedAt:'2026-10-17T08:41:00Z'}:{}})],
    [integrity,'readStoredPod',async(_c,file)=>file.blobName==='missing'?{ok:false,code:'POD_BLOB_NOT_FOUND'}:{ok:true,bytes:100}]
  ],async()=>{
    const result=await audit.report('production',{cursor:0,limit:25});
    const byRef=Object.fromEntries(result.rows.map(r=>[r.reference,r]));
    assert.deepEqual(Object.keys(byRef).sort(),['BAD1','FLAG1','MAN1','MULTI1','OK1','OLD1']);
    assert.equal(byRef.OK1.verdict,'ok');
    assert.equal(byRef.OLD1.verdict,'regenerate');
    assert.equal(byRef.OLD1.reason,'OLD_LAYOUT');
    assert.equal(byRef.BAD1.verdict,'review');
    assert.equal(byRef.BAD1.missing,'SIGNATURE_NOT_STORED');
    assert.equal(byRef.FLAG1.verdict,'flagged');
    assert.equal(byRef.MULTI1.verdict,'manual');
    assert.equal(byRef.MAN1.verdict,'ok');
    assert.equal(result.nextCursor,null);
    const single=await audit.report('production',{references:['old1']});
    assert.deepEqual(single.rows.map(r=>r.reference),['OLD1']);
    const paged=await audit.report('production',{cursor:0,limit:2});
    assert.deepEqual(paged.rows.map(r=>r.reference),['OK1','OLD1']);
    assert.equal(paged.nextCursor,2);
  });
  assert.deepEqual(writes,[],'Der Bericht darf nichts schreiben');
});

test('RC1577: Endpunkt ist nur für globale Admins',async()=>{
  const run=async user=>{const context={log:{error(){}}};await withStubs([[auth,'validateSession',async()=>({user})],[audit,'report',async()=>({ok:true,rows:[]})]],()=>handler(context,{method:'POST',headers:{},body:{action:'report'}}));return context.res};
  assert.equal((await run({name:'Lager',role:'user'})).status,403);
  const ok=await run({name:'Chef',globalAdmin:true});
  assert.equal(ok.status,200);
});

test('RC1577: hochgeladene PODs tragen das Layout, mit dem sie im Browser erzeugt wurden',()=>{
  assert.equal(podArchive.POD_RENDER_LAYOUT,'RC1595');
  assert.equal(podArchive.renderLayoutOf('rc1561'),'RC1595');
  assert.equal(podArchive.renderLayoutOf('<script>'),'');
  const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
  assert.match(archive,/if \(renderLayout\) file\.renderLayout = renderLayout;/);
  assert.match(archive,/async function saveSuppliedPod\(accessKey, environment, record, pdf, requestedName, options\) \{\n  const primary = await saveAzurePod\(accessKey, environment, record, pdf, requestedName, options\);/);
  assert.match(fs.readFileSync('api/pod-backup/index.js','utf8'),/saveSuppliedPod\(accessKey, resolved\.environment, record, suppliedPdf, fileName, \{ renderLayout: body\.renderLayout \}\)/);
  assert.match(fs.readFileSync('api/shared/pod-integrity-audit.js','utf8'),/saveSuppliedPod\(accessKey,environment,record,archiveRead\.buffer,file\.name,\{renderLayout:file\.renderLayout\}\)/,'Wiederherstellung aus dem Archiv behält die Layout-Kennung');
  assert.match(fs.readFileSync('assets/document-print-name.js','utf8'),/w\.EXPORTHUB_POD_RENDER_LAYOUT='RC1595';/);
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.ok(html.includes("source:q(options.source)||'automatic',renderLayout:q(window.EXPORTHUB_POD_RENDER_LAYOUT)})"),file+': Upload sendet die Layout-Kennung');
  }
});

test('RC1577: markierte PODs bleiben auf Abgeholt, bis der Admin sie freigibt',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.ok(html.includes('pod=!copies.some(function(x){return x&&x.podReviewRequired===true})&&copies.some(function(x){return activePods(x).length>0})'),file+': computeShipmentStatus');
    assert.ok(html.includes('function podDone(sh){\n if(!sh||sh.podReviewRequired===true)return false;'),file+': RC543 podDone');
    assert.ok(html.includes("available&&!reviewHold?'POD vorhanden':'Abgeholt'"),file+': Pickup-Sync');
  }
  assert.ok(fs.readFileSync('api/shared/pickup-store.js','utf8').includes("sh.status=hasPodFile&&sh.podReviewRequired!==true?'POD vorhanden':'Abgeholt';"),'Server-Sync respektiert die Markierung');
});

test('RC1577: POD-Prüfung ist im Build und in allen sechs Sprachen enthalten',async()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/rc1577-pod-quality-audit\.js\?v=1577/);
  assert.match(build,/'assets\/rc1577-pod-quality-audit\.js',\n  'assets\/i18n\/rc1577-pod-quality-audit\.js',/);
  const sandbox={};
  new Function('window',fs.readFileSync('assets/i18n/rc1577-pod-quality-audit.js','utf8'))(sandbox);
  const packs=sandbox.ExportHUBPodAudit1577I18n.packs,keys=Object.keys(packs.de).sort();
  assert.deepEqual(Object.keys(packs).sort(),['de','en','es','fr','it','pl']);
  for(const lang of Object.keys(packs))assert.deepEqual(Object.keys(packs[lang]).sort(),keys,lang+' unvollständig');
  const ui=fs.readFileSync('assets/rc1577-pod-quality-audit.js','utf8');
  for(const reason of ['OLD_LAYOUT','POD_NOT_READABLE','NO_POD_FILE','MULTI_TRUCK','REVIEW_FLAGGED','CURRENT_LAYOUT','MANUAL_UPLOAD','REGENERATE_FAILED'])assert.ok(packs.de['r_'+reason],reason);
  assert.match(ui,/if\(!w\.confirm\(t\('confirm'/,'Änderungen nur nach Bestätigung');
});

test('RC1577: Regressionen laufen in einem Workflow mit',()=>{
  const wf=fs.readFileSync('.github/workflows/rc1577-pod-quality-audit-verify.yml','utf8');
  assert.match(wf,/test\/rc1577-pod-quality-audit\.test\.mjs/);
  assert.match(wf,/e2e\/specs\/rc1577-pod-quality-audit\.spec\.mjs/);
});
