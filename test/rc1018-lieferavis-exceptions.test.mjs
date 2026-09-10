import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
const rc1013Build=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');

function load(shipment,options={}){
  const alerts=[];
  const toggles=[];
  const persists=[];
  const input={
    id:'shipmentReference',name:'reference',value:'ABC123',
    closest(){return{textContent:'Sendungsreferenz'}}
  };
  const document={
    readyState:'complete',
    querySelectorAll(selector){return selector==='#content input'?[input]:[]},
    getElementById(){return null},
    addEventListener(){}
  };
  const base={
    enabled(){return true},
    link(){return 'https://avis.example/customer'},
    async toggle(on){toggles.push(on);return true},
    injectMailBody(_sh,_target,body){return body}
  };
  const state={shipments:options.initiallySaved===false?[]:[shipment]};
  const window={
    document,
    ExportHUBCustomerAvis706:base,
    ExportHUBClean:{state},
    addEventListener(){},
    console
  };
  if(options.initiallySaved===false){
    window.ExportHUBRC565={
      async persistShipment(){
        persists.push('persist');
        state.shipments=[shipment];
        return true;
      }
    };
  }
  const context=vm.createContext({
    window,document,console,
    alert:message=>alerts.push(String(message)),
    requestAnimationFrame:fn=>fn(),
    setTimeout:fn=>fn()
  });
  vm.runInContext(source,context,{filename:'assets/rc1015-lieferavis-mail-flow.js'});
  return{api:window.ExportHUBCustomerAvis706,alerts,toggles,persists};
}

