import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const service=require('../api/shared/sop-service.js');
const api=require('../api/sop-documents/index.js');
const {verifyChain}=require('../api/shared/hash-chain.js');
const NOW='2026-11-13T18:00:00.000Z';
const admin=(user='Manager')=>({user,role:'Benutzer',active:true,rights:{sop:{level:'admin',edit:true,admin:true}}});
const editor=()=>({user:'Editor',role:'Benutzer',active:true,rights:{sop:{level:'edit',edit:true}}});
const readOnly=()=>({user:'Reader',role:'Benutzer',active:true,rights:{sop:{level:'view'}}});
const sections=()=>({
 purpose:'Alte deutsche Zweckbeschreibung',
 scope:'Warenausgang',
 responsibilities:[{text:'Versandteam'}],
 prerequisites:[{text:'Unterlagen bereithalten'}],
 checks:[{text:'Sendung prüfen'}],
 deviations:[{text:'Bei Fehler melden'}],
 records:[{text:'Ladeliste archivieren'}],
 steps:[{id:'step-1',number:1,text:'Sendung kontrollieren'}]
});
function item(number='SOP-EH-020') {
 return {number,title:'Kunden und Kontakte',area:'Export',sections:sections(),
   version:'2.0',status:'Freigegeben',approvedBy:'Legacy-Fake',approvedAt:'2026-09-09T12:35:00.000Z',
   auditTrail:[{action:'Freigegeben'}],versions:[{status:'Freigegeben'}],untrusted:'discard me'};
}
function payload(items=[item()],en=undefined){return {items,...(en===undefined?{}:{en})};}
function expectCode(code,status){return e=>e&&e.code===code&&e.status===status;}
function mock() {
 const items=new Map(),writes=[];
 const auth={
   async validateSession(req){
     if(!req.fakeUser)throw Object.assign(new Error('no session'),{status:401,code:'AUTH_REQUIRED'});
     return{user:req.fakeUser};
   },
   environmentFromRequest(req){return req.fakeEnvironment||'production';}
 };
 const store={
   async listDocs(environment){return [...items].filter(([key])=>key.startsWith(environment+'/')).map(([,doc])=>structuredClone(doc));},
   async getDoc(environment,id){return structuredClone(items.get(environment+'/'+id)||null);},
   async mutateDoc(environment,id,updater,{create=false}={}){
     const key=environment+'/'+id,previous=items.get(key)||null;
     if(create&&previous)throw Object.assign(new Error('exists'),{status:409,code:'SOP_EXISTS'});
     if(!create&&!previous)throw Object.assign(new Error('missing'),{status:404,code:'SOP_NOT_FOUND'});
     const doc=await updater(structuredClone(previous));
     writes.push(key);
     items.set(key,structuredClone(doc));
     return structuredClone(doc);
   }
 };
 async function request(body,user=admin(),opts={}) {
   const context={log:{warn(){}}};
   const req={method:'POST',body,fakeUser:user,fakeEnvironment:opts.environment||'production'};
   await api._test.handle(context,req,{auth,store,now:()=>NOW,...(opts.enabled===false?{}:{featureEnabled:true})});
   return{status:context.res.status,body:JSON.parse(context.res.body)};
 }
 return {items,writes,store,auth,request};
}

