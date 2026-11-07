import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const orders=require('../api/shared/urgent-orders.js');
const user={id:'CS-17',name:'Customer Service'};
const logistics={id:'LOG-1',role:'Export',rights:{shipmentoverview:{edit:true}}};
function input(overrides={}){
 return{orderNumber:'SO3002',delivery:'DRP',priority:'P1',email:'Example@Company.com',language:'en',items:[{line:'10',article:'ART-100',quantity:12,minibag:false,pickableStock:true,holdsClear:true},{line:'20',article:'ART-200',quantity:3,minibag:true,pickableStock:true,holdsClear:true,minibagLeadtime:true}],...overrides};
}
function order(o={}){return orders.createOrder(input(o),user,'2026-11-04T10:00:00.000Z');}
test('CS can report SO3002 with multiple validated Lines, separate quantities and statuses',()=>{
 const o=order();assert.equal(o.orderNumber,'SO3002');assert.equal(o.items.length,2);assert.deepEqual(o.items.map(x=>x.quantity),[12,3]);assert.deepEqual(o.items.map(x=>x.status),['Open','Open']);assert.equal(o.email,'example@company.com');assert.equal(o.items[1].checks.minibagLeadtime,true);
});
test('mandatory fields and checks reject incomplete or ambiguous submissions',()=>{
 assert.throws(()=>order({orderNumber:'3002'}),/SO beginnen/);
 assert.throws(()=>order({priority:'P5'}),/P1 bis P4/);
 assert.throws(()=>order({delivery:''}),/DRP/);
 assert.throws(()=>order({email:'not-an-email'}),/E-Mail/);
 assert.throws(()=>order({items:[]}),/1 bis 100/);
 assert.throws(()=>order({items:[{line:'1',quantity:2,pickableStock:true}]}),/Ja oder Nein/);
 assert.throws(()=>order({items:[{line:'1',quantity:0,pickableStock:true,holdsClear:true}]}),/Menge/);
 assert.throws(()=>order({items:[{line:'1',quantity:1,pickableStock:true,holdsClear:true,minibag:true}]}),/Ja oder Nein/);
 assert.throws(()=>order({items:[{article:'A',quantity:1,pickableStock:true,holdsClear:true},{article:'A',quantity:1,pickableStock:true,holdsClear:true}]}),/mehrfach/);
});
test('negative checks are allowed only with explanation and flagged for logistics',()=>{
 const invalid={line:'10',quantity:1,pickableStock:false,holdsClear:true,minibag:false};
 assert.throws(()=>order({items:[invalid]}),/Begründung/);
 const o=order({items:[{...invalid,exceptionReason:'Bestand noch nicht auf pickbarer Location'}]});
 assert.equal(o.items[0].checkResult,'exception');
 const m=order({items:[{article:'MBG',quantity:1,pickableStock:true,holdsClear:true,minibag:true,minibagLeadtime:false,exceptionReason:'Minibag-Leadtimes müssen geklärt werden.'}]});
 assert.equal(m.items[0].checkResult,'exception');
});
test('CS can read their own orders but cannot change logistics status',()=>{
 const o=order();assert.equal(orders.canRead(o,user),true);
 assert.equal(orders.canRead(o,{id:'CS-99'}),false);
 assert.equal(orders.canRead(o,logistics),true);
 assert.equal(orders.canRead(o,{id:'CS-99',rights:{tasks:{edit:true}}}),false,'generic task rights must not expose all CS orders');
 assert.throws(()=>orders.setItemStatus(o,o.items[0].id,'Shipped',user),/Logistik/);
 assert.throws(()=>orders.setItemStatus(o,o.items[0].id,'Cancelled',logistics),/Ungültiger/);
});
test('each position has an independently editable status and history',()=>{
 const o=order();for(const status of orders.STATUSES){orders.setItemStatus(o,o.items[0].id,status,logistics,undefined,status==='Problem'?'Artikel im Wareneingang gesperrt':'')}
 assert.equal(o.items[0].status,'Invoiced');assert.equal(o.items[1].status,'Open');assert.equal(orders.summaryStatus(o),'Mixed');
 assert.equal(o.history.filter(h=>h.event==='status').length,6);
});
test('DE/EN templates are deterministic; shipping confirmation blocked until entire order shipped',()=>{
 const o=order();assert.throws(()=>orders.draftMail(o,'shipping','en'),/erst nach Status/);
 const de=orders.draftMail(o,'problem','de','Artikel 20 fehlt beim Packen');
 const en=orders.draftMail(o,'problem','en','Item 20 missing in picking');
 assert.match(de.subject,/Problem/);assert.match(en.subject,/Issue/);
 assert.match(de.body,/SO3002/);assert.match(en.body,/ART-200/);
 assert.equal(de.to,'example@company.com');
 assert.throws(()=>orders.draftMail(o,'problem','en','x'),/at least 8/);
 for(const item of o.items)orders.setItemStatus(o,item.id,'Shipped',logistics);
 assert.match(orders.draftMail(o,'shipping','en').body,/confirm/);
 assert.match(orders.draftMail(o,'shipping','de').body,/bestätigen/);
});
test('frontend and API are dedicated, authenticated and distinguish Graph sending from Outlook draft handoff',()=>{
 const html=fs.readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 const api=fs.readFileSync(new URL('../api/urgent-orders/index.js',import.meta.url),'utf8');
 const config=JSON.parse(fs.readFileSync(new URL('../api/urgent-orders/function.json',import.meta.url),'utf8'));
 const script=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script,'inline UI script is available');
 assert.doesNotThrow(()=>new vm.Script(script[1]),'browser script is valid JavaScript');
 assert.equal(config.bindings[0].route,'urgent-orders');
 assert.match(api,/await auth\.validateSession\(req\)/);
 assert.match(api,/URGENT_ORDER_EXISTS/);
 assert.match(api,/testservice\/urgent-orders/);
 assert.match(html,/mailto:/);
 assert.match(html,/data-field="minibag"/);
 assert.match(html,/id="filterStatus"/);
 assert.match(html,/id="mailLanguage"/);
 assert.match(html,/id="internalOpen"/);
 assert.match(html,/id="internalClosed"/);
 assert.match(html,/Problem/);
 // Browser-local reporter email suggestions are allowed without an account;
 // authentication/session tokens must still never be persisted in localStorage.
 assert.match(html,/localStorage\.setItem\(EMAIL_HISTORY_KEY,JSON\.stringify\(next\)\)/);
 assert.doesNotMatch(html,/localStorage\.setItem\([^\n]*(?:authToken|sessionToken|accessToken|exporthub_rc301_tab_session)/i);
 assert.doesNotMatch(html,/api\('save-profile'/);
 // Sending an Outlook draft is not a verified send. The new optional Graph
 // action must remain server-only, authenticated and production-scoped.
 assert.match(api,/if\(action==='send-mail-direct'\)/);
 assert.match(api,/if\(!model\.canManage\(user\)\)/);
 assert.match(api,/refs\.environment!=='production'/);
 assert.match(api,/graphMail\.verifyAuthentication\(\)/);
 assert.match(api,/mailSendGranted/);
 assert.match(api,/graphMail\.sendTextMail/);
 assert.match(api,/model\.confirmGraphMailAccepted/);
 assert.match(html,/async function mailto\(\)/);
 assert.match(html,/async function sendDirect\(\)/);
 assert.match(html,/api\('send-mail-direct'/);
 assert.match(html,/api\('record-mail-handoff'/);
 assert.doesNotMatch(html,/graph\.microsoft\.com\/v1\.0/,'Graph access must never run in the browser');
});
