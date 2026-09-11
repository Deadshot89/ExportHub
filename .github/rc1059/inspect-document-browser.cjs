const fs=require('fs');
const src=fs.readFileSync('index.html','utf8');
const terms=['generatedDocuments','deliveryFiles','podFiles','abdFiles','downloadDocument','downloadBlob','FileReader','createObjectURL','data:application/pdf','\.data','payload'];
const printed=new Set();
for(const term of terms){
  const re=new RegExp(term,'gi');let m,count=0;
  console.log('\n===== TERM '+term+' =====');
  while((m=re.exec(src))&&count<12){
    const start=Math.max(0,m.index-800),end=Math.min(src.length,m.index+1400),key=start+':'+end;
    if(!printed.has(key)){printed.add(key);console.log('\n--- '+m.index+' ---\n'+src.slice(start,end).replace(/\s+/g,' '));count++;}
    if(re.lastIndex===m.index)re.lastIndex++;
  }
}