test('RC1016 manifest defines exactly 24 consolidated IDs, without claiming live import',()=>{
 const source=fs.readFileSync(new URL('../assets/sop/rc1016-sop-consolidation.js',import.meta.url),'utf8');
 const start=source.indexOf('const groups=['),end=source.indexOf('\n];',start);
 assert.ok(start>=0&&end>start);
 const matches=[...source.slice(start,end).matchAll(/^\s*\['(SOP-EH-\d{3})','([^']+)',\[/gm)];
 assert.equal(matches.length,24);assert.equal(new Set(matches.map(x=>x[1])).size,24);
});
test('import produces draft 0.1 with traceable RC1016 audit but no inherited approval',()=>{
 const {docs,skipped,errors}=service.importLegacy([],payload(),admin(),NOW);
 assert.equal(docs.length,1);assert.deepEqual(skipped,[]);assert.deepEqual(errors,[]);
 const doc=docs[0],version=doc.versions[0];
 assert.equal(doc.schemaVersion,1);assert.equal(doc.revision,1);
 assert.equal(version.version,'0.1');assert.equal(version.status,'draft');
 assert.equal(version.author,'manager');assert.equal(version.lastEditor,'manager');
 for (const key of ['approvedAt','approvedBy','submittedAt','submittedBy','reviewedBy']) assert.equal(version[key],undefined);
 assert.equal(doc.events[0].action,'IMPORTED');
 assert.equal(doc.events[0].actor,'manager');
 assert.equal(doc.events[0].data.source,'RC1016');
 assert.equal(doc.events[0].data.note,'importiert aus Handbuch RC1016, nicht freigegeben');
 assert.equal(verifyChain(doc.events).ok,true);
 assert.doesNotThrow(()=>service.assertDocumentIntegrity(doc));
 assert.equal(doc.functionId,'legacy-rc1016');
 assert.equal(JSON.stringify(doc).includes('Legacy-Fake'),false);
 assert.equal(JSON.stringify(doc).includes('discard me'),false);
});
test('German text and list entries retain their original characters and order',()=>{
 const source=item();source.sections.steps.push({id:'step-2',text:'Lieferschein · € prüfen'});
 source.sections.purpose='  Zweck  mit  Leerzeichen ';
 const doc=service.importLegacy([],payload([source]),admin(),NOW).docs[0];
 assert.equal(doc.versions[0].content.de.purpose,'  Zweck  mit  Leerzeichen ');
 assert.deepEqual(doc.versions[0].content.de.responsibilities,['Versandteam']);
 assert.deepEqual(doc.versions[0].content.de.prerequisites,['Unterlagen bereithalten']);
 assert.equal(doc.versions[0].content.steps[1].de,'Lieferschein · € prüfen');
 assert.equal(doc.versions[0].content.steps[1].en,'');
});
test('English remains empty when none is supplied; draft cannot be approved accidentally',()=>{
 const doc=service.importLegacy([],payload(),admin(),NOW).docs[0];
 assert.equal(doc.versions[0].content.en.purpose,'');
 assert.deepEqual(doc.versions[0].content.en.checks,[]);
 assert.equal(doc.versions[0].content.steps[0].en,'');
 assert.throws(()=>service.submit(doc,{revision:1,version:'0.1'},admin(),NOW),expectCode('CONTENT_INCOMPLETE',422));
 assert.throws(()=>service.approve(doc,{revision:1,version:'0.1'},admin('Other'),NOW),expectCode('NOT_IN_REVIEW',409));
});
test('provided English translation is copied without invented German fallback',()=>{
 const en={'SOP-EH-020':{purpose:'Verify shipment',scope:'Dispatch',responsibilities:['Team'],checks:['Check'],records:['CMR'],steps:['Verify goods']}};
 const doc=service.importLegacy([],payload([item()],en),admin(),NOW).docs[0];
 assert.equal(doc.versions[0].content.en.purpose,'Verify shipment');
 assert.equal(doc.versions[0].content.steps[0].en,'Verify goods');
 assert.equal(doc.versions[0].status,'draft');
});
test('existing documents and repeated numbers are skipped, even on a second attempt',()=>{
 const in1=service.importLegacy(['SOP-EH-020'],payload([item(),item('SOP-EH-030')]),admin(),NOW);
 assert.deepEqual(in1.docs.map(d=>d.id),['SOP-EH-030']);assert.deepEqual(in1.skipped,['SOP-EH-020']);
 const in2=service.importLegacy(['SOP-EH-020','SOP-EH-030'],payload([item(),item('SOP-EH-030')]),admin(),NOW);
 assert.equal(in2.docs.length,0);assert.deepEqual(in2.skipped,['SOP-EH-020','SOP-EH-030']);
 const same=service.importLegacy([],payload([item(),item()]),admin(),NOW);
 assert.equal(same.docs.length,1);assert.deepEqual(same.skipped,['SOP-EH-020']);
});
test('invalid IDs are skipped with structured error rather than path traversal',()=>{
 const res=service.importLegacy([],payload([item('../x'),item('SOP-EH-002')]),admin(),NOW);
 assert.deepEqual(res.docs.map(d=>d.id),['SOP-EH-002']);
 assert.deepEqual(res.skipped,['../x']);
 assert.deepEqual(res.errors,[{number:'../x',code:'INVALID_SOP_ID'}]);
});
test('invalid source sections are reported per record, leaving other records available',()=>{
 const bad=item('SOP-EH-021');bad.sections.checks={text:'not an array'};
 const result=service.importLegacy([],payload([bad,item('SOP-EH-022')]),admin(),NOW);
 assert.deepEqual(result.docs.map(d=>d.id),['SOP-EH-022']);
 assert.deepEqual(result.skipped,['SOP-EH-021']);
 assert.equal(result.errors[0].code,'LEGACY_FIELD_INVALID');
});
test('only SOP administrators may import (not ordinary SOP editors, readers, disabled users)',()=>{
 for(const u of [editor(),readOnly(),{...admin(),disabled:true},null]){
   assert.throws(()=>service.importLegacy([],payload(),u,NOW),expectCode('SOP_IMPORT_FORBIDDEN',403));
 }
 assert.equal(service.canImportLegacy(admin()),true);
 assert.equal(service.canImportLegacy(editor()),false);
});
test('global administrator may import while bogus request-admin fields are discarded',()=>{
 const globalAdmin={user:'Global',role:'Administrator',active:true,rights:{}};
 const docs=service.importLegacy([],payload([item()]),globalAdmin,NOW).docs;
 assert.equal(docs.length,1);assert.equal(docs[0].versions[0].author,'global');
});
test('61 entries are rejected before writing and 2 MiB payload is rejected',()=>{
 assert.throws(()=>service.importLegacy([],payload(Array.from({length:61},(_,i)=>item('SOP-EH-'+String(i+1).padStart(3,'0')))),admin(),NOW),expectCode('IMPORT_LIMIT',400));
 assert.throws(()=>service.importLegacy([],payload([item('SOP-EH-020')],{'SOP-EH-020':{purpose:'X'.repeat(2*1024*1024)}}),admin(),NOW),expectCode('REQUEST_TOO_LARGE',413));
});
test('API requires a signed session and SOP admin, even though a writer may edit drafts',async()=>{
 const f=mock();
 let out=await f.request({action:'import-legacy',...payload()},null);
 assert.equal(out.status,401);assert.equal(out.body.code,'AUTH_REQUIRED');
 out=await f.request({action:'import-legacy',...payload()},editor());
 assert.equal(out.status,403);assert.equal(out.body.code,'SOP_IMPORT_FORBIDDEN');
 out=await f.request({action:'import-legacy',...payload()},readOnly());
 assert.equal(out.status,403);assert.equal(out.body.code,'SOP_EDIT_FORBIDDEN');
 assert.equal(f.items.size,0);assert.equal(f.writes.length,0);
});
test('API import is idempotent, includes skip list and writes only in requested environment',async()=>{
 const f=mock();const request={action:'import-legacy',...payload()};
 const first=await f.request(request);
 assert.equal(first.status,200);assert.equal(first.body.importedCount,1);assert.deepEqual(first.body.imported,['SOP-EH-020']);
 const doc=f.items.get('production/SOP-EH-020');
 assert.equal(doc.versions[0].status,'draft');
 const firstRaw=JSON.stringify(doc);
 const second=await f.request(request);
 assert.equal(second.status,200);assert.equal(second.body.importedCount,0);assert.deepEqual(second.body.skipped,['SOP-EH-020']);
 assert.equal(JSON.stringify(f.items.get('production/SOP-EH-020')),firstRaw);assert.equal(f.writes.length,1);
 const third=await f.request(request,admin(),{environment:'testservice'});
 assert.equal(third.status,200);assert.deepEqual(third.body.imported,['SOP-EH-020']);
 assert.ok(f.items.has('testservice/SOP-EH-020'));
 assert.equal(JSON.stringify(f.items.get('production/SOP-EH-020')),firstRaw);
});
test('API does not overwrite a racing concurrent import',async()=>{
 const f=mock();const base=f.store.mutateDoc;
 f.store.mutateDoc=async (env,id,cb,opts)=>{
   if(!f.items.has(env+'/'+id)){
     const prev=service.importLegacy([],payload([item()]),admin('Other'),NOW).docs[0];
     f.items.set(env+'/'+id,prev);
   }
   return base(env,id,cb,opts);
 };
 const r=await f.request({action:'import-legacy',...payload()});
 assert.equal(r.status,200);assert.equal(r.body.importedCount,0);
 assert.deepEqual(r.body.skipped,['SOP-EH-020']);
 assert.equal(f.items.get('production/SOP-EH-020').versions[0].author,'other');
});
test('a failing Azure write reports partial results and can safely resume later',async()=>{
 const f=mock(),base=f.store.mutateDoc;
 let failOnSecond=true;
 f.store.mutateDoc=async(env,id,cb,opts)=>{
   if(id==='SOP-EH-021'&&failOnSecond)throw Object.assign(new Error('Azure secret hidden'),{code:'STORAGE_UNAVAILABLE',status:503});
   return base(env,id,cb,opts);
 };
 const req={action:'import-legacy',...payload([item('SOP-EH-020'),item('SOP-EH-021')])};
 const first=await f.request(req);
 assert.equal(first.status,503);assert.equal(first.body.code,'IMPORT_PARTIAL');
 assert.deepEqual(first.body.imported,['SOP-EH-020']);assert.equal(first.body.failedId,'SOP-EH-021');
 assert.equal(first.body.errors.length,0);assert.equal(JSON.stringify(first.body).includes('Azure secret hidden'),false);
 failOnSecond=false;const second=await f.request(req);
 assert.equal(second.status,200);assert.deepEqual(second.body.imported,['SOP-EH-021']);assert.deepEqual(second.body.skipped,['SOP-EH-020']);
});
test('API maximum body limit rejects request before any data is created',async()=>{
 const f=mock();const tooLarge={action:'import-legacy',items:[item()],en:{'SOP-EH-020':{purpose:'Y'.repeat(2*1024*1024)}}};
 const x=await f.request(tooLarge);
 assert.equal(x.status,413);assert.equal(x.body.code,'REQUEST_TOO_LARGE');
 assert.equal(f.items.size,0);
});
test('new import action remains inaccessible while the API feature flag is disabled',async()=>{
 const f=mock();const x=await f.request({action:'import-legacy',...payload()},admin(),{enabled:false});
 assert.equal(x.status,404);assert.equal(x.body.code,'SOP2_DISABLED');
 assert.equal(f.items.size,0);
});
test('24 representative legacy catalog IDs import as drafts without a live write',()=>{
 const text=fs.readFileSync(new URL('../assets/sop/rc1016-sop-consolidation.js',import.meta.url),'utf8');
 const start=text.indexOf('const groups=['),end=text.indexOf('\n];',start);
 const defs=[...text.slice(start,end).matchAll(/^\s*\['(SOP-EH-\d{3})','([^']+)',\[/gm)];
 const data=defs.map((m)=>({...item(m[1]),title:m[2]}));
 const result=service.importLegacy([],payload(data),admin(),NOW);
 assert.equal(result.docs.length,24);
 assert.equal(result.docs.every(d=>d.versions[0].version==='0.1'&&d.versions[0].status==='draft'),true);
 assert.equal(new Set(result.docs.map(d=>d.id)).size,24);
 assert.deepEqual(result.skipped,[]);
});
