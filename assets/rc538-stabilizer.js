(function(){
'use strict';
if(window.__EXPORTHUB_RC538_STABILIZER__)return;
window.__EXPORTHUB_RC538_STABILIZER__=true;
var scheduled=false,repairing=false,observer=null,lastView='',lastSignature='';
function state(){try{return window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():(window.state||{})}catch(_){return window.state||{}}}
function view(){return String((state()&&state().view)||'dashboard').trim()}
function content(){return document.getElementById('content')}
function signature(v,r){
 if(!r)return'';
 if(v==='shipment')return [v,!!r.querySelector('#rc532OperationsStack'),!!r.querySelector('#rc524MailArea'),!!r.querySelector('#rc524StowPlan'),!!r.querySelector('#rc532ShipmentAbd'),!!r.querySelector('#rc532ProcessActions')].join('|');
 return [v,r.className,String(r.children.length),String(r.textContent||'').slice(0,80)].join('|');
}
function setUserDisplay(){
 var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{},u=rt.user||window.currentUser||{},ms=rt.ms||{};
 var name=String(u.name||u.user||u.login||'').trim(),role=String(u.role||u.rolle||'Benutzer').trim(),mail=String(ms.userDetails||ms.userId||'').trim();
 var brand=document.getElementById('brandUserLine'),pn=document.getElementById('profileName'),pr=document.getElementById('profileRole');
 if(brand)brand.textContent=name?'ExportHUB-Benutzer: '+name:'ExportHUB-Benutzer: nicht angemeldet';
 document.querySelectorAll('.brand span').forEach(function(n){if(n!==brand&&/Microsoft|nicht angemeldet/i.test(String(n.textContent||'')))n.textContent=mail?'Microsoft: '+mail:'Microsoft-Anmeldung wird geprüft';});
 if(pn&&name)pn.textContent=name;
 if(pr)pr.textContent=(role||'Benutzer')+(mail?' · Microsoft: '+mail:'');
 var profile=document.querySelector('.profile');if(profile){if(name)profile.setAttribute('title',[name,role,mail].filter(Boolean).join(' · '));profile.querySelectorAll('small').forEach(function(n){if(n.id==='saveInfo'||n.id==='profileRole')return;if(/Microsoft|nicht angemeldet|ExportHUB-Benutzer/i.test(String(n.textContent||'')))n.remove()})}
}
function setVersionEverywhere(){
 try{document.title='ExportHUB RC538'}catch(_){ }
 document.documentElement.setAttribute('data-exporthub-version','RC538');
 document.querySelectorAll('[data-exporthub-version-label],[id*=version i],[class*=version i]').forEach(function(n){
  if(!n||n.children.length>10)return;
  var t=String(n.textContent||'');
  if(/(?:ExportHUB\s+Private\s+|Private\s+)?RC\d+/i.test(t))n.textContent=t.replace(/ExportHUB\s+Private\s+RC\d+/gi,'ExportHUB RC538').replace(/Private\s+RC\d+/gi,'RC538').replace(/RC\d+/gi,'RC538');
 });
}
function needsRepair(v,r){
 if(!r)return false;
 if(v==='shipment')return !r.querySelector('#rc532OperationsStack')||!r.querySelector('#rc524MailArea')||!r.querySelector('#rc524StowPlan')||!r.querySelector('#rc532ShipmentAbd')||!r.querySelector('#rc532ProcessActions');
 if(v==='shipmentoverview')return !r.classList.contains('rc524-overview-view')||!r.querySelector('.rc524-shipment-card,.rc524-overview-controls');
 if(v==='sop')return !r.classList.contains('rc524-sop-view')||r.querySelectorAll('.rc524-sop').length!==1;
 if(v==='rights')return !r.classList.contains('rc524-rights-view')||!r.querySelector('.rc524-rights-layout');
 if(v==='update')return !r.classList.contains('rc524-update-view')||!/RC538/.test(r.textContent||'');
 if(v==='customerfolder')return !r.classList.contains('rc532-customer-folder-view');
 if(v==='cmr')return !r.classList.contains('rc532-report-view');
 return false;
}
function repair(reason){
 if(repairing)return;
 var r=content(),v=view();if(!r)return;
 repairing=true;
 try{
  var core=window.ExportHUBRC538||window.ExportHUBRC532;
  if(core&&typeof core.postRender==='function'&&needsRepair(v,r))core.postRender();
  setVersionEverywhere();setUserDisplay();
  r=content();
  if(r){document.body.setAttribute('data-exporthub-view',v);document.body.setAttribute('data-current-view',v);lastView=v;lastSignature=signature(v,r)}
  window.__EXPORTHUB_RC538_UI_STATUS__={ok:true,view:v,reason:reason||'repair',version:'RC538',checkedAt:new Date().toISOString(),areas:{shipmentOrder:'Kunde/Grunddaten > Collis > Stauplan > Mail > Reports > Gespeicherte Sendungen'}};
 }catch(e){console.error('RC538 Oberflächenreparatur',e);window.__EXPORTHUB_RC538_UI_STATUS__={ok:false,error:String(e&&e.message||e),view:v}}
 finally{repairing=false}
}
function schedule(reason){if(scheduled||repairing)return;scheduled=true;var n=window.ExportHUBClean&&window.ExportHUBClean.native;var run=function(){scheduled=false;repair(reason)};(n&&n.setTimeout?n.setTimeout:setTimeout)(run,30)}
function installObserver(){
 var r=content();if(!r||observer)return;
 var Native=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.MutationObserver;
 if(!Native)return;
 observer=new Native(function(){var v=view(),s=signature(v,content());if(v!==lastView||s!==lastSignature)schedule('DOM-Änderung')});
 observer.observe(r,{childList:true,subtree:true});
}
function installViewWrapper(){
 var old=window.setView;
 if(old&&old.__rc538Wrapped)return;
 function wrapped(v){
  var st=state();if(st)st.view=String(v||'dashboard');
  var result=false;
  try{if(typeof old==='function')result=old.apply(this,arguments);else if(typeof window.render==='function')result=window.render()}catch(e){console.error('RC538 Ansichtswechsel',e)}
  schedule('Ansichtswechsel');return result;
 }
 wrapped.__rc538Wrapped=true;wrapped.__rc538Original=old;window.setView=wrapped;try{setView=wrapped}catch(_){ }
}
function install(){installViewWrapper();installObserver();repair('Start');}
window.addEventListener('exporthub:ready',install,{once:false});
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('button,a');if(b)setTimeout(function(){schedule('Schaltfläche')},0)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,50)});else setTimeout(install,50);
})();
