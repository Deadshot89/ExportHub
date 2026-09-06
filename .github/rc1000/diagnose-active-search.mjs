import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];
const PROBES=[
  ['selectedCustomerId',/selectedCustomerId/g],
  ['selectedShipmentId',/selectedShipmentId/g],
  ['shipmentoverview',/shipmentoverview/gi],
  ['customers',/["']customers["']/g],
  ['globalSearch',/global.?search/gi],
  ['searchResults',/search.?results/gi],
  ['searchInput',/search.?input/gi],
  ['suche',/\bsuche\b/gi]
];

function positions(text,re,limit=4){
  const out=[];
  re.lastIndex=0;
  let m;
  while((m=re.exec(text))&&out.length<limit){
    out.push(m.index);
    if(m[0].length===0) re.lastIndex++;
  }
  re.lastIndex=0;
  return out;
}
function allCount(text,re){
  re.lastIndex=0;
  let n=0,m;
  while((m=re.exec(text))){n++;if(m[0].length===0)re.lastIndex++;}
  re.lastIndex=0;
  return n;
}
function oneLine(s){return s.replace(/\s+/g,' ').trim();}
function nearestOwner(text,pos){
  const start=Math.max(0,pos-5000);
  const prefix=text.slice(start,pos);
  const patterns=[
    /function\s+([\w$]+)\s*\([^)]*\)\s*\{/g,
    /(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
    /(?:const|let|var)\s+([\w$]+)\s*=\s*function\s*\([^)]*\)\s*\{/g,
    /\(function\s*([\w$]*)\s*\([^)]*\)\s*\{/g
  ];
  let best=null;
  for(const re of patterns){
    let m;
    while((m=re.exec(prefix))){
      const abs=start+m.index;
      if(!best||abs>best.pos) best={pos:abs,sig:oneLine(m[0]),name:m[1]||'(IIFE)'};
    }
  }
  return best;
}

for(const file of FILES){
  const text=fs.readFileSync(file,'utf8');
  console.log(`=== ${file} ===`);
  for(const [name,re] of PROBES) console.log(`COUNT ${name}=${allCount(text,re)}`);
  let emitted=0;
  for(const [name,re] of PROBES){
    for(const pos of positions(text,re,2)){
      if(emitted>=10) break;
      const owner=nearestOwner(text,pos);
      const snippet=oneLine(text.slice(Math.max(0,pos-260),Math.min(text.length,pos+420)));
      console.log(`HIT ${name} @${pos} OWNER=${owner?owner.sig:'NONE'} OWNER_POS=${owner?owner.pos:-1}`);
      console.log(`SNIP ${snippet}`);
      emitted++;
    }
    if(emitted>=10) break;
  }
  const scriptCount=(text.match(/<script\b/gi)||[]).length;
  console.log(`SCRIPT_COUNT=${scriptCount}`);
}
