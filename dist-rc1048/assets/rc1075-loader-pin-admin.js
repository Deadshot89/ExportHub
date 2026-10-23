// ExportHUB RC1075 – Verlader-PIN Verwaltung für globale Administratoren.
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1075_LOADER_PIN_ADMIN__)return;
w.__EXPORTHUB_RC1075_LOADER_PIN_ADMIN__=true;

var ENDPOINT='/api/loader-pins-admin';

function q(v){return String(v==null?'':v).trim()}
function tr(key,vars){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars)}catch(_){}return key}
function norm(v){return q(v).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function currentUser(){
 try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function')return w.__EXPORTHUB_GET_CURRENT_USER__()||{}}catch(_){}
 try{if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user)return w.ExportHUBClean.runtime.user}catch(_){}
 var s=state();return s.currentUser||s.user||{}
}
function globalAdmin(){
 var u=currentUser()||{},role=norm(u.role||u.rolle||u.level||u.type),perms=Array.isArray(u.permissions)?u.permissions:[],
     roles=['global admin','globaler administrator','globaler admin','administrator','admin','vollzugriff'];
 return u.globalAdmin===true||u.isGlobalAdmin===true||perms.indexOf('*')>=0||roles.indexOf(role)>=0
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
function sessionToken(){
 try{
  var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},direct=q(rt.authToken||rt.token||rt.sessionToken);
  if(direct)return direct
 }catch(_){}
 try{
  var raw=w.sessionStorage&&w.sessionStorage.getItem('exporthub_rc301_tab_session');
  if(raw){var x=JSON.parse(raw);var token=q(x&&x.token);if(token)return token}
 }catch(_){}
 try{
  for(var i=0;w.sessionStorage&&i<w.sessionStorage.length;i++){
   var k=w.sessionStorage.key(i),r=w.sessionStorage.getItem(k);if(!r||r.charAt(0)!=='{')continue;
   var x=JSON.parse(r),token=q(x&&x.token);if(token&&x.user)return token
  }
 }catch(_){}
 return''
}
function headers(){
 var token=sessionToken(),h={'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache'};
 if(token){h['X-ExportHUB-Token']=token;h['X-ExportHUB-Session']=token;h.Authorization='Bearer '+token}
 return h
}
async function call(action,payload){
 var body=Object.assign({},payload||{},{action:action});
 var response=await w.fetch(ENDPOINT,{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify(body)});
 var text=await response.text(),data={};try{data=text?JSON.parse(text):{}}catch(_){data={message:text}}
 if(!response.ok||data.ok===false){var e=new Error(q(data.message)||('HTTP '+response.status));e.status=response.status;e.code=q(data.code);throw e}
 return data
}
function validPin(v){return /^\d{4}$/.test(q(v))}
function status(node,message,kind,key,vars){
 if(!node)return;
 node.textContent=key?tr(key,vars):(message||'');
 node.setAttribute('data-kind',kind||'info');
 if(key){node.setAttribute('data-rc1075-status-key',key);try{node.setAttribute('data-rc1075-status-vars',JSON.stringify(vars||{}))}catch(_){}}
 else{node.removeAttribute('data-rc1075-status-key');node.removeAttribute('data-rc1075-status-vars')}
}
function statusKey(node,key,vars,kind){status(node,'',kind,key,vars)}
function mutationStatus(box,data,successKey){
 var node=box&&box.querySelector('[data-rc1075-status]');
 if(data&&data.auditStored===false){statusKey(node,'loaderPin.auditWarning',null,'warning');return false}
 statusKey(node,successKey,null,'ok');return true
}
function refreshLanguage(){
 if(!w.document)return;
 var box=w.document.getElementById('rc1075LoaderPinAdmin');if(!box)return;
 Array.prototype.forEach.call(box.querySelectorAll('[data-i18n]'),function(node){var key=q(node.getAttribute('data-i18n'));if(key)node.textContent=tr(key)});
 Array.prototype.forEach.call(box.querySelectorAll('[data-i18n-placeholder]'),function(node){var key=q(node.getAttribute('data-i18n-placeholder'));if(key)node.placeholder=tr(key)});
 var node=box.querySelector('[data-rc1075-status]'),key=node&&q(node.getAttribute('data-rc1075-status-key'));if(key){var vars={};try{vars=JSON.parse(node.getAttribute('data-rc1075-status-vars')||'{}')}catch(_){}node.textContent=tr(key,vars)}
}

