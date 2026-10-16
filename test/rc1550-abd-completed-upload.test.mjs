import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1049-abd-avis-policy.js','utf8');

function bridgeSource(){
  const match=source.match(/\/\* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD START \*\/([\s\S]*?)\/\* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD END \*\//);
  assert.ok(match,'RC1550 bridge must be present in rc1049-abd-avis-policy.js');
  return match[1];
}

test('RC1550: fertiges ABD 9Z7L82 nutzt den dauerhaften zentralen ABD-Upload',()=>{
  const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82',customerName:'Contitech Fluid Serbia d.o.o.',abdRequired:true,abdStatus:'Wartet auf ABD'};
  const request={id:'ABD-9Z7L82',ref:'9Z7L82',customerName:'Contitech Fluid Serbia d.o.o.',colli:0,weight:0,status:'Entwurf'};
  const state={view:'abd',shipments:[shipment],abdRequests:[request]};
  let legacyCalls=0;
  const centralCalls=[];
  const listeners=new Map();
  const baseApi=Object.freeze({
    uploadCompletedAbd(){legacyCalls++;return 'legacy';},
    renderAbd(){},
    openAbdMail(){}
  });
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBRC626:baseApi,
    rc524UploadFile:(input,key)=>{centralCalls.push({id:input.dataset.id,key});return false;},
    addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},
    setTimeout:(fn)=>{fn();return 1;}
  };
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});

  const input={files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{}};
  window.ExportHUBRC626.uploadCompletedAbd('ABD-9Z7L82',input);

  assert.equal(legacyCalls,0,'linked finished ABD must not use the legacy local-only uploader');
  assert.equal(centralCalls.length,1,'linked finished ABD must delegate exactly once');
  assert.equal(centralCalls[0].key,'abdFiles');
  assert.equal(centralCalls[0].id,'SHIP-9Z7L82');
  assert.equal(window.ExportHUBRC626.__rc1550AbdUploadBridge,true);
});

test('RC1550: nicht verknuepfte ABD-Anfrage behaelt den bisherigen Fallback',()=>{
  const request={id:'ABD-STANDALONE',ref:'ABC123',status:'Entwurf'};
  const state={view:'abd',shipments:[],abdRequests:[request]};
  let legacyCalls=0;
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBRC626:Object.freeze({uploadCompletedAbd(){legacyCalls++;return 'legacy';},renderAbd(){}}),
    rc524UploadFile(){throw new Error('central upload must not run without shipment');},
    addEventListener(){},
    setTimeout:(fn)=>{fn();return 1;}
  };
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});

  const result=window.ExportHUBRC626.uploadCompletedAbd('ABD-STANDALONE',{files:[{name:'ABD_ABC123.pdf',type:'application/pdf'}],dataset:{}});
  assert.equal(result,'legacy');
  assert.equal(legacyCalls,1);
});
