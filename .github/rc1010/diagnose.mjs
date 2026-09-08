import fs from 'node:fs';
const files=['index.html','TESTVERSION.html'];
const needles=['Firmen-Admin','Firmen Admin','companyAdmin','company_admin','companyadmin','HSE','Sicherheitsverantwortlich','Rechtevorlage','rightsTemplate','roleTemplate','Vorlage'];
for(const file of files){
 const src=fs.readFileSync(file,'utf8');
 console.log(`\n=== ${file} ===`);
 for(const needle of needles){
  let from=0,count=0;
  while(count<12){const i=src.indexOf(needle,from);if(i<0)break;count++;console.log(`\n--- ${needle} #${count} @${i} ---\n${src.slice(Math.max(0,i-900),Math.min(src.length,i+2000)).replace(/\n/g,'\\n')}`);from=i+needle.length;}
  if(!count)console.log(`\n--- ${needle}: 0 Treffer ---`);
 }
}
