'use strict';
const fs=require('fs');

function read(path){return fs.readFileSync(path,'utf8')}
function write(path,content){fs.writeFileSync(path,content)}
function replaceOnce(source,before,after,label){
 const first=source.indexOf(before);
 if(first<0)throw new Error('RC1031 Patchanker fehlt: '+label);
 if(source.indexOf(before,first+before.length)>=0)throw new Error('RC1031 Patchanker nicht eindeutig: '+label);
 return source.slice(0,first)+after+source.slice(first+before.length);
}

{
 const path='api/shared/public-access-store.js';let s=read(path);
 s=replaceOnce(s,"const SESSION_MS = 30 * 60 * 1000;\n","const SESSION_MS = 30 * 60 * 1000;\nlet containerReadyPromise=null;\n",'public access container cache variable');
 s=replaceOnce(s,
  "async function container(){ const cs=connectionString(); if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503); const c=BlobServiceClient.fromConnectionString(cs).getContainerClient(CONTAINER); await c.createIfNotExists(); return c; }",
  "async function container(){ if(containerReadyPromise)return containerReadyPromise; const cs=connectionString(); if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503); containerReadyPromise=(async()=>{const c=BlobServiceClient.fromConnectionString(cs).getContainerClient(CONTAINER);await c.createIfNotExists();return c})().catch(e=>{containerReadyPromise=null;throw e}); return containerReadyPromise; }",
  'public access container');
 s=replaceOnce(s,
  "  const current=await readJson(idx,null); try{await writeJson(idx,index,current.etag)}catch(e){if(e&&e.statusCode===412){const retry=await readJson(idx,null);await writeJson(idx,index,retry.etag)}else throw e}",
  "  try{await writeJson(idx,index,old.etag)}catch(e){if(e&&e.statusCode===412){const retry=await readJson(idx,null);await writeJson(idx,index,retry.etag)}else throw e}",
  'public access duplicate subject read');
 write(path,s);
}

{
 const path='api/customer-avis/index.js';let s=read(path);
 s=replaceOnce(s,
  "async function setAvisFlags(blob,subjectId,reference,enabled,actor){for(let i=0;i<MAX_RETRIES;i++){const d=await readTeam(blob),",
  "async function setAvisFlags(blob,subjectId,reference,enabled,actor,firstRead){for(let i=0;i<MAX_RETRIES;i++){const d=i===0&&firstRead?firstRead:await readTeam(blob),",
  'customer avis reuse team read');
 s=replaceOnce(s,
  "   await setAvisFlags(blob,actualSubject,actualRef,true,internal.user.name||internal.user.user);const issued=await access.issue(req,'avis',{subjectId:actualSubject,shipmentId:actualSubject,reference:actualRef,actor:internal.user.name||internal.user.user||'ExportHUB'},null,payload);context.res=json(200,{ok:true,issued:true,token:issued.token,shipmentId:actualSubject,reference:actualRef,expiresAt:issued.expiresAt,url:'/customer-avis.html?token='+encodeURIComponent(issued.token)+'&environment='+encodeURIComponent(env),oneTime:false,version:'RC1013'});return",
  "   const actor=internal.user.name||internal.user.user||'ExportHUB';const [,issued]=await Promise.all([setAvisFlags(blob,actualSubject,actualRef,true,actor,d),access.issue(req,'avis',{subjectId:actualSubject,shipmentId:actualSubject,reference:actualRef,actor},null,payload)]);context.res=json(200,{ok:true,issued:true,token:issued.token,shipmentId:actualSubject,reference:actualRef,expiresAt:issued.expiresAt,url:'/customer-avis.html?token='+encodeURIComponent(issued.token)+'&environment='+encodeURIComponent(env),oneTime:false,version:'RC1031'});return",
  'customer avis parallel issue');
 write(path,s);
}

{
 const path='assets/rc1027-lieferavis-immediate.js';let s=read(path);
 s=replaceOnce(s,"var previous=null,wrapper=null,earlyPending=null,visibleSyncing=false;","var previous=null,wrapper=null,earlyPending=null,visibleSyncing=false,avisLinkCache=Object.create(null);",'avis cache variable');
 s=replaceOnce(s,
  "function avisUrl(sh){try{return q(previous&&typeof previous.link==='function'&&previous.link(sh))}catch(_){return''}}",
  "function avisCacheKey(sh){var ref=explicitReference(sh);if(!ref)return'';var env=typeof location!=='undefined'&&/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production';return'exporthub:avis-url:'+env+':'+ref}\nfunction cachedAvisUrl(sh){var key=avisCacheKey(sh);if(!key)return'';if(avisLinkCache[key])return avisLinkCache[key];try{if(typeof sessionStorage!=='undefined'){var stored=q(sessionStorage.getItem(key));if(stored){avisLinkCache[key]=stored;return stored}}}catch(_){}return''}\nfunction rememberAvisUrl(sh,url){url=q(url);var key=avisCacheKey(sh);if(!key||!url)return url;if(!/customer-avis(?:\\.html)?[?/#]/i.test(url))return url;avisLinkCache[key]=url;try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem(key,url)}catch(_){}return url}\nfunction forgetAvisUrl(sh){var key=avisCacheKey(sh);if(!key)return false;delete avisLinkCache[key];try{if(typeof sessionStorage!=='undefined')sessionStorage.removeItem(key)}catch(_){}return true}\nfunction avisUrl(sh){if(manualDisabled(sh)){forgetAvisUrl(sh);return''}var live='';try{live=q(previous&&typeof previous.link==='function'&&previous.link(sh))}catch(_){}return live?rememberAvisUrl(sh,live):cachedAvisUrl(sh)}",
  'avis local link cache');
 s=replaceOnce(s,
  "wrapper=Object.freeze(Object.assign({},current,{version:'RC1027',injectMailBody:injectMailBody,autoEnable:ensureCustomerAvis,__rc1027:true,__base1027:current}));",
  "wrapper=Object.freeze(Object.assign({},current,{version:'RC1031',link:avisUrl,injectMailBody:injectMailBody,autoEnable:ensureCustomerAvis,__rc1027:true,__rc1031:true,__base1027:current}));",
  'avis wrapper link');
 s=replaceOnce(s,
  "var api=Object.freeze({version:'RC1027',ensureCustomerAvis:ensureCustomerAvis,composeAvis:function(opt){",
  "var api=Object.freeze({version:'RC1031',ensureCustomerAvis:ensureCustomerAvis,composeAvis:function(opt){",
  'avis api version');
 write(path,s);
}

{
 const path='.github/rc1018/fix-mail-wording.mjs';let s=read(path);
 s=replaceOnce(s,'/assets/rc1027-lieferavis-immediate.js?v=1027','/assets/rc1027-lieferavis-immediate.js?v=1031','avis cache bust');
 write(path,s);
}

{
 const path='test/rc1027-lieferavis-release.test.mjs';let s=read(path);
 const matches=(s.match(/v=1027/g)||[]).length;
 if(matches!==1)throw new Error('RC1031 historischer Cache-Key-Anker nicht eindeutig: '+matches);
 s=s.replace('v=1027','v=1031');
 write(path,s);
}

console.log('RC1031 Diagnosefixes angewendet.');
