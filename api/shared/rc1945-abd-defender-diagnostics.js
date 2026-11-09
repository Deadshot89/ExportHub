'use strict';

// RC1945: OIDC-only read-only TESTSERVICE Defender result inventory.
// No blob payloads, paths, filenames, user metadata, tokens, or raw scan tags are returned.
const {scanResultFromTags}=require('./customer-avis-pdf-security');

const PREFIX='rc1294/testservice/';
const STATES=Object.freeze(['clean','pending','malicious','not-scanned','error']);
const DEFAULT_LIMIT=24;
const MAX_LIMIT=48;
const DEFAULT_BUDGET_MS=12000;

function reasonFor(error){
 const code=String(error&&error.code||'');
 const status=Number(error&&(error.statusCode||error.status)||0);
 if(status===401||status===403||/^(AuthenticationFailed|AuthorizationFailure|AuthorizationPermissionMismatch|AuthorizationServiceMismatch)$/.test(code))return'access-denied';
 if(status===404||/^(ContainerNotFound|BlobNotFound|ResourceNotFound)$/.test(code))return'not-found';
 if(status===408||status===429||status>=500||/^(STORAGE_TIMEOUT|ETIMEDOUT|AbortError|ECONNRESET|ENOTFOUND)$/.test(code))return'transport-error';
 return'other';
}
function report(reason='unknown'){
 return{version:'RC1945',environment:'testservice',scope:'abd-quarantine',
  status:'unverified',reason,recordCount:null,states:null,
  pendingOver120Seconds:null,pendingOverTwoHours:null,
  resourceOwnershipVerified:false,billingVerified:false,configurationChangeApproved:false};
}

async function collectTestserviceAbdDefenderDiagnostics(options={}){
 const result=report();
 const client=options.service;
 const containerName=String(options.containerName||'');
 const limit=options.limit??DEFAULT_LIMIT;
 const budget=options.budgetMs??DEFAULT_BUDGET_MS;
 const clock=options.clock||Date.now;
 if(!client||typeof client.getContainerClient!=='function'||
    !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(containerName)||
    !Number.isSafeInteger(limit)||limit<1||limit>MAX_LIMIT||
    !Number.isSafeInteger(budget)||budget<100||budget>30000)return report('configuration');
 const started=clock(),now=started;
 const counts=Object.fromEntries(STATES.map(k=>[k,0]));
 let records=0,pendingOver120Seconds=0,pendingOverTwoHours=0;
 try{
  const container=client.getContainerClient(containerName);
  if(!container||typeof container.listBlobsFlat!=='function'||typeof container.getBlobClient!=='function')
   return report('client-unavailable');
  // Only current live blobs in the fixed TESTSERVICE ABD prefix. No deletion, tags write or GET content.
  for await(const item of container.listBlobsFlat({prefix:PREFIX})){
   if(clock()-started>budget||records>=limit)return report('incomplete');
   if(!item||typeof item.name!=='string'||!item.name.startsWith(PREFIX))return report('incomplete');
   const blob=container.getBlobClient(item.name);
   if(!blob||typeof blob.getTags!=='function')return report('client-unavailable');
   const tagResponse=await blob.getTags();
   // An RPC may finish after the budget: never report a stale inventory as verified.
   if(clock()-started>budget)return report('incomplete');
   const status=scanResultFromTags(tagResponse&&tagResponse.tags||{}).status;
   if(!STATES.includes(status))return report('incomplete');
   counts[status]++;records++;
   if(status==='pending'){
    const created=item.properties&&item.properties.createdOn;
    const createdMs=created instanceof Date?created.getTime():Date.parse(String(created||''));
    if(Number.isFinite(createdMs)&&createdMs<=now){
     if(now-createdMs>=120000)pendingOver120Seconds++;
     if(now-createdMs>=7200000)pendingOverTwoHours++;
    }
   }
  }
  if(clock()-started>budget)return report('incomplete');
  return{...result,status:'verified',reason:null,recordCount:records,
   states:counts,pendingOver120Seconds,pendingOverTwoHours};
 }catch(error){return report(reasonFor(error))}
}

module.exports={PREFIX,collectTestserviceAbdDefenderDiagnostics};
