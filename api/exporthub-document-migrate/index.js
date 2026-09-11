'use strict';
const auth=require('../shared/fast-auth-store');
const {migrateLegacyDocuments}=require('../shared/document-blob-store');

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function json(status,body,headers={}){return{status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},headers),body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function requestEnvironment(req){
 const h=req&&req.headers||{},host=lower(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||h['X-Original-Host']||h.host||h.Host||''),body=lower(req&&req.body&&req.body.environment||'');
 const hostTest=/-testservice\./i.test(host),hostAzure=/\.azurestaticapps\.net(?:[:/]|$)/i.test(host),hostProd=hostAzure&&!hostTest;
 if(body&&body!=='production'&&body!=='testservice')throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Datenumgebung.',400);
 if(hostTest){if(body&&body!=='testservice')throw error('ENVIRONMENT_MISMATCH','Ein Testservice-Aufruf darf keine Produktionsdaten migrieren.',409);return'testservice'}
 if(hostProd){if(body&&body!=='production')throw error('ENVIRONMENT_MISMATCH','Die Produktionsseite darf keine Testservice-Daten migrieren.',409);return'production'}
 return body||'production';
}
function migrationLimit(value){const n=Number(value);if(!Number.isFinite(n))return 5;return Math.max(1,Math.min(10,Math.floor(n)))}
function aggregate(result){return{ok:true,found:Number(result&&result.found||0),migrated:Number(result&&result.migrated||0),skipped:Number(result&&result.skipped||0),failed:Number(result&&result.failed||0),remaining:Number(result&&result.remaining||0),bytesMoved:Number(result&&result.bytesMoved||0),done:result&&result.done===true}}

module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'},{Allow:'POST, OPTIONS'});return}
  const validated=await auth.validateSession(req);
  if(typeof auth.isAdmin!=='function'||!auth.isAdmin(validated.user))throw error('ADMIN_REQUIRED','Für die Dokumentmigration sind Administratorrechte erforderlich.',403);
  const environment=requestEnvironment(req),limit=migrationLimit(req&&req.body&&req.body.limit);
  const teamDoc=validated.teamDoc;
  if(!teamDoc||!teamDoc.value)throw error('TEAM_STATE_UNAVAILABLE','Team-State konnte nicht geladen werden.',503);
  const result=await migrateLegacyDocuments(teamDoc.value,{environment,limit});
  if(Number(result.migrated||0)>0){
   const clients=await auth.clients();
   await auth.writeJson(clients.team,result.state,teamDoc.etag);
  }
  context.res=json(200,aggregate(result));
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('ExportHUB document migration API error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'Dokumentmigration fehlgeschlagen.'});
 }
};
