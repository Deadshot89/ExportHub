import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
console.log('FILE_LENGTH',html.length);
const rx=/Deckblatt/gi;
let m,i=0;
while((m=rx.exec(html))){
  i++;
  const idx=m.index;
  const fnAt=html.lastIndexOf('function ',idx);
  const fn=fnAt>=0&&idx-fnAt<20000?html.slice(fnAt,Math.min(html.length,fnAt+180)).replace(/\s+/g,' '):'';
  const ctx=html.slice(Math.max(0,idx-700),Math.min(html.length,idx+1100)).replace(/\r?\n/g,'\\n');
  console.log('DECK_OCCURRENCE',i,'INDEX',idx,'NEAR_FUNCTION',fn);
  console.log(ctx);
}
for(const needle of ['deck','cover','front','title>','printAll','rc363PrintAll','Gesamtdruck','Gesamtausgabe']){
  const lower=html.toLowerCase(),n=needle.toLowerCase();
  let from=0,count=0;
  while(true){
    const idx=lower.indexOf(n,from);
    if(idx<0)break;
    count++;
    if(count<=12){
      const ctx=html.slice(Math.max(0,idx-420),Math.min(html.length,idx+760)).replace(/\r?\n/g,'\\n');
      console.log('HIT',needle,count,'INDEX',idx,ctx);
    }
    from=idx+n.length;
  }
  console.log('COUNT',needle,count);
}
