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


test('RC1582: ABD 9Z7L82 darf aus savedShipments nicht an eine falsche aktive Sendung angehängt werden',()=>{
  const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdStatus:'Wartet auf ABD'};
  const other={id:'SHIP-OTHER1',ref:'OTHER1',abdStatus:'Wartet auf ABD'};
  const request={id:'ABD-9Z7L82',ref:'9Z7L82',linkedShipmentId:'SHIP-9Z7L82',source:'shipment'};
  const state={view:'abd',shipments:[other],shipment:other,savedShipments:[shipment],abdRequests:[request]};
  let legacyCalls=0,centralCalls=0,notice='';
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBRC626:Object.freeze({uploadCompletedAbd(){legacyCalls++;return 'legacy'}}),
    rc524UploadFile(){centralCalls++},
    alert:m=>{notice=m},addEventListener(){},setTimeout:fn=>{fn();return 1}
  };
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const input={files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{}};
  const result=window.ExportHUBRC626.uploadCompletedAbd('ABD-9Z7L82',input);
  assert.equal(result,false);
  assert.equal(legacyCalls,0);
  assert.equal(centralCalls,0);
  assert.equal(other.abdFiles,undefined);
  assert.match(notice,/linked shipment|Sendung/i);
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


test('RC1582: lazy geladener ABD-Controller wird beim ersten Dateiauswahl-Event sicher umgebogen',()=>{
  const sh={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true};
  const a={id:'ABD-9Z7L82',ref:'9Z7L82',linkedShipmentId:sh.id,source:'shipment'};
  const s={view:'abd',shipments:[sh],abdRequests:[a]};
  let onChange=null,legacyCalls=0,centralCalls=0;
  const window={
    __EXPORTHUB_GET_STATE__:()=>s,
    rc524UploadFile(input,key){centralCalls++;assert.equal(input.dataset.id,sh.id);assert.equal(key,'abdFiles');return false},
    addEventListener(){},setTimeout(fn){fn();return 1}
  };
  const document={
    readyState:'complete',
    addEventListener(name,fn,capture){if(name==='change'&&capture===true)onChange=fn}
  };
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  assert.equal(typeof onChange,'function');
  assert.equal(window.ExportHUBRC626,undefined,'ABD-Controller is loaded only after page boot');
  window.ExportHUBRC626=Object.freeze({uploadCompletedAbd(){legacyCalls++;return 'legacy'},renderAbd(){}});
  const input={
    files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],
    dataset:{},
    matches(selector){return selector==='input[type="file"]'},
    getAttribute(name){return name==='onchange'?"return window.ExportHUBRC626.uploadCompletedAbd('ABD-9Z7L82',this)":null}
  };
  let prevented=0;
  const evt={target:input,preventDefault(){prevented++},stopPropagation(){prevented++},stopImmediatePropagation(){prevented++}};
  onChange(evt);
  assert.equal(prevented,0);
  assert.equal(window.ExportHUBRC626.__rc1550AbdUploadBridge,true);
  window.ExportHUBRC626.uploadCompletedAbd(a.id,input);
  assert.equal(centralCalls,1);
  assert.equal(legacyCalls,0);
  onChange(evt);
  assert.equal(prevented,0,'an already installed bridge must not block the file change');
});

