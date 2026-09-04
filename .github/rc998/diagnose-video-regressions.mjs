import fs from 'node:fs';

const files=['TESTVERSION.html','index.html'];
const groups=[
  {name:'startup-exact', terms:['14000','24000','Teamdaten werden geladen','Azure-Teamdaten werden geladen','ExportHUB wird vorbereitet','readTeam()','readTeam(','verifySessionForLoad','RC877']},
  {name:'cache-exact', terms:['RC725','viewCache','cachedView','restoreView','cacheView','DocumentFragment','detach','replaceChildren','appendChild','heavyViews','heavy views']},
  {name:'layout-exact', terms:['RC978','ResizeObserver','container-type','container-name','clientWidth','offsetWidth','getBoundingClientRect','shipment-entry-layout','shipment-layout']},
  {name:'release-exact', terms:["var RELEASE=Object.freeze","Release-Center Produktionspaket abgesichert",'Update ExportHUB']},
];

function squash(s){return s.replace(/\s+/g,' ');}
function excerpt(text,pos,radius=6500){return squash(text.slice(Math.max(0,pos-radius),Math.min(text.length,pos+radius)));}
function positions(text,term,max=12){
  const out=[];let from=0;
  while(out.length<max){
    const p=text.indexOf(term,from);if(p<0)break;out.push(p);from=p+Math.max(1,term.length);
  }
  return out;
}

for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  console.log(`\n===== ${file} bytes=${text.length} =====`);
  for(const group of groups){
    console.log(`\n######## ${group.name} ########`);
    for(const term of group.terms){
      const ps=positions(text,term);
      console.log(`\n--- ${JSON.stringify(term)} positions: ${ps.join(', ')} ---`);
      for(const p of ps.slice(0,6)) console.log(`@${p} ${excerpt(text,p)}`);
    }
  }

  // Function-like owners around cache and startup markers.
  const ownerRegexes=[
    /function\s+[A-Za-z0-9_$]*(?:cache|Cache|restore|Restore|view|View)[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/g,
    /(?:async\s+)?function\s+[A-Za-z0-9_$]*(?:team|Team|load|Load|boot|Boot|start|Start)[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/g,
    /(?:const|let|var)\s+[A-Za-z0-9_$]*(?:cache|Cache|restore|Restore|team|Team|boot|Boot)[A-Za-z0-9_$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
  ];
  console.log('\n######## function owners ########');
  for(const re of ownerRegexes){
    let m,count=0;re.lastIndex=0;
    while((m=re.exec(text))&&count<30){
      console.log(`@${m.index} ${m[0]} ${excerpt(text,m.index,3500)}`);count++;
    }
  }
}
