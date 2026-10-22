import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1049-abd-avis-policy.js','utf8');
const part=source.match(/\/\* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD START \*\/([\s\S]*?)\/\* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD END \*\//);
assert.ok(part,'RC1550 verified upload bridge must be present');

function setup(){
 const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true};
 const request={id:'ABD-9Z7L82',ref:'9Z7L82',linkedShipmentId:shipment.id,source:'shipment'};
 const state={shipments:[shipment],abdRequests:[request],view:'abd'};
 const listeners=new Map(),handlers=[],timers=[];
 const host={children:[],querySelector(){return this.children[0]||null},appendChild(n){this.children.push(n)}};
 const document={readyState:'complete',createElement(){return{style:{},setAttribute(k,v){this[k]=v}}},addEventListener(name,fn,capture){if(name==='change'&&capture)handlers.push(fn)}};
 const calls=[];
 const window={
   __EXPORTHUB_GET_STATE__:()=>state,
   ExportHUBRC626:Object.freeze({uploadCompletedAbd(){throw Error('legacy uploader must not run')},renderAbd(){}}),
   rc524UploadFile(input,key){calls.push([input.dataset.id,key]);return false},
   addEventListener(name,fn){listeners.set(name,[...(listeners.get(name)||[]),fn])},
   setTimeout(fn,ms){timers.push([ms,fn])},
   canWrite(){return true}
 };
 vm.runInNewContext(part[1],{window,document,setTimeout:window.setTimeout,console});
 return{window,shipment,request,calls,listeners,handlers,host,timers};
}

test('RC1617: ABD failure is shown immediately, never as a successful save',()=>{
 const t=setup();
 const input={files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{id:t.shipment.id},closest(){return t.host},
   matches(s){return s==='input[type="file"]'},getAttribute(k){return k==='onchange'?"return rc524UploadFile(this,'abdFiles')":''},setAttribute(){}};
 const ev={target:input,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};
 t.handlers.forEach(f=>f(ev));
 assert.match(t.host.children[0].textContent,/being processed/i);
 t.listeners.get('exporthub:shipment-document-upload-failed').forEach(fn=>fn({detail:{
   kind:'abd',shipmentId:t.shipment.id,reference:'9Z7L82',message:'HTTP 409: Azure state conflict'
 }}));
 assert.match(t.host.children[0].textContent,/409: Azure state conflict/i);
 assert.equal(t.host.children[0].role,'alert');
 t.listeners.get('exporthub:shipment-document-uploaded').forEach(fn=>fn({detail:{
   kind:'abd',shipmentId:t.shipment.id,reference:'9Z7L82',azureVerified:true
 }}));
 assert.doesNotMatch(t.host.children[0].textContent,/saved for shipment/i);
 assert.equal(t.calls.length,0,'event handler cannot start duplicate uploads');
});

test('RC1617: ABD request view also tracks the central upload result',()=>{
 const t=setup();
 const input={files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{},closest(){return t.host},setAttribute(){}};
 t.window.ExportHUBRC626.uploadCompletedAbd(t.request.id,input);
 assert.deepEqual(t.calls,[[t.shipment.id,'abdFiles']]);
 assert.match(t.host.children[0].textContent,/being processed/i);
 t.listeners.get('exporthub:shipment-document-upload-failed').forEach(fn=>fn({detail:{
   kind:'abd',shipmentId:t.shipment.id,message:'Save failed'
 }}));
 assert.match(t.host.children[0].textContent,/Save failed/i);
});

test('RC1617: release build reports asynchronous ABD failures, never falls back to another current shipment',()=>{
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(builder,/function patchRc1617AbdUploadFailureFeedback\(/);
 assert.match(builder,/html=patchRc1617AbdUploadFailureFeedback\(html,file\)/);
 assert.match(builder,/exporthub:shipment-document-upload-failed/);
 assert.match(builder,/key==='abdFiles'\?findShipment\(input.dataset.id\)/);
 assert.match(builder,/Azure-Speicherung konnte nicht bestätigt werden/);
});


test('RC1617: concurrent ABD uploads ignore unscoped or conflicting shipment events',()=>{
 const t=setup(),s=t.window.__EXPORTHUB_GET_STATE__(),ref2='8LSUHW',id2='SHIP-'+ref2;
 const second={id:id2,ref:ref2,abdRequired:true};
 const request2={id:'ABD-'+ref2,ref:ref2,linkedShipmentId:id2,source:'shipment'};
 s.shipments.push(second);s.abdRequests.push(request2);
 const host1={children:[],querySelector(){return this.children[0]||null},appendChild(n){this.children.push(n)}};
 const host2={children:[],querySelector(){return this.children[0]||null},appendChild(n){this.children.push(n)}};
 const input=host=>({files:[{name:'ABD.pdf',type:'application/pdf'}],dataset:{},closest(){return host},setAttribute(){}});
 const input1=input(host1),input2=input(host2);
 t.window.ExportHUBRC626.uploadCompletedAbd(t.request.id,input1);
 t.window.ExportHUBRC626.uploadCompletedAbd(request2.id,input2);
 const send=(name,detail)=>t.listeners.get(name).forEach(fn=>fn({detail:{kind:'abd',...detail}}));
 const fail=(d)=>send('exporthub:shipment-document-upload-failed',d);
 const succeed=(d)=>send('exporthub:shipment-document-uploaded',{azureVerified:true,...d});
 fail({message:'Unscoped error'});
 fail({shipmentId:t.shipment.id,reference:ref2,message:'Conflicting identifiers'});
 succeed({shipmentId:t.shipment.id,reference:ref2});
 for(const host of [host1,host2])assert.match(host.children[0].textContent,/being processed/i);
 fail({shipmentId:id2,reference:ref2,message:'Azure 409 for second shipment'});
 assert.match(host2.children[0].textContent,/409 for second shipment/);
 assert.match(host1.children[0].textContent,/being processed/i);
 succeed({shipmentId:t.shipment.id,reference:t.shipment.ref});
 assert.match(host1.children[0].textContent,/saved for shipment/i);
 assert.doesNotMatch(host2.children[0].textContent,/saved for shipment/i);
});
