import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const needles=['Deckblatt','DECKBLATT','Gesamtdruck','Gesamtausgabe','printAll','print-all','window.open','about:blank'];
console.log('FILE_LENGTH',html.length);
for(const needle of needles){
  let from=0,count=0;
  while(true){
    const idx=html.indexOf(needle,from);
    if(idx<0)break;
    count++;
    const start=Math.max(0,idx-1800),end=Math.min(html.length,idx+2600);
    console.log('\n=== '+needle+' #'+count+' @ '+idx+' ===\n');
    console.log(html.slice(start,end));
    from=idx+needle.length;
    if(count>=20)break;
  }
  console.log('\nCOUNT '+needle+' '+count);
}
