import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const MAIL=fs.readFileSync('assets/rc1018-mail-language-standard.js','utf8');
const FLOW=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');

function mailApi(){
  const window={};
  const context={window,console,URL,URLSearchParams,setTimeout:()=>0,clearTimeout:()=>{},localStorage:{getItem:()=>null,setItem:()=>{}}};
  vm.runInNewContext(MAIL,context,{filename:'rc1018-mail-language-standard.js'});
  return window.ExportHUBRC1018MailLanguage;
}

function flowApi(shipment,{reference=''}={}){
  const listeners=new Map();
  const button={textContent:'Aktivieren',disabled:false};
  const help={textContent:''};
  const panel={
    attrs:{'data-active':'0'},
    getAttribute(name){return this.attrs[name]||''},
    setAttribute(name,value){this.attrs[name]=String(value)},
    querySelector(selector){return selector==='[data-rc897-avis-action="toggle"]'?button:null},
    querySelectorAll(selector){return selector==='.rc897-avis-help'?[help]:[]}
  };
  const input={
    id:'shipmentReference',name:'reference',value:reference,
    closest(){return{textContent:'Sendungsreferenz'}},matches(){return true}
  };
  const document={
    readyState:'complete',
    querySelectorAll(selector){return selector==='#content input'?[input]:[]},
    getElementById(id){return id==='rc897LieferavisPanel'?panel:null},
    addEventListener(){}
  };
  const base={
    enabled(sh){return !!(sh&&sh.customerAvisEnabled)},
    link(){return ''},
    async toggle(on){shipment.customerAvisEnabled=!!on;return true},
    injectMailBody(_sh,_target,body){return body}
  };
  const window={
    document,
    ExportHUBCustomerAvis706:base,
    ExportHUBClean:{state:{currentShipment:shipment,shipment,shipments:[]}},
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn)},
    dispatchEvent(){return true},
    console
  };
  const context=vm.createContext({window,document,console,alert:()=>{},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),Date,Event:function(){},CustomEvent:function(){}});
  vm.runInContext(FLOW,context,{filename:'rc1015-lieferavis-mail-flow.js'});
  return{api:window.ExportHUBCustomerAvis706,panel,button,help};
}

test('RC1024: eigene Mailvorlage bleibt ohne Lieferavis exakt unverändert',()=>{
  const a=mailApi();
  const custom='Guten Tag Frau Muster,\n\nEIGENER TEXT – exakt so lassen.\nZeile 2 bleibt ebenfalls unverändert.\n\nViele Grüße\nTobias';
  const out=a.composeMail({target:'customer',lang:'de',body:custom,avisEnabled:false,url:'',reference:'ABC123'});
  assert.equal(out,custom);
});

test('RC1024: Lieferavis ergänzt nur den Systemblock und verändert eigenen Freitext nicht',()=>{
  const a=mailApi();
  const custom='Guten Tag Frau Muster,\n\nEIGENER TEXT – exakt so lassen.\nZeile 2 bleibt ebenfalls unverändert.\n\nViele Grüße\nTobias';
  const out=a.composeMail({target:'customer',lang:'de',body:custom,avisEnabled:true,url:'https://example.test/customer-avis.html?t=abc',reference:'ABC123'});
  assert.ok(out.includes(custom),'Der eigene Vorlagentext wurde verändert, zerlegt oder neu formatiert.');
  assert.match(out,/digital(?:es|en) Lieferavis/i);
  assert.match(out,/Abholdatum/i);
  assert.match(out,/Zeitfenster/i);
  assert.match(out,/Kennzeichen/i);
  assert.match(out,/ABC123/);
});

test('RC1024: Systemplatzhalter wird bei aktivem Lieferavis sauber ersetzt ohne doppelten Sendungsdetails-Block',()=>{
  const a=mailApi();
  const template='Sehr geehrte Damen und Herren,\n\nBitte beachten Sie unsere Hinweise.\n\nDetails zur Sendung:\n{{SENDUNGSDETAILS}}\n\nMit freundlichen Grüßen\nExport Team';
  const out=a.composeMail({target:'carrier',lang:'de',body:template,avisEnabled:true,url:'https://example.test/customer-avis.html?t=abc',reference:'ABC123'});
  assert.match(out,/LIEFERAVIS\s*[–-]\s*ABHOLUNG/i);
  assert.match(out,/geplante Abholung/i);
  assert.match(out,/Abholdatum/i);
  assert.match(out,/Zeitfenster/i);
  assert.doesNotMatch(out,/\{\{SENDUNGSDETAILS\}\}|Details zur Sendung/i);
  assert.match(out,/Bitte beachten Sie unsere Hinweise\./);
  assert.match(out,/Mit freundlichen Grüßen\nExport Team/);
});

test('RC1024: Kunde und Spedition erhalten getrennte professionelle DE EN Lieferavis-Systemtexte',()=>{
  const a=mailApi();
  const rows=[
    ['customer','de',/digital(?:es|en) Lieferavis/i,/freigegebenen Sendungsunterlagen/i],
    ['carrier','de',/LIEFERAVIS\s*[–-]\s*ABHOLUNG/i,/Erforderliche Angaben/i],
    ['customer','en',/digital collection notice/i,/released shipment documents/i],
    ['carrier','en',/COLLECTION NOTICE\s*[–-]\s*PICKUP/i,/Required information/i]
  ];
  for(const [target,lang,title,phrase] of rows){
    const out=a.composeMail({target,lang,body:'Hinweis / Note',avisEnabled:true,url:'https://example.test/customer-avis.html?t=abc',reference:'ABC123'});
    assert.match(out,title);
    assert.match(out,phrase);
    assert.match(out,/ABC123/);
  }
});

test('RC1024: neue Entwurfs-Sendung steht sofort sichtbar auf Lieferavis AKTIV auch vor Referenz und Speicherung',()=>{
  const shipment={customerName:'Normaler Kunde',status:'Entwurf',customerAvisEnabled:false,avisEnabled:false};
  const {api,panel,button}=flowApi(shipment,{reference:''});
  assert.equal(api.enabled(shipment),true,'Defaultzustand einer neuen geeigneten Sendung muss aktiv sein.');
  assert.equal(panel.getAttribute('data-active'),'1','Lieferavis-Panel muss den aktiven Defaultzustand direkt anzeigen.');
  assert.match(button.textContent,/deaktivieren/i,'Der aktive Defaultzustand muss sofort deaktivierbar sein.');
  assert.equal(button.disabled,false,'Deaktivieren darf nicht erst nach Eingabe einer Referenz möglich sein.');
});

test('RC1024: Ausnahme und bewusste Deaktivierung haben Vorrang vor dem Entwurfs-Default',()=>{
  assert.equal(flowApi({customerName:'BMP',status:'Entwurf'}).api.enabled({customerName:'BMP',status:'Entwurf'}),false);
  const disabled={customerName:'Normaler Kunde',status:'Entwurf',customerAvisDisabledAt:'2026-09-10T09:00:00.000Z'};
  const {api}=flowApi(disabled);
  assert.equal(api.enabled(disabled),false);
});
