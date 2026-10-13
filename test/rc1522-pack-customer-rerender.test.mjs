import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadWithRoot(root,timers){
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const FakeEvent=function(type){this.type=type;};
  const FakeKeyboardEvent=function(type,init={}){this.type=type;Object.assign(this,init);};
  vm.runInContext(source,vm.createContext({
    window:root,globalThis:root,console,Date,Intl,
    setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,
    Event:FakeEvent,KeyboardEvent:FakeKeyboardEvent
  }),{filename:'pack-notification-shipment.js'});
  return root.ExportHUBPackShipment;
}

function fakeTimers(){
  let queue=[];
  return{
    setTimeout(fn){queue.push(fn);return queue.length;},
    clearTimeout(){},
    flush(limit=50){let count=0;while(queue.length&&count<limit){const fn=queue.shift();fn();count+=1;}return count;},
    flushOne(){const fn=queue.shift();if(fn)fn();},
    get size(){return queue.length;}
  };
}

function inputFor(draft){
  return{
    value:'',events:[],
    dispatchEvent(event){this.events.push(event.type);if(event.type==='input')draft.customerSearch=this.value;}
  };
}

test('RC1522: manueller Packkunde überlebt verzögerten Shipment-Form-Re-Render',()=>{
  const timers=fakeTimers();
  const notification={id:'pn-manual',reference:'PK-MANUAL',customer:'E2E PACK CUSTOMER A',customerId:'',customerAccount:'',customerSource:'manual',packageCount:1,totalWeight:680,packages:[{packageNo:1,length:120,width:80,height:145}],documents:[]};
  const draft={customerId:'FOREIGN',customerAccount:'9000009999',customerSearch:'ALT',recipientAddress:'Alt'};
  const shared={packNotifications:[notification],shipments:[],shipment:draft};
  let customer=inputFor(draft);
  const form={};
  const root={
    __EXPORTHUB_GET_STATE__:()=>shared,
    ExportHUBShipment420:{startNewShipment(){draft.customerId='';draft.customerAccount='';draft.customerSearch='';draft.recipientAddress='';}},
    document:{
      getElementById(id){if(id==='rc363BlockCustomer')return form;if(id==='shipmentCustomerSearch')return customer;return null;},
      querySelectorAll:()=>[]
    }
  };
  const api=loadWithRoot(root,timers);
  assert.equal(api.begin('pn-manual'),true);

  timers.flushOne();
  assert.equal(customer.value,'E2E PACK CUSTOMER A');

  customer=inputFor(draft);
  draft.customerSearch='';
  timers.flush(20);

  assert.equal(customer.value,'E2E PACK CUSTOMER A','Packkunde muss auch im neu gemounteten Input erhalten bleiben');
  assert.equal(draft.customerSearch,'E2E PACK CUSTOMER A','sichtbarer Packkunde und Shipment-State müssen nach Re-Render synchron bleiben');
});
