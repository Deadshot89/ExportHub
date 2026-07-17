(function(){
'use strict';
const VERSION='RC518';
const LOGIN_RETURN='/?v=518';
const API='/api/exporthub/state';
const native={
  fetch:window.fetch.bind(window),
  setTimeout:window.setTimeout.bind(window),
  clearTimeout:window.clearTimeout.bind(window),
  setInterval:window.setInterval.bind(window),
  clearInterval:window.clearInterval.bind(window),
  MutationObserver:window.MutationObserver
};
const runtime={users:[],state:null,revision:0,user:null,ms:null,loading:false,loaded:false,startupComplete:false,saveTimer:null,saving:false,pendingSave:false,observerRecords:new Set(),intervalJobs:new Map(),intervalSeq:1,moduleTimes:[],skipped:['frühe historische Zwischenpatches bis RC393 werden nicht gestartet; moderne Funktionsmodule und der vollständige Endstand sind aktiv'],timeoutJobs:new Map(),timeoutSeq:1000000,timeoutSourceIds:new WeakMap(),timeoutSourceSeq:1,legacyTimersReady:false,droppedStartupTimers:0,intervalsArmed:false,currentModuleId:0,versionTimer:null};

function by(id){return document.getElementById(id)}
function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function status(msg,kind){const e=by('cleanLoginStatus');if(!e)return;e.textContent=msg||'';e.className='clean-login-status '+(kind||'')}
function progress(p,msg){const panel=by('cleanLoadPanel'),bar=by('cleanProgressBar'),lab=by('cleanProgressLabel'),txt=by('cleanLoadText');if(panel)panel.classList.remove('hidden');if(bar)bar.style.width=Math.max(0,Math.min(100,p))+'%';if(lab)lab.textContent=Math.round(p)+' %';if(txt&&msg)txt.textContent=msg}
function hideProgress(){const p=by('cleanLoadPanel');if(p)p.classList.add('hidden')}
function authLoginUrl(){
 const u=new URL('/.auth/login/aad',window.location.origin);
 u.searchParams.set('post_login_redirect_uri',LOGIN_RETURN);
 return u.href;
}
function authLogoutUrl(){
 const u=new URL('/.auth/logout',window.location.origin);
 u.searchParams.set('post_logout_redirect_uri',LOGIN_RETURN);
 return u.href;
}
async function fetchWithTimeout(url,options,timeoutMs){
 const controller=typeof AbortController!=='undefined'?new AbortController():null;
 const timer=controller?native.setTimeout(function(){controller.abort()},Math.max(1000,Number(timeoutMs)||5000)):null;
 try{
  return await native.fetch(url,Object.assign({},options||{},controller?{signal:controller.signal}:{}));
 }finally{if(timer)native.clearTimeout(timer)}
}

function addSafeLoadNote(){
 const panel=by('cleanLoadPanel'); if(!panel||by('cleanSafeLoadNote'))return;
 const n=document.createElement('div'); n.id='cleanSafeLoadNote'; n.className='clean-safe-note';
 n.textContent='Stabiler Start: Veraltete Reparaturschleifen und Mehrfachspeicherungen bleiben deaktiviert.';
 panel.appendChild(n);
}

function applyUserIdentity(){if(!runtime.user)return;const name=text(runtime.user.name||runtime.user.user||runtime.user.login)||'Benutzer';const role=text(runtime.user.role)||'Benutzer';const brand=by('brandUserLine'),profile=by('profileName'),profileRole=by('profileRole');if(brand)brand.textContent='ExportHUB-Benutzer: '+name;if(profile)profile.textContent=name;if(profileRole)profileRole.textContent=role+' · Azure-Teamdaten'}
function setVersion(){document.title='ExportHUB Clean '+VERSION;document.querySelectorAll('[id*=version i],[class*=version i]').forEach(function(e){if(/Private RC\d+|Aktuelle Version/i.test(e.textContent||''))e.textContent=(e.textContent||'').replace(/Private RC\d+/gi,'Private '+VERSION).replace(/RC\d+/gi,VERSION)});const login=document.querySelector('.login-card');if(login&&!by('cleanVersionBadge')){const d=document.createElement('div');d.id='cleanVersionBadge';d.className='clean-version-badge';d.textContent='Bereinigte Version · '+VERSION;login.appendChild(d)}applyUserIdentity()}

// ExportHUB keys are kept in memory only. Nothing is persisted in localStorage/IndexedDB.
const mem=new Map();
try{
 const SP=window.Storage&&window.Storage.prototype;
 if(SP){
  const g=SP.getItem,s=SP.setItem,r=SP.removeItem,c=SP.clear,k=SP.key;
  function own(key){return /exporthub|rc\d+/i.test(String(key||''))}
  SP.getItem=function(key){return own(key)?(mem.has(String(key))?mem.get(String(key)):null):g.call(this,key)};
  SP.setItem=function(key,val){if(own(key)){mem.set(String(key),String(val));return}return s.call(this,key,val)};
  SP.removeItem=function(key){if(own(key)){mem.delete(String(key));return}return r.call(this,key)};
  SP.clear=function(){mem.clear()};
 }
}catch(_){ }
try{if(window.indexedDB){window.indexedDB.open=function(){throw new Error('ExportHUB Clean verwendet keinen dauerhaften Browser-Speicher.')}}}catch(_){ }


// Block every legacy Azure write during startup. Reads remain available.
(function installStartupWriteGate(){
 const realFetch=window.fetch.bind(window);
 window.fetch=function(input,options){
  try{
   const url=typeof input==='string'?input:(input&&input.url)||'';
   const method=String((options&&options.method)||(input&&input.method)||'GET').toUpperCase();
   if(!runtime.startupComplete&&method!=='GET'&&method!=='HEAD'&&/\/api\/exporthub\/state/i.test(url)){
    return Promise.resolve(new Response(JSON.stringify({ok:true,skipped:true,startup:true,revision:runtime.revision}),{status:200,headers:{'Content-Type':'application/json'}}));
   }
  }catch(_){ }
  return realFetch(input,options);
 };
})();

// One real observer multiplexes all legacy observers with throttling and a circuit breaker.
(function installObserverHub(){
 if(!native.MutationObserver)return;
 const records=runtime.observerRecords;
 class CleanObserver{
  constructor(cb){this.cb=cb;this.targets=[];this.active=true;this.last=0;this.fail=0;this.moduleId=runtime.currentModuleId||0;records.add(this)}
  observe(target,options){if(target)this.targets.push({target:target,options:options||{}})}
  disconnect(){this.active=false;records.delete(this)}
  takeRecords(){return[]}
 }
 window.MutationObserver=CleanObserver;
 let scheduled=false,queue=[];
 function relevant(rec,muts){if(!rec.targets.length)return true;return muts.some(function(m){return rec.targets.some(function(t){try{return t.target===m.target||t.target.contains(m.target)}catch(_){return false}})})}
 function drain(deadline){if(runtime.loading||!runtime.loaded){queue.length=0;scheduled=false;return}let count=0;while(queue.length&&count<1&&(!deadline||deadline.timeRemaining()>3)){const item=queue.shift(),now=Date.now();if(!item.active||now-item.last<2500)continue;item.last=now;try{item.cb([],item);item.fail=0}catch(e){item.fail++;if(item.fail>2)item.disconnect()}count++}if(queue.length){scheduleDrain()}else scheduled=false}
 function scheduleDrain(){native.setTimeout(function(){if(window.requestIdleCallback)window.requestIdleCallback(drain,{timeout:700});else drain(null)},250)}
 const hub=new native.MutationObserver(function(muts){
  if(!runtime.loading&&runtime.loaded){records.forEach(function(rec){if(rec.active&&relevant(rec,muts)&&queue.indexOf(rec)<0)queue.push(rec)});if(!scheduled&&queue.length){scheduled=true;scheduleDrain()}}
  if(runtime.versionTimer)native.clearTimeout(runtime.versionTimer);
  runtime.versionTimer=native.setTimeout(function(){runtime.versionTimer=null;setVersion()},180);
 });
 hub.observe(document.documentElement,{childList:true,subtree:true,attributes:true});
})();

// One throttled scheduler replaces legacy timeouts. During startup callbacks are queued,
// deduplicated and never executed. After the interface is visible they are released gradually.
(function installTimeoutHub(){
 function sourceKey(fn,args){
  try{
   if(typeof fn==='function'){
    let id=runtime.timeoutSourceIds.get(fn);
    if(!id){id=runtime.timeoutSourceSeq++;runtime.timeoutSourceIds.set(fn,id)}
    return 'f:'+id+':'+JSON.stringify(args||[]);
   }
   return 's:'+String(fn)+':'+JSON.stringify(args||[]);
  }catch(_){return 'x:'+runtime.timeoutSeq}
 }
 function removeJob(id){const j=runtime.timeoutJobs.get(id);if(!j)return false;runtime.timeoutJobs.delete(id);return true}
 window.setTimeout=function(fn,delay){
  const args=[].slice.call(arguments,2),id=runtime.timeoutSeq++,now=Date.now();
  const d=Math.max(0,Number(delay)||0),startup=runtime.loading||!runtime.loaded||!runtime.legacyTimersReady;
  const key=startup?sourceKey(fn,args):'';
  if(startup&&key){
   for(const [oldId,old] of runtime.timeoutJobs){
    if(old.startup&&old.key===key){runtime.timeoutJobs.delete(oldId);runtime.droppedStartupTimers++;break}
   }
  }
  runtime.timeoutJobs.set(id,{fn:fn,args:args,due:now+d,startup:startup,key:key,created:now,moduleId:runtime.currentModuleId||0});
  return id
 };
 window.clearTimeout=function(id){if(removeJob(id))return;try{native.clearTimeout(id)}catch(_){ }};
 native.setInterval(function(){
  if(runtime.loading||!runtime.loaded||!runtime.legacyTimersReady)return;
  const now=Date.now(),due=[];
  runtime.timeoutJobs.forEach(function(j,id){if(j.due<=now)due.push([id,j])});
  due.sort(function(a,b){return a[1].due-b[1].due||a[1].created-b[1].created});
  const maxPerTick=3;
  for(let i=0;i<due.length&&i<maxPerTick;i++){
   const id=due[i][0],j=due[i][1];runtime.timeoutJobs.delete(id);
   try{typeof j.fn==='function'?j.fn.apply(window,j.args):(0,eval)(String(j.fn))}
   catch(e){console.warn('Legacy-Timer verworfen',e)}
  }
 },50);
})();

// Legacy intervals are delayed, staggered and executed one at a time.
// Old repair loops do not start together immediately after login.
(function installIntervalHub(){
 window.setInterval=function(fn,delay){
  const args=[].slice.call(arguments,2),id=runtime.intervalSeq++;
  runtime.intervalJobs.set(id,{fn:fn,args:args,delay:Math.max(30000,Number(delay)||30000),nextDue:Infinity,moduleId:runtime.currentModuleId||0});
  return id
 };
 window.clearInterval=function(id){runtime.intervalJobs.delete(id)};
 runtime.armLegacyIntervals=function(){
  if(runtime.intervalsArmed)return;runtime.intervalsArmed=true;
  const now=Date.now();let pos=0;
  runtime.intervalJobs.forEach(function(j){j.nextDue=now+30000+(pos++*2500)});
 };
 native.setInterval(function(){
  if(runtime.loading||!runtime.loaded||!runtime.legacyTimersReady||!runtime.intervalsArmed)return;
  const now=Date.now();let selected=null,selectedId=null;
  runtime.intervalJobs.forEach(function(j,id){if(j.nextDue<=now&&(!selected||j.nextDue<selected.nextDue)){selected=j;selectedId=id}});
  if(!selected)return;
  selected.nextDue=now+selected.delay;
  try{typeof selected.fn==='function'?selected.fn.apply(window,selected.args):(0,eval)(String(selected.fn))}
  catch(_){runtime.intervalJobs.delete(selectedId)}
 },1000);
})();

async function jsonFetch(url,options){
 const res=await native.fetch(url,Object.assign({credentials:'same-origin',cache:'no-store'},options||{}));
 const txt=await res.text();let data={};
 try{data=txt?JSON.parse(txt):{}}
 catch(_){
  const looksLikeHtml=/^\s*</.test(txt||'');
  if(res.status===401||res.status===403||looksLikeHtml&&/login|auth|unauthorized|forbidden/i.test(txt||''))throw new Error('Microsoft-Anmeldung erforderlich.');
  throw new Error('Der Server lieferte keine gültige JSON-Antwort (HTTP '+res.status+').');
 }
 if(!res.ok||data.ok===false)throw new Error(data.message||('HTTP '+res.status));
 return data
}
async function parseLargeJson(textValue){if(!window.Worker)return JSON.parse(textValue);const code='self.onmessage=e=>{try{self.postMessage({ok:true,value:JSON.parse(e.data)})}catch(x){self.postMessage({ok:false,error:x.message})}}';const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));try{return await new Promise(function(resolve,reject){const w=new Worker(url);w.onmessage=function(e){w.terminate();e.data.ok?resolve(e.data.value):reject(new Error(e.data.error))};w.onerror=function(e){w.terminate();reject(new Error(e.message||'Worker-Fehler'))};w.postMessage(textValue)})}finally{URL.revokeObjectURL(url)}}
function setLoginEnabled(enabled){
 ['loginUser','loginPass','loginBtn'].forEach(function(id){const e=by(id);if(e)e.disabled=!enabled});
}
function updateMicrosoftUi(p,message){
 const box=by('cleanMicrosoftStatus');
 const oldBox=by('rc448MicrosoftLoginBox');
 if(oldBox)oldBox.remove();
 const loginLink=by('cleanMicrosoftLoginButton');
 const checkBtn=by('cleanMicrosoftCheckButton');
 const logoutLink=by('cleanMicrosoftLogoutButton');
 if(loginLink)loginLink.href=authLoginUrl();
 if(logoutLink)logoutLink.href=authLogoutUrl();
 if(!box)return;
 const strong=box.querySelector('strong'),span=box.querySelector('span');
 if(p){
  if(strong)strong.textContent='Microsoft-Konto angemeldet';
  if(span)span.textContent=text(p.userDetails||p.userId);
  if(loginLink)loginLink.classList.add('hidden');
  if(checkBtn)checkBtn.classList.add('hidden');
  if(logoutLink)logoutLink.classList.remove('hidden');
 }else{
  if(strong)strong.textContent=message||'Microsoft-Anmeldung erforderlich';
  if(span)span.textContent='Bitte zuerst das Microsoft-Konto verbinden. Die interne Anmeldung wird danach freigeschaltet.';
  if(loginLink)loginLink.classList.remove('hidden');
  if(checkBtn)checkBtn.classList.remove('hidden');
  if(logoutLink)logoutLink.classList.add('hidden');
 }
}
async function loadMicrosoft(){
 updateMicrosoftUi(null,'Microsoft-Anmeldung wird geprüft …');
 try{
  const res=await fetchWithTimeout('/.auth/me',{credentials:'same-origin',cache:'no-store'},4500);
  const raw=await res.text();
  let d=null;
  try{d=raw?JSON.parse(raw):null}catch(_){throw new Error('Ungültige Antwort der Microsoft-Anmeldung.')}
  const p=(d&&d.clientPrincipal)||(Array.isArray(d)&&d[0]&&d[0].clientPrincipal)||null;
  runtime.ms=p||null;
  updateMicrosoftUi(runtime.ms,runtime.ms?'Microsoft-Konto angemeldet':'Microsoft-Anmeldung erforderlich');
  return runtime.ms;
 }catch(e){
  runtime.ms=null;
  const timeout=e&&e.name==='AbortError';
  updateMicrosoftUi(null,timeout?'Microsoft-Statusprüfung dauert zu lange':'Microsoft-Anmeldung nicht erkannt');
  status(timeout?'Die Statusprüfung wurde beendet. Die Microsoft-Anmeldung kann trotzdem gestartet werden.':'Bitte mit dem Microsoft-Konto anmelden.','');
  return null;
 }
}
async function loadUsers(){
 if(!runtime.ms)throw new Error('Microsoft-Anmeldung erforderlich.');
 let firstError=null;
 for(const url of [API+'?mode=login',API]){
  try{
   const d=await jsonFetch(url);
   if(!Array.isArray(d.users))throw new Error('Die Benutzerliste fehlt in der Serverantwort.');
   runtime.users=d.users;runtime.revision=Number(d.revision||0);
   if(!runtime.users.length)throw new Error('Es wurden keine ExportHUB-Benutzer gefunden.');
   return runtime.users;
  }catch(e){if(!firstError)firstError=e}
 }
 throw firstError||new Error('Benutzer konnten nicht geladen werden.');
}
function findUser(name,password){const n=lower(name);return runtime.users.find(function(u){return lower(u.user||u.login||u.username||u.name)===n&&text(u.password)===text(password)})||null}
async function loadState(){progress(8,'Azure-Teamdaten werden geladen …');addSafeLoadNote();const res=await native.fetch(API,{credentials:'same-origin',cache:'no-store'});if(!res.ok)throw new Error('Teamdaten konnten nicht geladen werden (HTTP '+res.status+').');const txt=await res.text();progress(18,'Teamdaten werden im Hintergrund verarbeitet …');const d=await parseLargeJson(txt);if(!d||d.ok===false)throw new Error((d&&d.message)||'Teamdaten ungültig');runtime.state=d.state||{};runtime.users=Array.isArray(d.users)?d.users:runtime.users;runtime.revision=Number(d.revision||0);window.__CLEAN_BOOT_STATE__=runtime.state;window.__CLEAN_BOOT_USERS__=runtime.users;return d}

