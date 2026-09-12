// ExportHUB RC1065 finaler Runtime-Marker; autoritativer Produktionsrelease bleibt RC1048.
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1065_REGISTRATION_CC__)return;
w.__EXPORTHUB_RC1065_REGISTRATION_CC__=true;

var REQUIRED=Object.freeze(['Sevastian Marcu','Daniel Ollmann']);

function q(v){return String(v==null?'':v).trim()}
function norm(v){return q(v).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function mail(v){var m=q(v).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);return m?m[0]:''}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function configured(){
 var s=state(),raw=(s.settings&&s.settings.registrationMandatoryCc)||s.registrationMandatoryCc||w.__EXPORTHUB_REGISTRATION_CC__,out=[];
 (Array.isArray(raw)?raw:[]).forEach(function(x){
  if(typeof x==='string'){var e=mail(x);if(e)out.push({name:'',email:e});return}
  if(x&&typeof x==='object'){var e=mail(x.email||x.mail||x.emailAddress||x.userPrincipalName||x.upn),n=q(x.name||x.displayName||x.fullName);if(e)out.push({name:n,email:e})}
 });
 return out
}
function candidates(){
 var s=state(),lists=[s.users,s.userAccounts,s.accounts,s.members,s.employees,s.staff,s.people,s.directoryUsers],out=[];
 lists.forEach(function(list){if(Array.isArray(list))list.forEach(function(x){if(x&&typeof x==='object')out.push(x)})});
 return out
}
function nameOf(x){return q(x&&(x.name||x.displayName||x.fullName||([x.firstName,x.lastName].filter(Boolean).join(' '))||x.userName||x.username))}
function emailOf(x){return mail(x&&(x.email||x.mail||x.emailAddress||x.userPrincipalName||x.upn||x.login))}
function resolve(){
 var cfg=configured(),rows=candidates(),addresses=[],missing=[];
 REQUIRED.forEach(function(required){
  var key=norm(required),found=cfg.find(function(x){return norm(x.name)===key})||rows.find(function(x){return norm(nameOf(x))===key}),e=found&&emailOf(found)||'';
  if(e)addresses.push(e);else missing.push(required)
 });
 return{ok:missing.length===0,addresses:Array.from(new Set(addresses.map(function(x){return x.toLowerCase()}))),missing:missing}
}
function isRegistration(url){
 var raw=q(url);if(!/^mailto:/i.test(raw))return false;
 var decoded=raw;try{decoded=decodeURIComponent(raw.replace(/\+/g,' '))}catch(_){}
 return /anmeld|abhol|lieferavis|collection\s+notice|pickup|sendung|shipment/i.test(decoded)
}
function prepare(url){
 var raw=q(url);if(!isRegistration(raw))return{ok:true,url:raw,required:false,missing:[]};
 var r=resolve();if(!r.ok)return{ok:false,url:raw,required:true,missing:r.missing};
 var parts=raw.split('?'),params=new URLSearchParams(parts.slice(1).join('?')),existing=q(params.get('cc')).split(/[;,]/).map(mail).filter(Boolean);
 r.addresses.forEach(function(x){if(!existing.some(function(y){return y.toLowerCase()===x.toLowerCase()}))existing.push(x)});
 params.set('cc',existing.join(';'));
 return{ok:true,url:parts[0]+'?'+params.toString(),required:true,missing:[]}
}
function block(p){
 var names=(p&&p.missing||[]).join(', '),msg='Anmeldung nicht geöffnet: Pflicht-CC konnte nicht aus den ExportHUB-Benutzerdaten aufgelöst werden'+(names?': '+names:'')+'. Bitte die E-Mail-Adresse im Benutzerstamm pflegen.';
 try{w.alert(msg)}catch(_){}
 return false
}
if(w.document&&w.document.addEventListener)w.document.addEventListener('click',function(ev){
 var a=ev.target&&ev.target.closest&&ev.target.closest('a[href^="mailto:"]');if(!a)return;
 var p=prepare(a.getAttribute('href'));if(!p.ok){ev.preventDefault();ev.stopImmediatePropagation();block(p);return}
 if(p.url!==a.getAttribute('href'))a.setAttribute('href',p.url)
},true);
var nativeOpen=typeof w.open==='function'?w.open.bind(w):null;
if(nativeOpen)w.open=function(url,target,features){var p=prepare(url);if(!p.ok){block(p);return null}return nativeOpen(p.url,target,features)};

