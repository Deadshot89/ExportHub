import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FLOW=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
const FIX=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');

function load(shipment,{reference='',link='https://example.test/customer-avis.html?token=abc'}={}){
  const windowListeners=new Map();
  const documentListeners=new Map();
  const toggles=[];
  const persists=[];
  const referenceInput={
    id:'shipmentReference',name:'reference',value:reference,
    closest(){return{textContent:'Sendungsreferenz'}},matches(){return true},getAttribute(){return''}
  };
  const customerInput={
    id:'customerName',name:'customer',value:shipment.customerName||'',
    closest(){return{textContent:'Kunde'}},matches(){return true},getAttribute(){return''}
  };
  const panel={
    attrs:{'data-active':'0'},
    getAttribute(k){return this.attrs[k]||''},setAttribute(k,v){this.attrs[k]=String(v)},
    querySelector(){return{textContent:'Aktivieren',disabled:false}},querySelectorAll(){return[]}
  };
  const state={currentShipment:shipment,shipment,shipments:[]};
  const document={
    readyState:'complete',
    querySelectorAll(selector){return selector==='#content input'?[referenceInput,customerInput]:[]},
    getElementById(id){return id==='rc897LieferavisPanel'?panel:null},
    addEventListener(name,fn){if(!documentListeners.has(name))documentListeners.set(name,[]);documentListeners.get(name).push(fn)}
  };
  const base={
    enabled(sh){return !!(sh&&sh.customerAvisEnabled&&sh.customerAvisToken)},
    link(sh){return sh&&sh.customerAvisToken?link:''},
    async toggle(on){
      toggles.push(on);
      assert.match(String(shipment.reference||shipment.ref||''),/^[A-Z0-9]{6}$/,'Avis darf erst nach angelegter Referenz ausgestellt werden.');
      assert.ok(state.shipments.includes(shipment),'Avis darf erst nach dem automatisch gespeicherten Minimalentwurf ausgestellt werden.');
      shipment.customerAvisEnabled=!!on;
      shipment.avisEnabled=!!on;
      shipment.customerAvisToken=on?'server-token':'';
      shipment.avisToken=shipment.customerAvisToken;
      return true;
    },
    injectMailBody(_sh,_target,body){return body}
  };
  const window={
    document,
    ExportHUBCustomerAvis706:base,
    ExportHUBClean:{state},
    ExportHUBRC565:{async persistShipment(){persists.push('persist');if(!state.shipments.includes(shipment))state.shipments.push(shipment);return true}},
    addEventListener(name,fn){if(!windowListeners.has(name))windowListeners.set(name,[]);windowListeners.get(name).push(fn)},
    dispatchEvent(){return true},
    console
  };
  const context=vm.createContext({
    window,document,console,URL,Date,Math,
    crypto:{getRandomValues(arr){for(let i=0;i<arr.length;i++)arr[i]=i+7;return arr}},
    Uint8Array,
    alert(){},
    requestAnimationFrame(fn){fn();return 1},
    setTimeout(fn){fn();return 1},
    Event:function Event(type){this.type=type},
    CustomEvent:function CustomEvent(type,opt){this.type=type;this.detail=opt&&opt.detail}
  });
  vm.runInContext(FLOW,context,{filename:'assets/rc1015-lieferavis-mail-flow.js'});
  vm.runInContext(FIX,context,{filename:'assets/rc1027-lieferavis-immediate.js'});
  async function fireDocument(name,target=customerInput){for(const fn of documentListeners.get(name)||[])await fn({type:name,target})}
  return{api:window.ExportHUBCustomerAvis706,rc:window.ExportHUBRC1027Lieferavis,shipment,state,referenceInput,customerInput,toggles,persists,fireDocument};
}

