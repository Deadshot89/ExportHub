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

test('RC1550: geaenderte ABD-Runtime wird in Produktion nicht aus altem Browsercache geladen',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  const route=(config.routes||[]).find(item=>item.route==='/assets/rc1049-abd-avis-policy.js');
  assert.ok(route,'ABD-Runtime muss eine explizite Cache-Regel besitzen');
  assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store/i);
});


test('RC1582: ABD 9Z7L82 findet die Sendung auch in gespeicherten Sendungen und nutzt nur den zentralen Uploader',()=>{
  const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdStatus:'Wartet auf ABD'};
  const request={id:'ABD-9Z7L82',ref:'9Z7L82',linkedShipmentId:'SHIP-9Z7L82',source:'shipment'};
  const state={view:'abd',shipments:[],savedShipments:[shipment],abdRequests:[request]};
  let legacyCalls=0;
  const centralCalls=[];
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBRC626:Object.freeze({uploadCompletedAbd(){legacyCalls++;return 'legacy'}}),
    rc524UploadFile:(input,key)=>{centralCalls.push({id:input.dataset.id,key});return false},
    addEventListener(){},setTimeout:fn=>{fn();return 1}
  };
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const input={files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{}};
  window.ExportHUBRC626.uploadCompletedAbd('ABD-9Z7L82',input);
  assert.deepEqual(centralCalls,[{id:'SHIP-9Z7L82',key:'abdFiles'}]);
  assert.equal(legacyCalls,0);
});

test('RC1582: verknüpfte ABD-Anfrage ohne Sendung wird nicht stillschweigend nur lokal gespeichert',()=>{
  const a={id:'ABD-9Z7L82',ref:'9Z7L82',linkedShipmentId:'SHIP-9Z7L82',source:'shipment'};
  const state={view:'abd',shipments:[],abdRequests:[a]};
  let legacyCalls=0,alertText='';
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBRC626:Object.freeze({uploadCompletedAbd(){legacyCalls++;return 'legacy'}}),
    alert:message=>{alertText=message},addEventListener(){},setTimeout:fn=>{fn();return 1}
  };
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const input={files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{},setAttribute(k,v){this[k]=v}};
  const result=window.ExportHUBRC626.uploadCompletedAbd('ABD-9Z7L82',input);
  assert.equal(result,false);
  assert.equal(legacyCalls,0);
  assert.equal(input['aria-invalid'],'true');
  assert.match(alertText,/linked shipment|Sendung/i);
});

test('RC1582: fehlender sicherer Uploader setzt ABD nicht auf erledigt',()=>{
  const sh={id:'SHIP-9Z7L82',ref:'9Z7L82',abdStatus:'Wartet auf ABD'};
  const request={id:'ABD-9Z7L82',ref:'9Z7L82',source:'shipment',linkedShipmentId:'SHIP-9Z7L82',status:'Angefragt'};
  const s={view:'abd',shipments:[sh],abdRequests:[request]};
  let legacy=0,alertText='';
  const window={
    __EXPORTHUB_GET_STATE__:()=>s,
    ExportHUBRC626:Object.freeze({uploadCompletedAbd(){legacy++;return 'legacy'}}),
    alert:msg=>{alertText=msg},addEventListener(){},setTimeout:fn=>{fn();return 1}
  };
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const result=window.ExportHUBRC626.uploadCompletedAbd(request.id,{files:[{name:'ABD.pdf',type:'application/pdf'}],dataset:{}});
  assert.equal(result,false);assert.equal(legacy,0);
  assert.equal(request.status,'Angefragt');
  assert.equal(sh.abdStatus,'Wartet auf ABD');
  assert.match(alertText,/Secure ABD upload|nicht verfügbar/i);
});

test('RC1582: fehlende ABD-Berechtigung blockiert den verknüpften Upload vor der Speicherung',()=>{
  const sh={id:'SHIP-9Z7L82',ref:'9Z7L82'};
  const a={id:'ABD-9Z7L82',ref:'9Z7L82',linkedShipmentId:sh.id};
  const s={shipments:[sh],abdRequests:[a]};
  let called=false,notice='';
  const window={
    __EXPORTHUB_GET_STATE__:()=>s,
    ExportHUBRC626:Object.freeze({uploadCompletedAbd(){throw Error('Legacy must not run')}}),
    rc524UploadFile(){called=true},canWrite:area=>area!=='abd',
    alert:m=>{notice=m},addEventListener(){},setTimeout:fn=>{fn();return 1}
  };
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  assert.equal(window.ExportHUBRC626.uploadCompletedAbd(a.id,{files:[{name:'ABD.pdf',type:'application/pdf'}],dataset:{}}),false);
  assert.equal(called,false);
  assert.match(notice,/permission|Berechtigung/i);
});
