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
// RC1723: A complete, administrator-verified pair can address a SharePoint
// document-library folder without relying on a user's default OneDrive.
// The folder ID denotes the existing Sendungen root, never an inferred folder.
function exactTarget(environment='production'){
 // RC1724: a TESTSERVICE photo is not allowed to default to the production
 // reference library or a personal OneDrive. This must fail before a Graph
 // write when no separate, explicitly verified test root is configured.
 if(text(environment).toLowerCase()==='testservice'){
  const driveId=text(process.env.EXPORTHUB_TEST_REFERENCE_DRIVE_ID),
        folderId=text(process.env.EXPORTHUB_TEST_REFERENCE_FOLDER_ID);
  if(!driveId||!folderId)throw error('GRAPH_TEST_REFERENCE_TARGET_NOT_CONFIGURED',
   'TESTSERVICE-Containerfotos benötigen eine separate SharePoint-Drive-ID und Stammordner-ID.',503);
  const prodDrive=text(process.env.EXPORTHUB_REFERENCE_DRIVE_ID),
        prodFolder=text(process.env.EXPORTHUB_REFERENCE_FOLDER_ID);
  if(driveId===prodDrive&&folderId===prodFolder)throw error('GRAPH_TEST_REFERENCE_TARGET_NOT_ISOLATED',
   'TESTSERVICE und Produktion dürfen nicht denselben SharePoint-REF-Stammordner verwenden.',503);
  return{driveId,folderId};
 }
 const driveId=text(process.env.EXPORTHUB_REFERENCE_DRIVE_ID),folderId=text(process.env.EXPORTHUB_REFERENCE_FOLDER_ID);
 if(!!driveId!==!!folderId)throw error('GRAPH_REFERENCE_EXACT_TARGET_INCOMPLETE','Für die SharePoint-REF-Ablage müssen Drive-ID und Stammordner-ID gemeinsam hinterlegt werden.',503);
 return driveId?{driveId,folderId}:null;
}
function exactBase(target){return GRAPH_BASE+'/drives/'+encodeURIComponent(target.driveId)}
function config(){
 const target=exactTarget();
 const tenant=text(process.env.EXPORTHUB_GRAPH_TENANT_ID),clientId=text(process.env.EXPORTHUB_GRAPH_CLIENT_ID),secret=text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
 if(!tenant||!clientId||!secret||(!DRIVE_USER&&!target))throw error('GRAPH_NOT_CONFIGURED','Der Microsoft-Graph-Zugriff für die Ref-Ordner ist serverseitig nicht vollständig konfiguriert.',503);
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
async function getFolder(reference,environment='production'){
 const ref=refValue(reference),path=folderPath(ref),target=exactTarget(environment);
 const url=target
  ? exactBase(target)+'/items/'+encodeURIComponent(target.folderId)+':/'+encodeURIComponent(ref)+'?$select=id,name,webUrl,folder,parentReference'
  : GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(path)+'?$select=id,name,webUrl';
 const res=await graph(url);
 if(res.status===404){
  if(target){
   // A 404 for a REF child is only a missing shipment folder when the exact
   // parent is itself readable. Never silently treat a wrong library as empty.
   const root=await graph(exactBase(target)+'/items/'+encodeURIComponent(target.folderId)+'?$select=id,folder');
   const meta=await root.json().catch(()=>({}));
   if(!root.ok||text(meta.id)!==target.folderId||!meta.folder)throw error('GRAPH_REFERENCE_EXACT_TARGET_UNREADABLE','Die konfigurierte SharePoint-Dokumentbibliothek oder der Stammordner ist für die Graph-App nicht erreichbar.',503);
  }
  return null;
 }
 let data={};try{data=await res.json()}catch(_){}
 if(!res.ok)throw error('GRAPH_REFERENCE_FOLDER_READ_FAILED',data.error&&data.error.message||'api.reference.folderCheckFailed',res.status>=500?502:res.status,{status:res.status});
 if(target&&(text(data.name)!==ref||!data.folder||text(data.parentReference&&data.parentReference.id)!==target.folderId))
  throw error('GRAPH_REFERENCE_FOLDER_UNVERIFIED','Der REF-Unterordner wurde in der angegebenen SharePoint-Bibliothek nicht eindeutig bestätigt.',502);
 return data;
}
async function ensureFolder(reference,environment='production'){
 const ref=refValue(reference),existing=await getFolder(ref,environment);if(existing)return existing;
 const target=exactTarget(environment);
 const url=target?exactBase(target)+'/items/'+encodeURIComponent(target.folderId)+'/children':GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(REFERENCE_FOLDER)+':/children';
 const res=await graph(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:ref,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});
 if(res.status===409){const found=await getFolder(ref,environment);if(found)return found}
 let data={};try{data=await res.json()}catch(_){}
 if(!res.ok)throw error('GRAPH_REFERENCE_FOLDER_CREATE_FAILED',data.error&&data.error.message||'api.reference.folderCreateFailed',res.status>=500?502:res.status,{status:res.status});
 if(target&&(text(data.id)===''||text(data.name)!==ref||!data.folder||text(data.parentReference&&data.parentReference.id)!==target.folderId))
  throw error('GRAPH_REFERENCE_FOLDER_UNVERIFIED','Der neu angelegte REF-Ordner konnte in der richtigen Dokumentbibliothek nicht bestätigt werden.',502);
 return data;
}
async function verifyUploadedFile(itemId,file,size,folderId,environment='production'){
 // An upload response alone is not durable storage proof: independently
 // reopen the exact Drive item and confirm the parent REF folder.
 const target=exactTarget(environment);
 const url=target?exactBase(target)+'/items/'+encodeURIComponent(itemId)+'?$select=id,name,size,parentReference,file':GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/items/'+encodeURIComponent(itemId)+'?$select=id,name,size,parentReference,file';
 for(let attempt=0;attempt<3;attempt++){
  try{
   const res=await graph(url),data=await res.json().catch(()=>({}));
   if(res.ok&&text(data.id)===itemId&&text(data.name)===file&&
      Number.isSafeInteger(data.size)&&data.size===size&&
      text(data.parentReference&&data.parentReference.id)===folderId&&data.file){
    return;
   }
   // Bad metadata can be a stale Graph result, but must never be accepted.
   if([400,401,403].includes(res.status))break;
  }catch(_){/* transient Graph request; do not report upload success */}
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
 }
 throw error('GRAPH_REFERENCE_FILE_READBACK_FAILED',
  'Microsoft Graph konnte die gespeicherte Datei im richtigen REF-Ordner nicht unabhängig bestätigen. Bitte den Upload erneut versuchen.',502);
}

