
'use strict';

const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');
const { mergeState, sanitizeState, pruneTombstones, clone } = require('../shared/merge');

const TEAM_CONTAINER = process.env.EXPORTHUB_STORAGE_CONTAINER || process.env.EXPORTHUB_CONTAINER || 'exporthub-data';
const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';
const AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';
const MAX_RETRIES = 6;

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function now(){ return new Date().toISOString(); }
function error(code,message,status=400){ const e=new Error(message); e.code=code; e.status=status; return e; }
function json(status,body,headers={}){ return {status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},headers),body:JSON.stringify(body)}; }
function body(req){ if(req&&req.body&&typeof req.body==='object')return req.body; try{return JSON.parse(req&&req.body||'{}')}catch(_){return {}} }
function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }
function usernameOf(user){ return lower(user&&(user.user||user.login||user.username||user.name)); }
function isActive(user){ return Boolean(user && user.active!==false && user.disabled!==true && lower(user.status)!=='deaktiviert'); }
function isAdmin(user){
 if(!user)return false;
 if(user.globalAdmin===true||user.isGlobalAdmin===true)return true;
 if(Array.isArray(user.permissions)&&user.permissions.includes('*'))return true;
 const role=lower(user.role||user.rolle);
 return ['globaler administrator','globaler admin','administrator','admin','vollzugriff'].includes(role);
}
function hasAnyEditRight(user){
 if(isAdmin(user))return true;
 return Object.values(user&&user.rights||{}).some(r=>r&&(r.edit===true||r.admin===true||r.functionAdmin===true||r.level==='edit'||r.level==='admin'));
}
function publicUser(user,adminView=false){
 const u=clone(user||{});
 ['password','passwordHash','passwordSalt','passwordIterations','passwordCredential','passwordHistory','temporaryPassword','startPassword'].forEach(k=>delete u[k]);
 if(!adminView)delete u.loginSecurity;
 return u;
}
function publicUsers(users,adminView=false){ return (Array.isArray(users)?users:[]).map(u=>publicUser(u,adminView)); }
function safeEqualText(a,b){ const aa=Buffer.from(String(a||''),'utf8'),bb=Buffer.from(String(b||''),'utf8'); return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb); }
function tokenHash(token){ return crypto.createHash('sha256').update(String(token||'')).digest('hex'); }
function sessionSigningSecret(){
 const configured=text(process.env.EXPORTHUB_AUTH_SIGNING_SECRET||process.env.EXPORTHUB_SESSION_SECRET);
 const source=configured||connectionString();
 if(!source)throw error('AUTH_SIGNING_NOT_CONFIGURED','Die sichere Sitzungssignatur ist serverseitig nicht konfiguriert.',503);
 return crypto.createHash('sha256').update('ExportHUB/session/v1|'+source).digest();
}
function signSessionPart(encoded){ return crypto.createHmac('sha256',sessionSigningSecret()).update(encoded).digest('base64url'); }
function verifySignedSessionToken(token){
 const raw=text(token),parts=raw.split('.');
 if(parts.length!==3||parts[0]!=='ehs1'||!parts[1]||!parts[2])return null;
 const expected=signSessionPart(parts[1]);
 if(!safeEqualText(expected,parts[2]))return null;
 let p; try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch(_){return null}
 if(!p||p.purpose!=='exporthub-session'||Number(p.v||0)!==1||!p.uid||!p.sid||Number(p.exp||0)<=Date.now())return null;
 return p;
}
function bearer(req,payload){
 const h=req&&req.headers||{};
 const dedicated=h['x-exporthub-token']||h['X-ExportHUB-Token']||h['x-exporthub-session']||h['X-ExportHUB-Session'];
 if(text(dedicated))return text(dedicated);
 if(payload&&text(payload.sessionToken))return text(payload.sessionToken);
 const auth=h.authorization||h.Authorization||''; const m=String(auth).match(/^Bearer\s+(.+)$/i); return m?m[1].trim():'';
}
async function clients(){
 const cs=connectionString();
 if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
 let service; try{service=BlobServiceClient.fromConnectionString(cs)}catch(e){throw error('STORAGE_NOT_CONFIGURED','Die Azure-Speicherverbindung ist ungültig.',503)}
 const container=service.getContainerClient(TEAM_CONTAINER);
 try{await container.createIfNotExists()}catch(e){const x=error('STORAGE_UNREACHABLE','Azure-Speicher ist nicht erreichbar.',503);x.cause=e;throw x}
 return {team:container.getBlockBlobClient(TEAM_BLOB),auth:container.getBlockBlobClient(AUTH_BLOB)};
}
function parseStoredJson(raw,name){
 const cleaned=String(raw==null?'':raw).replace(/^\uFEFF/,'').replace(/\u0000+$/g,'').trim();
 if(!cleaned)return null;
 try{let v=JSON.parse(cleaned);if(typeof v==='string'&&/^[\[{]/.test(v.trim()))v=JSON.parse(v.trim());return v}catch(e){throw error('STORAGE_JSON_INVALID','Die Azure-Datei '+text(name||'unbekannt')+' enthält keine gültigen ExportHUB-Daten.',500)}
}
async function readJson(blob,fallback,repairAuth=false){
 try{
  const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
  try{const v=parseStoredJson(Buffer.concat(chunks).toString('utf8'),blob&&blob.name);return {value:v==null?clone(fallback):v,etag:r.etag||null}}
  catch(e){if(repairAuth)return {value:clone(fallback),etag:r.etag||null,repairedInvalidJson:true};throw e}
 }catch(e){if(e&&e.statusCode===404)return {value:clone(fallback),etag:null};throw e}
}
async function uploadJson(blob,value,etag){
 const raw=JSON.stringify(value);
 return blob.upload(raw,Buffer.byteLength(raw),{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'},metadata:{schema:String(value.schemaVersion||3),revision:String(value.revision||0),updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now()),clientversion:String(value.clientVersion||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)}});
}
function emptyTeam(){return {schemaVersion:3,revision:0,updatedAt:null,updatedBy:null,state:{},users:[]}}
function emptyAuth(){return {schemaVersion:1,updatedAt:null,sessions:[]}}
async function validateSession(req,payload,c){
 const token=bearer(req,payload);if(!token)throw error('AUTH_REQUIRED','ExportHUB-Anmeldung erforderlich.',401);
 const authDoc=await readJson(c.auth,emptyAuth(),true),sessions=Array.isArray(authDoc.value&&authDoc.value.sessions)?authDoc.value.sessions:[];
 const hash=tokenHash(token);let session=sessions.find(s=>safeEqualText(s.tokenHash,hash)),source='blob';
 if(!session){const signed=verifySignedSessionToken(token);if(signed){source='signed';session={id:text(signed.sid),userId:text(signed.uid),username:text(signed.username),deviceId:text(signed.deviceId),createdAt:new Date(Number(signed.iat||Date.now())).toISOString(),expiresAt:new Date(Number(signed.exp)).toISOString(),authVersion:Number(signed.authVersion||0),mustChange:signed.mustChange===true,signedFallback:true}}}
 if(!session)throw error('SESSION_INVALID','Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.',401);
 if(session.revokedAt)throw error('SESSION_REVOKED','Die Sitzung wurde beendet. Bitte erneut anmelden.',401);
 if(Date.parse(session.expiresAt||'')<=Date.now())throw error('SESSION_INVALID','Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.',401);
 const teamDoc=await readJson(c.team,emptyTeam(),false),team=teamDoc.value||emptyTeam(),users=Array.isArray(team.users)?team.users:[];
 const user=users.find(u=>text(u.id)===text(session.userId)||usernameOf(u)===lower(session.username));
 if(!user||!isActive(user))throw error('ACCOUNT_DISABLED','Das Benutzerkonto ist deaktiviert.',403);
 if(Number(session.authVersion||0)!==Number(user.authVersion||0))throw error('SESSION_REVOKED','Die Sitzung wurde beendet. Bitte erneut anmelden.',401);
 if((session.mustChange||user.mustChange)===true)throw error('PASSWORD_CHANGE_REQUIRED','Vor der Nutzung muss das Startpasswort geändert werden.',403);
 return {token,session,user,team,teamEtag:teamDoc.etag,sessionSource:source};
}
function sanitizeForClient(document,adminView){
 const out=clone(document||emptyTeam());delete out.authBootstrap;out.users=publicUsers(out.users,adminView);out.state=out.state&&typeof out.state==='object'?out.state:{};out.state.users=clone(out.users);return out;
}
async function metadataOnly(blob){
 try{const p=await blob.getProperties(),m=p.metadata||{};if(m.revision!==undefined)return {schemaVersion:Number(m.schema||3),revision:Number(m.revision||0),updatedAt:m.updatedepoch?new Date(Number(m.updatedepoch)).toISOString():(p.lastModified||null),clientVersion:m.clientversion||null};
 const d=await readJson(blob,emptyTeam());const v=d.value||emptyTeam();return {schemaVersion:Number(v.schemaVersion||3),revision:Number(v.revision||0),updatedAt:v.updatedAt||null,clientVersion:v.clientVersion||null};}
 catch(e){if(e&&e.statusCode===404)return {schemaVersion:3,revision:0,updatedAt:null,clientVersion:null};throw e}
}
function normalizeIncoming(payload){const state=sanitizeState(payload.state||{});delete state.users;return {clientVersion:text(payload.clientVersion),baseRevision:Number(payload.baseRevision||0),deviceId:text(payload.deviceId),reason:text(payload.reason||'save'),state}}
async function saveMerged(blob,incoming,user){
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  const d=await readJson(blob,emptyTeam()),current=d.value||emptyTeam();
  const merged=pruneTombstones(mergeState(current.state||{},incoming.state||{}));delete merged.users;merged.users=publicUsers(current.users||[],false);
  const next={schemaVersion:3,revision:Number(current.revision||0)+1,updatedAt:now(),updatedBy:text(user.name||user.user),updatedByUserId:text(user.id),updatedByDevice:incoming.deviceId||null,clientVersion:incoming.clientVersion||null,state:merged,users:current.users||[],authBootstrap:current.authBootstrap&&typeof current.authBootstrap==='object'?clone(current.authBootstrap):undefined};
  try{await uploadJson(blob,next,d.etag);next.concurrentMerge=Number(incoming.baseRevision||0)!==Number(current.revision||0);next.baseRevision=Number(incoming.baseRevision||0);return next}catch(e){if(e&&e.statusCode===412&&attempt<MAX_RETRIES-1)continue;throw e}
 }
 throw error('CONCURRENT_UPDATE','Der Teamstand konnte nach mehreren Konfliktversuchen nicht gespeichert werden.',409);
}

module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store','Allow':'GET, POST, OPTIONS'},body:''};return}
 try{
  const payload=body(req),c=await clients(),current=await validateSession(req,payload,c),blob=c.team;
  const queryMode=req.query?lower(req.query.mode):'',mode=queryMode||lower(payload.action||payload.mode);
  if(req.method==='GET'||(req.method==='POST'&&(mode==='read'||mode==='meta'))){
   if(mode==='meta'||(req.query&&String(req.query.meta||'')==='1')){context.res=json(200,Object.assign({ok:true,metaOnly:true},await metadataOnly(blob)));return}
   const stored=await readJson(blob,emptyTeam()),client=sanitizeForClient(stored.value||emptyTeam(),isAdmin(current.user));context.res=json(200,Object.assign({ok:true},client));return
  }
  if(req.method==='POST'){
   if(mode&&mode!=='save')throw error('UNKNOWN_STATE_ACTION','Unbekannte Teamdatenaktion.',400);
   if(!hasAnyEditRight(current.user))throw error('WRITE_FORBIDDEN','Für Änderungen fehlen Bearbeitungsrechte.',403);
   const saved=await saveMerged(blob,normalizeIncoming(payload),current.user),client=sanitizeForClient(saved,isAdmin(current.user));
   const ack=req.query&&(String(req.query.ack||'')==='1'||lower(req.query.mode)==='ack'||lower(req.query.mode)==='save');
   if(ack){const out={ok:true,ackOnly:true,schemaVersion:Number(saved.schemaVersion||3),revision:Number(saved.revision||0),updatedAt:saved.updatedAt||null,updatedBy:saved.updatedBy||null,concurrentMerge:saved.concurrentMerge===true};if(saved.concurrentMerge){out.state=client.state;out.users=client.users}context.res=json(200,out);return}
   context.res=json(200,Object.assign({ok:true},client));return
  }
  context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST, OPTIONS'});
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('ExportHUB state API error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(e&&e.status?e.status:500,{ok:false,code:e&&e.code?e.code:'SERVER_ERROR',message:e&&e.message?e.message:'Unbekannter Speicherfehler.'});
 }
};
