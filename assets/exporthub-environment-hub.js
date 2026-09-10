(()=>{
'use strict';
if(window.__EXPORTHUB_ENVIRONMENT_HUB__)return;
window.__EXPORTHUB_ENVIRONMENT_HUB__=true;

function currentEnvironment(){
  if(window.__EXPORTHUB_DEMO_MODE__===true||/\/demo\.html(?:$|[?#])/i.test(location.href))return'demo';
  if(String(location.hostname||'').toLowerCase().includes('-testservice.'))return'testservice';
  return'production';
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
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installNotificationBridge();openRequestedRoute();},{once:true});else{installNotificationBridge();openRequestedRoute();}
window.ExportHUBEnvironmentHub=Object.freeze({current:currentEnvironment});
})();
