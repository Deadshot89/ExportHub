import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('api/customer-portal-credentials/index.js','utf8');
const authSource=fs.readFileSync('api/shared/auth-store.js','utf8');
const functionJson=JSON.parse(fs.readFileSync('api/customer-portal-credentials/function.json','utf8'));

test('RC1159: API-Rechte trennen verwenden und verwalten',()=>{
  assert.match(source,/if\(auth\.isAdmin\(user\)\)return\{use:true,manage:true\}/);
  assert.match(source,/use:r\.use===true\|\|r\.manage===true/);
  assert.match(source,/manage:r\.manage===true/);
  assert.match(source,/CUSTOMER_PORTAL_USE_REQUIRED/);
  assert.match(source,/CUSTOMER_PORTAL_MANAGE_REQUIRED/);
});
test('RC1159: Portal-API verlangt gültige Sitzung und persönliche Re-Authentifizierung',()=>{
  assert.match(source,/auth\.validateSession\(req\)/);
  assert.match(source,/auth\.credentialOf\(current\.user\)/);
  assert.match(source,/auth\.verifyCredential\(password,credential\)/);
  assert.match(source,/REAUTH_FAILED/);
  assert.match(source,/Das ExportHUB-Passwort ist nicht korrekt\./);
});
test('RC1159: Reveal-Audit enthält keine Credentials',()=>{
  assert.match(source,/CUSTOMER_PORTAL_REVEALED/);
  assert.match(source,/CUSTOMER_PORTAL_REVEAL_DENIED/);
  assert.doesNotMatch(source,/CUSTOMER_PORTAL_REVEALED[^\n]+username/i);
  assert.doesNotMatch(source,/CUSTOMER_PORTAL_REVEALED[^\n]+password/i);
  assert.match(authSource,/for \(const key of Object\.keys\(clean\)\) if \(\/pass\|secret\|token\|hash\|salt\/i\.test\(key\)\) delete clean\[key\]/);
});
test('RC1159: Kundenbindung ist serverseitig und die API ist no-store',()=>{
  assert.match(source,/function customerExists\(team,customerId\)/);
  assert.match(source,/ensureCustomer\(current,payload\.customerId\)/);
  assert.match(source,/CUSTOMER_NOT_FOUND/);
  assert.match(source,/Cache-Control':'no-store, no-cache, must-revalidate'/);
});
test('RC1159: Azure Function erlaubt ausschließlich POST und OPTIONS',()=>{
  const trigger=functionJson.bindings.find(x=>x.type==='httpTrigger');
  assert.deepEqual(trigger.methods,['post','options']);
  assert.equal(trigger.route,'customer-portal-credentials');
});
test('RC1159: Testservice-Audit kann nicht in Produktions-Team-State schreiben',()=>{
  assert.match(authSource,/function environmentFromRequest\(req\)/);
  assert.match(authSource,/mutateTeamForRequest/);
  assert.match(authSource,/clientsForEnvironment/);
});
