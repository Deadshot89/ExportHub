import {fileURLToPath} from 'node:url';
import path from 'node:path';

// RC1787. Read-only deployment gate. Never uploads files, never authenticates.
export const BASE_URLS=Object.freeze({
 testservice:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
 production:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'
});

export function verifyUploadAsset(status,source){
 if(status!==200)throw new Error('RC1787: invoice upload UI not served (HTTP '+status+')');
 for(const marker of ['data-rc1294-files','function authToken(){','exporthub_rc301_tab_session','ABD_UPLOAD_ROUTE_UNAVAILABLE']){
  if(!String(source||'').includes(marker))throw new Error('RC1787: published invoice UI is outdated (missing '+marker+')');
 }
 return true;
}

export function verifyUnauthenticatedApi(status,type,body){
 // The POST-only upload route validates its dedicated ExportHUB token before any
 // file or storage operation. An unauthenticated probe MUST return API JSON/401,
 // not a static HTML fallback, a platform login redirect, or a fake success.
 if(status!==401)throw new Error('RC1787: upload API routing/auth probe returned HTTP '+status+' instead of 401');
 if(!String(type||'').toLowerCase().includes('application/json'))throw new Error('RC1787: upload API did not return JSON');
 let json;try{json=JSON.parse(String(body||''))}catch{throw new Error('RC1787: upload API JSON malformed')}
 if(!json||json.ok!==false||json.code!=='AUTH_REQUIRED'){
  // Log only the bounded machine-readable code: never echo API body, messages, tokens or headers.
  const observed=typeof json?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(json.code)?json.code:'UNKNOWN';
  throw new Error('RC1787: upload API did not enforce AUTH_REQUIRED (received code='+observed+')');
 }
 return true;
}

export async function verifyLiveUploadRoute(environment,sha,fetcher=fetch){
 const base=BASE_URLS[environment];
 if(!base||!/^[0-9a-f]{40}$/i.test(String(sha||'')))throw new Error('RC1787: unsupported environment or invalid 40-character SHA');
 const asset=await fetcher(base+'/assets/rc1294-abd-self-service.js?rc1787='+sha,{
  method:'GET',redirect:'manual',headers:{Accept:'text/javascript','Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)
 });
 verifyUploadAsset(asset.status,await asset.text());
 const probe=await fetcher(base+'/api/abd-analysis?rc1787='+sha,{
  method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache'},
  body:JSON.stringify({action:'status',uploadId:'rc1787-nonexistent'}),
  signal:AbortSignal.timeout(20000)
 });
 verifyUnauthenticatedApi(probe.status,probe.headers&&probe.headers.get('content-type'),await probe.text());
 return {environment,uploadUi:'verified',apiRoute:'verified',authGuard:'AUTH_REQUIRED'};
}

async function main(){
 const environment=process.argv[2],sha=process.argv[3];
 let last;
 for(let attempt=1;attempt<=5;attempt++){
  try{
   const result=await verifyLiveUploadRoute(environment,sha);
   console.log('RC1787 live upload-route smoke',JSON.stringify(result));
   return;
  }catch(error){
   last=error;
   if(attempt<5)await new Promise(resolve=>setTimeout(resolve,4000));
  }
 }
 throw last;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error(error&&error.message||String(error));process.exitCode=1});
}
