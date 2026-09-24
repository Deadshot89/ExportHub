import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import store from '../api/shared/customer-portal-store.js';

const api=fs.readFileSync('api/customer-portal-credentials/index.js','utf8');
const ui=fs.readFileSync('assets/rc1160-customer-portal-credentials.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1162: Schlüsselstatus liefert nur boolean und niemals den Schlüssel',()=>{
  const before=process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY;
  try{
    delete process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY;
    assert.equal(store.keyConfigured(),false);
    process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY='RC1162-test-secret-never-returned';
    assert.equal(store.keyConfigured(),true);
  } finally {
    if(before===undefined)delete process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY;
    else process.env.EXPORTHUB_CUSTOMER_PORTAL_KEY=before;
  }
  assert.match(api,/configured:store\.keyConfigured\(\)/);
  assert.doesNotMatch(api,/configured:process\.env\.EXPORTHUB_CUSTOMER_PORTAL_KEY/);
});

test('RC1162: Statusprüfung benötigt keinen Kunden und bleibt hinter Nutzungsrecht',()=>{
  assert.match(api,/ensureUse\(r\)/);
  const statusPos=api.indexOf("if(action==='status')");
  const customerPos=api.indexOf('const customerId=ensureCustomer');
  assert.ok(statusPos>0&&customerPos>statusPos,'Status muss vor der Kundenpflicht beantwortet werden');
  assert.match(api,/version:'RC1162'/);
});

test('RC1267: UI zeigt lokalisierte Betriebsbereitschaft und blockiert Secret-Aktionen ohne Schlüssel',()=>{
  assert.match(ui,/portalApi\('status',\{\}\)/);
  assert.match(ui,/portal\.encryptionActive/);
  assert.match(ui,/portal\.serverKeyMissing/);
  assert.match(ui,/portal\.encryptionNotReady/);
  assert.match(ui,/data-rc1162-key-warning/);
  assert.match(ui,/add\.disabled=ready\.configured!==true/);
  assert.match(ui,/readinessVersion:'RC1162'/);
});

test('RC1267: Readiness-Hinweis unterscheidet Admin und Nutzer über Translation Keys',()=>{
  const fn=ui.slice(ui.indexOf('function readinessHint'),ui.indexOf('function portalRows'));
  assert.match(fn,/adminView\?/);
  assert.doesNotMatch(fn,/EXPORTHUB_CUSTOMER_PORTAL_KEY/);
  assert.match(fn,/portal\.adminKeyWarning/);
  assert.match(fn,/portal\.userKeyWarning/);
});

test('RC1162: finaler Build erzwingt neuen Kundenportal-Cache ohne Deckblatt-Regression',()=>{
  assert.match(build,/assets\/rc1160-customer-portal-credentials\.js\?v=1162/);
  assert.match(build,/customerPortalReadiness:'RC1162 safe key-status \+ UI readiness guard'/);
  assert.match(build,/border:3mm solid #111827/);
});