const expandedDetails=`Sehr geehrte Damen und Herren,

für den unten genannten Vorgang steht die Ware in unserem Versandlager zur Abholung bereit.

Wir bitten Sie höflich darum, die Abholung zeitnah einzuplanen und uns innerhalb der nächsten 24 Stunden den genauen Abholtermin verbindlich zu bestätigen, damit wir die Ladekapazitäten entsprechend einplanen können.

Details zur Sendung:

Referenz: 7RZ5W9
Kunde: Heizmann AG Hydraulik
Abholdatum:
Spedition: DB Schenker
Warenbeschreibung: Plastic Parts
Verpackung: 2 × E3
Colli: 2
Gesamtgewicht: 14 kg
LDM: 0,12 LDM

Bitte stellen Sie sicher, dass der Fahrer bei der Abholung die entsprechende Referenznummer bereithält.

Für Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung. Vielen Dank für Ihre Unterstützung und die zuverlässige Abwicklung.

Mit freundlichen Grüßen`;

test('RC1027: aktive Kundenmail besteht nur aus Lieferavis und enthält keine Sendungsdetails',()=>{
  const shipment={reference:'7RZ5W9',customerName:'Heizmann AG Hydraulik',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9'});
  const out=api.injectMailBody(shipment,'customer',expandedDetails,'de');
  assert.match(out,/Sehr geehrte Damen und Herren/i);
  assert.match(out,/LIEFERAVIS/i);
  assert.match(out,/customer-avis\.html/i);
  assert.match(out,/7RZ5W9/);
  assert.doesNotMatch(out,/Details zur Sendung|Kunde:\s*Heizmann|Spedition:\s*DB Schenker|Warenbeschreibung:|Gesamtgewicht:|LDM:/i);
  assert.doesNotMatch(out,/innerhalb der nächsten 24 Stunden/i);
});

test('RC1027: aktive Speditionsmail besteht nur aus Lieferavis und enthält keine Sendungsdetails',()=>{
  const shipment={reference:'7RZ5W9',customerName:'Heizmann AG Hydraulik',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9'});
  const out=api.injectMailBody(shipment,'carrier',expandedDetails,'de');
  assert.match(out,/LIEFERAVIS\s*[–-]\s*ABHOLUNG/i);
  assert.match(out,/customer-avis\.html/i);
  assert.doesNotMatch(out,/Details zur Sendung|Kunde:\s*Heizmann|Spedition:\s*DB Schenker|Warenbeschreibung:|Gesamtgewicht:|LDM:/i);
});

test('RC1027: eigene Mail bleibt vollständig unverändert',()=>{
  const shipment={reference:'7RZ5W9',customerName:'Heizmann AG Hydraulik',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9'});
  assert.equal(api.injectMailBody(shipment,'own',expandedDetails,'de'),expandedDetails);
});

test('RC1027: sobald Kunde und Standort gesetzt sind wird Referenz, Minimalentwurf und Avis-Link automatisch erzeugt',async()=>{
  const shipment={customerName:'Heizmann AG Hydraulik',selectedLocationId:'MAIN-C1',status:'Entwurf',customerAvisEnabled:false,avisEnabled:false};
  const env=load(shipment,{reference:''});
  assert.ok(env.rc&&typeof env.rc.ensureCustomerAvis==='function','Frühe Kunden-Avis-Aktivierung fehlt.');
  const active=await env.rc.ensureCustomerAvis('customer-selected');
  assert.equal(active,true);
  assert.match(String(shipment.reference||shipment.ref||''),/^[A-Z0-9]{6}$/);
  assert.equal(env.referenceInput.value,String(shipment.reference||shipment.ref));
  assert.deepEqual(env.persists,['persist']);
  assert.deepEqual(env.toggles,[true]);
  assert.equal(shipment.customerAvisToken,'server-token');
  assert.match(env.api.link(shipment),/customer-avis\.html/);
});

test('RC1027: Kundenauswahl mit bereits gesetztem Standort stößt die frühe Avis-Erzeugung automatisch an',async()=>{
  const shipment={customerName:'',selectedLocationId:'MAIN-C1',status:'Entwurf',customerAvisEnabled:false,avisEnabled:false};
  const env=load(shipment,{reference:''});
  shipment.customerName='Heizmann AG Hydraulik';
  env.customerInput.value=shipment.customerName;
  await env.fireDocument('change',env.customerInput);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(env.toggles.length,1,'Nach vollständiger Kunden- und Standortzuordnung muss der Avis ohne manuellen Speicherschritt ausgestellt werden.');
  assert.equal(shipment.customerAvisToken,'server-token');
});
