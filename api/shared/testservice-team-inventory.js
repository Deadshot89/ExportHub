'use strict';

// RC1627: authenticated metadata-only inventory. No blob names, contents or
// account secrets are returned, logged or stored by this module.
const PREFIX='testservice/';
const MAX_RECORDS=50000;
const MAX_ELAPSED_MS=22000;
const KINDS=['live','version','snapshot','deleted'];

function empty(){
 return Object.fromEntries(KINDS.map(kind=>[kind,{records:0,logicalBytes:0}]));
}
function integer(v){return Number.isSafeInteger(v)&&v>=0;}
function sum(target,n){
 if(!integer(target.logicalBytes+n))throw Object.assign(new Error('INVENTORY_OVERFLOW'),{code:'INVENTORY_OVERFLOW'});
 target.records++;
 target.logicalBytes+=n;
}
async function collectTestserviceTeamInventory(container,options={}){
 if(!container||typeof container.listBlobsFlat!=='function')throw new Error('INVENTORY_NOT_SUPPORTED');
 const now=typeof options.clock==='function'?options.clock:Date.now;
 const started=now();
 const report={
  version:'RC1627',environment:'testservice',scope:'team-prefix',complete:false,
  records:0,logicalBytes:0,liveLogicalBytes:0,historicalLogicalBytes:0,
  kinds:empty(),billingVerified:false,archiveVerified:false,
  sharedProductionDependenciesResolved:false
 };
 for await(const item of container.listBlobsFlat({
  prefix:PREFIX,includeVersions:true,includeSnapshots:true,
  includeDeleted:true
 })){
  // The server controls the scope. A malicious or incorrect provider result
  // must not be counted as TESTSERVICE data.
  if(!item||typeof item.name!=='string'||!item.name.startsWith(PREFIX))
   throw new Error('INVENTORY_OUT_OF_SCOPE');
  if(report.records>=MAX_RECORDS||now()-started>MAX_ELAPSED_MS)
   throw new Error('INVENTORY_INCOMPLETE');
  const bytes=item.properties&&item.properties.contentLength;
  if(!integer(bytes))throw new Error('INVENTORY_SIZE_UNKNOWN');
  const kind=item.deleted?'deleted':item.snapshot?'snapshot':
    item.versionId&&item.isCurrentVersion!==true?'version':'live';
  sum(report.kinds[kind],bytes);
  report.records++;
  if(!integer(report.logicalBytes+bytes))throw new Error('INVENTORY_OVERFLOW');
  report.logicalBytes+=bytes;
 }
 report.liveLogicalBytes=report.kinds.live.logicalBytes;
 report.historicalLogicalBytes=report.logicalBytes-report.liveLogicalBytes;
 report.complete=true;
 return report;
}
module.exports={collectTestserviceTeamInventory,PREFIX,MAX_RECORDS};
