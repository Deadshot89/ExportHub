'use strict';
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');

function printFunction(name,max=9000){
  const needles=['function '+name+'(','async function '+name+'('];
  let start=-1;
  for(const needle of needles){start=html.indexOf(needle);if(start>=0)break}
  console.log('\n===== '+name+' start='+start+' =====');
  if(start<0){console.log('NOT_FOUND');return;}
  console.log(html.slice(start,Math.min(html.length,start+max)));
}
function printContext(needle,span=3500){
  let from=0,index=0,count=0;
  while((index=html.indexOf(needle,from))>=0&&count<4){
    console.log('\n===== CONTEXT '+needle+' @'+index+' =====');
    console.log(html.slice(Math.max(0,index-span),Math.min(html.length,index+span)));
    from=index+needle.length;count++;
  }
  if(!count)console.log('\n===== CONTEXT '+needle+' NOT_FOUND =====');
}

['persistShipment','saveAction','renderStowPlan','printStow','activateQr','updateQr','currentSaved','shipment','updateSaved'].forEach(name=>printFunction(name));
['loadListDoc','Gesamtdruck','Ladeliste','pickup-init','rc380PrintStow'].forEach(x=>printContext(x));
