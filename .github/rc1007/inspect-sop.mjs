import fs from 'node:fs';

const needles=[
  'customSops','sopId','renderSop','SOP-Handbuch','view===\'sop\'','view === \'sop\'','case \'sop\'','data-view="sop"',
  'canRead','canWrite','canEdit','functionAdmin','rights.sop','rightsModules','function save','save=function','window.save','currentUser','__EXPORTHUB_GET_CURRENT_USER__'
];

for(const file of ['index.html','TESTVERSION.html']){
  const src=fs.readFileSync(file,'utf8');
  console.log(`\n=== ${file} SOP-/RECHTE-INTEGRATIONSANKER ===`);
  for(const needle of needles){
    let from=0;
    let count=0;
    while(count<6){
      const index=src.indexOf(needle,from);
      if(index<0) break;
      const start=Math.max(0,index-420);
      const end=Math.min(src.length,index+needle.length+720);
      console.log(`\n[${needle}] @ ${index}\n${src.slice(start,end).replace(/\s+/g,' ')}`);
      from=index+needle.length;
      count++;
    }
    if(count===0) console.log(`[${needle}] nicht gefunden`);
  }
  console.log(`</body> @ ${src.lastIndexOf('</body>')} | </head> @ ${src.lastIndexOf('</head>')}`);
}
