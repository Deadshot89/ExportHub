import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
function historyI18n(){
  return {
    language(){return 'de'},
    t(key,vars){let value=historyDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
    formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}
  };
}


function setup(){
  const documentEvents=new Map();
  const windowEvents=new Map();
  const sh={id:'S-RC1105',reference:'RC1105',status:'Entwurf',shipmentHistory:[],pickupHistory:[]};
  const state={view:'shipment',currentShipment:sh,savedShipments:[],shipments:[],currentUser:{id:'u1',name:'Tobias',role:'Globaler Administrator'}};
  const document={
    body:null,
    head:null,
    documentElement:{},
    readyState:'complete',
    addEventListener(name,fn){documentEvents.set(name,fn)},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return[]}
  };
  const window={
    ExportHUBI18n:historyI18n(),
    document,
    console,
    ExportHUBRC565:{async persistShipment(){return true}},
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    addEventListener(name,fn){windowEvents.set(name,fn)}
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,MutationObserver:undefined,
    setTimeout(fn){fn();return 1},clearTimeout(){},setInterval(){return 1}};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return {window,documentEvents,windowEvents,sh,state,api:window.ExportHUBShipmentHistory1071};
}

function actionElement(text,href=''){
  return {
    textContent:text,
    getAttribute(name){if(name==='href')return href;if(name==='title'||name==='data-action')return'';return''},
    closest(){return this}
  };
}

test('RC1105: kompletter Sendungsablauf erscheint mit Benutzer, Zeit und konkreter Aktion in der Historie',async()=>{
  const {window,documentEvents,windowEvents,sh,api}=setup();

  await window.ExportHUBRC565.persistShipment();

  const click=documentEvents.get('click');
  assert.equal(typeof click,'function');
  click({target:actionElement('ABD E-Mail öffnen','mailto:export@example.com?subject=ABD%20RC1105')});
  click({target:actionElement('Versandanmeldung E-Mail öffnen','mailto:carrier@example.com?subject=Versandanmeldung%20RC1105')});
  click({target:actionElement('Gesamtdruck')});

  const avis=windowEvents.get('exporthub:customer-avis-updated');
  assert.equal(typeof avis,'function');
  avis({detail:{enabled:true,reference:'RC1105'}});

  const change=documentEvents.get('change');
  assert.equal(typeof change,'function');
  change({target:{type:'file',files:[{name:'POD.pdf'}],id:'podUpload',name:'podUpload',closest(){return null}}});

  api.monitor();
  sh.status='Bereit zur Abholung';
  api.monitor();

  sh.pickupHistory.push({confirmedAt:'2026-09-14T18:00:00.000Z',loaderName:'Max Verlader',loaderId:'loader-1'});
  sh.pickedUpAt='2026-09-14T18:00:00.000Z';
  api.monitor();

  sh.status='Abgeschlossen';
  api.monitor();

  const events=api.events(sh);
  const labels=events.map(e=>e.label);
  for(const expected of [
    'Sendung erstellt',
    'Arbeit an Sendung gestartet',
    'ABD-Anfrage per E-Mail geöffnet',
    'Versandanmeldung per E-Mail gestartet',
    'Versandanmeldung versendet',
    'Gesamtdruck – gedruckt',
    'Lieferavis erstellt/aktiviert',
    'POD zum Upload ausgewählt',
    'Abholung bestätigt',
    'Sendung abgeschlossen'
  ]) assert.ok(labels.includes(expected),expected+' fehlt');

  const userEvents=events.filter(e=>['ABD-Anfrage per E-Mail geöffnet','Versandanmeldung versendet','Gesamtdruck – gedruckt'].includes(e.label));
  assert.ok(userEvents.length>=3);
  for(const event of userEvents){
    assert.equal(event.actor.name,'Tobias');
    assert.ok(event.at);
  }

  const print=events.find(e=>e.label==='Gesamtdruck – gedruckt');
  assert.equal(print.details.document,'Gesamtdruck');
  assert.equal(print.details.fileName,'Gesamtdruck_RC1105.pdf');

  const pickup=events.find(e=>e.label==='Abholung bestätigt');
  assert.equal(pickup.actor.name,'Max Verlader');
});