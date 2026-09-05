import fs from 'node:fs';

for (const file of ['index.html','TESTVERSION.html']) {
  const html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('(function initIndex321(){');
  if(start<0) throw new Error(`${file}: initIndex321 fehlt`);
  const end=html.indexOf('})();',start);
  if(end<0) throw new Error(`${file}: initIndex321 Ende fehlt`);
  const block=html.slice(start,end+5);
  console.log(`\n===== ${file} initIndex321 (${block.length} Zeichen) =====`);
  for (const needle of ['function add','state.customers','state.shipments','state.tasks','catch(e)']) {
    const pos=block.indexOf(needle);
    console.log(`\n--- ${needle} @ ${pos} ---`);
    if(pos>=0) console.log(block.slice(Math.max(0,pos-500),Math.min(block.length,pos+2600)));
  }
}
