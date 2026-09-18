// ExportHUB RC1160 – sichere kundenspezifische Portalzugänge.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1160_CUSTOMER_PORTAL__)return;
w.__EXPORTHUB_RC1160_CUSTOMER_PORTAL__=true;
if(w.__EXPORTHUB_DEMO_MODE__===true)return;

var API='/api/customer-portal-credentials',revealTimer=0,lastContext='',loadSeq=0,rightsSeq=0;
function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function user(){try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}var s=state();return w.currentUser||s.currentUser||s.activeUser||null}
function globalAdmin(u){u=u||{};var role=low(u.role||u.rolle),roles=['global admin','global administrator','globaler administrator','globaler admin','administrator','admin','vollzugriff'];return u.globalAdmin===true||u.isGlobalAdmin===true||arr(u.permissions).indexOf('*')>=0||roles.indexOf(role)>=0}
function rights(){var u=user()||{},r=u.rights&&u.rights.customerPortal||{};if(globalAdmin(u))return{use:true,manage:true};return{use:r.use===true||r.manage===true,manage:r.manage===true}}
function view(){var s=state();return low(s.view||s.currentView||s.activeView||s.page||'')}
function environment(){return/-testservice\./i.test(String(w.location&&w.location.hostname||''))?'testservice':'production'}
function token(){
 try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},t=q(rt.authToken||rt.token||rt.sessionToken);if(t)return t}catch(_){}
 try{var raw=w.sessionStorage&&w.sessionStorage.getItem('exporthub_rc301_tab_session');if(raw){var x=JSON.parse(raw);if(x&&x.token)return q(x.token)}}catch(_){}
 return''
}
function headers(){var t=token(),h={'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Environment':environment()};if(t){h['X-ExportHUB-Token']=t;h['X-ExportHUB-Session']=t;h.Authorization='Bearer '+t}return h}
async function portalApi(action,payload){
 var response=await w.fetch(API,{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify(Object.assign({action:action},payload||{}))}),data={};
 try{data=await response.json()}catch(_){data={}}
 if(!response.ok||data.ok===false){var e=new Error(q(data.message)||('HTTP '+response.status));e.code=q(data.code);e.status=response.status;throw e}
 return data
}
async function authApi(action,payload){
 var response=await w.fetch('/api/exporthub-auth',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify(Object.assign({action:action},payload||{}))}),data={};
 try{data=await response.json()}catch(_){data={}}
 if(!response.ok||data.ok===false){var e=new Error(q(data.message)||('HTTP '+response.status));e.code=q(data.code);e.status=response.status;throw e}
 return data
}
function customerId(c){return q(c&&(c.id||c.customerId||c.account||c.customerNumber||c.number||c.name))}
function customerList(){var s=state();return arr(s.customers)}
function selectedCustomer(){
 var s=state(),ids=[s.customerFolderId,s.currentCustomerId,s.selectedCustomerId,s.customerId,s.shipment&&s.shipment.customerId,s.currentShipment&&s.currentShipment.customerId,s.selectedShipment&&s.selectedShipment.customerId].map(q).filter(Boolean);
 var direct=s.selectedCustomer||s.currentCustomer||s.shipment&&s.shipment.customer||s.currentShipment&&s.currentShipment.customer;
 if(direct&&customerId(direct))return direct;
 for(var i=0;i<ids.length;i++){var id=ids[i],hit=customerList().find(function(c){return customerId(c)===id});if(hit)return hit}
 return null
}
function clearRevealedSecrets(){
 if(revealTimer){w.clearTimeout(revealTimer);revealTimer=0}
 d.querySelectorAll('[data-rc1160-secret]').forEach(function(n){n.textContent='';n.removeAttribute('data-rc1160-secret')});
 var dlg=d.getElementById('rc1160RevealDialog');if(dlg)dlg.remove();
}
function ensureStyle(){
 if(d.getElementById('rc1160CustomerPortalStyle'))return;
 var s=d.createElement('style');s.id='rc1160CustomerPortalStyle';s.textContent=
 '.rc1160-box{margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:14px;background:#fff;color:#0f172a;box-shadow:0 6px 20px rgba(15,23,42,.06)}'+
 '.rc1160-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.rc1160-head h3{margin:0 0 4px}.rc1160-muted{color:#64748b;font-size:13px}'+
 '.rc1160-list{display:grid;gap:10px;margin-top:12px}.rc1160-row{padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;display:grid;gap:8px}.rc1160-row-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.rc1160-actions{display:flex;gap:8px;flex-wrap:wrap}.rc1160-badge{display:inline-flex;padding:3px 8px;border-radius:999px;background:#e2e8f0;font-size:12px}.rc1160-badge.ok{background:#dcfce7;color:#166534}.rc1160-badge.off{background:#fee2e2;color:#991b1b}'+
 '.rc1160-dialog{position:fixed;inset:0;z-index:120000;background:rgba(15,23,42,.65);display:grid;place-items:center;padding:16px}.rc1160-dialog-card{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.28)}.rc1160-dialog label{display:grid;gap:6px;margin:10px 0}.rc1160-dialog input,.rc1160-dialog textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #94a3b8;border-radius:8px}.rc1160-secret{padding:10px;border-radius:8px;background:#f1f5f9;word-break:break-all;font-family:ui-monospace,monospace}.rc1160-status[data-kind="bad"]{color:#b91c1c}.rc1160-status[data-kind="ok"]{color:#166534}'+
 '.rc1160-rights-grid{display:grid;grid-template-columns:minmax(180px,1fr) auto auto auto;gap:10px;align-items:center}.rc1160-rights-grid select{min-width:180px;padding:8px}@media(max-width:640px){.rc1160-rights-grid{grid-template-columns:1fr}.rc1160-actions .btn{flex:1 1 auto}}';
 d.head.appendChild(s)
}
function status(node,msg,kind){if(!node)return;node.textContent=msg||'';node.setAttribute('data-kind',kind||'info')}
function readinessBadge(ready,adminView){if(ready&&ready.configured===true)return'<span class="rc1160-badge ok">Verschlüsselung aktiv</span>';return'<span class="rc1160-badge off">'+(adminView?'Server-Schlüssel fehlt':'Verschlüsselung nicht bereit')+'</span>'}
function readinessHint(ready,adminView){if(ready&&ready.configured===true)return'';return'<div class="rc1160-muted" data-rc1162-key-warning>'+(adminView?'Azure App Setting EXPORTHUB_CUSTOMER_PORTAL_KEY fehlt. Zugangsdaten können nicht gespeichert oder angezeigt werden.':'Zugangsdaten können derzeit nicht gespeichert oder angezeigt werden. Bitte Administrator informieren.')+'</div>'}
function portalRows(customer,portals,canManage,configured){
 if(!portals.length)return'<div class="rc1160-muted">Für diesen Kunden ist kein Kundenportal hinterlegt.</div>';
 return'<div class="rc1160-list">'+portals.map(function(p){
  return'<div class="rc1160-row" data-portal-id="'+esc(p.id)+'"><div class="rc1160-row-top"><div><b>'+esc(p.name)+'</b><div class="rc1160-muted">'+esc(p.url)+'</div></div><span class="rc1160-badge '+(p.active!==false?'ok':'off')+'">'+(p.active!==false?'Aktiv':'Inaktiv')+'</span></div>'+
   '<div><span class="rc1160-badge">'+(p.hasUsername?'Benutzername hinterlegt':'Kein Benutzername')+'</span> <span class="rc1160-badge">'+(p.hasPassword?'Passwort hinterlegt':'Kein Passwort')+'</span></div>'+
   '<div class="rc1160-actions"><button type="button" class="btn" data-rc1160-open="'+esc(p.id)+'">Portal öffnen</button><button type="button" class="btn primary" data-rc1160-reveal="'+esc(p.id)+'" '+(configured?'':'disabled title="Verschlüsselung nicht bereit"')+'>Zugangsdaten anzeigen</button>'+
   (canManage?'<button type="button" class="btn" data-rc1160-edit="'+esc(p.id)+'">Bearbeiten</button><button type="button" class="btn" data-rc1160-delete="'+esc(p.id)+'">Löschen</button>':'')+'</div></div>'
 }).join('')+'</div>'
}
function openPortal(p){if(!p||!/^https:\/\//i.test(q(p.url)))return;var win=w.open(p.url,'_blank','noopener,noreferrer');try{if(win)win.opener=null}catch(_){}}
function modal(html){clearRevealedSecrets();var box=d.createElement('div');box.id='rc1160RevealDialog';box.className='rc1160-dialog';box.innerHTML='<div class="rc1160-dialog-card">'+html+'</div>';box.addEventListener('click',function(e){if(e.target===box||e.target.closest('[data-rc1160-close]')){e.preventDefault();clearRevealedSecrets()}});d.body.appendChild(box);return box}
function copyText(value){if(!value)return Promise.resolve(false);if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(value).then(function(){return true});return Promise.resolve(false)}
async function reveal(customer,p){
 var box=modal('<h3>Zugangsdaten anzeigen</h3><p class="rc1160-muted">Zur Sicherheit bitte dein persönliches ExportHUB-Passwort erneut eingeben.</p><label>ExportHUB-Passwort<input type="password" autocomplete="current-password" data-rc1160-reauth></label><div class="rc1160-status" data-rc1160-status></div><div class="rc1160-actions"><button class="btn" data-rc1160-close>Abbrechen</button><button class="btn primary" data-rc1160-confirm>Anzeigen</button></div>');
 var input=box.querySelector('[data-rc1160-reauth]'),out=box.querySelector('[data-rc1160-status]');
 input.focus();
 box.querySelector('[data-rc1160-confirm]').addEventListener('click',async function(){
  var password=input.value;input.value='';this.disabled=true;status(out,'Zugang wird geprüft …');
  try{
   var data=await portalApi('reveal',{customerId:customerId(customer),portalId:p.id,password:password});password='';
   box.querySelector('.rc1160-dialog-card').innerHTML='<h3>'+esc(p.name)+'</h3><p class="rc1160-muted">Die Werte werden nach 60 Sekunden automatisch ausgeblendet.</p><b>Benutzername</b><div class="rc1160-secret" data-rc1160-secret="username">'+esc(data.username||'')+'</div><button class="btn" data-copy="username">Benutzername kopieren</button><br><br><b>Passwort</b><div class="rc1160-secret" data-rc1160-secret="password">'+esc(data.password||'')+'</div><button class="btn" data-copy="password">Passwort kopieren</button><div class="rc1160-actions" style="margin-top:16px"><button class="btn" data-rc1160-close>Schließen</button></div>';
   box.querySelectorAll('[data-copy]').forEach(function(btn){btn.addEventListener('click',function(){var n=box.querySelector('[data-rc1160-secret="'+this.getAttribute('data-copy')+'"]');copyText(n&&n.textContent)})});
   revealTimer=w.setTimeout(clearRevealedSecrets,60000);
  }catch(e){password='';status(out,e.message||'Zugang konnte nicht angezeigt werden.','bad');this.disabled=false}
 })
}
function portalForm(customer,existing,onDone){
 existing=existing||null;var box=modal('<h3>'+(existing?'Kundenportal bearbeiten':'Kundenportal hinzufügen')+'</h3>'+
 '<label>Portalname<input data-f="name" value="'+esc(existing&&existing.name)+'"></label><label>HTTPS-Adresse<input data-f="url" type="url" value="'+esc(existing&&existing.url)+'"></label>'+
 '<label>Benutzername'+(existing?'<span class="rc1160-muted">leer lassen = unverändert</span>':'')+'<input data-f="username" autocomplete="off"></label>'+
 '<label>Passwort'+(existing?'<span class="rc1160-muted">leer lassen = unverändert</span>':'')+'<input data-f="password" type="password" autocomplete="new-password"></label>'+
 '<label>Interne Notiz<textarea data-f="note">'+esc(existing&&existing.note)+'</textarea></label><label><input data-f="active" type="checkbox" '+(!existing||existing.active!==false?'checked':'')+'> Aktiv</label>'+
 '<div class="rc1160-status" data-rc1160-status></div><div class="rc1160-actions"><button class="btn" data-rc1160-close>Abbrechen</button><button class="btn primary" data-save>Speichern</button></div>');
 box.querySelector('[data-save]').addEventListener('click',async function(){
  var data={};box.querySelectorAll('[data-f]').forEach(function(n){data[n.getAttribute('data-f')]=n.type==='checkbox'?n.checked:n.value});
  var out=box.querySelector('[data-rc1160-status]');this.disabled=true;status(out,'Speichern …');
  try{
   if(existing)await portalApi('update',{customerId:customerId(customer),portalId:existing.id,portal:data});else await portalApi('create',{customerId:customerId(customer),portal:data});
   clearRevealedSecrets();if(onDone)onDone()
  }catch(e){status(out,e.message||'Speichern fehlgeschlagen.','bad');this.disabled=false}
 })
}
async function deletePortal(customer,p,onDone){if(!w.confirm('Kundenportal „'+p.name+'“ wirklich löschen?'))return;try{await portalApi('delete',{customerId:customerId(customer),portalId:p.id});if(onDone)onDone()}catch(e){w.alert(e.message||'Löschen fehlgeschlagen.')}}
function wirePortalBox(box,customer,portals,canManage,reload){
 box.querySelectorAll('[data-rc1160-open]').forEach(function(btn){btn.addEventListener('click',function(){openPortal(portals.find(function(p){return p.id===btn.getAttribute('data-rc1160-open')}))})});
 box.querySelectorAll('[data-rc1160-reveal]').forEach(function(btn){btn.addEventListener('click',function(){var p=portals.find(function(x){return x.id===btn.getAttribute('data-rc1160-reveal')});if(p)reveal(customer,p)})});
 box.querySelectorAll('[data-rc1160-edit]').forEach(function(btn){btn.addEventListener('click',function(){var p=portals.find(function(x){return x.id===btn.getAttribute('data-rc1160-edit')});if(p)portalForm(customer,p,reload)})});
 box.querySelectorAll('[data-rc1160-delete]').forEach(function(btn){btn.addEventListener('click',function(){var p=portals.find(function(x){return x.id===btn.getAttribute('data-rc1160-delete')});if(p)deletePortal(customer,p,reload)})});
}
async function renderCustomerFolder(customer,r){
 var root=d.getElementById('content');if(!root)return;
 var old=d.getElementById('rc1160CustomerFolderPortal');if(old)old.remove();
 var box=d.createElement('section');box.id='rc1160CustomerFolderPortal';box.className='rc1160-box';box.innerHTML='<div class="rc1160-head"><div><h3>Kundenportal</h3><div class="rc1160-muted">Zugangsdaten werden verschlüsselt außerhalb des Sendungs- und Team-State gespeichert.</div></div><span data-rc1162-readiness><span class="rc1160-badge">Prüfung …</span></span>'+(r.manage?'<button class="btn primary" data-add>Portal hinzufügen</button>':'')+'</div><div data-ready-hint></div><div data-body class="rc1160-muted">Laden …</div>';root.appendChild(box);
 var seq=++loadSeq;
 try{var results=await Promise.all([portalApi('list',{customerId:customerId(customer)}),portalApi('status',{})]),data=results[0],ready=results[1];if(seq!==loadSeq||customerId(customer)!==customerId(selectedCustomer()))return;var portals=arr(data.portals),body=box.querySelector('[data-body]'),badge=box.querySelector('[data-rc1162-readiness]'),hint=box.querySelector('[data-ready-hint]');if(badge)badge.innerHTML=readinessBadge(ready,r.manage);if(hint)hint.innerHTML=readinessHint(ready,r.manage);body.className='';body.innerHTML=portalRows(customer,portals,r.manage,ready.configured===true);wirePortalBox(box,customer,portals,r.manage,function(){schedule(true)});var add=box.querySelector('[data-add]');if(add){add.disabled=ready.configured!==true;if(add.disabled)add.title='Verschlüsselung nicht bereit';add.addEventListener('click',function(){portalForm(customer,null,function(){schedule(true)})})}}
 catch(e){var body=box.querySelector('[data-body]');if(body)body.textContent=e.message||'Kundenportal konnte nicht geladen werden.'}
}
async function renderShipment(customer,r){
 var host=d.getElementById('rc363BlockCustomer')||d.getElementById('content');if(!host)return;
 var old=d.getElementById('rc1160ShipmentPortal');if(old)old.remove();
 var box=d.createElement('section');box.id='rc1160ShipmentPortal';box.className='rc1160-box';box.innerHTML='<div class="rc1160-head"><div><h3>Kundenportal</h3><div class="rc1160-muted">Portalzugang für den aktuell ausgewählten Kunden.</div></div><span data-rc1162-readiness><span class="rc1160-badge">Prüfung …</span></span></div><div data-ready-hint></div><div data-body class="rc1160-muted">Laden …</div>';host.appendChild(box);
 var seq=++loadSeq;
 try{var results=await Promise.all([portalApi('list',{customerId:customerId(customer)}),portalApi('status',{})]),data=results[0],ready=results[1];if(seq!==loadSeq||customerId(customer)!==customerId(selectedCustomer()))return;var portals=arr(data.portals).filter(function(p){return p.active!==false}),body=box.querySelector('[data-body]'),badge=box.querySelector('[data-rc1162-readiness]'),hint=box.querySelector('[data-ready-hint]');if(badge)badge.innerHTML=readinessBadge(ready,false);if(hint)hint.innerHTML=readinessHint(ready,false);body.className='';body.innerHTML=portalRows(customer,portals,false,ready.configured===true);wirePortalBox(box,customer,portals,false,function(){schedule(true)})}
 catch(e){var body=box.querySelector('[data-body]');if(body)body.textContent=e.message||'Kundenportal konnte nicht geladen werden.'}
}
async function renderRights(){
 var root=d.getElementById('content');if(!root||!globalAdmin(user()))return;
 var old=d.getElementById('rc1160PortalRights');if(old)old.remove();
 var box=d.createElement('section');box.id='rc1160PortalRights';box.className='rc1160-box';box.innerHTML='<div class="rc1160-head"><div><h3>Kundenportal-Rechte</h3><div class="rc1160-muted">Separates Funktionsrecht für sensible externe Zugangsdaten.</div></div><span data-rc1162-readiness><span class="rc1160-badge">Prüfung …</span></span></div><div data-ready-hint></div><div data-body class="rc1160-muted">Benutzer laden …</div>';root.appendChild(box);
 var seq=++rightsSeq;
 try{
  var results=await Promise.all([authApi('admin-list',{}),portalApi('status',{})]),data=results[0],ready=results[1];if(seq!==rightsSeq)return;var users=arr(data.users),body=box.querySelector('[data-body]'),badge=box.querySelector('[data-rc1162-readiness]'),hint=box.querySelector('[data-ready-hint]');if(badge)badge.innerHTML=readinessBadge(ready,true);if(hint)hint.innerHTML=readinessHint(ready,true);
  body.innerHTML='<div class="rc1160-rights-grid"><select data-user>'+users.map(function(u){return'<option value="'+esc(u.id)+'">'+esc(u.name||u.user)+'</option>'}).join('')+'</select><label><input type="checkbox" data-use> verwenden</label><label><input type="checkbox" data-manage> verwalten</label><button class="btn primary" data-save>Speichern</button></div><div class="rc1160-status" data-rc1160-status></div>';
  var select=body.querySelector('[data-user]'),use=body.querySelector('[data-use]'),manage=body.querySelector('[data-manage]'),save=body.querySelector('[data-save]'),out=body.querySelector('[data-rc1160-status]');
  function chosen(){return users.find(function(u){return u.id===select.value})}
  function sync(){var u=chosen()||{},r=u.rights&&u.rights.customerPortal||{},admin=globalAdmin(u);use.checked=admin||r.use===true||r.manage===true;manage.checked=admin||r.manage===true;use.disabled=admin;manage.disabled=admin;save.disabled=admin;status(out,admin?'Global Admin besitzt beide Rechte automatisch.':'')}
  select.addEventListener('change',sync);manage.addEventListener('change',function(){if(this.checked)use.checked=true});use.addEventListener('change',function(){if(!this.checked)manage.checked=false});
  save.addEventListener('click',async function(){var u=chosen();if(!u)return;var next=JSON.parse(JSON.stringify(u.rights||{}));next.customerPortal={use:use.checked,manage:manage.checked};this.disabled=true;try{var result=await authApi('admin-update-user',{userId:u.id,rights:next,globalAdmin:u.globalAdmin===true,name:u.name});var idx=users.findIndex(function(x){return x.id===u.id});if(idx>=0)users[idx]=result.user;status(out,'Kundenportal-Rechte gespeichert.','ok')}catch(e){status(out,e.message||'Rechte konnten nicht gespeichert werden.','bad')}finally{sync()}});
  sync()
 }catch(e){var body=box.querySelector('[data-body]');if(body)body.textContent=e.message||'Benutzerrechte konnten nicht geladen werden.'}
}
function removeBoxes(){['rc1160CustomerFolderPortal','rc1160ShipmentPortal','rc1160PortalRights'].forEach(function(id){var n=d.getElementById(id);if(n)n.remove()})}
function contextKey(){var c=selectedCustomer();return view()+'|'+customerId(c)+'|'+JSON.stringify(rights())}
function schedule(force){
 ensureStyle();var key=contextKey();if(!force&&key===lastContext)return;lastContext=key;clearRevealedSecrets();removeBoxes();
 var r=rights(),v=view(),c=selectedCustomer();if(!r.use)return;
 if((v==='customerfolder'||v==='customers')&&c)renderCustomerFolder(c,r);
 if(v==='shipment'&&c)renderShipment(c,r);
 if((v==='rights'||v==='benutzer'||v==='users')&&globalAdmin(user()))renderRights()
}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:customer-changed'].forEach(function(name){try{w.addEventListener(name,function(){schedule(true)})}catch(_){}});
w.addEventListener('pagehide',clearRevealedSecrets);w.addEventListener('beforeunload',clearRevealedSecrets);
d.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('button,a');if(t&&/abmelden|logout|konto wechseln/i.test(q(t.textContent)))clearRevealedSecrets()},true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){schedule(true)},{once:true});else schedule(true);
w.setInterval(function(){schedule(false)},700);
w.ExportHUBCustomerPortal1160=Object.freeze({version:'RC1160',readinessVersion:'RC1162',rights:rights,selectedCustomer:selectedCustomer,clearRevealedSecrets:clearRevealedSecrets,portalApi:portalApi,schedule:schedule});
})(window,document);
