import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const expected={
  de:'Abholdatum',
  en:'Pickup date',
  pl:'Data odbioru',
  es:'Fecha de recogida',
  fr:'Date d’enlèvement',
  it:'Data di ritiro'
};

test('RC1344: Deckblatt-Abholdatum wird über i18n gerendert und bleibt im Deutschen unverändert',()=>{
  assert.doesNotMatch(runtime,/<strong>Abholdatum:<\/strong>/);
  assert.match(runtime,/tr\('pickup\.date'\)/);
  for(const [lang,label] of Object.entries(expected)){
    const catalog=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    assert.equal(catalog['pickup.date'],label,lang+': pickup.date fehlt oder ist falsch');
  }
});

test('RC1344: Druckruntime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1305-loading-list-print.js'],{stdio:'pipe'});
});
