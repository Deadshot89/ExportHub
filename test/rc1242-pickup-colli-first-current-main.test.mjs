import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const page=fs.readFileSync('pickup.html','utf8');

test('RC1242: Abhol-QR führt Sendung → Collis → Fahrer in dieser Reihenfolge',()=>{
  const details=page.indexOf('<div id="details"></div>');
  const colli=page.indexOf('<section id="colliSection"');
  const driver=page.indexOf('<div id="driverStep" hidden>');
  assert.ok(details>=0&&colli>details&&driver>colli,'Abholschritte sind nicht in der geforderten Reihenfolge');
  assert.match(page,/1 · Sendung/);
  assert.match(page,/2 · Collis/);
  assert.match(page,/3 · Fahrer/);
});

test('RC1242: Fahrerdaten bleiben bis erfolgreicher Colli-Bestätigung gesperrt',()=>{
  assert.match(page,/function setDriverStepUnlocked\(on\)/);
  assert.match(page,/step\.hidden=!on/);
  assert.match(page,/setDriverStepUnlocked\(true\);status\('Collis bestätigt\. Bitte jetzt die Fahrerdaten erfassen\.'/);
  assert.match(page,/colliOk=false;setDriverStepUnlocked\(false\)/);
  assert.match(page,/Bitte zuerst die Collis prüfen und bestätigen\. Fahrerdaten werden erst danach freigeschaltet/);
});

test('RC1242: fehlende erwartete Colli-Anzahl blockiert die Abholung fail-closed',()=>{
  assert.match(page,/function blockMissingColli\(\)/);
  assert.match(page,/Die erwartete Colli-Anzahl fehlt in der Sendung\. Die Abholung ist gesperrt/);
  assert.match(page,/if\(!\(expected>0\)\)\{colliOk=false;setDriverStepUnlocked\(false\);return false\}/);
  assert.doesNotMatch(page,/if\(!\(expected>0\)\)\{colliOk=true;return true\}/);
});

test('RC1242: Fahrer, Kennzeichen, Spedition, Unterschrift und PIN liegen hinter dem Colli-Schritt',()=>{
  const start=page.indexOf('<div id="driverStep" hidden>');
  const end=page.indexOf('</form>',start);
  const block=page.slice(start,end);
  for(const id of ['driver','plate','carrier','signatureOpen','pin','confirmPartial','confirm']){
    assert.match(block,new RegExp('id="'+id+'"'),'Fahrer-Schritt fehlt: '+id);
  }
});

test('RC1242: pickup.html bleibt syntaktisch als eingebettetes Script prüfbar',()=>{
  const start=page.indexOf('<script>')+8,end=page.lastIndexOf('</script>');
  assert.ok(start>=8&&end>start);
  const script=page.slice(start,end);
  new Function(script);
});
