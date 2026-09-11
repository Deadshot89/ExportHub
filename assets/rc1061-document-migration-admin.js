(function(){
'use strict';
if(window.__EXPORTHUB_RC1061_DOCUMENT_MIGRATION_ADMIN__)return;
window.__EXPORTHUB_RC1061_DOCUMENT_MIGRATION_ADMIN__=true;

function q(v){return String(v==null?'':v).trim()}
function lower(v){return q(v).toLowerCase()}
function isAdmin(user){
  var role=lower(user&&(user.role||user.rolle));
  return !!(user&&(user.globalAdmin===true||role==='admin'||/global.?admin|administrator|vollzugriff/i.test(role)||(Array.isArray(user.permissions)&&user.permissions.indexOf('*')>=0)));
}
function environmentName(){return typeof location!=='undefined'&&/-testservice\./i.test(String(location.hostname||''))?'testservice':'production'}
function state(){try{if(typeof window.__EXPORTHUB_GET_STATE__==='function')return window.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return window.ExportHUBClean&&window.ExportHUBClean.state||window.appState||{}}
function currentUser(){var s=state();try{if(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=window.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}return window.currentUser||s.currentUser||s.activeUser||null}
function authToken(){var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{};return q(rt.authToken||rt.sessionToken||'')}
function headers(){var token=authToken();if(!token)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':environmentName()}}
async function runBatch(){var r=await fetch('/api/exporthub-document-migrate',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify({environment:environmentName(),limit:5})}),data=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(q(data&&data.message)||('HTTP '+r.status));return data}
async function health(){var r=await fetch('/api/exporthub-state?mode=health',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json','Cache-Control':'no-cache'}}),data=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(q(data&&data.message)||('HTTP '+r.status));return data}
function bytes(v){var n=Number(v||0);if(!Number.isFinite(n)||n<=0)return'0 B';var units=['B','KB','MB','GB'],i=Math.min(units.length-1,Math.floor(Math.log(n)/Math.log(1024)));return(n/Math.pow(1024,i)).toFixed(i===0?0:1)+' '+units[i]}
function adminView(){var s=state(),view=lower(s.view||s.currentView||'');if(/rights|settings|user|admin|benutzer|rechte|einstellung/.test(view))return true;if(typeof document==='undefined')return false;var content=document.getElementById('content');return !!(content&&/benutzer|rechte|einstellungen|administration/i.test(q(content.textContent).slice(0,2500)))}
function metric(label,value){return'<div style="padding:10px 12px;border:1px solid #d9e1ea;border-radius:10px;background:#fff"><div style="font-size:12px;color:#667085">'+label+'</div><div style="font-size:20px;font-weight:700;margin-top:4px">'+value+'</div></div>'}
function ensureCard(){
  if(typeof document==='undefined'||!isAdmin(currentUser())||!adminView())return false;
  var content=document.getElementById('content');if(!content)return false;
  var old=document.getElementById('rc1061DocumentMigrationAdmin');if(old&&old.parentNode!==content)old.remove();if(old)return true;
  var box=document.createElement('section');box.id='rc1061DocumentMigrationAdmin';box.setAttribute('data-exporthub-admin-only','true');box.style.cssText='margin:18px 0;padding:18px;border:1px solid #cfd8e3;border-radius:14px;background:#f8fafc;box-shadow:0 2px 8px rgba(15,23,42,.05)';
  box.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#475467">Admin · RC1061</div><h3 style="margin:4px 0 6px;font-size:20px">Dokumentmigration</h3><div id="rc1061MigrationEnv" style="font-size:13px;color:#667085">Umgebung: '+environmentName().toUpperCase()+'</div></div><button id="rc1061MigrationRun" type="button" style="border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer;background:#111827;color:#fff">Nächste 5 migrieren</button></div><div id="rc1061MigrationStatus" style="margin-top:12px;font-size:13px;color:#475467">Status wird geladen …</div><div id="rc1061MigrationMetrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px"></div>';
  content.insertBefore(box,content.firstChild||null);
  var button=box.querySelector('#rc1061MigrationRun');
  var status=box.querySelector('#rc1061MigrationStatus');
  var metrics=box.querySelector('#rc1061MigrationMetrics');
  var totals={found:0,migrated:0,failed:0,remaining:0,bytesMoved:0};
  function render(){metrics.innerHTML=metric('Gefunden',totals.found)+metric('Migriert',totals.migrated)+metric('Fehlgeschlagen',totals.failed)+metric('Verbleibend',totals.remaining)+metric('Verschoben',bytes(totals.bytesMoved));button.disabled=totals.remaining===0&&totals.found>0;button.style.opacity=button.disabled?'.5':'1'}
  health().then(function(h){var d=h&&h.stateDiagnostics||{},remaining=Number(d.inlinePayloadCount||0);totals.found=remaining;totals.remaining=remaining;status.textContent=remaining?'Bereit. Es werden immer maximal 5 Dokumente pro Lauf migriert.':'Keine Inline-Dokumente mehr gefunden.';render()}).catch(function(e){status.textContent='Status konnte nicht geladen werden: '+q(e&&e.message);render()});
  button.addEventListener('click',async function(){button.disabled=true;status.textContent='Migration läuft …';try{var r=await runBatch();totals.found=Math.max(totals.found,Number(r.found||0));totals.migrated+=Number(r.migrated||0);totals.failed+=Number(r.failed||0);totals.remaining=Number(r.remaining||0);totals.bytesMoved+=Number(r.bytesMoved||0);status.textContent=r.done?'Migration in dieser Umgebung abgeschlossen.':'Batch abgeschlossen. '+totals.remaining+' Inline-Dokumente verbleiben.';render()}catch(e){status.textContent='Migration fehlgeschlagen: '+q(e&&e.message);button.disabled=false}});
  return true;
}
function schedule(){try{ensureCard()}catch(e){try{console.warn('RC1061 Admin-Migration UI',e)}catch(_){}}}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(schedule,0)},{once:true});else setTimeout(schedule,0);
  if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(function(){setTimeout(schedule,0)});try{mo.observe(document.documentElement,{childList:true,subtree:true})}catch(_){}}
  ['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(function(name){try{window.addEventListener(name,function(){setTimeout(schedule,0)})}catch(_){}})
}
window.ExportHUBRC1061DocumentMigrationAdmin={isAdmin:isAdmin,runBatch:runBatch,ensureCard:ensureCard,health:health,environmentName:environmentName};
})();
