'use strict';
const store=require('../shared/pickup-store');
const policy=require('../shared/user-policy');
function lower(v){return text(v).toLowerCase()}
function text(v){return String(v==null?'':v).trim()}

async function authorize(req,record){
 if(process.env.AZURE_FUNCTIONS_ENVIRONMENT==='Development')return true;
 const p=store.principal(req);if(!p)return false;
 const c=await store.clients(),d=await store.readJson(c.team.getBlockBlobClient(store.TEAM_BLOB)),doc=d.value||{},state=doc.state||{};
 const users=[...(Array.isArray(doc.users)?doc.users:[]),...(Array.isArray(state.users)?state.users:[])],ids=[p.userDetails,p.userId].map(lower).filter(Boolean);
 const user=users.find(x=>[x.microsoftEmail,x.email,x.mail,x.user,x.login,x.username,x.name].map(lower).some(v=>v&&ids.includes(v)));
 if(policy.isAdmin(user)||(p.userRoles||[]).some(r=>/admin/i.test(String(r))))return true;
 const ref=text(record.reference).toUpperCase(),sid=text(record.shipmentId),sh=(Array.isArray(state.shipments)?state.shipments:[]).find(x=>(sid&&text(x.id||x.shipmentId)===sid)||(ref&&text(x.ref).toUpperCase()===ref));
 if(!sh)throw store.err('SHIPMENT_NOT_FOUND','Die zugehörige Sendung wurde nicht gefunden.',404);
 const creator=[sh.createdBy,sh.creator,sh.process&&sh.process.savedBy,sh.createdByEmail,sh.createdByUser].map(lower).filter(Boolean);
 const actorNames=[...ids,user&&lower(user.name),user&&lower(user.user),user&&lower(user.login)].filter(Boolean);
 return creator.some(v=>actorNames.includes(v));
}
async function updateTeamControl(record,action,reason,actor){
 const c=await store.clients(),blob=c.team.getBlockBlobClient(store.TEAM_BLOB);
 for(let i=0;i<6;i++){
  const d=await store.readJson(blob),doc=d.value||{schemaVersion:3,revision:0,state:{},users:[]};doc.state=doc.state||{};doc.state.shipments=Array.isArray(doc.state.shipments)?doc.state.shipments:[];doc.state.tasks=Array.isArray(doc.state.tasks)?doc.state.tasks:[];
  const ref=text(record.reference).toUpperCase(),sid=text(record.shipmentId),sh=doc.state.shipments.find(x=>(sid&&text(x.id||x.shipmentId)===sid)||(ref&&text(x.ref).toUpperCase()===ref));
  if(!sh)throw store.err('SHIPMENT_NOT_FOUND','Die zugehörige Sendung wurde nicht gefunden.',404);
  const iso=store.now();
  if(action==='cancel'){
   sh.processStatus='Storniert';sh.status='Storniert';sh.cancelledAt=iso;sh.cancelledBy=actor;sh.cancellationReason=reason;sh.pickupQrSuspended=true;
   store.stampSyncFields(sh,['processStatus','status','cancelledAt','cancelledBy','cancellationReason','pickupQrSuspended'],iso,'pickup-control');
   for(const t of doc.state.tasks){if(((sid&&text(t.linkedShipmentId)===sid)||(ref&&text(t.linkedShipmentRef).toUpperCase()===ref))&&!t.done){t.status='storniert';t.cancelledAt=iso;t.cancelledBy=actor;t.cancellationReason=reason;store.stampSyncFields(t,['status','cancelledAt','cancelledBy','cancellationReason'],iso,'pickup-control')}}
  }else{
   sh.processStatus='Entwurf';sh.status='Entwurf';sh.reopenedAt=iso;sh.reopenedBy=actor;sh.pickupQrSuspended=false;sh.pickupQrUsed=false;sh.pickupQrUsedAt='';sh.podScanConfirmed=false;sh.actualPickupDate='';sh.actualPickupTime='';sh.pickedUpAt='';
   if(Array.isArray(sh.podFiles)&&sh.podFiles.length){sh.podHistory=Array.isArray(sh.podHistory)?sh.podHistory:[];sh.podHistory.push({archivedAt:iso,reason:'Wiederöffnung',files:sh.podFiles});sh.podFiles=[];sh.podStatus='offen';sh.podCount=0}
   store.stampSyncFields(sh,['processStatus','status','reopenedAt','reopenedBy','pickupQrSuspended','pickupQrUsed','pickupQrUsedAt','podScanConfirmed','actualPickupDate','actualPickupTime','pickedUpAt','podFiles','podStatus','podCount'],iso,'pickup-control');
   for(const t of doc.state.tasks){if((sid&&text(t.linkedShipmentId)===sid)||(ref&&text(t.linkedShipmentRef).toUpperCase()===ref)){if(text(t.area).toLowerCase()==='abholtag'){t.status='offen';t.done=false;t.completedAt='';t.cancelledAt='';store.stampSyncFields(t,['status','done','completedAt','cancelledAt'],iso,'pickup-control')}}}
  }
  doc.revision=Number(doc.revision||0)+1;doc.updatedAt=iso;doc.updatedBy=actor;doc.updatedByDevice='pickup-control';doc.clientVersion='RC540';
  try{await store.writeJson(blob,doc,d.etag);return sh}catch(e){if(e&&e.statusCode===412&&i<5)continue;throw e}
 }
}
module.exports=async function(context,req){
 if(req.method!=='POST'){context.res=store.json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST'});return}
 if(!store.principal(req)&&process.env.AZURE_FUNCTIONS_ENVIRONMENT!=='Development'){context.res=store.json(401,{ok:false,code:'AUTH_REQUIRED',message:'Microsoft-Anmeldung erforderlich.'});return}
 try{
  const b=store.body(req),token=text(b.token).toLowerCase(),action=text(b.action).toLowerCase(),reason=text(b.reason),actor=store.actor(req);
  if(!store.validToken(token))throw store.err('INVALID_TOKEN','Ungültiges QR-Token.',400);
  if(!['cancel','reopen'].includes(action))throw store.err('INVALID_ACTION','Aktion ist ungültig.',400);
  if(action==='cancel'&&!reason)throw store.err('CANCELLATION_REASON_REQUIRED','Ein Stornierungsgrund ist erforderlich.',400);
  const initial=await store.getRecord(token);if(!(await authorize(req,initial.record)))throw store.err('FORBIDDEN','Nur der Ersteller der Sendung oder ein Administrator darf den Status zurücksetzen.',403);
  const record=await store.mutateRecord(token,async r=>{
   const iso=store.now();
   if(action==='cancel'){r.suspended=true;r.status='cancelled';r.cancelledAt=iso;r.cancelledBy=actor;r.cancellationReason=reason;r.updatedAt=iso;return r}
   r.history=Array.isArray(r.history)?r.history:[];if(r.confirmedAt||r.podFiles&&r.podFiles.length)r.history.push({closedAt:iso,confirmedAt:r.confirmedAt||null,podFiles:Array.isArray(r.podFiles)?r.podFiles:[]});
   r.suspended=false;r.status='open';r.confirmedAt=null;r.failedAttempts=0;r.lockedUntil=null;r.uploadKeyHash='';r.uploadKeyExpiresAt='';r.podFiles=[];r.reopenedAt=iso;r.reopenedBy=actor;r.updatedAt=iso;return r;
  });
  await updateTeamControl(record,action,reason,actor);
  context.res=store.json(200,{ok:true,status:record.status,token:record.token,reusedToken:true,suspended:Boolean(record.suspended),reopenedAt:record.reopenedAt||null,cancelledAt:record.cancelledAt||null});
 }catch(e){context.log&&context.log.error&&context.log.error(e);context.res=store.json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'QR-Steuerung fehlgeschlagen.'})}
};
