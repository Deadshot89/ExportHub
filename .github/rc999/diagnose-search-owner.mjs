import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];
const SCRIPT_START='<script id="index321-single-navigation-controller">';
const SCRIPT_END='</script>';
const NEEDLES=['globalSearch','search','customer','shipment','task','filter(','ITEMS','addEventListener','route','go(','open','selectedCustomer','selectedShipment'];

function positions(text,needle){
  const out=[]; let from=0;
  while(true){const p=text.indexOf(needle,from);if(p<0)break;out.push(p);from=p+needle.length;}
  return out;
}

for(const file of FILES){
  const html=fs.readFileSync(file,'utf8');
  const a=html.indexOf(SCRIPT_START);
  if(a<0)throw new Error(`${file}: ${SCRIPT_START} fehlt`);
  const b=html.indexOf(SCRIPT_END,a+SCRIPT_START.length);
  if(b<0)throw new Error(`${file}: Navigation-Controller Ende fehlt`);
  const block=html.slice(a,b+SCRIPT_END.length);
  console.log(`\n===== ${file} INDEX321 OWNER ${block.length} chars =====`);
  const fnNames=[...block.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(m=>m[1]);
  console.log('FUNCTIONS:',fnNames.join(', '));
  for(const needle of NEEDLES){
    const ps=positions(block,needle);
    console.log(`\n--- ${needle}: ${ps.length} Treffer ---`);
    for(const p of ps.slice(0,8)) console.log(block.slice(Math.max(0,p-650),Math.min(block.length,p+2200)));
  }
}
