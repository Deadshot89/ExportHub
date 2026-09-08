import fs from 'node:fs';

const htmlFiles=['index.html','TESTVERSION.html'];
const oldLink="function link(sh){var t=token(sh);return t?location.origin+'/customer-avis?token='+encodeURIComponent(t):''}";
const newLink="function link(sh){var raw=q(sh&&(sh.customerAvisPublicUrl||sh.avisPublicUrl)),env=/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production';if(raw){try{return new URL(raw,location.origin).href}catch(_){}}var t=token(sh);return t?location.origin+'/customer-avis.html?token='+encodeURIComponent(t)+'&environment='+encodeURIComponent(env):''}";

function replaceOnce(source,pattern,replacement,label,file){
  const matches=source.match(pattern)||[];
  if(matches.length!==1)throw new Error(`${file}: ${label} nicht eindeutig (${matches.length})`);
  return source.replace(pattern,replacement);
}

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

  if(!/customerAvisPublicUrl:q\(data\.url\)/.test(toggle)){
    toggle=replaceOnce(
      toggle,
      /customerAvisToken:q\(data\.token\),avisToken:q\(data\.token\),/g,
      "customerAvisToken:q(data.token),avisToken:q(data.token),customerAvisPublicUrl:q(data.url),avisPublicUrl:q(data.url),",
      'Server-URL-Anker im Avis-toggle',
      file
    );
  }

  if(!/customerAvisPublicUrl:'',avisPublicUrl:''/.test(toggle)){
    toggle=replaceOnce(
      toggle,
      /customerAvisToken:'',avisToken:'',/g,
      "customerAvisToken:'',avisToken:'',customerAvisPublicUrl:'',avisPublicUrl:'',",
      'Disable-Anker im Avis-toggle',
      file
    );
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
