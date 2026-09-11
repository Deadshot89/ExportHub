import fs from 'node:fs';

const path='api/exporthub-state/index.js';
let source=fs.readFileSync(path,'utf8');

const oldRead=`async function readJson(blob,fallback,repairAuth=false){
 try{
  const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
  try{const v=parseStoredJson(Buffer.concat(chunks).toString('utf8'),blob&&blob.name);return {value:v==null?clone(fallback):v,etag:r.etag||null}}
  catch(e){e.etag=r.etag||null;if(repairAuth)return {value:clone(fallback),etag:r.etag||null,repairedInvalidJson:true};throw e}
 }catch(e){if(e&&e.statusCode===404)return {value:clone(fallback),etag:null};throw e}
}`;
const newRead=`async function readJson(blob,fallback,repairAuth=false){
 try{
  const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
  const rawBuffer=Buffer.concat(chunks);
  try{const v=parseStoredJson(rawBuffer.toString('utf8'),blob&&blob.name);return {value:v==null?clone(fallback):v,etag:r.etag||null,bytes:rawBuffer.length}}
  catch(e){e.etag=r.etag||null;if(repairAuth)return {value:clone(fallback),etag:r.etag||null,repairedInvalidJson:true,bytes:rawBuffer.length};throw e}
 }catch(e){if(e&&e.statusCode===404)return {value:clone(fallback),etag:null,bytes:0};throw e}
}`;
if(!source.includes(oldRead))throw new Error('RC1057 readJson-Zielstelle nicht gefunden');
source=source.replace(oldRead,newRead);

const oldAuth=`   let authReadable=true;try{await readJson(c.auth,emptyAuth(),true)}catch(e){authReadable=false;throw error('STORAGE_UNREACHABLE','ExportHUB kann den Auth-Blob im konfigurierten Azure-Speicher nicht lesen: '+(e&&e.message||'Unbekannter Speicherfehler'),503)}`;
const newAuth=`   let authReadable=true,authCheck=null;try{authCheck=await readJson(c.auth,emptyAuth(),true)}catch(e){authReadable=false;throw error('STORAGE_UNREACHABLE','ExportHUB kann den Auth-Blob im konfigurierten Azure-Speicher nicht lesen: '+(e&&e.message||'Unbekannter Speicherfehler'),503)}`;
if(!source.includes(oldAuth))throw new Error('RC1057 Auth-Health-Zielstelle nicht gefunden');
source=source.replace(oldAuth,newAuth);

const oldHealth=`   context.res=json(200,{ok:true,service:'exporthub-state',version:API_VERSION,storageConfigured:true,storageReachable:true,authBlobReadable:authReadable,teamStateReadable:true,teamStateRecoveredFromHistory:teamCheck.recoveredFromHistory===true,storageSource:connectionSource(),container:TEAM_CONTAINER,environment:c.environment,blob:c.teamBlobName,authReadMs,teamReadMs,totalMs:Date.now()-requestStarted,time:now()});return;`;
const newHealth=`   context.res=json(200,{ok:true,service:'exporthub-state',version:API_VERSION,storageConfigured:true,storageReachable:true,authBlobReadable:authReadable,teamStateReadable:true,teamStateRecoveredFromHistory:teamCheck.recoveredFromHistory===true,storageSource:connectionSource(),container:TEAM_CONTAINER,environment:c.environment,blob:c.teamBlobName,authBlobBytes:Number(authCheck.bytes||0),teamStateBytes:Number(teamCheck.bytes||0),authReadMs,teamReadMs,totalMs:Date.now()-requestStarted,time:now()});return;`;
if(!source.includes(oldHealth))throw new Error('RC1057 Health-Response-Zielstelle nicht gefunden');
source=source.replace(oldHealth,newHealth);

fs.writeFileSync(path,source);
