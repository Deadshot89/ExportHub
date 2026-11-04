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
test('navigation counter uses authenticated internal list and only counts unfinished orders',()=>{
 assert.doesNotThrow(()=>new vm.Script(menu));
 assert.match(menu,/data-urgent-open-count/);
 assert.match(menu,/X-ExportHUB-Token/);
 assert.match(menu,/\/api\/urgent-orders/);
 assert.match(menu,/action:'list'/);
 assert.match(menu,/x\.status==='Invoiced'/);
 assert.match(menu,/!authToken\)\{ui\.badge\.hidden=true/);
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
