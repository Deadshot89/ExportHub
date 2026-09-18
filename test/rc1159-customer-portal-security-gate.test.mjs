import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=[
  'assets/rc1159-customer-portal-credentials.js',
  'api/customer-portal-credentials/index.js',
  'api/shared/customer-portal-store.js',
  '.github/rc1112/build-three-env.mjs'
];
const joined=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');

test('RC1159 Security Gate: keine fest verdrahteten Portal-Secrets',()=>{
  assert.doesNotMatch(joined,/SECRET-(?:USER|PASS)-RC1159/);
  assert.doesNotMatch(joined,/EXPORTHUB_CUSTOMER_PORTAL_KEY\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i);
  assert.doesNotMatch(fs.readFileSync('assets/rc1159-customer-portal-credentials.js','utf8'),/password\s*:\s*['"][^'"]{3,}['"]/i);
});
test('RC1159 Security Gate: Team-State erhält keine Portal-Credentials',()=>{
  const state=fs.readFileSync('api/exporthub-state/index.js','utf8');
  assert.doesNotMatch(state,/portalCredentials|portalPassword|portalUsername/);
});
test('RC1159 Security Gate: Verschlüsselung ist AES-256-GCM und Schlüssel bleibt serverseitig',()=>{
  const store=fs.readFileSync('api/shared/customer-portal-store.js','utf8');
  assert.match(store,/aes-256-gcm/);
  assert.match(store,/crypto\.randomBytes\(12\)/);
  assert.match(store,/EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.match(store,/createHash\('sha256'\)\.update\('ExportHUB\/customer-portal\/v1\|'/);
  assert.doesNotMatch(fs.readFileSync('assets/rc1159-customer-portal-credentials.js','utf8'),/EXPORTHUB_CUSTOMER_PORTAL_KEY/);
});
test('RC1159 Security Gate: Beispielkonfiguration enthält nur Platzhalter',()=>{
  const cfg=JSON.parse(fs.readFileSync('api/local.settings.example.json','utf8'));
  assert.match(cfg.Values.EXPORTHUB_CUSTOMER_PORTAL_KEY,/Azure-App-Settings/);
  assert.equal(cfg.Values.EXPORTHUB_CUSTOMER_PORTAL_BLOB,'customer-portal-credentials.json');
});
