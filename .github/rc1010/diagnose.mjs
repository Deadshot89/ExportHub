import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];
const needles=[
  'function palletHtml',
  'rc524Pallet',
  'palletAccount.push',
  'Referenz',
  'reference',
  'availableModules()',
  'widgetAllowed(',
  'quick-grid',
  'Keine Berechtigung',
  'function rightFor',
  'function patchNav'
];

for(const file of files){
  const src=fs.readFileSync(file,'utf8');
  console.log(`\n=== ${file} ===`);
  for(const needle of needles){
    let from=0,count=0;
    while(count<12){
      const i=src.indexOf(needle,from);
      if(i<0)break;
      count++;
      const a=Math.max(0,i-800),b=Math.min(src.length,i+1800);
      console.log(`\n--- ${needle} #${count} @${i} ---\n${src.slice(a,b).replace(/\n/g,'\\n')}`);
      from=i+needle.length;
    }
    if(!count)console.log(`\n--- ${needle}: 0 Treffer ---`);
  }
}
