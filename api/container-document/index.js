'use strict';
const auth=require('../shared/fast-auth-store');
const pickup=require('../shared/pickup-store');
const docs=require('../shared/container-document-store');

function text(v){return String(v==null?'':v).trim()}
function json(status,body){return pickup.json(status,body)}
function allowed(user){
 if(auth.isAdmin&&auth.isAdmin(user))return true;
 const rights=user&&user.rights||{};
 return ['shipmentoverview','shipment','documents'].some(k=>{const r=rights[k];return !!(r&&(r.read===true||r.edit===true||r.admin===true||r.functionAdmin===true||r.level==='read'||r.level==='edit'||r.level==='admin'))});
}
function photosOf(sh){
 const out=Array.isArray(sh&&sh.containerPhotos)?sh.containerPhotos.slice():[];
 const subs=Array.isArray(sh&&sh.subShipments)?sh.subShipments:[];
 subs.forEach(sub=>(Array.isArray(sub&&sub.containerPhotos)?sub.containerPhotos:[]).forEach(p=>{if(!out.some(x=>text(x&&x.id)===text(p&&p.id)&&text(x&&x.blobName)===text(p&&p.blobName)))out.push(p)}));
 return out;
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='GET'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur GET ist erlaubt.'});return}
 try{
  const session=await auth.validateSession(req);if(!allowed(session.user))throw auth.error('CONTAINER_PHOTO_FORBIDDEN','Für Containerfotos fehlt das Leserecht.',403);
  const q=req.query||{},reference=text(q.reference).toUpperCase(),file=text(q.file),kind=text(q.kind).toLowerCase();
  if(!reference)throw auth.error('REFERENCE_REQUIRED','Sendungsreferenz fehlt.',400);
  const state=session.team&&session.team.state||{},shipments=Array.isArray(state.shipments)?state.shipments:[],sh=shipments.find(x=>text(x&&(x.reference||x.ref||x.shipmentRef||x.referenceNumber||x.id||x.shipmentId)).toUpperCase()===reference);
  if(!sh)throw auth.error('SHIPMENT_NOT_FOUND','Sendung wurde nicht gefunden.',404);
  const photos=photosOf(sh),photo=photos.find(x=>(file&&text(x&&x.id)===file)||(kind&&text(x&&x.kind).toLowerCase()===kind));
  if(!photo)throw auth.error('CONTAINER_PHOTO_NOT_FOUND','Containerfoto wurde nicht gefunden.',404);
  const result=await docs.readPhoto(photo),download=String(q.download||'')==='1',name=text(photo.name)||'Containerfoto.jpg';
  context.res={status:200,isRaw:true,headers:{'Content-Type':result.contentType,'Content-Length':String(result.buffer.length),'Content-Disposition':(download?'attachment':'inline')+'; filename="'+name.replace(/["\r\n]/g,'_')+'"','Cache-Control':'private, no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'},body:result.buffer};
 }catch(e){context.log&&context.log.error&&context.log.error('container-document RC1259',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'CONTAINER_PHOTO_READ_FAILED',message:e.message||'Containerfoto konnte nicht geladen werden.'})}
};
