import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');

function load(){
  const documentListeners=new Map();
  const starts=[];
  const routes=[];
  const shipment={customerName:'Alter Draft',selectedLocationId:'OLD',reference:'OLD123',status:'Entwurf'};
  const state={view:'dashboard',shipment,currentShipment:shipment,activeShipmentId:'current'};
  const document={
    readyState:'complete',
    querySelectorAll(){return[]},
    getElementById(){return null},
    addEventListener(name,fn,capture){
      if(!documentListeners.has(name))documentListeners.set(name,[]);
      documentListeners.get(name).push({fn,capture:!!capture});
    }
  };
  const base={enabled(){return false},link(){return''},async toggle(){return false},injectMailBody(_sh,_target,body){return body}};
  const window={
    document,
    ExportHUBCustomerAvis706:base,
    ExportHUBClean:{state},
    ExportHUBShipment420:{startNewShipment(){starts.push('fresh');state.shipment={reference:'NEW123',customerName:'',selectedLocationId:'',__rc562Fresh:true};state.currentShipment=state.shipment;state.view='shipment';return false}},
    ExportHUBRC325:{route(view,source){routes.push([view,source]);state.view=view;return false}},
    addEventListener(){},dispatchEvent(){return true},console
  };
  const context=vm.createContext({window,document,console,URL,Date,Math,Uint8Array,crypto:{getRandomValues(a){return a}},setTimeout(fn){fn();return 1},requestAnimationFrame(fn){fn();return 1},Event:function(){},CustomEvent:function(){}});
  vm.runInContext(SOURCE,context,{filename:'assets/rc1027-lieferavis-immediate.js'});
  async function click(target){
    const event={target,prevented:false,stopped:false,immediate:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.immediate=true}};
    for(const item of documentListeners.get('click')||[])await item.fn(event);
    return event;
  }
  return{state,starts,routes,click};
}

function shipmentMenuButton(){
  const button={
    getAttribute(name){return name==='data-index321-view'?'shipment':''},
    closest(selector){
      if(selector==='#nav button[data-index321-view="shipment"]')return button;
      if(selector==='#nav')return {id:'nav'};
      return null;
    }
  };
  return button;
}

test('RC1034: Klick auf Sendung erstellen im Hauptmenü startet immer einen frischen Draft',async()=>{
  const env=load();
  const event=await env.click(shipmentMenuButton());
  assert.deepEqual(env.starts,['fresh'],'Menüpunkt Sendung erstellen muss startNewShipment aufrufen.');
  assert.equal(env.state.shipment.customerName,'','Alter Kundenname darf nicht in die neue Sendung übernommen werden.');
  assert.equal(env.state.shipment.selectedLocationId,'','Alter Standort darf nicht übernommen werden.');
  assert.equal(env.state.shipment.__rc562Fresh,true,'Die neue Sendung muss als frischer Draft markiert sein.');
  assert.equal(event.prevented,true,'Der normale Router darf den alten Shipment-Cache nicht wiederherstellen.');
});
