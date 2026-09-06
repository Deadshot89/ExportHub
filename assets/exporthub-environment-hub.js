(()=>{
'use strict';
if(window.__EXPORTHUB_ENVIRONMENT_HUB__)return;
window.__EXPORTHUB_ENVIRONMENT_HUB__=true;

const HOST_PROD='wonderful-forest-0f315e310.7.azurestaticapps.net';
const HOST_TEST='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net';
const TARGETS=Object.freeze({
  production:{key:'production',label:'Produktion',url:'https://'+HOST_PROD+'/'},
  testservice:{key:'testservice',label:'TESTSERVICE',url:'https://'+HOST_TEST+'/TESTVERSION.html'},
  demo:{key:'demo',label:'Demo',url:'https://'+HOST_TEST+'/demo.html'}
});

function currentEnvironment(){
  if(window.__EXPORTHUB_DEMO_MODE__===true||/\/demo\.html(?:$|[?#])/i.test(location.href))return'demo';
  if(String(location.hostname||'').toLowerCase().includes('-testservice.'))return'testservice';
  return'production';
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function go(key){
  const target=TARGETS[key];if(!target)return;
  if(window.ExportHUBAndroid&&typeof window.ExportHUBAndroid.selectEnvironment==='function'){
    try{window.ExportHUBAndroid.selectEnvironment(key);return}catch(_){ }
  }
  location.href=target.url;
}
function appAction(){
  if(window.ExportHUBAndroid&&typeof window.ExportHUBAndroid.chooseEnvironment==='function'){
    try{window.ExportHUBAndroid.chooseEnvironment();return}catch(_){ }
  }
  const d=document.getElementById('eh996-app-dialog');
  if(d&&typeof d.showModal==='function'){d.showModal();return;}
  alert('ExportHUB App: In der Android-App stehen Produktion, TESTSERVICE und Demo direkt zur Auswahl.');
}
function style(){
  if(document.getElementById('eh996-env-style'))return;
  const s=document.createElement('style');s.id='eh996-env-style';
  s.textContent=`
#eh996-env-hub{position:fixed;right:12px;bottom:12px;z-index:2147482500;display:flex;align-items:center;gap:6px;padding:7px;border-radius:14px;background:rgba(15,23,42,.95);box-shadow:0 10px 35px rgba(15,23,42,.28);font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;max-width:calc(100vw - 24px)}
#eh996-env-hub button,#eh996-env-hub a{touch-action:manipulation;min-height:36px;border:0;border-radius:10px;padding:8px 10px;font:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
#eh996-env-current{background:#fff;color:#0f172a;pointer-events:none}
#eh996-env-switch{background:#1d4ed8;color:#fff}
#eh996-app-open{background:#e2e8f0;color:#0f172a}
#eh996-env-panel{position:fixed;right:12px;bottom:60px;z-index:2147482501;display:none;min-width:220px;padding:8px;border-radius:14px;background:#fff;box-shadow:0 16px 45px rgba(15,23,42,.3);font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif}
#eh996-env-panel[data-open="1"]{display:grid;gap:6px}
#eh996-env-panel button{touch-action:manipulation;width:100%;text-align:left;border:0;border-radius:10px;padding:11px 12px;background:#f1f5f9;color:#0f172a;cursor:pointer;font:inherit}
#eh996-env-panel button[aria-current="page"]{background:#dbeafe;color:#1d4ed8}
#eh996-app-dialog{border:0;border-radius:16px;padding:0;max-width:min(430px,calc(100vw - 28px));box-shadow:0 22px 70px rgba(15,23,42,.34)}
#eh996-app-dialog::backdrop{background:rgba(15,23,42,.45)}
#eh996-app-dialog .eh996-card{padding:20px;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a}
#eh996-app-dialog h3{margin:0 0 8px;font-size:18px}#eh996-app-dialog p{margin:0 0 14px;color:#475569}
#eh996-app-dialog .eh996-grid{display:grid;grid-template-columns:1fr;gap:8px}
#eh996-app-dialog button{touch-action:manipulation;border:0;border-radius:10px;padding:11px 12px;font:600 13px system-ui;cursor:pointer}
@media(max-width:640px){#eh996-env-hub{left:8px;right:8px;bottom:8px;justify-content:space-between}#eh996-env-hub button{flex:1;padding:7px 8px}#eh996-env-panel{left:8px;right:8px;bottom:58px}}
@media print{#eh996-env-hub,#eh996-env-panel,#eh996-app-dialog{display:none!important}}
`;
  document.head.appendChild(s);
}
function render(){
  if(!document.body||document.getElementById('eh996-env-hub'))return;
  style();
  const env=currentEnvironment(),current=TARGETS[env];
  const hub=document.createElement('div');hub.id='eh996-env-hub';hub.setAttribute('data-exporthub-environment',env);
  hub.innerHTML=`<span id="eh996-env-current">${esc(current.label)}</span><button id="eh996-env-switch" type="button" aria-expanded="false">Bereich wechseln</button><button id="eh996-app-open" type="button">ExportHUB App</button>`;
  const panel=document.createElement('div');panel.id='eh996-env-panel';panel.setAttribute('data-open','0');
  Object.values(TARGETS).forEach(t=>{const b=document.createElement('button');b.type='button';b.textContent=t.label;b.dataset.env=t.key;if(t.key===env)b.setAttribute('aria-current','page');b.addEventListener('click',()=>go(t.key));panel.appendChild(b);});
  const dialog=document.createElement('dialog');dialog.id='eh996-app-dialog';dialog.innerHTML=`<div class="eh996-card"><h3>ExportHUB App</h3><p>Die Android-App arbeitet mit denselben drei getrennten Bereichen. In der App kannst du Produktion, TESTSERVICE oder Demo auswählen.</p><div class="eh996-grid"><button type="button" data-env="production">Produktion öffnen</button><button type="button" data-env="testservice">TESTSERVICE öffnen</button><button type="button" data-env="demo">Demo öffnen</button><button type="button" data-close="1">Schließen</button></div></div>`;
  dialog.querySelectorAll('[data-env]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.env)));
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  hub.querySelector('#eh996-env-switch').addEventListener('click',()=>{const open=panel.getAttribute('data-open')==='1';panel.setAttribute('data-open',open?'0':'1');hub.querySelector('#eh996-env-switch').setAttribute('aria-expanded',open?'false':'true');});
  hub.querySelector('#eh996-app-open').addEventListener('click',appAction);
  document.body.append(panel,hub,dialog);
}

function textOf(selectors){for(const s of selectors){const el=document.querySelector(s);if(el&&String(el.textContent||'').trim())return String(el.textContent||'').trim();}return'';}
function countOf(selectors){const txt=textOf(selectors);const m=txt.match(/\d+/);return m?Number(m[0]):0;}
function sendAndroid(payload){
  if(!payload||!window.ExportHUBAndroid||typeof window.ExportHUBAndroid.notify!=='function')return false;
  const env=currentEnvironment();
  const storageKey=`exporthub-native-notify:${env}:${payload.channel}`;
  const sig=String(payload.key||'')+'|'+String(payload.body||'');let prev='';try{prev=sessionStorage.getItem(storageKey)||''}catch(_){ }
  if(prev===sig)return false;
  try{window.ExportHUBAndroid.notify(payload.channel,payload.key,payload.title,payload.body,payload.route);sessionStorage.setItem(storageKey,sig);return true}catch(_){return false}
}
function notifyAndroid(){
  const notificationCount=countOf(['[data-index236-notification-count]','#index236NotificationCount','#index236NotificationCenter [data-count]','.index236-notification-count']);
  const warningCount=countOf(['[data-rc885-warning-count]','#rc885WarningCount','#rc885WarningDrawer [data-count]','.rc885-warning-count']);
  if(notificationCount>0)sendAndroid({channel:'notification',key:`tasks:${notificationCount}`,title:'ExportHUB Aufgaben',body:`${notificationCount} persönliche Aufgabe${notificationCount===1?'':'n'} offen.`,route:'notifications'});
  if(warningCount>0)sendAndroid({channel:'warning',key:`warnings:${warningCount}`,title:'ExportHUB Warncenter',body:`${warningCount} operative Sendungswarnung${warningCount===1?'':'en'} offen.`,route:'warnings'});
}
function diagnosticMarkerKey(){return `exporthub-native-diagnostic-last:${currentEnvironment()}`;}
function readDiagnosticMarker(){
  try{const raw=localStorage.getItem(diagnosticMarkerKey());if(!raw)return null;const parsed=JSON.parse(raw);return parsed&&typeof parsed==='object'?parsed:null}catch(_){return null}
}
function writeDiagnosticMarker(record,cloud){
  if(!record)return false;
  let id=String(record.id||'').trim();
  if(!id){
    let deviceId='';try{const status=cloud&&typeof cloud.status==='function'?cloud.status():null;deviceId=String(status&&status.deviceId||'').trim()}catch(_){ }
    const seq=Number(record.seq||0),at=String(record.at||record.lastAt||'').trim();
    if(deviceId&&seq&&at)id=`${deviceId}|${seq}|${at}`;
  }
  const atText=String(record.lastAt||record.at||'').trim();
  const at=Date.parse(atText)||Date.now();
  try{localStorage.setItem(diagnosticMarkerKey(),JSON.stringify({id,at,atText}));return true}catch(_){return false}
}
function diagnosticPayload(record,count=1){
  const rec=record||{};
  const area=String(rec.area||'System').replace(/\s+/g,' ').trim().slice(0,80);
  const message=String(rec.message||'Technischer ExportHUB-Hinweis').replace(/\s+/g,' ').trim().slice(0,260);
  const id=String(rec.id||`diag:${Number(rec.seq||0)}:${String(rec.category||'diagnostics')}:${area}`);
  const body=count>1?`${count} neue Diagnoseereignisse. Zuletzt ${area}: ${message}`:`${area}: ${message}`;
  return {channel:'diagnostic',key:id,title:'ExportHUB Fehlerdiagnose',body,route:'diagnostics'};
}
function notifyDiagnostic(event){
  const cloud=window.ExportHUBDiagnosticsCloud864;
  if(!cloud||typeof cloud.isGlobalAdmin!=='function'||!cloud.isGlobalAdmin())return false;
  const detail=event&&event.detail||{};
  const level=String(detail.level||'').toLowerCase();
  if(level!=='error'&&level!=='warning')return false;
  const store=window.__EXPORTHUB_DIAG863_STORE__;
  const records=store&&Array.isArray(store.records)?store.records:[];
  const rec=records.length?records[records.length-1]:null;
  if(!rec)return false;
  const sent=sendAndroid(diagnosticPayload(rec,1));
  if(sent)writeDiagnosticMarker(rec,cloud);
  return sent;
}
async function pollCentralDiagnostics(force){
  if(!window.ExportHUBAndroid||typeof window.ExportHUBAndroid.notify!=='function')return false;
  if(!force&&document.hidden)return false;
  const cloud=window.ExportHUBDiagnosticsCloud864;
  if(!cloud||typeof cloud.isGlobalAdmin!=='function'||!cloud.isGlobalAdmin()||typeof cloud.refresh!=='function'||typeof cloud.recentRecords!=='function')return false;
  try{await cloud.refresh(true)}catch(_){return false}
  let rows=[];try{rows=cloud.recentRecords(120)||[]}catch(_){return false}
  const critical=rows.filter(r=>{const level=String(r&&r.level||'').toLowerCase();return level==='error'||level==='warning'});
  if(!critical.length)return false;
  const marker=readDiagnosticMarker();
  let fresh=[];
  if(!marker){fresh=critical.slice(-1)}else{
    const markerId=String(marker.id||'');
    const idx=markerId?critical.findIndex(r=>String(r&&r.id||'')===markerId):-1;
    if(idx>=0)fresh=critical.slice(idx+1);
    else fresh=critical.filter(r=>(Date.parse(String(r&&r.lastAt||r&&r.at||''))||0)>Number(marker.at||0));
  }
  if(!fresh.length)return false;
  const latest=fresh[fresh.length-1];
  const sent=sendAndroid(diagnosticPayload(latest,fresh.length));
  if(sent)writeDiagnosticMarker(latest,cloud);
  return sent;
}
function openRequestedRoute(){
  let route='';try{route=String(new URLSearchParams(location.search).get('ehRoute')||'').trim().toLowerCase()}catch(_){return false}
  if(!route||!/^[a-z0-9_-]{1,40}$/.test(route))return false;
  let tries=0;
  const open=()=>{
    if(window.ExportHUBRC325&&typeof window.ExportHUBRC325.route==='function'){try{return window.ExportHUBRC325.route(route,'android-notification')!==false}catch(_){return false}}
    return false;
  };
  if(open())return true;
  const retry=()=>{if(open())return;if(++tries<20)setTimeout(retry,250)};
  setTimeout(retry,50);
  return true;
}
function installNotificationBridge(){
  let timer=0,diagnosticTimer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(notifyAndroid,180)};
  const scheduleDiagnostics=(delay=4000,force=false)=>{clearTimeout(diagnosticTimer);diagnosticTimer=setTimeout(async()=>{await pollCentralDiagnostics(force);scheduleDiagnostics(60000,false)},delay)};
  ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:notifications-updated','exporthub:warnings-updated'].forEach(n=>window.addEventListener(n,schedule));
  window.addEventListener('exporthub:diagnostic',notifyDiagnostic);
  window.addEventListener('focus',()=>scheduleDiagnostics(1200,true));
  window.addEventListener('online',()=>scheduleDiagnostics(1200,true));
  if(document.documentElement&&window.MutationObserver){const mo=new MutationObserver(schedule);mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});}
  schedule();
  scheduleDiagnostics(4000,true);
}

document.documentElement.setAttribute('data-exporthub-environment',currentEnvironment());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();installNotificationBridge();openRequestedRoute();},{once:true});else{render();installNotificationBridge();openRequestedRoute();}
window.ExportHUBEnvironmentHub=Object.freeze({targets:TARGETS,current:currentEnvironment,go,openApp:appAction});
})();
