import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function compact(s){return String(s||'').replace(/\s+/g,' ').trim()}
function around(needle,limit=8){
  const low=html.toLocaleLowerCase('de-DE'),n=String(needle).toLocaleLowerCase('de-DE'),out=[];
  let from=0;
  while(out.length<limit){
    const i=low.indexOf(n,from);if(i<0)break;
    out.push(compact(html.slice(Math.max(0,i-650),Math.min(html.length,i+1650))));
    from=i+n.length;
  }
  return out;
}

test('RC1097 Audit: aktive Academy-Funktionen und Prüfungsmarker lokalisieren',()=>{
  assert.match(html,/academy/i,'Academy fehlt im aktiven TESTVERSION-Code');
  const fnNames=[];
  for(const m of html.matchAll(/function\s+([A-Za-z0-9_$]*(?:academy|quiz|exam|pruef|pruf)[A-Za-z0-9_$]*)\s*\(/gi)){
    if(!fnNames.includes(m[1]))fnNames.push(m[1]);
  }
  console.log('RC1097_ACADEMY_FUNCTIONS='+fnNames.slice(0,80).join(','));
  for(const needle of ['academy','quiz','prüfung','50','100','nachbesprechung','datenschutz','beruf']){
    const rows=around(needle,needle==='academy'?5:3);
    console.log('RC1097_'+needle.toUpperCase().replace(/[^A-Z0-9]+/g,'_')+'_COUNT='+rows.length);
    rows.forEach((row,i)=>console.log('RC1097_'+needle.toUpperCase().replace(/[^A-Z0-9]+/g,'_')+'_'+(i+1)+'='+row));
  }
});
