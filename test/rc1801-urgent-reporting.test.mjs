import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const model=require('../api/shared/urgent-orders.js');
const actor={id:'CS-1',name:'Customer Service'};
const logistics={id:'OPS-1',rights:{shipmentoverview:{level:'edit'}}};
function base(extra={}){
 return {orderNumber:'SO3002',delivery:'DRP',priority:'P1',email:'cs@example.com',language:'de',
  orderType:'DIRECT_OUTBOUND',directOutbound:{
   arrivalAt:'2026-11-09T08:30',arrivalMode:'TRUCK',arrivalProvider:'Example Freight',
   dispatchMethod:'EXPRESS',deliveryNotePresent:true,asnWorking:true,holdsClear:true
  },items:[{line:'10',article:'ART-101',quantity:4,holdsClear:true,newArticle:true,articleDataCorrect:true,processCompliant:true}],...extra};
}
test('Urgent Order supports planned inbound and immediate express shipment',()=>{
 const order=model.createOrder(base(),actor);
 assert.equal(order.orderType,'DIRECT_OUTBOUND');
 assert.equal(order.directOutbound.arrivalAt,'2026-11-09T08:30');
 assert.equal(order.directOutbound.arrivalTimeZone,'Europe/Berlin');
 assert.equal(order.directOutbound.dispatchMethod,'EXPRESS');
 assert.equal(order.items[0].checks.pickableStock,null);
 assert.equal(order.items[0].checks.articleDataCorrect,true);
 assert.equal(order.items[0].checks.processCompliant,true);
 assert.equal(order.items[0].checkResult,'passed');
 const en=model.draftMail(order,'problem','en','The inbound truck will arrive late.');
 const de=model.draftMail(order,'problem','de','Der Wareneingang ist verspätet.');
 assert.match(en.body,/Expected arrival: 2026-11-09 08:30/);
 assert.match(en.body,/Outbound service: Express/);
 assert.match(de.body,/Geplante Ankunft: 2026-11-09 08:30/);
 assert.match(de.body,/Versandart: Express/);
});
test('Direct outbound requires a real arrival date, transport mode, carrier and outbound service',()=>{
 assert.throws(()=>model.createOrder(base({directOutbound:{...base().directOutbound,arrivalAt:'2026-11-31T09:00'}}),actor),/arrival date/i);
 assert.throws(()=>model.createOrder(base({directOutbound:{...base().directOutbound,arrivalMode:'AIR'}}),actor),/inbound transport/i);
 assert.throws(()=>model.createOrder(base({directOutbound:{...base().directOutbound,arrivalProvider:''}}),actor),/carrier/i);
 assert.throws(()=>model.createOrder(base({directOutbound:{...base().directOutbound,dispatchMethod:'STANDARD'}}),actor),/special transport/i);
 assert.throws(()=>model.createOrder(base({directOutbound:{...base().directOutbound,plannedDispatchAt:'2026-11-09T07:30'}}),actor),/before arrival/i);
});
test('Delivery note, ASN and holds must be checked; negative results require an exception reason',()=>{
 const b=base(),d=b.directOutbound;
 assert.throws(()=>model.createOrder(base({directOutbound:{...d,asnWorking:null}}),actor),/Ja oder Nein/);
 assert.throws(()=>model.createOrder(base({directOutbound:{...d,deliveryNotePresent:false}}),actor),/Explain any failed/);
 assert.equal(model.createOrder(base({directOutbound:{...d,deliveryNotePresent:false,exceptionReason:'Lieferschein kommt per Mail'}}),actor).directOutbound.checkResult,'exception');
 assert.equal(model.createOrder(base({directOutbound:{...d,holdsClear:false,exceptionReason:'Credit Hold wird geprüft'}}),actor).directOutbound.checkResult,'exception');
});
test('New item validates master data and process steps, even for future arrivals',()=>{
 const b=base(),item=b.items[0];
 assert.throws(()=>model.createOrder(base({items:[{...item,articleDataCorrect:null}]}),actor),/Ja oder Nein/);
 assert.throws(()=>model.createOrder(base({items:[{...item,article:'',line:'10'}]}),actor),/Artikelnummer/);
 assert.throws(()=>model.createOrder(base({items:[{...item,processCompliant:false}]}),actor),/Explain any failed/);
 assert.equal(model.createOrder(base({items:[{...item,processCompliant:false,exceptionReason:'Fehlender Wareneingangsprozess'}]}),actor).items[0].checkResult,'exception');
});
test('Problem is open; only all Invoiced is closed',()=>{
 const o=model.createOrder(base(),actor);
 assert.throws(()=>model.setItemStatus(o,o.items[0].id,'Problem',logistics),/Beschreibung/);
 model.setItemStatus(o,o.items[0].id,'Problem',logistics,undefined,'ASN wurde nicht bestätigt');
 assert.equal(o.items[0].problemNote,'ASN wurde nicht bestätigt');
 assert.equal(o.items[0].status,'Problem');
 assert.equal(model.isClosed(o),false);
 model.setItemStatus(o,o.items[0].id,'Shipped',logistics);
 assert.equal(model.isClosed(o),false);
 model.setItemStatus(o,o.items[0].id,'Invoiced',logistics);
 assert.equal(model.isClosed(o),true);
});
test('Anonymous reporter front-end and API provide scoped tracking, not public global orders',()=>{
 const html=fs.readFileSync(new URL('../assets/urgent-order-report.html',import.meta.url),'utf8');
 const pub=fs.readFileSync(new URL('../api/urgent-order-public/index.js',import.meta.url),'utf8');
 const apiCfg=JSON.parse(fs.readFileSync(new URL('../api/urgent-order-public/function.json',import.meta.url),'utf8'));
 const prod=JSON.parse(fs.readFileSync(new URL('../staticwebapp.config.json',import.meta.url),'utf8'));
 const testservice=JSON.parse(fs.readFileSync(new URL('../staticwebapp.testservice.config.json',import.meta.url),'utf8'));
 const script=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script);assert.doesNotThrow(()=>new vm.Script(script[1]));
 assert.equal(apiCfg.bindings[0].route,'urgent-order-public');
 assert.match(pub,/crypto\.randomBytes\(32\)/);
 assert.match(pub,/groupByToken/);
 assert.match(pub,/\.filter\(o=>o\.reporterId===group\.id\)/);
 assert.doesNotMatch(pub,/update-status|sendTextMail|sendMail\(/);
 for(const id of ['tabOpen','tabClosed','orderType','trackingUrl','deliveryNotePresent','asnWorking'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/location\.hash/);
 for(const config of [prod,testservice]){
  const route=config.routes.find(x=>x.route==='/urgent-order');
  assert.equal(route.rewrite,'/assets/urgent-order-report.html');
  assert.deepEqual(route.allowedRoles,['anonymous']);
  assert.equal(route.headers['Referrer-Policy'],'no-referrer');
 }
});
