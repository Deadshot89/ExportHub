// RC1943: read-only proof that the deployed documents workspace really ships the upload picker.
// No authentication, customer data, document upload or API write occurs here.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

export const HOSTS=Object.freeze({
 testservice:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
 production:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'
});

export function assertDocumentUploadAssets(html,runtime,label){
 assert.ok(html.includes('assets/rc1940-documents-workspace.js?v=1940'),label+': document workspace script is not linked in the deployed HTML');
 for(const token of ['data-rc1940-files','data-rc1940-analyze','function ensureUpload()','editor.importAnalysis(result.analysis)']){
  assert.ok(runtime.includes(token),label+': deployed document-upload asset misses '+token);
 }
 assert.ok(!/^\s*<!doctype html/i.test(runtime),label+': expected JavaScript, received HTML fallback');
}

export async function verifyDocumentUploadLive(env,sha,{fetchImpl=fetch,attempts=4}={}){
 assert.ok(Object.hasOwn(HOSTS,env),'RC1943: environment must be testservice or production');
 assert.match(sha,/^[0-9a-f]{40}$/i,'RC1943: exact release SHA required');
 const base=HOSTS[env];
 let lastError;
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const opts={redirect:'follow',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)};
   const root=await fetchImpl(base+'/?rc1943='+sha+'-'+attempt,opts);
   assert.equal(root.status,200,env+': root document HTTP '+root.status);
   const asset=await fetchImpl(base+'/assets/rc1940-documents-workspace.js?v=1940&rc1943='+sha+'-'+attempt,opts);
   assert.equal(asset.status,200,env+': document upload asset HTTP '+asset.status);
   assertDocumentUploadAssets(await root.text(),await asset.text(),env);
   return {environment:env,sha,verified:true};
  }catch(error){lastError=error;if(attempt<attempts)await new Promise(resolve=>setTimeout(resolve,1500))}
 }
 throw new Error('RC1943 '+env+' deployment upload proof failed: '+String(lastError?.message||lastError));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await verifyDocumentUploadLive(process.argv[2],process.argv[3]);
 console.log('RC1943 document upload live asset verified '+result.environment+' @ '+result.sha);
}
