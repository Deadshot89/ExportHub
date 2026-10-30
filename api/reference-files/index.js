'use strict';
const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const apiI18n=require('../shared/i18n');
const referenceFolder=require('../shared/reference-folder-upload');
const avCheck=require('../shared/av-check');
const publicAccess=require('../shared/public-access-store');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const AUTH_BLOB=process.env.EXPORTHUB_AUTH_BLOB||'auth-sessions.json';
const GRAPH_BASE='https://graph.microsoft.com/v1.0';
const REFERENCE_FOLDER=(process.env.EXPORTHUB_REFERENCE_FOLDER||'003 Export/ExportHub/Sendungen').replace(/^\/+|\/+$/g,'');
const DRIVE_USER=process.env.EXPORTHUB_REFERENCE_DRIVE_USER||process.env.EXPORTHUB_POD_DRIVE_USER||'tobiaslimberg@essentra.com';
const MAX_FILE_BYTES=35*1024*1024;
const AV_MAX_BYTES=15*1024*1024;
const AV_TYPES={'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};
let graphTokenCache=null;

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function json(status,body,headers){return{status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},headers||{}),body:JSON.stringify(body)}}
function error(code,message,status,vars){const e=new Error(message||code);e.code=code||'SERVER_ERROR';e.status=Number(status||500);e.vars=vars||{};return e}
function localizedError(req,e){const m=text(e&&e.message);return /^api\./.test(m)?apiI18n.t(req,m,e&&e.vars):m}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function safeEqualText(a,b){const aa=Buffer.from(String(a||''),'utf8'),bb=Buffer.from(String(b||''),'utf8');return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb)}
function tokenHash(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex')}
function usernameOf(user){return lower(user&&(user.user||user.login||user.username||user.name))}
function isActive(user){return Boolean(user&&user.active!==false&&user.disabled!==true&&lower(user.status)!=='deaktiviert')}
function signingSecret(){const configured=text(process.env.EXPORTHUB_AUTH_SIGNING_SECRET||process.env.EXPORTHUB_SESSION_SECRET),source=configured||connectionString();if(!source)throw error('AUTH_SIGNING_NOT_CONFIGURED','api.reference.signingMissing',503);return crypto.createHash('sha256').update('ExportHUB/session/v1|'+source).digest()}
function verifySignedSessionToken(token){const parts=text(token).split('.');if(parts.length!==3||parts[0]!=='ehs1')return null;const expected=crypto.createHmac('sha256',signingSecret()).update(parts[1]).digest('base64url');if(!safeEqualText(expected,parts[2]))return null;let p;try{p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch(_){return null}if(!p||p.purpose!=='exporthub-session'||Number(p.v||0)!==1||!p.uid||!p.sid||Number(p.exp||0)<=Date.now())return null;return p}
function bearer(req){const h=req&&req.headers||{},dedicated=h['x-exporthub-token']||h['X-ExportHUB-Token']||h['x-exporthub-session']||h['X-ExportHUB-Session'];if(text(dedicated))return text(dedicated);const auth=h.authorization||h.Authorization||'',m=String(auth).match(/^Bearer\s+(.+)$/i);return m?m[1].trim():''}
async function readJson(blob,fallback,repair){try{const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));try{const raw=Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'').replace(/\u0000+$/g,'').trim();return{value:raw?JSON.parse(raw):fallback,etag:r.etag||null}}catch(e){if(repair)return{value:fallback,etag:r.etag||null};throw e}}catch(e){if(e&&e.statusCode===404)return{value:fallback,etag:null};throw e}}
async function validateSession(req){const token=bearer(req);if(!token)throw error('AUTH_REQUIRED','api.common.authRequired',401);const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','api.common.storageNotConfigured',503);const svc=BlobServiceClient.fromConnectionString(cs),container=svc.getContainerClient(TEAM_CONTAINER),authBlob=container.getBlockBlobClient(AUTH_BLOB),teamBlob=container.getBlockBlobClient(TEAM_BLOB),reads=await Promise.all([readJson(authBlob,{sessions:[]},true),readJson(teamBlob,{state:{},users:[]},false)]),sessions=Array.isArray(reads[0].value&&reads[0].value.sessions)?reads[0].value.sessions:[],hash=tokenHash(token);let session=sessions.find(s=>safeEqualText(s.tokenHash,hash));if(!session){const signed=verifySignedSessionToken(token);if(signed)session={id:text(signed.sid),userId:text(signed.uid),username:text(signed.username),expiresAt:new Date(Number(signed.exp)).toISOString(),authVersion:Number(signed.authVersion||0),mustChange:signed.mustChange===true}}
 if(!session)throw error('SESSION_INVALID','api.common.sessionInvalid',401);if(session.revokedAt||Date.parse(session.expiresAt||'')<=Date.now())throw error('SESSION_INVALID','api.common.sessionInvalid',401);const team=reads[1].value||{},users=Array.isArray(team.users)?team.users:[],user=users.find(u=>text(u.id)===text(session.userId)||usernameOf(u)===lower(session.username));if(!user||!isActive(user))throw error('ACCOUNT_DISABLED','api.common.accountDisabled',403);if(Number(session.authVersion||0)!==Number(user.authVersion||0))throw error('SESSION_REVOKED','api.common.sessionRevoked',401);if((session.mustChange||user.mustChange)===true)throw error('PASSWORD_CHANGE_REQUIRED','api.common.passwordChangeRequired',403);return{user,team}}
