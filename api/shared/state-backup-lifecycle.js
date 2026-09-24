'use strict';

const crypto=require('crypto');

const TIERS=Object.freeze({
 daily:Object.freeze({minimumRetentionDays:35}),
 monthly:Object.freeze({minimumRetentionDays:730}),
 yearly:Object.freeze({minimumRetentionDays:2555})
});

function text(v){return String(v==null?'':v).trim()}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;e.statusCode=status;return e}
function normalizeEnvironment(value){
 const env=text(value).toLowerCase();
 if(env!=='production'&&env!=='testservice')throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Umgebung.');
 return env;
}
function normalizeTier(value){
 const tier=text(value).toLowerCase();
 if(!Object.prototype.hasOwnProperty.call(TIERS,tier))throw error('BACKUP_TIER_INVALID','Erlaubt sind daily, monthly und yearly.');
 return tier;
}
function dateParts(value){
 const d=value instanceof Date?new Date(value.getTime()):new Date(value||Date.now());
 if(!Number.isFinite(d.getTime()))throw error('BACKUP_DATE_INVALID','Backup-Zeitpunkt ist ungültig.');
 const yyyy=String(d.getUTCFullYear()),mm=String(d.getUTCMonth()+1).padStart(2,'0'),dd=String(d.getUTCDate()).padStart(2,'0');
 return{d,yyyy,mm,dd,iso:d.toISOString()};
}
function backupPlan(value){
 const {d,dd}=dateParts(value),out=['daily'];
 if(dd==='01')out.push('monthly');
 if(dd==='01'&&d.getUTCMonth()===0)out.push('yearly');
 return out;
}
function backupPath(environment,tier,value){
 const env=normalizeEnvironment(environment),kind=normalizeTier(tier),p=dateParts(value);
 const prefix=env==='testservice'?'testservice/state-backups/':'state-backups/';
 const scope=kind==='daily'?p.yyyy+'/'+p.mm+'/'+p.dd:kind==='monthly'?p.yyyy+'/'+p.mm:p.yyyy;
 const stamp=p.iso.replace(/[-:.]/g,'');
 return prefix+kind+'/'+scope+'/team-state-'+stamp+'.json';
}
function retentionPolicy(tier){
 const kind=normalizeTier(tier),minimumRetentionDays=TIERS[kind].minimumRetentionDays;
 return{tier:kind,minimumRetentionDays,automaticDeletion:false,policy:'minimum-'+minimumRetentionDays+'-days-no-automatic-deletion'};
}
async function readBuffer(blob){
 const r=await blob.download(0),chunks=[];
 for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
 return{buffer:Buffer.concat(chunks),etag:r.etag||null};
}
async function createVerifiedSnapshot(container,options={}){
 if(!container||typeof container.getBlockBlobClient!=='function')throw error('BACKUP_CONTAINER_INVALID','Backup-Container ist nicht verfügbar.',500);
 const environment=normalizeEnvironment(options.environment),tier=normalizeTier(options.tier),created=dateParts(options.at);
 const current=options.current;
 if(!current||typeof current!=='object')throw error('BACKUP_STATE_INVALID','Der Team-State ist nicht sicherbar.',500);
 const name=backupPath(environment,tier,created.d),retention=retentionPolicy(tier);
 const raw=JSON.stringify(current),bytes=Buffer.byteLength(raw),sha256=crypto.createHash('sha256').update(raw).digest('hex');
 const blob=container.getBlockBlobClient(name);
 const uploaded=await blob.upload(raw,bytes,{
  blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'no-store'},
  conditions:{ifNoneMatch:'*'},
  metadata:{
   purpose:'exporthub-state-backup',
   environment,
   tier,
   sha256,
   createdutc:created.iso,
   minimumretentiondays:String(retention.minimumRetentionDays),
   automaticdeletion:'false'
  }
 });
 const properties=await blob.getProperties(),storedHash=text(properties&&properties.metadata&&properties.metadata.sha256);
 const readBack=await readBuffer(blob),readBackHash=crypto.createHash('sha256').update(readBack.buffer).digest('hex');
 if(!uploaded||!uploaded.etag||!properties||!properties.etag||storedHash!==sha256||readBack.buffer.length!==bytes||readBackHash!==sha256){
  throw error('BACKUP_VERIFY_FAILED','Das geplante State-Backup konnte nicht vollständig zurückgelesen und verifiziert werden.',500);
 }
 return{
  ok:true,
  scheduledBackup:true,
  environment,
  tier,
  backupBlob:name,
  bytes,
  sha256,
  backupVerified:true,
  backupReadBackVerified:true,
  createdAt:created.iso,
  retention
 };
}

module.exports={TIERS,backupPlan,backupPath,retentionPolicy,createVerifiedSnapshot};
