import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const page=fs.readFileSync('pickup.html','utf8');

test('RC1258: Colli-Prüfung steht vor Sendungsdetails und Fahrer; Container ist zuletzt',()=>{
  const colli=page.indexOf('<section id="colliSection"');
  const container=page.indexOf('<section id="containerSection"');
  const details=page.indexOf('<div id="details"></div>');
  const driver=page.indexOf('<div id="driverStep" hidden>');
  assert.ok(colli>=0&&details>colli&&driver>details&&container>driver,'Colli-Prüfung muss zuerst und Container-Dokumentation zuletzt stehen');
  assert.match(page,/1 · Sendung/);
  assert.match(page,/2 · Collis/);
  assert.match(page,/3 · Fahrer/);
  assert.match(page,/4 · Bestätigung/);
  assert.match(page,/5 · Container/);
});

test('RC1242: Collis sperren alle Folgeschritte, Containerfotos sperren nur den Abschluss',()=>{
  assert.match(page,/function setDriverStepUnlocked\(on\)/);
  assert.match(page,/container\.hidden=!on/);
  assert.match(page,/driver\.hidden=!on/);
  assert.match(page,/function unlockDriverAfterColli\(\)/);
  assert.match(page,/mode==='complete'&&containerRequired&&\(!containerPhotos\.loaded\|\|!containerPhotos\.number\|\|!containerPhotos\.sealed\)/);
  assert.match(page,/colliOk=false;setDriverStepUnlocked\(false\)/);
  assert.match(page,/Bitte zuerst die Collis prüfen und bestätigen\. Die restlichen Schritte werden erst danach freigeschaltet/);
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
