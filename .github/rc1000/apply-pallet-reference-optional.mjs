import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];
const OLD_FIELD='<label class="field">Sendungsreferenz<input id="rc542PalRef" placeholder="bei Ausgang Pflicht"></label>';
const NEW_FIELD='<label class="field">Sendungsreferenz optional<input id="rc542PalRef" placeholder="optional"></label>';
const OLD_GATE="if(dir==='Ausgang'&&!ref)return alert('Für einen Ausgang ist die Sendungsreferenz Pflicht.');";

function count(text,needle){return text.split(needle).length-1;}
function replaceOnce(text,oldValue,newValue,label){
  const hits=count(text,oldValue);
  if(hits!==1) throw new Error(`${label}: erwartet 1 Treffer, gefunden ${hits}`);
  return text.replace(oldValue,newValue);
}

for(const file of FILES){
  let html=fs.readFileSync(file,'utf8');
  html=replaceOnce(html,OLD_FIELD,NEW_FIELD,`${file}: Referenzfeld`);
  html=replaceOnce(html,OLD_GATE,'',`${file}: Ausgang-Referenzsperre`);
  fs.writeFileSync(file,html);
  console.log(`${file}: Paletten-Eingang und -Ausgang ohne Referenz freigegeben`);
}

const prod=fs.readFileSync('production-version.js','utf8');
if(!/RC997/.test(prod)||/RC1000/.test(prod)) throw new Error('Produktionsmarker muss während RC1000 auf RC997 bleiben');
console.log('production-version.js: weiterhin RC997');
