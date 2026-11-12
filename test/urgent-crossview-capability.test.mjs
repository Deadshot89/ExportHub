import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const auth=require('../api/shared/auth-store.js');
const internal=require('../api/urgent-orders/index.js');
const external=require('../api/urgent-order-public/index.js');
const reporter=require('../api/shared/urgent-reporter-capability.js');

const base=(orderNumber,email='cs@example.org')=>({
 orderNumber,delivery:'DRP',priority:'P2',email,language:'de',
 requestedDispatchDate:'2099-11-12',
 items:[{line:'10',article:'ART-3002',quantity:1,pickableStock:true,holdsClear:true}]
});
const creator={id:'cs-own',name:'Mitarbeiter'};
const logistics={id:'logistics',name:'Logistik',rights:{shipmentoverview:{edit:true}}};
const reader={id:'reader',name:'Logistik Leserechte',rights:{shipmentoverview:{view:true}}};
const stranger={id:'stranger',rights:{tasks:{view:true}}};
const req=body=>({body,headers:{'x-forwarded-for':'192.0.2.123'}});

test('Internal and external Urgent Orders share one store without exposing unrelated orders',async()=>{
 const oldRead=auth.readJson,oldWrite=auth.writeJson;
 const state={orders:[],reporterGroups:[],profiles:{}};
 auth.readJson=async()=>({value:state,etag:'test'});
 auth.writeJson=async(_blob,value)=>{Object.assign(state,value);return{etag:'updated'};};
 const refs={blob:{},environment:'testservice'};
 try{
  const first=await internal.execute(req({action:'create',...base('SO300200214125')}),creator,refs);
  assert.equal(first.order.reporterId,undefined,'internal orders are private until explicitly linked');
  assert.deepEqual((await internal.execute(req({action:'list'}),reader,refs)).orders.map(x=>x.orderNumber),['SO300200214125']);
  assert.equal((await internal.execute(req({action:'list'}),stranger,refs)).orders.length,0);

  await assert.rejects(
   internal.execute(req({action:'share-external',id:first.order.id}),stranger,refs),
   error=>error.code==='URGENT_FORBIDDEN'
  );
  const shared=await internal.execute(req({action:'share-external',id:first.order.id}),creator,refs);
  assert.match(shared.accessToken,/^uro_[A-Za-z0-9_-]{43}$/);
  assert.equal(state.orders[0].externalSharedFromInternal,true);
  assert.equal(JSON.stringify(state).includes(shared.accessToken),false,'never save raw token in Azure');
  const link='https://example.org/urgent-order#access='+shared.accessToken;
  assert.equal(reporter.extractToken(link),shared.accessToken);
  const visible=await external.publicAction(req({action:'list',accessToken:shared.accessToken}),refs);
  assert.deepEqual(visible.orders.map(x=>x.orderNumber),['SO300200214125']);
  assert.equal(visible.orders[0].canRequestDeletion,false);

  const newExternal=await external.publicAction(req({action:'create',...base('SO300200214126'),accessToken:shared.accessToken}),refs);
  assert.equal(newExternal.order.orderNumber,'SO300200214126');
  const linkedInternal=await internal.execute(req({action:'create',...base('SO300200214127'),externalTrackingLink:link}),creator,refs);
  assert.equal(linkedInternal.order.reporterId,shared.order.reporterId);
  const historic=await internal.execute(req({action:'create',...base('SO300200214128')}),creator,refs);
  const sharedHistoric=await internal.execute(req({action:'share-external',id:historic.order.id,externalTrackingLink:link}),creator,refs);
  assert.equal(sharedHistoric.order.reporterId,shared.order.reporterId,'existing internal orders can join the same tracking link');
  assert.equal(sharedHistoric.accessToken,shared.accessToken);
  const all=(await internal.execute(req({action:'list'}),reader,refs)).orders.map(x=>x.orderNumber).sort();
  assert.deepEqual(all,['SO300200214125','SO300200214126','SO300200214127','SO300200214128']);
  const publicList=(await external.publicAction(req({action:'list',accessToken:shared.accessToken}),refs)).orders.map(x=>x.orderNumber).sort();
  assert.deepEqual(publicList,all,'linked internal and external submissions are visible under the same capability');

  await assert.rejects(
   internal.execute(req({action:'create',...base('SO300200214129','someone-else@example.org'),externalTrackingLink:link}),creator,refs),
   error=>error.code==='URGENT_REPORTER_EMAIL_MISMATCH'
  );
  await assert.rejects(
   internal.execute(req({action:'share-external',id:first.order.id}),logistics,refs),
   error=>error.code==='URGENT_ALREADY_SHARED'
  );
  await assert.rejects(
   external.publicAction(req({action:'request-delete',id:first.order.id,accessToken:shared.accessToken}),refs),
   error=>error.code==='URGENT_REPORTER_DELETE_FORBIDDEN'
  );
  assert.equal(state.orders.length,4,'rejected writes never duplicate or remove orders');
 }finally{auth.readJson=oldRead;auth.writeJson=oldWrite;}
});

test('Urgent Order links require exact token and never support lookup by email alone',()=>{
 const created=reporter.issue();
 const doc={reporterGroups:[{id:created.id,tokenHash:created.tokenHash,email:'cs@example.org'}]};
 assert.equal(reporter.groupByToken(doc,created.token).id,created.id);
 for(const value of ['', 'cs@example.org','other','uro_wrong','http://example.org/urgent-order#access='+created.token]){
  assert.equal(reporter.extractToken(value),'');
 }
 assert.equal(reporter.groupByToken(doc,'cs@example.org'),null);
});

test('Both forms expose scoped cross-view actions, not an anonymous global list',()=>{
 const inner=fs.readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 const outer=fs.readFileSync(new URL('../assets/urgent-order-report.html',import.meta.url),'utf8');
 assert.match(inner,/externalTrackingLink/);
 assert.match(inner,/externalShareExistingLink/);
 assert.match(inner,/data-share-external/);
 assert.match(inner,/action:'share-external'|api\('share-external'/);
 assert.match(outer,/canRequestDeletion===false/);
 assert.doesNotMatch(outer,/action:'list-all'/);
});

test('Cross-view interface labels are translated in all six supported languages',()=>{
 const keys=[
  'crossviewExistingLinkLabel','crossviewExistingLinkHelp','crossviewShareResultLabel',
  'crossviewCopyLink','crossviewShareWarning','crossviewShareAction',
  'crossviewLinkedLabel','crossviewShareConfirm','crossviewShareSuccess',
  'crossviewLinkCopied','crossviewLinkManualCopy','crossviewLinkedNoDelete','crossviewReuseExistingLinkLabel'
 ];
 for(const lang of ['de','en','pl','es','fr','it']){
  const pack=JSON.parse(fs.readFileSync(new URL('../assets/i18n/'+lang+'.json',import.meta.url),'utf8'));
  for(const key of keys)assert.ok(pack['urgentOrderV2.'+key],lang+' missing '+key);
 }
});