function runOne(entry){return new Promise(function(resolve){native.setTimeout(function(){runtime.currentModuleId=Number(entry.id)||0;try{const s=document.createElement('script');s.dataset.cleanLegacy=String(entry.id);s.text=entry.code+'\n//# sourceURL=exporthub-legacy-'+entry.id+'.js';document.head.appendChild(s);s.remove()}catch(e){console.error('Legacy-Modul '+entry.id,e)}finally{runtime.currentModuleId=0}resolve()},0)})}
async function runScripts(entries){for(let i=0;i<entries.length;i++){await runOne(entries[i]);if(i%3===2)await new Promise(function(r){if(window.requestIdleCallback)requestIdleCallback(function(){r()},{timeout:120});else native.setTimeout(r,20)})}}
async function loadScript(src){return new Promise(function(resolve,reject){const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=function(){reject(new Error('Modul konnte nicht geladen werden: '+src))};document.head.appendChild(s)})}
async function cleanYield(ms){return new Promise(function(resolve){if(window.requestIdleCallback){requestIdleCallback(function(){native.setTimeout(resolve,ms||20)},{timeout:500})}else native.setTimeout(resolve,ms||40)})}
async function loadLegacy(){
 if(runtime.loaded)return;
 runtime.loading=true;
 const manifest=await (await native.fetch('assets/legacy-manifest.json',{cache:'no-store'})).json();
 progress(20,'Stabiler Kern wird vorbereitet …');
 await cleanYield(80);
 for(let i=0;i<manifest.length;i++){
  const entry=manifest[i],started=performance.now();
  progress(20+Math.round((i/manifest.length)*70),'Anwendungsbereiche werden geladen · stabiles Paket '+(i+1)+' von '+manifest.length);
  window.__cleanGroupPromise=null;
  await loadScript(entry.src);
  if(window.__cleanGroupPromise)await window.__cleanGroupPromise;
  runtime.moduleTimes.push({src:entry.src,ms:Math.round(performance.now()-started)});
  await cleanYield(100);
 }
 runtime.loaded=true;runtime.loading=false;
 progress(94,'Anmeldung und Oberfläche werden aktiviert …');
 await cleanYield(120);
 activateLegacyLogin();
 await cleanYield(180);
 // The legacy login calls save()/saveUsers() while the full Azure state is still being activated.
 // Discard those startup writes before allowing any real serialization or POST.
 if(runtime.saveTimer){native.clearTimeout(runtime.saveTimer);runtime.saveTimer=null}
 runtime.pendingSave=false;
 const discardedStartupTimers=runtime.timeoutJobs.size;
 runtime.timeoutJobs.clear();
 runtime.droppedStartupTimers+=discardedStartupTimers;
 const discardedObservers=runtime.observerRecords.size;
 runtime.observerRecords.forEach(function(o){o.active=false});
 runtime.observerRecords.clear();
 const discardedIntervals=runtime.intervalJobs.size;
 runtime.intervalJobs.clear();
 runtime.legacyTimersReady=true;
 runtime.startupComplete=true;
 window.__EXPORTHUB_CLEAN_DIAGNOSTICS__={version:VERSION,moduleTimes:runtime.moduleTimes.slice(),skipped:runtime.skipped.slice(),discardedStartupTimers:discardedStartupTimers,droppedStartupTimersTotal:runtime.droppedStartupTimers,discardedLegacyObservers:discardedObservers,activeLegacyObservers:runtime.observerRecords.size,discardedLegacyIntervals:discardedIntervals,activeLegacyIntervals:runtime.intervalJobs.size};
 setVersion();try{Object.defineProperty(document,'title',{configurable:true,get:function(){return 'ExportHUB Clean '+VERSION},set:function(){var t=document.querySelector('title');if(t)t.textContent='ExportHUB Clean '+VERSION}})}catch(_){ }
 progress(100,'ExportHUB ist bereit. Der vollständige Funktionsstand wurde geladen.');
 const loadedInfo=by('saveInfo');if(loadedInfo)loadedInfo.textContent='Azure-Teamdaten geladen · '+new Date().toLocaleTimeString('de-DE');
 native.setTimeout(hideProgress,850)
}
function activateLegacyLogin(){const u=by('loginUser'),p=by('loginPass');if(u)u.value=runtime.user.user||runtime.user.login||runtime.user.name||'';if(p)p.value=runtime.user.password||'';try{if(typeof window.rc430StrictLogin==='function')window.rc430StrictLogin();else if(by('loginBtn'))by('loginBtn').click()}catch(e){console.error(e)}const login=by('login'),app=by('app');if(login)login.classList.add('hidden');if(app)app.classList.remove('hidden');applyUserIdentity();setVersion();native.setTimeout(function(){applyUserIdentity();setVersion()},250)}

