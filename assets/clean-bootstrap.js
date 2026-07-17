(function(){
'use strict';
const VERSION='RC505';
const LOGIN_RETURN='/?v=505';
const API='/api/exporthub/state';
const native={
  fetch:window.fetch.bind(window),
  setTimeout:window.setTimeout.bind(window),
  clearTimeout:window.clearTimeout.bind(window),
  setInterval:window.setInterval.bind(window),
  clearInterval:window.clearInterval.bind(window),
  jsonStringify:JSON.stringify.bind(JSON),
  MutationObserver:window.MutationObserver
};
const runtime={users:[],state:null,revision:0,user:null,ms:null,loading:false,loaded:false,saveTimer:null,saving:false,pendingSave:false,observerRecords:new Set(),intervalJobs:new Map(),intervalSeq:1,moduleTimes:[],moduleErrors:[],skippedTimeouts:0,suppressedStartupSaves:0,suppressedLegacyPosts:0,suppressedLegacyPayloads:0,versionTimer:null,armIntervals:null,skippedModuleIds:new Set([134,166,173,174,180]),skipped:['assets/legacy/group-10.js','module-134','module-166','module-173','module-174','module-180'],loader:'classic-script-low-memory'};

function by(id){return document.getElementById(id)}
function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function status(msg,kind){const e=by('cleanLoginStatus');if(!e)return;e.textContent=msg||'';e.className='clean-login-status '+(kind||'')}
function progress(p,msg){const panel=by('cleanLoadPanel'),bar=by('cleanProgressBar'),lab=by('cleanProgressLabel'),txt=by('cleanLoadText');if(panel)panel.classList.remove('hidden');if(bar)bar.style.width=Math.max(0,Math.min(100,p))+'%';if(lab)lab.textContent=Math.round(p)+' %';if(txt&&msg)txt.textContent=msg}
function hideProgress(){const p=by('cleanLoadPanel');if(p)p.classList.add('hidden')}
function authLoginUrl(){
 const base=/^https?:$/i.test(window.location.protocol)?window.location.origin:'https://exporthub.invalid';
 const u=new URL('/.auth/login/aad',base);
 u.searchParams.set('post_login_redirect_uri',LOGIN_RETURN);
 return u.href;
}
function authLogoutUrl(){
 const base=/^https?:$/i.test(window.location.protocol)?window.location.origin:'https://exporthub.invalid';
 const u=new URL('/.auth/logout',base);
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


function isStateApiUrl(input){
 try{
  const raw=typeof input==='string'?input:(input&&input.url)||'';
  const base=/^https?:$/i.test(location.protocol)?location.href:'https://exporthub.invalid/';
  return new URL(raw,base).pathname==='/api/exporthub/state';
 }catch(_){return false}
}
function fakeLegacyWriteResponse(){
 const body='{"ok":true,"ackOnly":true,"startupSuppressed":true,"revision":'+Number(runtime.revision||0)+'}';
 try{return Promise.resolve(new Response(body,{status:200,headers:{'Content-Type':'application/json'}}))}
 catch(_){return Promise.resolve({ok:true,status:200,text:async function(){return body},json:async function(){return JSON.parse(body)}})}
}
function looksLikeLegacyStatePayload(value){
 if(!value||typeof value!=='object'||!value.state||typeof value.state!=='object')return false;
 if(!('users' in value)&&!('user' in value)&&!('clientVersion' in value))return false;
 const st=value.state;
 return Array.isArray(st.shipments)||Array.isArray(st.customers)||Array.isArray(st.tasks)||Array.isArray(st.abdRequests)||Array.isArray(st.palletAccount);
}
// During startup, old direct sync modules must not serialize the complete Azure state.
// Their POST is discarded below; the authoritative state was already loaded from Azure.
JSON.stringify=function(value,replacer,space){
 if((runtime.loading||!runtime.loaded)&&looksLikeLegacyStatePayload(value)){
  runtime.suppressedLegacyPayloads++;
  return '{"startupSuppressed":true}';
 }
 return native.jsonStringify(value,replacer,space)
};
// Old modules contain many independent POST routines. They are consolidated into the
// single debounced Clean save path. Reads remain untouched.
window.fetch=function(input,options){
 const opts=options||{};
 const method=String(opts.method||(input&&input.method)||'GET').toUpperCase();
 if(isStateApiUrl(input)&&!['GET','HEAD','OPTIONS'].includes(method)){
  runtime.suppressedLegacyPosts++;
  if(runtime.loaded&&!runtime.loading)queueSave('legacy-direct-fetch');
  return fakeLegacyWriteResponse();
 }
 return native.fetch(input,options)
};

function addSafeLoadNote(){
 const panel=by('cleanLoadPanel'); if(!panel||by('cleanSafeLoadNote'))return;
 const n=document.createElement('div'); n.id='cleanSafeLoadNote'; n.className='clean-safe-note';
 n.textContent='Stabiler Start: Alt-Timer und Hintergrund-Reparaturen bleiben bis zum vollständigen Laden pausiert.';
 panel.appendChild(n);
}

function setVersion(){document.title='ExportHUB Clean '+VERSION;document.querySelectorAll('[id*=version i],[class*=version i]').forEach(function(e){if(/Private RC\d+|Aktuelle Version/i.test(e.textContent||''))e.textContent=(e.textContent||'').replace(/Private RC\d+/gi,'Private '+VERSION).replace(/RC\d+/gi,VERSION)});const login=document.querySelector('.login-card');if(login&&!by('cleanVersionBadge')){const d=document.createElement('div');d.id='cleanVersionBadge';d.className='clean-version-badge';d.textContent='Bereinigte Version · '+VERSION;login.appendChild(d)}}

// ExportHUB browser storage is fully disabled. Team data comes only from Azure.
// Legacy storage writes are discarded instead of retaining large JSON copies in Chrome memory.
try{
 const SP=window.Storage&&window.Storage.prototype;
 if(SP){
  const g=SP.getItem,s=SP.setItem,r=SP.removeItem,c=SP.clear;
  function own(key){return /exporthub|rc\d+/i.test(String(key||''))}
  SP.getItem=function(key){return own(key)?null:g.call(this,key)};
  SP.setItem=function(key,val){if(own(key))return;return s.call(this,key,val)};
  SP.removeItem=function(key){if(own(key))return;return r.call(this,key)};
  SP.clear=function(){return c.call(this)};
 }
}catch(_){ }
try{if(window.indexedDB){window.indexedDB.open=function(){throw new Error('ExportHUB Clean verwendet keinen dauerhaften Browser-Speicher.')}}}catch(_){ }

// One real observer multiplexes all legacy observers. It is completely paused during startup.
(function installObserverHub(){
 if(!native.MutationObserver)return;
 const records=runtime.observerRecords;
 class CleanObserver{
  constructor(cb){this.cb=cb;this.targets=[];this.active=true;this.last=0;this.fail=0;records.add(this)}
  observe(target,options){if(target)this.targets.push({target:target,options:options||{}})}
  disconnect(){this.active=false;records.delete(this)}
  takeRecords(){return[]}
 }
 window.MutationObserver=CleanObserver;
 let scheduled=false,queue=[];
 function relevant(rec,muts){if(!rec.targets.length)return true;return muts.some(function(m){return rec.targets.some(function(t){try{return t.target===m.target||t.target.contains(m.target)}catch(_){return false}})})}
 function drain(deadline){
  if(runtime.loading||!runtime.loaded){queue.length=0;scheduled=false;return}
  let count=0;
  while(queue.length&&count<2&&(!deadline||deadline.timeRemaining()>4)){
   const item=queue.shift(),now=Date.now();
   if(!item.active||now-item.last<1200)continue;
   item.last=now;
   try{item.cb([],item);item.fail=0}catch(e){item.fail++;if(item.fail>2)item.disconnect()}
   count++;
  }
  if(queue.length)scheduleDrain();else scheduled=false;
 }
 function scheduleDrain(){if(window.requestIdleCallback)window.requestIdleCallback(drain,{timeout:800});else native.setTimeout(function(){drain(null)},100)}
 const hub=new native.MutationObserver(function(muts){
  if(runtime.loading||!runtime.loaded){queue.length=0;scheduled=false;return}
  records.forEach(function(rec){if(rec.active&&relevant(rec,muts)&&queue.indexOf(rec)<0&&queue.length<40)queue.push(rec)});
  if(!scheduled&&queue.length){scheduled=true;scheduleDrain()}
  if(runtime.versionTimer)native.clearTimeout(runtime.versionTimer);
  runtime.versionTimer=native.setTimeout(function(){runtime.versionTimer=null;setVersion()},250);
 });
 hub.observe(document.documentElement,{childList:true,subtree:true,attributes:true});
})();

// Short legacy timeouts and every legacy interval are quarantined until startup is complete.
(function installTimerHubs(){
 let fakeTimeout=-1;
 window.setTimeout=function(fn,delay){
  const args=[].slice.call(arguments,2),ms=Math.max(0,Number(delay)||0);
  if(runtime.loading&&ms<4000){runtime.skippedTimeouts++;return fakeTimeout--}
  return native.setTimeout(function(){try{typeof fn==='function'?fn.apply(window,args):(0,eval)(String(fn))}catch(e){console.error('ExportHUB Timeout',e)}},ms);
 };
 window.clearTimeout=function(id){if(Number(id)<0)return;native.clearTimeout(id)};
 window.setInterval=function(fn,delay){
  const args=[].slice.call(arguments,2),id=runtime.intervalSeq++;
  runtime.intervalJobs.set(id,{fn:fn,args:args,delay:Math.max(10000,Number(delay)||10000),nextAt:Infinity});
  return id;
 };
 window.clearInterval=function(id){runtime.intervalJobs.delete(id)};
 runtime.armIntervals=function(){
  const base=Date.now()+3500;let position=0;
  runtime.intervalJobs.forEach(function(job){job.nextAt=base+(position++*900)});
 };
 native.setInterval(function(){
  if(runtime.loading||!runtime.loaded)return;
  const now=Date.now();let ran=0;
  for(const pair of runtime.intervalJobs){
   if(ran>=1)break;
   const id=pair[0],j=pair[1];
   if(now<j.nextAt)continue;
   j.nextAt=now+j.delay;
   try{typeof j.fn==='function'?j.fn.apply(window,j.args):(0,eval)(String(j.fn))}catch(e){console.error('ExportHUB Intervall '+id,e);runtime.intervalJobs.delete(id)}
   ran++;
  }
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
async function parseLargeJson(textValue){return JSON.parse(textValue)}
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

async function cleanYield(ms){return new Promise(function(resolve){if(window.requestIdleCallback){window.requestIdleCallback(function(){native.setTimeout(resolve,ms||20)},{timeout:700})}else native.setTimeout(resolve,ms||40)})}
async function runOne(entry){
 const id=entry&&entry.id,code=entry&&entry.code;
 if(runtime.skippedModuleIds.has(Number(id))){if(entry)entry.code='';await cleanYield(4);return}
 try{
  const script=document.createElement('script');
  script.dataset.cleanLegacy=String(id);
  script.text=String(code||'')+'\n//# sourceURL=exporthub-legacy-'+id+'.js';
  document.head.appendChild(script);
  script.remove();
 }catch(e){runtime.moduleErrors.push({id:id,message:text(e&&e.message||e)});console.error('Legacy-Modul '+id,e)}
 finally{if(entry)entry.code=''}
 await cleanYield(12);
}
async function runScripts(entries){
 for(let i=0;i<entries.length;i++)await runOne(entries[i]);
 entries.length=0;
}
async function loadScript(src){
 const res=await native.fetch(src,{cache:'no-store'});
 if(!res.ok)throw new Error('Modul konnte nicht geladen werden: '+src+' (HTTP '+res.status+')');
 let source=await res.text();
 try{
  const script=document.createElement('script');
  script.dataset.cleanGroup=src;
  script.text=source+'\n//# sourceURL='+src;
  document.head.appendChild(script);
  script.remove();
 }finally{source=''}
}
async function loadLegacy(){
 if(runtime.loaded)return;
 runtime.loading=true;runtime.loaded=false;runtime.pendingSave=false;
 if(runtime.saveTimer){native.clearTimeout(runtime.saveTimer);runtime.saveTimer=null}
 document.documentElement.setAttribute('data-exporthub-loading','1');
 try{
  const manifest=await (await native.fetch('assets/legacy-manifest.json',{cache:'no-store'})).json();
  progress(20,'Stabiler Low-Memory-Kern wird vorbereitet …');
  await cleanYield(100);
  for(let i=0;i<manifest.length;i++){
   const entry=manifest[i],started=performance.now();
   progress(20+Math.round((i/manifest.length)*70),'Anwendungsbereiche werden speicherschonend geladen · Paket '+(i+1)+' von '+manifest.length);
   window.__cleanGroupPromise=null;
   await loadScript(entry.src);
   const groupPromise=window.__cleanGroupPromise;
   if(groupPromise)await groupPromise;
   window.__cleanGroupPromise=null;
   runtime.moduleTimes.push({src:entry.src,ms:Math.round(performance.now()-started)});
   await cleanYield(140);
  }
  runtime.loading=false;runtime.loaded=true;runtime.pendingSave=false;
  if(runtime.saveTimer){native.clearTimeout(runtime.saveTimer);runtime.saveTimer=null}
  document.documentElement.removeAttribute('data-exporthub-loading');
  if(typeof runtime.armIntervals==='function')runtime.armIntervals();
  window.__EXPORTHUB_CLEAN_DIAGNOSTICS__={version:VERSION,loader:runtime.loader,moduleTimes:runtime.moduleTimes.slice(),moduleErrors:runtime.moduleErrors.slice(),skipped:runtime.skipped.slice(),skippedTimeouts:runtime.skippedTimeouts,suppressedStartupSaves:runtime.suppressedStartupSaves,suppressedLegacyPosts:runtime.suppressedLegacyPosts,suppressedLegacyPayloads:runtime.suppressedLegacyPayloads,intervalJobs:runtime.intervalJobs.size,observerRecords:runtime.observerRecords.size};
  progress(94,'Anmeldung und Oberfläche werden einmalig aktiviert …');
  await cleanYield(180);
  activateLegacyLogin();
  progress(100,'ExportHUB ist bereit.');
  native.setTimeout(hideProgress,700);
 }catch(e){
  runtime.loading=false;runtime.loaded=false;
  document.documentElement.removeAttribute('data-exporthub-loading');
  throw e;
 }
}
function syncLegacyIdentity(){
 window.__CLEAN_BOOT_USERS__=runtime.users;
 window.__CLEAN_BOOT_ACTIVE_USER__=runtime.user;
 const payload=JSON.stringify(runtime.users||[]).replace(/<\/script/gi,'<\\/script');
 const active=JSON.stringify(runtime.user||{}).replace(/<\/script/gi,'<\\/script');
 const script=document.createElement('script');
 script.dataset.cleanIdentity='1';
 script.text=`(function(){
  try{
   var incoming=${payload};
   if(typeof users!=='undefined')users=(typeof normalizeUserRights==='function'?normalizeUserRights(incoming):incoming);
   if(typeof state!=='undefined'&&state)state.users=incoming;
  }catch(e){console.error('ExportHUB Benutzerabgleich',e)}
  window.__CLEAN_FORCE_INTERNAL_LOGIN__=function(){
   try{
    var wanted=${active};
    var key=String(wanted.user||wanted.login||wanted.username||wanted.name||'').trim().toLowerCase();
    var found=(typeof users!=='undefined'&&Array.isArray(users))?users.find(function(x){return String(x.user||x.login||x.username||x.name||'').trim().toLowerCase()===key}):null;
    if(!found)return false;
    if(typeof currentUser!=='undefined')currentUser=found;
    var login=document.getElementById('login'),app=document.getElementById('app');
    if(login)login.classList.add('hidden');if(app)app.classList.remove('hidden');
    var pn=document.getElementById('profileName'),pr=document.getElementById('profileRole');
    if(pn)pn.textContent=found.name||found.user||found.login||'';
    if(pr)pr.textContent=found.role||'';
    try{if(typeof applyLanguage==='function')applyLanguage()}catch(_){}
    try{if(typeof render==='function')render()}catch(_){}
    return true;
   }catch(e){console.error('ExportHUB Login-Fallback',e);return false}
  };
 })();`;
 document.head.appendChild(script);script.remove();
}
function activateLegacyLogin(){
 const u=by('loginUser'),p=by('loginPass');
 if(u)u.value=runtime.user.user||runtime.user.login||runtime.user.name||'';
 if(p)p.value=runtime.user.password||'';
 try{syncLegacyIdentity()}catch(e){console.error(e)}
 try{if(typeof window.rc430StrictLogin==='function')window.rc430StrictLogin();else if(by('loginBtn'))by('loginBtn').click()}catch(e){console.error(e)}
 try{if(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'&&!window.__EXPORTHUB_GET_CURRENT_USER__()&&typeof window.__CLEAN_FORCE_INTERNAL_LOGIN__==='function')window.__CLEAN_FORCE_INTERNAL_LOGIN__()}catch(e){console.error(e)}
 const login=by('login'),app=by('app');if(login)login.classList.add('hidden');if(app)app.classList.remove('hidden');setVersion();native.setTimeout(setVersion,250)
}

async function queueSave(reason){
 // Legacy modules call save() repeatedly while they install. Never serialize or upload the
 // complete team state during startup; these are initialization effects, not user changes.
 if(runtime.loading||!runtime.loaded){runtime.suppressedStartupSaves++;return}
 runtime.pendingSave=true;
 if(runtime.saveTimer)native.clearTimeout(runtime.saveTimer);
 runtime.saveTimer=native.setTimeout(function(){runtime.saveTimer=null;flushSave(reason)},900)
}
async function flushSave(reason){
 if(runtime.loading||!runtime.loaded){runtime.suppressedStartupSaves++;runtime.pendingSave=false;return}
 if(runtime.saving){runtime.pendingSave=true;return}
 const getState=window.__EXPORTHUB_GET_STATE__,getUsers=window.__EXPORTHUB_GET_USERS__;
 if(typeof getState!=='function')return;
 runtime.saving=true;runtime.pendingSave=false;
 const info=by('saveInfo');if(info)info.textContent='Speicherung in Azure läuft …';
 try{
  const payload={clientVersion:VERSION,baseRevision:runtime.revision,reason:reason||'save',state:getState(),users:typeof getUsers==='function'?getUsers():runtime.users};
  const body=native.jsonStringify(payload);
  const d=await jsonFetch(API+'?ack=1',{method:'POST',headers:{'Content-Type':'application/json'},body:body});
  runtime.revision=Number(d.revision||runtime.revision);
  if(info)info.textContent='Dauerhaft in Azure gespeichert · '+new Date().toLocaleTimeString('de-DE')
 }catch(e){
  if(info)info.textContent='Nicht gespeichert: '+e.message;
  alert('Die Änderung konnte nicht dauerhaft in Azure gespeichert werden.\n\n'+e.message)
 }finally{
  runtime.saving=false;
  if(runtime.pendingSave)queueSave('queued')
 }
}

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
