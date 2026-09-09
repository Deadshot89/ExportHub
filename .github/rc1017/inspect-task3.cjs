'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');

function printFunction(name,max=9000){
  const needle='function '+name+'(';
  const start=html.indexOf(needle);
  console.log('\n===== '+name+' start='+start+' =====');
  if(start<0){console.log('NOT_FOUND');return;}
  const next=html.indexOf('\nfunction ',start+needle.length);
  const end=next>start?Math.min(next,start+max):Math.min(html.length,start+max);
  console.log(html.slice(start,end));
}

['persistShipment','saveAction','renderStowPlan','currentSaved','shipment','updateSaved'].forEach(name=>printFunction(name));
