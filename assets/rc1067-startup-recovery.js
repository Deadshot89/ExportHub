(function(w){
'use strict';
if(w.__EXPORTHUB_RC1067_STARTUP_RECOVERY__)return;w.__EXPORTHUB_RC1067_STARTUP_RECOVERY__=true;
var KEY='exporthub_rc301_tab_session',TIMER=null,STALL_TIMER=null,STALL_SINCE=0;
function q(v){return String(v==null?'':v).trim()}
function tr(key,vars,fallback){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var v=w.ExportHUBI18n.t(key,vars);if(v&&v!==key)return v}}catch(_){}return fallback||key}
function low(v){return q(v).toLowerCase()}
function session(){
 try{var raw=w.sessionStorage&&w.sessionStorage.getItem(KEY);if(raw){var x=JSON.parse(raw);if(x&&x.token)return x}}catch(_){}
 try{for(var i=0;w.sessionStorage&&i<w.sessionStorage.length;i++){var k=w.sessionStorage.key(i),r=w.sessionStorage.getItem(k);if(!r||r.charAt(0)!=='{')continue;var v=JSON.parse(r);if(v&&v.token&&v.user)return v}}catch(_){}
 return null
}
function admin(s){var u=s&&s.user||{},role=low(u.role||u.rolle||u.level||u.type),p=Array.isArray(u.permissions)?u.permissions:[],roles=['global admin','globaler administrator','globaler admin','administrator','admin','vollzugriff'];return !!s&&!!s.token&&(u.globalAdmin===true||u.isGlobalAdmin===true||p.indexOf('*')>=0||roles.indexOf(role)>=0)}
/* RC1577: Look at the visible loader itself; #content may contain stale interactive UI. */
function activeTeamLoad(){
 try{
  var d=w.document,p=d&&d.getElementById('cleanLoadPanel');
  if(!p||p.hidden||p.classList&&p.classList.contains('hidden'))return false;
  if(p.getAttribute&&p.getAttribute('aria-hidden')==='true')return false;
  var t=d.getElementById('cleanLoadText'),message=q(t&&t.textContent||'');
  return /Azure-Teamdaten|Teamdaten werden (?:geladen|wiederhergestellt)|Sitzung und aktuelle Ansicht werden wiederhergestellt/i.test(message)
 }catch(_){return false}
}
function loading(){
 try{
  if(activeTeamLoad())return true;
  var host=w.document&&w.document.getElementById('content'),txt=q(host&&host.textContent||w.document&&w.document.body&&w.document.body.textContent||'');
  return /ExportHUB\s+wird\s+geladen|ExportHUB\s+wird\s+vorbereitet|Azure-Teamdaten\s+werden\s+geladen|Teamdaten\s+werden\s+wiederhergestellt|Gespeicherte\s+Sitzung\s+und\s+Teamdaten/i.test(txt)
 }catch(_){return false}
}
function usable(){
 try{
  var d=w.document,body=d&&d.body,host=d&&d.getElementById&&d.getElementById('content');
  var view=q(body&&body.getAttribute&&body.getAttribute('data-exporthub-view'));
  var hasContent=!!(host&&(host.firstElementChild||q(String(host.textContent||'').slice(0,150)).length>10));
  var interactive=typeof w.setView==='function'||!!(d&&d.querySelector&&d.querySelector('[data-view],[data-target],[data-nav]'));
  return hasContent&&!!view&&interactive
 }catch(_){return false}
}
function isBroken(){return activeTeamLoad()||(!usable()&&loading())}
function environment(){return /-testservice\./i.test(String(w.location&&w.location.hostname||''))?'testservice':'production'}
function recoveryUrl(){return '/migration-recovery.html?environment='+encodeURIComponent(environment())+'&return='+encodeURIComponent((w.location&&w.location.pathname)||'/')+'&_='+Date.now()}
/* RC1574: Failsafe bei endloser Azure-Teamdaten-Initialisierung.
   Nur UI-Fehlerzustand, kein Loeschen von Cache/Sitzung/Teamdaten. */
