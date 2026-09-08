import fs from 'node:fs';
const files=['index.html','TESTVERSION.html'];
const needles=[
  "window.rc542AddPalletBooking=function()",
  'rc542PalRef',
  "level==='none'",
  'visible:false,read:false,edit:false,admin:false',
  '.hidden=!allow',
  "style.display=allow?'':'none'",
  'function availableModules()',
  'filter(widgetAllowed)',
  'function widgetAllowed',
  'function canOpen',
  'Sicherheitsverantwortlich',
  'company_admin'
];
for(const file of files){
  const src=fs.readFileSync(file,'utf8');
  console.log(`\n=== ${file} ===`);
  for(const needle of needles){
    let from=0,count=0;
    while(count<3){
      const i=src.indexOf(needle,from);
      if(i<0)break;
      count++;
      const snippet=src.slice(Math.max(0,i-420),Math.min(src.length,i+1050)).replace(/\n/g,'\\n');
      console.log(`\n--- ${needle} #${count} @${i} ---\n${snippet}`);
      from=i+needle.length;
    }
    if(!count)console.log(`\n--- ${needle}: 0 Treffer ---`);
  }
}
