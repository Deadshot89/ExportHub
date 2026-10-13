import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadWithRoot(root){
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const FakeEvent=function(type){this.type=type;};
  const FakeKeyboardEvent=function(type,init={}){this.type=type;Object.assign(this,init);};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout,Event:FakeEvent,KeyboardEvent:FakeKeyboardEvent}),{filename:'pack-notification-shipment.js'});
  return root.ExportHUBPackShipment;
}

test('RC1522: Packkunden-Prefill survives a shipment form rerender after the first mount',async()=>{
  const notification={
    id:'pn-manual',reference:'PK-MANUAL',customer:'E2E PACK CUSTOMER A',
    customerId:'',customerAccount:'',customerSource:'manual',
    packageCount:1,totalWeight:680,
    packages:[{packageNo:1,length:120,width:80,height:145}],documents:[]
  };
  const draft={};
  const shared={packNotifications:[notification],shipments:[],shipment:draft};
  const makeCustomer=()=>({
    value:'',events:[],
    dispatchEvent(event){this.events.push(event.type);if(event.type==='input')draft.customerSearch=this.value;}
  });
  let customer=makeCustomer();
  const root={
    __EXPORTHUB_GET_STATE__:()=>shared,
    ExportHUBShipment420:{startNewShipment(){draft.customerSearch='';}},
    document:{
      getElementById(id){
        if(id==='rc363BlockCustomer')return{};
        if(id==='shipmentCustomerSearch')return customer;
        return null;
      },
      querySelectorAll:()=>[]
    }
  };
  const api=loadWithRoot(root);
  assert.equal(api.begin('pn-manual'),true);
  await new Promise(resolve=>setTimeout(resolve,45));
  assert.equal(customer.value,'E2E PACK CUSTOMER A','erster Mount muss befüllt sein');

  customer=makeCustomer();
  draft.customerSearch='';
  await new Promise(resolve=>setTimeout(resolve,220));

  assert.equal(customer.value,'E2E PACK CUSTOMER A','nach einem nachgelagerten Re-Render muss der Packkunde erneut gesetzt werden');
  assert.equal(draft.customerSearch,'E2E PACK CUSTOMER A');
  assert.equal(customer.events.includes('change'),false,'manueller Packkunde darf keinen destruktiven Lookup auslösen');
  assert.equal(customer.events.includes('keydown'),false,'manueller Packkunde darf kein Enter-Lookup auslösen');
});
