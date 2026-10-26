'use strict';

const GRAPH_BASE='https://graph.microsoft.com/v1.0';
const REFERENCE_FOLDER=(process.env.EXPORTHUB_REFERENCE_FOLDER||'003 Export/ExportHub/Sendungen').replace(/^\/+|\/+$/g,'');
const DRIVE_USER=process.env.EXPORTHUB_REFERENCE_DRIVE_USER||process.env.EXPORTHUB_POD_DRIVE_USER||'tobiaslimberg@essentra.com';
let tokenCache=null;

function text(v){return String(v==null?'':v).trim()}
function error(code,message,status=500,vars){const e=new Error(message||code);e.code=code;e.status=status;e.vars=vars||{};return e}
function refValue(v){const ref=text(v).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(ref))throw error('INVALID_REFERENCE','Die Sendungsreferenz ist ungültig.',400);return ref}
function safeFileName(v){const name=text(v).replace(/[\\/:*?"<>|\r\n]+/g,'_').replace(/\s+/g,' ').trim();if(!name)throw error('REFERENCE_FILE_NAME_INVALID','Dateiname fehlt.',400);return name.slice(0,180)}
function encPath(path){return String(path||'').split('/').filter(Boolean).map(encodeURIComponent).join('/')}
function config(){
 const tenant=text(process.env.EXPORTHUB_GRAPH_TENANT_ID),clientId=text(process.env.EXPORTHUB_GRAPH_CLIENT_ID),secret=text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
 if(!tenant||!clientId||!secret||!DRIVE_USER)throw error('GRAPH_NOT_CONFIGURED','Der Microsoft-Graph-Zugriff für die Ref-Ordner ist serverseitig nicht vollständig konfiguriert.',503);
 return{tenant,clientId,secret};
}
async function token(){
 if(tokenCache&&tokenCache.expiresAt>Date.now()+60000)return tokenCache.value;
 const c=config(),form=new URLSearchParams({client_id:c.clientId,client_secret:c.secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'});
 const res=await fetch('https://login.microsoftonline.com/'+encodeURIComponent(c.tenant)+'/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
 let data={};try{data=await res.json()}catch(_){}
 if(!res.ok||!data.access_token)throw error('GRAPH_AUTH_FAILED',data.error_description||'Microsoft Graph konnte nicht authentifiziert werden.',502);
 tokenCache={value:data.access_token,expiresAt:Date.now()+Math.max(300,Number(data.expires_in||3600))*1000};
 return tokenCache.value;
}
async function graph(url,options={}){
 const auth=await token(),opts=Object.assign({},options),headers=Object.assign({Authorization:'Bearer '+auth,Accept:'application/json'},opts.headers||{});opts.headers=headers;
 return fetch(url,opts);
}
function folderPath(reference){return REFERENCE_FOLDER+'/'+refValue(reference)}
async function getFolder(reference){
 const path=folderPath(reference),url=GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(path)+'?$select=id,name,webUrl';
 const res=await graph(url);if(res.status===404)return null;let data={};try{data=await res.json()}catch(_){}
 if(!res.ok)throw error('GRAPH_REFERENCE_FOLDER_READ_FAILED',data.error&&data.error.message||'api.reference.folderCheckFailed',res.status>=500?502:res.status,{status:res.status});
 return data;
}
async function ensureFolder(reference){
 const ref=refValue(reference),existing=await getFolder(ref);if(existing)return existing;
 const url=GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(REFERENCE_FOLDER)+':/children';
 const res=await graph(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:ref,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});
 if(res.status===409){const found=await getFolder(ref);if(found)return found}
 let data={};try{data=await res.json()}catch(_){}
 if(!res.ok)throw error('GRAPH_REFERENCE_FOLDER_CREATE_FAILED',data.error&&data.error.message||'api.reference.folderCreateFailed',res.status>=500?502:res.status,{status:res.status});
 return data;
}
async function upload(reference,name,buffer,mimeType){
 const ref=refValue(reference),file=safeFileName(name);if(!Buffer.isBuffer(buffer)||!buffer.length)throw error('REFERENCE_FILE_EMPTY','Datei ist leer.',400);
 await ensureFolder(ref);
 const path=folderPath(ref)+'/'+file,url=GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(path)+':/content';
 const res=await graph(url,{method:'PUT',headers:{'Content-Type':text(mimeType)||'application/octet-stream','Content-Length':String(buffer.length),Accept:'application/json'},body:buffer});
 let data={};try{data=await res.json()}catch(_){}
 if(!res.ok)throw error('GRAPH_REFERENCE_FILE_UPLOAD_FAILED',data.error&&data.error.message||'api.reference.fileUploadFailed',res.status>=500?502:res.status,{status:res.status});
 return{id:text(data.id),name:text(data.name)||file,size:Number(data.size||buffer.length),webUrl:text(data.webUrl),folderPath:folderPath(ref),reference:ref};
}
async function listFiles(reference){
 const ref=refValue(reference),select='id,name,file,folder,createdDateTime,lastModifiedDateTime';
 const first=GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(folderPath(ref))+':/children?$top=200&$select='+encodeURIComponent(select);
 // Match the main reference-files reader: documents may be filed below
 // category subfolders. A direct-child-only scan can falsely mark AV missing.
 const pending=[{url:first,depth:0}],seenFolders=new Set(),seenFiles=new Set(),files=[];
 const MAX_DEPTH=4,MAX_FOLDERS=36,MAX_FILES=1500;
 let visited=0;
 while(pending.length){
  if(++visited>MAX_FOLDERS)throw error('GRAPH_REFERENCE_FOLDER_SCAN_LIMIT','Der REF-Ordner enthält zu viele Unterordner für eine vollständige AV-Prüfung.',503);
  const task=pending.shift();let url=task.url,pages=0;
  while(url&&pages<6){
   const res=await graph(url);
   if(res.status===404){
    // A missing root on the initial request is an absent REF folder.
    // A vanished subfolder or pagination link means the scan is incomplete:
    // do not create false AV-missing tasks from partial Graph reads.
    if(task.depth===0&&pages===0)return[];
    throw error('GRAPH_REFERENCE_FOLDER_LIST_INCOMPLETE','Der REF-Ordner änderte sich während der AV-Prüfung. Bitte später erneut vollständig prüfen.',503);
   }
   let data={};try{data=await res.json()}catch(_){}
   if(!res.ok)throw error('GRAPH_REFERENCE_FOLDER_LIST_FAILED',data.error&&data.error.message||'api.reference.listFailed',res.status>=500?502:res.status,{status:res.status});
   if(!Array.isArray(data.value))throw error('GRAPH_REFERENCE_FOLDER_LIST_INVALID','Microsoft Graph hat keine gültige REF-Dateiliste geliefert.',502);
   for(const item of data.value){
    if(!item)continue;
    const id=text(item.id);
    if(item.file){
     if(!id||!text(item.name))throw error('GRAPH_REFERENCE_FOLDER_LIST_INVALID','Microsoft Graph lieferte ungültige Datei-Metadaten.',502);
     if(seenFiles.has(id))continue;
     if(files.length>=MAX_FILES)throw error('GRAPH_REFERENCE_FILE_LIMIT','Der REF-Ordner enthält zu viele Dateien für eine vollständige AV-Prüfung.',503);
     seenFiles.add(id);
     files.push({id,name:text(item.name),createdDateTime:item.createdDateTime||null,lastModifiedDateTime:item.lastModifiedDateTime||null});
    }else if(item.folder){
     if(!id)throw error('GRAPH_REFERENCE_FOLDER_LIST_INVALID','Microsoft Graph lieferte einen Unterordner ohne ID.',502);
     if(seenFolders.has(id))continue;
     if(task.depth>=MAX_DEPTH)throw error('GRAPH_REFERENCE_DEPTH_LIMIT','Der REF-Ordner enthält tiefer liegende Unterordner, die nicht vollständig geprüft werden konnten.',503);
     seenFolders.add(id);
     pending.push({url:GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/items/'+encodeURIComponent(id)+'/children?$top=200&$select='+encodeURIComponent(select),depth:task.depth+1});
    }
   }
   url=data['@odata.nextLink']||'';pages++;
  }
  if(url)throw error('GRAPH_REFERENCE_FOLDER_LIST_TRUNCATED','Die REF-Dateiliste hat mehr Ergebnisseiten als sicher geprüft werden konnten.',503);
 }
 return files;
}
module.exports={GRAPH_BASE,REFERENCE_FOLDER,DRIVE_USER,refValue,safeFileName,folderPath,ensureFolder,upload,listFiles,config};
