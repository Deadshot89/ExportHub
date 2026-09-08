import fs from 'node:fs';

const htmlFiles=['index.html','TESTVERSION.html'];
const moduleAnchor='if(window.__EXPORTHUB_CUSTOMER_AVIS_706__)return;';
const moduleEndAnchor='window.ExportHUBCustomerAvis705=api;';
const oldLink="function link(sh){var t=token(sh);return t?location.origin+'/customer-avis?token='+encodeURIComponent(t):''}";
const newLink="function link(sh){var raw=q(sh&&(sh.customerAvisPublicUrl||sh.avisPublicUrl)),env=/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production';if(raw){try{return new URL(raw,location.origin).href}catch(_){}}var t=token(sh);return t?location.origin+'/customer-avis.html?token='+encodeURIComponent(t)+'&environment='+encodeURIComponent(env):''}";
const oldEnabled="function enabled(sh){var a=avisSnapshot(sh);return !!(a.active&&a.token&&a.securityVersion>=SECURITY_VERSION&&a.enabledAt&&!pickupStamp(a.source||sh)&&!expired(a.source||sh))}";
const newEnabled="function enabled(sh){var a=avisSnapshot(sh);return !!(a.active&&a.securityVersion>=SECURITY_VERSION&&a.enabledAt&&!pickupStamp(a.source||sh)&&!expired(a.source||sh))}";

const avisController=`function render(){return false}\nfunction rc995AvisHeaders(){var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{},t=q(rt.authToken||'');if(!t)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':t,'X-ExportHUB-Session':t,'Authorization':'Bearer '+t,'X-ExportHUB-Environment':/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production'}}\nasync function rc995AvisAction(action,sh){var payload={action:action,shipmentId:id(sh),reference:ref(sh),environment:/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production'},r=await fetch('/api/customer-avis',{method:'POST',credentials:'same-origin',cache:'no-store',headers:rc995AvisHeaders(),body:JSON.stringify(payload)}),data=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(q(data.message)||('HTTP '+r.status));return data}\nasync function toggle(on){var sh=current();if(!sh)return false;if(on&&pickupStamp(sh)){alert('Der Lieferavis ist nach der Abholung geschlossen und kann nicht erneut aktiviert werden.');return false}if(on&&!ref(sh)){alert('Die Sendung benötigt zuerst eine Referenznummer.');return false}try{var data=await rc995AvisAction(on?'issue':'disable',sh),stamp=new Date().toISOString(),values=on?{customerAvisEnabled:true,avisEnabled:true,customerAvisToken:q(data.token),avisToken:q(data.token),customerAvisPublicUrl:q(data.url),avisPublicUrl:q(data.url),customerAvisSecurityVersion:995,avisSecurityVersion:995,customerAvisEnabledAt:stamp,avisEnabledAt:stamp,customerAvisExpiresAt:q(data.expiresAt),avisExpiresAt:q(data.expiresAt),customerAvisDisabledAt:'',avisDisabledAt:'',customerAvisResponseStatus:'offen',avisResponseStatus:'offen'}:{customerAvisEnabled:false,avisEnabled:false,customerAvisToken:'',avisToken:'',customerAvisPublicUrl:'',avisPublicUrl:'',customerAvisSecurityVersion:0,avisSecurityVersion:0,customerAvisDisabledAt:stamp,avisDisabledAt:stamp};patchCopies(sh,values);lastSig='';render();window.dispatchEvent(new CustomEvent('exporthub:customer-avis-updated',{detail:{reference:ref(sh),enabled:on,version:'RC1007'}}));try{if(window.ExportHUBMailStatus373&&typeof window.ExportHUBMailStatus373.patch==='function')window.ExportHUBMailStatus373.patch('Kunden-Avis RC1007 geändert')}catch(_){}schedule();return false}catch(e){alert('Kunden-Avis konnte nicht geändert werden.\\n\\n'+q(e&&e.message||e));return false}}\n`;

function replaceExactlyOnce(source,oldValue,newValue,label,file){
  if(source.includes(newValue))return source;
  const count=source.split(oldValue).length-1;
  if(count!==1)throw new Error(`${file}: ${label} nicht eindeutig (${count})`);
  return source.replace(oldValue,newValue);
}

function patchHtml(file){
  let html=fs.readFileSync(file,'utf8');
  const start=html.indexOf(moduleAnchor),end=html.indexOf(moduleEndAnchor,start);
  if(start<0||end<=start)throw new Error(`${file}: Kunden-Avis-Modul nicht eindeutig gefunden`);
  let avis=html.slice(start,end);

  avis=replaceExactlyOnce(avis,'SECURITY_VERSION=2','SECURITY_VERSION=995','Security-Version',file);
  avis=replaceExactlyOnce(avis,oldEnabled,newEnabled,'enabled(sh)',file);
  avis=replaceExactlyOnce(avis,oldLink,newLink,'link(sh)',file);

  const renderStart=avis.indexOf('function render(){return false}');
  const autoStart=avis.indexOf('async function autoDisableIfDue()',renderStart);
  if(renderStart<0||autoStart<=renderStart)throw new Error(`${file}: Avis-Controllerbereich nicht gefunden`);
  avis=avis.slice(0,renderStart)+avisController+avis.slice(autoStart);

  const oldApi='var api=Object.freeze({version:VERSION,securityVersion:SECURITY_VERSION,render:render,enabled:enabled,expired:expired,link:link,injectMailBody:injectMailBody,toggle:toggle,autoExpiresOn:autoExpiresOn});';
  const newApi='var api=Object.freeze({version:VERSION,securityVersion:SECURITY_VERSION,render:render,enabled:enabled,expired:expired,link:link,injectMailBody:injectMailBody,toggle:toggle,autoExpiresOn:autoExpiresOn});';
  if(!avis.includes(newApi))throw new Error(`${file}: Avis-API Export fehlt`);

  html=html.slice(0,start)+avis+html.slice(end);
  fs.writeFileSync(file,html,'utf8');
}

for(const file of htmlFiles)patchHtml(file);

const mergeFile='api/shared/merge.js';
let merge=fs.readFileSync(mergeFile,'utf8');
const oldKeys="const PUBLIC_ACCESS_SECRET_KEYS = ['customerAvisToken','avisToken','pickupToken','pickupQrToken','qrToken'];";
const newKeys="const PUBLIC_ACCESS_SECRET_KEYS = ['customerAvisToken','avisToken','customerAvisPublicUrl','avisPublicUrl','pickupToken','pickupQrToken','qrToken'];";
if(!merge.includes(newKeys)){
  const count=merge.split(oldKeys).length-1;
  if(count!==1)throw new Error(`merge.js: PUBLIC_ACCESS_SECRET_KEYS-Anker nicht eindeutig (${count})`);
  merge=merge.replace(oldKeys,newKeys);
  fs.writeFileSync(mergeFile,merge,'utf8');
}

console.log('RC1007 Lieferavis-Client auf serverseitig registrierte Links umgestellt.');
