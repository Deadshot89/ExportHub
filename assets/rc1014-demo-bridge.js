(()=>{
'use strict';
if(window.__EXPORTHUB_RC1014_DEMO_BRIDGE__)return;
window.__EXPORTHUB_RC1014_DEMO_BRIDGE__=true;
if(window.__EXPORTHUB_DEMO_MODE__!==true)return;

const TAB_SESSION_KEY='exporthub_rc301_tab_session';
const demoUser=window.__EXPORTHUB_DEMO_USER__||{id:'DEMO-USER-1',user:'demo.admin',username:'demo.admin',name:'Demo Administrator',role:'Globaler Administrator',globalAdmin:true,permissions:['*']};
const demoToken=String(window.__EXPORTHUB_DEMO_TOKEN__||'demo-session-token');
const demoFixedPickups=[
  {id:'DEMO-FIX-MO',siteLabel:'Fake Fix Nord',weekday:1,note:'Wöchentliche Demo-Abholung',active:true},
  {id:'DEMO-FIX-MI',siteLabel:'Fake Fix Export',weekday:3,note:'Wöchentliche Demo-Abholung',active:true},
  {id:'DEMO-FIX-FR',siteLabel:'Fake Fix Benelux',weekday:5,note:'Wöchentliche Demo-Abholung',active:true}
];

try{
  sessionStorage.setItem(TAB_SESSION_KEY,JSON.stringify({
    token:demoToken,
    user:demoUser,
    deviceId:'demo-browser',
    view:'dashboard',
    savedAt:Date.now(),
    version:'RC1016'
  }));
}catch(_){ }

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-ExportHUB-Demo':'1'}});
}
function body(init){
  try{return init&&typeof init.body==='string'?JSON.parse(init.body||'{}'):{};}catch(_){return{};}
}
function publicItem(item){
  return {id:String(item.id||''),siteLabel:String(item.siteLabel||''),weekday:Number(item.weekday||0),note:String(item.note||''),active:item.active!==false,createdAt:item.createdAt||null,updatedAt:item.updatedAt||null};
}

const previousFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const raw=typeof input==='string'?input:(input&&input.url)||'';
  let url;try{url=new URL(raw,location.href);}catch(_){return previousFetch(input,init);}
  const pathname=url.pathname.toLowerCase();

  if(pathname==='/api/exporthub-state'){
    const response=await previousFetch(input,init);
    try{
      const data=await response.clone().json();
      if(data&&typeof data==='object'){
        data.serverVersion='RC1016';
        return json(data,response.status);
      }
    }catch(_){ }
    return response;
  }

  if(pathname!=='/api/fixed-pickups')return previousFetch(input,init);

  const method=String(init&&init.method||'GET').toUpperCase();
  const payload=body(init);
  if(method==='GET'){
    const includeInactive=url.searchParams.get('includeInactive')==='1';
    const items=demoFixedPickups.filter(item=>includeInactive||item.active!==false).map(publicItem);
    return json({ok:true,demo:true,items,canEdit:true,environment:'demo',companyKey:'demo'});
  }
  if(method==='POST'){
    const stamp=new Date().toISOString();
    const item={id:`DEMO-FIX-${Date.now()}`,siteLabel:String(payload.siteLabel||'Fake Fix neu'),weekday:Number(payload.weekday||1),note:String(payload.note||''),active:payload.active!==false,createdAt:stamp,updatedAt:stamp};
    demoFixedPickups.push(item);
    return json({ok:true,demo:true,item:publicItem(item)},201);
  }
  if(method==='PATCH'){
    const id=String(payload.id||'');
    const item=demoFixedPickups.find(entry=>String(entry.id)===id);
    if(!item)return json({ok:false,demo:true,code:'FIX_NOT_FOUND',message:'Demo-FIX-Eintrag wurde nicht gefunden.'},404);
    for(const key of ['siteLabel','weekday','note','active'])if(Object.prototype.hasOwnProperty.call(payload,key))item[key]=payload[key];
    item.updatedAt=new Date().toISOString();
    return json({ok:true,demo:true,item:publicItem(item)});
  }
  return json({ok:false,demo:true,code:'METHOD_NOT_ALLOWED',message:'Methode in der Demo nicht unterstützt.'},405);
};

window.__EXPORTHUB_RC1014_DEMO_FIXED_PICKUPS__=demoFixedPickups;
})();