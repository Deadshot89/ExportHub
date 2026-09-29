import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const immediate=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
const reminder=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const reminderApi=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const fixer=fs.readFileSync('.github/rc1018/fix-mail-wording.mjs','utf8');

test('RC1333: Kunden-Avis nutzt den nachweislich erreichbaren Produktionshost',()=>{
  assert.match(immediate,/RC1333_AVIS_ORIGIN='https:\/\/exporthub360\.com'/);
  assert.match(immediate,/rc1333SafeAvisUrl\(/);
  assert.match(immediate,/RC1333_AVIS_ORIGIN\+'\/avis\/'\+encodeURIComponent\(token\)/);
  assert.match(immediate,/rememberAvisUrl\(sh,rc1333SafeAvisUrl\(sh,url\)\)/);
});

test('RC1333: Server stellt neue AVIS-Links über die produktiven Azure-Hosts aus',()=>{
  assert.match(api,/PRODUCTION_AVIS_ORIGIN='https:\/\/wonderful-forest-0f315e310\.7\.azurestaticapps\.net'/);
  assert.match(api,/customer-avis\.html\?token=/);
  assert.match(api,/url\+'\?environment='\+encodeURIComponent\(env\)/);
});

test('RC1333: Avis-Erinnerung normalisiert bestehende Altlinks auf erreichbare Hosts',()=>{
  assert.match(reminder,/RC1333_AVIS_ORIGIN='https:\/\/exporthub360\.com'/);
  assert.match(reminder,/function safeAvisLink\(/);
  assert.match(reminder,/return safeAvisLink\(sh,direct\)/);
    assert.match(reminderApi,/environment.*testservice/);
});

test('RC1333: Browser laden den Safe-Origin-Hotfix mit neuem Cache-Key',()=>{
  assert.match(fixer,/rc1027-lieferavis-immediate\.js\?v=1333/);
  assert.match(build,/rc1166-avis-reminder-overview\.js\?v=1333/);
});
