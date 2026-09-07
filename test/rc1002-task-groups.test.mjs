import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function groupBlock(){
  const start=html.indexOf('function taskGroupNameRC874(t){');
  const end=html.indexOf('function taskGroupOpenRC874',start);
  assert.ok(start>=0,'taskGroupNameRC874 fehlt');
  return html.slice(start,end>start?end:start+7000);
}

test('RC1002 verwendet genau die fünf fachlichen Aufgaben-Gruppen',()=>{
  const src=groupBlock();
  for(const label of ['Offene Sendungen','Fehlende POD','Kunde angemeldet','Picks','Offene ABDs']) assert.match(src,new RegExp(label.replace(' ','\\s*')));
  for(const old of ['Picken','ABD erstellen','Anmelden','Aufträge kontrollieren','Zusatzaufgaben','Weitere offene Aufgaben']) assert.doesNotMatch(src,new RegExp(old));
});

test('RC1002 Fehlende POD verlangt Abholung und fehlenden POD',()=>{
  const src=groupBlock();
  assert.match(src,/abgeholt|pickup|pickedup/i,'Abholung muss geprüft werden');
  assert.match(src,/pod/i,'POD muss geprüft werden');
  assert.match(src,/!.*pod|pod.*(?:false|null|length|vorhanden|exists|has)/i,'fehlender POD muss explizit unterschieden werden');
});

test('RC1002 Gruppenreihenfolge ist fachlich fest',()=>{
  assert.match(html,/Offene Sendungen[\s\S]{0,500}Fehlende POD[\s\S]{0,500}Kunde angemeldet[\s\S]{0,500}Picks[\s\S]{0,500}Offene ABDs/);
});
