import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
for(const needle of ['/* RC352 Deckblatt */','.rc352-cover{','class="rc352-cover"',"class='rc352-cover'",'rc352-cover-head']){
  const idx=html.indexOf(needle);
  console.log('\n=== '+needle+' @ '+idx+' ===\n');
  if(idx>=0) console.log(html.slice(Math.max(0,idx-800),Math.min(html.length,idx+14000)));
}
