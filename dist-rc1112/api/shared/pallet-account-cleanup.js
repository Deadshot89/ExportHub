'use strict';

const CLEANUP_DATE='2026-09-21';

function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function lower(v){return text(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v))}
function bookingId(row,index){return text(row&&(row.id||row._syncId))||('index:'+index)}
function bookingDay(row){
 const raw=text(row&&(row.date||row.bookingDate||row.createdAt||row.bookedAt||row.timestamp));
 let m=/^(\d{4})-(\d{2})-(\d{2})/.exec(raw);if(m)return m[1]+'-'+m[2]+'-'+m[3];
 m=/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/.exec(raw);if(m)return m[3]+'-'+m[2]+'-'+m[1];
 return'';
}
function ensureMeta(state){
 if(!state._teamSyncMeta||typeof state._teamSyncMeta!=='object'||Array.isArray(state._teamSyncMeta))state._teamSyncMeta={fields:{},tombstones:[]};
 if(!state._teamSyncMeta.fields||typeof state._teamSyncMeta.fields!=='object')state._teamSyncMeta.fields={};
 if(!Array.isArray(state._teamSyncMeta.tombstones))state._teamSyncMeta.tombstones=[];
 return state._teamSyncMeta;
}
function putTombstone(state,id,actor,at){
 const meta=ensureMeta(state),key=lower(id);
 meta.tombstones=arr(meta.tombstones).filter(t=>!(lower(t&&t.collection)==='palletaccount'&&lower(t&&t.id)===key));
 meta.tombstones.push({collection:'palletAccount',id,deletedAt:at,deletedBy:actor,explicitUserAction:true,reason:'Benutzerauftrag: Palettenkonto-Einträge vom 21.09.2026 löschen'});
}
function unlinkSettlements(state,ids,actor,at){
 const set=new Set(arr(ids).map(lower));let changed=0;
 arr(state.palletSettlements).forEach(x=>{
  const adjustment=text(x&&x.adjustmentBookingId),hit=adjustment&&set.has(lower(adjustment));
  if(Array.isArray(x&&x.bookingIds)){
   const before=x.bookingIds.length;
   x.bookingIds=x.bookingIds.filter(id=>!set.has(lower(id)));
   if(x.bookingIds.length!==before)changed++;
  }
  if(hit&&lower(x.status)==='confirmed'){
   x.status='Storniert';x.cancelledAt=at;x.cancelledBy=actor;x.cancelReason='Palettenbuchung vom 21.09.2026 entfernt';changed++;
  }
 });
 return changed;
}
function countPalletDay(team,date=CLEANUP_DATE){
 const state=team&&team.state&&typeof team.state==='object'?team.state:{};
 return arr(state.palletAccount).filter(row=>bookingDay(row)===date).length;
}
function cleanupPalletDay(team,options={}){
 const date=text(options.date)||CLEANUP_DATE,actor=text(options.actor)||'RC1208 GitHub Workflow',at=text(options.at)||new Date().toISOString();
 const next=clone(team&&typeof team==='object'?team:{}),state=next.state&&typeof next.state==='object'&&!Array.isArray(next.state)?next.state:(next.state={});
 const rows=arr(state.palletAccount),matches=[];
 rows.forEach((row,index)=>{if(bookingDay(row)===date)matches.push({row,index,id:bookingId(row,index)})});
 const previousMarker=state.rc1207PalletCleanup20260921At&&typeof state.rc1207PalletCleanup20260921At==='object'?state.rc1207PalletCleanup20260921At:null;
 if(matches.length===0&&previousMarker&&text(previousMarker.date)===date){
  return{changed:false,team:next,date,deletedCount:0,remaining:0,totalDeleted:Number(previousMarker.deletedCount||0),marker:clone(previousMarker)};
 }
 const ids=matches.map(x=>x.id);
 matches.forEach(x=>putTombstone(state,x.id,actor,at));
 if(ids.length){
  state.palletAccount=rows.filter(row=>bookingDay(row)!==date);
  unlinkSettlements(state,ids,actor,at);
  state.auditLog=arr(state.auditLog).slice(-4999);
  state.auditLog.push({
   id:'AUD-PALLET-RC1208-'+Date.parse(at)+'-'+Math.random().toString(36).slice(2,8),
   type:'PALLET_BOOKINGS_DAY_PURGED',
   actor,
   at,
   details:{date,deletedCount:ids.length,reason:'Benutzerauftrag vom 21.09.2026',source:'RC1208 server maintenance'}
  });
 }
 const totalDeleted=Number(previousMarker&&previousMarker.deletedCount||0)+ids.length;
 state.rc1207PalletCleanup20260921At={at,date,deletedCount:totalDeleted,source:'RC1208-server-maintenance'};
 next.schemaVersion=Math.max(3,Number(next.schemaVersion||3));
 next.revision=Number(next.revision||0)+1;
 next.updatedAt=at;
 next.updatedBy=actor;
 next.updatedByUserId=null;
 next.updatedByDevice='github-actions';
 next.clientVersion='RC1208-pallet-cleanup';
 return{changed:true,team:next,date,deletedCount:ids.length,remaining:countPalletDay(next,date),totalDeleted,marker:clone(state.rc1207PalletCleanup20260921At)};
}

module.exports={CLEANUP_DATE,bookingDay,countPalletDay,cleanupPalletDay};
