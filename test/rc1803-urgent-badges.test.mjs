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
 assert.match(js,/setAttribute\('aria-label',localeV2\('tabOpen','Offene Anfragen'\)/);
 assert.match(js,/setAttribute\('aria-label',localeV2\('tabClosed','Geschlossene Anfragen'\)/);
});
test('internal tabs count all visible requests, independent of search and line count',()=>{
 const js=inline(internalPage);
 for(const id of ['internalOpenCount','internalClosedCount'])assert.match(internalPage,new RegExp('id="'+id+'" class="request-count"'));
 assert.match(internalPage,/\.tabbar \.request-count\{/);
 assert.match(js,/orders\.filter\(isClosedOrder\)\.length/);
 assert.match(js,/orders\.length-n/);
 assert.match(js,/setAttribute\('aria-label',localeV2\('tabOpen','Offene Anfragen'\)/);
 assert.match(js,/setAttribute\('aria-label',localeV2\('tabClosed','Geschlossene Anfragen'\)/);
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

test('navigation badge uses cookie-only sessions and never shows a stale count after account switch',async()=>{
 const source=menu.slice(menu.indexOf('/* Urgent Order: a lightweight, permission-scoped open-request count'));
 assert.ok(source.startsWith('/* Urgent Order:'),'isolate real urgent nav IIFE');
 const handlers={},requests=[],styleHost={appendChild(node){styleHost.style=node;}};
 const node={attributes:{},badge:null,setAttribute(k,v){this.attributes[k]=v;},appendChild(el){this.badge=el;},querySelector(sel){return sel==='[data-urgent-open-count]'?this.badge:null;}};
 const d={hidden:false,readyState:'complete',head:styleHost,documentElement:styleHost,
  querySelector(sel){return sel==='[data-exporthub-urgent-nav]'?node:null;},
  getElementById(id){return id==='exporthub-urgent-nav-counter-style'?styleHost.style||null:null;},
  createElement(name){return {tagName:name,hidden:false,dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;}};},
  addEventListener(name,fn){handlers[name]=fn;}};
 const w={document:d,sessionStorage:{getItem(){return'{}';}},
  addEventListener(name,fn){handlers[name]=fn;},setInterval(){},
  fetch(url,init){let finish;const promise=new Promise(resolve=>finish=resolve);requests.push({url,init,finish});return promise;}};
 vm.runInNewContext(source,{window:w,document:d,globalThis:w,Date,Promise,JSON,Number,Error});
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,'/api/urgent-orders');
 assert.deepEqual(JSON.parse(requests[0].init.body),{action:'counts'});
 assert.equal(requests[0].init.credentials,'same-origin','browser sends HttpOnly session cookie');
 assert.equal('X-ExportHUB-Token' in requests[0].init.headers,false,'no readable token is required');
 handlers['exporthub:user-changed']();
 assert.equal(node.badge.hidden,true,'clear previous account badge immediately');
 requests[0].finish({ok:true,json:async()=>({ok:true,open:99})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(node.badge.hidden,true,'stale response must not become visible');
 assert.equal(requests.length,2,'current account must be reloaded');
 requests[1].finish({ok:true,json:async()=>({ok:true,open:3})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(node.badge.textContent,'3');
 assert.equal(node.badge.hidden,false);
 handlers['exporthub:logout']();
 assert.equal(node.badge.hidden,true,'logout hides count immediately');
});

test('RC1960: rejected badge counts back off 5 minutes, but a new session retries immediately',async()=>{
 const source=menu.slice(menu.indexOf('/* Urgent Order: a lightweight, permission-scoped open-request count'));
 assert.ok(source.startsWith('/* Urgent Order:'));
 for(const denial of [401,403]){
  let now=1000000,calls=0,reply={ok:false,status:denial};
  const handlers={},styleHost={appendChild(node){styleHost.style=node}};
  const node={badge:null,setAttribute(){},appendChild(el){this.badge=el},
   querySelector(sel){return sel==='[data-urgent-open-count]'?this.badge:null}};
  const d={hidden:false,readyState:'complete',head:styleHost,documentElement:styleHost,
   querySelector(sel){return sel==='[data-exporthub-urgent-nav]'?node:null},
   getElementById(id){return id==='exporthub-urgent-nav-counter-style'?styleHost.style||null:null},
   createElement(name){return {tagName:name,hidden:false,dataset:{},setAttribute(){}}},
   addEventListener(name,fn){handlers[name]=fn}};
  const w={document:d,sessionStorage:{getItem(){return '{}'}},
   addEventListener(name,fn){handlers[name]=fn},setInterval(){},
   async fetch(){calls++;return reply}};
  const Clock={now:()=>now};
  vm.runInNewContext(source,{window:w,document:d,globalThis:w,Date:Clock,Promise,JSON,Number,Error});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await flush();
  assert.equal(calls,1,'first cookie-only request is always attempted');
  assert.equal(node.badge.hidden,true,'a denial cannot expose stale counts');
  for(const event of ['focus','exporthub:state-loaded','focus'])handlers[event]();
  await flush();
  assert.equal(calls,1,'focus and state-loaded cannot flood denied endpoint');
  now+=299999;handlers.focus();await flush();
  assert.equal(calls,1,'still inside the auth backoff window');
  now+=2;reply={ok:true,status:200,json:async()=>({ok:true,open:4})};
  handlers.focus();await flush();
  assert.equal(calls,2,'bounded retry is allowed after five minutes');
  assert.equal(node.badge.textContent,'4');
  assert.equal(node.badge.hidden,false);
  // RC1965: a successful count is rate-limited for 45 seconds even on focus.
  now+=45001;reply={ok:false,status:denial};handlers.focus();await flush();
  assert.equal(calls,3);
  assert.equal(node.badge.hidden,true);
  reply={ok:true,status:200,json:async()=>({ok:true,open:2})};
  handlers['exporthub:authenticated']();await flush();
  assert.equal(calls,4,'a real session event bypasses cooldown and refreshes');
  assert.equal(node.badge.textContent,'2');
  assert.equal(node.badge.hidden,false);
  handlers['exporthub:logout']();handlers.focus();await flush();
  assert.equal(calls,4,'after logout the protected counts API is never called');
  assert.equal(node.badge.hidden,true);
 }
});


test('RC1965: successful Urgent badge count is not refetched on focus/state/visibility storms',async()=>{
 const source=menu.slice(menu.indexOf('/* Urgent Order: a lightweight, permission-scoped open-request count'));
 let now=1000000;
 const requests=[],listeners={},intervals=[];
 const styleHost={appendChild(el){this.el=el}};
 const node={badge:null,attrs:{},setAttribute(k,v){this.attrs[k]=v},appendChild(el){this.badge=el},
  querySelector(sel){return sel==='[data-urgent-open-count]'?this.badge:null}};
 const d={hidden:false,readyState:'complete',head:styleHost,documentElement:styleHost,
  querySelector(sel){return sel==='[data-exporthub-urgent-nav]'?node:null},
  getElementById(id){return id==='exporthub-urgent-nav-counter-style'?styleHost.el||null:null},
  createElement(name){return {tagName:name,hidden:false,dataset:{},setAttribute(){}}},
  addEventListener(name,fn){listeners['doc:'+name]=fn}};
 const w={document:d,sessionStorage:{getItem(){return '{}'}},
  addEventListener(name,fn){listeners[name]=fn},
  setInterval(fn,ms){intervals.push({fn,ms})},
  async fetch(url,config){requests.push({url,config});return {ok:true,status:200,json:async()=>({ok:true,open:requests.length})}}};
 vm.runInNewContext(source,{window:w,globalThis:w,document:d,Date:{now:()=>now},Promise,JSON,Number,Error});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 await flush();
 assert.equal(requests.length,1,'one initial authenticated counts request');
 assert.equal(node.badge.textContent,'1');
 assert.equal(node.badge.hidden,false);
 assert.equal(intervals[0].ms,45000,'normal periodic refresh is unchanged');
 for(let i=0;i<8;i++){
  listeners.focus();
  listeners['exporthub:state-loaded']();
  listeners['doc:visibilitychange']();
  intervals[0].fn();
 }
 await flush();
 assert.equal(requests.length,1,'repeated UI events do not bypass 45s rate limit');
 now+=44999;
 listeners.focus();await flush();
 assert.equal(requests.length,1,'no extra call just before deadline');
 now+=1;
 listeners['doc:visibilitychange']();await flush();
 assert.equal(requests.length,2,'an authorized refresh happens after 45s');
 assert.equal(node.badge.textContent,'2');
 now+=1;
 listeners['exporthub:authenticated']();await flush();
 assert.equal(requests.length,3,'new login must refresh immediately, bypassing cooldown');
 assert.equal(node.badge.textContent,'3');
 listeners['exporthub:logout']();
 listeners.focus();listeners['exporthub:state-loaded']();intervals[0].fn();
 await flush();
 assert.equal(requests.length,3,'logout must disable further protected requests');
 assert.equal(node.badge.hidden,true);
});


test('RC1991: Urgent nav stops retrying repeated API 5xx for five minutes, but keeps original failures visible to the browser gate',async()=>{
 const source=menu.slice(menu.indexOf('/* Urgent Order: a lightweight, permission-scoped open-request count'));
 assert.ok(source.startsWith('/* Urgent Order:'));
 // Never modify the strict E2E error policy: HTTP 5xx remains a release failure.
 assert.match(read('e2e/helpers/exporthub-browser.mjs'),/expect\(payload\.httpErrors,'HTTP-5xx bei Kern-Requests'\)\.toEqual\(\[\]\)/);
 for(const unavailable of [500,502,503]){
  let now=1000000,status=unavailable,calls=0;
  const listeners={},intervals=[],styleHost={appendChild(el){this.style=el}};
  const node={badge:null,setAttribute(){},appendChild(el){this.badge=el},
   querySelector(sel){return sel==='[data-urgent-open-count]'?this.badge:null}};
  const d={hidden:false,readyState:'complete',head:styleHost,documentElement:styleHost,
   querySelector(sel){return sel==='[data-exporthub-urgent-nav]'?node:null},
   getElementById(id){return id==='exporthub-urgent-nav-counter-style'?styleHost.style||null:null},
   createElement(name){return {tagName:name,hidden:false,dataset:{},setAttribute(){}}},
   addEventListener(name,fn){listeners['doc:'+name]=fn}};
  const w={document:d,sessionStorage:{getItem(){return '{}'}},
   addEventListener(name,fn){listeners[name]=fn},
   setInterval(fn,ms){intervals.push({fn,ms})},
   async fetch(){calls++;return status===200?
    {ok:true,status:200,json:async()=>({ok:true,open:6})}:
    {ok:false,status};}};
  vm.runInNewContext(source,{window:w,document:d,globalThis:w,Date:{now:()=>now},Promise,JSON,Number,Error});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await flush();
  assert.equal(calls,1,'the first failure is a real HTTP request, not silently skipped');
  assert.equal(node.badge.hidden,true,'a failing count must not display a stale success');
  assert.equal(intervals.length,1);
  now+=45000;listeners.focus();listeners['exporthub:state-loaded']();intervals[0].fn();
  await flush();assert.equal(calls,1,'do not flood a failing API every 45 seconds');
  now+=254999;listeners.focus();await flush();
  assert.equal(calls,1,'cooldown still active before exactly five minutes');
  now+=1;status=200;listeners.focus();await flush();
  assert.equal(calls,2,'retry once after bounded cooldown');
  assert.equal(node.badge.textContent,'6');
  assert.equal(node.badge.hidden,false);
  now+=45000;status=unavailable;intervals[0].fn();await flush();
  assert.equal(calls,3,'next 5xx reactivates cooldown');
  status=200;listeners['exporthub:authenticated']();await flush();
  assert.equal(calls,4,'new verified session bypasses stale-account cooldown');
  assert.equal(node.badge.hidden,false);
  listeners['exporthub:logout']();listeners.focus();await flush();
  assert.equal(calls,4,'logout disables protected count polling');
 }
});
