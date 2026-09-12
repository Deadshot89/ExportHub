import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const PAGES=['index.html','TESTVERSION.html','demo.html'];
const OLD_WARNING='Mail gesperrt: ABD noch nicht abgeschlossen.';
const NEW_WARNING='ABD noch nicht vorhanden. Die Mail kann mit Lieferavis versendet werden.';

function patchPage(rel){
  const target=path.join(ROOT,rel);
  if(!fs.existsSync(target))return false;
  let html=fs.readFileSync(target,'utf8');
  const before=html;
  const hadMailArea=html.includes('function mailAreaHtml(){');
  if(!hadMailArea&&!html.includes(OLD_WARNING))return false;
  html=html.replaceAll("if(!m.abdOk)reason.push('ABD noch nicht abgeschlossen');",'');
  html=html.replaceAll('!opened||!m.abdOk||!m.to||!m.templateOk','!opened||!m.to||!m.templateOk');
  html=html.replaceAll('!m.abdOk||!m.to||!m.templateOk','!m.to||!m.templateOk');
  html=html.replaceAll(OLD_WARNING,NEW_WARNING);
  if(html.includes(OLD_WARNING))throw new Error(rel+': alte ABD-Mail-Sperrmeldung ist noch vorhanden.');
  if(hadMailArea){
    const start=html.indexOf('function mailAreaHtml(){');
    const end=start>=0?html.indexOf('function refreshMailAreaFields(',start):-1;
    if(start<0||end<=start)throw new Error(rel+': Mailbereich konnte nicht eindeutig gefunden werden.');
    const mailArea=html.slice(start,end);
    if(/!m\.abdOk\s*\|\|\s*!m\.to/.test(mailArea)||/!opened\s*\|\|\s*!m\.abdOk/.test(mailArea))throw new Error(rel+': ABD sperrt den Mailbereich weiterhin.');
    if(!mailArea.includes(NEW_WARNING))throw new Error(rel+': nicht blockierender ABD-Hinweis fehlt.');
  }
  if(html!==before)fs.writeFileSync(target,html,'utf8');
  return html!==before;
}

function patchFinalBuild(){
  const target=path.join(ROOT,'.github/rc1048/build-three-env.mjs');
  if(!fs.existsSync(target))return false;
  let source=fs.readFileSync(target,'utf8');
  if(source.includes('exporthub-rc1061-document-migration-admin')&&source.includes('exporthub-rc1063-abd-blob-viewer-compat'))return false;
  const anchor="for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);";
  if(!source.includes(anchor))throw new Error('RC1061: finaler RC1048-Buildanker fehlt.');
  const injection=`\nfor(const file of ['index.html','TESTVERSION.html']){\n  const target=path.join(OUT,file);\n  let html=fs.readFileSync(target,'utf8');\n  const id='exporthub-rc1061-document-migration-admin';\n  const tag='<script id="'+id+'" defer src="/assets/rc1061-document-migration-admin.js?v=1066"></script>';\n  const close=html.search(/<\\/head\\s*>/i);\n  if(close<0)throw new Error(file+': </head> für RC1061 Admin-Migration fehlt');\n  if(!html.includes(id)){html=html.slice(0,close)+tag+'\\n'+html.slice(close)}\n  const compatId='exporthub-rc1063-abd-blob-viewer-compat';\n  const compatTag='<script id="'+compatId+'" defer src="/assets/rc1063-abd-blob-viewer-compat.js?v=1063"></script>';\n  const compatClose=html.search(/<\\/head\\s*>/i);\n  if(compatClose<0)throw new Error(file+': </head> für RC1063 ABD-Blob-Kompatibilität fehlt');\n  if(!html.includes(compatId))html=html.slice(0,compatClose)+compatTag+'\\n'+html.slice(compatClose);\n  fs.writeFileSync(target,html,'utf8')\n}\n`;
  source=source.replace(anchor,anchor+injection);
  fs.writeFileSync(target,source,'utf8');
  return true;
}

let changed=0;
for(const page of PAGES)if(patchPage(page))changed++;
const finalBuildPatched=patchFinalBuild();
console.log('RC1049: ABD ist im Mailbereich nur noch Hinweis; Mailversand bleibt bei fehlendem ABD möglich. Geänderte Seiten: '+changed+'.');
console.log('RC1061: Admin-Dokumentmigration wird ausschließlich an der finalen RC1048-Build-Grenze für Produktion und TESTSERVICE eingebunden. Finaler Build gepatcht: '+finalBuildPatched+'.');
