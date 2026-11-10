'use strict';

// RC1964: inert, synthetic preflight for a possible TESTSERVICE-only Azure
// Container Apps Consumption Job. No Azure SDK, deployment, queue or parser hook.
// Every result explicitly denies deployment and file release.
const crypto=require('node:crypto');

const FREE_GRANTS=Object.freeze({vcpuSeconds:180000,giBSeconds:360000});
const JOB_SHAPE=Object.freeze({vcpus:2,memoryGiB:4,maxSeconds:240,maxParallel:1,maxRetries:0});
const QUEUE_TTL_MS=5*60*1000;
const CLOCK_SKEW_MS=30*1000;
const MAX_BYTES=12*1024*1024;
const HEX64=/^[a-f0-9]{64}$/;
const HEX32=/^[a-f0-9]{32}$/;
const ETAG=/^"[A-Za-z0-9!#$%&'*+.^_|~-]{1,128}"$/;
const FIELDS=Object.freeze([
 'version','purpose','environment','jobId','scopeHash','blobKeyHash',
 'uploadSha256','uploadNonce','blobEtag','bytes','issuedAt','expiresAt'
]);
const validHex=(s,re)=>typeof s==='string'&&re.test(s);
const validInt=n=>Number.isSafeInteger(n)&&n>=0;
const locked=Object.freeze({deployAuthorized:false,releaseAuthorized:false,costGuaranteedZero:false});
const reject=reason=>({valid:false,dispatchAuthorized:false,releaseAuthorized:false,reason});
const getKey=k=>Buffer.isBuffer(k)&&k.length>=32&&k.length<=128?k:null;

// Fixed 2-vCPU / 4-GiB job shape; free grants are SUBSCRIPTION-SHARED.
// This is a projection, never an Azure billing attestation or permission to
// provision a managed environment, registry, queue, network or logging.
function estimateConsumption({plannedJobs,secondsPerJob,otherVcpuSeconds=null,otherGiBSeconds=null}={}){
 const denial={...locked,kind:'offline-estimate',jobShape:JOB_SHAPE,freeGrants:FREE_GRANTS};
 if(!Number.isSafeInteger(plannedJobs)||plannedJobs<0||plannedJobs>10000||
    !Number.isSafeInteger(secondsPerJob)||secondsPerJob<1||secondsPerJob>JOB_SHAPE.maxSeconds){
  return {...denial,status:'invalid-input',computeFitsPublishedFreeGrant:null};
 }
 const projectedVcpuSeconds=plannedJobs*secondsPerJob*JOB_SHAPE.vcpus;
 const projectedGiBSeconds=plannedJobs*secondsPerJob*JOB_SHAPE.memoryGiB;
 const projected={vcpuSeconds:projectedVcpuSeconds,giBSeconds:projectedGiBSeconds};
 // Unknown usage MUST NOT be taken as zero or as a confirmed entitlement.
 if(otherVcpuSeconds===null||otherGiBSeconds===null){
  return {...denial,status:'subscription-usage-unknown',projected,
   computeFitsPublishedFreeGrant:null,otherResourceChargesUnknown:true};
 }
 if(!validInt(otherVcpuSeconds)||!validInt(otherGiBSeconds)){
  return {...denial,status:'invalid-input',projected,computeFitsPublishedFreeGrant:null};
 }
 const available={
  vcpuSeconds:Math.max(0,FREE_GRANTS.vcpuSeconds-otherVcpuSeconds),
  giBSeconds:Math.max(0,FREE_GRANTS.giBSeconds-otherGiBSeconds)
 };
 const fits=projectedVcpuSeconds<=available.vcpuSeconds&&
            projectedGiBSeconds<=available.giBSeconds;
 return {...denial,status:fits?'compute-within-reported-grant':'compute-exceeds-reported-grant',
  projected,remainingPublishedGrant:available,computeFitsPublishedFreeGrant:fits,
  otherResourceChargesUnknown:true};
}

