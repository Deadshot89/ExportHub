import fs from 'node:fs';

const htmlFiles=['index.html','TESTVERSION.html'];
const oldLink="function link(sh){var t=token(sh);return t?location.origin+'/customer-avis?token='+encodeURIComponent(t):''}";
const newLink="function link(sh){var raw=q(sh&&(sh.customerAvisPublicUrl||sh.avisPublicUrl)),env=/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production';if(raw){try{return new URL(raw,location.origin).href}catch(_){}}var t=token(sh);return t?location.origin+'/customer-avis.html?token='+encodeURIComponent(t)+'&environment='+encodeURIComponent(env):''}";

function patchHtml(file){
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes(newLink)){
    const count=html.split(oldLink).length-1;
    if(count!==1)throw new Error(`${file}: link(sh)-Anker nicht eindeutig (${count})`);
    html=html.replace(oldLink,newLink);
  }

  const toggleStart=html.indexOf('async function toggle(on)');
  const toggleEnd=html.indexOf('async function autoDisableIfDue()',toggleStart);
  if(toggleStart<0||toggleEnd<=toggleStart)throw new Error(`${file}: Avis-toggle nicht gefunden`);
  let toggle=html.slice(toggleStart,toggleEnd);

  const issuedOld="customerAvisToken:q(data.token),avisToken:q(data.token),customerAvisSecurityVersion:995";
  const issuedNew="customerAvisToken:q(data.token),avisToken:q(data.token),customerAvisPublicUrl:q(data.url),avisPublicUrl:q(data.url),customerAvisSecurityVersion:995";
  if(!toggle.includes(issuedNew)){
    const count=toggle.split(issuedOld).length-1;
    if(count!==1)throw new Error(`${file}: Server-URL-Anker im Avis-toggle nicht eindeutig (${count})`);
    toggle=toggle.replace(issuedOld,issuedNew);
  }

  const disabledOld="customerAvisToken:'',avisToken:'',customerAvisSecurityVersion:0";
  const disabledNew="customerAvisToken:'',avisToken:'',customerAvisPublicUrl:'',avisPublicUrl:'',customerAvisSecurityVersion:0";
  if(!toggle.includes(disabledNew)){
    const count=toggle.split(disabledOld).length-1;
    if(count!==1)throw new Error(`${file}: Disable-Anker im Avis-toggle nicht eindeutig (${count})`);
    toggle=toggle.replace(disabledOld,disabledNew);
  }

  html=html.slice(0,toggleStart)+toggle+html.slice(toggleEnd);
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

console.log('RC1007 Lieferavis-Link Fix angewendet.');
