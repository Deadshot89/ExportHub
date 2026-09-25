// ExportHUB RC1165 – sichtbarer, read-only POD-Sicherungsstatus in der Sendungsübersicht.
(function(root){
'use strict';
if(!root||root.__EXPORTHUB_RC1165_POD_BACKUP_STATUS__)return;
root.__EXPORTHUB_RC1165_POD_BACKUP_STATUS__=true;

const q=v=>String(v==null?'':v).trim();
const tr=(key,vars)=>{try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function')return root.ExportHUBI18n.t(key,vars)}catch(_){}return key};
const arr=v=>Array.isArray(v)?v:[];
let timer=0;

function state(){
 try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{}}catch(_){}
 return root.ExportHUBClean&&root.ExportHUBClean.state||root.appState||{};
}
function refOf(sh){
 sh=sh||{};
 return q(sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber||sh.referenceNo||sh.id||sh.shipmentId).toUpperCase();
}
function idOf(sh){
 sh=sh||{};
 return q(sh.id||sh.shipmentId||sh.uuid||sh.reference||sh.ref||sh.shipmentRef).toUpperCase();
}
function stamp(sh){
 const n=Date.parse(q(sh&& (sh._syncUpdatedAt||sh.updatedAt||sh.modifiedAt||sh.createdAt)));
 return Number.isFinite(n)?n:0;
}
function allShipments(){
 const s=state(),out=[];
 ['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'].forEach(k=>arr(s[k]).forEach(sh=>{if(sh&&typeof sh==='object')out.push(sh)}));
 ['shipment','currentShipment','selectedShipment'].forEach(k=>{const sh=s[k];if(sh&&typeof sh==='object')out.push(sh)});
 const map=new Map();
 out.forEach(sh=>{
  const key=refOf(sh)||idOf(sh);
  if(!key)return;
  const old=map.get(key);
  if(!old||stamp(sh)>=stamp(old))map.set(key,sh);
 });
 return Array.from(map.values());
}
function pickupRelevant(sh){
 if(!sh||typeof sh!=='object')return false;
 if(q(sh.pickedUpAt||sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt||sh.actualPickupAt||sh.collectedAt))return true;
 if(sh.podAvailable===true||sh.podConfirmed===true||arr(sh.podFiles).length>0)return true;
 return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|picked up|pod available|completed|archived)$/i.test(q(sh.status||sh.shipmentStatus||sh.processStatus));
}
function backupOf(sh){
 const b=sh&&sh.podBackup;
 return b&&typeof b==='object'&&!Array.isArray(b)?b:null;
}
function backupMeta(sh){
 if(!pickupRelevant(sh))return null;
 const b=backupOf(sh);
 if(!b)return{key:'unknown',label:tr('podBackup.unknown.label'),title:tr('podBackup.unknown.title')};
 const status=q(b.status).toLowerCase();
 if(b.archiveSaved===true){
  return{key:'saved',label:b.azureSaved===true?tr('podBackup.saved.azureArchive'):tr('podBackup.saved.archive'),title:tr('podBackup.saved.title')};
 }
 if(b.azureSaved===true){
  return{key:'pending',label:tr('podBackup.pending.azure'),title:tr('podBackup.pending.azureTitle')};
 }
 if(/fail|error|fehler/.test(status)){
  return{key:'error',label:tr('podBackup.error.label'),title:tr('podBackup.error.title')};
 }
 return{key:'pending',label:tr('podBackup.pending.label'),title:tr('podBackup.pending.title')};
}
function inOverview(doc){
 const body=doc&&doc.body;
 if(!body||typeof body.getAttribute!=='function')return false;
 return q(body.getAttribute('data-exporthub-view')).toLowerCase()==='shipmentoverview';
}
function cardShipment(card,shipments){
 if(!card)return null;
 const ds=card.dataset||{},ids=[ds.shipmentId,ds.shipment,ds.id,ds.shipmentRef,ds.ref,ds.reference].map(v=>q(v).toUpperCase()).filter(Boolean);
 let hit=arr(shipments).find(sh=>ids.includes(idOf(sh))||ids.includes(refOf(sh)));
 if(hit)return hit;
 const raw=q(card.textContent).toUpperCase();
 if(!raw)return null;
 const matches=arr(shipments).filter(sh=>{const ref=refOf(sh);return ref&&raw.includes(ref)});
 if(!matches.length)return null;
 return matches.sort((a,b)=>stamp(b)-stamp(a))[0];
}
function ensureStyle(doc){
 if(!doc||doc.getElementById('rc1165PodBackupStatusStyle'))return;
 const s=doc.createElement('style');s.id='rc1165PodBackupStatusStyle';
 s.textContent='.rc1165-pod-backup{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:5px 9px;border:1px solid #cbd5e1;border-radius:999px;font-size:11px;font-weight:800;line-height:1.2;max-width:100%;box-sizing:border-box}.rc1165-pod-backup.saved{background:#dcfce7;border-color:#86efac;color:#166534}.rc1165-pod-backup.pending{background:#fffbeb;border-color:#fde68a;color:#92400e}.rc1165-pod-backup.error,.rc1165-pod-backup.unknown{background:#fff7ed;border-color:#fdba74;color:#9a3412}@media(max-width:640px){.rc1165-pod-backup{white-space:normal;border-radius:10px}}body.dark .rc1165-pod-backup.saved,[data-theme="dark"] .rc1165-pod-backup.saved{background:#052e16;color:#bbf7d0;border-color:#166534}body.dark .rc1165-pod-backup.pending,[data-theme="dark"] .rc1165-pod-backup.pending{background:#422006;color:#fde68a;border-color:#92400e}body.dark .rc1165-pod-backup.error,body.dark .rc1165-pod-backup.unknown,[data-theme="dark"] .rc1165-pod-backup.error,[data-theme="dark"] .rc1165-pod-backup.unknown{background:#431407;color:#fed7aa;border-color:#9a3412}';
 (doc.head||doc.documentElement).appendChild(s);
}
function removeBadge(card){
 const badge=card&&card.querySelector&&card.querySelector('[data-rc1165-pod-backup]');
 if(badge&&typeof badge.remove==='function')badge.remove();
}
function render(){
 const doc=root.document;
 if(!doc||typeof doc.querySelectorAll!=='function')return 0;
 if(!inOverview(doc)){
  doc.querySelectorAll('[data-rc1165-pod-backup]').forEach(n=>{if(n&&typeof n.remove==='function')n.remove()});
  return 0;
 }
 ensureStyle(doc);
 const shipments=allShipments(),cards=Array.from(doc.querySelectorAll('.rc524-shipment-card,.rc485-overview-card,.rc229-shipment-card,.shipment-card,.overview-card,[data-shipment-id],[data-shipment-ref],[data-ref],[data-reference]'));
 let count=0;
 cards.forEach(card=>{
  const sh=cardShipment(card,shipments),meta=backupMeta(sh);
  if(!meta){removeBadge(card);return}
  let badge=card.querySelector&&card.querySelector('[data-rc1165-pod-backup]');
  if(!badge){
   badge=doc.createElement('span');
   badge.setAttribute('data-rc1165-pod-backup','1');
   const host=card.querySelector&&card.querySelector('[data-rc1014-shipment-meta]')||card;
   if(host&&typeof host.appendChild==='function')host.appendChild(badge);
  }
  badge.className='rc1165-pod-backup '+meta.key;
  badge.textContent=meta.label;
  badge.setAttribute('title',meta.title);
  badge.setAttribute('aria-label',meta.label);
  count++;
 });
 return count;
}
function schedule(){
 if(timer||!root.setTimeout)return false;
 timer=root.setTimeout(()=>{timer=0;try{render()}catch(e){try{console.warn('RC1165 POD-Status',e)}catch(_){}}},0);
 return true;
}
if(root.addEventListener){
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:shipment-updated','exporthub:overview-updated','exporthub:language-changed'].forEach(name=>root.addEventListener(name,schedule));
}
if(root.document&&root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
root.ExportHUBRC1165PodBackupStatus=Object.freeze({version:'RC1165',backupMeta,pickupRelevant,render});
})(globalThis);
