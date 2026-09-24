// ExportHUB RC1079 – eigener Anzeigename jederzeit in den Einstellungen änderbar.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1079_PROFILE_SETTINGS__)return;
w.__EXPORTHUB_RC1079_PROFILE_SETTINGS__=true;

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLowerCase()}
var SUPPORTED_LANGUAGES=['de','en','pl','es','fr','it'];
function normalizeLanguage(v){var x=low(v).replace('_','-'),m=x.match(/^(de|en|pl|es|fr|it)(?:-|$)/);return m?m[1]:'de'}
function tr(key){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key)}catch(_){}return key}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function user(){
 try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}
 try{if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user)return w.ExportHUBClean.runtime.user}catch(_){}
 var s=state();return s.currentUser||s.activeUser||s.user||{}
}
function view(){var s=state();return low(s.view||s.currentView||s.activeView||s.page||'')}
function visible(){var v=view();return v==='settings'||v==='einstellungen'||/settings|einstellungen/.test(v)}
function token(){
 try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},t=q(rt.authToken||rt.token||rt.sessionToken);if(t)return t}catch(_){}
 try{
   var raw=w.sessionStorage&&w.sessionStorage.getItem('exporthub_rc301_tab_session');
   if(raw){var x=JSON.parse(raw);if(x&&x.token)return q(x.token)}
 }catch(_){}
 try{
   for(var i=0;w.sessionStorage&&i<w.sessionStorage.length;i++){
     var k=w.sessionStorage.key(i),r=w.sessionStorage.getItem(k);if(!r||r.charAt(0)!=='{')continue;
     var x=JSON.parse(r);if(x&&x.token&&x.user)return q(x.token)
   }
 }catch(_){}
 return''
}
function headers(){var t=token(),h={'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache'};if(t){h['X-ExportHUB-Token']=t;h['X-ExportHUB-Session']=t;h.Authorization='Bearer '+t}return h}
function status(box,msg,kind){var n=box&&box.querySelector('[data-rc1079-status]');if(!n)return;n.textContent=msg||'';n.setAttribute('data-kind',kind||'info')}
async function saveProfile(name,language){
 language=normalizeLanguage(language);
 var response=await w.fetch('/api/exporthub-auth',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify({action:'update-profile',name:name,language:language})});
 var text=await response.text(),data={};try{data=text?JSON.parse(text):{}}catch(_){data={message:text}}
 if(!response.ok||data.ok===false){var e=new Error(q(data.message)||('HTTP '+response.status));e.code=q(data.code);throw e}
 return data
}
function syncUser(next){
 if(!next)return;
 var name=q(next.name||next.displayName),language=normalizeLanguage(next.language),id=q(next.id),username=q(next.user||next.username||next.login);
 try{
   if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user){
     w.ExportHUBClean.runtime.user.name=name;
     w.ExportHUBClean.runtime.user.displayName=name;
     w.ExportHUBClean.runtime.user.language=language
   }
 }catch(_){}
 var s=state();
 ['currentUser','activeUser','user'].forEach(function(k){var u=s&&s[k];if(u&&(!id||q(u.id)===id||(!q(u.id)&&q(u.user||u.username||u.login)===username))){u.name=name;u.displayName=name;u.language=language}});
 if(Array.isArray(s.users))s.users.forEach(function(u){if(u&&((id&&q(u.id)===id)||(username&&q(u.user||u.username||u.login)===username))){u.name=name;u.displayName=name;u.language=language}});
 try{
   for(var i=0;w.sessionStorage&&i<w.sessionStorage.length;i++){
     var key=w.sessionStorage.key(i),raw=w.sessionStorage.getItem(key);if(!raw||raw.charAt(0)!=='{')continue;
     var x=JSON.parse(raw);if(!x||!x.user)continue;
     var match=(id&&q(x.user.id)===id)||(username&&q(x.user.user||x.user.username||x.user.login)===username);
     if(match){x.user.name=name;x.user.displayName=name;x.user.language=language;w.sessionStorage.setItem(key,JSON.stringify(x))}
   }
 }catch(_){}
 try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.setLanguage==='function')w.ExportHUBI18n.setLanguage(language);else if(typeof w.rc455SetLanguage==='function')w.rc455SetLanguage(language);else if(typeof w.setLanguage==='function')w.setLanguage(language)}catch(_){}
 try{w.dispatchEvent(new CustomEvent('exporthub:user-profile-updated',{detail:{user:next}}))}catch(_){}
}
function applyProfileLanguage(){
 var u=user();if(!u)return false;var language=normalizeLanguage(u.language);
 try{var current=w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'?w.ExportHUBI18n.language():(w.__rc455I18nTest&&typeof w.__rc455I18nTest.language==='function'?w.__rc455I18nTest.language():'');if(current!==language){if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.setLanguage==='function')w.ExportHUBI18n.setLanguage(language);else if(typeof w.rc455SetLanguage==='function')w.rc455SetLanguage(language);else if(typeof w.setLanguage==='function')w.setLanguage(language)}}catch(_){}
 return language
}
function ensureStyle(){
 if(d.getElementById('rc1079ProfileStyle'))return;
 var s=d.createElement('style');s.id='rc1079ProfileStyle';
 s.textContent='.rc1079-profile{margin-top:16px}.rc1079-profile-grid{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(220px,1fr) minmax(150px,.6fr) auto;gap:12px;align-items:end}.rc1079-profile label{display:grid;gap:5px;font-weight:700}.rc1079-profile input,.rc1079-profile select{min-height:42px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.rc1079-profile input[readonly]{background:#f8fafc;color:#64748b}.rc1079-profile [data-kind="ok"]{color:#166534}.rc1079-profile [data-kind="error"]{color:#b91c1c}.rc1079-profile [data-kind="info"]{color:#475569}.rc1079-profile .rc1079-note{margin-top:8px;font-size:12px;color:#64748b}@media(max-width:900px){.rc1079-profile-grid{grid-template-columns:1fr 1fr}}@media(max-width:720px){.rc1079-profile-grid{grid-template-columns:1fr}}';
 (d.head||d.documentElement).appendChild(s)
}
function install(){
 var old=d.getElementById('rc1079ProfileSettings');
 if(!visible()){if(old)old.remove();return false}
 var u=user();if(!u||!q(u.id||u.user||u.username||u.login)){if(old)old.remove();return false}
 if(old){
   var nameField=old.querySelector('[data-rc1079-name]');if(nameField&&d.activeElement!==nameField)nameField.value=q(u.name||u.displayName||u.user||u.username||u.login);
   var languageField=old.querySelector('[data-rc1079-language]');if(languageField&&d.activeElement!==languageField)languageField.value=normalizeLanguage(u.language);
   applyProfileLanguage();return true
 }
 ensureStyle();
 var host=d.getElementById('content')||d.querySelector('main')||d.body;if(!host)return false;
 var box=d.createElement('section');box.id='rc1079ProfileSettings';box.className='card rc1079-profile';
 box.innerHTML='<div><span class="pill blue">'+tr('profile.badge')+'</span><h3>'+tr('profile.title')+'</h3><p>'+tr('profile.help')+'</p></div><div class="rc1079-profile-grid"><label><span>'+tr('profile.username')+'</span><input data-rc1079-user readonly></label><label><span>'+tr('profile.displayName')+'</span><input data-rc1079-name maxlength="80" autocomplete="name"></label><label><span>'+tr('profile.programLanguage')+'</span><select data-rc1079-language aria-label="'+tr('profile.programLanguage')+'"><option value="de">Deutsch</option><option value="en">English</option><option value="pl">Polski</option><option value="es">Español</option><option value="fr">Français</option><option value="it">Italiano</option></select></label><button type="button" class="btn" data-rc1079-save>'+tr('profile.save')+'</button></div><div class="rc1079-note">'+tr('profile.note')+'</div><div data-rc1079-status></div>'
 host.appendChild(box);
 box.querySelector('[data-rc1079-user]').value=q(u.user||u.username||u.login);
 box.querySelector('[data-rc1079-name]').value=q(u.name||u.displayName||u.user||u.username||u.login);
 box.querySelector('[data-rc1079-language]').value=normalizeLanguage(u.language);
 applyProfileLanguage();
 box.querySelector('[data-rc1079-save]').addEventListener('click',async function(){
   var btn=this,input=box.querySelector('[data-rc1079-name]'),languageInput=box.querySelector('[data-rc1079-language]'),name=q(input.value).replace(/\s+/g,' ').slice(0,80),language=normalizeLanguage(languageInput&&languageInput.value);
   if(!name){status(box,tr('profile.displayNameRequired'),'error');return}
   btn.disabled=true;status(box,tr('profile.saving'),'info');
   try{
     var data=await saveProfile(name,language);syncUser(data.user);input.value=q(data.user&&data.user.name)||name;if(languageInput)languageInput.value=normalizeLanguage(data.user&&data.user.language);
     status(box,tr('profile.saved'),'ok')
   }catch(e){status(box,tr('profile.saveFailed')+': '+q(e&&e.message||e),'error')}
   finally{btn.disabled=false}
 });
 return true
}
function schedule(){try{w.setTimeout(install,0)}catch(_){}}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:user-profile-updated','exporthub:language-changed'].forEach(function(n){try{w.addEventListener(n,function(){applyProfileLanguage();schedule()})}catch(_){}});
try{d.addEventListener('click',function(){schedule()},true)}catch(_){}
try{w.addEventListener('change',function(e){var el=e&&e.target;if(!el||el.id!=='languageSelect')return;var u=user();if(!u||!q(u.id||u.user||u.username||u.login))return;var language=normalizeLanguage(el.value),name=q(u.name||u.displayName||u.user||u.username||u.login);saveProfile(name,language).then(function(data){syncUser(data.user)}).catch(function(){})},true)}catch(_){}
w.ExportHUBRC1079Profile=Object.freeze({version:'RC1100',install:install,saveProfile:saveProfile,saveName:function(name){return saveProfile(name,(user()||{}).language||'de')},syncUser:syncUser,applyProfileLanguage:applyProfileLanguage});
})(window,document);
