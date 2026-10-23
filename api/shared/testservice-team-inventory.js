'use strict';

// RC1627: authenticated metadata-only inventory. No blob names, contents or
// account secrets are returned, logged or stored by this module.
const PREFIX='testservice/';
const MAX_RECORDS=50000;
const MAX_ELAPSED_MS=22000;
const KINDS=['live','version','snapshot','deleted'];
// Fixed, non-identifying path categories: only aggregated counts leave the API.
const AREAS=Object.freeze(['root-files','daily-backups','monthly-backups','yearly-backups','recovery-backups','recovery-drills','other']);
function areaOf(name){
 if(/^testservice\/[^/]+$/.test(name))return 'root-files';
 if(name.startsWith('testservice/state-backups/daily/'))return 'daily-backups';
 if(name.startsWith('testservice/state-backups/monthly/'))return 'monthly-backups';
 if(name.startsWith('testservice/state-backups/yearly/'))return 'yearly-backups';
 if(name.startsWith('testservice/recovery-backups/'))return 'recovery-backups';
 if(name.startsWith('testservice/recovery-drills/'))return 'recovery-drills';
 return 'other';
}
function emptyAreas(){return Object.fromEntries(AREAS.map(k=>[k,{records:0,logicalBytes:0,kinds:empty()}]));}

function empty(){
 return Object.fromEntries(KINDS.map(kind=>[kind,{records:0,logicalBytes:0}]));
}
function integer(v){return Number.isSafeInteger(v)&&v>=0;}
// RC1642: only a snapshot's ISO timestamp is an age observation.
// A soft-deleted entry's Last-Modified is NOT its deletion timestamp.
const SNAPSHOT_AGES=['under1day','day1to7','beyond7days','unknown'];
function emptySnapshotAge(){return Object.fromEntries(SNAPSHOT_AGES.map(k=>[k,{records:0,logicalBytes:0}]));}
function ageBucket(timestamp,at){
 if(typeof timestamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(timestamp))return 'unknown';
 const value=Date.parse(timestamp);
 if(!Number.isFinite(value)||value>at)return 'unknown';
 const days=(at-value)/86400000;
 return days<1?'under1day':days<=7?'day1to7':'beyond7days';
}
function sum(target,n){
 if(!integer(target.logicalBytes+n))throw Object.assign(new Error('INVENTORY_OVERFLOW'),{code:'INVENTORY_OVERFLOW'});
 target.records++;
 target.logicalBytes+=n;
}
function configuredTeamStateName(options){
 const base=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
 const target=options.teamBlobName||process.env.EXPORTHUB_TEST_STORAGE_BLOB||
  ('testservice/'+String(base).replace(/^[/]+/,''));
 if(typeof target!=='string'||!target.startsWith(PREFIX)||target.length<=PREFIX.length||
  target.includes('..')||target.slice(PREFIX.length).includes('/')||[...target].some(c=>c.charCodeAt(0)<32))return null;
 return target;
}
async function collectTestserviceTeamInventory(container,options={}){
 if(!container||typeof container.listBlobsFlat!=='function')throw new Error('INVENTORY_NOT_SUPPORTED');
 const teamStateName=configuredTeamStateName(options);
 const now=typeof options.clock==='function'?options.clock:Date.now;
 const started=now();
 const referenceTime=options.referenceTime===undefined?Date.now():Number(options.referenceTime);
 if(!Number.isFinite(referenceTime)||referenceTime<0)throw new Error('INVENTORY_REFERENCE_TIME_INVALID');
 const report={
  version:'RC1627',environment:'testservice',scope:'team-prefix',complete:false,
  records:0,logicalBytes:0,liveLogicalBytes:0,historicalLogicalBytes:0,
  kinds:empty(),areas:emptyAreas(),
  // RC1638: fixed-name configured state file, aggregate-only; never return
  // the Blob's name, URL, ETag or any customer data.
  teamState:teamStateName?{status:'listed',records:0,logicalBytes:0,kinds:empty(),
    snapshotAge:emptySnapshotAge(),deletedAgeVerifiable:false}:
   {status:'unverified',records:null,logicalBytes:null,kinds:null,
    snapshotAge:null,deletedAgeVerifiable:false},
  billingVerified:false,archiveVerified:false,
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
  const area=report.areas[areaOf(item.name)];
  sum(area,bytes);sum(area.kinds[kind],bytes);
  if(teamStateName&&item.name===teamStateName){
   sum(report.teamState,bytes);sum(report.teamState.kinds[kind],bytes);
   if(kind==='snapshot')sum(report.teamState.snapshotAge[ageBucket(item.snapshot,referenceTime)],bytes);
  }
  report.records++;
  if(!integer(report.logicalBytes+bytes))throw new Error('INVENTORY_OVERFLOW');
  report.logicalBytes+=bytes;
 }
 report.liveLogicalBytes=report.kinds.live.logicalBytes;
 report.historicalLogicalBytes=report.logicalBytes-report.liveLogicalBytes;
 report.complete=true;
 return report;
}
module.exports={collectTestserviceTeamInventory,PREFIX,MAX_RECORDS,AREAS};
