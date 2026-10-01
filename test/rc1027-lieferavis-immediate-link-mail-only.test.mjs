import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const PREF=fs.readFileSync('assets/rc1092-customer-mail-contacts.js','utf8');
const FLOW=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
const FIX=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');

function load(shipment,{reference='',link='https://example.test/customer-avis.html?token=abc',customers=[]}={}){
  const windowListeners=new Map();
  const documentListeners=new Map();
  const toggles=[];
  const persists=[];
  const apiCalls=[];
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
  const state={currentShipment:shipment,shipment,shipments:[],customers};
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
    ExportHUBClean:{state,runtime:{authToken:'TOKEN'}},
    ExportHUBRC565:{async persistShipment(){persists.push('persist');if(!state.shipments.includes(shipment))state.shipments.push(shipment);return true}},
    setTimeout(fn){fn();return 1},
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
    CustomEvent:function CustomEvent(type,opt){this.type=type;this.detail=opt&&opt.detail},
    fetch:async(_url,opt)=>{var payload=JSON.parse(opt&&opt.body||'{}');apiCalls.push(payload);if(payload.action==='draft-sync')return{ok:true,status:200,json:async()=>({ok:true,updated:1})};return{ok:true,status:200,json:async()=>({ok:true,token:'server-token',shipmentId:payload.shipmentId||payload.reference,url:link,expiresAt:null})}}
  });
  vm.runInContext(PREF,context,{filename:'assets/rc1092-customer-mail-contacts.js'});
  vm.runInContext(FLOW,context,{filename:'assets/rc1015-lieferavis-mail-flow.js'});
  vm.runInContext(FIX,context,{filename:'assets/rc1027-lieferavis-immediate.js'});
  async function fireDocument(name,target=customerInput){for(const fn of documentListeners.get(name)||[])await fn({type:name,target})}
  return{api:window.ExportHUBCustomerAvis706,rc:window.ExportHUBRC1027Lieferavis,shipment,state,referenceInput,customerInput,toggles,persists,apiCalls,fireDocument};
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
  assert.match(out,/https:\/\/exporthub360\.com\/avis\/server-token/i);
  assert.match(out,/7RZ5W9/);
  assert.doesNotMatch(out,/Details zur Sendung|Kunde:\s*Heizmann|Spedition:\s*DB Schenker|Warenbeschreibung:|Gesamtgewicht:|LDM:/i);
  assert.doesNotMatch(out,/innerhalb der nächsten 24 Stunden/i);
});

