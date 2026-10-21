import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
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
  assert.deepEqual(audit.classify({},{files:[{readable:true,manualUpload:true}]}),{verdict:'manual',reason:'MANUAL_UPLOAD'},'manual PDFs cannot be declared visually correct');
  assert.deepEqual(audit.classify({},{files:[old],signatureStored:true,hasToken:true}),{verdict:'regenerate',reason:'OLD_LAYOUT'});
  assert.deepEqual(audit.classify({},{files:[{readable:true,renderLayout:'RC1561'}],signatureStored:true,hasToken:true}),{verdict:'regenerate',reason:'OLD_LAYOUT'},'previously accepted overlapping PODs must be rechecked');
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
    {ref:'MAN1',status:'POD vorhanden',pickupAccessKeyHash:KEY3,podFiles:[{name:'scan.pdf',type:'application/pdf',manualUpload:true,data:pdfData}]},
    {ref:'ARCH1',status:'Abgeschlossen',pickupToken:'t4',pickupAccessKeyHash:KEY,podFiles:[{name:'archive.pdf',blobName:'archive',type:'application/pdf',renderLayout:'RC1561'}]}
  ],savedShipments:[
    {ref:'OK1',status:'Erstellt',podFiles:[]}, // must not hide the canonical POD
    {ref:'SAVED1',status:'Archiviert',pickupToken:'t5',pickupAccessKeyHash:KEY,podFiles:[{name:'saved.pdf',blobName:'saved',type:'application/pdf',renderLayout:'RC1595'}]}
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
    assert.deepEqual(Object.keys(byRef).sort(),['ARCH1','BAD1','FLAG1','MAN1','MULTI1','OK1','OLD1','SAVED1']);
    assert.equal(byRef.OK1.verdict,'ok');
    assert.equal(byRef.OLD1.verdict,'regenerate');
    assert.equal(byRef.OLD1.reason,'OLD_LAYOUT');
    assert.equal(byRef.BAD1.verdict,'review');
    assert.equal(byRef.BAD1.missing,'SIGNATURE_NOT_STORED');
    assert.equal(byRef.FLAG1.verdict,'flagged');
    assert.equal(byRef.MULTI1.verdict,'manual');
    assert.equal(byRef.MAN1.verdict,'manual');
    assert.equal(byRef.ARCH1.verdict,'regenerate','a POD on an already completed shipment must be audited');
    assert.equal(byRef.SAVED1.verdict,'ok','saved-only archived shipments must be audited');
    assert.equal(result.totalShipments,9,'live and saved copies are counted only once');
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
  assert.equal(podArchive.renderLayoutOf('rc1561'),'RC1561');
  assert.equal(podArchive.renderLayoutOf('<script>'),'');
  const archive=fs.readFileSync('api/shared/pod-archive.js','utf8');
  assert.match(archive,/if \(renderLayout\) file\.renderLayout = renderLayout;/);
  assert.match(archive,/async function saveSuppliedPod\(accessKey, environment, record, pdf, requestedName, options\) \{\n  const primary = await saveAzurePod\(accessKey, environment, record, pdf, requestedName, Object\.assign\(\{\}, options, \{ clientSupplied: true \}\)\);/,'Unverified client uploads must retain their true render provenance');
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
  assert.match(build,/rc1577-pod-quality-audit\.js\?v=1596/);
  assert.match(build,/rc1596-pod-folder-reconnect\.js\?v=1596/);
  assert.match(build,/'assets\/rc1577-pod-quality-audit\.js',[\s\S]*'assets\/i18n\/rc1577-pod-quality-audit\.js',/,'The RC1596 folder asset may be copied between POD audit and i18n assets');
  const sandbox={};
  new Function('window',fs.readFileSync('assets/i18n/rc1577-pod-quality-audit.js','utf8'))(sandbox);
  const packs=sandbox.ExportHUBPodAudit1577I18n.packs,keys=Object.keys(packs.de).sort();
  assert.deepEqual(Object.keys(packs).sort(),['de','en','es','fr','it','pl']);
  for(const lang of Object.keys(packs))assert.deepEqual(Object.keys(packs[lang]).sort(),keys,lang+' unvollständig');
  const ui=fs.readFileSync('assets/rc1577-pod-quality-audit.js','utf8');
  assert.match(ui,/response\.status===404/,'HTTP 404 muss als fehlender API-Rollout diagnostiziert werden');
  assert.match(ui,/POD_AUDIT_API_NOT_DEPLOYED/);
  for(const lang of Object.keys(packs))assert.match(packs[lang].apiMissing,/404/);
  for(const reason of ['OLD_LAYOUT','POD_NOT_READABLE','NO_POD_FILE','MULTI_TRUCK','REVIEW_FLAGGED','CURRENT_LAYOUT','MANUAL_UPLOAD','REGENERATE_FAILED','FORCE_REGENERATE'])assert.ok(packs.de['r_'+reason],reason);
  assert.match(ui,/if\(!w\.confirm\(t\('confirm'/,'Änderungen nur nach Bestätigung');
  assert.match(ui,/async function scanReference\(\)/,'Admin benötigt gezielte POD-Suche');
  assert.match(ui,/function forceRegenerate\(\)/,'Admin benötigt ausdrückliche Nach-Erstellung auch für fälschlich OK deklarierte PODs');
  assert.match(ui,/\/\^\[A-Z0-9\]\{6\}\$\//,'Nur sechsstellige Referenzen dürfen abgefragt werden');
});

test('RC1577: Regressionen laufen in einem Workflow mit',()=>{
  const wf=fs.readFileSync('.github/workflows/rc1577-pod-quality-audit-verify.yml','utf8');
  assert.match(wf,/test\/rc1577-pod-quality-audit\.test\.mjs/);
  assert.match(wf,/e2e\/specs\/rc1577-pod-quality-audit\.spec\.mjs/);
});

test('RC1595: combined POD list preserves pickup credentials from duplicate shipment copies',()=>{
 const state={shipments:[{ref:'DUP001',status:'POD vorhanden',pickupToken:'old-token',pickupAccessKeyHash:KEY,podFiles:[]}],
  savedShipments:[{ref:'DUP001',status:'Archiviert',podFiles:[{kind:'automatic-pod',renderLayout:'RC1561'}]},{ref:'SAVED2',status:'POD vorhanden',podFiles:[]}]};
 const combined=audit.allShipmentCopies(state);
 assert.deepEqual(combined.map(s=>s.ref),['DUP001','SAVED2']);
 assert.equal(combined[0].podFiles.length,1);
 assert.equal(combined[0].pickupToken,'old-token');
 assert.equal(combined[0].pickupAccessKeyHash,KEY);
 assert.equal(state.shipments[0].podFiles.length,0,'the underlying shipment state must not be changed by a read-only audit');
 assert.equal(audit.allShipmentCopies({shipments:[{ref:'HOLD01',status:'POD vorhanden',podReviewRequired:true,podReviewReason:'layout',podFiles:[]}],savedShipments:[{ref:'HOLD01',status:'POD vorhanden',podFiles:[{kind:'automatic-pod'}]}]})[0].podReviewRequired,true,'existing review holds must survive merging saved copies');
 assert.equal(audit.relevant({status:'Archiviert',podFiles:[]}),false,'unrelated archived shipments must not be demoted without POD evidence');
 assert.equal(audit.relevant({status:'Archiviert',podBackup:{archiveSaved:true}}),true,'archived shipments with stored POD evidence must be audited');
});

test('RC1613 P0: an exact archived original counts as readable without writing or regenerating a POD',async()=>{
  const bytes=Buffer.from('%PDF-1.7\\n'+'x'.repeat(80));
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const file={id:'original-pod-1',name:'POD_TEST01.pdf',kind:'automatic-pod',blobName:'missing-primary',hash,size:bytes.length,type:'application/pdf',renderLayout:'RC1595'};
  const state={shipments:[{ref:'TEST01',status:'POD vorhanden',pickupAccessKeyHash:KEY,pickupToken:'private-token',podFiles:[file]}],savedShipments:[]};
  const calls=[],writes=[];
  await withStubs([
    [store,'clients',async()=>({team:{getBlockBlobClient:()=>({})},pods:{}})],
    [store,'readJson',async()=>({value:{state}})],
    [store,'writeJson',async()=>{writes.push('team')}],
    [store,'mutateRecord',async()=>{writes.push('pickup')}],
    [store,'getRecord',async()=>({record:{signatureBlobName:'original-signature',confirmedAt:'2026-10-21T17:00:00Z'}})],
    [integrity,'readStoredPod',async()=>({ok:false,status:404,code:'POD_BLOB_NOT_FOUND'})],
    [podArchive,'getPodDownload',async(key,env,fileId)=>{
      calls.push({key,env,fileId});
      return {buffer:bytes,file:{id:fileId,hash}};
    }]
  ],async()=>{
    const report=await audit.report('production',{references:['TEST01']});
    const row=report.rows[0];
    assert.equal(row.verdict,'ok','A verified original must not be offered for regeneration');
    assert.equal(row.files[0].verifiedOriginalReadback,true);
    assert.equal(row.files[0].readable,true);
  });
  assert.deepEqual(calls,[{key:KEY,env:'production',fileId:'original-pod-1'}]);
  assert.deepEqual(writes,[],'No state or historic POD may be changed by admin readback');
});

test('RC1613 P0: wrong archived bytes, wrong id or missing metadata fail closed',async()=>{
  const bytes=Buffer.from('%PDF-1.7\\n'+'y'.repeat(80));
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const original={id:'immutable-2',name:'POD_TEST02.pdf',kind:'automatic-pod',blobName:'missing-primary',hash,type:'application/pdf',renderLayout:'RC1595'};
  const state={shipments:[{ref:'TEST02',status:'POD vorhanden',pickupAccessKeyHash:KEY,pickupToken:'private-token',podFiles:[original]}]};
  const readbacks=[];
  await withStubs([
    [store,'clients',async()=>({team:{getBlockBlobClient:()=>({})},pods:{}})],
    [store,'readJson',async()=>({value:{state}})],
    [store,'getRecord',async()=>({record:{signatureBlobName:'original-signature',confirmedAt:'2026-10-21T17:00:00Z'}})],
    [integrity,'readStoredPod',async()=>({ok:false,status:404,code:'POD_BLOB_NOT_FOUND'})],
    [podArchive,'getPodDownload',async(_key,_env,id)=>{
      readbacks.push(id);
      return {buffer:Buffer.from('%PDF-1.7\\n'+'CORRUPT'.repeat(15)),file:{id}};
    }]
  ],async()=>{
    let row=(await audit.report('production',{references:['TEST02']})).rows[0];
    assert.equal(row.verdict,'regenerate');
    assert.equal(row.reason,'POD_NOT_READABLE');
    assert.equal(row.files[0].readable,false,'Corrupt signed original must be rejected');
    state.shipments[0].podFiles=[{...original,id:'',remoteId:''}];
    row=(await audit.report('production',{references:['TEST02']})).rows[0];
    assert.equal(row.files[0].readable,false,'No unnamed automatic generation is allowed');
    state.shipments[0].podFiles=[{...original,id:'immutable-2',hash:''}];
    row=(await audit.report('production',{references:['TEST02']})).rows[0];
    assert.equal(row.files[0].readable,false,'Missing hash must never enable archive fallback');
  });
  assert.deepEqual(readbacks,['immutable-2'],'Unsafe records must not call the POD server download endpoint');
});
