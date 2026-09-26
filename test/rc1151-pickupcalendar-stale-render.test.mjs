import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE=fs.readFileSync('assets/abholkalender.js','utf8');
const calendarDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

function deferred(){
  let resolve;
  const promise=new Promise(r=>{resolve=r});
  return{promise,resolve};
}

test('RC1151: verspätete FIX-Antwort überschreibt nach View-Wechsel nicht mehr #content',async()=>{
  let currentView='pickupcalendar';
  const pending=deferred();
  let html='';
  const rootElement={
    addEventListener(){},
    get innerHTML(){return html},
    set innerHTML(value){html=String(value)},
    querySelector(selector){
      if(selector==='.pickup-calendar'&&html.includes('pickup-calendar'))return{};
      return null;
    }
  };
  const document={
    body:{
      getAttribute(name){return name==='data-exporthub-view'?currentView:''}
    }
  };
  const context=vm.createContext({
    console,
    ExportHUBI18n:{
      language(){return 'de'},
      t(key,vars){let value=calendarDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
      formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)},
      localized(record,key){return record&&record[key]!=null?record[key]:''}
    },
    document,
    Date,
    Intl,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    Promise,
    FormData:class FormData{},
    fetch(){return pending.promise}
  });
  vm.runInContext(SOURCE,context,{filename:'assets/abholkalender.js'});
  const calendar=context.ExportHubPickupCalendar;
  assert.ok(calendar&&typeof calendar.mount==='function');

  calendar.mount(rootElement,{environment:'testservice',shipments:[]});
  assert.match(html,/Abholkalender/);

  currentView='shipment';
  html='<section id="shipment-view">Kunde · Empfänger</section>';

  pending.resolve({
    ok:true,
    status:200,
    async json(){return{ok:true,items:[{id:'FIX-1',siteLabel:'Späte Antwort',weekday:5,active:true}],canEdit:true}}
  });

  await new Promise(resolve=>setImmediate(resolve));
  await Promise.resolve();

  assert.equal(
    html,
    '<section id="shipment-view">Kunde · Empfänger</section>',
    'Eine verspätete Abholkalender-Antwort darf eine inzwischen geöffnete Ansicht nicht überschreiben.'
  );
});


test('RC1287: Sprachwechsel rendert Abholkalender nach View-Wechsel nicht zurück',async()=>{
  let currentView='pickupcalendar',html='',languageHandler=null;
  const rootElement={
    addEventListener(){},
    get innerHTML(){return html},
    set innerHTML(value){html=String(value)},
    querySelector(selector){return selector==='.pickup-calendar'&&html.includes('pickup-calendar')?{}:null}
  };
  const document={body:{getAttribute(name){return name==='data-exporthub-view'?currentView:''}}};
  const context=vm.createContext({
    console,
    ExportHUBI18n:{
      language(){return'de'},
      t(key,vars){let value=calendarDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
      formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)},
      localized(record,key){return record&&record[key]!=null?record[key]:''}
    },
    document,Date,Intl,Math,Number,String,Array,Object,JSON,Promise,FormData:class FormData{},
    fetch(){return new Promise(()=>{})},
    addEventListener(name,handler){if(name==='exporthub:language-changed')languageHandler=handler}
  });
  vm.runInContext(SOURCE,context,{filename:'assets/abholkalender.js'});
  const calendar=context.ExportHubPickupCalendar;
  calendar.mount(rootElement,{environment:'testservice',shipments:[]});
  assert.match(html,/Abholkalender/);
  assert.equal(typeof languageHandler,'function');

  currentView='sop';
  html='<section id="sop-view">SOP & Portale</section>';
  languageHandler();

  assert.equal(html,'<section id="sop-view">SOP & Portale</section>');
});
