import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');

test('RC1024: vorab aktiver Lieferavis kann schon vor Referenz und Speicherung deaktiviert werden',async()=>{
  const shipment={customerName:'Normaler Kunde',status:'Entwurf',customerAvisEnabled:false,avisEnabled:false};
  const listeners=new Map(),serverToggles=[];
  const button={textContent:'Aktivieren',disabled:false};
  const help={textContent:''};
  const panel={attrs:{'data-active':'0'},getAttribute(k){return this.attrs[k]||''},setAttribute(k,v){this.attrs[k]=String(v)},querySelector(){return button},querySelectorAll(){return[help]}};
  const input={id:'shipmentReference',name:'reference',value:'',closest(){return{textContent:'Sendungsreferenz'}},matches(){return true}};
  const document={readyState:'complete',querySelectorAll(s){return s==='#content input'?[input]:[]},getElementById(id){return id==='rc897LieferavisPanel'?panel:null},addEventListener(){}};
  const base={enabled(){return false},link(){return''},async toggle(on){serverToggles.push(on);return true},injectMailBody(_sh,_target,body){return body}};
  const window={document,ExportHUBCustomerAvis706:base,ExportHUBClean:{state:{currentShipment:shipment,shipment,shipments:[]}},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn)},dispatchEvent(){return true},console};
  vm.runInContext(source,vm.createContext({window,document,console,URL,Date,Event:function(){},CustomEvent:function(){},alert:()=>{},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn()}));
  const api=window.ExportHUBCustomerAvis706;
  assert.equal(api.enabled(shipment),true);
  assert.equal(await api.toggle(false),true);
  assert.equal(api.enabled(shipment),false);
  assert.ok(shipment.customerAvisDisabledAt,'Die bewusste Deaktivierung muss am Entwurf gespeichert werden.');
  assert.deepEqual(serverToggles,[],'Vor der ersten Speicherung darf kein unnötiger Server-Link-Toggle erfolgen.');
  assert.equal(panel.getAttribute('data-active'),'0');
  assert.match(button.textContent,/aktivieren/i);
  for(const fn of listeners.get('exporthub:shipment-saved')||[])await fn({type:'exporthub:shipment-saved'});
  assert.deepEqual(serverToggles,[],'Ein späteres Speichern darf die bewusste Deaktivierung nicht wieder einschalten.');
});
