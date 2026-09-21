import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('pickup.html','utf8');

test('RC1199: Abhol-QR führt Sendung → Collis → Fahrer in dieser Reihenfolge',()=>{
  const details=page.indexOf('<div id="details"></div>');
  const colli=page.indexOf('<section id="colliSection"');
  const driver=page.indexOf('<div id="driverStep" hidden>');
  assert.ok(details>=0&&colli>details&&driver>colli,'Abholschritte sind nicht in der geforderten Reihenfolge');
  assert.match(page,/1 · Sendung/);
  assert.match(page,/2 · Collis/);
  assert.match(page,/3 · Fahrer/);
});

test('RC1199: Fahrerdaten bleiben bis erfolgreicher Colli-Bestätigung gesperrt',()=>{
  assert.match(page,/function setDriverStepUnlocked\(on\)/);
  assert.match(page,/step\.hidden=!on/);
  assert.match(page,/setDriverStepUnlocked\(true\);status\('Collis bestätigt\. Bitte jetzt die Fahrerdaten erfassen\.'/);
  assert.match(page,/colliOk=false;setDriverStepUnlocked\(false\)/);
  assert.match(page,/Bitte zuerst die Collis prüfen und bestätigen\. Fahrerdaten werden erst danach freigeschaltet/);
});

test('RC1199: fehlende erwartete Colli-Anzahl blockiert Abholung fail-closed',()=>{
  assert.match(page,/function blockMissingColli\(\)/);
  assert.match(page,/Die erwartete Colli-Anzahl fehlt in der Sendung\. Die Abholung ist gesperrt/);
  assert.match(page,/if\(!\(expected>0\)\)\{colliOk=false;setDriverStepUnlocked\(false\);return false\}/);
  assert.doesNotMatch(page,/if\(!\(expected>0\)\)\{colliOk=true;return true\}/);
});

test('RC1199: Fahrer, Kennzeichen, Spedition, Unterschrift und PIN liegen im Fahrer-Schritt',()=>{
  const start=page.indexOf('<div id="driverStep" hidden>');
  const end=page.indexOf('</form>',start);
  const block=page.slice(start,end);
  for(const id of ['driver','plate','carrier','signatureOpen','pin','confirmPartial','confirm']){
    assert.match(block,new RegExp('id="'+id+'"'),'Fahrer-Schritt fehlt: '+id);
  }
});
