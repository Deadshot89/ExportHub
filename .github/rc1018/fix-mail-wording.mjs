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
function injectRc1027(rel){
  const target=path.join(ROOT,rel);
  if(!fs.existsSync(target))return false;
  let html=fs.readFileSync(target,'utf8');
  const existing=/<script\b(?=[^>]*\bid=["']exporthub-rc1027-lieferavis-immediate["'])[^>]*>\s*<\/script>/i;
  if(existing.test(html)){
    const next=html.replace(existing,RC1027_TAG);
    if(next===html)return false;
    fs.writeFileSync(target,next,'utf8');
    return true;
  }
  const close=html.search(/<\/head\s*>/i);
  if(close<0)throw new Error(rel+': </head> für RC1027 Lieferavis-Layer fehlt.');
  html=html.slice(0,close)+RC1027_TAG+'\n'+html.slice(close);
  fs.writeFileSync(target,html,'utf8');
  return true;
}
for(const page of ['index.html','TESTVERSION.html','demo.html'])injectRc1027(page);
console.log('RC1033 Lieferavis: Fast-Path und frischer Cache-Key für Produktion, TESTSERVICE und Demo aktiviert.');
