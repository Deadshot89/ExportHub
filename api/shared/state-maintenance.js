'use strict';

const {compactStateForStorage}=require('./state-compaction');

function clone(value){
 if(value===undefined)return undefined;
 return JSON.parse(JSON.stringify(value));
}
function bytes(value){
 return Buffer.byteLength(JSON.stringify(value));
}
function previewCompaction(team){
 const source=team&&typeof team==='object'&&!Array.isArray(team)?team:{schemaVersion:3,revision:0,state:{},users:[]};
 const compacted=clone(source);
 compacted.state=compactStateForStorage(source.state||{});
 const beforeBytes=bytes(source),afterBytes=bytes(compacted),savedBytes=Math.max(0,beforeBytes-afterBytes);
 return {changed:savedBytes>0,beforeBytes,afterBytes,savedBytes,compacted};
}
function buildAppliedDocument(team,preview,options={}){
 const at=String(options.at||new Date().toISOString());
 const actor=String(options.actor||'RC1137 Workflow');
 const backupBlob=String(options.backupBlob||'');
 const base=preview&&preview.compacted?clone(preview.compacted):previewCompaction(team).compacted;
 base.schemaVersion=Math.max(3,Number(team&&team.schemaVersion||3));
 base.revision=Number(team&&team.revision||0)+1;
 base.updatedAt=at;
 base.updatedBy=actor;
 base.updatedByUserId=null;
 base.updatedByDevice='github-actions';
 base.clientVersion='RC1137-state-compaction';
 base.stateCompactionAudit={
  version:'RC1137',
  at,
  actor,
  backupBlob,
  beforeBytes:Number(preview&&preview.beforeBytes||0),
  afterBytes:Number(preview&&preview.afterBytes||0),
  savedBytes:Number(preview&&preview.savedBytes||0)
 };
 return base;
}

module.exports={previewCompaction,buildAppliedDocument};