function ensureStyle(){
 if(!w.document||w.document.getElementById('rc1075LoaderPinAdminStyle'))return;
 var style=w.document.createElement('style');style.id='rc1075LoaderPinAdminStyle';
 style.textContent='.rc1075-pin-admin{margin-top:16px}.rc1075-pin-admin .rc1075-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.rc1075-pin-admin .rc1075-new{display:grid;grid-template-columns:minmax(180px,1fr) 140px auto;gap:10px;align-items:end;margin:14px 0}.rc1075-pin-admin label{display:grid;gap:5px;font-weight:700}.rc1075-pin-admin input{min-height:42px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px}.rc1075-pin-admin .rc1075-list{display:grid;gap:8px}.rc1075-pin-admin .rc1075-row{display:grid;grid-template-columns:minmax(180px,1fr) 140px auto auto auto;gap:8px;align-items:center;padding:10px;border:1px solid #dbe7f1;border-radius:12px;background:#f8fafc}.rc1075-pin-admin .rc1075-row[data-inactive="true"]{opacity:.68}.rc1075-pin-admin .rc1075-pin-wrap{display:flex;gap:6px}.rc1075-pin-admin .rc1075-pin-wrap input{min-width:0;width:100%}.rc1075-pin-admin .rc1075-mini{min-height:42px;padding:8px 10px}.rc1075-pin-admin .rc1075-empty{padding:12px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b}.rc1075-pin-admin [data-kind="error"]{color:#b91c1c}.rc1075-pin-admin [data-kind="warning"]{color:#92400e}.rc1075-pin-admin [data-kind="ok"]{color:#166534}.rc1075-pin-admin [data-kind="info"]{color:#475569}.rc1075-pin-admin .rc1075-note{font-size:12px;color:#64748b;margin-top:8px}@media(max-width:900px){.rc1075-pin-admin .rc1075-row{grid-template-columns:1fr 130px auto}.rc1075-pin-admin .rc1075-row .rc1075-active{grid-column:1/2}.rc1075-pin-admin .rc1075-row .rc1075-delete{grid-column:3/4}.rc1075-pin-admin .rc1075-new{grid-template-columns:1fr 130px}}@media(max-width:620px){.rc1075-pin-admin .rc1075-new,.rc1075-pin-admin .rc1075-row{grid-template-columns:1fr}.rc1075-pin-admin .rc1075-row .rc1075-active,.rc1075-pin-admin .rc1075-row .rc1075-delete{grid-column:auto}}';
 (w.document.head||w.document.documentElement).appendChild(style)
}
function makeButton(key,cls){var b=w.document.createElement('button');b.type='button';b.className=cls||'btn';b.setAttribute('data-i18n',key);b.textContent=tr(key);return b}
function makePinField(value){
 var wrap=w.document.createElement('div');wrap.className='rc1075-pin-wrap';
 var input=w.document.createElement('input');input.type='password';input.inputMode='numeric';input.maxLength=4;input.autocomplete='off';input.value=q(value);input.setAttribute('data-i18n-placeholder','loaderPin.pinPlaceholder');input.placeholder=tr('loaderPin.pinPlaceholder');
 input.addEventListener('input',function(){input.value=input.value.replace(/\D/g,'').slice(0,4)});
 var reveal=makeButton('loaderPin.show','btn secondary rc1075-mini');reveal.setAttribute('aria-pressed','false');
 reveal.addEventListener('click',function(){var show=input.type==='password';input.type=show?'text':'password';var key=show?'loaderPin.hide':'loaderPin.show';reveal.setAttribute('data-i18n',key);reveal.textContent=tr(key);reveal.setAttribute('aria-pressed',show?'true':'false')});
 wrap.appendChild(input);wrap.appendChild(reveal);return{wrap:wrap,input:input}
}
function renderRows(box,pins){
 var list=box.querySelector('[data-rc1075-list]');if(!list)return;list.innerHTML='';
 if(!Array.isArray(pins)||!pins.length){var empty=w.document.createElement('div');empty.className='rc1075-empty';empty.setAttribute('data-i18n','loaderPin.empty');empty.textContent=tr('loaderPin.empty');list.appendChild(empty);return}
 pins.forEach(function(row){
  var item=w.document.createElement('div');item.className='rc1075-row';item.setAttribute('data-inactive',row.active===false?'true':'false');
  var name=w.document.createElement('input');name.value=q(row.name);name.setAttribute('data-i18n-placeholder','loaderPin.namePlaceholder');name.placeholder=tr('loaderPin.namePlaceholder');name.autocomplete='off';
  var pin=makePinField(row.pin);
  var activeLabel=w.document.createElement('label');activeLabel.className='rc1075-active';activeLabel.style.display='flex';activeLabel.style.alignItems='center';activeLabel.style.gap='7px';
  var active=w.document.createElement('input');active.type='checkbox';active.checked=row.active!==false;active.style.minHeight='0';activeLabel.appendChild(active);var activeText=w.document.createElement('span');activeText.setAttribute('data-i18n','loaderPin.active');activeText.textContent=tr('loaderPin.active');activeLabel.appendChild(activeText);
  var save=makeButton('loaderPin.save','btn rc1075-mini'),del=makeButton('loaderPin.delete','btn secondary rc1075-mini rc1075-delete');
  save.addEventListener('click',async function(){
   if(!q(name.value)){statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.nameRequired',null,'error');return}
   if(!validPin(pin.input.value)){statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.pinInvalid',null,'error');return}
   save.disabled=true;del.disabled=true;statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.saving',null,'info');
   try{var data=await call('update',{id:q(row.id),name:q(name.value),pin:q(pin.input.value),active:active.checked});renderRows(box,data.pins);mutationStatus(box,data,'loaderPin.saved')}
   catch(e){statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.saveFailed',{error:q(e&&e.message||e)},'error');save.disabled=false;del.disabled=false}
  });
  active.addEventListener('change',async function(){
   active.disabled=true;statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.statusSaving',null,'info');
   try{var data=await call('toggle',{id:q(row.id),active:active.checked});renderRows(box,data.pins);mutationStatus(box,data,'loaderPin.statusSaved')}
   catch(e){active.checked=!active.checked;active.disabled=false;statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.statusFailed',{error:q(e&&e.message||e)},'error')}
  });
  del.addEventListener('click',async function(){
   if(!w.confirm(tr('loaderPin.confirmDelete',{name:q(row.name)})))return;
   save.disabled=true;del.disabled=true;statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.deleting',null,'info');
   try{var data=await call('delete',{id:q(row.id)});renderRows(box,data.pins);mutationStatus(box,data,'loaderPin.deleted')}
   catch(e){statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.deleteFailed',{error:q(e&&e.message||e)},'error');save.disabled=false;del.disabled=false}
  });
  item.appendChild(name);item.appendChild(pin.wrap);item.appendChild(activeLabel);item.appendChild(save);item.appendChild(del);list.appendChild(item)
 })
}
async function load(box){
 var refresh=box.querySelector('[data-rc1075-refresh]');if(refresh)refresh.disabled=true;
 statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.loading',null,'info');
 try{var data=await call('list',{});renderRows(box,data.pins);statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.loaded',{count:String(Number(data.count||0))},'ok')}
 catch(e){renderRows(box,[]);statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.loadFailed',{error:q(e&&e.message||e)},'error')}
 finally{if(refresh)refresh.disabled=false}
}
function installSettings(){
 if(!w.document||!w.document.body)return false;
 var old=w.document.getElementById('rc1075LoaderPinAdmin');
 if(!globalAdmin()||!settingsVisible()){if(old&&old.parentNode)old.parentNode.removeChild(old);return false}
 if(old){refreshLanguage();return true}
 ensureStyle();
 var host=w.document.getElementById('content')||w.document.querySelector('main')||w.document.body;if(!host)return false;
 var box=w.document.createElement('section');box.id='rc1075LoaderPinAdmin';box.className='card rc1075-pin-admin';
 box.innerHTML='<div class="rc1075-head"><div><span class="pill blue">ADMIN</span><h3 data-i18n="loaderPin.title">'+tr('loaderPin.title')+'</h3><p data-i18n="loaderPin.subtitle">'+tr('loaderPin.subtitle')+'</p></div><button type="button" class="btn secondary" data-rc1075-refresh data-i18n="loaderPin.reload">'+tr('loaderPin.reload')+'</button></div><div class="rc1075-new"><label><span data-i18n="loaderPin.field.name">'+tr('loaderPin.field.name')+'</span><input data-rc1075-new-name autocomplete="off" data-i18n-placeholder="loaderPin.placeholder.name" placeholder="'+tr('loaderPin.placeholder.name')+'"></label><label><span data-i18n="loaderPin.field.newPin">'+tr('loaderPin.field.newPin')+'</span><input data-rc1075-new-pin type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" data-i18n-placeholder="loaderPin.pinPlaceholder" placeholder="'+tr('loaderPin.pinPlaceholder')+'"></label><button type="button" class="btn" data-rc1075-add data-i18n="loaderPin.create">'+tr('loaderPin.create')+'</button></div><div data-rc1075-list class="rc1075-list"></div><div class="rc1075-note" data-i18n="loaderPin.note">'+tr('loaderPin.note')+'</div><div data-rc1075-status></div>';
 host.appendChild(box);
 var newPin=box.querySelector('[data-rc1075-new-pin]');if(newPin)newPin.addEventListener('input',function(){this.value=this.value.replace(/\D/g,'').slice(0,4)});
 var add=box.querySelector('[data-rc1075-add]');if(add)add.addEventListener('click',async function(){
  var name=box.querySelector('[data-rc1075-new-name]'),pin=box.querySelector('[data-rc1075-new-pin]');
  if(!q(name&&name.value)){statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.nameRequired',null,'error');return}
  if(!validPin(pin&&pin.value)){statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.newPinInvalid',null,'error');return}
  add.disabled=true;statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.creating',null,'info');
  try{var data=await call('create',{name:q(name.value),pin:q(pin.value),active:true});name.value='';pin.value='';renderRows(box,data.pins);mutationStatus(box,data,'loaderPin.created')}
  catch(e){statusKey(box.querySelector('[data-rc1075-status]'),'loaderPin.createFailed',{error:q(e&&e.message||e)},'error')}
  finally{add.disabled=false}
 });
 var refresh=box.querySelector('[data-rc1075-refresh]');if(refresh)refresh.addEventListener('click',function(){load(box)});
 load(box);return true
}
function schedule(){try{if(typeof w.setTimeout==='function')w.setTimeout(installSettings,0);else installSettings()}catch(_){}}
if(w.addEventListener){
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(name){w.addEventListener(name,schedule)});
 w.addEventListener('exporthub:language-changed',refreshLanguage);
 w.addEventListener('click',schedule,true)
}
if(w.document){if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule()}

w.ExportHUBRC1075LoaderPins=Object.freeze({version:'RC1075',installSettings:installSettings,globalAdmin:globalAdmin,sessionToken:sessionToken,call:call,validPin:validPin});
})(window);
