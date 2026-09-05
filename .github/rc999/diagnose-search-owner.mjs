import fs from 'node:fs';

const needles=[
  'initIndex321','index321','globalSearch','searchResults','searchInput','function add(type,title,sub,view,action)',
  'selectedCustomerId=c.id','selectedShipmentId=sh.id','state.customers','state.shipments','state.tasks'
];

for (const file of ['index.html','TESTVERSION.html']) {
  const html=fs.readFileSync(file,'utf8');
  console.log(`\n===== ${file} (${html.length} Zeichen) =====`);
  for (const needle of needles) {
    let from=0,count=0,first=-1;
    while(true){
      const pos=html.indexOf(needle,from);
      if(pos<0) break;
      if(first<0) first=pos;
      count++;
      from=pos+needle.length;
    }
    console.log(`${needle}: count=${count}, first=${first}`);
    if(first>=0){
      console.log(html.slice(Math.max(0,first-700),Math.min(html.length,first+4200)));
    }
  }
}
