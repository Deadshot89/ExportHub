import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SCRIPT=fs.readFileSync('assets/av-upload.js','utf8');
const PDF=Buffer.from('%PDF-1.4\nAV test\n%%EOF').toString('base64');
function fixture(response){
 const tasks=[
  {id:'task:av-missing:ABC123',sourceType:'av_missing',linkedShipmentRef:'ABC123',status:'offen',done:false},
  {id:'task:av-missing:XYZ789',sourceType:'av_missing',linkedShipmentRef:'XYZ789',status:'offen',done:false},
  {id:'manual-ABC123',sourceType:'manual',linkedShipmentRef:'ABC123',status:'offen',done:false}
 ];
 const state={tasks},events=[],requests=[],alerts=[];
 const window={
  __EXPORTHUB_RC776_VIEW_SHIPMENT__:{ref:'ABC123'},
  __EXPORTHUB_GET_STATE__:()=>state,
  ExportHUBClean:{runtime:{authToken:'fake-session-token'}},
  CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail}},
  dispatchEvent:event=>{events.push(event);return true},
  alert:msg=>{alerts.push(msg)},
  ExportHUBShipmentView:{refreshReferenceFiles:()=>{events.push({type:'refreshReferenceFiles'})}}
 };
 const document={body:{},querySelector:()=>null,addEventListener:()=>{}};
 class FileReader{
  readAsDataURL(){this.result='data:application/pdf;base64,'+PDF;this.onload()}
 }
 const fetch=async(url,opts)=>{
  requests.push({url,opts});
  return{ok:true,status:200,json:async()=>({reference:'ABC123',file:{id:'avblob:stored',name:'AV_ABC123.pdf'},...response})};
 };
 const sandbox={window,document,FileReader,fetch,setTimeout:()=>0,console};
 vm.runInNewContext(SCRIPT,sandbox,{filename:'assets/av-upload.js'});
 return{window,state,events,requests,alerts};
}

test('P0 AV: verified server task completion immediately updates only the matching local AV task',async()=>{
 const f=fixture({ok:true,taskCompleted:true,taskUpdatePending:false,sharepointSaved:false});
 const ok=await f.window.ExportHUBAvUpload.upload({name:'AV.pdf',size:200,type:'application/pdf'},null);
 assert.equal(ok,true);
 assert.equal(f.requests.length,1);
 assert.equal(f.requests[0].url,'/api/reference-files');
 assert.equal(f.state.tasks[0].done,true);
 assert.equal(f.state.tasks[0].completed,true);
 assert.equal(f.state.tasks[0].status,'erledigt');
 assert.equal(f.state.tasks[0].doneBy,'AV-Prüfung');
 assert.equal(f.state.tasks[1].done,false,'different REF must stay untouched');
 assert.equal(f.state.tasks[2].done,false,'manual task must stay untouched');
 const event=f.events.find(e=>e.type==='exporthub:tasks-updated');
 assert.ok(event,'task views should be informed immediately');
 assert.equal(event.detail.reference,'ABC123');
 assert.deepEqual([...event.detail.taskIds],['task:av-missing:ABC123']);
});

test('P0 AV: partial or pending server confirmation never completes a task in the browser',async()=>{
 for(const response of [
  {ok:true,taskCompleted:false,taskUpdatePending:false,sharepointSaved:true},
  {ok:true,taskCompleted:true,taskUpdatePending:true,sharepointSaved:true},
  {ok:true,sharepointSaved:true}
 ]){
  const f=fixture(response);
  assert.equal(await f.window.ExportHUBAvUpload.upload({name:'AV.pdf',size:200,type:'application/pdf'},null),true);
  assert.equal(f.state.tasks[0].done,false);
  assert.equal(f.events.some(e=>e.type==='exporthub:tasks-updated'),false);
 }
});

test('P0 AV: HTTP 200 alone does not prove that an AV was saved',async()=>{
 for(const response of [
  {ok:false,taskCompleted:true},
  {ok:undefined,taskCompleted:true},
  {ok:true,reference:'XYZ789',taskCompleted:true},
  {ok:true,file:null,taskCompleted:true},
  {ok:true,file:{id:'',name:'AV_ABC123.pdf'},taskCompleted:true},
  {ok:true,file:{id:'avblob:stored'},taskCompleted:true}
 ]){
  const f=fixture(response);
  const result=await f.window.ExportHUBAvUpload.upload({name:'AV.pdf',size:200,type:'application/pdf'},null);
  assert.equal(result,false,'upload must fail closed without complete acknowledgement');
  assert.equal(f.state.tasks[0].done,false);
  assert.equal(f.events.some(e=>e.type==='exporthub:tasks-updated'),false);
  assert.equal(f.alerts.length,1,'show an error instead of reporting success');
 }
});
