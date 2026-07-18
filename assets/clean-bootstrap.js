(function(){
'use strict';
const BUILD=window.EXPORTHUB_BUILD||{version:'RC540',cache:'540',loginReturn:'/?v=540'};
const VERSION=String(BUILD.version||'RC540');
const CACHE=String(BUILD.cache||VERSION.replace(/\D/g,''));
const LOGIN_RETURN=String(BUILD.loginReturn||('/?v='+CACHE));
const API='/api/exporthub/state';
const native={
  fetch:window.fetch.bind(window),
  setTimeout:window.setTimeout.bind(window),
  clearTimeout:window.clearTimeout.bind(window),
  setInterval:window.setInterval.bind(window),
  clearInterval:window.clearInterval.bind(window),
  MutationObserver:window.MutationObserver,
  requestAnimationFrame:window.requestAnimationFrame?window.requestAnimationFrame.bind(window):null,
  cancelAnimationFrame:window.cancelAnimationFrame?window.cancelAnimationFrame.bind(window):null
};
const runtime={users:[],state:null,revision:0,user:null,ms:null,loading:false,loaded:false,ready:false,readyAt:null,saveTimer:null,saving:false,pendingSave:false,dirty:false,lastSnapshot:null,lastUsers:null,pollTimer:null,polling:false,lastPollAt:0,acceptWritesAt:0,lastQueueReason:'',lastQueueAt:0,lastQueueStack:'',remoteApplyCount:0,applyingRemote:false,deviceId:'DEV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),observerRecords:new Set(),intervalJobs:new Map(),intervalSeq:1,moduleTimes:[],skipped:[],timeoutJobs:new Map(),timeoutSeq:1000000,timeoutSourceIds:new WeakMap(),timeoutSourceSeq:1,legacyTimersReady:false,droppedStartupTimers:0,intervalsArmed:false,currentModuleId:0,versionTimer:null,blockLegacyBackground:false,blockedLegacyTimeouts:0,blockedLegacyIntervals:0,blockedLegacyObservers:0,blockedLegacyAnimationFrames:0,rafSeq:2000000,network:{stateGets:0,metaGets:0,legacyCachedGets:0,posts:0}};

function by(id){return document.getElementById(id)}
function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function status(msg,kind){const e=by('cleanLoginStatus');if(!e)return;e.textContent=msg||'';e.className='clean-login-status '+(kind||'')}
function progress(p,msg){const panel=by('cleanLoadPanel'),bar=by('cleanProgressBar'),lab=by('cleanProgressLabel'),txt=by('cleanLoadText');if(panel)panel.classList.remove('hidden');if(bar)bar.style.width=Math.max(0,Math.min(100,p))+'%';if(lab)lab.textContent=Math.round(p)+' %';if(txt&&msg)txt.textContent=msg}
function hideProgress(){const p=by('cleanLoadPanel');if(p)p.classList.add('hidden')}
function rc524StyleHealth(){
 const app=by('app'),side=document.querySelector('.sidebar');
 let ok=false;
 try{ok=!!app&&getComputedStyle(app).display==='grid'&&!!side&&/gradient/i.test(getComputedStyle(side).backgroundImage||'')}catch(_){ok=false}
 if(ok){document.documentElement.removeAttribute('data-rc524-style-fallback');return Promise.resolve(true)}
 document.documentElement.setAttribute('data-rc524-style-fallback','1');
 let link=by('rc538MainStyles');
 if(!link){link=document.createElement('link');link.id='rc538MainStyles';link.rel='stylesheet';document.head.appendChild(link)}
 link.href='assets/exporthub-ui-rc540.css?v='+CACHE+'&retry='+Date.now();
 return fetch('assets/exporthub-ui-rc540.css?v='+CACHE,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('CSS HTTP '+r.status);return r.text()}).then(function(css){
  let st=by('rc521StyleFallback');if(!st){st=document.createElement('style');st.id='rc521StyleFallback';document.head.appendChild(st)}st.textContent=css;
  return true
 }).catch(function(e){console.error('RC540 Design konnte nicht nachgeladen werden',e);return false})
}
function authLoginUrl(){
 const base=window.location.origin&&window.location.origin!=='null'?window.location.origin:document.baseURI;
 const u=new URL('/.auth/login/aad',base);
 u.searchParams.set('post_login_redirect_uri',LOGIN_RETURN);
 return u.href;
}
function authLogoutUrl(){
 const base=window.location.origin&&window.location.origin!=='null'?window.location.origin:document.baseURI;
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

function addSafeLoadNote(){
 const panel=by('cleanLoadPanel'); if(!panel||by('cleanSafeLoadNote'))return;
 const n=document.createElement('div'); n.id='cleanSafeLoadNote'; n.className='clean-safe-note';
 n.textContent='ExportHUB wird stabil geladen. Hintergrundmodule starten erst nach der sichtbaren Bereitschaft.';
 panel.appendChild(n);
}

function setVersion(){
 try{const d=Object.getOwnPropertyDescriptor(document,'title');if(d&&d.configurable)delete document.title}catch(_){ }
 try{document.title='ExportHUB '+VERSION}catch(_){ }
 const title=document.querySelector('title');if(title)title.textContent='ExportHUB '+VERSION;
 document.documentElement.setAttribute('data-exporthub-version',VERSION);
 document.querySelectorAll('[id*=version i],[class*=version i],[data-exporthub-version-label]').forEach(function(e){
  const value=text(e.textContent);
  if(/(?:ExportHUB\s+Private\s+|Private\s+)?RC\d+/i.test(value))e.textContent=value.replace(/ExportHUB\s+Private\s+RC\d+/gi,'ExportHUB '+VERSION).replace(/Private\s+RC\d+/gi,VERSION).replace(/RC\d+/gi,VERSION);
 });
 const login=document.querySelector('.login-card');if(login&&!by('cleanVersionBadge')){const d=document.createElement('div');d.id='cleanVersionBadge';d.className='clean-version-badge';d.textContent='Bereinigte Version · '+VERSION;login.appendChild(d)}
}


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
(function installStartupNetworkGate(){
 const realFetch=window.fetch.bind(window);
 window.fetch=function(input,options){
  try{
   const url=typeof input==='string'?input:(input&&input.url)||'';
   const method=String((options&&options.method)||(input&&input.method)||'GET').toUpperCase();
   const stateUrl=/\/api\/exporthub\/state/i.test(url);
   if((runtime.loading||!runtime.loaded)&&stateUrl&&method!=='GET'&&method!=='HEAD'){
    return Promise.resolve(new Response(JSON.stringify({ok:true,skipped:true,startup:true,revision:runtime.revision}),{status:200,headers:{'Content-Type':'application/json'}}));
   }
   if((runtime.loading||runtime.loaded||runtime.state)&&stateUrl&&(method==='GET'||method==='HEAD')&&!/[?&](?:meta=1|mode=(?:meta|login|users))/i.test(url)){
    runtime.network.legacyCachedGets++;
    const body={ok:true,schemaVersion:3,revision:runtime.revision,state:clone(window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():runtime.state||{}),users:clone(window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():runtime.users||[])};
    return Promise.resolve(new Response(method==='HEAD'?'':JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
   }
  }catch(_){ }
  return realFetch(input,options);
 };
})();;

// One real observer multiplexes all legacy observers with throttling and a circuit breaker.
(function installObserverHub(){
 if(!native.MutationObserver)return;
 const records=runtime.observerRecords;
 class CleanObserver{
  constructor(cb){this.cb=cb;this.targets=[];this.active=!runtime.blockLegacyBackground;this.last=0;this.fail=0;this.moduleId=runtime.currentModuleId||0;if(this.active)records.add(this);else runtime.blockedLegacyObservers++}
  observe(target,options){if(this.active&&target)this.targets.push({target:target,options:options||{}})}
  disconnect(){this.active=false;records.delete(this)}
  takeRecords(){return[]}
 }
 window.MutationObserver=CleanObserver;
 let scheduled=false,queue=[];
 function relevant(rec,muts){if(!rec.targets.length)return true;return muts.some(function(m){return rec.targets.some(function(t){try{return t.target===m.target||t.target.contains(m.target)}catch(_){return false}})})}
 function drain(deadline){if(runtime.blockLegacyBackground||runtime.loading||!runtime.loaded){queue.length=0;scheduled=false;return}let count=0;while(queue.length&&count<1&&(!deadline||deadline.timeRemaining()>3)){const item=queue.shift(),now=Date.now();if(!item.active||now-item.last<2500)continue;item.last=now;try{item.cb([],item);item.fail=0}catch(e){item.fail++;if(item.fail>2)item.disconnect()}count++}if(queue.length){scheduleDrain()}else scheduled=false}
 function scheduleDrain(){native.setTimeout(function(){if(window.requestIdleCallback)window.requestIdleCallback(drain,{timeout:700});else drain(null)},250)}
 const hub=new native.MutationObserver(function(muts){
  if(!runtime.blockLegacyBackground&&!runtime.loading&&runtime.loaded){records.forEach(function(rec){if(rec.active&&relevant(rec,muts)&&queue.indexOf(rec)<0)queue.push(rec)});if(!scheduled&&queue.length){scheduled=true;scheduleDrain()}}
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
  if(runtime.blockLegacyBackground&&runtime.loaded){runtime.blockedLegacyTimeouts++;return id}
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
  if(runtime.blockLegacyBackground||runtime.loading||!runtime.loaded||!runtime.legacyTimersReady)return;
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
  if(runtime.blockLegacyBackground&&runtime.loaded){runtime.blockedLegacyIntervals++;return id}
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
  if(runtime.blockLegacyBackground||runtime.loading||!runtime.loaded||!runtime.legacyTimersReady||!runtime.intervalsArmed)return;
  const now=Date.now();let selected=null,selectedId=null;
  runtime.intervalJobs.forEach(function(j,id){if(j.nextDue<=now&&(!selected||j.nextDue<selected.nextDue)){selected=j;selectedId=id}});
  if(!selected)return;
  selected.nextDue=now+selected.delay;
  try{typeof selected.fn==='function'?selected.fn.apply(window,selected.args):(0,eval)(String(selected.fn))}
  catch(_){runtime.intervalJobs.delete(selectedId)}
 },1000);
})();

// RC523: alte Reparaturmodule dürfen nach dem stabilen Start keine neuen DOM-Schleifen starten.
(function installAnimationFrameGate(){
 if(!native.requestAnimationFrame)return;
 window.requestAnimationFrame=function(cb){
  const id=runtime.rafSeq++;
  if(runtime.blockLegacyBackground&&runtime.loaded){runtime.blockedLegacyAnimationFrames++;return id}
  return native.requestAnimationFrame(cb)
 };
 window.cancelAnimationFrame=function(id){try{if(native.cancelAnimationFrame)native.cancelAnimationFrame(id)}catch(_){ }};
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
 if(!res.ok||data.ok===false){const error=new Error(data.message||('HTTP '+res.status));error.code=data.code||'HTTP_'+res.status;error.status=res.status;error.data=data;throw error}
 return data
}
async function parseLargeJson(textValue){if(String(textValue||'').length<1500000||!window.Worker)return JSON.parse(textValue);const code='self.onmessage=e=>{try{self.postMessage({ok:true,value:JSON.parse(e.data)})}catch(x){self.postMessage({ok:false,error:x.message})}}';const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));try{return await new Promise(function(resolve,reject){let done=false;const w=new Worker(url),finish=function(fn,value){if(done)return;done=true;native.clearTimeout(timer);try{w.terminate()}catch(_){ }fn(value)},timer=native.setTimeout(function(){try{finish(resolve,JSON.parse(textValue))}catch(e){finish(reject,e)}},3000);w.onmessage=function(e){e.data.ok?finish(resolve,e.data.value):finish(reject,new Error(e.data.error))};w.onerror=function(e){try{finish(resolve,JSON.parse(textValue))}catch(x){finish(reject,new Error(e.message||x.message||'Worker-Fehler'))}};try{w.postMessage(textValue)}catch(e){try{finish(resolve,JSON.parse(textValue))}catch(x){finish(reject,x)}}})}finally{URL.revokeObjectURL(url)}}
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
async function loadState(){
 progress(8,'Azure-Teamdaten werden geladen …');addSafeLoadNote();runtime.network.stateGets++;
 const res=await native.fetch(API,{credentials:'same-origin',cache:'no-store'});
 if(!res.ok)throw new Error('Teamdaten konnten nicht geladen werden (HTTP '+res.status+').');
 const txt=await res.text();progress(18,'Teamdaten werden im Hintergrund verarbeitet …');
 const d=await parseLargeJson(txt);if(!d||d.ok===false)throw new Error((d&&d.message)||'Teamdaten ungültig');
 runtime.state=d.state||{};canonicalizeCustomers(runtime.state);runtime.users=Array.isArray(d.users)?d.users:runtime.users;runtime.revision=Number(d.revision||0);
 runtime.lastSnapshot=clone(runtime.state);runtime.lastUsers=clone(runtime.users);runtime.dirty=false;
 window.__CLEAN_BOOT_STATE__=runtime.state;window.__CLEAN_BOOT_USERS__=runtime.users;return d
}

function runOne(entry){return new Promise(function(resolve){native.setTimeout(function(){runtime.currentModuleId=Number(entry.id)||0;try{const s=document.createElement('script');s.dataset.cleanLegacy=String(entry.id);s.text=entry.code+'\n//# sourceURL=exporthub-legacy-'+entry.id+'.js';document.head.appendChild(s);s.remove();if(Number(entry.id)===148){window.__RC532_CORE_SHOW_DOCUMENTS__=window.rc390ShowDocuments;window.__RC532_CORE_LOADLIST_PDF__=window.rc390DownloadLoadlistPdf;window.__RC532_CORE_LOADLIST_PAGE2_PDF__=window.rc390DownloadLoadlistPage2Pdf;window.__RC532_CORE_PRINT_DOCUMENTS__=window.rc390PrintDocuments}}catch(e){console.error('Legacy-Modul '+entry.id,e)}finally{runtime.currentModuleId=0}resolve()},0)})}
async function runScripts(entries){for(let i=0;i<entries.length;i++){await runOne(entries[i]);if(i%5===4)await new Promise(function(r){if(window.requestIdleCallback)requestIdleCallback(function(){r()},{timeout:80});else native.setTimeout(r,8)})}}
async function loadScript(src){return new Promise(function(resolve,reject){const s=document.createElement('script');s.src=src+(String(src).indexOf('?')>=0?'&':'?')+'v='+encodeURIComponent(CACHE);s.async=false;s.onload=resolve;s.onerror=function(){reject(new Error('Modul konnte nicht geladen werden: '+src))};document.head.appendChild(s)})}
async function cleanYield(ms){return new Promise(function(resolve){if(window.requestIdleCallback){requestIdleCallback(function(){native.setTimeout(resolve,ms||20)},{timeout:500})}else native.setTimeout(resolve,ms||40)})}

function rc524FinalFixes(){
 try{
  document.title='ExportHUB '+VERSION;
  document.querySelectorAll('body *').forEach(function(el){
   if(el.children&&el.children.length)return;
   var t=String(el.textContent||'');
   if(/Private RC\d+|ExportHUB Private RC\d+/.test(t)){
    el.textContent=t.replace(/ExportHUB Private RC\d+/g,'ExportHUB '+VERSION).replace(/Private RC\d+/g,VERSION);
   }
  });
 }catch(_){ }
 // Prevent the legacy RC463 presentation patch from overwriting newer areas again.
 try{
  if(typeof window.rc463Patch==='function'){
   window.__RC520_ORIGINAL_RC463_PATCH__=window.rc463Patch;
   window.rc463Patch=function(){return true};
  }
 }catch(_){ }
 // A new shipment must start completely empty, including customer/customer search.
 try{
  document.addEventListener('click',function(ev){
   var b=ev.target&&ev.target.closest?ev.target.closest('button,a'):null;
   if(!b||!/neue\s*sendung/i.test(String(b.textContent||'')))return;
   native.setTimeout(function(){
    var selectors=[
     '#customerSearch','#shipmentCustomerSearch','#newShipmentCustomerSearch',
     '#customerSelect','#shipmentCustomer','#customerId','#customerNo',
     'input[name="customer"]','input[name="customerSearch"]','input[name="customerNumber"]',
     '[data-field="customer"] input','[data-field="customerSearch"] input'
    ];
    selectors.forEach(function(sel){document.querySelectorAll(sel).forEach(function(e){
     if(e.tagName==='SELECT')e.selectedIndex=0;else e.value='';
     try{e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){ }
    })});
    try{
     var st=typeof window.state!=='undefined'?window.state:null;
     if(st&&st.currentShipment){
      ['customerId','customerNo','customerNumber','customerName','customer','customerSearch'].forEach(function(k){st.currentShipment[k]=''});
     }
    }catch(_){ }
   },20);
  },true);
 }catch(_){ }
 window.__EXPORTHUB_RC532__=true;
}

function quarantineLegacyBackground(){
 try{
  Object.keys(window).forEach(function(k){
   if(/^__rc\d+.*Observer$/i.test(k)){
    try{const o=window[k];if(o&&typeof o.disconnect==='function')o.disconnect();window[k]=null}catch(_){ }
   }
   if(/^__rc\d+.*(Timer|Guard)$/i.test(k)){
    try{native.clearInterval(window[k]);native.clearTimeout(window[k]);window[k]=0}catch(_){ }
   }
  });
 }catch(_){ }
}


const SYNC_COLLECTION_KEYS={shipments:['id','ref'],tasks:['id','_syncId'],customers:['id','account','customerNumber','kundennummer','customerNo','no','name'],abdRequests:['id','ref'],palletAccount:['id','_syncId'],vacations:['id','_syncId'],ideas:['id','_syncId'],customSops:['id','name','_syncId'],sops:['id','name','_syncId'],users:['id','user','login','username','name']};
const LOCAL_UI_KEYS=new Set(['view','q','taskSearch','taskFilter','taskDay','shipmentOverviewSearch','shipmentOverviewStatus','selectedCustomerId','shipment','activeShipmentId','sopId','sopStep','academyId','academyStep','quizAnswers','quizStep','language','rc438NotifySnoozeUntil','rc439SyncStatus','rc524OverviewPage','rc524OverviewPageSize','rc524OverviewSearch']);
function sameValue(a,b){if(a===b)return true;try{return JSON.stringify(a)===JSON.stringify(b)}catch(_){return false}}
function aliasValue(v){return lower(v).replace(/\s+/g,' ').replace(/[^a-z0-9äöüß|:_-]+/gi,'')}
function recordAliases(name,item,index){if(!item||typeof item!=='object')return ['index:'+index];const out=[];function add(prefix,v){v=aliasValue(v);const k=v?prefix+':'+v:'';if(k&&out.indexOf(k)<0)out.push(k)}if(name==='customers'){['account','customerNumber','kundennummer','customerNo','no','number','debtorNumber'].forEach(function(k){add('number',item[k])});['id','customerId','_syncId'].forEach(function(k){add('id',item[k])});const n=aliasValue(item.name||item.customerName||item.deliveryName);if(n){const country=aliasValue(item.country||item.land),postal=aliasValue(item.postalCode||item.zip||item.plz);add('name',[n,country,postal].filter(Boolean).join('|'));add('nameonly',n)}}else{(SYNC_COLLECTION_KEYS[name]||['id','_syncId']).forEach(function(k){add(k,item[k])})}return out.length?out:['index:'+index]}
function aliasesOverlap(a,b){const set=new Set(a),common=b.filter(function(x){return set.has(x)});if(common.some(function(x){return /^(?:number|id):/.test(x)}))return true;const an=a.filter(function(x){return x.indexOf('number:')===0}),bn=b.filter(function(x){return x.indexOf('number:')===0}),ai=a.filter(function(x){return x.indexOf('id:')===0}),bi=b.filter(function(x){return x.indexOf('id:')===0});if((an.length&&bn.length)||(ai.length&&bi.length))return false;return common.some(function(x){return x.indexOf('name:')===0})}
function recordKey(name,item,index){return recordAliases(name,item,index)[0]}
function recordId(name,item,index){const key=recordKey(name,item,index);return key.slice(key.indexOf(':')+1)}
function findBaseRecord(name,baseList,item,index){const wanted=recordAliases(name,item,index);return (Array.isArray(baseList)?baseList:[]).find(function(old,i){return aliasesOverlap(recordAliases(name,old,i),wanted)})||null}
function fieldMetaTime(item,key){const raw=item&&item._syncFields&&item._syncFields[key],v=isObject(raw)?raw.updatedAt:raw;return Date.parse(v||'')||0}
function mergeClientRecord(a,b,name){if(!a)return clone(b);if(!b)return clone(a);const out=clone(a),fields=new Set(Object.keys(a).concat(Object.keys(b)));fields.delete('_syncFields');const meta=Object.assign({},a._syncFields||{});fields.forEach(function(k){const av=a[k],bv=b[k],at=fieldMetaTime(a,k),bt=fieldMetaTime(b,k);if(bt>at||(bt===at&&(av===undefined||av===null||av==='')&&bv!==undefined&&bv!==null&&bv!==''))out[k]=clone(bv);if(bt>=at&&b._syncFields&&b._syncFields[k])meta[k]=clone(b._syncFields[k])});if(Object.keys(meta).length)out._syncFields=meta;const at=Date.parse(a._syncUpdatedAt||a.updatedAt||'')||0,bt=Date.parse(b._syncUpdatedAt||b.updatedAt||'')||0;out._syncUpdatedAt=bt>=at?(b._syncUpdatedAt||b.updatedAt||out._syncUpdatedAt):(a._syncUpdatedAt||a.updatedAt||out._syncUpdatedAt);return out}
function canonicalizeCustomers(state){if(!isObject(state)||!Array.isArray(state.customers))return false;const result=[];let changed=false;state.customers.forEach(function(customer,index){if(!customer||typeof customer!=='object')return;const aliases=recordAliases('customers',customer,index),matches=[];result.forEach(function(existing,i){if(aliasesOverlap(recordAliases('customers',existing,i),aliases))matches.push(i)});if(!matches.length){result.push(customer);return}let merged=result[matches[0]];for(let i=matches.length-1;i>=1;i--){merged=mergeClientRecord(merged,result[matches[i]],'customers');result.splice(matches[i],1)}merged=mergeClientRecord(merged,customer,'customers');result[matches[0]]=merged;changed=true});if(!changed)return false;state.customers=result;const aliasMap=new Map();result.forEach(function(c,i){recordAliases('customers',c,i).forEach(function(a){aliasMap.set(a,c)})});function resolve(record){if(!record||typeof record!=='object')return;const candidates=[record.customerId,record.customerAccount,record.customerNumber,record.kundennummer,record.customerName];let found=null;for(const value of candidates){const v=aliasValue(value);if(!v)continue;for(const prefix of ['id','number','nameonly']){if(aliasMap.has(prefix+':'+v)){found=aliasMap.get(prefix+':'+v);break}}if(found)break}if(!found)return;record.customerId=text(found.id||found.customerId||found.account||found.customerNumber);record.customerAccount=text(found.account||found.customerNumber||found.kundennummer||found.no);record.customerNumber=text(found.customerNumber||found.account||found.kundennummer||found.no);record.customerName=text(found.name||found.customerName||record.customerName)}(Array.isArray(state.shipments)?state.shipments:[]).forEach(resolve);(Array.isArray(state.abdRequests)?state.abdRequests:[]).forEach(resolve);resolve(state.shipment);const selected=text(state.selectedCustomerId);if(selected){const v=aliasValue(selected);const c=aliasMap.get('id:'+v)||aliasMap.get('number:'+v)||aliasMap.get('nameonly:'+v);if(c)state.selectedCustomerId=text(c.id||c.account||c.customerNumber||selected)}return true}
function stampRecord(base,item,now){if(!item||typeof item!=='object')return;const old=base&&typeof base==='object'?base:{};const meta=isObject(item._syncFields)?item._syncFields:{};let changed=false;for(const key of Object.keys(item)){if(key==='_syncFields'||key==='_syncUpdatedAt')continue;if(!sameValue(old[key],item[key])){meta[key]={updatedAt:now,deviceId:runtime.deviceId};changed=true}}if(!base){for(const key of Object.keys(item)){if(key!=='_syncFields'&&key!=='_syncUpdatedAt')meta[key]={updatedAt:now,deviceId:runtime.deviceId}}changed=true}if(changed){item._syncFields=meta;item._syncUpdatedAt=now}}
function stampCollection(name,baseList,currentList,now){(Array.isArray(currentList)?currentList:[]).forEach(function(item,index){stampRecord(findBaseRecord(name,baseList,item,index),item,now)})}
function stampChanges(baseState,currentState,baseUsers,currentUsers){const now=new Date().toISOString(),base=isObject(baseState)?baseState:{},current=isObject(currentState)?currentState:{};canonicalizeCustomers(current);const meta=current._teamSyncMeta||(current._teamSyncMeta={fields:{},tombstones:[]});meta.fields=isObject(meta.fields)?meta.fields:{};meta.tombstones=Array.isArray(meta.tombstones)?meta.tombstones:[];for(const key of Object.keys(current)){if(key==='_teamSyncMeta'||LOCAL_UI_KEYS.has(key))continue;if(Array.isArray(current[key]))stampCollection(key,base[key],current[key],now);else if(!sameValue(base[key],current[key]))meta.fields[key]={updatedAt:now,deviceId:runtime.deviceId}}stampCollection('users',baseUsers,currentUsers,now);return now}
function identityFor(name,item){const out={};(SYNC_COLLECTION_KEYS[name]||['id','_syncId']).forEach(function(k){if(item&&text(item[k]))out[k]=item[k]});if(name==='customers'){['kundennummer','customerNo','no','customerId'].forEach(function(k){if(item&&text(item[k]))out[k]=item[k]})}return out}
function changedRecord(name,base,item,index,updatedAt){const old=findBaseRecord(name,base,item,index);if(!old)return {identity:identityFor(name,item),full:clone(item),isNew:true,updatedAt:updatedAt,deviceId:runtime.deviceId};const fields={},fieldMeta={};for(const key of Object.keys(item)){if(key==='_syncFields'||key==='_syncUpdatedAt')continue;if(!sameValue(old[key],item[key])){fields[key]=clone(item[key]);fieldMeta[key]=clone(item._syncFields&&item._syncFields[key]||{updatedAt:updatedAt,deviceId:runtime.deviceId})}}if(!Object.keys(fields).length)return null;return {identity:identityFor(name,item),fields:fields,fieldMeta:fieldMeta,updatedAt:updatedAt,deviceId:runtime.deviceId}}
function buildChangeSet(baseState,currentState,baseUsers,currentUsers,updatedAt){const base=isObject(baseState)?baseState:{},current=isObject(currentState)?currentState:{},change={version:1,updatedAt:updatedAt,deviceId:runtime.deviceId,stateFields:{},collections:{},users:[]};for(const key of Object.keys(current)){if(key==='_teamSyncMeta'||LOCAL_UI_KEYS.has(key))continue;if(Array.isArray(current[key])){const patches=current[key].map(function(item,index){return changedRecord(key,base[key],item,index,updatedAt)}).filter(Boolean);if(patches.length)change.collections[key]=patches}else if(!sameValue(base[key],current[key]))change.stateFields[key]={value:clone(current[key]),updatedAt:updatedAt,deviceId:runtime.deviceId}}change.users=(Array.isArray(currentUsers)?currentUsers:[]).map(function(item,index){return changedRecord('users',baseUsers,item,index,updatedAt)}).filter(Boolean);return change}
function markDeleted(collection,id,extra){id=text(id);if(!id)return null;const state=window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():runtime.state||(runtime.state={});const meta=state._teamSyncMeta||(state._teamSyncMeta={fields:{},tombstones:[]});meta.tombstones=Array.isArray(meta.tombstones)?meta.tombstones:[];const now=new Date().toISOString(),key=lower(collection)+':'+lower(id);let found=false;meta.tombstones=meta.tombstones.map(function(item){if(item&&lower(item.collection)+':'+lower(item.id)===key){found=true;return Object.assign({},item,extra||{},{collection:collection,id:id,deletedAt:now,deletedBy:text(runtime.user&&(runtime.user.name||runtime.user.user)),deviceId:runtime.deviceId})}return item});if(!found)meta.tombstones.push(Object.assign({collection:collection,id:id,deletedAt:now,deletedBy:text(runtime.user&&(runtime.user.name||runtime.user.user)),deviceId:runtime.deviceId},extra||{}));runtime.dirty=true;return now}
function mutateObject(target,source,preserveLocal){if(!isObject(target)||!isObject(source))return;const preserved={};if(preserveLocal)LOCAL_UI_KEYS.forEach(function(key){if(Object.prototype.hasOwnProperty.call(target,key))preserved[key]=target[key]});Object.keys(target).forEach(function(key){if(!preserveLocal||!LOCAL_UI_KEYS.has(key))delete target[key]});Object.keys(source).forEach(function(key){if(!LOCAL_UI_KEYS.has(key))target[key]=clone(source[key])});Object.assign(target,preserved)}
function refreshCurrentUser(){const users=window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():runtime.users;const key=lower(runtime.user&&(runtime.user.user||runtime.user.login||runtime.user.name));const fresh=(Array.isArray(users)?users:[]).find(function(u){return lower(u.user||u.login||u.username||u.name)===key})||runtime.user;runtime.user=fresh;try{window.currentUser=fresh;if(typeof currentUser!=='undefined')currentUser=fresh}catch(_){}}
function applyRemoteDocument(doc,reason){if(!doc||!isObject(doc.state)||(runtime.saving&&reason!=='concurrent-merge'))return false;canonicalizeCustomers(doc.state);runtime.applyingRemote=true;try{const state=window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():runtime.state;if(isObject(state))mutateObject(state,doc.state,true);runtime.state=state||clone(doc.state);const targetUsers=window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():runtime.users;if(Array.isArray(targetUsers)){targetUsers.splice.apply(targetUsers,[0,targetUsers.length].concat((Array.isArray(doc.users)?doc.users:[]).map(clone)));runtime.users=targetUsers}else runtime.users=clone(doc.users||[]);runtime.revision=Number(doc.revision||runtime.revision);runtime.lastSnapshot=clone(doc.state);runtime.lastUsers=clone(doc.users||runtime.users);runtime.dirty=false;runtime.remoteApplyCount++;window.__CLEAN_BOOT_USERS__=runtime.users;refreshCurrentUser();if((window.ExportHUBRC538||window.ExportHUBRC532)&&typeof (window.ExportHUBRC538||window.ExportHUBRC532).restoreUsers==='function')(window.ExportHUBRC538||window.ExportHUBRC532).restoreUsers();if(typeof window.render==='function')window.render();setVersion();window.dispatchEvent(new CustomEvent('exporthub:sync',{detail:{revision:runtime.revision,reason:reason||'poll'}}));return true}finally{runtime.applyingRemote=false}}
async function pollRevision(){if(!runtime.ready||runtime.polling||runtime.saving||runtime.dirty||runtime.pendingSave)return;runtime.polling=true;runtime.lastPollAt=Date.now();try{runtime.network.metaGets++;const meta=await jsonFetch(API+'?meta=1');if(Number(meta.revision||0)>runtime.revision){runtime.network.stateGets++;const doc=await jsonFetch(API);applyRemoteDocument(doc,'revision-poll')}}catch(e){console.warn('Live-Synchronisierung pausiert',e.message)}finally{runtime.polling=false}}
function startRevisionPolling(){if(runtime.pollTimer)return;runtime.pollTimer=native.setInterval(pollRevision,3000);native.setTimeout(pollRevision,800)}
function ensureUserDisplay(){const name=text(runtime.user&&(runtime.user.name||runtime.user.user||runtime.user.login));const profile=document.querySelector('.profile');if(profile&&name&&!lower(profile.textContent).includes(lower(name))){let strong=profile.querySelector('strong');if(!strong){strong=document.createElement('strong');profile.prepend(strong)}strong.textContent=name}document.documentElement.setAttribute('data-exporthub-user',name)}
function nextFrame(){return new Promise(function(resolve){(native.requestAnimationFrame||native.setTimeout)(function(){resolve()},16)})}
async function signalReady(){progress(99,'Oberfläche wird abschließend geprüft …');ensureUserDisplay();setVersion();await nextFrame();await nextFrame();const app=by('app'),content=by('content');if(!app||app.classList.contains('hidden')||!content||!content.children.length)throw new Error('Die Oberfläche ist nach dem Erst-Render noch nicht bedienbar.');const info=by('saveInfo');if(info)info.textContent='Azure-Teamdaten geladen · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});hideProgress();await nextFrame();if(runtime.saveTimer)native.clearTimeout(runtime.saveTimer);runtime.saveTimer=null;runtime.pendingSave=false;runtime.dirty=false;runtime.lastSnapshot=clone(window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():runtime.state||{});runtime.lastUsers=clone(window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():runtime.users||[]);runtime.ready=true;runtime.acceptWritesAt=0;runtime.readyAt=new Date().toISOString();window.__EXPORTHUB_READY__={ready:true,version:VERSION,revision:runtime.revision,user:text(runtime.user&&(runtime.user.name||runtime.user.user)),readyAt:runtime.readyAt};window.dispatchEvent(new CustomEvent('exporthub:ready',{detail:window.__EXPORTHUB_READY__}));startRevisionPolling()}
window.ExportHUBSync={markDeleted:markDeleted,pollNow:pollRevision,applyRemote:applyRemoteDocument,stampChanges:stampChanges,buildChangeSet:buildChangeSet,canonicalizeCustomers:canonicalizeCustomers};

async function loadLegacy(){
 if(runtime.loaded)return;
 runtime.loading=true;
 const manifest=await (await native.fetch('assets/legacy-manifest.json',{cache:'no-store'})).json();
 progress(20,'Stabiler Kern wird vorbereitet …');
 await cleanYield(20);
 for(let i=0;i<manifest.length;i++){
  const entry=manifest[i],started=performance.now();
  progress(20+Math.round((i/manifest.length)*70),'Anwendungsbereiche werden geladen · stabiles Paket '+(i+1)+' von '+manifest.length);
  window.__cleanGroupPromise=null;
  await loadScript(entry.src);
  if(window.__cleanGroupPromise)await window.__cleanGroupPromise;
  quarantineLegacyBackground();
  runtime.moduleTimes.push({src:entry.src,ms:Math.round(performance.now()-started)});
  await cleanYield(8);
 }
 runtime.loaded=true;runtime.loading=false;
 progress(94,'Anmeldung und Oberfläche werden aktiviert …');
 await cleanYield(15);restoreAuthoritativeUsersBeforeLogin();activateLegacyLogin();await cleanYield(20);rc524FinalFixes();await rc524StyleHealth();await cleanYield(10);quarantineLegacyBackground();
 const discardedStartupTimers=runtime.timeoutJobs.size;runtime.timeoutJobs.clear();runtime.droppedStartupTimers+=discardedStartupTimers;
 const discardedObservers=runtime.observerRecords.size;runtime.observerRecords.forEach(function(o){o.active=false});runtime.observerRecords.clear();
 const discardedIntervals=runtime.intervalJobs.size;runtime.intervalJobs.clear();runtime.legacyTimersReady=false;runtime.intervalsArmed=false;runtime.blockLegacyBackground=true;
 try{if((window.ExportHUBRC538||window.ExportHUBRC532)&&typeof (window.ExportHUBRC538||window.ExportHUBRC532).install==='function')(window.ExportHUBRC538||window.ExportHUBRC532).install()}catch(e){console.error('RC540 Konsolidierung konnte nicht aktiviert werden',e);throw e}
 window.__EXPORTHUB_CLEAN_DIAGNOSTICS__={version:VERSION,moduleTimes:runtime.moduleTimes.slice(),skipped:runtime.skipped.slice(),discardedStartupTimers:discardedStartupTimers,droppedStartupTimersTotal:runtime.droppedStartupTimers,discardedLegacyObservers:discardedObservers,activeLegacyObservers:runtime.observerRecords.size,discardedLegacyIntervals:discardedIntervals,activeLegacyIntervals:runtime.intervalJobs.size,network:runtime.network};
 await signalReady();

}
function restoreAuthoritativeUsersBeforeLogin(){
 try{
  const target=window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():null;
  if(Array.isArray(target))target.splice.apply(target,[0,target.length].concat((runtime.users||[]).map(clone)));
  window.__CLEAN_BOOT_USERS__=(runtime.users||[]).map(clone);
  window.users=Array.isArray(target)?target:window.__CLEAN_BOOT_USERS__;
 }catch(e){console.error('Autoritative Benutzer konnten vor Login nicht übernommen werden',e)}
}
function activateLegacyLogin(){const u=by('loginUser'),p=by('loginPass'),btn=by('loginBtn');if(u)u.value=runtime.user.user||runtime.user.login||runtime.user.name||'';if(p)p.value=runtime.user.password||'';try{runtime.activatingLegacy=true;if(typeof window.rc430StrictLogin==='function')window.rc430StrictLogin();else if(btn&&typeof btn.onclick==='function')btn.onclick.call(btn,new Event('click'))}catch(e){console.error(e)}finally{runtime.activatingLegacy=false}const login=by('login'),app=by('app');if(login)login.classList.add('hidden');if(app)app.classList.remove('hidden');setVersion();native.setTimeout(setVersion,250)}

async function queueSave(reason){if(!runtime.ready||runtime.loading||!runtime.loaded||runtime.applyingRemote)return;runtime.lastQueueReason=String(reason||'');runtime.lastQueueAt=Date.now();try{runtime.lastQueueStack=(new Error('queueSave')).stack||''}catch(_){runtime.lastQueueStack=''}runtime.dirty=true;runtime.pendingSave=true;if(runtime.saveTimer)native.clearTimeout(runtime.saveTimer);runtime.saveTimer=native.setTimeout(function(){flushSave(reason)},700)}
async function flushSave(reason){
 if(!runtime.ready||runtime.loading||!runtime.loaded||runtime.applyingRemote||!runtime.pendingSave)return false;
 if(runtime.saving){runtime.pendingSave=true;return}
 const getState=window.__EXPORTHUB_GET_STATE__,getUsers=window.__EXPORTHUB_GET_USERS__;if(typeof getState!=='function')return;
 runtime.saving=true;runtime.pendingSave=false;const info=by('saveInfo');if(info)info.textContent='Speicherung in Azure läuft …';
 try{
  const state=getState(),users=typeof getUsers==='function'?getUsers():runtime.users;canonicalizeCustomers(state);const changedAt=stampChanges(runtime.lastSnapshot||{},state,runtime.lastUsers||[],users);const changes=buildChangeSet(runtime.lastSnapshot||{},state,runtime.lastUsers||[],users,changedAt);
  const payload={clientVersion:VERSION,baseRevision:runtime.revision,deviceId:runtime.deviceId,reason:reason||'save',state:state,users:users,changes:changes};runtime.network.posts++;
  const d=await jsonFetch(API+'?ack=1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  runtime.revision=Number(d.revision||runtime.revision);runtime.lastSnapshot=clone(state);runtime.lastUsers=clone(users);runtime.dirty=false;
  if(d.state&&d.users)applyRemoteDocument(d,'concurrent-merge');
  if(info)info.textContent=(d.concurrentMerge?'Paralleländerungen feldweise zusammengeführt · ':d.serverAdjusted?'Kundendaten zusammengeführt · ':'Dauerhaft in Azure gespeichert · ')+new Date().toLocaleTimeString('de-DE');
 }catch(e){runtime.dirty=true;if(info)info.textContent='Nicht gespeichert: '+e.message;alert(e.code==='LAST_ADMIN_PROTECTED'?e.message:'Die Änderung konnte nicht dauerhaft in Azure gespeichert werden.\n\n'+e.message)}
 finally{runtime.saving=false;if(runtime.pendingSave)queueSave('queued')}
}

async function login(){
 if(runtime.loading||runtime.activatingLegacy)return;
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

window.ExportHUBClean={VERSION:VERSION,BUILD:BUILD,runScripts:runScripts,queueSave:queueSave,flushSave:flushSave,pollRevision:pollRevision,applyRemoteDocument:applyRemoteDocument,native:native,runtime:runtime};
window.__EXPORTHUB_RC439_TEAM_SYNC__=true;
window.__EXPORTHUB_RC467__=true;
window.__EXPORTHUB_RC466_MEMORY_STORAGE__=true;
window.addEventListener('error',function(e){console.error('ExportHUB Clean Fehler',e.error||e.message)});

document.addEventListener('DOMContentLoaded',async function(){
 await rc524StyleHealth();setVersion();bindMicrosoftControls();bindLogin();setLoginEnabled(false);
 const app=by('app'),loginBox=by('login');if(app)app.classList.add('hidden');if(loginBox)loginBox.classList.remove('hidden');
 const p=await loadMicrosoft();
 if(!p){status('Bitte zuerst mit dem Microsoft-Konto anmelden.','');return}
 status('ExportHUB-Benutzer werden geladen …','');
 try{await loadUsers();setLoginEnabled(true);status('Anmeldung bereit.','ok')}
 catch(e){setLoginEnabled(false);status('Benutzer konnten nicht geladen werden: '+e.message,'bad')}
});
})();
