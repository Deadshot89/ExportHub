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

test('Urgent internal session switches clear confidential orders, draft content and bearer links',()=>{
 const html=fs.readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 assert.match(html,/function clearExternalTrackingSecrets\(\)/);
 assert.match(html,/\$\('externalShareUrl'\)\.value=''/);
 assert.match(html,/\$\('externalShareExistingLink'\)\.value=''/);
 assert.match(html,/\$\('externalShareResult'\)\.hidden=true/);
 assert.match(html,/function clearUrgentPrivateView\(resetDraft=false\)/);
 assert.match(html,/orders=\[\];canManage=false;viewerId=''/);
 assert.match(html,/\$\('orders'\)\.replaceChildren\(\)/);
 assert.match(html,/window\.addEventListener\('exporthub:logout'/);
 assert.match(html,/window\.addEventListener\('exporthub:user-changed'/);
 assert.match(html,/const epoch=\+\+urgentRefreshEpoch/);
 assert.match(html,/if\(epoch!==urgentRefreshEpoch\)return/);
});

test('Urgent internal view clears bearer secrets and ignores out-of-order session responses',async()=>{
 const vm=(await import('node:vm')).default;
 const html=fs.readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 const between=(start,end)=>{
  const from=html.indexOf(start),to=html.indexOf(end,from);
  assert.ok(from>0&&to>from,'runtime extraction markers found');
  return html.slice(from,to);
 };
 const clearHelpers=between('function clearExternalTrackingSecrets(){','function token(){');
 const refreshFunction=between('async function refresh(){','function berlinCutoffClock(){');
 const nodes={};
 function node(id){
  if(!nodes[id]){
   nodes[id]={value:'previous-secret',textContent:'previous-data',hidden:false,disabled:false,innerHTML:'',
    elements:{externalTrackingLink:{value:'previous-secret'}},
    replaceChildren(){this.childrenCleared=true;this.innerHTML='';},
    addEventListener(){},reset(){this.resetCalled=true;}};
  }
  return nodes[id];
 }
 const pending=[];
 const ctx=vm.createContext({
  $:node,orders:[{id:'previous'}],viewerId:'previous-user',canManage:true,modalOrder:'previous',
  modalKind:'problem',draftNeedsRegenerate:true,urgentRefreshEpoch:0,
  api:async()=>new Promise(resolve=>pending.push(resolve)),
  render:()=>{},renderSavedEmails:()=>{},setMessage:()=>{},localeV2:(_k,fallback)=>fallback,
  localizedLoginRequired:()=> 'Login required',lineField:()=>{},showInternalStep:()=>{}
 });
 vm.runInContext(clearHelpers+'\n'+refreshFunction,ctx);
 vm.runInContext('clearUrgentPrivateView(false)',ctx);
 assert.equal(node('externalShareUrl').value,'');
 assert.equal(node('externalShareExistingLink').value,'');
 assert.equal(node('newOrder').elements.externalTrackingLink.value,'');
 assert.equal(node('externalShareResult').hidden,true);
 assert.equal(node('orders').childrenCleared,true);
 assert.equal(vm.runInContext('orders.length',ctx),0);
 assert.equal(vm.runInContext('canManage',ctx),false);
 assert.equal(vm.runInContext('viewerId',ctx),'');
 const older=vm.runInContext('refresh()',ctx);
 const newer=vm.runInContext('refresh()',ctx);
 assert.equal(pending.length,2);
 pending[1]({orders:[{id:'current-session-order'}],currentUserId:'current-user',
  canManage:true,canImportPackingCatalog:false});
 await newer;
 pending[0]({orders:[{id:'stale-previous-user-order'}],currentUserId:'previous-user',
  canManage:true,canImportPackingCatalog:false});
 await older;
 assert.equal(vm.runInContext('orders[0].id',ctx),'current-session-order');
 assert.equal(vm.runInContext('viewerId',ctx),'current-user');
 assert.equal(vm.runInContext('urgentRefreshEpoch',ctx),2);
});
