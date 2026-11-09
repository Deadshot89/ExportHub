import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname||new URL('.',import.meta.url).pathname,'..');
const runtime=readFileSync(resolve(root,'assets/rc1014-shipment-overview.js'),'utf8');
const css=readFileSync(resolve(root,'assets/rc1877-pickup-binding.css'),'utf8');
test('shipment overview remains valid JavaScript and adds one in-page binding card',()=>{
 assert.doesNotThrow(()=>new vm.Script(runtime));
 assert.match(runtime,/function enhancePickupTransportBinding\(/);
 assert.match(runtime,/data-rc1877-binding/);
 assert.match(runtime,/enhanceManualPickupBooking\(\);enhancePickupTransportBinding\(\)/);
 assert.match(runtime,/host\.insertBefore\(panel,anchor\)/);
 assert.doesNotMatch(runtime,/window\.open\(\s*['"]\/api\/pickup-transport-bindings/);
});
test('only the canonical ExportHUB session is reused for API requests',()=>{
 assert.match(runtime,/bindingFetch\('/);
 assert.match(runtime,/Object\.assign\(\{'Accept':'application\/json'\},apiHeaders\(\)\)/);
 assert.match(runtime,/credentials:'same-origin'/);
 assert.match(runtime,/redirect:'manual'/);
 assert.match(runtime,/login\\\.microsoftonline\\\.com/);
});
test('binding selection uses FIX ids internally but displays site labels and calendar day',()=>{
 assert.match(runtime,/bindingFetch\('\/api\/fixed-pickups','GET'\)/);
 assert.match(runtime,/bindingFetch\('\/api\/pickup-transport-bindings','GET'\)/);
 assert.match(runtime,/option\.value=q\(target\.id\)/);
 assert.match(runtime,/option\.textContent=q\(target\.siteLabel\)/);
 assert.match(runtime,/bindingWeekday\(date&&date\.value\)/);
 assert.match(runtime,/option\.disabled=!!weekday&&day!==weekday/);
});
test('a changed binding requires explicit double confirmation and revision checks',()=>{
 assert.match(runtime,/panel\.dataset\.rc1877Confirm!==target\+'\|'\+day/);
 assert.match(runtime,/const confirmOverride=!!current&&current!==target/);
 assert.match(runtime,/expectedRevision:revision,confirmOverride/);
 assert.match(runtime,/BINDING_REVISION_CONFLICT/);
});
test('save success is only shown after a successful server readback',()=>{
 const post=runtime.indexOf("bindingFetch('/api/pickup-transport-bindings','POST'");
 const reload=runtime.indexOf('const loaded=await loadShipmentBinding(panel,sh);',post);
 const assertReadback=runtime.indexOf("if(!loaded)throw new Error('READBACK_FAILED')",reload);
 const success=runtime.indexOf("bindingStatus(panel,bt('saved'),'ok')",assertReadback);
 assert.ok(post>0&&reload>post&&assertReadback>reload&&success>assertReadback);
});
test('public QR and signed POD originals are not mutated by binding UI',()=>{
 const start=runtime.indexOf('function bindingShipmentDate('),end=runtime.indexOf('function scheduleEnhance()',start);
 const bindingUI=runtime.slice(start,end);
 assert.doesNotMatch(bindingUI,/\/api\/pickup-init|\/api\/pickup-pod|\/api\/pod-backup/i);
 assert.doesNotMatch(bindingUI,/\.podFiles\s*=|\.signatureBlobName\s*=|\.pickupStatus\s*=/);
});
test('all six UI languages provide title, actions, confirmation and failures',()=>{
 const start=runtime.indexOf('const bindingCopy='),end=runtime.indexOf('\n  function bt(',start);
 const source=runtime.slice(start,end).replace('const bindingCopy=','return ' ).replace(/;\s*$/,';');
 const dict=new Function(source)();
 for(const lang of ['de','en','pl','es','fr','it'])
  for(const field of ['title','target','date','save','change','confirm','refresh','notRegistered','failed','conflict','wrongDate'])
   assert.ok(dict[lang]&&typeof dict[lang][field]==='string'&&dict[lang][field].length>2,lang+'/'+field);
});
test('CSS provides keyboard focus, a narrow viewport and dark mode',()=>{
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(prefers-color-scheme:dark\)/);
 assert.match(css,/min-height:44px/);
 assert.match(runtime,/role="status" aria-live="polite"/);
});
