import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FLOW=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
const FIX=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');

function load(shipment){
  const documentListeners=new Map();
  const windowListeners=new Map();
  const alerts=[];
  const persists=[];
  const toggles=[];
  const apiCalls=[];
  const referenceInput={id:'shipmentReference',name:'reference',value:'',closest(){return{textContent:'Sendungsreferenz'}},getAttribute(){return''}};
  const customerInput={id:'customerName',name:'customer',value:shipment.customerName||'',closest(){return{textContent:'Kunde'}},getAttribute(){return''}};
  const document={
    readyState:'complete',
    querySelectorAll(selector){return selector==='#content input'?[referenceInput,customerInput]:[]},
    getElementById(){return null},
    addEventListener(name,fn){if(!documentListeners.has(name))documentListeners.set(name,[]);documentListeners.get(name).push(fn)}
  };
  const state={shipment,currentShipment:shipment,shipments:[]};
  const base={
    enabled(){return false},
    link(){return''},
    async toggle(on){toggles.push(on);return true},
    injectMailBody(_sh,_target,body){return body}
  };
  const window={
    document,
    ExportHUBCustomerAvis706:base,
    ExportHUBClean:{state,runtime:{authToken:'TOKEN'}},
    ExportHUBRC565:{async persistShipment(){persists.push('persist');alerts.push('Bitte einen Standort auswählen.');return false}},
    addEventListener(name,fn){if(!windowListeners.has(name))windowListeners.set(name,[]);windowListeners.get(name).push(fn)},
    dispatchEvent(){return true},
    console
  };
  const context=vm.createContext({
    window,document,console,URL,Date,Math,Uint8Array,
    crypto:{getRandomValues(arr){for(let i=0;i<arr.length;i++)arr[i]=i+1;return arr}},
    alert(message){alerts.push(String(message))},
    requestAnimationFrame(fn){fn();return 1},
    setTimeout(fn){fn();return 1},
    Event:function Event(type){this.type=type},
    CustomEvent:function CustomEvent(type,opt){this.type=type;this.detail=opt&&opt.detail},
    fetch:async(_url,opt)=>{var payload=JSON.parse(opt&&opt.body||'{}');apiCalls.push(payload);if(payload.action==='draft-sync')return{ok:true,status:200,json:async()=>({ok:true,updated:1})};return{ok:true,status:200,json:async()=>({ok:true,token:'server-token',shipmentId:payload.shipmentId||payload.reference,url:'https://example.test/customer-avis.html?token=abc'})}}
  });
  vm.runInContext(FLOW,context,{filename:'assets/rc1015-lieferavis-mail-flow.js'});
  vm.runInContext(FIX,context,{filename:'assets/rc1027-lieferavis-immediate.js'});
  async function fire(name,target){for(const fn of documentListeners.get(name)||[])await fn({type:name,target})}
  return{shipment,customerInput,alerts,persists,toggles,apiCalls,fire};
}

test('RC1069: Kundenauswahl darf keinen Speicherversuch oder Standort-Alert auslösen; Avis-Draft darf bereits aktiv sein',async()=>{
  const shipment={customerName:'',status:'Entwurf',customerAvisEnabled:false,avisEnabled:false};
  const env=load(shipment);
  await Promise.resolve();await Promise.resolve();
  shipment.customerName='7R Park Lodz';
  env.customerInput.value=shipment.customerName;
  await env.fire('change',env.customerInput);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.deepEqual(env.persists,[],'Draft-Avis darf keinen normalen Speicherversuch starten.');
  assert.deepEqual(env.toggles,[],'RC1069 darf nicht auf den alten Toggle-/Save-Pfad zurückfallen.');
  assert.deepEqual(env.alerts,[],'Kundenauswahl darf keine Standort- oder Speichermeldung erzeugen.');
  assert.ok(env.apiCalls.some(x=>x.action==='issue'),'Der Avis-Link soll bereits für den Entwurf ausgestellt werden.');
});
