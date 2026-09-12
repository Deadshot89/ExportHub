(function(w){
'use strict';
if(w.__EXPORTHUB_RC1067_STARTUP_RECOVERY__)return;w.__EXPORTHUB_RC1067_STARTUP_RECOVERY__=true;
var KEY='exporthub_rc301_tab_session',TIMER=null;
function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLowerCase()}
function session(){
 try{var raw=w.sessionStorage&&w.sessionStorage.getItem(KEY);if(raw){var x=JSON.parse(raw);if(x&&x.token)return x}}catch(_){}
 try{for(var i=0;w.sessionStorage&&i<w.sessionStorage.length;i++){var k=w.sessionStorage.key(i),r=w.sessionStorage.getItem(k);if(!r||r.charAt(0)!=='{')continue;var v=JSON.parse(r);if(v&&v.token&&v.user)return v}}catch(_){}
 return null
}
function admin(s){var u=s&&s.user||{},role=low(u.role||u.rolle||u.level||u.type),p=Array.isArray(u.permissions)?u.permissions:[];return !!s&&!!s.token&&(u.globalAdmin===true||u.isGlobalAdmin===true||u.isAdmin===true||u.admin===true||p.indexOf('*')>=0||/global.?admin|administrator|vollzugriff/.test(role))}
function loading(){
 try{
  var host=w.document&&w.document.getElementById('content'),txt=q(host&&host.textContent||w.document&&w.document.body&&w.document.body.textContent||'');
  return /ExportHUB\s+wird\s+geladen|Teamdaten\s+werden\s+wiederhergestellt|Gespeicherte\s+Sitzung\s+und\s+Teamdaten/i.test(txt)
 }catch(_){return false}
}
function environment(){return /-testservice\./i.test(String(w.location&&w.location.hostname||''))?'testservice':'production'}
function recoveryUrl(){return '/migration-recovery.html?environment='+encodeURIComponent(environment())+'&return='+encodeURIComponent((w.location&&w.location.pathname)||'/')+'&_='+Date.now()}
function addManualLink(){
 if(!w.document||!w.document.body||w.document.getElementById('rc1067MigrationRecoveryLink'))return;
 var b=w.document.createElement('button');b.id='rc1067MigrationRecoveryLink';b.type='button';b.textContent='Speicheroptimierung öffnen';
 b.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:12px;padding:11px 15px;background:#0f172a;color:#fff;font-weight:800;box-shadow:0 8px 28px rgba(15,23,42,.24);cursor:pointer';
 b.onclick=function(){w.location.href=recoveryUrl()};w.document.body.appendChild(b)
}
async function check(){
 var s=session();if(!admin(s)||!loading())return;
 var controller=typeof AbortController!=='undefined'?new AbortController():null,kill=controller&&w.setTimeout(function(){try{controller.abort()}catch(_){}},12000);
 try{
  var r=await w.fetch('/api/exporthub-state?mode=health',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:controller&&controller.signal}),data=await r.json().catch(function(){return{}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  var count=Number(data&&data.stateDiagnostics&&data.stateDiagnostics.inlinePayloadCount||0);
  if(count>0&&loading()){w.location.replace(recoveryUrl());return}
 }catch(_){if(loading())addManualLink()}
 finally{if(kill)w.clearTimeout(kill)}
}
function schedule(){if(TIMER)w.clearTimeout(TIMER);TIMER=w.setTimeout(check,5000)}
if(w.document){
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 w.addEventListener('exporthub:ready',function(){if(TIMER)w.clearTimeout(TIMER);var b=w.document.getElementById('rc1067MigrationRecoveryLink');if(b)b.remove()},{once:true})
}
w.ExportHUBRC1067StartupRecovery={session:session,admin:admin,loading:loading,check:check,recoveryUrl:recoveryUrl};
})(window);
