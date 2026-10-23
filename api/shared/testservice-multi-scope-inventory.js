'use strict';

// RC1631 - diagnostic, read-only and aggregate-only. The list is derived
// from the explicit TESTSERVICE writers, NEVER enumerate the container root.
const SCOPES=Object.freeze([
 {id:'team',containerEnv:'EXPORTHUB_STORAGE_CONTAINER',containerAlias:'EXPORTHUB_CONTAINER',containerFallback:'exporthub-data',prefix:'testservice/',connection:'primary'},
 {id:'document-files',containerEnv:'EXPORTHUB_DOCUMENT_CONTAINER',containerFallback:'exporthub-documents',prefix:'rc1059/testservice/',connection:'primary'},
 {id:'container-photos',containerEnv:'EXPORTHUB_DOCUMENT_CONTAINER',containerFallback:'exporthub-documents',prefix:'testservice/',connection:'primary'},
 {id:'pickup',containerEnv:'EXPORTHUB_PICKUP_CONTAINER',containerFallback:'exporthub-pickup',prefix:'rc995/testservice/',connection:'primary'},
 {id:'pod',containerEnv:'EXPORTHUB_POD_CONTAINER',containerFallback:'exporthub-pod',prefix:'rc995/testservice/',connection:'primary'},
 {id:'abd-quarantine',containerEnv:'EXPORTHUB_ABD_QUARANTINE_CONTAINER',containerFallback:'exporthub-abd-quarantine',prefix:'rc1294/testservice/',connection:'primary'},
 {id:'pod-backup',containerEnv:'EXPORTHUB_POD_BACKUP_CONTAINER',containerFallback:'exporthub-pod-backup',prefix:'rc1220/testservice/',connection:'backup'}
]);
const MAX_RECORDS=50000,MAX_ELAPSED_MS=18000;
const KINDS=['live','version','snapshot','deleted'];
function safe(n){return Number.isSafeInteger(n)&&n>=0;}
function blank(){return Object.fromEntries(KINDS.map(k=>[k,{records:0,logicalBytes:0}]));}
function count(a,n){
 if(!safe(a.logicalBytes+n)||!safe(a.records+1))throw new Error('INVENTORY_LIMIT');
 a.logicalBytes+=n;a.records++;
}
// RC1640: expose only fixed reason codes; provider exceptions can contain
// account URLs, SAS query parameters, blob paths or customer identifiers.
function safeFailureReason(e){
 const status=Number(e&&e.statusCode||e&&e.status||0);
 const code=String(e&&e.code||'');
 if(status===404||/^(?:ContainerNotFound|BlobNotFound|ResourceNotFound)$/.test(code))return 'not-found';
 if(status===401||status===403||/^(?:AuthenticationFailed|AuthorizationFailure|AuthorizationPermissionMismatch|AuthorizationServiceMismatch)$/.test(code))return 'access-denied';
 if(/^(?:INVENTORY_LIMIT|INVENTORY_OUT_OF_SCOPE|INVENTORY_UNKNOWN_SIZE)$/.test(code))return 'incomplete';
 if(status===408||status===429||status>=500||/^(?:STORAGE_TIMEOUT|ETIMEDOUT|AbortError|ECONNRESET|ENOTFOUND)$/.test(code))return 'transport-error';
 return 'other';
}
async function collectTestserviceMultiScopeInventory(options={}){
 const services=options.services||{};
 if(!services.primary||typeof services.primary.getContainerClient!=='function')throw new Error('INVENTORY_NO_PRIMARY');
 const config=options.environment||process.env;
 const clock=typeof options.clock==='function'?options.clock:Date.now;
 const started=clock();
 const maxElapsed=options.maxElapsedMs??MAX_ELAPSED_MS;
 const maxRecords=options.maxRecords??MAX_RECORDS;
 const report={
  version:'RC1631',environment:'testservice',complete:false,
  resourceOwnershipVerified:false,billingVerified:false,restoreVerified:false,
  deletionApproved:false,scopeCount:SCOPES.length,
  verifiedScopes:0,scopes:[],totalRecords:null,totalLogicalBytes:null,
  caveat:'Read-only known TESTSERVICE prefixes. Unverified scopes are not zero. Billing, account ownership and PROD isolation remain unverified.'
 };
 let totalRecords=0,totalBytes=0;
 for(const scope of SCOPES){
  const result={id:scope.id,status:'unverified',records:null,logicalBytes:null,kinds:null,reason:'unknown'};
  report.scopes.push(result);
  const connection=scope.connection==='backup'?(services.backup||services.primary):services.primary;
  // A timeout or listing issue is NOT evidence of an empty container.
  if(clock()-started>maxElapsed){result.reason='time-budget';continue;}
  try{
   if(!connection||typeof connection.getContainerClient!=='function'){result.reason='client-unavailable';continue;}
   const configured=String(config[scope.containerEnv]||(scope.containerAlias&&config[scope.containerAlias])||scope.containerFallback);
   // Never allow configuration to redirect enumeration to an arbitrary path.
   if(!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(configured)){result.reason='configuration';continue;}
   const container=connection.getContainerClient(configured);
   if(!container||typeof container.listBlobsFlat!=='function'){result.reason='client-unavailable';continue;}
   const part={records:0,logicalBytes:0},kinds=blank();
   for await(const item of container.listBlobsFlat({
    prefix:scope.prefix,includeVersions:true,includeSnapshots:true,includeDeleted:true
   })){
    if(clock()-started>maxElapsed||part.records>=maxRecords)throw new Error('INVENTORY_LIMIT');
    if(!item||typeof item.name!=='string'||!item.name.startsWith(scope.prefix))throw new Error('INVENTORY_OUT_OF_SCOPE');
    const bytes=item.properties&&item.properties.contentLength;
    if(!safe(bytes))throw new Error('INVENTORY_UNKNOWN_SIZE');
    const kind=item.deleted?'deleted':item.snapshot?'snapshot':
      item.versionId&&item.isCurrentVersion!==true?'version':'live';
    count(part,bytes);count(kinds[kind],bytes);
   }
   if(!safe(totalBytes+part.logicalBytes)||!safe(totalRecords+part.records))throw new Error('INVENTORY_LIMIT');
   totalBytes+=part.logicalBytes;totalRecords+=part.records;
   result.status='listed';result.reason=null;
   result.records=part.records;result.logicalBytes=part.logicalBytes;result.kinds=kinds;
   report.verifiedScopes++;
  }catch(e){
   // Azure SDK errors may embed signed storage URLs, names or credentials.
   // Never expose error text, a partial count, or a false empty result.
   result.status='unverified';result.records=null;result.logicalBytes=null;result.kinds=null;result.reason=safeFailureReason(e);
  }
 }
 report.complete=report.verifiedScopes===SCOPES.length;
 if(report.complete){report.totalRecords=totalRecords;report.totalLogicalBytes=totalBytes;}
 return report;
}
module.exports={collectTestserviceMultiScopeInventory,SCOPES,MAX_RECORDS,MAX_ELAPSED_MS};