async function upload(reference,name,buffer,mimeType,environment='production'){
 const ref=refValue(reference),file=safeFileName(name);if(!Buffer.isBuffer(buffer)||!buffer.length)throw error('REFERENCE_FILE_EMPTY','Datei ist leer.',400);
 const folder=await ensureFolder(ref,environment),folderId=text(folder&&folder.id);
 if(!folderId)throw error('GRAPH_REFERENCE_FOLDER_UNVERIFIED','Der REF-Ordner wurde von Microsoft Graph nicht eindeutig bestätigt.',502);
 const target=exactTarget(environment),path=folderPath(ref)+'/'+file;
 const url=target?exactBase(target)+'/items/'+encodeURIComponent(folderId)+':/'+encodeURIComponent(file)+':/content':GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(path)+':/content';
 const res=await graph(url,{method:'PUT',headers:{'Content-Type':text(mimeType)||'application/octet-stream','Content-Length':String(buffer.length),Accept:'application/json'},body:buffer});
 let data={};try{data=await res.json()}catch(_){}
 if(!res.ok)throw error('GRAPH_REFERENCE_FILE_UPLOAD_FAILED',data.error&&data.error.message||'api.reference.fileUploadFailed',res.status>=500?502:res.status,{status:res.status});
 // A successful HTTP response without a matching Drive item is not proof
 // that the photo was stored under this reference. Never return a fake
 // success (or fall back to the local buffer length) on incomplete Graph data.
 const itemId=text(data.id),itemName=text(data.name),itemSize=Number(data.size);
 if(!itemId||itemName!==file||!Number.isSafeInteger(itemSize)||itemSize!==buffer.length){
  throw error('GRAPH_REFERENCE_FILE_UNVERIFIED','Microsoft Graph hat die Datei im REF-Ordner nicht vollständig bestätigt. Bitte den Upload erneut versuchen.',502);
 }
 await verifyUploadedFile(itemId,file,buffer.length,folderId,environment);
 return{id:itemId,name:itemName,size:itemSize,webUrl:text(data.webUrl),folderPath:folderPath(ref),reference:ref};
}
async function listFiles(reference,environment='production'){
 const ref=refValue(reference),select='id,name,file,folder,createdDateTime,lastModifiedDateTime';
 // A TESTSERVICE AV scan must never read the production REF directory.
 const target=exactTarget(environment),refFolder=target?await getFolder(ref,environment):null;
 if(target&&!refFolder)return [];
 const first=target?exactBase(target)+'/items/'+encodeURIComponent(refFolder.id)+'/children?$top=200&$select='+encodeURIComponent(select):GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/root:/'+encPath(folderPath(ref))+':/children?$top=200&$select='+encodeURIComponent(select);
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
     pending.push({url:target?exactBase(target)+'/items/'+encodeURIComponent(id)+'/children?$top=200&$select='+encodeURIComponent(select):GRAPH_BASE+'/users/'+encodeURIComponent(DRIVE_USER)+'/drive/items/'+encodeURIComponent(id)+'/children?$top=200&$select='+encodeURIComponent(select),depth:task.depth+1});
    }
   }
   url=data['@odata.nextLink']||'';pages++;
  }
  if(url)throw error('GRAPH_REFERENCE_FOLDER_LIST_TRUNCATED','Die REF-Dateiliste hat mehr Ergebnisseiten als sicher geprüft werden konnten.',503);
 }
 return files;
}
// Used by the photo writer before the first Azure write. No network request.
function assertTargetForEnvironment(environment){exactTarget(environment);return true}
module.exports={GRAPH_BASE,REFERENCE_FOLDER,DRIVE_USER,refValue,safeFileName,folderPath,ensureFolder,upload,listFiles,config,assertTargetForEnvironment};