function showStall(){
 if(!isBroken())return false;
 var d=w.document;if(!d||!d.body||!d.createElement)return false;
 if(d.getElementById('rc1574StartupStall'))return true;
 var panel=d.createElement('section');panel.id='rc1574StartupStall';panel.setAttribute&&panel.setAttribute('role','alert');
 panel.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;max-width:580px;margin:auto;z-index:2147483001;background:#fff;color:#14273f;border:2px solid #d97706;border-radius:14px;padding:16px 18px;box-shadow:0 14px 38px rgba(15,23,42,.24);font:15px/1.45 Segoe UI,Arial,sans-serif';
 var title=d.createElement('strong');title.textContent=tr('startup.stalled.title',null,'ExportHUB startet nicht vollständig');title.style.cssText='display:block;font-size:17px;margin-bottom:5px';panel.appendChild(title);
 var message=d.createElement('div');message.textContent=tr('startup.stalled.message',null,'Die Azure-Teamdaten konnten noch nicht geladen werden. Du kannst den Start erneut versuchen. Sitzung und gespeicherte Daten bleiben erhalten.');panel.appendChild(message);
 var retry=d.createElement('button');retry.type='button';retry.textContent=tr('startup.stalled.retry',null,'Erneut laden');retry.style.cssText='margin-top:12px;background:#0b5cad;color:#fff;border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer';
 retry.onclick=function(){try{w.location.reload()}catch(_){}};panel.appendChild(retry);
 d.body.appendChild(panel);return true
}
function clearStall(){try{var p=w.document&&w.document.getElementById('rc1574StartupStall');if(p&&p.remove)p.remove()}catch(_){}}
function addManualLink(){
 if(!w.document||!w.document.body||w.document.getElementById('rc1067MigrationRecoveryLink'))return;
 var b=w.document.createElement('button');b.id='rc1067MigrationRecoveryLink';b.type='button';b.textContent=tr('startup.openStorageOptimization',null,'Open storage optimization');
 b.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:12px;padding:11px 15px;background:#0f172a;color:#fff;font-weight:800;box-shadow:0 8px 28px rgba(15,23,42,.24);cursor:pointer';
 b.onclick=function(){w.location.href=recoveryUrl()};w.document.body.appendChild(b)
}
async function check(){
 var s=session();if(!admin(s)||!isBroken())return;
 var controller=typeof AbortController!=='undefined'?new AbortController():null,kill=controller&&w.setTimeout(function(){try{controller.abort()}catch(_){}},12000);
 try{
  var r=await w.fetch('/api/exporthub-state?mode=health',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:controller&&controller.signal}),data=await r.json().catch(function(){return{}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  var count=Number(data&&data.stateDiagnostics&&data.stateDiagnostics.inlinePayloadCount||0);
  if(count>0&&isBroken()){w.location.replace(recoveryUrl());return}
 }catch(_){/* Azure nicht erreichbar: keine unbelegte Dokumentmigration ausloesen; der Stall-Watchdog bietet Wiederholen an. */}
 finally{if(kill)w.clearTimeout(kill)}
}
/* Poll continuously, because the user may sign in long after DOMContentLoaded. Only
   show the retry after 25 seconds of uninterrupted Azure-team-state loading. */
function watch(){
 if(isBroken()){
  if(!STALL_SINCE)STALL_SINCE=Date.now();
  if(Date.now()-STALL_SINCE>=25000)showStall()
 }else{STALL_SINCE=0;clearStall()}
 STALL_TIMER=w.setTimeout(watch,5000)
}
function schedule(){if(TIMER)w.clearTimeout(TIMER);TIMER=w.setTimeout(check,5000);if(STALL_TIMER)w.clearTimeout(STALL_TIMER);watch()}
if(w.document){
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 w.addEventListener('exporthub:ready',function(){if(TIMER)w.clearTimeout(TIMER);STALL_SINCE=0;clearStall();var b=w.document.getElementById('rc1067MigrationRecoveryLink');if(b)b.remove()},{once:true})
}
w.ExportHUBRC1067StartupRecovery={session:session,admin:admin,loading:loading,usable:usable,isBroken:isBroken,activeTeamLoad:activeTeamLoad,watch:watch,check:check,recoveryUrl:recoveryUrl,showStall:showStall,clearStall:clearStall};
})(window);