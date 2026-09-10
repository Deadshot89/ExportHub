import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const seed=require('../api/shared/rc1014-fixed-pickup-seed.js');

function build(){
  execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{stdio:'pipe'});
}
function read(file){return fs.readFileSync(file,'utf8');}
function countOf(source,needle){return source.split(needle).length-1;}
function functionBody(source,startNeedle,endNeedle){
  const start=source.indexOf(startNeedle),end=source.indexOf(endNeedle,start+startNeedle.length);
  assert.ok(start>=0&&end>start,`${startNeedle} konnte nicht im RC1018-Build isoliert werden`);
  return source.slice(start,end);
}

test('Kalender: historische Essentra-Benutzer im legacy-default Firmenkontext erhalten den freigegebenen FIX-Startbestand',()=>{
  const rows=seed.defaultsForCompany('legacy-default').map(({siteLabel,weekday})=>`${siteLabel}|${weekday}`);
  assert.deepEqual(rows,[
    'Frankreich|1','Italien|1','Neff|1','O’Hare|1','Faurecia|2','BMP|3'
  ]);
});

test('Palettenkonto: der ausgelieferte RC1018-Build verlangt weder für Eingang noch Ausgang eine Sendungsreferenz',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const source=read(`dist-rc1018/${file}`);
    assert.equal(countOf(source,'window.rc542AddPalletBooking=function()'),1,`${file}: mehrere Paletten-Buchungsfunktionen überschreiben sich`);
    assert.equal(countOf(source,'id="rc542PalRef"'),1,`${file}: mehrere Paletten-Referenzfelder sind gleichzeitig im Build vorhanden`);
    const add=functionBody(source,'window.rc542AddPalletBooking=function()','window.rc542CorrectPalletBooking');
    assert.doesNotMatch(add,/!\s*ref/,`${file}: Buchungsfunktion enthält weiterhin eine Pflichtprüfung auf Referenz`);
    assert.doesNotMatch(add,/referenz[^;\n]{0,120}(?:pflicht|erforderlich|required)/i,`${file}: Buchungsfunktion meldet Referenz weiterhin als Pflicht`);
    assert.match(add,/shipmentRef\s*:\s*ref/,`${file}: optionale Referenz wird bei Angabe nicht mehr gespeichert`);
    assert.match(source,/Sendungsreferenz optional<input id=["']rc542PalRef["'][^>]*placeholder=["']optional["'][^>]*>/,`${file}: Palettenformular kennzeichnet Referenz nicht als optional`);
    const input=source.match(/<input id=["']rc542PalRef["'][^>]*>/i)?.[0]||'';
    assert.doesNotMatch(input,/\brequired\b/i,`${file}: Referenzfeld ist im ausgelieferten Formular weiterhin required`);
  }
});