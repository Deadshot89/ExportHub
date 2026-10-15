import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const rel='e2e/helpers/exporthub-browser.mjs';
const file=path.join(ROOT,rel);
let source=fs.readFileSync(file,'utf8');

const startAnchor="  if(process.env.EXPORTHUB_E2E_LIVE==='1'){";
const endAnchor='\n  await pause(220);';
const replacement=`  if(process.env.EXPORTHUB_E2E_LIVE==='1'){
    await page.waitForFunction(()=>{
      const recovery=window.ExportHUBRC1067StartupRecovery;
      if(recovery&&typeof recovery.loading==='function'){
        try{if(recovery.loading())return false}catch(_){}
      }
      const body=document.body,content=document.getElementById('content');
      const view=String(body&&body.getAttribute&&body.getAttribute('data-exporthub-view')||'').trim();
      const text=String(content&&content.innerText||'').trim();
      const interactive=typeof window.setView==='function'||!!document.querySelector('[data-view],[data-target],[data-nav]');
      const startupLoading=/ExportHUB\\s+wird\\s+geladen|Teamdaten\\s+werden\\s+wiederhergestellt|Gespeicherte\\s+Sitzung\\s+und\\s+Teamdaten/i.test(text)||
        /ExportHUB\\s+wird\\s+vorbereitet|Azure-Teamdaten\\s+werden\\s+geladen/i.test(text);
      return !!content&&text.length>10&&!!view&&interactive&&!startupLoading;
    },null,{timeout:25_000});
  }`;

if(!source.includes("return !!content&&text.length>10&&!!view&&interactive&&!startupLoading;")){
  const start=source.indexOf(startAnchor);
  const end=start<0?-1:source.indexOf(endAnchor,start);
  if(start<0||end<0)throw new Error('RC1541 Live-Readiness-Block nicht eindeutig gefunden');
  source=source.slice(0,start)+replacement+source.slice(end);
  fs.writeFileSync(file,source,'utf8');
}

const verified=fs.readFileSync(file,'utf8');
for(const required of [
  "const body=document.body,content=document.getElementById('content');",
  "body.getAttribute('data-exporthub-view')",
  "typeof window.setView==='function'||!!document.querySelector('[data-view],[data-target],[data-nav]')",
  "return !!content&&text.length>10&&!!view&&interactive&&!startupLoading;"
]){
  if(!verified.includes(required))throw new Error('RC1541 Live-Readiness-Vertrag fehlt: '+required);
}
if(!verified.includes('ExportHUBRC1067StartupRecovery')||!verified.includes('.loading()'))throw new Error('RC1541 Startup-Recovery-Vertrag fehlt');
console.log('RC1541 live readiness hardened: ready marker requires usable app shell and completed startup');
