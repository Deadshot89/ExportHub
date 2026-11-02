import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const css=fs.readFileSync('assets/rc1560-full-width.css','utf8');
const i18n=fs.readFileSync('assets/i18n/rc1499-exportexperte.js','utf8');
const handoff=fs.readFileSync('assets/rc1499-exportexperte-handoff.js','utf8');
const proforma=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');

function harness(){
 const attrs={};
 function tab(mode){
  const attributes={'data-rc1294-mode':mode};let active=false;
  return{getAttribute(key){return attributes[key]},setAttribute(key,value){attributes[key]=value},
   classList:{toggle(name,enabled){if(name==='active')active=!!enabled}},
   get active(){return active}};
 }
 const buttons=['manual','shipment','invoice','saved'].map(tab);
 const form={hidden:false,id:'',setAttribute(){}},history={hidden:true,id:'',setAttribute(){}},invoice={hidden:true,setAttribute(){}},heading={textContent:'ABD-Anfrage erstellen'},createButton={hidden:false};
 const panel={querySelector(s){if(s==='[data-rc1294-invoice-panel]')return invoice;return null},
  querySelectorAll(s){return s==='[data-rc1294-mode]'?buttons:[]}};
 const host={setAttribute(key,value){attrs[key]=value},getAttribute(key){return attrs[key]},
  querySelector(selector){
   return selector==='.rc626-head h2'?heading:
     selector==='.rc626-head > button[onclick*="newAbd"]'?createButton:
     selector===':scope > .rc626-grid2'?form:
     selector==='.rc1760-abd-history'?history:null;
  }};
 let calls=0;
 const document={readyState:'loading',getElementById(id){
  if(id==='rc626Abd')return host;
  if(id==='rc1294AbdAnalysis')return panel;
  return null;
 },addEventListener(){}};
 const window={document,addEventListener(){},
  ExportHUBRC626:{openAbd(fromShipment){assert.equal(fromShipment,true);calls++}}};
 vm.runInNewContext(source,{window,document,console,Intl,URL,setTimeout,clearTimeout,Uint8Array,btoa(){return''}});
 return {api:window.ExportHUBRC1294ABDAnalysis,form,history,invoice,heading,createButton,buttons,attrs,get calls(){return calls}};
}

test('RC1761: only selected ABD workspace is visible',()=>{
 const h=harness();
 h.api.setMode('invoice');
 assert.equal(h.form.hidden,true,'legacy ABD form must disappear in invoice tab');
 assert.equal(h.createButton.hidden,true,'new ABD action must not appear in invoice tab');
 assert.equal(h.invoice.hidden,false,'invoice analysis must remain visible');
 assert.equal(h.history.hidden,true);
 assert.equal(h.attrs['data-rc1294-mode'],'invoice');
 assert.equal(h.buttons[2].getAttribute('aria-selected'),'true');

 h.api.setMode('saved');
 assert.equal(h.form.hidden,true);
 assert.equal(h.invoice.hidden,true);
 assert.equal(h.history.hidden,false,'saved request list has its own tab');
 assert.equal(h.createButton.hidden,true,'history tab must not repeat the create action');
 assert.equal(h.buttons[3].getAttribute('aria-pressed'),'true');

 h.api.setMode('manual');
 assert.equal(h.form.hidden,false,'manual form must return without rerendering its data');
 assert.equal(h.createButton.hidden,false,'new ABD action belongs to manual creation');
 assert.equal(h.invoice.hidden,true);
 assert.equal(h.history.hidden,true);
 assert.equal(h.calls,0);
});

test('RC1761: shipment prefill is invoked once only for user-initiated tab change',()=>{
 const h=harness();
 h.api.setMode('shipment',true);
 assert.equal(h.calls,0,'re-applying mode after rerender must not rerun prefill');
 assert.equal(h.form.hidden,false);
 h.api.setMode('shipment');
 assert.equal(h.calls,1);
 assert.equal(h.buttons[1].getAttribute('aria-selected'),'true');
});

test('RC1761: invoice handoff returns to manual ABD and CSS respects hidden panels',()=>{
 assert.match(handoff,/tabs\.setMode\('manual',true\);\s*legacy\.openAbd\(\)/);
 assert.match(proforma,/history\.hidden=abd\.getAttribute\('data-rc1294-mode'\)!=='saved'/);
 assert.match(css,/#rc626Abd\[data-rc1294-mode="invoice"\] > \.rc626-grid2/);
 assert.match(css,/#rc626Abd\[data-rc1294-mode="saved"\] > \.rc626-grid2/);
 assert.match(source,/setMode\(currentMode,true\)/);
 assert.match(source,/if\(mode==='shipment'\)[\s\S]*?ExportHUBRC626\.openAbd\(true\)/);
});

test('RC1761: workspace labels are translated in all six supported languages',()=>{
 const context={window:{},console};context.globalThis=context;
 vm.runInNewContext(i18n,context);
 const packs=context.window.ExportHUBRC1499I18n.packs;
 for(const code of ['de','en','pl','es','fr','it']){
  assert.ok(packs[code].workspaceTitle);
  assert.ok(packs[code].savedMode);
  assert.ok(packs[code].tabIntro);
 }
});
