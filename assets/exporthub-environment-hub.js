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
#eh996-env-hub{position:fixed;right:16px;top:16px;bottom:auto;z-index:2147482500;display:flex;align-items:center;gap:4px;padding:4px;border:1px solid rgba(148,163,184,.42);border-radius:13px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(15,23,42,.16);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font:600 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;max-width:calc(100vw - 32px);box-sizing:border-box}
#eh996-env-hub button,#eh996-env-hub a{touch-action:manipulation;min-height:34px;border:0;border-radius:9px;padding:7px 10px;font:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;box-sizing:border-box;transition:background .16s ease,box-shadow .16s ease,transform .16s ease}
#eh996-env-hub button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
#eh996-env-current{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:7px 10px;border-radius:9px;background:#f1f5f9;color:#334155;white-space:nowrap;box-sizing:border-box}
#eh996-env-current::before{content:"";width:7px;height:7px;margin-right:7px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.13);flex:0 0 auto}
#eh996-env-switch{background:#2563eb;color:#fff;box-shadow:0 2px 7px rgba(37,99,235,.22)}
#eh996-env-switch:hover{background:#1d4ed8;box-shadow:0 3px 10px rgba(37,99,235,.28)}
#eh996-env-switch:active{transform:translateY(1px)}
#eh996-app-open{background:#e2e8f0;color:#0f172a}
#eh996-app-open:hover{background:#cbd5e1}
#eh996-env-panel{position:fixed;right:16px;top:66px;bottom:auto;z-index:2147482501;display:none;min-width:220px;padding:8px;border:1px solid #dbe3ee;border-radius:14px;background:#fff;box-shadow:0 16px 45px rgba(15,23,42,.22);font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif}
#eh996-env-panel[data-open="1"]{display:grid;gap:6px}
#eh996-env-panel button{touch-action:manipulation;width:100%;text-align:left;border:0;border-radius:10px;padding:11px 12px;background:#f1f5f9;color:#0f172a;cursor:pointer;font:inherit}
#eh996-env-panel button:hover{background:#e2e8f0}
#eh996-env-panel button[aria-current="page"]{background:#dbeafe;color:#1d4ed8}
#eh996-app-dialog{border:0;border-radius:16px;padding:0;max-width:min(430px,calc(100vw - 28px));box-shadow:0 22px 70px rgba(15,23,42,.34)}
#eh996-app-dialog::backdrop{background:rgba(15,23,42,.45)}
#eh996-app-dialog .eh996-card{padding:20px;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a}
#eh996-app-dialog h3{margin:0 0 8px;font-size:18px}#eh996-app-dialog p{margin:0 0 14px;color:#475569}
#eh996-app-dialog .eh996-grid{display:grid;grid-template-columns:1fr;gap:8px}
#eh996-app-dialog button{touch-action:manipulation;border:0;border-radius:10px;padding:11px 12px;font:600 13px system-ui;cursor:pointer}
@media(max-width:640px){#eh996-env-hub{left:auto;right:8px;top:8px;bottom:auto;gap:3px;padding:4px;max-width:calc(100vw - 16px)}#eh996-env-current{min-height:32px;padding:6px 8px;font-size:11px}#eh996-env-hub button,#eh996-env-hub a{min-height:32px;padding:6px 8px;font-size:11px}#eh996-env-panel{left:auto;right:8px;top:56px;bottom:auto;width:min(300px,calc(100vw - 16px));min-width:0;box-sizing:border-box}}
@media(max-width:420px){#eh996-env-hub{gap:2px;padding:3px}#eh996-env-current{padding:5px 7px;font-size:10.5px}#eh996-env-current::before{width:6px;height:6px;margin-right:5px}#eh996-env-hub button,#eh996-env-hub a{padding:5px 7px;font-size:10.5px}}
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
function notifyAndroid(){
  if(!window.ExportHUBAndroid||typeof window.ExportHUBAndroid.notify!=='function')return;
  const env=currentEnvironment();
  const notificationCount=countOf(['[data-index236-notification-count]','#index236NotificationCount','#index236NotificationCenter [data-count]','.index236-notification-count']);
  const warningCount=countOf(['[data-rc885-warning-count]','#rc885WarningCount','#rc885WarningDrawer [data-count]','.rc885-warning-count']);
  const payloads=[];
  if(notificationCount>0)payloads.push({channel:'notification',key:`tasks:${notificationCount}`,title:'ExportHUB Aufgaben',body:`${notificationCount} persönliche Aufgabe${notificationCount===1?'':'n'} offen.`,route:'notifications'});
  if(warningCount>0)payloads.push({channel:'warning',key:`warnings:${warningCount}`,title:'ExportHUB Warncenter',body:`${warningCount} operative Sendungswarnung${warningCount===1?'':'en'} offen.`,route:'warnings'});
  payloads.forEach(p=>{
    const storageKey=`exporthub-native-notify:${env}:${p.channel}`;
    const sig=p.key+'|'+p.body;let prev='';try{prev=sessionStorage.getItem(storageKey)||''}catch(_){ }
    if(prev===sig)return;
    try{window.ExportHUBAndroid.notify(p.channel,p.key,p.title,p.body,p.route);sessionStorage.setItem(storageKey,sig)}catch(_){ }
  });
}
function installNotificationBridge(){
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(notifyAndroid,180)};
  ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:notifications-updated','exporthub:warnings-updated'].forEach(n=>window.addEventListener(n,schedule));
  if(document.documentElement&&window.MutationObserver){const mo=new MutationObserver(schedule);mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});}
  schedule();
}

document.documentElement.setAttribute('data-exporthub-environment',currentEnvironment());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();installNotificationBridge();},{once:true});else{render();installNotificationBridge();}
window.ExportHUBEnvironmentHub=Object.freeze({targets:TARGETS,current:currentEnvironment,go,openApp:appAction});
})();