async function queueSave(reason){if(window.__EXPORTHUB_NAVIGATION__)return;if(!runtime.startupComplete||runtime.loading||!runtime.loaded)return;runtime.pendingSave=true;if(runtime.saveTimer)native.clearTimeout(runtime.saveTimer);runtime.saveTimer=native.setTimeout(function(){flushSave(reason)},1800)}
async function flushSave(reason){if(!runtime.startupComplete||runtime.loading||!runtime.loaded)return;if(runtime.saving){runtime.pendingSave=true;return}const getState=window.__EXPORTHUB_GET_STATE__,getUsers=window.__EXPORTHUB_GET_USERS__;if(typeof getState!=='function')return;runtime.saving=true;runtime.pendingSave=false;const info=by('saveInfo');if(info)info.textContent='Speicherung in Azure läuft …';try{const payload={clientVersion:VERSION,baseRevision:runtime.revision,reason:reason||'save',state:getState(),users:typeof getUsers==='function'?getUsers():runtime.users};const d=await jsonFetch(API+'?ack=1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});runtime.revision=Number(d.revision||runtime.revision);if(info)info.textContent='Dauerhaft in Azure gespeichert · '+new Date().toLocaleTimeString('de-DE')}catch(e){if(info)info.textContent='Nicht gespeichert: '+e.message;alert('Die Änderung konnte nicht dauerhaft in Azure gespeichert werden.\n\n'+e.message)}finally{runtime.saving=false;if(runtime.pendingSave)queueSave('queued')}}

async function login(){
 if(runtime.loading)return;
 const name=by('loginUser')&&by('loginUser').value,pass=by('loginPass')&&by('loginPass').value;
 if(!runtime.ms){
  status('Microsoft-Anmeldung wird erneut geprüft …','');
  await loadMicrosoft();
  if(!runtime.ms){status('Bitte zuerst mit dem Microsoft-Konto anmelden.','bad');return}
  try{await loadUsers();setLoginEnabled(true)}catch(e){status('Benutzer konnten nicht geladen werden: '+e.message,'bad');return}
 }
 const user=findUser(name,pass);if(!user){status('Benutzername oder Passwort ist falsch.','bad');return}
 runtime.user=user;status('Anmeldung bestätigt. ExportHUB wird geladen …','ok');
 try{await loadState();await loadLegacy()}catch(e){hideProgress();status('ExportHUB konnte nicht geladen werden: '+e.message,'bad');console.error(e)}
}
function bindMicrosoftControls(){
 const loginLink=by('cleanMicrosoftLoginButton');
 const checkBtn=by('cleanMicrosoftCheckButton');
 const logoutLink=by('cleanMicrosoftLogoutButton');
 if(loginLink){
  loginLink.href=authLoginUrl();
  loginLink.addEventListener('click',function(e){
   e.preventDefault();
   status('Microsoft-Anmeldung wird geöffnet …','');
   window.location.assign(authLoginUrl());
  });
 }
 if(logoutLink)logoutLink.href=authLogoutUrl();
 if(checkBtn)checkBtn.addEventListener('click',async function(){
  checkBtn.disabled=true;
  status('Microsoft-Anmeldung wird erneut geprüft …','');
  const p=await loadMicrosoft();
  if(p){
   try{await loadUsers();setLoginEnabled(true);status('Microsoft-Konto erkannt. Anmeldung bereit.','ok')}
   catch(e){setLoginEnabled(false);status('Benutzer konnten nicht geladen werden: '+e.message,'bad')}
  }else{setLoginEnabled(false)}
  checkBtn.disabled=false;
 });
}
function bindLogin(){const btn=by('loginBtn');if(btn)btn.addEventListener('click',function(e){if(!runtime.loaded){e.preventDefault();e.stopImmediatePropagation();login()}},true);['loginUser','loginPass'].forEach(function(id){const e=by(id);if(e)e.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!runtime.loaded){ev.preventDefault();login()}},true)})}

window.ExportHUBClean={VERSION:VERSION,runScripts:runScripts,queueSave:queueSave,flushSave:flushSave,native:native,runtime:runtime};
window.__EXPORTHUB_RC439_TEAM_SYNC__=true;
window.__EXPORTHUB_RC467__=true;
window.__EXPORTHUB_RC466_MEMORY_STORAGE__=true;
window.addEventListener('error',function(e){console.error('ExportHUB Clean Fehler',e.error||e.message)});

document.addEventListener('DOMContentLoaded',async function(){
 setVersion();bindMicrosoftControls();bindLogin();setLoginEnabled(false);
 const app=by('app'),loginBox=by('login');if(app)app.classList.add('hidden');if(loginBox)loginBox.classList.remove('hidden');
 const p=await loadMicrosoft();
 if(!p){status('Bitte zuerst mit dem Microsoft-Konto anmelden.','');return}
 status('ExportHUB-Benutzer werden geladen …','');
 try{await loadUsers();setLoginEnabled(true);status('Anmeldung bereit.','ok')}
 catch(e){setLoginEnabled(false);status('Benutzer konnten nicht geladen werden: '+e.message,'bad')}
});
})();
