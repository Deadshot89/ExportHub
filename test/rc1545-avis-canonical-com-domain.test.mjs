import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const immediate=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
const reminder=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const overviewTest=fs.readFileSync('test/rc1166-avis-reminder-overview.test.mjs','utf8');

for(const [name,source] of [['Lieferavis',immediate],['Avis-Erinnerung',reminder]]){
  test(`RC1545: ${name} erzeugt neue Produktionslinks kanonisch unter exporthub360.com`,()=>{
    assert.match(source,/RC1333_PROD_AVIS_ORIGIN='https:\/\/exporthub360\.com'/);
    assert.doesNotMatch(source,/RC1333_PROD_AVIS_ORIGIN='https:\/\/(?:www\.)?exporthub360\.de'/);
  });
}

test('RC1545: bestehende .de- und .com-Avis-Links bleiben als sichere Legacy-Links akzeptiert',()=>{
  assert.match(immediate,/h==='exporthub360\.com'/);
  assert.match(immediate,/h==='www\.exporthub360\.com'/);
  assert.match(immediate,/h==='www\.exporthub360\.de'/);
  assert.match(immediate,/h==='exporthub360\.de'/);
});

test('RC1545: Reminder-Vertrag normalisiert vorhandene .com-Links nicht mehr auf .de',()=>{
  assert.doesNotMatch(overviewTest,/alter \.com-Avis-Link wird in der Oberfläche zwingend auf \.de normalisiert/);
  assert.match(overviewTest,/https:\/\/exporthub360\.com\/avis\/legacy-token/);
});
