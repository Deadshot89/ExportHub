import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('api/location-booking/index.js','utf8');

test('Location-API verwendet echte ExportHUB-Sitzungsprüfung statt bloßer Authorization-Header-Präsenz',()=>{
  assert.match(src,/require\(['"]\.\.\/shared\/auth-store['"]\)/,'auth-store muss für echte Sitzungsvalidierung eingebunden sein');
  assert.doesNotMatch(src,/function\s+appAuth\s*\([^)]*\)[\s\S]{0,500}authorization/i,'Authorization-Header-Präsenz darf keine interne Anmeldung darstellen');
  assert.match(src,/action===['"]list['"][\s\S]{0,350}await\s+auth\.validateSession\(req\)/,'Location-Liste muss eine echte ExportHUB-Sitzung validieren');
  assert.match(src,/action===['"]register['"][\s\S]{0,500}await\s+auth\.validateSession\(req\)/,'Location-Registrierung muss eine echte ExportHUB-Sitzung validieren');
});

test('Öffentlicher QR-Location-Lookup bleibt tokenbasiert, Änderungen benötigen Sitzung oder Verlader-PIN',()=>{
  assert.match(src,/action===['"]get['"]/,'öffentlicher get-Pfad fehlt');
  assert.doesNotMatch(src,/action===['"]get['"][\s\S]{0,250}auth\.validateSession/,'QR-Scan darf nicht durch internen Login blockiert werden');
  assert.match(src,/async\s+function\s+loader\s*\([^)]*\)[\s\S]{0,900}findByPin/,'öffentliche Lageraktion muss weiterhin persönlichen Verlader-PIN prüfen können');
  assert.match(src,/action===['"]move['"]/);
  assert.match(src,/action===['"]collect['"]/);
});
