'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const names=[];
for(const m of html.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]*(?:stow|Stow|shipment|Shipment|save|Save|persist|Persist|flush|Flush|qr|Qr|print|Print|load|Load|pdf|Pdf|document|Document|register|Register)[A-Za-z0-9_$]*)\s*\(/g)){
  if(!names.includes(m[1])) names.push(m[1]);
}
console.log('RC1017_FUNCTIONS='+names.join(','));
const wantedNames=new Set(['activateQr','updateQr','printStow','renderStowPlan','rc1017SyncSubShipments','renderRc1017SubShipments','persistShipment','saveAction','shipmentCard','loadHtml','createPdf','decorateDocument','downloadDocument','qrMarkup','register']);
for(const name of names){
  if(!wantedNames.has(name)&&!/loading|loadlist|ladeliste|gesamt|document|pdf/i.test(name)) continue;
  let start=html.indexOf('function '+name+'(');
  if(start<0)start=html.indexOf('async function '+name+'(');
  if(start<0)continue;
  const candidates=[html.indexOf('\nfunction ',start+20),html.indexOf('\nasync function ',start+20)].filter(x=>x>start);
  const next=candidates.length?Math.min(...candidates):-1;
  const end=next>start?Math.min(next,start+22000):Math.min(html.length,start+22000);
  console.log('\n===== '+name+' =====\n'+html.slice(start,end));
}