function graphConfig(){const tenant=text(process.env.EXPORTHUB_GRAPH_TENANT_ID),clientId=text(process.env.EXPORTHUB_GRAPH_CLIENT_ID),secret=text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);if(!tenant||!clientId||!secret||!DRIVE_USER)throw error('GRAPH_NOT_CONFIGURED','api.reference.graphNotConfigured',503);return{tenant,clientId,secret}}
async function graphToken(){if(graphTokenCache&&graphTokenCache.expiresAt>Date.now()+60000)return graphTokenCache.token;const c=graphConfig(),form=new URLSearchParams({client_id:c.clientId,client_secret:c.secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),res=await fetch('https://login.microsoftonline.com/'+encodeURIComponent(c.tenant)+'/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});let data={};try{data=await res.json()}catch(_){}if(!res.ok||!data.access_token)throw error('GRAPH_AUTH_FAILED',data.error_description||'api.reference.graphAuthFailed',502);graphTokenCache={token:data.access_token,expiresAt:Date.now()+Math.max(300,Number(data.expires_in||3600))*1000};return graphTokenCache.token}
async function graphFetch(url,options){const token=await graphToken(),opts=Object.assign({},options||{}),headers=Object.assign({Authorization:'Bearer '+token,Accept:'application/json'},opts.headers||{});opts.headers=headers;const res=await fetch(url,opts);return res}
function encPath(path){return String(path||'').split('/').filter(Boolean).map(encodeURIComponent).join('/')}
function refValue(v){const ref=text(v).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(ref))throw error('INVALID_REFERENCE','api.reference.invalidReference',400);return ref}
function folderPath(ref){return REFERENCE_FOLDER+'/'+ref}
async function listFiles(ref,req){
 const path=folderPath(ref),select='id,name,size,file,folder,createdDateTime,lastModifiedDateTime,webUrl,parentReference';
 const first=GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(path)+':/children?$top=200&$select='+encodeURIComponent(select);
 // Include documents in bounded subfolders. The old direct-child-only reader silently returned
 // zero files whenever a REF folder contained only category subfolders.
 const pending=[{url:first,depth:0}],seenFolders=new Set(),seenFiles=new Set(),files=[];
 const MAX_DEPTH=4,MAX_FOLDERS=36,MAX_FILES=1500;
 let visited=0,folderWebUrl='';
 while(pending.length){
  if(++visited>MAX_FOLDERS)throw error('GRAPH_REFERENCE_FOLDER_SCAN_LIMIT','Der Referenzordner enthält zu viele Unterordner für eine vollständige Dateiprüfung.',503);
  const task=pending.shift();let url=task.url,pages=0;
  while(url&&pages<6){
   const res=await graphFetch(url);
   if(res.status===404){
    if(task.depth===0)return{files:[],folderPath:path,folderMissing:true,folderWebUrl:''};
    url='';break; // The child folder may have been removed while listing the parent.
   }
   let data={};try{data=await res.json()}catch(_){}
   if(!res.ok)throw error('GRAPH_LIST_FAILED',data.error&&data.error.message||'api.reference.listFailed',res.status>=500?502:res.status,{status:res.status});
   for(const item of Array.isArray(data.value)?data.value:[]){
    if(!item)continue;
    const id=text(item.id);
    if(item.file){
     if(!id||seenFiles.has(id))continue;
     if(files.length>=MAX_FILES)throw error('GRAPH_REFERENCE_FILE_LIMIT','Der Referenzordner enthält zu viele Dateien für eine vollständige Dateiprüfung.',503);
     seenFiles.add(id);
     files.push({id,name:text(item.name)||apiI18n.t(req,'api.reference.document'),size:Number(item.size||0),mimeType:text(item.file&&item.file.mimeType)||'application/octet-stream',createdDateTime:item.createdDateTime||null,lastModifiedDateTime:item.lastModifiedDateTime||null,webUrl:text(item.webUrl)});
     if(!folderWebUrl&&item.parentReference&&item.parentReference.path)folderWebUrl=text(item.parentReference.path);
    }else if(item.folder&&id&&!seenFolders.has(id)){
     if(task.depth>=MAX_DEPTH)throw error('GRAPH_REFERENCE_DEPTH_LIMIT','Der Referenzordner enthält weitere Unterordner, die nicht vollständig geprüft werden konnten.',503);
     seenFolders.add(id);
     pending.push({url:GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/items/'+encodeURIComponent(id)+'/children?$top=200&$select='+encodeURIComponent(select),depth:task.depth+1});
    }
   }
   url=data['@odata.nextLink']||'';
   pages++;
  }
  if(url)throw error('GRAPH_REFERENCE_PAGINATION_LIMIT','Der Referenzordner konnte nicht vollständig eingelesen werden.',503);
 }
 files.sort((a,b)=>String(b.createdDateTime||b.lastModifiedDateTime||'').localeCompare(String(a.createdDateTime||a.lastModifiedDateTime||''))||a.name.localeCompare(b.name,'de'));
 return{files,folderPath:path,folderMissing:false,folderWebUrl};
}
function disposition(name,mode,req){const safe=text(name).replace(/[\r\n"]/g,'_').slice(0,180)||apiI18n.t(req,'api.reference.document');return(mode==='download'?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(safe)}
function requestBody(req){if(req&&req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body))return req.body;try{return JSON.parse(String(req&&req.body||'{}'))}catch(_){return{}}}
function signatureOk(ext,buf){if(ext==='.pdf')return buf.length>=5&&buf.subarray(0,5).toString('ascii')==='%PDF-';if(ext==='.jpg'||ext==='.jpeg')return buf.length>=3&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff;if(ext==='.png')return buf.length>=8&&buf.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));return false}
// AV-Upload: legt den Ausgangsvermerk im REF-Ordner ab. Der Dateiname beginnt immer mit "AV",
// damit die AV-Prüfung (/api/av-check) ihn erkennt.
function avUploadFile(ref,payload){const original=referenceFolder.safeFileName(payload.fileName||payload.name||'Ausgangsvermerk.pdf'),m=original.toLowerCase().match(/(\.[a-z0-9]+)$/),ext=m?m[1]:'',expected=AV_TYPES[ext];if(!expected)throw error('AV_FILE_TYPE_INVALID','Nur PDF, JPG oder PNG sind erlaubt.',400);const raw=text(payload.data).replace(/^data:[^,]*,/,'');if(!raw||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw error('AV_FILE_EMPTY','Datei ist leer oder ungültig.',400);const buffer=Buffer.from(raw,'base64');if(!buffer.length)throw error('AV_FILE_EMPTY','Datei ist leer oder ungültig.',400);if(buffer.length>AV_MAX_BYTES)throw error('AV_FILE_TOO_LARGE','Datei ist größer als 15 MB.',413);if(!signatureOk(ext,buffer))throw error('AV_FILE_SIGNATURE_INVALID','Dateiinhalt passt nicht zum Dateityp.',400);const name=avCheck.isAvFileName(original)?original:referenceFolder.safeFileName('AV_'+ref+'_'+original);return{name,buffer,mimeType:expected}}
// Dokument-Upload aus der Sendungsansicht: Lieferscheine, Rechnungen, Excel usw. landen im REF-Ordner.
// Der Dateiname bekommt Dokumentart, Referenz und Zeitstempel, damit nichts überschrieben wird
// und die AV-Prüfung ein solches Dokument nie als Ausgangsvermerk zählt.
const DOC_MAX_BYTES=15*1024*1024;
const DOC_KINDS={lieferschein:'Lieferschein',rechnung:'Rechnung',packliste:'Packliste',excel:'Excel',sonstiges:'Dokument'};
const DOC_TYPES={'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.xlsm':'application/vnd.ms-excel.sheet.macroEnabled.12','.xls':'application/vnd.ms-excel','.csv':'text/csv','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.doc':'application/msword','.txt':'text/plain','.msg':'application/vnd.ms-outlook','.eml':'message/rfc822'};
function docSignatureOk(ext,buf){if(ext in AV_TYPES)return signatureOk(ext,buf);if(ext==='.xlsx'||ext==='.xlsm'||ext==='.docx')return buf.length>=4&&buf[0]===0x50&&buf[1]===0x4b&&buf[2]===0x03&&buf[3]===0x04;if(ext==='.xls'||ext==='.doc'||ext==='.msg')return buf.length>=8&&buf.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));if(ext==='.csv'||ext==='.txt'||ext==='.eml')return !buf.subarray(0,4096).includes(0);return false}
function documentStamp(now){const d=now instanceof Date?now:new Date(),p=n=>String(n).padStart(2,'0');return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+'-'+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())}
function documentUploadFile(ref,payload,now){const kindKey=lower(payload.kind||'sonstiges'),label=DOC_KINDS[kindKey];if(!label)throw error('DOCUMENT_KIND_INVALID','Unbekannte Dokumentart.',400);const original=referenceFolder.safeFileName(payload.fileName||payload.name||''),m=original.toLowerCase().match(/(\.[a-z0-9]+)$/),ext=m?m[1]:'',expected=DOC_TYPES[ext];if(!expected)throw error('DOCUMENT_FILE_TYPE_INVALID','Erlaubt sind PDF, Bilder (JPG/PNG), Excel (XLSX/XLS/CSV), Word (DOCX/DOC), TXT und E-Mails (MSG/EML).',400);const raw=text(payload.data).replace(/^data:[^,]*,/,'');if(!raw||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw error('DOCUMENT_FILE_EMPTY','Datei ist leer oder ungültig.',400);const buffer=Buffer.from(raw,'base64');if(!buffer.length)throw error('DOCUMENT_FILE_EMPTY','Datei ist leer oder ungültig.',400);if(buffer.length>DOC_MAX_BYTES)throw error('DOCUMENT_FILE_TOO_LARGE','Datei ist größer als 15 MB.',413);if(!docSignatureOk(ext,buffer))throw error('DOCUMENT_FILE_SIGNATURE_INVALID','Dateiinhalt passt nicht zum Dateityp.',400);const name=referenceFolder.safeFileName(label+'_'+ref+'_'+documentStamp(now)+'_'+original);return{name,buffer,mimeType:expected,kind:kindKey}}
async function handleUpload(req){await validateSession(req);const payload=requestBody(req),action=lower(payload.action),ref=refValue(payload.reference);if(action==='upload-av'){const file=avUploadFile(ref,payload),saved=await referenceFolder.upload(ref,file.name,file.buffer,file.mimeType);return json(200,{ok:true,reference:ref,file:{id:saved.id,name:saved.name,size:saved.size}})}if(action==='upload-document'){const file=documentUploadFile(ref,payload),saved=await referenceFolder.upload(ref,file.name,file.buffer,file.mimeType,publicAccess.environment(req,payload));return json(200,{ok:true,reference:ref,file:{id:saved.id,name:saved.name,size:saved.size,kind:file.kind}})}throw error('ACTION_INVALID','Unbekannte Aktion.',400)}
module.exports=async function(context,req){try{if(req.method==='OPTIONS'){context.res=json(204,{}, {Allow:'GET, POST, OPTIONS'});return}if(req.method==='POST'){context.res=await handleUpload(req);return}if(req.method!=='GET'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.getOnly')},{Allow:'GET, POST, OPTIONS'});return}await validateSession(req);const ref=refValue(req.query&&req.query.reference);let listed;try{listed=await listFiles(ref,req)}catch(graphError){if(graphError&&graphError.code==='GRAPH_NOT_CONFIGURED'){context.res=json(200,{ok:true,available:false,code:'GRAPH_NOT_CONFIGURED',message:localizedError(req,graphError),reference:ref,folderPath:folderPath(ref),folderMissing:false,files:[]});return}throw graphError}const itemId=text(req.query&&req.query.itemId);if(!itemId){context.res=json(200,{ok:true,available:true,reference:ref,folderPath:listed.folderPath,folderMissing:listed.folderMissing,files:listed.files});return}const item=listed.files.find(f=>f.id===itemId);if(!item)throw error('FILE_NOT_FOUND','api.reference.fileNotFound',404);if(Number(item.size||0)>MAX_FILE_BYTES)throw error('FILE_TOO_LARGE','api.reference.fileTooLarge',413);const url=GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/items/'+encodeURIComponent(item.id)+'/content',res=await graphFetch(url,{headers:{Accept:'*/*'}});if(!res.ok)throw error('GRAPH_FILE_FAILED','api.reference.fileLoadFailed',res.status>=500?502:res.status);const buffer=Buffer.from(await res.arrayBuffer()),mode=lower(req.query&&req.query.mode)==='download'?'download':'inline';context.res={status:200,headers:{'Content-Type':item.mimeType||res.headers.get('content-type')||'application/octet-stream','Content-Length':String(buffer.length),'Content-Disposition':disposition(item.name,mode,req),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:buffer};}catch(e){if(!(e&&e.code==='GRAPH_NOT_CONFIGURED'))context.log&&context.log.error&&context.log.error('reference-files',e&&e.code,e&&e.message);context.res=json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:localizedError(req,e)||apiI18n.t(req,'api.reference.readFailed')})}}

module.exports.avUploadFile=avUploadFile;
module.exports.documentUploadFile=documentUploadFile;
