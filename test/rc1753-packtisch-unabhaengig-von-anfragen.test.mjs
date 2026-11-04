import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const read=file=>fs.readFileSync(file,'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const authRequire=createRequire(new URL('../api/shared/auth-store.js',import.meta.url));
const authModule={exports:{}};
// Exercise the real server resolver without installing or contacting Azure.
// This gate intentionally runs before runtime dependencies are installed.
vm.runInNewContext(read('api/shared/auth-store.js'),{
  module:authModule,process:{env:{}},Buffer,URL,
  require(name){
    if(name==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){throw new Error('Environment resolution must not access storage');}}};
    return authRequire(name);
  }
});
const {environmentFromRequest}=authModule.exports;

function harness({admin=true,hostname='exporthub360.com',environment='production'}={}){
  const listeners=[],opened=[],requests=[],alerts=[];
  const side={children:[],appendChild(node){this.children.push(node);return node;}};
  function makeHeader(){
    const header={querySelector(sel){
      if(sel==='.pack-internal-detail-head-side')return side;
      if(sel==='[data-pack-station-action="open-station"]')return side.children.find(x=>x.getAttribute('data-pack-station-action')==='open-station')||null;
      return null;
    }};
    return header;
  }
  let header=makeHeader(),style=null;
  const section={
    id:'packNotificationDetail',
    querySelector(sel){return sel==='.pack-internal-detail-head'?header:null;}
  };
  const doc={
    head:{appendChild(n){style=n;}},documentElement:{lang:'de'},
    getElementById(id){if(id==='packNotificationDetail')return section;if(id==='packStationAdminStyle')return style;return null;},
    createElement(){return{type:'',className:'',textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k]||null;}};},
    addEventListener(name,callback,capture){listeners.push({name,callback,capture});}
  };
  const root={
    location:{hostname},
    document:doc,open(url){const tab={opener:'prior',closed:false,location:{href:url},close(){this.closed=true;}};opened.push(tab);return tab;},
    alert(msg){alerts.push(msg);},setTimeout(){},addEventListener(){},
    __EXPORTHUB_GET_CURRENT_USER__:()=>({isGlobalAdmin:admin}),
    __EXPORTHUB_GET_STATE__:()=>({tasks:[{id:'pack:1',sourceType:'pack_notification',status:'open'},{id:'pack:2',sourceType:'pack_notification',status:'open'}]}),
    ExportHUBClean:{runtime:{authToken:'VALID',environment}},
    fetch:async(url,options)=>{requests.push({url,options});return{ok:true,status:200,async text(){return JSON.stringify({ok:true,url:'https://exporthub360.com/pack/pks1_valid'});}};}
  };
  vm.runInNewContext(read('assets/pack-station-admin.js'),{window:root,globalThis:root,Promise,Array,Object,String,JSON,Date});
  function click(button){
    const e={target:{closest(selector){if(selector.includes('#packNotificationDetail'))return section;if(selector==='[data-pack-station-action]')return button;return null;}},preventDefault(){this.prevented=true;}};
    for(const listener of listeners.filter(x=>x.name==='click'&&x.capture))listener.callback(e);
    return e;
  }
  return{root,side,section,opened,requests,alerts,click,rerender(){side.children.length=0;header=makeHeader();}};
}

test('P0 Packtisch opens from pending Packmeldung detail without completing either request',async()=>{
  const h=harness();
  assert.equal(h.root.ExportHUBPackStationAdmin.decorateDetail(),true);
  assert.equal(h.side.children.length,1);
  const button=h.side.children[0];
  assert.equal(button.getAttribute('data-pack-station-action'),'open-station');
  const event=h.click(button);
  assert.equal(event.prevented,true);
  await flush();
  assert.equal(h.opened.length,1);
  assert.equal(h.opened[0].location.href,'https://exporthub360.com/pack/pks1_valid');
  assert.equal(h.opened[0].opener,null);
  assert.equal(h.requests.length,1,'only current shared QR is requested; pending Packmeldungen are not modified');
  assert.deepEqual(h.alerts,[]);
});

test('Packtisch action is idempotent and can be restored after request edit rerender',()=>{
  const h=harness(),api=h.root.ExportHUBPackStationAdmin;
  api.decorateDetail();
  api.decorateDetail();
  assert.equal(h.side.children.length,1,'no duplicate button after app render');
  h.rerender();
  api.decorateDetail();
  assert.equal(h.side.children.length,1,'edit/detail rerender must restore action');
});

test('Packtisch shared QR remains administrator-only as on existing website',()=>{
  const h=harness({admin:false});
  assert.equal(h.root.ExportHUBPackStationAdmin.decorateDetail(),false);
  assert.equal(h.side.children.length,0);
});

test('TESTSERVICE Packtisch link request reaches the same environment behind an internal Azure Functions host',async()=>{
  const h=harness({hostname:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',environment:'testservice'});
  h.root.ExportHUBPackStationAdmin.decorateDetail();
  h.click(h.side.children[0]);
  await flush();
  const headers=h.requests[0].options.headers;
  assert.equal(headers['X-ExportHUB-Environment'],'testservice');
  assert.equal(environmentFromRequest({headers:{...headers,host:'functions.azurewebsites.net',origin:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'}}),'testservice');
  assert.equal(headers.Authorization,'Bearer VALID');
});

test('production Packtisch request cannot inherit stale TESTSERVICE runtime environment',async()=>{
  const h=harness({hostname:'www.exporthub360.de',environment:'testservice'});
  h.root.ExportHUBPackStationAdmin.decorateDetail();
  h.click(h.side.children[0]);
  await flush();
  assert.equal(h.requests[0].options.headers['X-ExportHUB-Environment'],'production');
});

test('local Packtisch development retains the explicitly selected TESTSERVICE environment',async()=>{
  const h=harness({hostname:'localhost',environment:'testservice'});
  h.root.ExportHUBPackStationAdmin.decorateDetail();
  h.click(h.side.children[0]);
  await flush();
  assert.equal(h.requests[0].options.headers['X-ExportHUB-Environment'],'testservice');
});

test('QR preview loading cannot lock direct Packtisch open',async()=>{
  const h=harness(),api=h.root.ExportHUBPackStationAdmin;
  api.decorateDetail();
  const originalFetch=h.root.fetch;
  let resolveQr;
  let count=0;
  h.root.fetch=(url,opts)=>{
    count++;
    if(count===1)return new Promise(resolve=>{resolveQr=resolve;});
    return originalFetch(url,opts);
  };
  const pendingQr=api.showQr(h.section);
  h.click(h.side.children[0]);
  await flush();
  assert.equal(h.opened[0].location.href,'https://exporthub360.com/pack/pks1_valid');
  resolveQr({ok:true,status:200,async text(){return JSON.stringify({ok:true,url:'https://exporthub360.com/pack/pks1_valid',qrSvg:'<svg/>'});}});
  await pendingQr;
});

test('Pack notification detail and its edit rerender explicitly reinstate station action',()=>{
  const internal=read('assets/pack-notification-internal.js'),nav=read('assets/pack-notification-nav.js');
  assert.match(internal,/const showEdit=\(draft,errorText\)=>\{section\.innerHTML=editHtml\(model,draft,errorText\);try\{root\.ExportHUBPackStationAdmin/);
  assert.match(internal,/host\.appendChild\(section\);try\{doc\.body\.setAttribute\('data-exporthub-view','packnotification'\)/);
  assert.match(nav,/else if\(detail\)\{ensureStationAdmin\(\)\.then\(admin=>\{/);
  assert.match(nav,/setActive\(inbox\|\|detail\)/);
});
