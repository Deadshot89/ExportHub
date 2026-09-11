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

  // ABD bleibt ein Versand-/Abholstatus, darf die Anmeldung per Mail aber nicht mehr blockieren.
  html=html.replaceAll("if(!m.abdOk)reason.push('ABD noch nicht abgeschlossen');",'');
  html=html.replaceAll('!opened||!m.abdOk||!m.to||!m.templateOk','!opened||!m.to||!m.templateOk');
  html=html.replaceAll('!m.abdOk||!m.to||!m.templateOk','!m.to||!m.templateOk');
  html=html.replaceAll(OLD_WARNING,NEW_WARNING);

  if(html.includes(OLD_WARNING))throw new Error(rel+': alte ABD-Mail-Sperrmeldung ist noch vorhanden.');
  const start=html.indexOf('function mailAreaHtml(){');
  const end=start>=0?html.indexOf('function refreshMailAreaFields(',start):-1;
  if(start<0||end<=start)throw new Error(rel+': Mailbereich konnte nicht eindeutig gefunden werden.');
  const mailArea=html.slice(start,end);
  if(/!m\.abdOk\s*\|\|\s*!m\.to/.test(mailArea)||/!opened\s*\|\|\s*!m\.abdOk/.test(mailArea))throw new Error(rel+': ABD sperrt den Mailbereich weiterhin.');
  if(!mailArea.includes(NEW_WARNING))throw new Error(rel+': nicht blockierender ABD-Hinweis fehlt.');

  if(html!==before)fs.writeFileSync(target,html,'utf8');
  return html!==before;
}

let changed=0;
for(const page of PAGES)if(patchPage(page))changed++;
console.log('RC1049: ABD ist im Mailbereich nur noch Hinweis; Mailversand bleibt bei fehlendem ABD möglich. Geänderte Seiten: '+changed+'.');
