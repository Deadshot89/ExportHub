import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const guard=require('../api/shared/customer-avis-audience.js');

test('RC1349 audiences: only server issued customer audience exposes item-level data',()=>{
 assert.equal(guard.mayReadDeliveryItems({avisAudience:'customer'}),true);
 for(const record of [undefined,null,{}, {avisAudience:'carrier'},{avisAudience:'legacy'},{avisAudience:'CUSTOMER'},{avisAudience:'unknown'}])
  assert.equal(guard.mayReadDeliveryItems(record),false);
});

test('RC1349 access records: recipient class is persisted with the token, never read from URL',()=>{
 const store=fs.readFileSync('api/shared/public-access-store.js','utf8'),
  server=fs.readFileSync('api/customer-avis/index.js','utf8');
 assert.match(store,/avisAudience:kind==='avis'\?require\('\.\/customer-avis-audience'\)\.audience\(meta\.avisAudience\)/);
 assert.match(server,/action==='issue-carrier'/);
 assert.match(server,/isCarrier=action==='issue-carrier'/);
 assert.match(server,/avisAudience=isCarrier\?'carrier':'customer'/);
 assert.match(server,/issuePayload=isCarrier\?\{environment:env\}:payload/);
 assert.match(server,/mayReadDeliveryItems\(accessRecord\)/);
 assert.match(server,/sessionInfo\.record/);
 assert.doesNotMatch(server,/query\.avisAudience|payload\.avisAudience\s*===\s*'customer'/);
});

test('RC1349 public endpoint: only customer token reads private approved items',async()=>{
 const source=fs.readFileSync('api/customer-avis/index.js','utf8');
 const first=source.indexOf('async function withApprovedDeliveryItems('),last=source.indexOf('function validateTime(',first);
 assert.ok(first>=0&&last>first);
 let calls=0;
 const mockRequire=function(id){
  if(id==='../shared/customer-avis-audience')return guard;
  if(id==='../shared/delivery-avis-items-store')return{async publicRows(){calls++;return[{customerOrderNumber:'PO-11',customerItemNumber:'K-12',deliveredQuantity:'30',quantityUnit:'EA'}]}};
  throw Error('unexpected dependency '+id)
 };
 const fn=new Function('require','sref',source.slice(first,last)+';return withApprovedDeliveryItems;')(mockRequire,()=> 'ABC123');
 let result=await fn({ok:true}, {},'testservice',{avisAudience:'carrier'});
 assert.equal(calls,0);assert.ok(!Object.hasOwn(result,'deliveryItems'));
 result=await fn({ok:true},{},'testservice',{avisAudience:'customer'});
 assert.equal(calls,1);assert.equal(result.deliveryItems[0].customerItemNumber,'K-12');
 result=await fn({ok:true},{},'testservice',{});
 assert.equal(calls,1);assert.ok(!Object.hasOwn(result,'deliveryItems'));
});

