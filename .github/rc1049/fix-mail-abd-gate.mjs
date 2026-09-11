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

  // Kleine historische Release-Fixtures besitzen keinen echten Mailbereich.
  if(!hadMailArea&&!html.includes(OLD_WARNING))return false;

  // ABD bleibt ein Versand-/Abholstatus, darf die Anmeldung per Mail aber nicht mehr blockieren.
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

function injectAdminMigration(rel){
  const target=path.join(ROOT,rel);
  if(!fs.existsSync(target))return false;
  let html=fs.readFileSync(target,'utf8');
  const id='exporthub-rc1061-document-migration-admin';
  const tag='<script id="'+id+'" defer src="/assets/rc1061-document-migration-admin.js?v=1061"></script>';
  const existing=new RegExp('<script\\b(?=[^>]*\\bid=["\\\']'+id+'["\\\'])[^>]*>\\s*<\\/script>','i');
  if(existing.test(html)){
    const next=html.replace(existing,tag);
    if(next!==html)fs.writeFileSync(target,next,'utf8');
    return next!==html;
  }
  const close=html.search(/<\/head\s*>/i);
  if(close<0)throw new Error(rel+': </head> für RC1061 Admin-Migration fehlt.');
  html=html.slice(0,close)+tag+'\n'+html.slice(close);
  fs.writeFileSync(target,html,'utf8');
  return true;
}

let changed=0;
for(const page of PAGES)if(patchPage(page))changed++;
let migrationInjected=0;
for(const page of ['index.html','TESTVERSION.html'])if(injectAdminMigration(page))migrationInjected++;
console.log('RC1049: ABD ist im Mailbereich nur noch Hinweis; Mailversand bleibt bei fehlendem ABD möglich. Geänderte Seiten: '+changed+'.');
console.log('RC1061: Admin-Dokumentmigration in Produktion/TESTSERVICE eingebunden. Geänderte Seiten: '+migrationInjected+'.');
