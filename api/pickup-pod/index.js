'use strict';
const access=require('../shared/public-access-store');
const store=require('../shared/pickup-store');
const apiI18n=require('../shared/i18n');
const podArchive=require('../shared/pod-archive');
function json(status,body){return store.json(status,body)}
function text(v){return String(v==null?'':v).trim()}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, OPTIONS','Cache-Control':'no-store'},body:''};return}if(req.method!=='GET'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.getOnly')});return}
 try{const token=text(req.query&&req.query.token),resolved=await access.resolve(req,'pickup',token,{allowUsed:true,allowUsedPickupDocument:true},req.query||{}),accessKey=resolved.resourceKey||resolved.tokenHash,got=await store.getRecord(accessKey,resolved.environment),rec=got.record||{},wantCustomsSignature=String(req.query&&req.query.customsSignature||'')==='1',wantSignature=wantCustomsSignature||String(req.query&&req.query.signature||'')==='1'||!text(req.query&&req.query.file),fileId=text(req.query&&req.query.file),history=typeof store.pickupHistory==='function'?store.pickupHistory(rec):(Array.isArray(rec.pickupHistory)?rec.pickupHistory:[]),complete=typeof store.pickupComplete==='function'?store.pickupComplete(rec):!!rec.confirmedAt;if(!complete&&!history.length)throw store.err('PICKUP_NOT_CONFIRMED',apiI18n.t(req,'api.pod.notConfirmed'),409);if(!wantSignature&&!complete)throw store.err('PICKUP_NOT_CONFIRMED',apiI18n.t(req,'api.pod.documentsNotConfirmed'),409);if(String(req.query&&req.query.manifest||'')==='1'){
  // Read-only manifest of exact signed originals. Never render/regenerate a POD here.
  const files=Array.isArray(rec.podFiles)?rec.podFiles:[];
  const originals=files.filter(function(f){
    if(!f||String(f.kind||'').toLowerCase()!=='automatic-pod')return false;
    const id=text(f.id||f.remoteId),hash=text(f.hash).toLowerCase();
    if(!/^[A-Za-z0-9_-]{3,180}$/.test(id)||!text(f.blobName||f.storageBlobName))return false;
    if(text(f.renderLayout).toUpperCase()==='RC1595')return true;
    // RC1600 server PDF is signed from the original stored driver signature.
    // Only an exact immutable, hash-addressed copy qualifies; no regeneration.
    return text(f.layoutVersion)==='RC1600-SIGNED-LOADING-LIST-V4'&&
      text(f.source)==='pickup-confirm-v3'&&/^[a-f0-9]{64}$/.test(hash)&&
      id==='automatic-pod-'+hash.slice(0,16);
  }).map(function(f){
    const server=text(f.renderLayout).toUpperCase()!=='RC1595';
    return Object.assign({id:text(f.id||f.remoteId),kind:'automatic-pod',uploadedAt:text(f.uploadedAt)},
      server?{layoutVersion:'RC1600-SIGNED-LOADING-LIST-V4',source:'pickup-confirm-v3',hash:text(f.hash).toLowerCase()}:
      {renderLayout:'RC1595'});
  });
  context.res=json(200,{ok:true,files:originals});return;
 }
 let blobName='',fallbackType='application/octet-stream';if(wantSignature){blobName=text(wantCustomsSignature?rec.customsDocumentsSignatureBlobName:rec.signatureBlobName);fallbackType=text(wantCustomsSignature?rec.customsDocumentsSignatureType:rec.signatureType)||'image/jpeg';if(!blobName)throw store.err(wantCustomsSignature?'CUSTOMS_SIGNATURE_NOT_FOUND':'SIGNATURE_NOT_FOUND',apiI18n.t(req,'api.pod.signatureNotFound'),404)}else{if(fileId==='automatic'){const pod=await podArchive.getPodDownload(accessKey,resolved.environment,null);context.res={status:200,headers:{'Content-Type':'application/pdf','Content-Length':String(pod.buffer.length),'Cache-Control':'private, no-store, no-cache, must-revalidate','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},isRaw:true,body:pod.buffer};return}const files=Array.isArray(rec.podFiles)?rec.podFiles:[],f=files.find(x=>text(x&&x.id)===fileId||text(x&&x.remoteId)===fileId);if(!f)throw store.err('POD_FILE_NOT_FOUND',apiI18n.t(req,'api.pod.fileNotFound'),404);if(String(f&&f.kind||'').toLowerCase()==='automatic-pod'){const pod=await podArchive.getPodDownload(accessKey,resolved.environment,fileId);context.res={status:200,headers:{'Content-Type':'application/pdf','Content-Length':String(pod.buffer.length),'Cache-Control':'private, no-store, no-cache, must-revalidate','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},isRaw:true,body:pod.buffer};return}blobName=text(f.blobName||f.storageBlobName||f.path||f.storagePath);fallbackType=text(f.type||f.mimeType)||'application/pdf';if(!blobName)throw store.err('POD_FILE_NOT_STORED',apiI18n.t(req,'api.pod.fileNotStored'),404)}const blob=got.clients.pods.getBlobClient(blobName);let read;try{read=await store.readBuffer(blob)}catch(e){if(e&&e.statusCode===404){try{const archive=await store.podArchiveClient(resolved.environment),archiveBlob=archive.podArchive.getBlobClient(blobName);read=await store.readBuffer(archiveBlob)}catch(archiveError){if(archiveError&&archiveError.statusCode===404)throw store.err(wantSignature?'SIGNATURE_NOT_FOUND':'POD_FILE_NOT_FOUND',wantSignature?apiI18n.t(req,'api.pod.signatureStorageMissing'):apiI18n.t(req,'api.pod.fileStorageMissing'),404);throw archiveError}}else throw e}context.res={status:200,headers:{'Content-Type':text(read.contentType)||fallbackType,'Content-Length':String(read.buffer.length),'Cache-Control':'private, no-store, no-cache, must-revalidate','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},isRaw:true,body:read.buffer}}catch(e){context.log&&context.log.error&&context.log.error('pickup-pod RC995',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||apiI18n.t(req,'api.pod.loadFailed')})}
};