function loadAuto(shipment){
  const alerts=[];
  const toggles=[];
  const persists=[];
  const listeners=new Map();
  const input={
    id:'shipmentReference',name:'reference',value:shipment.reference||'ABC123',
    closest(){return{textContent:'Sendungsreferenz'}},
    matches(){return true}
  };
  const document={
    readyState:'complete',
    querySelectorAll(selector){return selector==='#content input'?[input]:[]},
    getElementById(){return null},
    addEventListener(){}
  };
  const base={
    enabled(sh){return !!(sh&&sh.customerAvisEnabled)},
    link(){return 'https://avis.example/customer'},
    async toggle(on){
      toggles.push(on);
      if(on){
        shipment.customerAvisEnabled=true;
        shipment.avisEnabled=true;
        shipment.customerAvisSecurityVersion=995;
        shipment.avisSecurityVersion=995;
        shipment.customerAvisEnabledAt='2026-09-10T08:00:00.000Z';
        shipment.avisEnabledAt='2026-09-10T08:00:00.000Z';
        shipment.customerAvisDisabledAt='';
        shipment.avisDisabledAt='';
      }else{
        shipment.customerAvisEnabled=false;
        shipment.avisEnabled=false;
        shipment.customerAvisDisabledAt='2026-09-10T08:05:00.000Z';
        shipment.avisDisabledAt='2026-09-10T08:05:00.000Z';
      }
      return false;
    },
    injectMailBody(_sh,_target,body){return body}
  };
  const state={shipments:[shipment],currentShipment:shipment};
  const window={
    document,
    ExportHUBCustomerAvis706:base,
    ExportHUBClean:{state},
    ExportHUBRC565:{async persistShipment(){persists.push('persist');return true}},
    addEventListener(name,fn){
      if(!listeners.has(name))listeners.set(name,[]);
      listeners.get(name).push(fn);
    },
    console
  };
  const context=vm.createContext({
    window,document,console,
    alert:message=>alerts.push(String(message)),
    requestAnimationFrame:fn=>fn(),
    setTimeout:fn=>fn()
  });
  vm.runInContext(source,context,{filename:'assets/rc1015-lieferavis-mail-flow.js'});
  async function fire(name){
    for(const fn of listeners.get(name)||[])fn({type:name});
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
  return{api:window.ExportHUBCustomerAvis706,alerts,toggles,persists,fire,shipment};
}

const bmpVariants=[
  {reference:'ABC123',customerName:'BMP'},
  {reference:'ABC123',customer:{name:'BMP'}},
  {reference:'ABC123',recipientName:'BMP'}
];

test('RC1018: BMP wird unabhängig vom Kundenfeld als Lieferavis-Ausnahme erkannt',()=>{
  for(const shipment of bmpVariants){
    const {api}=load(shipment);
    assert.equal(api.enabled(shipment),false);
  }
  const normal={reference:'ABC123',customerName:'Normaler Kunde'};
  assert.equal(load(normal).api.enabled(normal),true);
});

test('RC1018: BMP kann Lieferavis nicht aktivieren und erhält verständlichen IT-Hinweis',async()=>{
  const shipment={reference:'ABC123',customerName:'BMP'};
  const {api,alerts,toggles}=load(shipment);
  assert.equal(await api.toggle(true),false);
  assert.deepEqual(toggles,[]);
  assert.match(alerts.join('\n'),/Kunden-IT.*blockiert|IT.*blockiert/i);
});

test('RC1018: neue noch ungespeicherte BMP-Sendung wird nach dem Pflichtspeichern vor Link-Erzeugung gestoppt',async()=>{
  const shipment={reference:'ABC123',customerName:'BMP'};
  const {api,alerts,toggles,persists}=load(shipment,{initiallySaved:false});
  assert.equal(await api.toggle(true),false);
  assert.deepEqual(persists,['persist']);
  assert.deepEqual(toggles,[]);
  assert.match(alerts.join('\n'),/Kunden-IT.*blockiert|IT.*blockiert/i);
});

test('RC1018: BMP-Kundenmail enthält keinen Lieferavis-Link, normale Kunden bleiben unverändert',()=>{
  const bmp={reference:'ABC123',customerName:'BMP'};
  const bmpApi=load(bmp).api;
  const bmpMail=bmpApi.injectMailBody(bmp,'customer','Guten Tag\n\nIhre Sendungsdetails.','de');
  assert.doesNotMatch(bmpMail,/avis\.example|LIEFERAVIS – LIVE-ZUGANG/i);
  assert.match(bmpMail,/Ihre Sendungsdetails/);

  const normal={reference:'ABC123',customerName:'Normaler Kunde'};
  const normalApi=load(normal).api;
  const normalMail=normalApi.injectMailBody(normal,'customer','Guten Tag\n\nIhre Sendungsdetails.','de');
  assert.match(normalMail,/https:\/\/avis\.example\/customer/);
  assert.match(normalMail,/LIEFERAVIS – LIVE-ZUGANG/);
});

test('RC1018: sichtbarer Hinweistext für gesperrte Avis-Kunden ist im Flow vorhanden',()=>{
  assert.match(source,/Lieferavis für diesen Kunden nicht verfügbar/i);
  assert.match(source,/Kunden-IT blockiert den Zugriff/i);
});

test('Lieferavis: normale gespeicherte Sendung wird standardmäßig automatisch aktiviert',async()=>{
  const shipment={reference:'ABC123',customerName:'Normaler Kunde',customerAvisEnabled:false,avisEnabled:false,status:'Entwurf'};
  const {api,fire,toggles,persists}=loadAuto(shipment);
  assert.equal(typeof api.autoEnable,'function','Der Lieferavis-Flow muss die Default-Aktivierung bereitstellen.');
  await fire('exporthub:shipment-saved');
  assert.deepEqual(toggles,[true]);
  assert.deepEqual(persists,['persist']);
  assert.equal(shipment.customerAvisEnabled,true);
});

test('Lieferavis: manuelle Deaktivierung bleibt für dieselbe Sendung erhalten',async()=>{
  const shipment={reference:'ABC123',customerName:'Normaler Kunde',customerAvisEnabled:true,avisEnabled:true,status:'Entwurf'};
  const {api,fire,toggles}=loadAuto(shipment);
  await api.toggle(false);
  assert.deepEqual(toggles,[false]);
  await fire('exporthub:shipment-saved');
  await fire('exporthub:rendered');
  assert.deepEqual(toggles,[false],'Eine bewusst deaktivierte Sendung darf nicht automatisch wieder aktiviert werden.');
  assert.equal(shipment.customerAvisEnabled,false);
});

test('Lieferavis: bestehende Kunden-Ausnahme BMP bleibt trotz Default-Aktivierung gesperrt',async()=>{
  const shipment={reference:'ABC123',customerName:'BMP',customerAvisEnabled:false,avisEnabled:false,status:'Entwurf'};
  const {fire,toggles}=loadAuto(shipment);
  await fire('exporthub:shipment-saved');
  assert.deepEqual(toggles,[]);
});

test('Lieferavis: RC1015 darf sich nicht als RC1018 ausgeben, damit die neue Mailruntime wirklich installiert wird',()=>{
  assert.doesNotMatch(source,/__rc1018\s*:\s*true/);
  assert.match(source,/__rc1015\s*:\s*true/);
});

test('Lieferavis: neuer Cache-Key wird in allen drei Umgebungen gebaut',()=>{
  assert.match(rc1013Build,/rc1015-lieferavis-mail-flow\.js\?v=1021/);
});
