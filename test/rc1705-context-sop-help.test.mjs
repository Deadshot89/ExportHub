import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1705-context-sop-help.js','utf8');
const css=fs.readFileSync('assets/rc1705-context-sop-help.css','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const employee=JSON.parse(fs.readFileSync('assets/training-center/catalog/employee-sops.json','utf8'));

function api(){
 const listeners={};
 const doc={readyState:'loading',documentElement:{lang:'de'},body:{getAttribute:()=> 'shipment'},activeElement:null,
   addEventListener(name,callback){listeners[name]=callback},
   getElementById(){return null},querySelector(){return null}};
 const win={addEventListener(){},localStorage:{getItem(){return null},setItem(){}},
   ExportHubIsoSopCatalog:{documents:[{number:'SOP-EH-031',title:'Sendung erstellen',sections:{steps:[{id:'step-1',text:'Kunde auswählen'},{id:'step-2',text:'Sendung prüfen'}]}}]},
   fetch(){return Promise.resolve({ok:true,json(){return Promise.resolve(employee)}})}};
 vm.runInNewContext(runtime,{window:win,document:doc,Promise});
 return {help:win.ExportHUBSopHelp1705,doc};
}

test('RC1705 ships the six-language employee SOP catalog in production, testservice and demo',()=>{
 for(const rel of ['assets/rc1705-context-sop-help.js','assets/rc1705-context-sop-help.css','assets/training-center/catalog/employee-sops.json'])assert.ok(build.includes("'"+rel+"'"),rel);
 for(const name of ['RC1705_SOP_HELP_STYLE_TAG','RC1705_SOP_HELP_SCRIPT_TAG'])assert.ok(build.includes('injectDeferredRuntimeInHead(html,'+name),name);
 assert.match(build,/RC1705 SOP-Hilfe fehlt/);
 assert.deepEqual(employee.languages,['de','en','pl','es','fr','it']);
});

test('RC1705 shows standard shipping instructions and five employee SOPs without inventing verified targets',async()=>{
 const {help}=api();
 assert.ok(help);
 assert.equal(help.currentView(),'shipment');
 assert.equal(help.guideById('SOP-EH-031').steps.length,2);
 assert.equal(help.guideById('customers-create'),null);
 await help.loadCatalogue();
 for(const id of ['customers-create','customers-edit','abd-manual','pickup-qr-reopen','documents-reprint']){
   const item=help.guideById(id);assert.ok(item,id);assert.equal(item.steps.length,5);
   assert.equal(item.verified,false);
   assert.ok(item.steps.every(s=>s.verified===false));
 }
});

test('RC1705 cannot mutate shipments, send mail or print from the guide',()=>{
 assert.match(runtime,/data-rc1705-open="SOP-EH-031"/);
 assert.match(runtime,/data-rc739-no-loading/);
 assert.doesNotMatch(runtime,/setView\(|queueSave\(|flushSave\(|window\.print\(|openPrint\(|sendMail\(|createShipment\(/);
 assert.match(runtime,/localStorage\.setItem\(STORAGE,/);
 assert.match(css,/@media print/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/:focus-visible/);
});


test('RC1705: standard SOP button appears even before a customer has been selected',()=>{
 const listeners={};
 const host={children:[],firstChild:null,firstElementChild:null,
   insertBefore(el){el.parentNode=this;this.children.unshift(el);this.firstChild=el;this.firstElementChild=el}};
 const nav={},body={getAttribute:()=> 'shipment',appendChild(el){el.parentNode=this}};
 const buttons=[];
 const doc={readyState:'loading',documentElement:{lang:'de'},body,activeElement:null,
   addEventListener(name,cb){listeners[name]=cb},
   getElementById(id){return id==='nav'?nav:id==='content'?host:null},
   querySelector(){return null},
   createElement(){const button={textContent:'',setAttribute(name,val){this[name]=val}};
     const el={innerHTML:'',textContent:'',parentNode:null,querySelector(){return button},
       setAttribute(){},get previousElementSibling(){return null}};
     buttons.push(button);return el;
   }};
 const win={addEventListener(){},setTimeout(){return 1},
   localStorage:{getItem(){return null},setItem(){}},
   fetch(){return Promise.resolve({ok:true,json(){return Promise.resolve(employee)}})}};
 vm.runInNewContext(runtime,{window:win,document:doc,Promise});
 assert.equal(typeof listeners.DOMContentLoaded,'function');
 listeners.DOMContentLoaded();
 assert.equal(host.children.length,1,'SOP button must be inserted without customer context');
 assert.equal(host.children[0].id,'rc1705-sop-shipment');
 assert.match(buttons[0].textContent,/Standard-SOP/);
 assert.match(host.children[0].innerHTML,/data-rc1705-open="SOP-EH-031"/);
});


test('RC1705: user-specific SOP progress resolves the logged-in ExportHUB state user',()=>{
  const doc={readyState:'loading',documentElement:{lang:'de'},body:{getAttribute(){return 'shipment'}},
    addEventListener(){},getElementById(){return null},querySelector(){return null}};
  let id='employee-one';
  const win={addEventListener(){},__EXPORTHUB_GET_CURRENT_USER__(){return {globalAdmin:false}},
    __EXPORTHUB_GET_STATE__(){return {currentUser:{id}}}};
  const testRuntime=runtime.replace('function progressId(id){','w.__RC1705_TEST_CURRENT_USER__=currentUser;\nfunction progressId(id){');
  vm.runInNewContext(testRuntime,{window:win,document:doc,Promise});
  assert.equal(win.__RC1705_TEST_CURRENT_USER__(),'employee-one');
  id='employee-two';
  assert.equal(win.__RC1705_TEST_CURRENT_USER__(),'employee-two');
});


test('RC1705: current SOP context follows the alternate view attribute',()=>{
  let view='shipment';
  const doc={readyState:'loading',documentElement:{lang:'de'},
    body:{getAttribute(name){return name==='data-current-view'?view:null}},
    addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const win={addEventListener(){}};
  vm.runInNewContext(runtime,{window:win,document:doc,Promise});
  assert.equal(win.ExportHUBSopHelp1705.currentView(),'shipment');
  view='customers';
  assert.equal(win.ExportHUBSopHelp1705.currentView(),'customers');
  assert.match(runtime,/attributeFilter:\['data-exporthub-view','data-current-view'\]/);
});


test('RC1705: open help refreshes completed steps on active-user switch',async()=>{
  let userId='employee-one',panel=null;
  const stored={'employee-one|SOP-EH-031':[],'employee-two|SOP-EH-031':['step-1']};
  const listeners={},doc={
    readyState:'loading',documentElement:{lang:'de'},activeElement:null,
    body:{getAttribute(){return 'dashboard'},appendChild(el){if(el.id==='rc1705-sop-panel')panel=el}},
    addEventListener(name,fn){listeners[name]=fn},
    getElementById(id){
      if(id==='nav'||id==='content')return {};
      if(id==='rc1705-sop-panel')return panel;
      return null;
    },
    querySelector(){return null},
    createElement(){return {id:'',hidden:false,textContent:'',innerHTML:'',setAttribute(){},querySelector(){return null}}}
  };
  const win={
    addEventListener(name,fn){listeners[name]=fn},
    setTimeout(fn){fn();return 0},
    __EXPORTHUB_GET_CURRENT_USER__(){return {id:userId}},
    localStorage:{getItem(){return JSON.stringify(stored)},setItem(){}},
    fetch(){return Promise.resolve({ok:true,json(){return Promise.resolve(employee)}})},
    ExportHubIsoSopCatalog:{documents:[{number:'SOP-EH-031',title:'Sendung erstellen',
      sections:{steps:[{id:'step-1',text:'Kunde auswählen'},{id:'step-2',text:'Sendung prüfen'}]}}]}
  };
  vm.runInNewContext(runtime,{window:win,document:doc,Promise});
  listeners.DOMContentLoaded();
  const help=win.ExportHUBSopHelp1705;
  await help.loadCatalogue();
  assert.equal(help.open('SOP-EH-031'),true);
  assert.match(panel.innerHTML,/0 \/ 2/);
  userId='employee-two';
  listeners['exporthub:sync']();
  assert.match(panel.innerHTML,/1 \/ 2/,'existing open panel must show second user progress');
});


test('RC1705: requested employee SOP replaces temporary fallback after catalog load',async()=>{
  let panel=null,resolveFetch;
  const listeners={};
  const doc={
    readyState:'loading',documentElement:{lang:'de'},activeElement:null,
    body:{getAttribute(){return 'customers'},appendChild(el){if(el.id==='rc1705-sop-panel')panel=el}},
    addEventListener(name,fn){listeners[name]=fn},
    getElementById(id){if(id==='nav'||id==='content')return {};return id==='rc1705-sop-panel'?panel:null},
    querySelector(){return null},
    createElement(){return {id:'',textContent:'',innerHTML:'',setAttribute(){},querySelector(){return null},appendChild(){}}}
  };
  const win={
    addEventListener(name,fn){listeners[name]=fn},
    setTimeout(fn){fn();return 0},
    localStorage:{getItem(){return '{}'},setItem(){}},
    fetch(){return new Promise(resolve=>{resolveFetch=resolve})},
    ExportHubIsoSopCatalog:{documents:[{number:'SOP-EH-020',title:'Kunden verwalten',
      sections:{steps:[{id:'step-1',text:'Kundenverwaltung öffnen'}]}}]}
  };
  vm.runInNewContext(runtime,{window:win,document:doc,Promise});
  listeners.DOMContentLoaded();
  const help=win.ExportHUBSopHelp1705;
  assert.equal(help.open('customers-create'),true);
  assert.match(panel.innerHTML,/<h3>Kunden verwalten<\/h3>/);
  resolveFetch({ok:true,json(){return Promise.resolve(employee)}});
  await help.loadCatalogue();
  await Promise.resolve();
  await Promise.resolve();
  assert.match(panel.innerHTML,/<h3>Kunden neu anlegen<\/h3>/);
});
