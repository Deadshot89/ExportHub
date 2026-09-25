'use strict';
const crypto=require('crypto');
const access=require('../shared/public-access-store');
const pins=require('../shared/loader-pin-store');
const store=require('../shared/pickup-store');
const containerDocs=require('../shared/container-document-store');
const apiI18n=require('../shared/i18n');
function count(v){const n=Math.round(Number(v));return Number.isFinite(n)&&n>0?n:0}
function json(status,body){return store.json(status,body,{'Cache-Control':'no-store, no-cache, must-revalidate'})}
function historyOf(r){return typeof store.pickupHistory==='function'?store.pickupHistory(r):(Array.isArray(r&&r.pickupHistory)?r.pickupHistory:[])}
function collectedOf(r){if(typeof store.pickupCollectedColliCount==='function')return store.pickupCollectedColliCount(r);const h=historyOf(r).reduce((n,x)=>n+Math.max(0,Math.round(Number(x&&x.colliCount)||0)),0),saved=Math.max(0,Math.round(Number(r&&r.collectedPickupCollis)||0));return Math.max(h,saved)}
function remainingOf(r){return typeof store.pickupRemainingColliCount==='function'?store.pickupRemainingColliCount(r):Math.max(0,store.expectedCollis(r)-collectedOf(r))}
function completeOf(r){return typeof store.pickupComplete==='function'?store.pickupComplete(r):(store.expectedCollis(r)>0&&remainingOf(r)===0)}
function shortError(e){return String((e&&e.code?e.code+': ':'')+(e&&e.message||'POD-Archivierung fehlgeschlagen')).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,500)}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res=json(204,{});return}if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.postOnly')});return}
 let resolved=null;
 try{
  const b=store.body(req),token=String(b.token||'').trim();resolved=await access.resolve(req,'pickup',token,{allowUsed:false},b);const accessKey=resolved.resourceKey||resolved.tokenHash;
  const personalPin=pins.text(b.pin||b.loaderPin||b.personalLoaderPin);if(!pins.validPin(personalPin)){await access.registerFailure(resolved.environment,'pickup',resolved.tokenHash,'pin-format');throw pins.error('INVALID_PIN',apiI18n.t(req,'api.pickup.pinRequired'),400)}
  const loader=await pins.findByPin(personalPin);if(!loader){const failed=await access.registerFailure(resolved.environment,'pickup',resolved.tokenHash,'pin');if(failed.lockedUntil)throw access.error('ACCESS_LOCKED',apiI18n.t(req,'api.pickup.accessLocked'),429);throw pins.error('INVALID_PIN',apiI18n.t(req,'api.pickup.pinInvalid'),401)}
  const got=await store.getRecord(accessKey,resolved.environment),current=got.record||{},providedRef=String(b.reference||b.shipmentRef||'').trim().toUpperCase();if(providedRef&&providedRef!==String(current.reference||'').trim().toUpperCase()){await access.registerFailure(resolved.environment,'pickup',resolved.tokenHash,'reference');throw store.err('REFERENCE_MISMATCH',apiI18n.t(req,'api.pickup.referenceMismatch'),403)}
  const signature=store.first(b,['driverSignature','signatureDataUrl','pickupSignature','signature','qrPickupSignature']);if(!signature)throw store.err('SIGNATURE_REQUIRED',apiI18n.t(req,'api.pickup.signatureRequired'),400);
  let uploadKey='';
  let rec=await store.mutateRecord(accessKey,resolved.environment,async function(r,clients){
   if(store.expired(r)&&!completeOf(r))throw store.err('EXPIRED',apiI18n.t(req,'api.pickup.expired'),410);if(completeOf(r)||r.status==='confirmed')throw store.err('ALREADY_CONFIRMED',apiI18n.t(req,'api.pickup.alreadyConfirmed'),410);
   const spedition=store.sanitizeText(store.first(b,['carrierName','speditionName','carrier','spedition'])||store.first(r,['carrierName','speditionName','carrier','spedition']),180);if(!spedition)throw store.err('CARRIER_REQUIRED',apiI18n.t(req,'api.pickup.carrierRequired'),409);
   const plate=store.sanitizeText(store.first(b,['licensePlate','vehicleLicensePlate','kennzeichen','plate']),80);if(!plate)throw store.err('LICENSE_PLATE_REQUIRED',apiI18n.t(req,'api.pickup.plateRequired'),409);
   const expected=store.expectedCollis(r),remainingBefore=remainingOf(r),entered=count(store.first(b,['enteredColliCount','colliCount','pickupColliCount'])),mode=String(b.pickupMode||b.mode||'complete').toLowerCase();if(!expected)throw store.err('COLLI_EXPECTED_MISSING',apiI18n.t(req,'api.pickup.expectedColliMissing'),409);if(!entered)throw store.err('COLLI_REQUIRED',apiI18n.t(req,'api.pickup.colliRequired'),400);if(entered>remainingBefore)throw store.err('COLLI_EXCEEDS_REMAINING',apiI18n.t(req,'api.pickup.colliExceedsRemaining'),409);if(mode==='complete'&&entered!==remainingBefore)throw store.err('COLLI_MISMATCH',apiI18n.t(req,'api.pickup.colliMismatch'),409);
   const sealNumber=store.sanitizeText(store.first(b,['sealNumber','containerSealNumber','siegelnummer'])||r.sealNumber||'',120),containerRequired=typeof store.containerDocumentationRequired==='function'?store.containerDocumentationRequired(r):r.containerDocumentationRequired===true,containerPhotos=typeof store.containerPhotosOf==='function'?store.containerPhotosOf(r):(Array.isArray(r.containerPhotos)?r.containerPhotos:[]);
   if(mode==='complete'&&containerRequired&&!sealNumber)throw store.err('CONTAINER_SEAL_REQUIRED',apiI18n.t(req,'api.pickup.sealRequired'),409);
   if(mode==='complete'&&containerRequired&&!containerDocs.completePhotos(containerPhotos))throw store.err('CONTAINER_PHOTOS_REQUIRED',apiI18n.t(req,'api.pickup.photosRequired'),409);
   const sequence=historyOf(r).length+1,signatureMeta=await store.saveDriverSignature(clients,r,signature,String(sequence)),iso=store.now(),collectedAfter=collectedOf(r)+entered,remainingAfter=Math.max(0,expected-collectedAfter),complete=remainingAfter===0;
   const item={id:'pickup-'+sequence,sequence,type:complete?'complete':'partial',confirmedAt:iso,colliCount:entered,collectedAfter,remainingAfter,complete,driverName:store.sanitizeText(store.first(b,['driverName','pickupDriverName','confirmedBy']),180),licensePlate:plate,loaderName:loader.name,loaderId:loader.id,carrierName:spedition,returnedEuroPallets:Math.max(0,Math.round(Number(b.returnedEuroPallets||b.returnPallets||0)||0)),signatureBlobName:signatureMeta.signatureBlobName,signatureType:signatureMeta.signatureType,signatureSize:signatureMeta.signatureSize,signatureStoredAt:signatureMeta.signatureStoredAt,signatureStored:true};
   r.pickupHistory=historyOf(r).concat(item);r.collectedPickupCollis=collectedAfter;r.pickupCollectedColliCount=collectedAfter;r.remainingPickupCollis=remainingAfter;r.pickupRemainingColliCount=remainingAfter;r.partialPickup=!complete;r.status=complete?'confirmed':'partial';r.complete=complete;r.confirmedAt=complete?iso:null;r.lastPartialPickupAt=iso;r.updatedAt=iso;r.failedAttempts=0;r.lockedUntil=null;r.driverName=item.driverName;r.licensePlate=plate;r.loaderName=loader.name;r.loadedBy=loader.name;r.loader=loader.name;r.verlader=loader.name;r.loaderId=loader.id;r.carrierName=spedition;r.speditionName=spedition;r.carrier=spedition;r.spedition=spedition;r.enteredColliCount=entered;r.confirmedColliCount=entered;r.colliCountConfirmed=true;r.colliConfirmed=true;r.pickupColliCountConfirmed=true;r.signatureBlobName=signatureMeta.signatureBlobName;r.signatureType=signatureMeta.signatureType;r.signatureSize=signatureMeta.signatureSize;r.signatureStoredAt=signatureMeta.signatureStoredAt;r.podType='signed-loadlist';r.podFiles=store.realPodFiles(r);if(sealNumber)r.sealNumber=sealNumber;r.containerDocumentationUpdatedAt=iso;r.confirmationVersion='RC1259';
   if(complete){uploadKey=crypto.randomBytes(32).toString('hex');r.uploadKeyHash=store.hash(uploadKey);r.uploadKeyExpiresAt=new Date(Date.now()+2*3600000).toISOString();r.podBackup=Object.assign({},r.podBackup||{},{status:'pending',archiveSaved:false,driveSaved:false,lastError:'',lastAttemptAt:null})}
   return r
  });
  const complete=completeOf(rec),history=historyOf(rec),last=history[history.length-1]||{};
  if(complete)await access.consume(resolved.environment,'pickup',resolved.tokenHash,{reason:'pickup-confirmed',fields:{confirmedAt:rec.confirmedAt,loaderId:loader.id}});if(!complete)await access.clearFailures(resolved.environment,'pickup',resolved.tokenHash);
  if(typeof store.updateTeamContainerDocumentation==='function'){try{await store.updateTeamContainerDocumentation(rec)}catch(e){context.log&&context.log.error&&context.log.error('RC1259 container team state update failed',e&&e.code,e&&e.message)}}
  try{await store.updateTeam(rec,[],'')}catch(e){context.log&&context.log.error&&context.log.error('RC1259 team state update failed',e&&e.code,e&&e.message)}

  let archiveResult=null,archiveFailure='',podArchive=null;
  if(complete){
   podArchive=require('../shared/pod-archive');
   try{
    archiveResult=await podArchive.ensureAutomaticPod(accessKey,resolved.environment,{copyToDrive:true});
    if(archiveResult&&archiveResult.record)rec=archiveResult.record;
    try{await store.updateTeam(rec,[],'')}catch(e){context.log&&context.log.error&&context.log.error('RC1114 POD team state update failed',e&&e.code,e&&e.message)}
   }catch(e){
    archiveFailure=shortError(e);
    context.log&&context.log.error&&context.log.error('RC1114 automatic POD archive failed',e&&e.code,e&&e.message);
    try{
     rec=await store.mutateRecord(accessKey,resolved.environment,function(r){
      r.podBackup=Object.assign({},r.podBackup||{},{status:'error',archiveSaved:false,driveSaved:false,lastAttemptAt:store.now(),attempts:Math.max(0,Number(r.podBackup&&r.podBackup.attempts)||0)+1,lastError:archiveFailure});
      r.updatedAt=store.now();
      return r
     })
    }catch(_){}
   }
  }

  const backup=rec&&rec.podBackup||{},autoPod=podArchive&&typeof podArchive.automaticPod==='function'?podArchive.automaticPod(rec):null;
  context.res=json(200,Object.assign(store.publicRecord(rec,token),{
   ok:true,
   pickedUp:complete,
   partial:!complete,
   complete,
   status:complete?'confirmed':'partial',
   shipmentStatus:complete?'Abgeholt':'Teilweise abgeholt',
   uploadKey:complete?uploadKey:'',
   uploadExpiresAt:complete?rec.uploadKeyExpiresAt:null,
   signatureStored:true,
   signatureBlobName:last.signatureBlobName||rec.signatureBlobName||'',
   sequence:last.sequence||history.length,
   remainingAfter:last.remainingAfter,
   loaderName:loader.name,
   loadedBy:loader.name,
   loader:loader.name,
   verlader:loader.name,
   loaderId:loader.id,
   personalPinValidated:true,
   oneTimeConsumed:complete,
   podAzureSaved:complete?backup.azureSaved===true:false,
   podArchiveSaved:complete?backup.archiveSaved===true:false,
   podDriveSaved:complete?backup.driveSaved===true:false,
   podBackupStatus:complete?(backup.status||archiveFailure&&'error'||'pending'):'not-applicable',
   podBackupError:complete?(backup.lastError||archiveFailure||''):'',
   podFileName:autoPod&&autoPod.name||backup.fileName||'',
   version:'RC1259'
  }));
 }catch(e){context.log&&context.log.error&&context.log.error('pickup-confirm-v2 RC1259',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||apiI18n.t(req,'api.pickup.confirmFailed')})}
};
