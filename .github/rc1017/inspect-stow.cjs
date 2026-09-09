'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const names=[];
for(const m of html.matchAll(/function\s+([A-Za-z0-9_$]*(?:stow|Stow|shipment|Shipment|save|Save|persist|Persist|flush|Flush)[A-Za-z0-9_$]*)\s*\(/g)){
  if(!names.includes(m[1])) names.push(m[1]);
}
console.log('RC1017_FUNCTIONS='+names.join(','));
const wanted=/stow|Stow|saveAction|persistShipment|scheduleEditSave|flushEditSave|currentSaved|newestSavedForSave|completeShipmentRows|prepareEditorForSave|updateSaved/i;
for(const name of names){
  if(!wanted.test(name)) continue;
  const needle='function '+name+'(';
  const start=html.indexOf(needle);
  if(start<0) continue;
  const next=html.indexOf('\nfunction ',start+needle.length);
  const end=next>start?Math.min(next,start+16000):Math.min(html.length,start+16000);
  console.log('\n===== '+name+' =====\n'+html.slice(start,end));
}
// RC1017 retry marker: keep this helper deterministic while re-running the same RED contract.
