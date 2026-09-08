import fs from 'node:fs';

for(const file of ['index.html','TESTVERSION.html']){
  const src=fs.readFileSync(file,'utf8');
  console.log(`\n=== ${file} SOP-INTEGRATIONSANKER ===`);
  for(const needle of ['customSops','sopId','renderSop','SOP-Handbuch','view===\'sop\'','view === \'sop\'','case \'sop\'','data-view="sop"']){
    let from=0;
    let count=0;
    while(count<4){
      const index=src.indexOf(needle,from);
      if(index<0) break;
      const start=Math.max(0,index-260);
      const end=Math.min(src.length,index+needle.length+420);
      console.log(`\n[${needle}] @ ${index}\n${src.slice(start,end).replace(/\s+/g,' ')}`);
      from=index+needle.length;
      count++;
    }
    if(count===0) console.log(`[${needle}] nicht gefunden`);
  }
  console.log(`</body> @ ${src.lastIndexOf('</body>')} | </head> @ ${src.lastIndexOf('</head>')}`);
}