test('RC1582: Dateiauswahl bei nicht ladbarer sicherer Upload-Runtime wird vor altem onchange blockiert',()=>{
  let onChange=null,notice='',blocked=0;
  const window={addEventListener(){},setTimeout(fn){fn();return 1},alert(m){notice=m}};
  const document={readyState:'complete',addEventListener(name,fn,capture){if(name==='change'&&capture===true)onChange=fn}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const input={matches:()=>true,getAttribute:()=> "return window.ExportHUBRC626.uploadCompletedAbd('ABD-9Z7L82',this)",setAttribute(){}};
  onChange({target:input,preventDefault(){blocked++},stopPropagation(){blocked++},stopImmediatePropagation(){blocked++}});
  assert.equal(blocked,3);
  assert.match(notice,/Secure ABD upload|nicht verfügbar/i);
});


test('RC1584: ABD-Dateiauswahl ohne eindeutig gespeicherte Sendung darf keinen Upload ins leere Shipment starten',()=>{
  const handlers=[],alerts=[],runtimeCalls=[];
  const state={shipments:[{id:'SHIP-OTHER',ref:'OTHER1'}],abdRequests:[]};
  const node={style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v}};
  const host={children:[],querySelector(){return this.children[0]||null},appendChild(n){this.children.push(n)}};
  const document={readyState:'complete',createElement(){return Object.assign({},node,{style:{},attrs:{},setAttribute:node.setAttribute})},addEventListener(name,fn,capture){if(name==='change'&&capture)handlers.push(fn)}};
  const window={__EXPORTHUB_GET_STATE__:()=>state,rc524UploadFile(){runtimeCalls.push(1)},alert:m=>alerts.push(m),addEventListener(){},setTimeout(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  assert.equal(handlers.length,2);
  const input={type:'file',files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{id:'SHIP-9Z7L82'},setAttribute(k,v){this[k]=v},closest(){return host},matches:sel=>sel==='input[type="file"]',getAttribute:k=>k==='onchange'?"return rc524UploadFile(this,'abdFiles')":''};
  let blocked=0;
  const event={target:input,preventDefault(){blocked++},stopPropagation(){blocked++},stopImmediatePropagation(){blocked++}};
  handlers.forEach(h=>h(event));
  assert.equal(blocked,3,'capturing handler blocks the unsafe inline onchange before execution');
  assert.equal(runtimeCalls.length,0);
  assert.match(alerts[0],/shipment SHIP-9Z7L82/i);
  assert.match(host.children[0].textContent,/not started/i);
  assert.equal(input['aria-invalid'],'true');
  assert.equal(state.shipments[0].abdFiles,undefined);
});

test('RC1584: ABD-Upload zeigt nur nach bestätigtem Upload-Ereignis einen Erfolg',()=>{
  const handlers=[],listeners=new Map(),timers=[];
  const state={shipments:[{id:'SHIP-9Z7L82',ref:'9Z7L82'}],abdRequests:[]};
  const host={children:[],querySelector(){return this.children[0]||null},appendChild(n){this.children.push(n)}};
  const document={readyState:'complete',createElement(){return {style:{},setAttribute(){}}},addEventListener(name,fn,capture){if(name==='change'&&capture)handlers.push(fn)}};
  const window={__EXPORTHUB_GET_STATE__:()=>state,rc524UploadFile(){return false},addEventListener(name,fn){listeners.set(name,[...(listeners.get(name)||[]),fn])},setTimeout(fn,ms){timers.push({fn,ms})}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const input={files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{id:'SHIP-9Z7L82'},setAttribute(){},closest(){return host},matches:sel=>sel==='input[type="file"]',getAttribute:k=>k==='onchange'?"return rc524UploadFile(this,'abdFiles')":''};
  let blocked=0;
  const event={target:input,preventDefault(){blocked++},stopPropagation(){blocked++},stopImmediatePropagation(){blocked++}};
  handlers.forEach(h=>h(event));
  assert.equal(blocked,0);
  assert.match(host.children[0].textContent,/being processed/i);
  assert.doesNotMatch(host.children[0].textContent,/saved for shipment/i);
  for(const listener of listeners.get('exporthub:shipment-document-uploaded')||[])listener({detail:{kind:'abd',shipmentId:'SHIP-9Z7L82',reference:'9Z7L82',azureVerified:false}});
  assert.doesNotMatch(host.children[0].textContent,/saved for shipment/i);
  for(const listener of listeners.get('exporthub:shipment-document-uploaded')||[])listener({detail:{kind:'abd',shipmentId:'SHIP-9Z7L82',reference:'9Z7L82',azureVerified:true}});
  assert.match(host.children[0].textContent,/saved for shipment/i);
  const timeout=timers.find(x=>x.ms===90000);
  assert.ok(timeout,'missing confirmation must have a watchdog');
  timeout.fn();
  assert.doesNotMatch(host.children[0].textContent,/No confirmed/i);
});



test('RC1586: Sendungsübersicht ABD 9Z7L82 verwendet gespeicherte Sendung auch ohne shipments-Eintrag',()=>{
  const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82',abdRequired:true,abdStatus:'Wartet auf ABD'};
  const state={view:'shipmentoverview',shipments:[],savedShipments:[shipment],abdRequests:[]};
  const handlers=[],listeners=new Map(),timers=[],notices=[];
  const elements={};
  const host={children:[],querySelector(){return this.children[0]||null},appendChild(el){this.children.push(el)}};
  const document={
    readyState:'complete',
    body:{children:[],appendChild(el){this.children.push(el);if(el.id)elements[el.id]=el}},
    createElement(){return{style:{},setAttribute(){}}},
    getElementById(id){return elements[id]||null},
    addEventListener(name,fn,capture){if(name==='change'&&capture)handlers.push(fn)}
  };
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    rc524UploadFile(input,key){notices.push({id:input.dataset.id,key});return false},
    addEventListener(name,fn){listeners.set(name,[...(listeners.get(name)||[]),fn])},
    setTimeout(fn,ms){timers.push({fn,ms})}
  };
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const input={
    files:[{name:'ABD_9Z7L82.pdf',type:'application/pdf'}],dataset:{id:'SHIP-9Z7L82'},
    matches:x=>x==='input[type="file"]',
    getAttribute:k=>k==='onchange'?"return rc524UploadFile(this,'abdFiles')":'',
    closest(){return host},
    setAttribute(){}
  };
  let prevented=0;
  for(const handler of handlers)handler({target:input,preventDefault(){prevented++},stopPropagation(){prevented++},stopImmediatePropagation(){prevented++}});
  assert.equal(prevented,0,'unique existing saved shipment must remain uploadable');
  assert.equal(state.shipments.length,1);
  assert.equal(state.shipments[0],shipment,'do not create a new empty shipment or copy');
  assert.equal(state.savedShipments[0],shipment,'preserve original existing record');
  assert.equal(elements.rc1586AbdUploadStatus.textContent.includes('being processed'),true);
  window.rc524UploadFile(input,'abdFiles');
  assert.deepEqual(notices,[{id:'SHIP-9Z7L82',key:'abdFiles'}]);
  for(const listener of listeners.get('exporthub:shipment-document-uploaded')||[])listener({detail:{kind:'abd',shipmentId:'SHIP-9Z7L82',reference:'9Z7L82',azureVerified:true}});
  assert.match(elements.rc1586AbdUploadStatus.textContent,/saved for shipment 9Z7L82/);
  assert.equal(state.shipments.length,1,'repeat upload must not duplicate the canonical shipment');
});

test('RC1586: gleiche Ref mit widersprüchlicher Sendungs-ID blockiert ABD ohne Datenmutation',()=>{
  const original={id:'SHIP-ORIGINAL',ref:'9Z7L82'};
  const saved={id:'SHIP-9Z7L82',ref:'9Z7L82'};
  const state={shipments:[original],savedShipments:[saved]};
  const handlers=[],alerts=[];
  const document={readyState:'complete',createElement(){return{style:{},setAttribute(){}}},addEventListener(name,fn,capture){if(name==='change'&&capture)handlers.push(fn)}};
  const window={__EXPORTHUB_GET_STATE__:()=>state,rc524UploadFile(){throw Error('Must not reach upload')},alert:m=>alerts.push(m),addEventListener(){},setTimeout(){}};
  vm.runInNewContext(bridgeSource(),{window,document,setTimeout:window.setTimeout,console});
  const host={children:[],querySelector(){return this.children[0]||null},appendChild(x){this.children.push(x)}};
  const input={dataset:{id:saved.id},files:[{name:'ABD.pdf',type:'application/pdf'}],matches:x=>x==='input[type="file"]',getAttribute:k=>k==='onchange'?"return rc524UploadFile(this,'abdFiles')":'',closest(){return host},setAttribute(){}};
  let stopped=0;
  for(const h of handlers)h({target:input,preventDefault(){stopped++},stopPropagation(){stopped++},stopImmediatePropagation(){stopped++}});
  assert.equal(stopped,3);
  assert.equal(state.shipments.length,1);
  assert.equal(state.shipments[0],original);
  assert.match(alerts[0],/not started|not uniquely/i);
});
