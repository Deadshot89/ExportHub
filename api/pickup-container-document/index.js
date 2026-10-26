'use strict';
const access=require('../shared/public-access-store');
const pickup=require('../shared/pickup-store');
const docs=require('../shared/container-document-store');
const apiI18n=require('../shared/i18n');

function json(status,body){return pickup.json(status,body)}
function message(req,e,fallback){const raw=text(e&&e.message);return /^api\./.test(raw)?apiI18n.t(req,raw,e&&e.vars):raw||apiI18n.t(req,fallback)}
function publicPhoto(req,photo){return docs.publicPhoto(photo,key=>apiI18n.t(req,key))}
function mergePhoto(list,photo){
 const rows=Array.isArray(list)?list.slice():[];
 const next=rows.filter(x=>String(x&&x.kind||'').toLowerCase()!==photo.kind);
 next.push(photo);
 return next;
}
function text(v){return String(v==null?'':v).trim()}
function linkedInTeam(teamDoc,record,photo){
 const state=teamDoc&&teamDoc.state&&typeof teamDoc.state==='object'?teamDoc.state:teamDoc||{},
  shipments=[].concat(Array.isArray(state.shipments)?state.shipments:[],Array.isArray(state.savedShipments)?state.savedShipments:[]);
 const sid=text(record&&record.shipmentId),ref=text(record&&record.reference).toUpperCase(),subId=text(record&&record.subShipmentId);
 function matchesParent(sh){
  if(!sh||typeof sh!=='object')return false;
  const id=text(sh.shipmentId||sh.id),reference=text(sh.reference||sh.ref||sh.shipmentRef).toUpperCase();
  if(sid&&id&&sid!==id&&!(ref&&sid.toUpperCase()===ref))return false;
  if(ref&&reference&&ref!==reference)return false;
  return!!((sid&&sid===id)||(ref&&ref===reference));
 }
 function matchingSub(sh){
  return subId&&Array.isArray(sh&&sh.subShipments)?sh.subShipments.find(x=>text(x&&x.subShipmentId)===subId):null;
 }
 function hasPhoto(target){
  return(Array.isArray(target&&target.containerPhotos)?target.containerPhotos:[]).some(x=>
   text(x&&x.kind).toLowerCase()===text(photo&&photo.kind).toLowerCase()&&
   (!text(photo&&photo.blobName)||text(x&&x.blobName)===text(photo&&photo.blobName)));
 }
 const parents=shipments.filter(matchesParent);
 if(!subId)return parents.some(hasPhoto);
 // A verified parent always wins. Never use a foreign parent as fallback when
 // the current parent is known but its sub-shipment is missing.
 if(parents.length)return parents.some(sh=>hasPhoto(matchingSub(sh)));
 // Only older QR records with stale parent IDs can be recovered by their
 // *exact*, unique truck ID; sequence or shared reference is never enough.
 const recovered=shipments.filter(sh=>!!matchingSub(sh));
 const ids=new Set(recovered.map(sh=>text(sh&&(sh.shipmentId||sh.id))));
 const refs=new Set(recovered.map(sh=>text(sh&&(sh.reference||sh.ref||sh.shipmentRef)).toUpperCase()).filter(Boolean));
 if(!recovered.length||ids.size!==1||ids.has('')||refs.size>1)return false;
 return recovered.some(sh=>hasPhoto(matchingSub(sh)));
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=json(204,{});return}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.postOnly')});return}
 try{
  const b=pickup.body(req),token=String(b.token||'').trim(),resolved=await access.resolve(req,'pickup',token,{allowUsed:false},b),accessKey=resolved.resourceKey||resolved.tokenHash,got=await pickup.getRecord(accessKey,resolved.environment),record=got.record||{};
  if(pickup.expired(record)&&!(typeof pickup.pickupComplete==='function'&&pickup.pickupComplete(record)))throw pickup.err('EXPIRED',apiI18n.t(req,'api.pickup.expired'),410);
  const kind=docs.kindOf(b.kind),photo=await docs.savePhoto({environment:resolved.environment,reference:record.reference,kind,dataUrl:b.dataUrl,shipmentId:record.shipmentId,subShipmentId:record.subShipmentId});
  const updated=await pickup.mutateRecord(accessKey,resolved.environment,function(r){
   r.containerPhotos=mergePhoto(r.containerPhotos,photo);
   r.containerDocumentationUpdatedAt=pickup.now();
   r.updatedAt=r.containerDocumentationUpdatedAt;
   return r
  });
  if(typeof pickup.updateTeamContainerDocumentation!=='function')throw pickup.err('CONTAINER_TEAM_SYNC_UNAVAILABLE',apiI18n.t(req,'api.container.teamSyncUnavailable'),503);
  const teamDoc=await pickup.updateTeamContainerDocumentation(updated);
  if(!linkedInTeam(teamDoc,updated,photo))throw pickup.err('CONTAINER_TEAM_SYNC_FAILED',apiI18n.t(req,'api.container.teamSyncFailed'),503);
  context.res=json(200,{ok:true,reference:updated.reference,photo:publicPhoto(req,photo),containerPhotos:(updated.containerPhotos||[]).map(p=>publicPhoto(req,p)).filter(Boolean),storedUnderReference:true,linkedToShipment:true,version:'RC1272'});
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-container-document RC1259',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'CONTAINER_PHOTO_UPLOAD_FAILED',message:message(req,e,'api.container.photoSaveFailed')})}
};
