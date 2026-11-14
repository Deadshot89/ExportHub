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

/* RC1904 — visual-only logistics sequence. Never modifies actual startup state. */
function decorateLogisticsLoading(){
 try{
  var d=w.document,p=d&&d.getElementById&&d.getElementById('cleanLoadPanel'),label=d&&d.getElementById&&d.getElementById('cleanLoadText');
  if(!p||!label||!label.parentNode||typeof label.parentNode.insertBefore!=='function')return;
  if(typeof p.contains==='function'&&!p.contains(label))return;
  var current=d.getElementById('eh1904LogisticsScene');
  if(current&&(!p.contains||p.contains(current)))return;
  var style=d.getElementById('eh1904LogisticsStyles');
  if(!style){
   style=d.createElement('style');style.id='eh1904LogisticsStyles';
   style.textContent=[
    '#eh1904LogisticsScene{position:relative;isolation:isolate;width:min(100%,410px);height:124px;margin:8px auto 16px;overflow:hidden;border:1px solid rgba(59,130,246,.17);border-radius:18px;background:radial-gradient(ellipse at 75% 10%,rgba(90,178,255,.25),transparent 52%),radial-gradient(circle at 15% 85%,rgba(44,197,205,.14),transparent 42%),linear-gradient(145deg,#f8fbff,#edf5fc);box-shadow:inset 0 1px 0 #fff,0 8px 26px rgba(22,83,151,.10);pointer-events:none}',
    '#eh1904LogisticsScene:before{content:"";position:absolute;inset:0;opacity:.33;background-image:radial-gradient(#7faad7 .7px,transparent .7px);background-size:13px 13px;mask-image:linear-gradient(to bottom,#000,transparent 96%)}',
    '#eh1904LogisticsScene .eh1904-light{position:absolute;top:12px;left:18px;width:7px;height:7px;border-radius:50%;background:#35d3ac;box-shadow:0 0 0 4px rgba(53,211,172,.14),0 0 18px rgba(53,211,172,.6);animation:eh1904Pulse 1.65s ease-in-out infinite}',
    '#eh1904LogisticsScene .eh1904-line{position:absolute;top:15px;left:37px;right:19px;height:1px;background:linear-gradient(90deg,rgba(53,211,172,.6),rgba(31,111,208,.14),transparent)}',
    '#eh1904LogisticsScene .eh1904-building{position:absolute;left:22px;bottom:36px;width:74px;height:56px;background:linear-gradient(150deg,#a2d3f8,#4b8cc6);border:2px solid #357bb5;border-radius:5px 5px 2px 2px;box-shadow:6px 7px 14px rgba(34,82,127,.13)}',
    '#eh1904LogisticsScene .eh1904-building:before{content:"";position:absolute;left:-8px;right:-8px;top:-9px;height:9px;background:linear-gradient(140deg,#245c96,#3679b7);clip-path:polygon(8% 0,92% 0,100% 100%,0 100%);border-radius:3px}',
    '#eh1904LogisticsScene .eh1904-building:after{content:"";position:absolute;left:15px;right:15px;bottom:0;height:31px;border:2px solid #276a9e;border-bottom:0;border-radius:3px 3px 0 0;background:repeating-linear-gradient(180deg,#d7ebfb 0 7px,#aacce9 7px 9px)}',
    '#eh1904LogisticsScene .eh1904-belt{position:absolute;left:24%;right:22%;bottom:38px;height:12px;border:2px solid #466c95;border-radius:12px;background:repeating-linear-gradient(90deg,#89accb 0 10px,#b4d5ec 10px 20px);background-size:40px 12px;box-shadow:0 7px 0 -3px #557eaa;animation:eh1904Roll 1.1s linear infinite}',
    '#eh1904LogisticsScene .eh1904-parcel{position:absolute;bottom:52px;left:25%;width:27px;height:25px;border-radius:3px;background:linear-gradient(145deg,#f6ce91,#e5a852);border:1px solid #d49a51;box-shadow:2px 3px 8px rgba(107,71,27,.15);animation:eh1904Parcel 4s linear infinite}',
    '#eh1904LogisticsScene .eh1904-parcel:before{content:"";position:absolute;top:0;bottom:0;left:10px;width:6px;background:rgba(255,245,213,.57)}',
    '#eh1904LogisticsScene .eh1904-parcel + .eh1904-parcel{animation-delay:-2s;transform:scale(.85)}',
    '#eh1904LogisticsScene .eh1904-truck{position:absolute;right:18px;bottom:35px;width:111px;height:53px;animation:eh1904Truck 2.4s ease-in-out infinite}',
    '#eh1904LogisticsScene .eh1904-trailer{position:absolute;left:0;bottom:8px;width:72px;height:40px;border-radius:5px 3px 2px 3px;background:linear-gradient(155deg,#2b85d8,#1858a5);border:2px solid #1b5c9f;box-shadow:inset 0 6px 8px rgba(255,255,255,.17),3px 5px 8px rgba(9,58,107,.12)}',
    '#eh1904LogisticsScene .eh1904-trailer:before{content:"EH";position:absolute;color:#fff;font:bold 15px/1 Segoe UI,Arial,sans-serif;letter-spacing:-1px;top:11px;left:21px;opacity:.92}',
    '#eh1904LogisticsScene .eh1904-cab{position:absolute;right:0;bottom:8px;width:40px;height:34px;border-radius:3px 9px 3px 1px;background:linear-gradient(125deg,#20b5df,#087cbd);clip-path:polygon(0 0,67% 0,100% 38%,100% 100%,0 100%)}',
    '#eh1904LogisticsScene .eh1904-cab:before{content:"";position:absolute;top:6px;right:6px;width:18px;height:12px;background:#d8f3ff;border-radius:2px 5px 1px 1px;transform:skew(15deg)}',
    '#eh1904LogisticsScene .eh1904-wheel{position:absolute;bottom:0;width:18px;height:18px;border:5px solid #233d59;background:#d4e7f5;border-radius:50%;box-sizing:border-box}',
    '#eh1904LogisticsScene .eh1904-wheel.a{left:13px}#eh1904LogisticsScene .eh1904-wheel.b{right:10px}',
    '#eh1904LogisticsScene .eh1904-road{position:absolute;bottom:25px;left:10px;right:10px;height:2px;background:linear-gradient(90deg,transparent,#8db9d8 14%,#8db9d8 86%,transparent)}',
    '#eh1904LogisticsScene .eh1904-road:after{content:"";position:absolute;top:10px;left:5%;width:90%;height:2px;background:repeating-linear-gradient(90deg,rgba(65,135,188,.34) 0 24px,transparent 24px 39px)}',
    '@keyframes eh1904Parcel{0%{left:25%;opacity:0;transform:translateY(-7px) scale(.85)}9%{opacity:1;transform:translateY(0) scale(1)}78%{opacity:1}90%,100%{left:69%;opacity:0;transform:translateY(2px) scale(.75)}}',
    '@keyframes eh1904Roll{to{background-position:40px 0}}@keyframes eh1904Truck{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}',
    '@keyframes eh1904Pulse{0%,100%{opacity:.65;transform:scale(.85)}50%{opacity:1;transform:scale(1.14)}}',
    '@media(max-width:440px){#eh1904LogisticsScene{height:107px;margin:5px auto 12px}#eh1904LogisticsScene .eh1904-building{left:11px;transform:scale(.8);transform-origin:bottom left}#eh1904LogisticsScene .eh1904-truck{right:8px;transform-origin:bottom right;scale:.85}#eh1904LogisticsScene .eh1904-belt{left:22%;right:25%}}',
    '@media(prefers-reduced-motion:reduce){#eh1904LogisticsScene *,#eh1904LogisticsScene *:before,#eh1904LogisticsScene *:after{animation:none!important;transition:none!important}#eh1904LogisticsScene .eh1904-parcel{left:46%;opacity:1;transform:none}}'
   ].join('\n');
   (d.head||d.body).appendChild(style);
  }
  var scene=d.createElement('div');scene.id='eh1904LogisticsScene';
  scene.setAttribute('aria-hidden','true');
  scene.innerHTML='<span class="eh1904-light"></span><span class="eh1904-line"></span><div class="eh1904-road"></div><div class="eh1904-building"></div><div class="eh1904-belt"></div><div class="eh1904-parcel"></div><div class="eh1904-parcel"></div><div class="eh1904-truck"><div class="eh1904-trailer"></div><div class="eh1904-cab"></div><div class="eh1904-wheel a"></div><div class="eh1904-wheel b"></div></div>';
  label.parentNode.insertBefore(scene,label);
 }catch(_){/* Decorative-only. Startup and recovery must never depend on animation. */}
}

function watch(){
 decorateLogisticsLoading();
 if(isBroken()){
  if(!STALL_SINCE)STALL_SINCE=Date.now();
  if(Date.now()-STALL_SINCE>=25000)showStall()
 }else{STALL_SINCE=0;clearStall()}
 STALL_TIMER=w.setTimeout(watch,5000)
}
function schedule(){decorateLogisticsLoading();if(TIMER)w.clearTimeout(TIMER);TIMER=w.setTimeout(check,5000);if(STALL_TIMER)w.clearTimeout(STALL_TIMER);watch()}
if(w.document){
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 w.addEventListener('exporthub:ready',function(){if(TIMER)w.clearTimeout(TIMER);STALL_SINCE=0;clearStall();var b=w.document.getElementById('rc1067MigrationRecoveryLink');if(b)b.remove()},{once:true})
}
w.ExportHUBRC1067StartupRecovery={session:session,admin:admin,loading:loading,usable:usable,isBroken:isBroken,activeTeamLoad:activeTeamLoad,watch:watch,check:check,recoveryUrl:recoveryUrl,showStall:showStall,clearStall:clearStall};
})(window);