test('RC1349 all carrier email paths must use dedicated token',()=>{
 const reminder=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8'),
  template=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8'),
  immediate=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8'),
  sender=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
 assert.match(reminder,/url=target==='carrier'\?await carrierAudienceLink\(sh\)/);
 assert.match(reminder,/if\(t==='carrier'\)carrierAudienceLink\(sh\)/);
 assert.match(template,/type==='carrier'\?rc1349CarrierUrl\(sh\)/);
 assert.match(template,/if\(!u\)return stripAvisBlocks\(source\)/);
 assert.match(immediate,/action:'issue-carrier'/);
 assert.match(immediate,/function carrierAvisReady\(sh\)/);
 assert.match(immediate,/pending\.code='AVIS_CARRIER_LINK_PENDING'/);
 assert.match(immediate,/if\(type==='carrier'\)return standaloneAvis\(sh,type,lang,carrierAvisReady\(sh\)\)/);
 assert.match(immediate,/type==='carrier'\?carrierAvisReady\(sh\):q\(opt\.url\)/);
 assert.match(immediate,/if\(type==='carrier'&&!carrierLink\)return false/);
 assert.doesNotMatch(immediate,/return link\|\|'…'/,'Speditionsmails dürfen keinen Platzhalter erhalten');
 assert.match(immediate,/data\.avisAudience!=='carrier'/);
 assert.match(sender,/const requiredAudience=target==='carrier'\?'carrier':'customer'/);
 assert.match(sender,/record\.avisAudience===requiredAudience/);
 assert.match(sender,/await publicAccess\.resolve\(req,'avis',suppliedToken/);
 assert.match(sender,/await publicAccess\.issue\(req,'avis'/);
 assert.match(sender,/avisAudience:requiredAudience/);
 assert.match(sender,/await audienceBoundMailUrl\(/);
 assert.match(sender,/return replaceAvisToken\(original,issued\.token\)/);
});

test('RC1349 review UI: carrier selection prevents PDF item parsing on request',()=>{
 const ui=fs.readFileSync('assets/shipment-document-upload.js','utf8');
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const verify=fs.readFileSync('api/scripts/verify-runtime-sources.cjs','utf8');
 assert.match(ui,/function selectedAvisAudience\(\)/);
 assert.match(ui,/return active\?q\(active\.getAttribute\('data-rc543-target'\)\)/);
 assert.match(ui,/ref!==refOf\(currentShipment\(\)\)\|\|selectedAvisAudience\(\)!=='customer'/);
 assert.match(ui,/if\(selectedAvisAudience\(\)!=='customer'\)\{/);
 assert.match(ui,/if\(target\.closest\('\[data-rc543-target\]'\)\)setTimeout\(scheduleEnsure,0\)/);
 for(const file of ['shared/customer-avis-audience.js','shared/delivery-avis-items.js','shared/delivery-avis-items-store.js','shared/ref-doc-blob-store.js']){
  assert.ok(build.includes("'"+file+"'"),'API build required: '+file);
  assert.ok(verify.includes("'"+file+"'"),'API source checker required: '+file);
 }
});
 
test('RC1349 API review: no PDF processing for carrier or unspecified recipient type',async()=>{
 const source=fs.readFileSync('api/reference-files/index.js','utf8');
 const start=source.indexOf("if(lower(req.query&&req.query.action)==='delivery-items-review'){");
 const end=source.indexOf('const itemId=',start);
 assert.ok(start>=0&&end>start);
 let runs=0;
 const rights={canReadAny:()=>true,canEditAny:()=>true};
 const deliveryItems={async processPending(){runs++;return [{id:'mock'}]}};
 const json=(status,result)=>({status,body:result});
 const fn=new Function('req','internal','rights','deliveryItems','ref','env','json','lower','error','context',
  'return (async function(){'+source.slice(start,end)+'})();');
 for(const recipientType of [undefined,'carrier','unknown']){
  const context={},req={query:{action:'delivery-items-review',recipientType}};
  await fn(req,{user:{}},rights,deliveryItems,'ABC123','testservice',json,v=>String(v||'').toLowerCase(),()=>Error('blocked'),context);
  assert.equal(context.res.body.analysisSkipped,true);
  assert.equal(context.res.body.documents.length,0);
 }
 assert.equal(runs,0,'carrier and unknown audiences may never parse a PDF');
 const context={};
 await fn({query:{action:'delivery-items-review',recipientType:'customer'}},{user:{}},rights,deliveryItems,'ABC123','testservice',json,v=>String(v||'').toLowerCase(),()=>Error('blocked'),context);
 assert.equal(runs,1);
 assert.equal(context.res.body.documents.length,1);
 const ui=fs.readFileSync('assets/shipment-document-upload.js','utf8');
 assert.match(ui,/&recipientType=customer/);
});

test('RC1349 carrier URL cache must not mix shipments with the same reference',()=>{
 const src=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
 const a=src.indexOf('function rc1349CarrierCacheKey('),b=src.indexOf('function carrierAvisCached(',a);
 assert.ok(a>=0&&b>a);
 const fn=new Function('environmentName','explicitReference','shipmentId',
  src.slice(a,b)+';return rc1349CarrierCacheKey;')(
   ()=>'production',sh=>sh.reference,sh=>sh.id);
 const first=fn({reference:'ABC123',id:'shipment-A'});
 const second=fn({reference:'ABC123',id:'shipment-B'});
 assert.ok(first!==second,'Different subjects must never share a carrier token cache entry');
 assert.equal(first,fn({reference:'ABC123',id:'shipment-A'}));
});

test('RC1349 HTML carrier link replaces path and removes hidden customer token parameters',()=>{
 const source=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
 const begin=source.indexOf('function replaceAvisToken('),end=source.indexOf('async function audienceBoundMailUrl(',begin);
 assert.ok(begin>=0&&end>begin);
 const replace=new Function('URL','auth',source.slice(begin,end)+';return replaceAvisToken;')(URL,{error(){throw Error('Invalid URL')}});
 for(const original of [
  'https://www.exporthub360.de/avis/old-customer-token?token=also-customer&avis=legacy&lang=de',
  'https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=old-customer-token&lang=en',
  'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/customer-avis.html?avis=old-customer-token&lang=pl'
 ]){
  const generated=new URL(replace(original,'new-carrier-token'));
  assert.ok(!generated.href.includes('old-customer-token'));
  assert.ok(!generated.href.includes('also-customer'));
  assert.equal(generated.searchParams.get('avis'),null);
  assert.equal(generated.pathname.startsWith('/avis/')?generated.pathname.slice(6):generated.searchParams.get('token'),'new-carrier-token');
 }
});

test('RC1349 HTML mail recipient isolation: wrong-audience and foreign shipment URLs are replaced',async()=>{
 const source=fs.readFileSync('api/avis-reminder-mail/index.js','utf8'),
  start=source.indexOf('function replaceAvisToken('),end=source.indexOf('function subject(',start);
 assert.ok(start>=0&&end>start);
 const a='a'.repeat(48),b='b'.repeat(48),c='c'.repeat(48),d='d'.repeat(48);
 const tokens=new Map([
  [a,{avisAudience:'customer',subjectId:'S-123',reference:'ABC123'}],
  [b,{avisAudience:'carrier',subjectId:'S-123',reference:'ABC123'}],
  [c,{avisAudience:'customer',subjectId:'S-999',reference:'XYZ999'}]
 ]);
 const issued=[];
 const pub={
  async resolve(req,kind,token){if(!tokens.has(token))throw Error('ACCESS_INVALID');return{record:tokens.get(token)}},
  async issue(req,kind,meta){issued.push(meta);return{token:d}}
 };
 const mockAuth={environmentFromRequest(){return'testservice'},error(code,message){return Object.assign(Error(message),{code})}};
 const fn=new Function('URL','auth','publicAccess','safeAvisUrl','text',
  source.slice(start,end)+';return audienceBoundMailUrl;')(
   URL,mockAuth,pub,(req,url)=>url,v=>String(v==null?'':v).trim());
 const sh={id:'S-123',reference:'ABC123'};
 const base='https://testservice.example/customer-avis.html?token=';
 const reused=await fn({},sh,{},'carrier',base+b);
 assert.equal(new URL(reused).searchParams.get('token'),b);
 assert.equal(issued.length,0);
 const fromCustomer=await fn({},sh,{},'carrier',base+a);
 assert.equal(new URL(fromCustomer).searchParams.get('token'),d);
 assert.equal(issued[0].avisAudience,'carrier');
 const fromOther=await fn({},sh,{},'customer',base+c);
 assert.equal(new URL(fromOther).searchParams.get('token'),d);
 assert.equal(issued[1].avisAudience,'customer');
 const correctCustomer=await fn({},sh,{},'customer',base+a);
 assert.equal(new URL(correctCustomer).searchParams.get('token'),a);
 assert.equal(issued.length,2);
 // HTML preview is read-only and cannot borrow a customer's link for a carrier.
 const customerPreview=await fn({},sh,{},'customer',base+a,true);
 assert.equal(new URL(customerPreview).searchParams.get('token'),a);
 const carrierPreview=await fn({},sh,{},'carrier',base+a,true);
 assert.equal(new URL(carrierPreview).searchParams.get('token'),'preview-carrier-no-access');
 assert.equal(issued.length,2,'Preview must not create access records');
});
 
test('RC1349 syntax: recipient-aware modules parse as JavaScript',()=>{
 for(const file of ['api/customer-avis/index.js','api/shared/public-access-store.js','api/shared/customer-avis-audience.js',
  'assets/rc1015-lieferavis-mail-flow.js','assets/rc1027-lieferavis-immediate.js','assets/rc1166-avis-reminder-overview.js','api/avis-reminder-mail/index.js','assets/shipment-document-upload.js']){
  const content=fs.readFileSync(file,'utf8');
  assert.doesNotThrow(()=>new Function(content),file);
 }
});
