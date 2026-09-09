import fs from 'node:fs';
import path from 'node:path';

const file=path.join(process.cwd(),'assets/rc1018-mail-language-standard.js');
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
console.log('RC1018 Lieferavis-Wortlaut strikt von Sendungsdetails getrennt.');
