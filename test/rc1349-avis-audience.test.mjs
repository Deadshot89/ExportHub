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
 assert.match(immediate,/type==='carrier'\?carrierAvisForMail\(sh\):url/);
 assert.match(immediate,/type==='carrier'\?carrierAvisForMail\(sh\):q\(opt\.url\)/);
 assert.match(immediate,/return link\|\|'…'/);
 assert.match(immediate,/data\.avisAudience!=='carrier'/);
 assert.match(sender,/target!=='carrier'\)return original/);
 assert.match(sender,/await publicAccess\.issue\(req,'avis'/);
 assert.match(sender,/avisAudience:'carrier'/);
 assert.match(sender,/await audienceBoundMailUrl\(/);
 assert.match(sender,/return replaceAvisToken\(original,issued\.token\)/);
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

test('RC1349 syntax: recipient-aware modules parse as JavaScript',()=>{
 for(const file of ['api/customer-avis/index.js','api/shared/public-access-store.js','api/shared/customer-avis-audience.js',
  'assets/rc1015-lieferavis-mail-flow.js','assets/rc1027-lieferavis-immediate.js','assets/rc1166-avis-reminder-overview.js','api/avis-reminder-mail/index.js']){
  const content=fs.readFileSync(file,'utf8');
  assert.doesNotThrow(()=>new Function(content),file);
 }
});