function currentUser(){
 try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function')return w.__EXPORTHUB_GET_CURRENT_USER__()||{}}catch(_){}
 try{if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user)return w.ExportHUBClean.runtime.user}catch(_){}
 var s=state();return s.currentUser||s.user||{}
}
function globalAdmin(){
 var u=currentUser()||{},role=norm(u.role||u.rolle||u.level||u.type),perms=Array.isArray(u.permissions)?u.permissions:[];
 return u.globalAdmin===true||u.isGlobalAdmin===true||u.isAdmin===true||u.admin===true||perms.indexOf('*')>=0||/global admin|globaler administrator|globaler admin|administrator|vollzugriff/.test(role)
}
function viewName(){
 var s=state(),v=q(s.view||s.currentView||s.activeView||s.page||'');
 if(v)return norm(v);
 try{
  var active=w.document&&w.document.querySelector&&w.document.querySelector('[data-view].active,[data-view][aria-current="page"]');
  if(active)return norm(active.getAttribute('data-view')||active.textContent)
 }catch(_){}
 return''
}
function settingsVisible(){var v=viewName();return v==='settings'||v==='einstellungen'||/\bsettings\b|\beinstellungen\b/.test(v)}
function configuredEmail(name){
 var key=norm(name),row=configured().find(function(x){return norm(x.name)===key});
 return row&&row.email||''
}
function ccSettingsStatus(node,text,kind){
 if(!node)return;
 node.textContent=text||'';
 node.setAttribute('data-kind',kind||'info')
}
async function persistCcSettings(next){
 var s=state();s.settings=s.settings&&typeof s.settings==='object'?s.settings:{};
 var previous=s.settings.registrationMandatoryCc;
 s.settings.registrationMandatoryCc=next;
 try{
  var clean=w.ExportHUBClean;
  if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error('Die Azure-Speicherung ist noch nicht verfügbar.');
  await clean.queueSave('Pflicht-CC Anmeldung gespeichert');
  var ok=await clean.flushSave('Pflicht-CC Anmeldung gespeichert',{force:true,userInitiated:true});
  if(ok!==true)throw new Error('Die Azure-Speicherung wurde nicht bestätigt.');
  try{w.dispatchEvent(new CustomEvent('exporthub:registration-cc-updated',{detail:{required:REQUIRED.slice()}}))}catch(_){}
  return true
 }catch(e){
  if(previous===undefined)delete s.settings.registrationMandatoryCc;else s.settings.registrationMandatoryCc=previous;
  throw e
 }
}
function ensureCcStyle(){
 if(!w.document||w.document.getElementById('rc1065RegistrationCcStyle'))return;
 var style=w.document.createElement('style');style.id='rc1065RegistrationCcStyle';
 style.textContent='.rc1065-cc-settings{margin-top:16px}.rc1065-cc-settings .rc1065-cc-grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:12px}.rc1065-cc-settings label{display:grid;gap:6px;font-weight:700}.rc1065-cc-settings input{min-height:42px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px}.rc1065-cc-settings .rc1065-cc-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}.rc1065-cc-settings [data-kind="error"]{color:#b91c1c}.rc1065-cc-settings [data-kind="ok"]{color:#166534}@media(max-width:720px){.rc1065-cc-settings .rc1065-cc-grid{grid-template-columns:1fr}}';
 (w.document.head||w.document.documentElement).appendChild(style)
}
function installSettings(){
 if(!w.document||!w.document.body)return false;
 var old=w.document.getElementById('rc1065RegistrationCcSettings');
 if(!globalAdmin()||!settingsVisible()){if(old&&old.parentNode)old.parentNode.removeChild(old);return false}
 if(old)return true;
 var host=w.document.getElementById('content')||w.document.querySelector('main')||w.document.body;
 if(!host)return false;
 ensureCcStyle();
 var box=w.document.createElement('section');box.id='rc1065RegistrationCcSettings';box.className='card rc1065-cc-settings';
 box.innerHTML='<div><span class="pill blue">ANMELDUNG</span><h3>Pflicht-CC</h3><p>Diese beiden Empfänger werden bei jeder Sendungsanmeldung automatisch in CC gesetzt. Ohne vollständig gepflegte Adressen wird die Anmeldung nicht geöffnet.</p></div><div class="rc1065-cc-grid"><label>Sevastian Marcu<input type="email" autocomplete="off" data-rc1065-cc="sevastian" placeholder="E-Mail-Adresse"></label><label>Daniel Ollmann<input type="email" autocomplete="off" data-rc1065-cc="daniel" placeholder="E-Mail-Adresse"></label></div><div class="rc1065-cc-actions"><button type="button" class="btn" data-rc1065-cc-save>Pflicht-CC speichern</button><span data-rc1065-cc-status></span></div>';
 host.appendChild(box);
 var sev=box.querySelector('[data-rc1065-cc="sevastian"]'),dan=box.querySelector('[data-rc1065-cc="daniel"]'),status=box.querySelector('[data-rc1065-cc-status]'),save=box.querySelector('[data-rc1065-cc-save]');
 if(sev)sev.value=configuredEmail(REQUIRED[0]);
 if(dan)dan.value=configuredEmail(REQUIRED[1]);
 ccSettingsStatus(status,(sev&&sev.value&&dan&&dan.value)?'Beide Pflicht-CC-Adressen sind gepflegt.':'Bitte beide Pflicht-CC-Adressen pflegen.','info');
 if(save)save.addEventListener('click',async function(){
  var a=mail(sev&&sev.value),b=mail(dan&&dan.value);
  if(!a||!b){ccSettingsStatus(status,'Bitte für Sevastian Marcu und Daniel Ollmann jeweils eine gültige E-Mail-Adresse eintragen.','error');return}
  save.disabled=true;ccSettingsStatus(status,'Wird dauerhaft gespeichert …','info');
  try{
   await persistCcSettings([{name:REQUIRED[0],email:a},{name:REQUIRED[1],email:b}]);
   if(sev)sev.value=a;if(dan)dan.value=b;
   ccSettingsStatus(status,'Pflicht-CC wurde dauerhaft gespeichert.','ok')
  }catch(e){ccSettingsStatus(status,'Speichern fehlgeschlagen: '+q(e&&e.message||e),'error')}
  finally{save.disabled=false}
 });
 return true
}
function scheduleSettings(){try{if(typeof w.setTimeout==='function')w.setTimeout(installSettings,0);else installSettings()}catch(_){}}
if(w.addEventListener){
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(name){w.addEventListener(name,scheduleSettings)});
 w.addEventListener('click',scheduleSettings,true)
}
if(w.document){
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',scheduleSettings,{once:true});else scheduleSettings()
}

w.ExportHUBRC1065RegistrationCC=Object.freeze({version:'RC1065',required:REQUIRED.slice(),resolve:resolve,isRegistration:isRegistration,prepare:prepare,installSettings:installSettings,persistCcSettings:persistCcSettings});
})(window);
