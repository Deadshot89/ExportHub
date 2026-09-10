import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{stdio:'pipe'});
const source=fs.readFileSync('dist-rc1018/index.html','utf8');

function contexts(needle,radius=420){
  const out=[];let at=0;
  while((at=source.indexOf(needle,at))>=0){
    out.push(source.slice(Math.max(0,at-radius),Math.min(source.length,at+needle.length+radius)).replace(/\s+/g,' '));
    at+=needle.length;
  }
  return out;
}

console.log('=== rc542PalRef occurrences ===');
contexts('rc542PalRef',650).forEach((x,i)=>console.log(`REFCTX ${i+1}: ${x}`));

console.log('=== Referenz alerts/errors ===');
const rx=/.{0,260}(?:alert\(|throw new Error\(|required|Pflicht|erforderlich|required)[^\n]{0,260}referenz.{0,260}|.{0,260}referenz[^\n]{0,260}(?:alert\(|throw new Error\(|required|Pflicht|erforderlich|required).{0,260}/gi;
let m,i=0;
while((m=rx.exec(source))&&i<100){console.log(`MSGCTX ${++i}: ${m[0].replace(/\s+/g,' ')}`);if(m.index===rx.lastIndex)rx.lastIndex++;}

console.log('=== Paletten function ===');
const start=source.indexOf('window.rc542AddPalletBooking=function()');
const end=source.indexOf('window.rc542CorrectPalletBooking',start);
console.log(source.slice(start,end).replace(/\s+/g,' '));
