// ExportHUB RC1533 – kontrollierte Admin-Nachbearbeitung bereits abgeholter Sendungen.
(function(w,d){
'use strict';
if(!w||w.__EXPORTHUB_RC1533_SHIPMENT_REWORK__)return;
w.__EXPORTHUB_RC1533_SHIPMENT_REWORK__=true;

var VERSION='RC1533',STATUS_REWORK='Nachbearbeitung',renderTimer=0,opening=false,closing=false;
function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function stamp(value){return q(value)||new Date().toISOString()}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state||w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||w.state||{}}
function currentUser(){try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}var s=state();return w.currentUser||s.currentUser||s.activeUser||null}
function actor(user){var u=user||{};return{id:q(u.id||u.userId||u.username||u.email),name:q(u.name||u.displayName||u.user||u.username||u.email)||'Unbekannt'}}
function canReopen(user){
 var u=user;if(!obj(u))return false;var role=low(u.role||u.rolle),r=(u.rights||{}).shipment||{},level=low(r.level||r.access);
 if(u.globalAdmin===true||u.isGlobalAdmin===true||arr(u.permissions).indexOf('*')>=0||/^(?:global admin|global administrator|globaler administrator|globaler admin|administrator|admin|vollzugriff)$/.test(role))return true;
 return r.admin===true||r.functionAdmin===true||level==='admin'
}
function shipmentStatus(sh){var x=sh||{};return q(x.status||x.shipmentStatus||x.processStatus||x.pickupStatus)}
function reopenableStatus(sh){return /^(?:abgeholt|pod vorhanden|abgeschlossen|picked up|pod available|completed)$/i.test(shipmentStatus(sh))}
function activeRework(sh){return !!(sh&&obj(sh.shipmentRework)&&sh.shipmentRework.active===true)}
function shipmentKey(sh){var x=sh||{};return low(x.id||x.shipmentId||x.reference||x.ref||x.shipmentRef||x.referenceNumber)}
function previousStatuses(sh){return{status:q(sh&&sh.status),processStatus:q(sh&&sh.processStatus),shipmentStatus:q(sh&&sh.shipmentStatus)}}
function pushHistory(sh,type,label,at,user,status){
 var who=actor(user),id='RC1533-'+type+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),row={id:id,type:type,label:label,at:at,createdAt:at,actor:who,actorName:who.name,status:q(status)};
 sh.shipmentHistory=arr(sh.shipmentHistory).slice();sh.shipmentHistory.push(row);
 sh.statusHistory=arr(sh.statusHistory).slice();sh.statusHistory.push({id:id,status:q(status),label:label,detail:label,at:at,createdAt:at,actor:who,actorName:who.name});
 return row
}
function applyOpen(sh,user,at){
 if(!obj(sh)||!canReopen(user)||!reopenableStatus(sh)||activeRework(sh))return false;
 var time=stamp(at);sh.shipmentRework={active:true,version:VERSION,openedAt:time,openedBy:actor(user),previous:previousStatuses(sh)};
 sh.status=STATUS_REWORK;sh.processStatus=STATUS_REWORK;sh.shipmentStatus=STATUS_REWORK;
 pushHistory(sh,'rework-opened','Sendung zur Nachbearbeitung geöffnet',time,user,STATUS_REWORK);return true
}
function applyClose(sh,user,at){
 if(!obj(sh)||!canReopen(user)||!activeRework(sh))return false;
 var time=stamp(at),rw=sh.shipmentRework,prev=obj(rw.previous)?rw.previous:{},fallback=q(prev.status||prev.processStatus||prev.shipmentStatus)||'Abgeholt';
 sh.status=q(prev.status)||fallback;sh.processStatus=q(prev.processStatus)||fallback;sh.shipmentStatus=q(prev.shipmentStatus)||fallback;
 rw.active=false;rw.closedAt=time;rw.closedBy=actor(user);rw.version=VERSION;
 pushHistory(sh,'rework-closed','Nachbearbeitung gespeichert und geschlossen',time,user,sh.status);return true
}
function mutationSnapshot(sh){return{status:sh.status,processStatus:sh.processStatus,shipmentStatus:sh.shipmentStatus,shipmentRework:clone(sh.shipmentRework),shipmentHistory:clone(sh.shipmentHistory),statusHistory:clone(sh.statusHistory)}}
function restoreMutation(sh,s){if(!sh||!s)return;sh.status=s.status;sh.processStatus=s.processStatus;sh.shipmentStatus=s.shipmentStatus;if(s.shipmentRework===undefined)delete sh.shipmentRework;else sh.shipmentRework=clone(s.shipmentRework);if(s.shipmentHistory===undefined)delete sh.shipmentHistory;else sh.shipmentHistory=clone(s.shipmentHistory);if(s.statusHistory===undefined)delete sh.statusHistory;else sh.statusHistory=clone(s.statusHistory)}
function lists(s){return['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments'].map(function(k){return arr(s&&s[k])})}
function findByKey(s,key){if(!key)return null;var groups=lists(s);for(var i=0;i<groups.length;i++){var hit=groups[i].find(function(x){return shipmentKey(x)===key});if(hit)return hit}return null}
function currentShipment(){
 var s=state(),viewKey=low(s.shipmentViewId||s.selectedShipmentId||s.activeShipmentId||s.currentShipmentId),hit=findByKey(s,viewKey);if(hit)return hit;
 var direct=s.shipment||s.currentShipment||s.activeShipment||s.selectedShipment||null;if(obj(direct))return direct;return null
}
function aliases(sh){var s=state(),key=shipmentKey(sh),out=[],seen=[];function add(x){if(!obj(x)||seen.indexOf(x)>=0)return;if(x===sh||(key&&shipmentKey(x)===key)){seen.push(x);out.push(x)}}add(sh);lists(s).forEach(function(xs){xs.forEach(add)});[s.shipment,s.currentShipment,s.activeShipment,s.selectedShipment].forEach(add);return out}
function copyWorkflow(source,target){if(!source||!target)return;target.status=source.status;target.processStatus=source.processStatus;target.shipmentStatus=source.shipmentStatus;target.shipmentRework=clone(source.shipmentRework);target.shipmentHistory=clone(source.shipmentHistory);target.statusHistory=clone(source.statusHistory)}
async function persist(reason){
 var clean=w.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error('Bestätigter ExportHUB-Speicher ist nicht verfügbar.');
 var queued=await Promise.resolve(clean.queueSave(reason));if(queued===false)throw new Error('Änderung konnte nicht zur Speicherung vorgemerkt werden.');
 var ok=await Promise.resolve(clean.flushSave(reason,{force:true,userInitiated:true}));if(ok!==true)throw new Error('Speicherung wurde nicht bestätigt.');return true
}
function emit(name,detail){try{w.dispatchEvent(new CustomEvent(name,{detail:detail||{}}))}catch(_){}}
function setStateForEditor(sh){var s=state();s.shipment=sh;s.currentShipment=sh;s.activeShipment=sh;s.selectedShipment=sh;var id=q(sh.id||sh.shipmentId||sh.reference||sh.ref);if(id){s.selectedShipmentId=id;s.activeShipmentId=id}}
function routeEditor(sh){
 setStateForEditor(sh);try{if(d&&d.body)d.body.removeAttribute('data-rc420-shipment-readonly')}catch(_){}
 try{if(w.ExportHUBRC325&&typeof w.ExportHUBRC325.route==='function'){w.ExportHUBRC325.route('shipment','rc1533-rework');return true}}catch(_){}
 try{if(typeof w.setView==='function'){w.setView('shipment');return true}}catch(_){}return false
}
async function openCurrent(){
 if(opening)return false;var sh=currentShipment(),user=currentUser();if(!sh||!canReopen(user)||!reopenableStatus(sh)||activeRework(sh))return false;
 opening=true;var copies=aliases(sh),backup=copies.map(function(x){return[x,mutationSnapshot(x)]});
 try{if(!applyOpen(sh,user))return false;copies.forEach(function(x){if(x!==sh)copyWorkflow(sh,x)});await persist('RC1533 Sendung zur Nachbearbeitung geöffnet');emit('exporthub:shipment-updated',{shipment:sh,reason:'rework-opened',version:VERSION});routeEditor(sh);scheduleRender(0);return true}
 catch(e){backup.forEach(function(x){restoreMutation(x[0],x[1])});setPanelStatus('Öffnen fehlgeschlagen: '+q(e&&e.message||e),'error');throw e}
 finally{opening=false}
}
function protectedControl(el){var text=low([el&&el.id,el&&el.name,el&&el.className,el&&el.getAttribute&&el.getAttribute('data-action'),el&&el.getAttribute&&el.getAttribute('data-field')].join(' '));return /(?:pod|pickup|abhol|signature|unterschrift|seal|siegel|container|customs|zoll|driver|fahrer|kennzeichen|license)/.test(text)}
function editableControls(){if(!d||!d.getElementById)return[];var out=[],ids=['rc363BlockCustomer','rc363BlockShipment','rc363BlockColli','rc363BlockDocuments','rc363BlockStow','rc363BlockMail'];ids.forEach(function(id){var block=d.getElementById(id);if(block&&block.querySelectorAll)out=out.concat(Array.from(block.querySelectorAll('input,select,textarea,button')))});var save=d.getElementById('rc363SaveShipment');if(save)out.push(save);return out}
function clearAdminLock(){if(!d||!d.querySelectorAll)return;Array.from(d.querySelectorAll('[data-rc1533-admin-lock]')).forEach(function(el){el.disabled=false;el.removeAttribute('data-rc1533-admin-lock')})}
function enforceAdminLock(){
 if(!d||!d.body)return;d.body.setAttribute('data-rc420-shipment-readonly','1');editableControls().forEach(function(el){if(protectedControl(el)||el.disabled)return;el.disabled=true;el.setAttribute('data-rc1533-admin-lock','1')})
}
function unlockFallback(){
 if(!d||!d.body)return;clearAdminLock();d.body.removeAttribute('data-rc420-shipment-readonly');d.body.setAttribute('data-rc1533-rework','1');
 editableControls().forEach(function(el){if(protectedControl(el)||el.type==='hidden')return;if(el.disabled){el.setAttribute('data-rc1533-was-disabled','1');el.disabled=false}if(el.readOnly){el.setAttribute('data-rc1533-was-readonly','1');el.readOnly=false}})
}
function relockFallback(){
 if(!d||!d.body)return;d.body.removeAttribute('data-rc1533-rework');if(!d.querySelectorAll)return;Array.from(d.querySelectorAll('[data-rc1533-was-disabled]')).forEach(function(el){el.disabled=true;el.removeAttribute('data-rc1533-was-disabled')});Array.from(d.querySelectorAll('[data-rc1533-was-readonly]')).forEach(function(el){el.readOnly=true;el.removeAttribute('data-rc1533-was-readonly')})
}
async function closeAfterSuccessfulSave(event){
 if(opening||closing)return false;var detail=event&&event.detail||{},saved=detail.shipment||null,sh=saved&&activeRework(saved)?saved:currentShipment();if(!sh||!activeRework(sh))return false;
 var user=currentUser();if(!canReopen(user)){enforceAdminLock();return false}closing=true;var copies=aliases(sh),backup=copies.map(function(x){return[x,mutationSnapshot(x)]});
 try{if(!applyClose(sh,user))return false;copies.forEach(function(x){if(x!==sh)copyWorkflow(sh,x)});await persist('RC1533 Nachbearbeitung gespeichert und geschlossen');relockFallback();emit('exporthub:shipment-updated',{shipment:sh,reason:'rework-closed',version:VERSION});setPanelStatus('Nachbearbeitung gespeichert. Sendung ist wieder geschützt.','ok');scheduleRender(0);return true}
 catch(e){backup.forEach(function(x){restoreMutation(x[0],x[1])});unlockFallback();setPanelStatus('Nachbearbeitung bleibt geöffnet: '+q(e&&e.message||e),'error');try{console.error('RC1533 close',e)}catch(_){}return false}
 finally{closing=false}
}
function ensureStyle(){if(!d||!d.createElement||!d.getElementById||d.getElementById('rc1533ShipmentReworkStyle'))return;var st=d.createElement('style');st.id='rc1533ShipmentReworkStyle';st.textContent='.rc1533-rework{margin:0 0 14px;padding:14px 16px;border:1px solid #f59e0b;border-left:5px solid #d97706;border-radius:14px;background:#fffbeb;color:#451a03}.rc1533-rework-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.rc1533-rework h3{margin:4px 0;font-size:16px}.rc1533-rework p{margin:3px 0;font-size:13px;line-height:1.45;color:#78350f}.rc1533-rework button{min-height:40px}.rc1533-rework-badge{display:inline-flex;padding:4px 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:800}.rc1533-rework-status{min-height:18px;margin-top:8px;font-size:12px;font-weight:700}.rc1533-rework-status[data-kind="error"]{color:#b91c1c}.rc1533-rework-status[data-kind="ok"]{color:#166534}@media(max-width:700px){.rc1533-rework button{width:100%}}';(d.head||d.documentElement).appendChild(st)}
function panelHost(){return d&&((d.getElementById&&d.getElementById('rc363FixedShipmentLayout'))||(d.getElementById&&d.getElementById('rc573ShipmentShell'))||(d.getElementById&&d.getElementById('content'))||d.body)}
function setPanelStatus(text,kind){if(!d||!d.querySelector)return;var el=d.querySelector('[data-rc1533-status]');if(el){el.textContent=q(text);el.setAttribute('data-kind',kind||'info')}}
function render(){
 if(!d||!d.getElementById||!d.createElement)return false;ensureStyle();var sh=currentShipment(),user=currentUser(),host=panelHost(),old=d.getElementById('rc1533ShipmentRework'),active=activeRework(sh),allowed=canReopen(user);
 if(!host||!sh||(!active&&(!reopenableStatus(sh)||!allowed))){if(old)old.remove();if(!active){clearAdminLock();relockFallback()}return false}
 var key=shipmentKey(sh)+'|'+shipmentStatus(sh)+'|'+String(active)+'|'+String(allowed);if(old&&old.getAttribute('data-rc1533-key')===key){if(active){if(allowed)unlockFallback();else enforceAdminLock()}return true}if(old)old.remove();
 var box=d.createElement('section');box.id='rc1533ShipmentRework';box.className='rc1533-rework';box.setAttribute('data-rc1533-key',key);var ref=q(sh.reference||sh.ref||sh.shipmentRef||sh.id||sh.shipmentId);
 if(active&&allowed){
  box.innerHTML='<div class="rc1533-rework-head"><div><span class="rc1533-rework-badge">Nachbearbeitung aktiv</span><h3>Sendung '+esc(ref)+' ist zur Korrektur geöffnet</h3><p>Kunden-, Sendungs- und Collidaten können korrigiert werden. Abholung, POD, QR/Pickup, Unterschriften, Siegel- und Container-Nachweise bleiben geschützt.</p><p><b>Mit „Sendung speichern“ wird die Nachbearbeitung nach erfolgreicher Speicherung automatisch geschlossen.</b></p></div></div><div class="rc1533-rework-status" data-rc1533-status></div>';unlockFallback()
 }else if(active){
  box.innerHTML='<div class="rc1533-rework-head"><div><span class="rc1533-rework-badge">Admin-Nachbearbeitung</span><h3>Sendung '+esc(ref)+' wird administrativ nachbearbeitet</h3><p>Für dein Benutzerkonto bleibt die Sendung schreibgeschützt.</p></div></div>';enforceAdminLock()
 }else{
  box.innerHTML='<div class="rc1533-rework-head"><div><span class="rc1533-rework-badge">Admin-Funktion</span><h3>Geschlossene Sendung korrigieren</h3><p>Status: <b>'+esc(shipmentStatus(sh))+'</b>. Abhol- und POD-Nachweise werden dabei nicht zurückgesetzt.</p></div><button type="button" class="btn" data-rc1533-open>Sendung wieder öffnen</button></div><div class="rc1533-rework-status" data-rc1533-status></div>';
  box.addEventListener('click',function(ev){var btn=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1533-open]');if(!btn)return;ev.preventDefault();btn.disabled=true;setPanelStatus('Sendung wird sicher zur Nachbearbeitung geöffnet …','info');openCurrent().catch(function(){btn.disabled=false})})
 }
 if(host.firstChild)host.insertBefore(box,host.firstChild);else host.appendChild(box);return true
}
function scheduleRender(delay){if(!d)return;clearTimeout(renderTimer);renderTimer=setTimeout(render,typeof delay==='number'?delay:35)}

w.ExportHUBShipmentRework1533=Object.freeze({version:VERSION,canReopen:canReopen,reopenableStatus:reopenableStatus,activeRework:activeRework,applyOpen:applyOpen,applyClose:applyClose,currentShipment:currentShipment,openCurrent:openCurrent,render:render});
if(d&&typeof d.addEventListener==='function'){
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){scheduleRender(0)},{once:true});else scheduleRender(0);
 d.addEventListener('click',function(ev){var save=ev.target&&ev.target.closest&&ev.target.closest('#rc363SaveShipment'),sh=currentShipment();if(save&&activeRework(sh)&&canReopen(currentUser())){unlockFallback();setPanelStatus('Nachbearbeitung wird gespeichert …','info')}},true)
}
if(typeof w.addEventListener==='function'){
 w.addEventListener('exporthub:shipment-saved',function(ev){closeAfterSuccessfulSave(ev)});
 ['exporthub:rendered','exporthub:shipment-updated','exporthub:sync','exporthub:route-changed','exporthub:view-changed'].forEach(function(name){w.addEventListener(name,function(){scheduleRender(25)})})
}
})(window,document);
