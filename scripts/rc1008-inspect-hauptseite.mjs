import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];
const needles=[
  'data-page="tasks"',
  "data-page='tasks'",
  'Aufgaben',
  'Sendungsübersicht',
  '__EXPORTHUB_CANONICAL_MODULE_MANIFEST__',
  'function showPage',
  'showPage=',
  'currentShipments',
  'teamState',
  'loadTeamState',
  'renderTasks',
  'setShipments'
];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  console.log(`\n===== ${file} len=${text.length} =====`);
  for(const needle of needles){
    let start=0,count=0;
    while(count<4){
      const i=text.indexOf(needle,start);
      if(i<0) break;
      count++;
      const a=Math.max(0,i-500), b=Math.min(text.length,i+needle.length+900);
      console.log(`\n--- ${JSON.stringify(needle)} #${count} @${i} ---\n${text.slice(a,b).replace(/\r/g,'')}`);
      start=i+needle.length;
    }
    if(!count) console.log(`\n--- ${JSON.stringify(needle)}: 0 ---`);
  }
}
