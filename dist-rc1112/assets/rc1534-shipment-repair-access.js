// ExportHUB RC1534 – Access-Policy für den bestehenden RC1533-Datenreparaturpfad.
(function(w,d){
'use strict';
if(!w||w.__EXPORTHUB_RC1534_SHIPMENT_REPAIR_ACCESS__)return;
w.__EXPORTHUB_RC1534_SHIPMENT_REPAIR_ACCESS__=true;

var VERSION='RC1534',timer=0;
function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function tr(key){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var value=w.ExportHUBI18n.t(key);if(value&&value!==key)return value}}catch(_){}return key}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state||w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||w.state||{}}
function currentUser(){try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}var s=state();return w.currentUser||s.currentUser||s.activeUser||null}
function canRepair(user){
 var u=user;if(!obj(u))return false;var role=low(u.role||u.rolle),rights=u.rights||{},r=rights.shipment||{},level=low(r.level||r.access);
 if(u.globalAdmin===true||u.isGlobalAdmin===true||arr(u.permissions).indexOf('*')>=0||/^(?:global admin|global administrator|globaler administrator|globaler admin|administrator|admin|vollzugriff)$/.test(role))return true;
 return r.admin===true||r.functionAdmin===true||level==='admin'
}
function shipmentStatus(sh){var x=sh||{};return q(x.status||x.shipmentStatus||x.processStatus||x.pickupStatus)}
function repairable(sh){return /^(?:abgeholt|pod vorhanden|abgeschlossen|picked up|pod available|completed)$/i.test(shipmentStatus(sh))}
function shipmentKey(sh){var x=sh||{};return low(x.id||x.shipmentId||x.reference||x.ref||x.shipmentRef||x.referenceNumber)}
function repairValue(sh){var x=sh||{};return q(x.id||x.shipmentId||x.reference||x.ref||x.shipmentRef||x.referenceNumber)}
function openRepair(sh,user){
 var u=user||currentUser();if(!obj(sh)||!canRepair(u)||!repairable(sh))return false;
 var fn=w.__EXPORTHUB_OPEN_SHIPMENT_REPAIR__;if(typeof fn!=='function')return false;
 var value=repairValue(sh);if(!value)return false;
 return fn(value,'')!==false
}
function shipmentLists(s){return['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments'].map(function(key){return arr(s&&s[key])})}
function allShipments(){var s=state(),out=[],seen={};shipmentLists(s).forEach(function(list){list.forEach(function(sh){var key=shipmentKey(sh);if(!key||seen[key])return;seen[key]=1;out.push(sh)})});return out}
function cardShipment(card,shipments){
 if(!card)return null;var ds=card.dataset||{},ids=[ds.shipmentId,ds.shipment,ds.id,ds.shipmentRef,ds.ref,ds.reference,ds.rc1534Shipment].map(low).filter(Boolean);
 var hit=arr(shipments).find(function(sh){return ids.indexOf(shipmentKey(sh))>=0});if(hit)return hit;
 var text=low(card.textContent);if(!text)return null;return arr(shipments).find(function(sh){var keys=[sh.id,sh.shipmentId,sh.reference,sh.ref,sh.shipmentRef,sh.referenceNumber].map(low).filter(Boolean);return keys.some(function(key){return text.indexOf(key)>=0})})||null
}
function cardOf(node){return node&&node.closest&&node.closest('.rc524-shipment-card,.rc485-overview-card,.rc229-shipment-card,.shipment-card,.overview-card,[data-shipment-id],[data-shipment-ref],[data-ref],[data-reference]')}
function buttonShipment(button,shipments){var card=cardOf(button);return cardShipment(card,shipments)}
function blockOriginal(button){if(!button)return;button.disabled=true;button.hidden=true;button.setAttribute&&button.setAttribute('aria-hidden','true');button.setAttribute&&button.setAttribute('data-rc1534-blocked','1')}
function adoptOriginal(button,sh){
 if(!button||!sh)return null;button.removeAttribute&&button.removeAttribute('data-rc628-repair-shipment');button.setAttribute&&button.setAttribute('data-rc1534-repair-shipment','1');button.setAttribute&&button.setAttribute('data-rc1534-shipment',repairValue(sh));button.disabled=false;button.hidden=false;button.removeAttribute&&button.removeAttribute('aria-hidden');button.removeAttribute&&button.removeAttribute('data-rc1534-blocked');return button
}
function createButton(card,sh){
 if(!d||!d.createElement||!card)return null;var button=d.createElement('button');button.type='button';button.className='btn rc1534-repair-button';button.textContent=tr('shipment.title')+' · '+tr('common.open');button.setAttribute('data-rc1534-repair-shipment','1');button.setAttribute('data-rc1534-shipment',repairValue(sh));
 var host=card.querySelector&&card.querySelector('.rc628-actions,.shipment-actions,.card-actions,.actions');(host||card).appendChild(button);return button
}
function ensureCard(card,sh,user){
 if(!card||!sh)return;var allowed=canRepair(user)&&repairable(sh),original=card.querySelector&&card.querySelector('[data-rc628-repair-shipment]'),own=card.querySelector&&card.querySelector('[data-rc1534-repair-shipment]');
 if(!allowed){if(original)blockOriginal(original);if(own&&own.getAttribute&&own.getAttribute('data-rc1534-created')==='1')own.remove();else if(own)blockOriginal(own);return}
 if(original){adoptOriginal(original,sh);return}
 if(own){own.disabled=false;own.hidden=false;own.removeAttribute&&own.removeAttribute('aria-hidden');own.setAttribute&&own.setAttribute('data-rc1534-shipment',repairValue(sh));return}
 var created=createButton(card,sh);if(created)created.setAttribute('data-rc1534-created','1')
}
function render(){
 if(!d||!d.querySelectorAll)return 0;var user=currentUser(),shipments=allShipments(),cards=Array.from(d.querySelectorAll('.rc524-shipment-card,.rc485-overview-card,.rc229-shipment-card,.shipment-card,.overview-card,[data-shipment-id],[data-shipment-ref],[data-ref],[data-reference]')),count=0;
 cards.forEach(function(card){var sh=cardShipment(card,shipments);if(!sh)return;ensureCard(card,sh,user);count++});
 Array.from(d.querySelectorAll('[data-rc628-repair-shipment]')).forEach(function(button){var sh=buttonShipment(button,shipments);if(!sh||!canRepair(user)||!repairable(sh))blockOriginal(button);else adoptOriginal(button,sh)});
 return count
}
function schedule(delay){clearTimeout(timer);timer=setTimeout(render,typeof delay==='number'?delay:35)}
function clickHandler(ev){
 var button=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1534-repair-shipment]');if(!button)return;ev.preventDefault();ev.stopPropagation();if(typeof ev.stopImmediatePropagation==='function')ev.stopImmediatePropagation();
 var shipments=allShipments(),sh=buttonShipment(button,shipments),key=low(button.getAttribute&&button.getAttribute('data-rc1534-shipment'));if(!sh&&key)sh=shipments.find(function(item){return shipmentKey(item)===key})||null;
 if(!sh||!openRepair(sh,currentUser())){button.disabled=true;button.setAttribute&&button.setAttribute('aria-disabled','true');return}
 button.disabled=true
}

w.ExportHUBShipmentRepairAccess1534=Object.freeze({version:VERSION,canRepair:canRepair,repairable:repairable,openRepair:openRepair,render:render});
if(d&&typeof d.addEventListener==='function'){
 d.addEventListener('click',clickHandler,true);
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){schedule(0)},{once:true});else schedule(0)
}
if(typeof w.addEventListener==='function'){
 ['exporthub:rendered','exporthub:shipment-updated','exporthub:sync','exporthub:route-changed','exporthub:view-changed'].forEach(function(name){w.addEventListener(name,function(){schedule(20)})})
}
try{if(w.MutationObserver&&d&&d.body){var observer=new w.MutationObserver(function(){schedule(30)});observer.observe(d.body,{childList:true,subtree:true})}}catch(_){}
})(window,document);
