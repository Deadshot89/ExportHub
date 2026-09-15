import fs from 'node:fs';

const file='pickup.html';
const source=fs.readFileSync(file,'utf8');
const lines=source.split('\n');
const doubleSlash=String.fromCharCode(92,92,47);
const singleSlash=String.fromCharCode(92,47);
const doubleDot=String.fromCharCode(92,92,46);
const singleDot=String.fromCharCode(92,46);
let changed=0;

const next=lines.map(line=>{
  if(!line.startsWith('var hm=hash.match(')&&!line.startsWith("var pm=String(u.pathname||'').match("))return line;
  let out=line.split(doubleSlash).join(singleSlash);
  if(line.startsWith("var pm=String(u.pathname||'').match("))out=out.split(doubleDot).join(singleDot);
  if(out!==line)changed++;
  return out;
}).join('\n');

if(changed!==2)throw new Error('Erwartet exakt zwei Pickup-Routen-Regex-Korrekturen, gefunden '+changed);
fs.writeFileSync(file,next);
console.log('Pickup-Routen-Regex korrigiert: '+changed+' Zeilen.');
// RC1124 trigger
