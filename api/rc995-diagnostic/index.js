'use strict';

function text(v){return String(v==null?'':v).trim()}
function safeError(e){return{code:text(e&&e.code)||'ERROR',status:Number(e&&(e.status||e.statusCode)||0)||0,message:text(e&&e.message).slice(0,240)}}
function reply(context,status,body){context.res={status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'},body:JSON.stringify(body)}}

module.exports=async function(context,req){
 const h=req&&req.headers||{},host=text(h.host||h.Host||h['x-forwarded-host']||h['X-Forwarded-Host']).toLowerCase(),explicit=text(h['x-exporthub-environment']||h['X-ExportHUB-Environment']).toLowerCase();
 if(!host.includes('-testservice.')&&explicit!=='testservice'){reply(context,404,{ok:false,code:'NOT_FOUND'});return}
 const result={ok:true,version:'RC995',node:process.version,hostIsTestservice:host.includes('-testservice.'),explicitEnvironment:explicit,settings:{storageConfigured:!!(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage),publicAccessSecretConfigured:!!process.env.EXPORTHUB_PUBLIC_ACCESS_SECRET,pickupSecretConfigured:!!process.env.EXPORTHUB_PICKUP_SECRET,authSigningSecretConfigured:!!process.env.EXPORTHUB_AUTH_SIGNING_SECRET,publicAccessContainerConfigured:!!process.env.EXPORTHUB_PUBLIC_ACCESS_CONTAINER,pickupLockContainerConfigured:!!process.env.EXPORTHUB_PICKUP_LOCK_CONTAINER},modules:{},checks:{}};
 let azure=null,access=null,pickup=null;
 try{azure=require('@azure/storage-blob');result.modules.azureStorage={ok:true,version:(()=>{try{return require('@azure/storage-blob/package.json').version}catch(_){return''}})()}}catch(e){result.ok=false;result.modules.azureStorage={ok:false,error:safeError(e)}}
 try{access=require('../shared/public-access-store');result.modules.publicAccessStore={ok:true,container:access.CONTAINER};result.checks.environment=access.environment(req,{environment:'testservice'});result.checks.tokenFormat=access.tokenValid('a'.repeat(48));try{access.hashToken('a'.repeat(48),'testservice','pickup');result.checks.tokenHash=true}catch(e){result.checks.tokenHash={ok:false,error:safeError(e)}}}catch(e){result.ok=false;result.modules.publicAccessStore={ok:false,error:safeError(e)}}
 try{pickup=require('../shared/pickup-store');result.modules.pickupStore={ok:true,recordContainer:pickup.RECORD_CONTAINER,podContainer:pickup.POD_CONTAINER};result.checks.pickupConnectionConfigured=!!pickup.connectionString()}catch(e){result.ok=false;result.modules.pickupStore={ok:false,error:safeError(e)}}
 if(access){try{await access.resolve(req,'pickup','a'.repeat(48),{allowUsed:false},{environment:'testservice'});result.checks.resolveInvalidToken={ok:true,unexpectedRecord:true}}catch(e){result.checks.resolveInvalidToken={ok:false,error:safeError(e)}}}
 if(azure&&result.settings.storageConfigured){try{const cs=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage,service=azure.BlobServiceClient.fromConnectionString(cs),names=[access&&access.CONTAINER,pickup&&pickup.RECORD_CONTAINER,pickup&&pickup.POD_CONTAINER].filter(Boolean);result.checks.containers=[];for(const name of [...new Set(names)]){const c=service.getContainerClient(name);try{await c.getProperties();result.checks.containers.push({name,reachable:true,exists:true})}catch(e){const status=Number(e&&(e.statusCode||e.status)||0)||0;result.checks.containers.push({name,reachable:status===404,exists:false,error:safeError(e)})}}}catch(e){result.checks.storageClient={ok:false,error:safeError(e)}}}
 reply(context,200,result)
};
