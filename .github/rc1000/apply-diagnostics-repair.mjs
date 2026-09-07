import fs from 'node:fs';

const htmlFiles=['index.html','TESTVERSION.html'];
const guardTag='<script defer src="assets/rc1000-diagnostics-guard.js?v=RC1000"></script>';

function replaceOnce(text,oldValue,newValue,label){
  const count=text.split(oldValue).length-1;
  if(count!==1) throw new Error(`${label}: Anker nicht eindeutig (${count})`);
  return text.replace(oldValue,newValue);
}

for(const file of htmlFiles){
  let s=fs.readFileSync(file,'utf8');
  const oldRegistered="if(sh.pickupQrRegistered&&!force){patchCopies(sh,{pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:''});return Promise.resolve(true)}";
  const newRegistered="if(sh.pickupQrRegistered&&!force){if(!/^[a-f0-9]{48}$/i.test(token)){patchCopies(sh,{pickupQrRegistered:false,pickupQrRegisteredAt:'',pickupToken:'',pickupQrToken:'',pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:''});return register(sh,true)}return api('pickup-status?token='+encodeURIComponent(token)+'&_='+Date.now(),{method:'GET'}).then(function(data){applyStatus(sh,data,token);patchCopies(sh,{pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:'',pickupQrServerMismatch:false});return true}).catch(function(e){var gone=Number(e&&e.status)===410||Number(e&&e.statusCode)===410||/(?:ACCESS_(?:INVALID|NOT_FOUND|REVOKED|EXPIRED|USED)|\\b410\\b)/i.test(String(e&&e.code||'')+' '+String(e&&e.message||''));if(gone){patchCopies(sh,{pickupQrRegistered:false,pickupQrRegisteredAt:'',pickupToken:'',pickupQrToken:'',pickupQrActivating:false,pickupQrActivationStartedAt:'',pickupQrError:'',pickupQrServerMismatch:true});return register(sh,true)}throw e})}";
  if(!s.includes(newRegistered)) s=replaceOnce(s,oldRegistered,newRegistered,`${file} Pickup-Recovery`);

  if(!s.includes(guardTag)){
    const title='<title>ExportHUB Online</title>';
    s=replaceOnce(s,title,title+'\n'+guardTag,`${file} Diagnose-Guard`);
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
