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