// An opaque, authenticated QUEUE CANDIDATE, not a scanner result. Identity and
// least-privilege Azure permissions must be enforced by a future trusted worker.
function isPayload(p,now){
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).length!==FIELDS.length||FIELDS.some(k=>!Object.hasOwn(p,k)))return false;
 if(p.version!==1||p.purpose!=='abd-quarantine-scan'||p.environment!=='testservice'||
    !validHex(p.jobId,HEX32)||!validHex(p.scopeHash,HEX64)||
    !validHex(p.blobKeyHash,HEX64)||!validHex(p.uploadSha256,HEX64)||
    !validHex(p.uploadNonce,HEX32)||!ETAG.test(p.blobEtag)||
    !Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>MAX_BYTES)return false;
 if(!validInt(now)||!validInt(p.issuedAt)||!validInt(p.expiresAt)||
    p.issuedAt>now+CLOCK_SKEW_MS||p.expiresAt<now||
    p.expiresAt<p.issuedAt||p.expiresAt-p.issuedAt>QUEUE_TTL_MS)return false;
 return true;
}
function digest(key,p){
 return crypto.createHmac('sha256',key)
  .update('ExportHUB:RC1964:TESTSERVICE:scan-queue:v1\0','utf8')
  .update(JSON.stringify(FIELDS.map(k=>p[k])),'utf8').digest('hex');
}
function sameHex(a,b,re){
 return validHex(a,re)&&validHex(b,re)&&
  crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function sameContext(p,expected){
 if(!expected||typeof expected!=='object'||Array.isArray(expected)||
    expected.environment!=='testservice')return false;
 for(const field of ['scopeHash','blobKeyHash','uploadSha256']){
  if(!sameHex(p[field],expected[field],HEX64))return false;
 }
 return validHex(expected.uploadNonce,HEX32)&&
  sameHex(p.uploadNonce,expected.uploadNonce,HEX32)&&
  typeof expected.blobEtag==='string'&&p.blobEtag===expected.blobEtag&&
  Number.isSafeInteger(expected.bytes)&&p.bytes===expected.bytes;
}
function createQueueCandidate({context,secret,now=Date.now()}={}){
 const key=getKey(secret);
 if(!key||!context||context.environment!=='testservice')
  throw Error('RC1964_QUEUE_NOT_ATTESTABLE');
 const payload={
  version:1,purpose:'abd-quarantine-scan',environment:context.environment,
  jobId:crypto.randomBytes(16).toString('hex'),scopeHash:context.scopeHash,
  blobKeyHash:context.blobKeyHash,uploadSha256:context.uploadSha256,
  uploadNonce:context.uploadNonce,blobEtag:context.blobEtag,
  bytes:context.bytes,issuedAt:now,expiresAt:now+QUEUE_TTL_MS
 };
 if(!isPayload(payload,now))throw Error('RC1964_QUEUE_NOT_ATTESTABLE');
 return {payload,mac:digest(key,payload),dispatchAuthorized:false,releaseAuthorized:false};
}
function verifyQueueCandidate({envelope,expected,secret,now=Date.now()}={}){
 const key=getKey(secret);
 if(!key)return reject('key-unavailable');
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
    Object.keys(envelope).length!==4||!Object.hasOwn(envelope,'payload')||
    !Object.hasOwn(envelope,'mac')||envelope.dispatchAuthorized!==false||
    envelope.releaseAuthorized!==false)return reject('invalid-envelope');
 const p=envelope.payload;
 if(!isPayload(p,now)||!validHex(envelope.mac,HEX64))return reject('invalid-payload');
 const supplied=Buffer.from(envelope.mac,'hex');
 if(!crypto.timingSafeEqual(supplied,Buffer.from(digest(key,p),'hex')))
  return reject('signature-mismatch');
 if(!sameContext(p,expected))return reject('blob-context-mismatch');
 return {valid:true,dispatchAuthorized:false,releaseAuthorized:false};
}
module.exports={FREE_GRANTS,JOB_SHAPE,estimateConsumption,
 createQueueCandidate,verifyQueueCandidate};
