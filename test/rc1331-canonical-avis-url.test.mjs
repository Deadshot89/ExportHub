import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const immediate=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
const reminder=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const reminderApi=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const fixer=fs.readFileSync('.github/rc1018/fix-mail-wording.mjs','utf8');

test('RC1360: Kunden-Avis zeigt ausschließlich den gebrandeten ExportHUB360-Produktionslink',()=>{
  assert.match(immediate,/RC1333_PROD_AVIS_ORIGIN='https:\/\/www\.exporthub360\.de'/);
  assert.match(immediate,/RC1333_PROD_AVIS_ORIGIN\+'\/avis\/'\+encodeURIComponent\(token\)/);
  assert.match(immediate,/rc1333SafeAvisUrl\(/);
  assert.match(immediate,/rememberAvisUrl\(sh,rc1333SafeAvisUrl\(sh,url\)\)/);
});

test('RC1360: Server stellt neue Produktions-AVIS-Links über ExportHUB360 aus',()=>{
  assert.match(api,/PRODUCTION_AVIS_ORIGIN='https:\/\/www\.exporthub360\.de'/);
  assert.match(api,/PRODUCTION_AVIS_ORIGIN\+'\/avis\/'\+encoded/);
  assert.match(api,/TESTSERVICE_AVIS_ORIGIN\+'\/customer-avis\.html\?token='\+encoded/);
});

test('RC1360: Avis-Erinnerung normalisiert bestehende Altlinks auf ExportHUB360',()=>{
  assert.match(reminder,/RC1333_PROD_AVIS_ORIGIN='https:\/\/www\.exporthub360\.de'/);
  assert.match(reminder,/RC1333_PROD_AVIS_ORIGIN\+'\/avis\/'\+encodeURIComponent\(token\)/);
  assert.match(reminder,/function safeAvisLink\(/);
  assert.match(reminder,/return safeAvisLink\(sh,direct\)/);
  assert.match(reminderApi,/environment.*testservice/);
});


test('RC1365: Client-Sicherheitsprüfung akzeptiert neuen und bestehenden Markenhost',()=>{
  assert.match(immediate,/h==='www\.exporthub360\.de'/);
  assert.match(immediate,/h==='www\.exporthub360\.de'/);
  assert.match(immediate,/RC1333_PROD_AVIS_ORIGIN='https:\/\/www\.exporthub360\.de'/);
});
test('RC1333: Browser laden den Safe-Origin-Hotfix mit neuem Cache-Key',()=>{
  assert.match(fixer,/rc1027-lieferavis-immediate\.js\?v=20261005/);
  assert.match(build,/rc1166-avis-reminder-overview\.js\?v=20261005-outlook/);
});

test('RC1420: neue Produktions-AVIS-Links bleiben verbindlich auf exporthub360.de',()=>{
  const canonical=/https:\/\/www\.exporthub360\.de/;
  const wrongCanonical=/PROD(?:UCTION)?_AVIS_ORIGIN='https:\/\/(?:www\.)?exporthub360\.com'/;
  assert.match(immediate,canonical,'Client muss neue Produktions-AVIS-Links auf exporthub360.de erzeugen');
  assert.match(api,canonical,'Server muss neue Produktions-AVIS-Links auf exporthub360.de erzeugen');
  assert.match(reminder,canonical,'Erinnerungslogik muss Produktions-AVIS-Links auf exporthub360.de normalisieren');
  assert.doesNotMatch(immediate,wrongCanonical,'Client darf .com nicht als kanonischen Produktions-Host setzen');
  assert.doesNotMatch(api,wrongCanonical,'Server darf .com nicht als kanonischen Produktions-Host setzen');
  assert.doesNotMatch(reminder,wrongCanonical,'Erinnerungslogik darf .com nicht als kanonischen Produktions-Host setzen');
});
