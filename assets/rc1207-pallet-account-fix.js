(function(root){
'use strict';
if(root.__EXPORTHUB_RC1207_PALLET_ACCOUNT_FIX__)return;
root.__EXPORTHUB_RC1207_PALLET_ACCOUNT_FIX__=true;

var CLEANUP_DATE='2026-09-21',cleanupInFlight=false,enhanceTimer=0;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v))}
function state(){
  try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||null}catch(_){}
  return root.ExportHUBClean&&root.ExportHUBClean.runtime&&root.ExportHUBClean.runtime.state||root.ExportHUBClean&&root.ExportHUBClean.state||root.state||root.appState||null;
}
function environment(){
  var forced=low(root.__EXPORTHUB_FORCED_ENVIRONMENT__);
  if(forced==='production'||forced==='testservice'||forced==='demo')return forced;
  var h=low(root.location&&root.location.hostname),p=low(root.location&&root.location.pathname);
  if(p.indexOf('demo.html')>=0)return'demo';
  return /-testservice\./.test(h)?'testservice':'production';
}
function actor(){
  var u={};
  try{if(typeof root.__EXPORTHUB_GET_CURRENT_USER__==='function')u=root.__EXPORTHUB_GET_CURRENT_USER__()||{}}catch(_){}
  if(!u||typeof u!=='object')u={};
  if(!Object.keys(u).length)u=root.currentUser||root.ExportHUBClean&&root.ExportHUBClean.runtime&&root.ExportHUBClean.runtime.user||{};
  return q(u.name||u.displayName||u.user||u.username||u.login||'Admin');
}
function canAdmin(){try{return typeof root.canAdmin==='function'&&root.canAdmin('pallet')===true}catch(_){return false}}
function palletViewActive(){
  var s=state(),view=low(s&&(s.view||s.currentView));
  if(view==='pallet')return true;
  if(view)return false;
  var d=root.document;
  return !!(d&&d.querySelector&&d.querySelector('.rc542-table,#rc542PalIn,#rc542PalOut,[data-exporthub-rendered-view="pallet"]'))
}
function bookingId(b,index){return q(b&&(b.id||b._syncId))||('index:'+index)}
function bookingDay(b){
  var raw=q(b&&(b.date||b.bookingDate||b.createdAt||b.bookedAt||b.timestamp));
  var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(raw);if(m)return m[1]+'-'+m[2]+'-'+m[3];
  m=/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/.exec(raw);if(m)return m[3]+'-'+m[2]+'-'+m[1];
  return'';
}
function ensureMeta(s){
  if(!s._teamSyncMeta||typeof s._teamSyncMeta!=='object'||Array.isArray(s._teamSyncMeta))s._teamSyncMeta={fields:{},tombstones:[]};
  if(!s._teamSyncMeta.fields||typeof s._teamSyncMeta.fields!=='object')s._teamSyncMeta.fields={};
  if(!Array.isArray(s._teamSyncMeta.tombstones))s._teamSyncMeta.tombstones=[];
  return s._teamSyncMeta;
}
function putTombstone(s,id,deletedBy,reason){
  var meta=ensureMeta(s),key=low(id),now=new Date().toISOString();
  meta.tombstones=arr(meta.tombstones).filter(function(t){return !(low(t&&t.collection)==='palletaccount'&&low(t&&t.id)===key)});
  meta.tombstones.push({collection:'palletAccount',id:id,deletedAt:now,deletedBy:deletedBy,explicitUserAction:true,reason:reason});
}
function unlinkSettlements(s,ids,who,reason){
  var set={};arr(ids).forEach(function(id){set[low(id)]=true});
  var now=new Date().toISOString(),changed=0;
  arr(s.palletSettlements).forEach(function(x){
    var adjustment=q(x&&x.adjustmentBookingId),hit=adjustment&&set[low(adjustment)];
    if(Array.isArray(x&&x.bookingIds)){
      var before=x.bookingIds.length;
      x.bookingIds=x.bookingIds.filter(function(id){return !set[low(id)]});
      if(x.bookingIds.length!==before)changed++;
    }
    if(hit&&low(x.status)==='confirmed'){
      x.status='Storniert';x.cancelledAt=now;x.cancelledBy=who;x.cancelReason=reason;changed++;
    }
  });
  return changed;
}
function audit(s,type,details){
  s.auditLog=arr(s.auditLog).slice(-4999);
  s.auditLog.push({id:'AUD-PALLET-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),type:type,actor:actor(),at:new Date().toISOString(),details:details||{}});
}
async function persist(reason){
  var clean=root.ExportHUBClean;
  if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error('Azure-Speicherung ist noch nicht bereit.');
  await Promise.resolve(clean.queueSave(reason));
  var ok=await Promise.resolve(clean.flushSave(reason));
  if(ok===false)throw new Error('Azure hat die Palettenkonto-Änderung nicht bestätigt.');
  return true;
}
function rerender(){
  try{if(typeof root.rc542RenderPallet==='function')root.rc542RenderPallet(true)}catch(_){}
  scheduleEnhance();
}
function chosenDirection(){
  var d=root.document,inBtn=d&&d.getElementById&&d.getElementById('rc542PalIn'),outBtn=d&&d.getElementById&&d.getElementById('rc542PalOut');
  if(outBtn&&outBtn.classList&&outBtn.classList.contains('active'))return'Ausgang';
  if(inBtn&&inBtn.classList&&inBtn.classList.contains('active'))return'Eingang';
  var s=state(),dir=q(s&&s.rc542PalDirection);
  return dir==='Ausgang'?'Ausgang':'Eingang';
}
function syncDirectionUi(){
  var s=state(),d=root.document;if(!s||!d||!d.getElementById)return false;
  var dir=q(s.rc542PalDirection);if(dir!=='Eingang'&&dir!=='Ausgang'){dir='Eingang';s.rc542PalDirection=dir}
  var inBtn=d.getElementById('rc542PalIn'),outBtn=d.getElementById('rc542PalOut');
  if(inBtn&&inBtn.classList)inBtn.classList.toggle('active',dir==='Eingang');
  if(outBtn&&outBtn.classList)outBtn.classList.toggle('active',dir==='Ausgang');
  return true;
}
function installBookingGuard(){
  var fn=root.rc542AddPalletBooking;
  if(typeof fn!=='function'||fn.__rc1207Guarded)return false;
  function guarded(){
    var s=state();if(s)s.rc542PalDirection=chosenDirection();
    return fn.apply(this,arguments);
  }
  guarded.__rc1207Guarded=true;guarded.__rc1207Original=fn;root.rc542AddPalletBooking=guarded;
  return true;
}
async function deletePalletBooking(id,options){
  options=options||{};
  if(!canAdmin())throw new Error('Nur ein Admin darf Palettenbuchungen löschen.');
  var s=state();if(!s)throw new Error('Palettenkonto ist noch nicht geladen.');
  var list=arr(s.palletAccount),index=list.findIndex(function(b,i){return low(bookingId(b,i))===low(id)});
  if(index<0)return false;
  var row=list[index],label=[bookingDay(row),q(row.direction||row.type),q(row.count||row.quantity)].filter(Boolean).join(' · ');
  if(!options.skipConfirm&&typeof root.confirm==='function'&&!root.confirm('Palettenbuchung '+label+' endgültig löschen?'))return false;
  var prev={palletAccount:clone(s.palletAccount),palletSettlements:clone(s.palletSettlements),meta:clone(s._teamSyncMeta),audit:clone(s.auditLog)};
  var who=actor(),key=bookingId(row,index),reason='Admin-Löschung Palettenkonto';
  try{
    putTombstone(s,key,who,reason);
    s.palletAccount=list.filter(function(_b,i){return i!==index});
    unlinkSettlements(s,[key],who,reason);
    audit(s,'PALLET_BOOKING_DELETED',{bookingId:key,date:bookingDay(row),direction:q(row.direction||row.type),count:Number(row.count||row.quantity||0),party:q(row.partyName||row.customerName),reason:reason});
    await persist('Palettenbuchung gelöscht');
    rerender();return true;
  }catch(error){
    s.palletAccount=prev.palletAccount;s.palletSettlements=prev.palletSettlements;s._teamSyncMeta=prev.meta;s.auditLog=prev.audit;
    throw error;
  }
}
function bookingIdFromCorrection(button){
  var raw=q(button&&button.getAttribute&&button.getAttribute('onclick')),m=/rc542CorrectPalletBooking\(['"]([^'"]+)['"]\)/.exec(raw);
  return m?m[1]:'';
}
function enhanceAdminDeleteButtons(){
  installBookingGuard();syncDirectionUi();
  var d=root.document;if(!d||!d.querySelectorAll)return false;
  var allowed=canAdmin(),rows=Array.prototype.slice.call(d.querySelectorAll('.rc542-table tbody tr'));
  rows.forEach(function(row){
    var existing=row.querySelector&&row.querySelector('[data-rc1207-delete-pallet]');
    if(!allowed){if(existing&&existing.remove)existing.remove();return}
    if(existing)return;
    var correct=row.querySelector&&row.querySelector('button[onclick*="rc542CorrectPalletBooking"]'),id=bookingIdFromCorrection(correct);
    if(!correct||!id||!correct.parentNode)return;
    var btn=d.createElement('button');btn.type='button';btn.className='danger';btn.setAttribute('data-rc1207-delete-pallet',id);btn.textContent='Löschen';btn.title='Palettenbuchung als Admin endgültig löschen';
    btn.addEventListener('click',function(ev){if(ev&&ev.preventDefault)ev.preventDefault();deletePalletBooking(id).catch(function(error){if(root.alert)root.alert(q(error&&error.message||error))})});
    correct.parentNode.appendChild(btn);
  });
  return true;
}
function scheduleEnhance(){
  installBookingGuard();
  if(!palletViewActive())return false;
  var schedule=root.setTimeout||setTimeout;if(enhanceTimer&&root.clearTimeout)root.clearTimeout(enhanceTimer);
  enhanceTimer=schedule(function(){enhanceTimer=0;enhanceAdminDeleteButtons()},0);
  return true;
}
async function cleanupProductionDayOnce(){
  if(environment()!=='production'||cleanupInFlight)return false;
  var s=state(),clean=root.ExportHUBClean;if(!s||s.rc1207PalletCleanup20260921At)return false;
  if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')return false;
  var rows=arr(s.palletAccount),matches=[];
  rows.forEach(function(b,i){if(bookingDay(b)===CLEANUP_DATE)matches.push({row:b,index:i,id:bookingId(b,i)})});
  cleanupInFlight=true;
  var prev={palletAccount:clone(s.palletAccount),palletSettlements:clone(s.palletSettlements),meta:clone(s._teamSyncMeta),audit:clone(s.auditLog),marker:s.rc1207PalletCleanup20260921At};
  try{
    var who='system:RC1207',ids=matches.map(function(x){return x.id}),at=new Date().toISOString();
    matches.forEach(function(x){putTombstone(s,x.id,who,'Benutzerauftrag: Palettenkonto-Einträge vom 21.09.2026 löschen')});
    if(ids.length){
      var remove={};ids.forEach(function(id){remove[low(id)]=true});
      s.palletAccount=rows.filter(function(b,i){return !remove[low(bookingId(b,i))]});
      unlinkSettlements(s,ids,who,'Palettenbuchung vom 21.09.2026 entfernt');
      audit(s,'PALLET_BOOKINGS_DAY_PURGED',{date:CLEANUP_DATE,deletedCount:ids.length,reason:'Benutzerauftrag vom 21.09.2026'});
    }
    s.rc1207PalletCleanup20260921At={at:at,date:CLEANUP_DATE,deletedCount:ids.length};
    await persist('RC1207 Palettenkonto 21.09.2026 bereinigt');
    rerender();return true;
  }catch(error){
    s.palletAccount=prev.palletAccount;s.palletSettlements=prev.palletSettlements;s._teamSyncMeta=prev.meta;s.auditLog=prev.audit;
    if(prev.marker===undefined)delete s.rc1207PalletCleanup20260921At;else s.rc1207PalletCleanup20260921At=prev.marker;
    throw error;
  }finally{cleanupInFlight=false}
}
function scheduleCleanup(){
  if(environment()!=='production')return false;
  var schedule=root.setTimeout||setTimeout;
  schedule(function(){cleanupProductionDayOnce().catch(function(error){try{root.console&&root.console.error&&root.console.error('RC1207 Palettenkonto-Bereinigung fehlgeschlagen',error)}catch(_){}})},1200);
  return true;
}

if(root.addEventListener){
  ['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(function(name){root.addEventListener(name,scheduleEnhance)});
  root.addEventListener('exporthub:ready',scheduleCleanup);
}
if(root.document&&root.document.readyState!=='loading'){scheduleEnhance()}
else if(root.document&&root.document.addEventListener)root.document.addEventListener('DOMContentLoaded',scheduleEnhance,{once:true});
if(typeof root.MutationObserver==='function'&&root.document){
  try{var target=root.document.body||root.document.documentElement;if(target)new root.MutationObserver(function(){if(palletViewActive())scheduleEnhance()}).observe(target,{childList:true,subtree:true})}catch(_){}
}
(root.setTimeout||setTimeout)(function(){scheduleEnhance();if(environment()==='production')scheduleCleanup()},4500);

root.ExportHUBRC1207PalletFix=Object.freeze({
  version:'RC1246',cleanupDate:CLEANUP_DATE,bookingDay:bookingDay,chosenDirection:chosenDirection,syncDirectionUi:syncDirectionUi,palletViewActive:palletViewActive,
  installBookingGuard:installBookingGuard,enhanceAdminDeleteButtons:enhanceAdminDeleteButtons,deletePalletBooking:deletePalletBooking,
  cleanupProductionDayOnce:cleanupProductionDayOnce
});
})(globalThis);
