(function(){
'use strict';
if(window.__EXPORTHUB_RC544_AUTH__)return;
window.__EXPORTHUB_RC544_AUTH__=true;
var API='/api/exporthub-auth',cache=null,selectedId='',draftRights={},busy=false,adminLoading=false,lastSecret='';
var LABELS={start:'Start',dashboard:'Dashboard',tasks:'Aufgaben',vacation:'Urlaub',planning:'Planung',shipment:'Sendung erstellen',abd:'ABD',shipmentoverview:'Sendungsübersicht',cmr:'Ladeliste & CMR',documents:'Dokumente',pallet:'Palettenkonto',customers:'Kunden',customerfolder:'Kundenordner',calculator:'UPS-Rechner',customs:'Zoll',sop:'SOP & Portale',academy:'Academy',ideas:'Ideen',notifications:'Benachrichtigungen',reports:'Reports',update:'Update',rights:'Benutzer & Rechte',teamfile:'Teamdatei',archive:'Archiv',settings:'Einstellungen'};
function runtime(){return window.ExportHUBClean&&window.ExportHUBClean.runtime||{}}
function S(){try{return window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():(window.state||{})}catch(_){return window.state||{}}}
function root(){return document.getElementById('content')}
function Q(v){return String(v==null?'':v).trim()}
function L(v){return Q(v).toLowerCase()}
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
function isGlobal(u){return !!u&&(u.globalAdmin===true||/global.?admin|administrator|vollzugriff/i.test(Q(u.role))||(u.permissions||[]).indexOf('*')>=0)}
function currentView(){return Q(S().view||'dashboard')}
function level(right){var v=L(right&&(right.level||right.access));if(['none','view','edit','admin'].indexOf(v)>=0)return v;if(right&&(right.admin||right.functionAdmin))return'admin';if(right&&right.edit)return'edit';if(right&&(right.read||right.visible))return'view';return'none'}
function rightObject(v){return {level:v,visible:v!=='none',read:v!=='none',edit:v==='edit'||v==='admin',admin:v==='admin',functionAdmin:v==='admin'}}
async function call(action,payload){
 var r=runtime(),res=await fetch(API,{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json','Authorization':'Bearer '+Q(r.authToken)},body:JSON.stringify(Object.assign({action:action},payload||{}))});
 var txt=await res.text(),d={};try{d=txt?JSON.parse(txt):{}}catch(_){throw new Error('Ungültige Serverantwort (HTTP '+res.status+').')}
 if(!res.ok||d.ok===false){var e=new Error(d.message||('HTTP '+res.status));e.code=d.code;throw e}return d
}
function syncUsers(users){
 var r=runtime();r.users=(users||[]).map(clone);window.__CLEAN_BOOT_USERS__=r.users.map(clone);
 try{var target=window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():null;if(Array.isArray(target))target.splice.apply(target,[0,target.length].concat(r.users.map(clone)));window.users=Array.isArray(target)?target:r.users}catch(_){ }
 var key=L(r.user&&(r.user.user||r.user.login||r.user.name)),fresh=r.users.find(function(u){return L(u.user||u.login||u.name)===key});if(fresh){r.user=fresh;try{window.currentUser=fresh;if(typeof currentUser!=='undefined')currentUser=fresh}catch(_){ }}
}
function lockText(u){var s=u.loginSecurity||{};if(s.permanentLocked)return'<span class="pill red">Admin-Sperre</span>';if(s.lockedUntil&&Date.parse(s.lockedUntil)>Date.now())return'<span class="pill orange">Bis '+new Date(s.lockedUntil).toLocaleString('de-DE')+' gesperrt</span>';return'<span class="pill green">Anmeldung frei</span>'}
function userById(){return cache&&cache.users.find(function(u){return Q(u.id)===Q(selectedId)})||cache&&cache.users[0]||null}
function initDraft(u){draftRights={};(cache.modules||[]).forEach(function(id){draftRights[id]=level(u&&u.rights&&u.rights[id])})}
function header(){return '<div class="rc544-head"><div><span class="rc544-kicker">Globale Administration</span><h1>Benutzer, Rechte und Sitzungen</h1><p>Passwörter werden ausschließlich serverseitig als Hash gespeichert. Funktionsrechte können für jeden Bereich einzeln vergeben werden.</p></div><span class="pill blue">RC544 · sichere Anmeldung</span></div>'}
function loading(){var r=root();if(r)r.innerHTML='<section class="card"><h2>Benutzerverwaltung wird geladen …</h2><p>ExportHUB prüft Benutzer und aktive Sitzungen.</p></section>'}
function errorBox(message){var r=root();if(r)r.innerHTML='<section class="card"><h1>Benutzerverwaltung nicht verfügbar</h1><div class="badbox">'+E(message)+'</div><button class="ghost" onclick="rc544LoadAdmin()">Erneut versuchen</button></section>'}
function render(){
 var r=root();if(!r||currentView()!=='rights'||!cache)return;
 var u=userById();if(u&&!selectedId)selectedId=u.id;if(u&&!Object.keys(draftRights).length)initDraft(u);
 var users=cache.users||[],modules=cache.modules||[],sessions=cache.sessions||[],pin=Q((S().settings||{}).qrPin||'2578');
 var list=users.map(function(x){return '<button class="rc544-user '+(u&&x.id===u.id?'active':'')+'" onclick="return rc544SelectUser(\''+E(x.id)+'\')"><span><b>'+E(x.name||x.user)+'</b><small>'+E(x.user)+'</small></span><span>'+(x.active?'<span class="pill green">Aktiv</span>':'<span class="pill red">Inaktiv</span>')+'</span></button>'}).join('');
 var rows=u?modules.map(function(id){var lv=draftRights[id]||level(u.rights&&u.rights[id]);return '<tr><td><b>'+E(LABELS[id]||id)+'</b><small>'+E(id)+'</small></td><td><div class="rc544-rights">'+[['none','Kein Zugriff'],['view','Nur ansehen'],['edit','Bearbeiten'],['admin','Funktions-Admin']].map(function(x){return '<button class="'+(lv===x[0]?'active':'')+'" onclick="return rc544SetDraftRight(\''+E(id)+'\',\''+x[0]+'\')">'+x[1]+'</button>'}).join('')+'</div></td></tr>'}).join(''):'';
 var userSessions=u?sessions.filter(function(s){return s.userId===u.id}):[];
 var sessionRows=userSessions.length?userSessions.map(function(s){return '<tr><td>'+E(s.deviceId||'Unbekanntes Gerät')+'</td><td>'+E(new Date(s.createdAt).toLocaleString('de-DE'))+'</td><td><button class="danger" onclick="return rc544TerminateSession(\''+E(s.id)+'\')">Sitzung beenden</button></td></tr>'}).join(''):'<tr><td colspan="3">Keine aktive Sitzung.</td></tr>';
 var secret=lastSecret?'<div class="rc544-secret"><b>Einmaliges Startpasswort</b><code id="rc544Secret">'+E(lastSecret)+'</code><p>Dieses Passwort jetzt sicher an den Benutzer übergeben. Es wird nach dem Schließen nicht erneut angezeigt.</p><button class="ghost" onclick="return rc544CopySecret()">Passwort kopieren</button><button class="ghost" onclick="return rc544CloseSecret()">Schließen</button></div>':'';
 r.className='content rc544-admin-view';
 r.innerHTML='<div class="rc544-page">'+header()+secret+'<div class="rc544-admin-grid"><section class="card"><h2>Benutzer</h2><label class="field">Benutzer suchen<input id="rc544UserSearch" list="rc544UserOptions" placeholder="Name oder Benutzername eingeben"><datalist id="rc544UserOptions">'+users.map(function(x){return '<option value="'+E(x.user)+'">'+E(x.name)+'</option>'}).join('')+'</datalist></label><button class="ghost" onclick="return rc544ChooseUser()">Benutzer öffnen</button><div class="rc544-user-list">'+list+'</div><hr><h3>Neuen Benutzer anlegen</h3><label class="field">Benutzername<input id="rc544NewLogin" autocomplete="off"></label><label class="field">Anzeigename<input id="rc544NewName"></label><label class="rc544-check"><input id="rc544NewAdmin" type="checkbox"> Globaler Administrator</label><button class="btn" onclick="return rc544CreateUser()">Benutzer anlegen</button></section><section class="card">'+(u?'<div class="rc544-user-head"><div><h2>'+E(u.name||u.user)+'</h2><p>Benutzername: <b>'+E(u.user)+'</b></p></div><div>'+(u.active?'<span class="pill green">Aktiv</span>':'<span class="pill red">Deaktiviert</span>')+lockText(u)+'</div></div><div class="rc544-form-grid"><label class="field">Anzeigename<input id="rc544EditName" value="'+E(u.name||u.user)+'"></label><label class="rc544-check"><input id="rc544EditAdmin" type="checkbox" '+(u.globalAdmin?'checked':'')+'> Globaler Administrator</label></div><div class="toolbar"><button class="btn" onclick="return rc544SaveUser()">Benutzer und Rechte speichern</button><button class="ghost" onclick="return rc544ResetPassword()">Passwort zurücksetzen</button><button class="ghost" onclick="return rc544UnlockUser()">Konto entsperren</button><button class="'+(u.active?'danger':'soft')+'" onclick="return rc544ToggleUser()">'+(u.active?'Benutzer deaktivieren':'Benutzer aktivieren')+'</button></div><table class="table rc544-right-table"><thead><tr><th>Funktion</th><th>Rechtestufe</th></tr></thead><tbody>'+rows+'</tbody></table><h3>Aktive Sitzungen</h3><table class="table"><thead><tr><th>Gerät</th><th>Angemeldet seit</th><th>Aktion</th></tr></thead><tbody>'+sessionRows+'</tbody></table>':'<p>Kein Benutzer vorhanden.</p>')+'</section></div><section class="card rc544-pin-card"><h2>Globale QR-PIN</h2><p>Die vierstellige PIN gilt sofort für alle aktiven und reaktivierten QR-Codes.</p><div class="rc544-form-grid"><label class="field">QR-PIN<input id="rc544GlobalPin" inputmode="numeric" maxlength="4" value="'+E(pin)+'"></label><div class="rc544-pin-action"><button class="btn" onclick="return rc544SaveGlobalPin()">Globale PIN speichern</button></div></div></section></div>';
}
async function load(){if(currentView()!=='rights'||adminLoading)return;if(cache){render();return}var r=runtime();if(!isGlobal(r.user)){errorBox('Nur globale Administratoren dürfen Benutzer und Rechte verwalten.');return}adminLoading=true;loading();try{cache=await call('admin-list');if(!selectedId&&cache.users[0])selectedId=cache.users[0].id;var u=userById();initDraft(u);render()}catch(e){errorBox(e.message)}finally{adminLoading=false;var nt=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setTimeout||window.setTimeout;[0,120,420,1000].forEach(function(ms){nt(function(){if(cache&&currentView()==='rights')render()},ms)})}}
window.rc544LoadAdmin=load;window.rc544RenderAdmin=render;
window.rc544SelectUser=function(id){selectedId=id;initDraft(userById());render();return false};
window.rc544ChooseUser=function(){var value=L((document.getElementById('rc544UserSearch')||{}).value),u=(cache.users||[]).find(function(x){return L(x.user)===value||L(x.name)===value});if(!u)return alert('Benutzer wurde nicht gefunden.');return window.rc544SelectUser(u.id)};
window.rc544SetDraftRight=function(id,v){draftRights[id]=v;render();return false};
window.rc544CreateUser=async function(){if(busy)return false;var login=Q((document.getElementById('rc544NewLogin')||{}).value),name=Q((document.getElementById('rc544NewName')||{}).value),globalAdmin=!!((document.getElementById('rc544NewAdmin')||{}).checked);busy=true;try{var d=await call('admin-create-user',{username:login,name:name,globalAdmin:globalAdmin});lastSecret=d.startPassword||'';cache=await call('admin-list');syncUsers(cache.users);selectedId=d.user.id;initDraft(userById());render()}catch(e){alert(e.message)}finally{busy=false}return false};
window.rc544SaveUser=async function(){if(busy||!userById())return false;var u=userById(),rights={};Object.keys(draftRights).forEach(function(id){rights[id]=rightObject(draftRights[id])});busy=true;try{await call('admin-update-user',{userId:u.id,name:Q((document.getElementById('rc544EditName')||{}).value),globalAdmin:!!((document.getElementById('rc544EditAdmin')||{}).checked),rights:rights});cache=await call('admin-list');syncUsers(cache.users);initDraft(userById());render()}catch(e){alert(e.message)}finally{busy=false}return false};
window.rc544ToggleUser=async function(){if(busy||!userById())return false;var u=userById(),next=!u.active;if(!confirm('Benutzer '+(next?'aktivieren':'deaktivieren')+'?'))return false;busy=true;try{await call('admin-set-active',{userId:u.id,active:next});cache=await call('admin-list');syncUsers(cache.users);initDraft(userById());render()}catch(e){alert(e.message)}finally{busy=false}return false};
window.rc544ResetPassword=async function(){if(busy||!userById())return false;var u=userById();if(!confirm('Passwort für '+u.name+' zurücksetzen? Alle Sitzungen werden beendet.'))return false;busy=true;try{var d=await call('admin-reset-password',{userId:u.id});lastSecret=d.startPassword||'';cache=await call('admin-list');syncUsers(cache.users);render()}catch(e){alert(e.message)}finally{busy=false}return false};
window.rc544UnlockUser=async function(){if(busy||!userById())return false;busy=true;try{await call('admin-unlock',{userId:userById().id});cache=await call('admin-list');syncUsers(cache.users);render()}catch(e){alert(e.message)}finally{busy=false}return false};
window.rc544TerminateSession=async function(sessionId){if(busy)return false;busy=true;try{await call('admin-terminate-sessions',{sessionId:sessionId});cache=await call('admin-list');syncUsers(cache.users);render()}catch(e){alert(e.message)}finally{busy=false}return false};
window.rc544CopySecret=function(){var t=document.getElementById('rc544Secret');if(t&&navigator.clipboard)navigator.clipboard.writeText(t.textContent||'');return false};
window.rc544CloseSecret=function(){lastSecret='';render();return false};
window.rc544SaveGlobalPin=function(){var r=runtime();if(!isGlobal(r.user))return alert('Nur globale Administratoren dürfen die QR-PIN ändern.');var pin=Q((document.getElementById('rc544GlobalPin')||{}).value);if(!/^\d{4}$/.test(pin))return alert('Die globale QR-PIN muss genau vier Ziffern haben.');var st=S();st.settings=st.settings||{};st.settings.qrPin=pin;st.settings.qrPinChangedAt=new Date().toISOString();st.settings.qrPinChangedBy=Q(r.user.name||r.user.user);if(window.ExportHUBClean&&typeof window.ExportHUBClean.queueSave==='function')window.ExportHUBClean.queueSave('Globale QR-PIN geändert');alert('Die neue PIN gilt sofort für alle aktiven QR-Codes.');render();return false};
function post(){if(currentView()==='rights')load()}
function install(){
 var oldRender=window.render;if(typeof oldRender==='function'&&!oldRender.__rc544){var w=function(){var out=oldRender.apply(this,arguments);setTimeout(post,0);return out};w.__rc544=true;window.render=w}
 var oldSet=window.setView;if(typeof oldSet==='function'&&!oldSet.__rc544){var sw=function(v){var out=oldSet.apply(this,arguments);setTimeout(post,0);return out};sw.__rc544=true;window.setView=sw;try{setView=sw}catch(_){ }}
 window.rc524CreateUser=function(){load();return false};window.rc524SaveUser=function(){load();return false};window.rc524DeleteUser=function(){load();return false};
 window.rc542SetRight=function(){load();return false};window.rc541SetRight=function(){load();return false};
  if(!window.__RC544_CLICK_BOUND__){window.__RC544_CLICK_BOUND__=true;document.addEventListener('click',function(){var nt=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setTimeout||window.setTimeout;nt(function(){var r=root();if(currentView()==='rights'&&(!cache||!r||!r.classList.contains('rc544-admin-view')))post()},0)},true)}
 if(!window.__RC544_ADMIN_GUARD__){
  var nativeTimer=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setInterval||window.setInterval;
  window.__RC544_ADMIN_GUARD__=nativeTimer(function(){
   if(currentView()!=='rights')return;
   var r=root();
   if(cache){if(r&&!r.classList.contains('rc544-admin-view'))render()}
   else if(!adminLoading)load();
  },350);
 }
 if(!window.__RC544_ADMIN_OBSERVER__){
  var NR=window.ExportHUBClean&&window.ExportHUBClean.native||{},MO=NR.MutationObserver||window.MutationObserver,cr=root();
  if(MO&&cr){window.__RC544_ADMIN_OBSERVER__=new MO(function(){if(cache&&currentView()==='rights'&&root()&&!root().classList.contains('rc544-admin-view')){(NR.setTimeout||window.setTimeout)(render,0)}});window.__RC544_ADMIN_OBSERVER__.observe(cr,{childList:true,attributes:true,attributeFilter:['class']})}
 }
 post();window.__EXPORTHUB_RC544_AUTH_DIAGNOSTICS__={installed:true,serverAuth:true,passwordHashing:true,accountLocks:true,sessionAdmin:true,adminGuard:true,setViewWrapped:!!(window.setView&&window.setView.__rc544)};
}
window.ExportHUBRC544Auth={install:install,load:load,render:render,call:call};
window.addEventListener('exporthub:ready',install,{once:true});
if(document.readyState!=='loading')setTimeout(function(){if(window.__EXPORTHUB_READY__)install()},0);
})();