test('RC1027: aktive Speditionsmail besteht nur aus Lieferavis und enthält keine Sendungsdetails',()=>{
  const shipment={reference:'7RZ5W9',customerName:'Heizmann AG Hydraulik',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9'});
  const out=api.injectMailBody(shipment,'carrier',expandedDetails,'de');
  assert.match(out,/LIEFERAVIS\s*[–-]\s*ABHOLUNG/i);
  assert.match(out,/https:\/\/exporthub360\.com\/avis\/server-token/i);
  assert.doesNotMatch(out,/Details zur Sendung|Kunde:\s*Heizmann|Spedition:\s*DB Schenker|Warenbeschreibung:|Gesamtgewicht:|LDM:/i);
});

test('RC1147: eigene Mail behält ihren Freitext und erhält genau einen kompakten Lieferavis-Link',()=>{
  const shipment={reference:'7RZ5W9',customerName:'Heizmann AG Hydraulik',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9'});
  const out=api.injectMailBody(shipment,'own',expandedDetails,'de');
  assert.match(out,/für den unten genannten Vorgang steht die Ware/i);
  assert.match(out,/Details zur Sendung:/i);
  assert.match(out,/Lieferavis: https:\/\/exporthub360\.com\/avis\/server-token\?lang=de/i);
  assert.equal((out.match(/Lieferavis:/gi)||[]).length,1,'Eigene Mail darf den Avis-Link nicht doppelt enthalten.');
  assert.ok(out.indexOf('Lieferavis:')<out.indexOf('Mit freundlichen Grüßen'),'Avis-Link muss vor der Grußformel stehen.');
});

test('RC1069: der Sendungsentwurf erhält Referenz und Avis-Link sofort ohne normalen Speicherschritt',async()=>{
  const shipment={customerName:'Heizmann AG Hydraulik',selectedLocationId:'MAIN-C1',status:'Entwurf',customerAvisEnabled:false,avisEnabled:false};
  const env=load(shipment,{reference:''});
  assert.ok(env.rc&&typeof env.rc.ensureCustomerAvis==='function','Frühe Kunden-Avis-Aktivierung fehlt.');
  const active=await env.rc.ensureCustomerAvis('customer-selected');
  assert.equal(active,true);
  assert.match(String(shipment.reference||shipment.ref||''),/^[A-Z0-9]{6}$/);
  assert.equal(env.referenceInput.value,String(shipment.reference||shipment.ref));
  assert.deepEqual(env.persists,[],'Avis-Draft darf keinen normalen Sendungsspeicher auslösen.');
  assert.deepEqual(env.toggles,[],'RC1069 nutzt den direkten Avis-API-Pfad statt den alten Toggle-Save-Pfad.');
  assert.equal(env.apiCalls.filter(x=>x.action==='issue').length,1);
  assert.equal(shipment.customerAvisToken,'server-token');
  assert.equal(env.api.link(shipment),'https://exporthub360.com/avis/server-token');
});

test('RC1069: Kundeneingaben aktualisieren einen bereits sofort ausgestellten Avis-Draft ohne erneute Speicherung',async()=>{
  const shipment={customerName:'',selectedLocationId:'MAIN-C1',status:'Entwurf',customerAvisEnabled:false,avisEnabled:false};
  const env=load(shipment,{reference:''});
  await env.rc.ensureCustomerAvis('initial-draft');
  assert.equal(shipment.customerAvisToken,'server-token');
  assert.deepEqual(env.persists,[]);
  shipment.customerName='Heizmann AG Hydraulik';
  env.customerInput.value=shipment.customerName;
  await env.fireDocument('change',env.customerInput);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  await env.rc.syncDraftAvis(shipment,'test-customer-change');
  assert.ok(env.apiCalls.some(x=>x.action==='draft-sync'&&x.shipmentSnapshot&&x.shipmentSnapshot.customerName==='Heizmann AG Hydraulik'),'Kundenänderung muss in den öffentlichen Avis-Draft synchronisiert werden.');
  assert.deepEqual(env.persists,[]);
});

test('RC1374: Würth Industrie ist ohne explizite Kundenfreigabe vollständig vom AVIS ausgeschlossen',()=>{
  for(const customerName of ['Würth Industrie','Würth Industrie Service GmbH & Co. KG','Wuerth Industrie']){
    const shipment={reference:'7RZ5W9',customerName,customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
    const {api}=load(shipment,{reference:'7RZ5W9'});
    assert.equal(api.enabled(shipment),false,customerName+': AVIS muss durch die Kundenpräferenz deaktiviert sein');
    assert.equal(api.link(shipment),'',customerName+': es darf kein AVIS-Link zurückgegeben werden');
    for(const target of ['customer','carrier','own']){
      const out=api.injectMailBody(shipment,target,expandedDetails,'de');
      assert.doesNotMatch(out,/(?:exporthub360\.com\/avis\/|customer-avis\.html)|Lieferavis:\s*https?:\/\//i,customerName+' / '+target+': AVIS-Link muss aus der Mail entfernt sein');
    }
  }
});

test('RC1374: explizites Ja im Kundenordner überschreibt den Würth-Standard und erlaubt AVIS wieder',()=>{
  const customers=[{id:'W1',name:'Würth Industrie',customerAvisLinkEnabled:true}];
  const shipment={reference:'7RZ5W9',customerId:'W1',customerName:'Würth Industrie',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9',customers});
  assert.equal(api.enabled(shipment),true);
  assert.match(api.link(shipment),/^https:\/\/exporthub360\.com\/avis\//);
  assert.match(api.injectMailBody(shipment,'customer',expandedDetails,'de'),/exporthub360\.com\/avis\//i);
});

test('RC1374: explizites Nein im Kundenordner verhindert die technische AVIS-Erzeugung',async()=>{
  const customers=[{id:'N1',name:'Normaler Kunde',customerAvisLinkEnabled:false}];
  const shipment={reference:'7RZ5W9',customerId:'N1',customerName:'Normaler Kunde',customerAvisEnabled:false,status:'Entwurf'};
  const env=load(shipment,{reference:'7RZ5W9',customers});
  const active=await env.rc.ensureCustomerAvis('preference-test');
  assert.equal(active,false);
  assert.equal(env.apiCalls.filter(x=>x.action==='issue').length,0,'Bei Nein darf kein AVIS ausgestellt werden');
  assert.equal(env.api.link(shipment),'');
});

test('RC1374: bereits aktiver AVIS wird beim nächsten Kundenabgleich serverseitig deaktiviert',async()=>{
  const customers=[{id:'N1',name:'Normaler Kunde',customerAvisLinkEnabled:false}];
  const shipment={reference:'7RZ5W9',customerId:'N1',customerName:'Normaler Kunde',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const env=load(shipment,{reference:'7RZ5W9',customers});
  const active=await env.rc.ensureCustomerAvis('preference-revoke-test');
  assert.equal(active,false);
  assert.equal(env.apiCalls.filter(x=>x.action==='disable').length,1,'Bestehender AVIS muss deaktiviert werden');
  assert.equal(shipment.customerAvisToken,'');
  assert.equal(shipment.customerAvisEnabled,false);
});

test('RC1374: Adolf Würth 3019100629 und V-Zug starten ohne AVIS-Link',()=>{
  const customers=[
    {id:'3019100629',name:'Adolf Würth GmbH & Co. KG'},
    {id:'VZ',name:'V-Zug',customerEmail:'v-zug@lebert.com'}
  ];
  const wuerth={reference:'7RZ5W9',customerId:'3019100629',customerName:'Adolf Würth GmbH & Co. KG',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const vzug={reference:'8RZ5W9',customerId:'VZ',customerName:'V-Zug',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  assert.equal(load(wuerth,{reference:'7RZ5W9',customers}).api.link(wuerth),'');
  assert.equal(load(vzug,{reference:'8RZ5W9',customers}).api.link(vzug),'');
});

test('RC1291: normale Kunden behalten den Lieferavis-Link in Kunden-, Speditions- und eigener Mail',()=>{
  const shipment={reference:'7RZ5W9',customerName:'Normaler Kunde',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9'});
  for(const target of ['customer','carrier','own']){
    const out=api.injectMailBody(shipment,target,expandedDetails,'de');
    assert.match(out,/exporthub360\.com\/avis\//i,target+': normaler Kunde muss den Avis-Link behalten');
  }
});


test('RC1292: Plica-Mail an Holenstein erhält keinen Avis-Link, andere Empfänger bleiben unverändert',()=>{
  const customers=[{
    id:'P1',name:'Plica',
    carrierEmail:'dispo@holenstein.de',
    carrierContacts:[{name:'Disposition | Holenstein GmbH',email:'dispo@holenstein.de'}],
    customerEmail:'plica@example.com'
  }];
  const shipment={reference:'7RZ5W9',customerId:'P1',customerName:'Plica',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9',customers});

  const carrier=api.injectMailBody(shipment,'carrier',expandedDetails,'de');
  assert.doesNotMatch(carrier,/(?:exporthub360\.com\/avis\/|customer-avis\.html)|Lieferavis:\s*https?:\/\//i,'Holenstein-Speditionsmail darf keinen Avis-Link enthalten');

  const own=api.injectMailBody(shipment,'own',expandedDetails,'de');
  assert.doesNotMatch(own,/(?:exporthub360\.com\/avis\/|customer-avis\.html)|Lieferavis:\s*https?:\/\//i,'Eigene Mail mit Holenstein als möglichem Empfänger darf keinen Avis-Link enthalten');

  const customer=api.injectMailBody(shipment,'customer',expandedDetails,'de');
  assert.match(customer,/exporthub360\.com\/avis\//i,'Plica-Kundenmail an andere Adresse muss den Avis-Link behalten');
});

test('RC1292: direkte Holenstein-Adresse auf der Sendung greift ohne Kundenstamm',()=>{
  const shipment={reference:'7RZ5W9',customerName:'Beliebiger Kunde',carrierMail:'Disposition | Holenstein GmbH <dispo@holenstein.de>',customerAvisEnabled:true,customerAvisToken:'server-token',status:'Entwurf'};
  const {api}=load(shipment,{reference:'7RZ5W9'});
  const out=api.injectMailBody(shipment,'carrier',expandedDetails,'de');
  assert.doesNotMatch(out,/(?:exporthub360\.com\/avis\/|customer-avis\.html)|Lieferavis:\s*https?:\/\//i);
});
