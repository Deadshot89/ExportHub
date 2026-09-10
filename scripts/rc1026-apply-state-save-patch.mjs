import fs from 'node:fs';

const path='api/exporthub-state/index.js';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`RC1026 Patchanker fehlt: ${label}`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`RC1026 Patchanker nicht eindeutig: ${label}`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
"function timingHeaders(t={}){const h={'X-ExportHUB-Server-Ms':String(Math.max(0,Number(t.serverMs||0)||0)),'X-ExportHUB-Auth-Ms':String(Math.max(0,Number(t.authMs||0)||0)),'X-ExportHUB-Auth-Cache':text(t.authCache||'none')||'none','X-ExportHUB-Team-Ms':String(Math.max(0,Number(t.teamMs||0)||0)),'X-ExportHUB-Team-Cache':text(t.teamCache||'none')||'none'};if(t.mergeMs!==undefined)h['X-ExportHUB-Merge-Ms']=String(Math.max(0,Number(t.mergeMs||0)||0));if(t.uploadMs!==undefined)h['X-ExportHUB-Upload-Ms']=String(Math.max(0,Number(t.uploadMs||0)||0));if(t.retryReadMs!==undefined)h['X-ExportHUB-Retry-Read-Ms']=String(Math.max(0,Number(t.retryReadMs||0)||0));return h}",
"function timingHeaders(t={}){const h={'X-ExportHUB-Server-Ms':String(Math.max(0,Number(t.serverMs||0)||0)),'X-ExportHUB-Auth-Ms':String(Math.max(0,Number(t.authMs||0)||0)),'X-ExportHUB-Auth-Cache':text(t.authCache||'none')||'none','X-ExportHUB-Team-Ms':String(Math.max(0,Number(t.teamMs||0)||0)),'X-ExportHUB-Team-Cache':text(t.teamCache||'none')||'none'};if(t.mergeMs!==undefined)h['X-ExportHUB-Merge-Ms']=String(Math.max(0,Number(t.mergeMs||0)||0));if(t.uploadMs!==undefined)h['X-ExportHUB-Upload-Ms']=String(Math.max(0,Number(t.uploadMs||0)||0));if(t.retryReadMs!==undefined)h['X-ExportHUB-Retry-Read-Ms']=String(Math.max(0,Number(t.retryReadMs||0)||0));if(t.uploadBytes!==undefined)h['X-ExportHUB-Upload-Bytes']=String(Math.max(0,Number(t.uploadBytes||0)||0));if(t.conflictCount!==undefined)h['X-ExportHUB-Save-Conflicts']=String(Math.max(0,Number(t.conflictCount||0)||0));return h}",
'headers');

replaceOnce(
"async function uploadJson(blob,value,etag){\n const raw=JSON.stringify(value),conditions=etag?{ifMatch:etag}:{ifNoneMatch:'*'},base={blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions};\n const metadata={schema:String(value.schemaVersion||3),revision:String(value.revision||0),updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now()),clientversion:String(value.clientVersion||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)};\n try{return await blob.upload(raw,Buffer.byteLength(raw),Object.assign({},base,{metadata}))}\n catch(e){\n  const code=String(e&&e.code||e&&e.details&&e.details.errorCode||'');\n  if(Number(e&&e.statusCode||0)===400||/InvalidMetadata|InvalidHeader/i.test(code))return blob.upload(raw,Buffer.byteLength(raw),base);\n  throw e;\n }\n}",
"async function uploadJson(blob,value,etag){\n const raw=JSON.stringify(value),bytes=Buffer.byteLength(raw),conditions=etag?{ifMatch:etag}:{ifNoneMatch:'*'},base={blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions};\n const metadata={schema:String(value.schemaVersion||3),revision:String(value.revision||0),updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now()),clientversion:String(value.clientVersion||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)};\n try{const uploaded=await blob.upload(raw,bytes,Object.assign({},base,{metadata}));return Object.assign({},uploaded||{},{bytes})}\n catch(e){\n  const code=String(e&&e.code||e&&e.details&&e.details.errorCode||'');\n  if(Number(e&&e.statusCode||0)===400||/InvalidMetadata|InvalidHeader/i.test(code)){const uploaded=await blob.upload(raw,bytes,base);return Object.assign({},uploaded||{},{bytes})}\n  throw e;\n }\n}",
'uploadJson');

replaceOnce(
" let d={value:initialTeam||emptyTeam(),etag:initialEtag||null},retryReadMs=0,mergeMs=0,uploadMs=0;",
" let d={value:initialTeam||emptyTeam(),etag:initialEtag||null},retryReadMs=0,mergeMs=0,uploadMs=0,uploadBytes=0,conflictCount=0;",
'save counters');
replaceOnce(
"Object.defineProperty(replay,'__timing',{value:{retryReadMs,mergeMs,uploadMs},enumerable:false})",
"Object.defineProperty(replay,'__timing',{value:{retryReadMs,mergeMs,uploadMs,uploadBytes,conflictCount},enumerable:false})",
'replay timing');
replaceOnce(
"const mergeStarted=Date.now(),merged=pruneTombstones(mergeState(current.state||{},incoming.state||{}));delete merged.users;merged.users=publicUsers(current.users||[],false);mergeMs+=Date.now()-mergeStarted;",
"const mergeStarted=Date.now(),merged=pruneTombstones(mergeState(current.state||{},incoming.state||{}));delete merged.users;mergeMs+=Date.now()-mergeStarted;",
'redundant users');
replaceOnce(
"try{Object.defineProperty(next,'__storageEtag',{value:uploaded&&uploaded.etag||null,enumerable:false});Object.defineProperty(next,'__timing',{value:{retryReadMs,mergeMs,uploadMs},enumerable:false})}",
"uploadBytes=Number(uploaded&&uploaded.bytes||0);try{Object.defineProperty(next,'__storageEtag',{value:uploaded&&uploaded.etag||null,enumerable:false});Object.defineProperty(next,'__timing',{value:{retryReadMs,mergeMs,uploadMs,uploadBytes,conflictCount},enumerable:false})}",
'save timing');
replaceOnce(
"if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1)continue;",
"if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1){conflictCount++;continue;}",
'save conflict');
replaceOnce(
"mergeMs:Number(phase.mergeMs||0),uploadMs:Number(phase.uploadMs||0),retryReadMs:Number(phase.retryReadMs||0),saveMs};",
"mergeMs:Number(phase.mergeMs||0),uploadMs:Number(phase.uploadMs||0),retryReadMs:Number(phase.retryReadMs||0),uploadBytes:Number(phase.uploadBytes||0),conflictCount:Number(phase.conflictCount||0),saveMs};",
'handler timing');

fs.writeFileSync(path,source);
console.log('RC1026 State-Save-Patch angewendet.');
