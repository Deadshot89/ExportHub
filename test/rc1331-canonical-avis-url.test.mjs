import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const immediate=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
const reminder=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const reminderApi=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const fixer=fs.readFileSync('.github/rc1018/fix-mail-wording.mjs','utf8');

test('RC1331: Kunden-Avis nutzt immer die kanonische ExportHUB360-Domain',()=>{
  assert.match(immediate,/RC1331_AVIS_ORIGIN='https:\/\/exporthub360\.com'/);
  assert.match(immediate,/rc1331CanonicalAvisUrl\(/);
  assert.match(immediate,/RC1331_AVIS_ORIGIN\+'\/avis\/'\+encodeURIComponent\(token\)/);
  assert.match(immediate,/rememberAvisUrl\(sh,rc1331CanonicalAvisUrl\(sh,url\)\)/);
});

test('RC1331: Server stellt neue AVIS-Links in allen Umgebungen über ExportHUB360 aus',()=>{
  assert.match(api,/PRODUCTION_AVIS_ORIGIN.*https:\/\/exporthub360\.com/);
  assert.match(api,/url=PRODUCTION_AVIS_ORIGIN\+'\/avis\/'\+encoded/);
  assert.match(api,/url\+'\?environment='\+encodeURIComponent\(env\)/);
});

test('RC1331: Avis-Erinnerung normalisiert bestehende Altlinks ebenfalls',()=>{
  assert.match(reminder,/RC1331_AVIS_ORIGIN='https:\/\/exporthub360\.com'/);
  assert.match(reminder,/function canonicalAvisLink\(/);
  assert.match(reminder,/return canonicalAvisLink\(sh,direct\)/);
  assert.match(reminderApi,/exporthub360\.com/);
  assert.match(reminderApi,/environment.*testservice/);
});

test('RC1331: Browser laden die aktualisierten Avis-Runtimes mit neuem Cache-Key',()=>{
  assert.match(fixer,/rc1027-lieferavis-immediate\.js\?v=1331/);
  assert.match(build,/rc1166-avis-reminder-overview\.js\?v=1331/);
});
