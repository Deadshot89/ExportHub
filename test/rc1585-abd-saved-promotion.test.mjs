import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1049-abd-avis-policy.js','utf8');
function boot(overrides={}){
  const part=source.match(/\/\* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD START \*\/([\s\S]*?)\/\* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD END \*\//);
  assert.ok(part,'verified ABD upload bridge absent');
  const sh={id:'SHIP-9Z7L82',ref:'9Z7L82',customerName:'Essentra Spain',abdRequired:true};
  const request={id:'ABD-9Z7L82',ref:'9Z7L82',linkedShipmentId:sh.id,source:'shipment'};
  const state={shipments:[],savedShipments:[sh],abdRequests:[request]};
  const calls=[],alerts=[],changes=[];
  const clean={
    queueSave:async reason=>{calls.push(['queue',reason]);},
    flushSave:async()=>{calls.push(['flush']);return true;}
  };
  const win={
    __EXPORTHUB_GET_STATE__:()=>state,ExportHUBClean:clean,
    ExportHUBRC626:Object.freeze({uploadCompletedAbd(){calls.push(['legacy']);return 'legacy';}}),
    rc524UploadFile(input,key){calls.push(['upload',input.dataset.id,key]);return false;},
    alert:message=>alerts.push(String(message)),canWrite:()=>true,
    addEventListener(){},setTimeout(fn,ms){if(ms<2)fn();return 1;}
  };
  const doc={readyState:'complete',addEventListener(name,fn,capture){if(name==='change'&&capture)changes.push(fn);}};
  Object.assign(win,overrides.window||{});
  vm.runInNewContext(part[1],{window:win,document:doc,setTimeout:win.setTimeout,console});
  return {win,state,sh,request,calls,alerts,changes};
}

test('RC1585: saved-only Sendung wird vor dem ABD-Upload dauerhaft in shipments gespeichert',async()=>{
  const {win,state,request,calls,sh}=boot();
  assert.equal(state.shipments.length,0);
  await win.ExportHUBRC626.uploadCompletedAbd(request.id,{files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{}});
  assert.equal(state.shipments.length,1);
  assert.equal(state.shipments[0].id,sh.id);
  assert.equal(state.shipments[0].ref,sh.ref);
  assert.deepEqual(calls.map(c=>c[0]),['queue','flush','upload']);
  assert.deepEqual(calls.at(-1),['upload','SHIP-9Z7L82','abdFiles']);
});

test('RC1585: fehlende Azure-Bestätigung blockiert Upload und setzt keine ABD-Erledigung',async()=>{
  const {win,state,request,calls,alerts}=boot({
    window:{ExportHUBClean:{queueSave:async()=>true,flushSave:async()=>false}}
  });
  const result=await win.ExportHUBRC626.uploadCompletedAbd(request.id,{files:[{name:'ABD.pdf',type:'application/pdf'}],dataset:{}});
  assert.equal(result,false);
  assert.equal(state.shipments.length,0,'temporary shipment must not remain after failure');
  assert.equal(calls.some(x=>x[0]==='upload'),false);
  assert.ok(alerts.some(m=>/nicht bestätigt|not confirmed|gespeichert/i.test(m)));
});

test('RC1585: Verweigerung der ABD-Berechtigung verhindert schon die Übernahme',async()=>{
  const {win,state,request,calls}=boot({window:{canWrite:()=>false}});
  const result=win.ExportHUBRC626.uploadCompletedAbd(request.id,{files:[{name:'ABD.pdf',type:'application/pdf'}],dataset:{}});
  assert.equal(result,false);
  assert.equal(state.shipments.length,0);
  assert.equal(calls.length,0);
});

test('RC1585: widersprüchliche IDs oder Referenzen verhindern jeden Upload',async()=>{
  const {win,state,request,calls,alerts}=boot();
  state.shipments.push({id:'OTHER',ref:'9Z7L82'});
  const result=await win.ExportHUBRC626.uploadCompletedAbd(request.id,{files:[{name:'ABD.pdf',type:'application/pdf'}],dataset:{}});
  assert.equal(result,false);
  assert.equal(state.shipments.length,1);
  assert.equal(state.shipments[0].id,'OTHER');
  assert.equal(calls.some(c=>c[0]==='upload'),false);
  assert.ok(alerts.length>0);
});

test('RC1585: direkte ABD-Dateiauswahl aus savedShipments wird im Capturing Handler sicher übernommen',async()=>{
  const {win,state,calls,changes}=boot();
  assert.ok(changes.length>=2);
  const input={type:'file',dataset:{id:'SHIP-9Z7L82'},files:[{name:'ABD.pdf',type:'application/pdf'}],
    matches:selector=>selector==='input[type="file"]',
    getAttribute:name=>name==='onchange'?"return rc524UploadFile(this,'abdFiles')":'',
    setAttribute(){},closest(){return null}};
  let blocked=0;
  const event={target:input,preventDefault(){blocked++},stopPropagation(){blocked++},stopImmediatePropagation(){blocked++}};
  const outcome=changes[0](event);
  assert.equal(blocked,3,'unsafe inline upload must be blocked until Azure confirms');
  if(outcome&&typeof outcome.then==='function')await outcome;
  assert.equal(state.shipments.length,1);
  assert.deepEqual(calls.map(c=>c[0]),['queue','flush','upload']);
  assert.equal(input.dataset.id,'SHIP-9Z7L82');
});

test('RC1585: doppelte Dateiauswahl während Save startet zentralen Upload nur einmal',async()=>{
  let finish;
  const deferred=new Promise(resolve=>{finish=resolve});
  const {win,request,calls}=boot({window:{
    ExportHUBClean:{queueSave:async()=>true,flushSave:async()=>deferred}
  }});
  const input={files:[{name:'ABD.pdf',type:'application/pdf'}],dataset:{}};
  const first=win.ExportHUBRC626.uploadCompletedAbd(request.id,input);
  const second=win.ExportHUBRC626.uploadCompletedAbd(request.id,input);
  assert.equal(first,second);
  assert.equal(calls.some(c=>c[0]==='upload'),false);
  finish(true);await Promise.all([first,second]);
  assert.equal(calls.filter(c=>c[0]==='upload').length,1);
});
