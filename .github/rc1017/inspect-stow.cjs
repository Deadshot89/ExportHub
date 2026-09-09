'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const names=[];
for(const m of html.matchAll(/function\s+([A-Za-z0-9_$]*(?:stow|Stow|shipment|Shipment|save|Save)[A-Za-z0-9_$]*)\s*\(/g)){
  if(!names.includes(m[1])) names.push(m[1]);
}
console.log('RC1017_FUNCTIONS='+names.join(','));
for(const name of names){
  if(!/stow|Stow|saveShipment|collectShipment|shipmentData/i.test(name)) continue;
  const needle='function '+name+'(';
  const start=html.indexOf(needle);
  if(start<0) continue;
  const next=html.indexOf('\nfunction ',start+needle.length);
  const end=next>start?Math.min(next,start+12000):Math.min(html.length,start+12000);
  console.log('\n===== '+name+' =====\n'+html.slice(start,end));
}
