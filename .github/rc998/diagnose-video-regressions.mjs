import fs from 'node:fs';

const files=['TESTVERSION.html','index.html'];
const probes=[
  ['startup-teamdata',/Azure-Teamdaten|Teamdaten werden geladen|ExportHUB wird vorbereitet|vorbereitet/gi],
  ['startup-progress',/progress|loading|loader|team-state|exporthub-state/gi],
  ['shipment-create',/Sendung erstellen|shipment|sendungErstellen|createShipment/gi],
  ['layout-grid',/grid-template-columns|display\s*:\s*grid|minmax\(|container-type|100vw|calc\(100vw/gi],
  ['release-copy',/Update ExportHUB|RC991|Produktionspaket|Release Center|Release-Center/gi],
  ['rc990-layer',/rc990-design-system|rc990|canonicalRender|renderView|currentView/gi],
];

function context(text,index,radius=900){
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
      if(hits.length>=12) break;
      if(m[0].length===0) re.lastIndex++;
    }
    console.log(`\n--- ${name}: ${hits.length} first hits ---`);
    for(const h of hits.slice(0,8)){
      console.log(`@${h.index} [${h.match}] ${context(text,h.index)}`);
    }
  }

  const styleIds=[...text.matchAll(/<style[^>]*id=["']([^"']+)["'][^>]*>/gi)].map(m=>({id:m[1],index:m.index}));
  console.log(`\n--- style ids (${styleIds.length}) tail ---`);
  for(const x of styleIds.slice(-40)) console.log(`${x.index}: ${x.id}`);

  const scriptIds=[...text.matchAll(/<script[^>]*id=["']([^"']+)["'][^>]*>/gi)].map(m=>({id:m[1],index:m.index}));
  console.log(`\n--- script ids (${scriptIds.length}) tail ---`);
  for(const x of scriptIds.slice(-40)) console.log(`${x.index}: ${x.id}`);
}
