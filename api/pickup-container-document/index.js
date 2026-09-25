'use strict';
const access=require('../shared/public-access-store');
const pickup=require('../shared/pickup-store');
const docs=require('../shared/container-document-store');
const apiI18n=require('../shared/i18n');

function json(status,body){return pickup.json(status,body)}
function mergePhoto(list,photo){
 const rows=Array.isArray(list)?list.slice():[];
 const next=rows.filter(x=>String(x&&x.kind||'').toLowerCase()!==photo.kind);
 next.push(photo);
 return next;
}
function text(v){return String(v==null?'':v).trim()}
function linkedInTeam(teamDoc,record,photo){
 const state=teamDoc&&teamDoc.state&&typeof teamDoc.state==='object'?teamDoc.state:teamDoc||{},shipments=Array.isArray(state.shipments)?state.shipments:[];
 const sid=text(record&&record.shipmentId),ref=text(record&&record.reference).toUpperCase(),sh=shipments.find(x=>(sid&&text(x&&(x.id||x.shipmentId))===sid)||(ref&&text(x&&(x.reference||x.ref)).toUpperCase()===ref));
 if(!sh)return false;
 const target=record&&record.subShipmentId&&Array.isArray(sh.subShipments)?sh.subShipments.find(x=>text(x&&x.subShipmentId)===text(record.subShipmentId)):sh;
 const photos=Array.isArray(target&&target.containerPhotos)?target.containerPhotos:[];
 return photos.some(x=>text(x&&x.kind).toLowerCase()===text(photo&&photo.kind).toLowerCase()&&(!text(photo&&photo.blobName)||text(x&&x.blobName)===text(photo&&photo.blobName)));
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
  context.res=json(200,{ok:true,reference:updated.reference,photo:docs.publicPhoto(photo),containerPhotos:(updated.containerPhotos||[]).map(docs.publicPhoto).filter(Boolean),storedUnderReference:true,linkedToShipment:true,version:'RC1277'});
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-container-document RC1259',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'CONTAINER_PHOTO_UPLOAD_FAILED',message:e.message||apiI18n.t(req,'api.container.photoSaveFailed')})}
};
