import fs from 'node:fs';

const files=['TESTVERSION.html','index.html'];
const probes=[
  ['startup-timeouts',/14000|14\s|24000|24\s|AbortController|timeout|Teamdaten werden geladen|Azure-Teamdaten/gi],
  ['startup-read-owner',/verifySessionForLoad|loadTeam|teamRead|readTeam|bootstrap-status|mode=meta|exporthub-state/gi],
  ['shipment-cache-owner',/RC725|viewCache|cachedView|cacheView|restoreView|DocumentFragment|detach|heavy views|shipment.*cache|cache.*shipment/gi],
  ['shipment-layout-owner',/RC978|rc978|ResizeObserver|container-type|container-name|offsetWidth|clientWidth|getBoundingClientRect|grid-template-columns/gi],
  ['shipment-view-owner',/exporthub-rc776-shipment-view|index298-stable-navigation-shipment|rc373-shipment-controller|scheduleLayout|layout.*shipment|shipment.*layout/gi],
  ['release-owner',/var RELEASE=Object\.freeze|ExportHUBBuild|renderUpdate|Update ExportHUB|production-update-indicator/gi],
];

function context(text,index,radius=1800){
  const start=Math.max(0,index-radius),end=Math.min(text.length,index+radius);
  return text.slice(start,end).replace(/\s+/g,' ');
}

for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  console.log(`\n===== ${file} bytes=${text.length} =====`);
  for(const [name,re] of probes){
    re.lastIndex=0;
    const hits=[];
    let m;
    while((m=re.exec(text))){
      hits.push({index:m.index,match:m[0]});
      if(hits.length>=20) break;
      if(m[0].length===0) re.lastIndex++;
    }
    console.log(`\n--- ${name}: ${hits.length} first hits ---`);
    for(const h of hits.slice(0,12)) console.log(`@${h.index} [${h.match}] ${context(text,h.index)}`);
  }

  const ids=['exporthub-rc776-shipment-view','index298-stable-navigation-shipment-style','exporthub-rc373-shipment-controller','exporthub-rc741-production-update-indicator','exporthub-canonical-build-source'];
  for(const id of ids){
    const pos=text.indexOf(`id="${id}"`)>=0?text.indexOf(`id="${id}"`):text.indexOf(`id='${id}'`);
    console.log(`\n--- exact-id ${id} @${pos} ---`);
    if(pos>=0) console.log(context(text,pos,5000));
  }

  for(const term of ['RC877','RC725','RC978']){
    const positions=[];let from=0;
    while((from=text.indexOf(term,from))>=0&&positions.length<8){positions.push(from);from+=term.length;}
    console.log(`\n--- exact-term ${term}: ${positions.join(', ')} ---`);
    positions.forEach(pos=>console.log(context(text,pos,2500)));
  }
}
