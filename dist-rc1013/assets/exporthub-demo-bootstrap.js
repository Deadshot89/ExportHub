(()=>{
'use strict';
const RC1523_DE=Object.freeze({
  "sop.demo.stateRequired":"Für die Demo-Speicherung fehlt ein gültiger State."
});
if(window.__EXPORTHUB_DEMO_BOOTSTRAP__)return;
window.__EXPORTHUB_DEMO_BOOTSTRAP__=true;
window.__EXPORTHUB_DEMO_MODE__=true;
document.documentElement.setAttribute('data-exporthub-demo','1');

const PREFIX='exporthub-demo:';
const now=new Date();
const iso=(days=0,h=10)=>{const d=new Date(now);d.setDate(d.getDate()+days);d.setHours(h,0,0,0);return d.toISOString();};
const demoUser={id:'DEMO-USER-1',user:'demo.admin',login:'demo.admin',username:'demo.admin',name:'Demo Administrator',role:'Globaler Administrator',globalAdmin:true,permissions:['*'],rights:{},active:true,status:'Aktiv',mustChange:false};
const customers=[
  {id:'DEMO-CUST-1001',customerNumber:'D1001',account:'D1001',name:'Fake Kunde Nord GmbH',country:'DE',address:'Musterstraße 12, 40210 Düsseldorf, Deutschland',email:'demo-nord@example.invalid',portalName:'Fake Speditionsportal Nord',portalUrl:'https://example.invalid/fake-portal-nord',locations:[{id:'DEMO-LOC-1',name:'Zentrallager Düsseldorf',address:'Musterstraße 12, 40210 Düsseldorf, Deutschland',country:'DE'}]},
  {id:'DEMO-CUST-1002',customerNumber:'D1002',account:'D1002',name:'Fake Kunde Benelux B.V.',country:'NL',address:'Voorbeeldweg 8, 5911 AA Venlo, Niederlande',email:'demo-benelux@example.invalid',locations:[{id:'DEMO-LOC-2',name:'Warehouse Venlo',address:'Voorbeeldweg 8, 5911 AA Venlo, Niederlande',country:'NL'}]},
  {id:'DEMO-CUST-1003',customerNumber:'D1003',account:'D1003',name:'Essentra Components Sweden AB · Fake Export Ltd.',country:'GB',address:'1 Demo Park, Birmingham B1 1AA, United Kingdom',email:'demo-export@example.invalid',locations:[{id:'DEMO-LOC-3',name:'Birmingham DC',address:'1 Demo Park, Birmingham B1 1AA, United Kingdom',country:'GB'}]}
];
const shipments=[
  {id:'DEMO-SHIP-1',ref:'DEMO01',reference:'DEMO01',customerId:'DEMO-CUST-1001',customerNumber:'D1001',customerName:'Fake Kunde Nord GmbH',locationId:'DEMO-LOC-1',recipientAddress:'Musterstraße 12, 40210 Düsseldorf, Deutschland',destinationCountry:'DE',status:'Bereit zur Abholung',plannedPickupDate:iso(0,14),createdAt:iso(-1,9),updatedAt:iso(0,8),rows:[{id:'R1',type:'Europalette',packaging:'Europalette',count:2,qty:2,weight:420,ldm:0.4,length:120,width:80,height:135}],documents:[{id:'DOC-DEMO-1',name:'Fake_Lieferschein_DEMO01.pdf',type:'Lieferschein'}]},
  {id:'DEMO-SHIP-2',ref:'DEMO02',reference:'DEMO02',customerId:'DEMO-CUST-1002',customerNumber:'D1002',customerName:'Fake Kunde Benelux B.V.',locationId:'DEMO-LOC-2',recipientAddress:'Voorbeeldweg 8, 5911 AA Venlo, Niederlande',destinationCountry:'NL',status:'Erstellt',plannedPickupDate:iso(1,11),createdAt:iso(0,7),updatedAt:iso(0,9),comments:'RC1203 Demo-Bemerkung: Ware trocken und gut sichtbar bereitstellen.',rows:[{id:'R2',type:'Karton',packaging:'Karton',count:6,qty:6,weight:96,ldm:0,length:60,width:40,height:45}],documents:[{id:'DOC-DEMO-2',name:'Fake_Lieferschein_DEMO02.pdf',type:'Lieferschein'}],deliveryFiles:[{id:'DLV-DEMO-2A',name:'Fake_Lieferschein_DEMO02.pdf'},{id:'DLV-DEMO-2B',name:'LS_47110002.pdf'},{id:'DLV-DEMO-2C',name:'LS_47110003.pdf'},{id:'DLV-DEMO-2D',name:'LS_47110004.pdf'},{id:'DLV-DEMO-2E',name:'LS_47110005.pdf'},{id:'DLV-DEMO-2F',name:'LS_47110006.pdf'},{id:'DLV-DEMO-2G',name:'LS_47110007.pdf'}]},
  {id:'DEMO-SHIP-3',ref:'DEMO03',reference:'DEMO03',customerId:'DEMO-CUST-1003',customerNumber:'D1003',customerName:'Essentra Components Sweden AB · Fake Export Ltd.',locationId:'DEMO-LOC-3',recipientAddress:'1 Demo Park, Birmingham B1 1AA, United Kingdom',destinationCountry:'GB',status:'Wartet auf ABD',plannedPickupDate:iso(2,13),createdAt:iso(-1,15),updatedAt:iso(0,8),abdRequired:true,abdStatus:'offen',rows:[{id:'R3',type:'Europalette',packaging:'Europalette',count:4,qty:4,weight:880,ldm:0.8,length:120,width:80,height:150}],documents:[{id:'DOC-DEMO-3',name:'Fake_Lieferschein_DEMO03.pdf',type:'Lieferschein'}]}
];
const tasks=[
  {id:'DEMO-TASK-1',title:'Abholtag DEMO01',name:'Abholtag DEMO01',status:'Offen',priority:'Hoch',dueAt:iso(0,14),linkedShipmentRef:'DEMO01',linkedCustomer:'Fake Kunde Nord GmbH',assignedTo:'Demo Administrator'},
  {id:'DEMO-TASK-2',title:'ABD für DEMO03 prüfen',name:'ABD für DEMO03 prüfen',status:'Offen',priority:'Hoch',dueAt:iso(0,12),linkedShipmentRef:'DEMO03',linkedCustomer:'Essentra Components Sweden AB · Fake Export Ltd.',assignedTo:'Demo Administrator'},
  {id:'DEMO-TASK-3',title:'Ladeliste DEMO02 vorbereiten',name:'Ladeliste DEMO02 vorbereiten',status:'Offen',priority:'Normal',dueAt:iso(1,9),linkedShipmentRef:'DEMO02',linkedCustomer:'Fake Kunde Benelux B.V.',assignedTo:'Demo Administrator'}
];
// RC1660: fake customer SOP so "SOP öffnen" and the click simulation can be tried in the demo.
const customSops=[
  {id:'DEMO-SOP-NORD',title:'Fake Kunde Nord · Kunden-SOP',type:'Kunde',account:'D1001',customerName:'Fake Kunde Nord GmbH',portal:'Fake Speditionsportal Nord',portalUrl:'https://example.invalid/fake-portal-nord',steps:[
    {title:'Im Speditionsportal anmelden',text:'Fake Speditionsportal Nord öffnen und mit dem Demo-Zugang anmelden.'},
    {title:'Kundennummer eintragen',text:'Kundennummer D1001 in das Feld Kundennummer eintragen.'},
    {title:'Abholort auswählen',text:'Als Abholort das Zentrallager Düsseldorf auswählen.'},
    {title:'Colli und Gewicht eintragen',text:'Anzahl der Colli und das Gesamtgewicht aus der Sendung übernehmen.'},
    {title:'Lieferschein prüfen',text:'Lieferscheinnummer mit der Sendungsreferenz vergleichen.'},
    {title:'Transportauftrag speichern',text:'Transportauftrag speichern und die Bestätigung im Sendungsordner ablegen.'}
  ]}
];
const notifications=[
  {id:'DEMO-NOTICE-1',type:'Aufgabe',title:'Fake Aufgabe fällig',message:'ABD für DEMO03 prüfen',createdAt:iso(0,9),read:false},
  {id:'DEMO-NOTICE-2',type:'Aufgabe',title:'Fake Abholerinnerung',message:'DEMO01 ist heute zur Abholung geplant.',createdAt:iso(0,9),read:false}
];
const warnings=[
  {id:'DEMO-WARN-1',type:'Dokumente',title:'Fake Warnung: ABD fehlt',message:'Für DEMO03 ist ein ABD erforderlich.',shipmentRef:'DEMO03',severity:'hoch'},
  {id:'DEMO-WARN-2',type:'Abholung',title:'Fake Warnung: Abholung heute',message:'DEMO01 ist bereit zur Abholung.',shipmentRef:'DEMO01',severity:'mittel'}
];
let state={
  customers,shipments,savedShipments:shipments,tasks,notifications,warnings,customSops,
  currentUser:demoUser,activeUser:demoUser,
  _exporthubEnvironment:{name:'demo',isolated:true,seededAt:new Date().toISOString(),fakeData:true},
  notificationCenter:{items:notifications,unread:notifications.length},
  warningCenter:{items:warnings,count:warnings.length}
};
let team={schemaVersion:3,revision:1013,updatedAt:new Date().toISOString(),updatedBy:'ExportHUB Demo',clientVersion:'RC1013-demo',dataEnvironment:'demo',state,users:[demoUser]};
window.__EXPORTHUB_DEMO_USER__=demoUser;
window.__EXPORTHUB_DEMO_TOKEN__='demo-session-token';

try{
  const proto=Storage.prototype;
  if(!proto.__exporthubDemoWrapped){
    const rawGet=proto.getItem,rawSet=proto.setItem,rawRemove=proto.removeItem,rawClear=proto.clear,rawKey=proto.key;
    Object.defineProperty(proto,'__exporthubDemoWrapped',{value:true,configurable:false});
    proto.getItem=function(key){return this===window.localStorage?rawGet.call(this,PREFIX+String(key)):rawGet.call(this,key);};
    proto.setItem=function(key,value){return this===window.localStorage?rawSet.call(this,PREFIX+String(key),String(value)):rawSet.call(this,key,String(value));};
    proto.removeItem=function(key){return this===window.localStorage?rawRemove.call(this,PREFIX+String(key)):rawRemove.call(this,key);};
    proto.key=function(index){
      if(this!==window.localStorage)return rawKey.call(this,index);
      const keys=[];for(let i=0;i<this.length;i++){const k=rawKey.call(this,i);if(k&&k.startsWith(PREFIX))keys.push(k.slice(PREFIX.length));}
      return keys[index]??null;
    };
    proto.clear=function(){
      if(this!==window.localStorage)return rawClear.call(this);
      const keys=[];for(let i=0;i<this.length;i++){const k=rawKey.call(this,i);if(k&&k.startsWith(PREFIX))keys.push(k);}
      keys.forEach(k=>rawRemove.call(this,k));
    };
  }
}catch(_){ }

function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function normalizedDemoState(value){
  const incoming=isObject(value)?value:{};
  const next=Object.assign({},state,incoming);
  next.currentUser=demoUser;
  next.activeUser=demoUser;
  next._exporthubEnvironment=Object.assign({},state._exporthubEnvironment||{},incoming._exporthubEnvironment||{},{name:'demo',isolated:true,fakeData:true});
  return next;
}
function syncDemoGlobals(){
  team=Object.assign({},team,{state,users:[demoUser],dataEnvironment:'demo'});
  window.__EXPORTHUB_DEMO_STATE__=team;
}
function persistDemoState(){
  try{localStorage.setItem('exporthub-team-state',JSON.stringify(state));return true;}catch(_){return false;}
}
function hydrateDemoState(){
  try{
    const raw=localStorage.getItem('exporthub-team-state');
    if(!raw)return false;
    const stored=JSON.parse(raw);
    if(!isObject(stored))return false;
    state=normalizedDemoState(stored);
    syncDemoGlobals();
    return true;
  }catch(_){return false;}
}
function commitDemoState(nextState,payload){
  if(!isObject(nextState))return false;
  state=normalizedDemoState(nextState);
  const requestedBase=Number(payload&&payload.baseRevision||0);
  const previousRevision=Number(team&&team.revision||0);
  const revision=Math.max(previousRevision+1,Number.isFinite(requestedBase)?requestedBase+1:0);
  team=Object.assign({},team,{revision,updatedAt:new Date().toISOString(),updatedBy:'ExportHUB Demo',clientVersion:String(payload&&payload.clientVersion||team.clientVersion||'RC996-demo'),dataEnvironment:'demo',state,users:[demoUser]});
  window.__EXPORTHUB_DEMO_STATE__=team;
  persistDemoState();
  return true;
}

hydrateDemoState();
syncDemoGlobals();

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-ExportHUB-Demo':'1'}});}
function text(v){return String(v==null?'':v);}
function i18n(key,fallback){try{const api=window.ExportHUBI18n;if(api&&typeof api.t==='function'){const value=api.t(key);if(value&&value!==key)return value;}}catch(_){}return fallback;}
function parseBody(init){
  try{if(!init||init.body==null)return{};if(typeof init.body==='string')return JSON.parse(init.body||'{}');return{};}catch(_){return{};}
}
const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const raw=typeof input==='string'?input:(input&&input.url)||'';
  let u;try{u=new URL(raw,location.href);}catch(_){return originalFetch(input,init);}
  if(!/\/api\//i.test(u.pathname))return originalFetch(input,init);

  const path=u.pathname.toLowerCase(),payload=parseBody(init),method=text(init&&init.method||'GET').toUpperCase();
  if(path.includes('/api/exporthub-health'))return json({ok:true,demo:true,version:'RC1013',environment:'demo'});
  if(path.includes('/api/exporthub-auth-probe'))return json({ok:true,demo:true,authenticated:true,user:demoUser,environment:'demo'});
  if(path.includes('/api/exporthub-auth')){
    const action=text(payload.action||payload.mode||u.searchParams.get('action')).toLowerCase();
    if(action.includes('bootstrap'))return json({ok:true,demo:true,storageConfigured:true,storageReachable:true,initialPasswordConfigured:true,bootstrapUsername:'demo.admin',bootstrapCompleted:true,userExists:true,userHasCredential:true,accountActive:true,requiresBootstrap:false});
    if(action.includes('list')||action.includes('admin'))return json({ok:true,demo:true,users:[demoUser],modules:[],sessions:[{id:'DEMO-SESSION',userId:demoUser.id,username:demoUser.user,displayName:demoUser.name,deviceId:'demo-browser',createdAt:iso(0,8),expiresAt:iso(1,8)}]});
    return json({ok:true,demo:true,token:'demo-session-token',mustChange:false,user:demoUser,passwordPolicy:{minLength:6,upper:true,lower:true,number:true,special:false,history:false}});
  }
  if(path.includes('/api/exporthub-state')){
    if(method==='GET'||payload.action==='read'||payload.mode==='read')return json({ok:true,demo:true,environment:'demo',revision:team.revision,updatedAt:team.updatedAt,state:team.state,users:team.users,team});
    const incoming=isObject(payload.state)?payload.state:(isObject(payload.team)&&isObject(payload.team.state)?payload.team.state:null);
    if(!incoming)return json({ok:false,demo:true,environment:'demo',code:'DEMO_STATE_REQUIRED',message:i18n('sop.demo.stateRequired',RC1523_DE['sop.demo.stateRequired'])},400);
    commitDemoState(incoming,payload);
    return json({ok:true,demo:true,environment:'demo',revision:team.revision,updatedAt:team.updatedAt,state:team.state,users:team.users,team,simulated:true,ackOnly:u.searchParams.get('ack')==='1'});
  }
  if(/pickup|customer-avis|pod-backup|mail|email|outlook|send/i.test(path)){
    return json({ok:false,demo:true,code:'DEMO_EXTERNAL_BLOCKED',message:'Diese Außenwirkung ist in der Fake-Demo absichtlich deaktiviert.'},403);
  }
  if(path.includes('/api/'))return json({ok:true,demo:true,simulated:true,message:'Fake Demo-Aktion lokal simuliert.'});
  return originalFetch(input,init);
};

try{
  localStorage.setItem('exporthub-demo-seeded','1');
  localStorage.setItem('exporthub-auth-token','demo-session-token');
  localStorage.setItem('exporthub-session-token','demo-session-token');
  localStorage.setItem('exporthub-current-user',JSON.stringify(demoUser));
  persistDemoState();
}catch(_){ }

function banner(){
  if(!document.body||document.getElementById('eh1013-demo-banner'))return;
  const b=document.createElement('div');b.id='eh1013-demo-banner';b.textContent='DEMO · ausschließlich Fake-Daten · keine echten Mails, QR-/Avis-Tokens oder Azure-Schreibvorgänge';
  b.style.cssText='position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147482600;max-width:calc(100vw - 20px);padding:8px 12px;border-radius:999px;background:#7c3aed;color:#fff;font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 8px 25px rgba(76,29,149,.25);pointer-events:none;text-align:center';
  document.body.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',banner,{once:true});else banner();
})();
