import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const publicPage=read('assets/urgent-order-report.html');
const internalPage=read('assets/urgent-orders.html');
const menu=read('assets/pack-notification-nav.js');
function inline(page){const m=page.match(/<script>([\s\S]*?)<\/script>/);assert.ok(m,'inline runtime must be present');assert.doesNotThrow(()=>new vm.Script(m[1]));return m[1];}
test('public tabs show separate visible pill counts for open and closed requests',()=>{
 const js=inline(publicPage);
 for(const id of ['countOpen','countClosed'])assert.match(publicPage,new RegExp('id="'+id+'" class="request-count"'));
 assert.match(publicPage,/\.tab \.request-count\{/);
 assert.match(publicPage,/\.tab\[aria-selected="true"\] \.request-count/);
 assert.match(js,/orders\.filter\(o=>!closed\(o\)\)\.length/);
 assert.match(js,/done=orders\.length-open/);
 assert.match(js,/getAttribute|setAttribute\('aria-label','Offen, '/);
 assert.match(js,/setAttribute\('aria-label','Geschlossen, '/);
});
test('internal tabs count all visible requests, independent of search and line count',()=>{
 const js=inline(internalPage);
 for(const id of ['internalOpenCount','internalClosedCount'])assert.match(internalPage,new RegExp('id="'+id+'" class="request-count"'));
 assert.match(internalPage,/\.tabbar \.request-count\{/);
 assert.match(js,/orders\.filter\(isClosedOrder\)\.length/);
 assert.match(js,/orders\.length-n/);
 assert.match(js,/setAttribute\('aria-label','Offen, '/);
 assert.match(js,/setAttribute\('aria-label','Geschlossen, '/);
});
test('navigation counter uses authenticated, privacy-preserving counts endpoint',()=>{
 assert.doesNotThrow(()=>new vm.Script(menu));
 assert.match(menu,/data-urgent-open-count/);
 assert.match(menu,/X-ExportHUB-Token/);
 assert.match(menu,/\/api\/urgent-orders/);
 assert.match(menu,/action:'counts'/);
 assert.doesNotMatch(menu,/body:JSON.stringify\(\{action:'list'\}\)/);
 assert.match(menu,/Number\.isSafeInteger\(data\.open\)/);
 assert.match(menu,/const count=data\.open/);
 assert.match(menu,/if\(authToken\)headers\['X-ExportHUB-Token'\]=authToken/);
 assert.match(menu,/credentials:'same-origin'/);
 assert.doesNotMatch(menu,/if\(!authToken\)\{ui\.badge\.hidden=true/,'cookie-only sessions must still fetch an authorized count');
 assert.match(menu,/setInterval\(\(\)=>refresh\(false\),45000\)/);
 assert.doesNotMatch(menu,/\/api\/urgent-order-public/,'never use anonymous reporter access for global badge');
});
test('badge counts orders, not individual positions, and open Problem orders remain open',()=>{
 const list=[
  {orderNumber:'SO1',items:[{status:'Open'},{status:'Problem'}]},
  {orderNumber:'SO2',items:[{status:'Invoiced'}]},
  {orderNumber:'SO3',items:[{status:'Shipped'},{status:'Invoiced'}]},
  {orderNumber:'SO4',items:[{status:'Invoiced'},{status:'Invoiced'}]},
  {orderNumber:'SO5',items:[{status:'Problem'}]}
 ];
 const closed=o=>o.items.length>0&&o.items.every(x=>x.status==='Invoiced');
 assert.equal(list.filter(x=>!closed(x)).length,3);
 assert.equal(list.filter(closed).length,2);
 assert.equal(list.reduce((n,x)=>n+x.items.length,0),8);
});

test('counts API aggregates authorized orders only and never returns customer details',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url);
 const auth=require('../api/shared/auth-store.js');
 const api=require('../api/urgent-orders/index.js');
 const old=auth.readJson;
 const orders=[
  {id:'a',createdBy:{id:'cs1'},email:'secret-one@example.org',items:[{status:'Open'},{status:'Problem'}]},
  {id:'b',createdBy:{id:'cs2'},email:'secret-two@example.org',items:[{status:'Invoiced'}]},
  {id:'c',createdBy:{id:'REPORTER:opaque'},email:'secret-three@example.org',items:[{status:'Shipped'},{status:'Invoiced'}]},
  {id:'d',createdBy:{id:'cs1'},email:'secret-four@example.org',items:[{status:'Invoiced'},{status:'Invoiced'}]},
  {id:'e',createdBy:{id:'cs2'},email:'secret-five@example.org',items:[{status:'Problem'}]}
 ];
 auth.readJson=async()=>({value:{orders},etag:null});
 try{
  const req={body:{action:'counts'}},refs={blob:{},environment:'testservice'};
  const all=await api.execute(req,{id:'logistics',globalAdmin:true},refs);
  assert.deepEqual({open:all.open,closed:all.closed,total:all.total},{open:3,closed:2,total:5});
  assert.equal(all.environment,'testservice');
  assert.equal(JSON.stringify(all).includes('secret-'),false);
  const own=await api.execute(req,{id:'cs1'},refs);
  assert.deepEqual({open:own.open,closed:own.closed,total:own.total},{open:1,closed:1,total:2});
  const none=await api.execute(req,{id:'outsider'},refs);
  assert.deepEqual({open:none.open,closed:none.closed,total:none.total},{open:0,closed:0,total:0});
  assert.equal('orders' in all,false);
 }finally{auth.readJson=old;}
});
