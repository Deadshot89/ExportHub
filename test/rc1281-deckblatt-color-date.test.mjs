import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

let built=false;
function build(){
  if(built)return;
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  built=true;
}
function html(file){build();return fs.readFileSync('dist-rc1112/'+file,'utf8')}

test('RC1281: finale Artefakte enthalten weißes kundenspezifisches Deckblatt mit Erstellungsdatum',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const source=html(file);
    assert.match(source,/data-rc1203-cover-enhanced="1"/,file+': Deckblatt-Marker fehlt');
    assert.match(source,/data-rc1281-customer-theme="'\+\(isEssentra\?'essentra':'customer'\)\+'"/,file+': Kundenfarbregel fehlt');
    assert.match(source,/data-rc1281-created-date="1"/,file+': Erstellungsdatum-Marker fehlt');
    assert.match(source,/Erstellt am:/,file+': Erstellungsdatum-Text fehlt');
    assert.match(source,/created=dateDe\(sh&&\(sh\.createdAt\|\|sh\.createdDateTime\|\|sh\.createdOn\|\|sh\.createdDate\|\|sh\.created\)\)/,file+': Erstellungszeitquelle falsch');
    assert.match(source,/background:#fff!important;background-image:none!important/,file+': weißer Deckblatt-Hintergrund fehlt');
    assert.match(source,/--rc1281-ref-bg:'\+\(isEssentra\?'#facc15':'#2563eb'\)/,file+': Referenz Gelb\/Blau fehlt');
    assert.match(source,/--rc1281-recipient-bg:'\+\(isEssentra\?'#fef9c3':'#dbeafe'\)/,file+': Empfänger Hellgelb\/Hellblau fehlt');
    assert.match(source,/assets\/rc1203-deckblatt-print\.js\?v=1281/,file+': RC1281 Runtime-Cache-Key fehlt');
  }
});

test('RC1281: finaler Deckblatt-Stil nutzt die kundenspezifischen Farbvariablen',()=>{
  const source=html('index.html');
  const start=source.indexOf('<style id="exporthub-rc1203-deckblatt-style">');
  const end=start<0?-1:source.indexOf('</style>',start);
  assert.ok(start>=0&&end>start,'RC1281 Deckblatt-Style fehlt');
  const style=source.slice(start,end);
  assert.match(style,/background:#fff!important/);
  assert.match(style,/var\(--rc1281-ref-bg\)/);
  assert.match(style,/var\(--rc1281-recipient-bg\)/);
  assert.doesNotMatch(style,/background:#f8fafc!important/);
  for(const color of ['#facc15','#fef9c3','#2563eb','#dbeafe'])assert.ok(source.includes(color),color+' fehlt im finalen Deckblatt');
});

test('RC1281: Runtime unterscheidet Essentra und andere Kunden ohne Pickup-Datum-Fallback',()=>{
  const runtime=fs.readFileSync('assets/rc1203-deckblatt-print.js','utf8');
  assert.match(runtime,/function isEssentraShipment\(sh\)\{return \/\\bessentra\\b\/i\.test\(customerNameValue\(sh\)\)\}/);
  assert.match(runtime,/function createdValue\(sh\)/);
  assert.match(runtime,/sh\.createdAt,sh\.createdDateTime,sh\.createdOn,sh\.createdDate,sh\.created/);
  const created=runtime.slice(runtime.indexOf('function createdValue'),runtime.indexOf('function formatCreatedDate'));
  assert.doesNotMatch(created,/pickup|planned/i,'Erstellungsdatum darf nicht aus Abholdatum stammen');
});


test('RC1326: Deckblatt-Drucktypografie ist tatsächlich zwei Punkte kleiner',()=>{
  const source=html('index.html');
  assert.match(source,/rc1203-cover-recipient[^>]*font-size:14pt!important/,'Empfängerblock ist nicht auf 14pt reduziert');
  assert.match(source,/font-size:17pt!important;line-height:1\.15!important;font-weight:800!important/,'Empfängername ist nicht auf 17pt reduziert');
  assert.match(source,/data-rc1293-packing-slip="1"[^>]*font-size:7pt!important/,'Deckblatt-Anhänge sind nicht auf die kompakte RC1360-Schrift reduziert');
  assert.match(source,/rc1203-cover-remark[\s\S]{0,1200}font-size:9pt!important[\s\S]{0,500}font-size:10pt!important/,'Bemerkung ist nicht um zwei Punkte reduziert');
  assert.doesNotMatch(source,/data-rc1293-packing-slip="1"[^>]*font-size:10\.5pt!important/,'Alte zu große Anhangschrift ist noch aktiv');
});
