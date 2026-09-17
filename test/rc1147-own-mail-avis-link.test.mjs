import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');

function between(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0,`Start marker fehlt: ${start}`);
  assert.ok(b>a,`End marker fehlt: ${end}`);
  return source.slice(a,b);
}

test('RC1147: eigene Mail wird im finalen Mailtext nicht mehr vom Avis-Link ausgeschlossen',()=>{
  const inject=between('function injectMailBody','function syncVisibleMail');
  assert.doesNotMatch(inject,/if\(type==='own'\|\|/,'Eigene Mail darf nicht unverändert am Lieferavis vorbei delegiert werden.');
  assert.match(inject,/type==='own'[\s\S]{0,500}ownAvisMail\(/,'Eigene Mail muss den kompakten Avis-Link im finalen Mailtext erhalten.');
});

test('RC1147: sichtbare eigene Mail wird synchronisiert statt übersprungen',()=>{
  const sync=between('function syncVisibleMail','function isCustomerField');
  assert.doesNotMatch(sync,/type==='own'\|\|/,'Die sichtbare eigene Mail darf nicht aus der Synchronisierung ausgeschlossen werden.');
  assert.match(sync,/type==='own'[\s\S]{0,500}ownAvisMail\(/,'Die sichtbare eigene Mail muss über denselben kompakten Avis-Formatter laufen.');
});

test('RC1147: eigener Avis-Link bleibt kompakt und eindeutig',()=>{
  assert.match(source,/function ownAvisMail\(/,'Kompakter Formatter für eigene Mails fehlt.');
  assert.match(source,/(?:Lieferavis|Collection notice).*localizedUrl/s,'Der Formatter muss den sprachabhängigen Avis-Link verwenden.');
  assert.match(source,/stripOwnAvisLink|replace\([^\n]*Lieferavis/,'Bestehende Avis-Links müssen vor dem erneuten Einfügen entfernt werden, damit keine Dubletten entstehen.');
});

test('RC1147: Wechsel auf die eigene Mail stößt die sichtbare Synchronisierung erneut an',()=>{
  assert.match(source,/data-rc543-target[\s\S]{0,500}syncVisibleMail/,'Beim Wechsel des Mail-Typs muss der Avis-Link unmittelbar nachgezogen werden.');
});
