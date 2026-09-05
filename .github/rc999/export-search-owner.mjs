import fs from 'node:fs';

const file='index.html';
const html=fs.readFileSync(file,'utf8');
const start=html.indexOf('(function initIndex321(){');
if(start<0) throw new Error('initIndex321 fehlt');
const end=html.indexOf('})();',start);
if(end<0) throw new Error('initIndex321 Ende fehlt');
const block=html.slice(start,end+5);
fs.writeFileSync('.github/rc999/search-owner-snapshot.txt',block);
console.log(`Suchindex exportiert: ${block.length} Zeichen`);
