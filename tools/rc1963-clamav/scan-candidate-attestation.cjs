'use strict';

// RC1963 – an inert, TESTSERVICE-only candidate proof format.
// NOT connected to api/abd-analysis, not a trusted worker and never a release permit.
// A future isolated ClamAV worker must first establish its own trusted identity,
// fixed blob scope, signature freshness, Azure ETag/version and immutable bytes.
const crypto=require('node:crypto');

const MAX_BYTES=12*1024*1024;
const MAX_AGE_MS=10*60*1000;
const MAX_DEFINITION_AGE_MS=24*60*60*1000;
const CLOCK_SKEW_MS=30*1000;
const FIELDS=Object.freeze([
 'version','environment','scopeHash','blobKeyHash','uploadSha256','uploadNonce',
 'blobEtag','bytes','engine','verdict','definitionsUpdatedAt','scannedAt','expiresAt'
]);
const HEX64=/^[0-9a-f]{64}$/;
const HEX32=/^[0-9a-f]{32}$/;
const ETAG=/^["]?[A-Za-z0-9!#$%&'*+.^_`|~-]{1,128}["]?$/;
const fail=reason=>({valid:false,authorizedForRelease:false,reason});
const isTime=n=>Number.isSafeInteger(n)&&n>0;
const hashOk=v=>typeof v==='string'&&HEX64.test(v);
const nonceOk=v=>typeof v==='string'&&HEX32.test(v);
const getKey=key=>Buffer.isBuffer(key)&&key.length>=32&&key.length<=128?key:null;

function isPayload(p,now){
 if(!p||typeof p!=='object'||Array.isArray(p)||
    Object.keys(p).length!==FIELDS.length||FIELDS.some(k=>!Object.hasOwn(p,k)))return false;
 if(p.version!==1||p.environment!=='testservice'||p.engine!=='clamav'||
    p.verdict!=='candidate-clean')return false;
 if(!hashOk(p.scopeHash)||!hashOk(p.blobKeyHash)||!hashOk(p.uploadSha256)||
    !nonceOk(p.uploadNonce)||typeof p.blobEtag!=='string'||!ETAG.test(p.blobEtag))return false;
 if(!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>MAX_BYTES)return false;
 if(!isTime(now)||!isTime(p.scannedAt)||!isTime(p.expiresAt)||
    !isTime(p.definitionsUpdatedAt))return false;
 if(p.scannedAt>now+CLOCK_SKEW_MS||p.expiresAt<p.scannedAt||
    p.expiresAt-p.scannedAt>MAX_AGE_MS||p.expiresAt<now)return false;
 if(p.definitionsUpdatedAt>p.scannedAt||
    p.scannedAt-p.definitionsUpdatedAt>MAX_DEFINITION_AGE_MS)return false;
 return true;
}
function canonical(p){
 return JSON.stringify(FIELDS.map(k=>p[k]));
}
function mac(key,p){
 return crypto.createHmac('sha256',key)
  .update('ExportHUB:RC1963:TESTSERVICE:ClamAV-candidate:v1\0','utf8')
  .update(canonical(p),'utf8').digest('hex');
}
function equalHex64(a,b){
 if(!hashOk(a)||!hashOk(b))return false;
 return crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
function compareContext(p,expected){
 if(!expected||typeof expected!=='object'||Array.isArray(expected))return false;
 if(expected.environment!=='testservice')return false;
 if(!equalHex64(p.scopeHash,expected.scopeHash)||
    !equalHex64(p.blobKeyHash,expected.blobKeyHash)||
    !equalHex64(p.uploadSha256,expected.uploadSha256))return false;
 if(!nonceOk(expected.uploadNonce)||p.uploadNonce!==expected.uploadNonce)return false;
 if(typeof expected.blobEtag!=='string'||p.blobEtag!==expected.blobEtag)return false;
 return Number.isSafeInteger(expected.bytes)&&p.bytes===expected.bytes;
}

// The caller MUST be a trusted isolated scanner and MUST pass the real result
// of scanLocalQuarantine, not a client-supplied JSON body. This function alone
// cannot authenticate a scan service or authorize analysis.
function createCandidateAttestation({candidate,context,secret,definitionsUpdatedAt,now=Date.now()}={}){
 const key=getKey(secret);
 if(!key||!candidate||candidate.authorizedForRelease!==false||
    candidate.verdict!=='candidate-clean'||!hashOk(candidate.sha256)||
    !Number.isSafeInteger(candidate.bytes)||!context||
    context.uploadSha256!==candidate.sha256||context.bytes!==candidate.bytes)
  throw Error('RC1963_CANDIDATE_NOT_ATTESTABLE');
 const p={
  version:1,environment:context.environment,scopeHash:context.scopeHash,
  blobKeyHash:context.blobKeyHash,uploadSha256:context.uploadSha256,
  uploadNonce:context.uploadNonce,blobEtag:context.blobEtag,
  bytes:context.bytes,engine:'clamav',verdict:'candidate-clean',
  definitionsUpdatedAt,scannedAt:now,expiresAt:now+MAX_AGE_MS
 };
 if(!isPayload(p,now))throw Error('RC1963_CANDIDATE_NOT_ATTESTABLE');
 return{payload:p,mac:mac(key,p),authorizedForRelease:false};
}

// Verification returns only a candidate proof. No Blob tag is written;
// never use this result as a standalone permission to run a parser.
function verifyCandidateAttestation({attestation,expected,secret,now=Date.now()}={}){
 const key=getKey(secret);
 if(!key)return fail('key-unavailable');
 if(!attestation||typeof attestation!=='object'||Array.isArray(attestation)||
    Object.keys(attestation).length!==3||!Object.hasOwn(attestation,'payload')||
    !Object.hasOwn(attestation,'mac')||attestation.authorizedForRelease!==false)
  return fail('invalid-envelope');
 const p=attestation.payload;
 if(!isPayload(p,now)||!hashOk(attestation.mac))return fail('invalid-proof');
 const actual=Buffer.from(attestation.mac,'hex'),expectedMac=Buffer.from(mac(key,p),'hex');
 if(!crypto.timingSafeEqual(actual,expectedMac))return fail('signature-mismatch');
 if(!compareContext(p,expected))return fail('blob-context-mismatch');
 return{valid:true,authorizedForRelease:false,verdict:'candidate-clean'};
}
module.exports={MAX_BYTES,MAX_AGE_MS,createCandidateAttestation,verifyCandidateAttestation};
