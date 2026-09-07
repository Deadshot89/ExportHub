import fs from 'node:fs';

const htmlFiles=['index.html','TESTVERSION.html'];
const marker='exporthub-rc1000-diagnostics-guard';

function replaceOnce(text,oldValue,newValue,label){
  const count=text.split(oldValue).length-1;
  if(count!==1) throw new Error(`${label}: Anker nicht eindeutig (${count})`);
  return text.replace(oldValue,newValue);
}

for(const file of htmlFiles){
  let s=fs.readFileSync(file,'utf8');
  const oldRegistered="if(sh.pickupQrRegistered&&!force){patchCopies(sh,{pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:''});return Promise.resolve(true)}";
  const newRegistered="if(sh.pickupQrRegistered&&!force){if(!/^[a-f0-9]{48}$/i.test(token)){patchCopies(sh,{pickupQrRegistered:false,pickupQrRegisteredAt:'',pickupToken:'',pickupQrToken:'',pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:''});return register(sh,true)}return api('pickup-status?token='+encodeURIComponent(token)+'&_='+Date.now(),{method:'GET'}).then(function(data){applyStatus(sh,data,token);patchCopies(sh,{pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:'',pickupQrServerMismatch:false});return true}).catch(function(e){if(Number(e&&e.status)===410){patchCopies(sh,{pickupQrRegistered:false,pickupQrRegisteredAt:'',pickupToken:'',pickupQrToken:'',pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:'',pickupQrServerMismatch:true});return register(sh,true)}throw e})}";
  if(!s.includes(newRegistered)) s=replaceOnce(s,oldRegistered,newRegistered,`${file} Pickup-Recovery`);

  if(!s.includes(`id=\"${marker}\"`)){
    const guard=`\n<script id="${marker}">\n(function(){\n'use strict';\nif(window.__EXPORTHUB_RC1000_DIAGNOSTICS_GUARD__)return;window.__EXPORTHUB_RC1000_DIAGNOSTICS_GUARD__=true;\nvar baseFetch=window.fetch.bind(window),inflight=new Map(),negative=new Map(),metaCache=null;\nfunction keyOf(input,init){var url=typeof input==='string'?input:(input&&input.url)||'',method=String(init&&init.method||input&&input.method||'GET').toUpperCase(),body=typeof(init&&init.body)==='string'?init.body:'';return method+' '+url+' '+body}\nfunction cloneResponse(r){return r&&typeof r.clone==='function'?r.clone():r}\nwindow.fetch=function(input,init){var url=typeof input==='string'?input:(input&&input.url)||'',method=String(init&&init.method||input&&input.method||'GET').toUpperCase();\n  if(/\\/api\\/pickup-status(?:\\?|$)/.test(url)){var m=String(url).match(/[?&]token=([^&]+)/),token='';try{token=m?decodeURIComponent(m[1]):''}catch(_){token=m?m[1]:''}if(!/^[a-f0-9]{48}$/i.test(token))return Promise.resolve(new Response(JSON.stringify({ok:false,code:'ACCESS_INVALID',message:'Dieser öffentliche Link ist ungültig.'}),{status:410,headers:{'Content-Type':'application/json'}}));var n=negative.get(token);if(n&&n>Date.now())return Promise.resolve(new Response(JSON.stringify({ok:false,code:'ACCESS_NOT_FOUND',message:'Dieser öffentliche Link ist ungültig oder nicht mehr aktiv.'}),{status:410,headers:{'Content-Type':'application/json'}}));var k='pickup:'+token;if(inflight.has(k))return inflight.get(k).then(cloneResponse);var p=baseFetch(input,init).then(function(r){if(r.status===410)negative.set(token,Date.now()+60000);return r}).finally(function(){inflight.delete(k)});inflight.set(k,p);return p.then(cloneResponse)}\n  if(/\\/api\\/exporthub-state\\?mode=meta(?:&|$)/.test(url)){var mk='meta';if(metaCache&&metaCache.until>Date.now())return Promise.resolve(metaCache.response.clone());if(inflight.has(mk))return inflight.get(mk).then(cloneResponse);var mp=baseFetch(input,init).then(function(r){if(r.ok)metaCache={until:Date.now()+2000,response:r.clone()};return r}).finally(function(){inflight.delete(mk)});inflight.set(mk,mp);return mp.then(cloneResponse)}\n  if(method==='POST'&&/\\/api\\/exporthub-state\\?mode=save(?:&|$)/.test(url)){var sk=keyOf(input,init);if(inflight.has(sk))return inflight.get(sk).then(cloneResponse);var sp=baseFetch(input,init).finally(function(){setTimeout(function(){inflight.delete(sk)},500)});inflight.set(sk,sp);return sp.then(cloneResponse)}\n  return baseFetch(input,init)};\nwindow.ExportHUBRC1000DiagnosticsGuard=Object.freeze({version:'RC1000',pickupNegativeCacheMs:60000,metaCacheMs:2000,exactSaveDedupe:true});\n})();\n</script>\n`;
    s=replaceOnce(s,'</body>',guard+'</body>',`${file} Guard-Injektion`);
  }
  fs.writeFileSync(file,s,'utf8');
}

{
  const file='api/shared/loader-pin-store.js';
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes('function retryDelay(attempt)')){
    s=replaceOnce(s,"const MAX_RETRIES = 6;","const MAX_RETRIES = 6;\nfunction retryDelay(attempt) { return new Promise(resolve => setTimeout(resolve, Math.min(480, 35 * Math.pow(2, Math.max(0, attempt))))); }",'PIN Retry-Helper');
  }
  const oldCatch="} catch (e) { if (e && e.statusCode === 412 && attempt < MAX_RETRIES - 1) continue; throw e; }";
  const newCatch="} catch (e) { if (e && e.statusCode === 412 && attempt < MAX_RETRIES - 1) { await retryDelay(attempt); continue; } throw e; }";
  if(!s.includes(newCatch)) s=replaceOnce(s,oldCatch,newCatch,'PIN ETag-Retry');
  fs.writeFileSync(file,s,'utf8');
}

{
  const file='api/exporthub-state/index.js';
  let s=fs.readFileSync(file,'utf8');
  const old="}catch(e){if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1)continue;if(e&&e.statusCode>=500)throw error('STORAGE_UNREACHABLE','Azure Storage konnte den Teamstand nicht speichern: '+(e.message||'Serverfehler'),503);throw e}";
  const neu="}catch(e){if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1){await new Promise(resolve=>setTimeout(resolve,Math.min(500,40*Math.pow(2,attempt))));continue}if(e&&e.statusCode>=500)throw error('STORAGE_UNREACHABLE','Azure Storage konnte den Teamstand nicht speichern: '+(e.message||'Serverfehler'),503);throw e}";
  if(!s.includes(neu)) s=replaceOnce(s,old,neu,'State ETag-Retry');
  fs.writeFileSync(file,s,'utf8');
}

console.log('RC1000 Diagnose-Reparatur angewendet.');
