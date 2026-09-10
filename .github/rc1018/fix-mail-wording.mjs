import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const file=path.join(ROOT,'assets/rc1018-mail-language-standard.js');
let source=fs.readFileSync(file,'utf8');
const replacements=[
  ['A separate confirmation of the shipment details by email is not required.','A separate confirmation by email is not required.'],
  ['The shipment details are therefore not repeated in this email.','The information is therefore not repeated in this email.'],
  ['Eine zusätzliche Bestätigung der Sendungsdetails per E-Mail ist nicht erforderlich.','Eine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.'],
  ['Die Sendungsdetails werden deshalb in dieser E-Mail nicht zusätzlich wiederholt.','Die Informationen werden deshalb in dieser E-Mail nicht zusätzlich wiederholt.']
];
for(const [before,after] of replacements){
  if(source.includes(before))source=source.replaceAll(before,after);
}
fs.writeFileSync(file,source);

const RC1027_ID='exporthub-rc1027-lieferavis-immediate';
const RC1027_TAG='<script id="'+RC1027_ID+'" defer src="/assets/rc1027-lieferavis-immediate.js?v=1033"></script>';
const RC1037_ID='exporthub-rc1037-lieferavis-timing-diagnostics';
const RC1037_TAG='<script id="'+RC1037_ID+'" defer src="/assets/rc1037-lieferavis-timing-diagnostics.js?v=1037"></script>';
function injectScript(rel,id,tag){
  const target=path.join(ROOT,rel);
  if(!fs.existsSync(target))return false;
  let html=fs.readFileSync(target,'utf8');
  const existing=new RegExp('<script\\b(?=[^>]*\\bid=["\\\']'+id+'["\\\'])[^>]*>\\s*<\\/script>','i');
  if(existing.test(html)){
    const next=html.replace(existing,tag);
    if(next===html)return false;
    fs.writeFileSync(target,next,'utf8');
    return true;
  }
  const close=html.search(/<\/head\s*>/i);
  if(close<0)throw new Error(rel+': </head> für ExportHUB-Laufzeitlayer fehlt.');
  html=html.slice(0,close)+tag+'\n'+html.slice(close);
  fs.writeFileSync(target,html,'utf8');
  return true;
}
for(const page of ['index.html','TESTVERSION.html','demo.html']){
  injectScript(page,RC1027_ID,RC1027_TAG);
  injectScript(page,RC1037_ID,RC1037_TAG);
}
console.log('RC1037 Lieferavis: Fast-Path plus Server-Timing-Diagnose mit frischen Cache-Keys für Produktion, TESTSERVICE und Demo aktiviert.');
