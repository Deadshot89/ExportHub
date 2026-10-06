'use strict';

const crypto=require('crypto');
const store=require('./pickup-store');
const podArchive=require('./pod-archive');

const VERSION='RC1440';
const ACTOR='RC1440 POD Integrity Audit';

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLocaleLowerCase('de-DE')}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function now(){return new Date().toISOString()}
function refOf(sh){return text(sh&&(sh.ref||sh.reference||sh.referenceNumber||sh.shipmentRef||sh.id||sh.shipmentId)).toUpperCase()}
function statusIsPod(sh){return lower(sh&&sh.status)==='pod vorhanden'||lower(sh&&sh.processStatus)==='pod vorhanden'}
function customerNameValue(sh,state){
 const direct=sh?[sh.customerName,sh.customerDisplayName,sh.customerCompany,sh.companyName,typeof sh.customer==='string'?sh.customer:'',sh.customer&&sh.customer.name,sh.customer&&sh.customer.customerName,sh.customer&&sh.customer.companyName]:[];
 for(const value of direct){const v=text(value);if(v)return v}
 const id=text(sh&&(sh.customerId||sh.customerNumber||sh.customerAccount||sh.account)).toUpperCase();
 const customers=Array.isArray(state&&state.customers)?state.customers:[];
 if(id){
  for(const item of customers){
   const keys=[item&&item.id,item&&item.customerId,item&&item.customerNumber,item&&item.account,item&&item.kundennummer].map(v=>text(v).toUpperCase());
   if(keys.includes(id))return text(item&&item.name||item&&item.customerName||item&&item.companyName)
  }
 }
 return''
}
function isEssentraShipment(sh,state){return /\bessentra\b/i.test(customerNameValue(sh,state))}
function realFiles(list){return(Array.isArray(list)?list:[]).filter(file=>lower(file&&file.kind)!=='scan-confirmation')}
function fileBlobName(file){return text(file&&(file.blobName||file.storageBlobName||file.path||file.storagePath))}
function fileKey(file){return text(file&&(file.id||file.remoteId||fileBlobName(file)||file.name||file.fileName))}
function shipmentFiles(sh){
 const out=[];
 realFiles(sh&&sh.podFiles).forEach(file=>out.push({file,owner:'shipment'}));
 for(const sub of Array.isArray(sh&&sh.subShipments)?sh.subShipments:[]){
  realFiles(sub&&sub.podFiles).forEach(file=>out.push({file,owner:text(sub&&sub.subShipmentId||sub&&sub.id||sub&&sub.subShipmentSequence)}));
 }
 return out
}
function looksLikePodBuffer(buffer,file){
 if(!Buffer.isBuffer(buffer)||buffer.length<32)return false;
 const type=lower(file&&(file.type||file.mimeType));
 const name=lower(file&&(file.name||file.fileName||file.filename));
 if(type.includes('pdf')||/\.pdf$/.test(name))return buffer.subarray(0,8).toString('latin1').includes('%PDF-');
 return true
}
function sanitizeDurableFile(file){
 const out=clone(file||{});
 delete out.url;delete out.downloadUrl;delete out.href;delete out.objectUrl;delete out.contentUrl;delete out.data;delete out.dataUrl;
 return out
}
function accessKeysOf(sh,environment){
 const keys=new Set(),add=value=>{const v=text(value).toLowerCase();if(/^[a-f0-9]{64}$/.test(v))keys.add(v)};
 add(sh&&sh.pickupAccessKeyHash);add(sh&&sh.accessKey);
 for(const sub of Array.isArray(sh&&sh.subShipments)?sh.subShipments:[]){add(sub&&sub.pickupAccessKeyHash);add(sub&&sub.accessKey)}
 for(const item of shipmentFiles(sh)){
  const name=fileBlobName(item.file),m=name.match(new RegExp('^rc995/'+String(environment).replace(/[^a-z]/g,'')+'/([a-f0-9]{64})/','i'));
  if(m)add(m[1])
 }
 return Array.from(keys)
}
function applyBrokenPodPolicy(sh,essentra,invalidKeys){
 const out=clone(sh||{}),bad=new Set(Array.isArray(invalidKeys)?invalidKeys.map(text).filter(Boolean):[]);
 out.status='Abgeholt';
 out.processStatus='Abgeholt';
 if(essentra)return out;
 const clean=list=>realFiles(list).filter(file=>bad.size&&!bad.has(fileKey(file))).concat((Array.isArray(list)?list:[]).filter(file=>lower(file&&file.kind)==='scan-confirmation'));
 out.podFiles=bad.size?clean(out.podFiles):[];
 if(Array.isArray(out.subShipments))out.subShipments=out.subShipments.map(sub=>Object.assign({},sub,{podFiles:bad.size?clean(sub&&sub.podFiles):[]}));
 out.podAvailable=false;
 out.podConfirmed=false;
 out.hasPod=false;
 out.podStatus='POD fehlt';
 return out
}
async function readStoredPod(clients,file){
 const blobName=fileBlobName(file);
 if(!blobName)return{ok:false,code:'POD_STORAGE_REFERENCE_MISSING'};
 try{
  const read=await store.readBuffer(clients.pods.getBlobClient(blobName));
  if(!looksLikePodBuffer(read.buffer,file))return{ok:false,code:'POD_CONTENT_INVALID',blobName};
  return{ok:true,blobName,bytes:read.buffer.length,buffer:read.buffer,contentType:read.contentType||text(file&&file.type)}
 }catch(error){
  return{ok:false,code:text(error&&error.code)||((error&&error.statusCode===404)?'POD_BLOB_NOT_FOUND':'POD_READ_FAILED'),status:Number(error&&error.statusCode||0),blobName,error}
 }
}
async function verifyRecordPod(accessKey,environment){
 let got;
 try{got=await store.getRecord(accessKey,environment)}catch(error){return{ok:false,code:text(error&&error.code)||'PICKUP_RECORD_NOT_FOUND',error}}
 let record=got.record||{},file=podArchive.automaticPod(record),primary=null;
 if(file)primary=await readStoredPod(got.clients,file);
 if(primary&&primary.ok){
  try{
   const archive=await podArchive.checkAzureArchive(got.clients,record,accessKey,true);
   if(!archive.ok){
    const saved=await podArchive.saveAzureArchive(accessKey,environment,record,primary.buffer,file);
    record=saved.record||record;
   }
   return{ok:true,recovered:false,record,file:sanitizeDurableFile(file),bytes:primary.bytes}
  }catch(_){
   // A readable primary POD is still valid for the user's status contract.
   return{ok:true,recovered:false,record,file:sanitizeDurableFile(file),bytes:primary.bytes,backupWarning:true}
  }
 }
 if(file&&record&&record.podBackup&&record.podBackup.archiveSaved===true&&text(record.podBackup.archiveBlobName)){
  try{
   const integrity=await podArchive.checkAzureArchive(got.clients,record,accessKey,true);
   if(integrity.ok){
    const archiveClients=await store.podArchiveClient(environment);
    const archiveRead=await store.readBuffer(archiveClients.podArchive.getBlobClient(text(record.podBackup.archiveBlobName)));
    if(looksLikePodBuffer(archiveRead.buffer,file)){
     const restored=await podArchive.saveSuppliedPod(accessKey,environment,record,archiveRead.buffer,file.name);
     record=restored.record||record;file=restored.file||podArchive.automaticPod(record);
     const reread=file?await readStoredPod((await store.getRecord(accessKey,environment)).clients,file):{ok:false};
     if(reread.ok)return{ok:true,recovered:true,recovery:'archive',record,file:sanitizeDurableFile(file),bytes:reread.bytes}
    }
   }
  }catch(_){}
 }
 try{
  const regenerated=await podArchive.ensureAutomaticPod(accessKey,environment,{copyToDrive:true});
  record=regenerated&&regenerated.record||record;file=regenerated&&regenerated.file||podArchive.automaticPod(record);
  const latest=await store.getRecord(accessKey,environment),reread=file?await readStoredPod(latest.clients,file):{ok:false};
  if(reread.ok)return{ok:true,recovered:true,recovery:'signature',record:latest.record||record,file:sanitizeDurableFile(file),bytes:reread.bytes}
 }catch(error){return{ok:false,code:text(error&&error.code)||'POD_RECOVERY_FAILED',error,record}}
 return{ok:false,code:'POD_NOT_DOWNLOADABLE',record}
}
function relinkRecoveredFiles(sh,recoveredByKey){
 const out=clone(sh||{}),keys=Object.keys(recoveredByKey||{});
 if(!keys.length)return out;
 const own=text(out.pickupAccessKeyHash||out.accessKey).toLowerCase();
 if(own&&recoveredByKey[own])out.podFiles=[sanitizeDurableFile(recoveredByKey[own].file)];
 if(Array.isArray(out.subShipments))out.subShipments=out.subShipments.map(sub=>{
  const key=text(sub&&(sub.pickupAccessKeyHash||sub.accessKey)).toLowerCase();
  return key&&recoveredByKey[key]?Object.assign({},sub,{podFiles:[sanitizeDurableFile(recoveredByKey[key].file)]}):sub
 });
 if(!own&&keys.length===1&&!Array.isArray(out.subShipments))out.podFiles=[sanitizeDurableFile(recoveredByKey[keys[0]].file)];
 return out
}
async function verifyShipmentPod(sh,state,clients,environment){
 const files=shipmentFiles(sh),invalidKeys=[],directChecks=[];
 for(const item of files){
  const check=await readStoredPod(clients,item.file);directChecks.push(check);
  if(!check.ok)invalidKeys.push(fileKey(item.file))
 }
 const directOk=files.length>0&&directChecks.every(check=>check.ok);
 const keys=accessKeysOf(sh,environment),recoveredByKey={},recordResults=[];
 if(!directOk&&keys.length){
  for(const key of keys){
   const result=await verifyRecordPod(key,environment);recordResults.push({key,result});
   if(result.ok&&result.file)recoveredByKey[key]=result
  }
  if(recordResults.length&&recordResults.every(row=>row.result.ok)){
   return{ok:true,recovered:recordResults.some(row=>row.result.recovered),shipment:relinkRecoveredFiles(sh,recoveredByKey),invalidKeys:[],accessKeys:keys,recordResults}
  }
 }
 if(directOk)return{ok:true,recovered:false,shipment:clone(sh),invalidKeys:[],accessKeys:keys,recordResults};
 return{ok:false,recovered:false,shipment:clone(sh),invalidKeys:invalidKeys.length?invalidKeys:files.map(item=>fileKey(item.file)).filter(Boolean),accessKeys:keys,recordResults,code:'POD_NOT_DOWNLOADABLE'}
}
async function createVerifiedStateBackup(teamContainer,environment,doc){
 const stamp=now().replace(/[:.]/g,'-'),prefix=environment==='testservice'?'testservice/recovery-backups/':'recovery-backups/';
 const name=prefix+'team-state-before-RC1440-pod-integrity-'+stamp+'.json',raw=JSON.stringify(doc),buffer=Buffer.from(raw,'utf8'),sha256=crypto.createHash('sha256').update(buffer).digest('hex'),blob=teamContainer.getBlockBlobClient(name);
 await blob.upload(buffer,buffer.length,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:{ifNoneMatch:'*'},metadata:{purpose:'rc1440-pod-integrity-audit',sha256}});
 const read=await store.readBuffer(blob),actual=crypto.createHash('sha256').update(read.buffer).digest('hex');
 if(read.buffer.length!==buffer.length||actual!==sha256)throw store.err('POD_AUDIT_BACKUP_VERIFY_FAILED','RC1440 konnte den Produktions-State vor der POD-Bereinigung nicht verifiziert sichern.',500);
 return{name,bytes:buffer.length,sha256,verified:true}
}
async function quarantinePickupRecord(accessKey,environment,reference){
 try{
  await store.mutateRecord(accessKey,environment,function(record){
   const existing=Array.isArray(record.podIntegrityQuarantine)?record.podIntegrityQuarantine:[],removed=realFiles(record.podFiles).map(sanitizeDurableFile);
   record.podIntegrityQuarantine=existing.concat(removed.map(file=>({at:now(),version:VERSION,reason:'POD_NOT_DOWNLOADABLE',reference:text(reference),file}))).slice(-50);
   record.podFiles=(Array.isArray(record.podFiles)?record.podFiles:[]).filter(file=>lower(file&&file.kind)==='scan-confirmation');
   record.podBackup=Object.assign({},record.podBackup||{},{status:'error',azureSaved:false,archiveSaved:false,driveSaved:false,lastAttemptAt:now(),lastError:'RC1440 POD_NOT_DOWNLOADABLE'});
   record.updatedAt=now();return record
  });
  return{ok:true}
 }catch(error){return{ok:false,code:text(error&&error.code)||'PICKUP_QUARANTINE_FAILED',error:text(error&&error.message).slice(0,250)}}
}
async function auditPodStatuses(environment,options){
 options=Object.assign({cursor:0,limit:10},options||{});environment=store.normalizeEnvironment(environment);
 if(environment!=='production'&&environment!=='testservice')throw store.err('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Umgebung.',400);
 const clients=await store.clients(environment),teamBlob=clients.team.getBlockBlobClient(store.teamBlobName(environment)),read=await store.readJson(teamBlob,{schemaVersion:3,revision:0,state:{},users:[]}),doc=read.value||{schemaVersion:3,revision:0,state:{},users:[]};
 doc.state=doc.state||{};doc.state.shipments=Array.isArray(doc.state.shipments)?doc.state.shipments:[];
 const shipments=doc.state.shipments,start=Math.max(0,Math.round(Number(options.cursor)||0)),limit=Math.min(25,Math.max(1,Math.round(Number(options.limit)||10)),selected=[];let scan=start;
 while(scan<shipments.length&&selected.length<limit){if(statusIsPod(shipments[scan]))selected.push({index:scan,shipment:shipments[scan]});scan++}
 const nextCursor=scan<shipments.length?scan:null;
 if(!selected.length)return{ok:true,version:VERSION,environment,cursor:start,nextCursor,totalShipments:shipments.length,checked:0,downloadable:0,recovered:0,downgradedEssentra:0,downgradedOther:0,removedPodEntries:0,recordCleanupErrors:[],backup:null,changed:false};
 const backup=await createVerifiedStateBackup(clients.team,environment,doc);
 let downloadable=0,recovered=0,downgradedEssentra=0,downgradedOther=0,removedPodEntries=0,changed=false;const broken=[],recordCleanup=[];
 for(const row of selected){
  const original=row.shipment,reference=refOf(original),essentra=isEssentraShipment(original,doc.state),verification=await verifyShipmentPod(original,doc.state,clients,environment);
  if(verification.ok){
   downloadable++;
   const next=verification.shipment||original;
   if(verification.recovered){recovered++;shipments[row.index]=next;changed=true}
   continue
  }
  const beforeCount=shipmentFiles(original).length,next=applyBrokenPodPolicy(original,essentra,verification.invalidKeys);
  shipments[row.index]=next;changed=true;broken.push({reference,essentra,code:verification.code||'POD_NOT_DOWNLOADABLE'});
  if(essentra)downgradedEssentra++;
  else{
   downgradedOther++;removedPodEntries+=Math.max(0,beforeCount-shipmentFiles(next).length);
   for(const accessKey of verification.accessKeys||[])recordCleanup.push({accessKey,reference})
  }
 }
 const cleanupErrors=[];
 if(changed){
  const at=now();doc.revision=Number(doc.revision||0)+1;doc.updatedAt=at;doc.updatedBy=ACTOR;doc.updatedByDevice='github-actions';doc.clientVersion=VERSION;
  doc.state.podIntegrityAudit={version:VERSION,at,actor:ACTOR,checked:selected.length,downloadable,recovered,downgradedEssentra,downgradedOther,removedPodEntries,backupBlob:backup.name,brokenReferences:broken.map(item=>item.reference).filter(Boolean).slice(0,100)};
  try{await store.writeJson(teamBlob,doc,read.etag)}catch(error){if(error&&(error.statusCode===409||error.statusCode===412))throw store.err('POD_AUDIT_STATE_CONFLICT','Der Team-State wurde während des POD-Audits geändert. RC1440 hat die Bereinigung sicher abgebrochen.',409);throw error}
  const seen=new Set();
  for(const item of recordCleanup){if(!item.accessKey||seen.has(item.accessKey))continue;seen.add(item.accessKey);const result=await quarantinePickupRecord(item.accessKey,environment,item.reference);if(!result.ok)cleanupErrors.push({reference:item.reference,code:result.code})}
 }
 return{ok:cleanupErrors.length===0,version:VERSION,environment,cursor:start,nextCursor,totalShipments:shipments.length,checked:selected.length,downloadable,recovered,downgradedEssentra,downgradedOther,removedPodEntries,broken,recordCleanupErrors:cleanupErrors,backup,changed}
}

module.exports={VERSION,statusIsPod,customerNameValue,isEssentraShipment,looksLikePodBuffer,applyBrokenPodPolicy,verifyShipmentPod,verifyRecordPod,createVerifiedStateBackup,auditPodStatuses};
