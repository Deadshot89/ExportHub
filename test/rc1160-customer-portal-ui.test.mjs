import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const ui=fs.readFileSync('assets/rc1160-customer-portal-credentials.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1160: Kundenportal-Runtime und API sind syntaktisch gültig',()=>{
  for(const file of ['assets/rc1160-customer-portal-credentials.js','api/customer-portal-credentials/index.js','api/shared/customer-portal-store.js','api/shared/auth-store.js','api/shared/user-policy.js'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});
test('RC1160: Kundenportal-Runtime enthält keine RC1159-Versionsreste',()=>{
  assert.doesNotMatch(ui,/RC1159|rc1159|CustomerPortal1159/);
  assert.match(ui,/__EXPORTHUB_RC1160_CUSTOMER_PORTAL__/);
  assert.match(ui,/ExportHUBCustomerPortal1160/);
});
test('RC1267: Kundenportal-Rechte bleiben fachlich unverändert und sichtbare Texte laufen über i18n',()=>{
  assert.match(ui,/rights&&u\.rights\.customerPortal|u\.rights&&u\.rights\.customerPortal/);
  assert.match(ui,/r\.use===true\|\|r\.manage===true/);
  assert.match(ui,/r\.manage===true/);
  assert.match(ui,/tr\('portal\.rightsTitle'\)/);
  assert.match(ui,/th\('portal\.use'\)/);
  assert.match(ui,/th\('portal\.manage'\)/);
  assert.match(ui,/ExportHUBI18n/);
  assert.match(ui,/exporthub:language-changed/);
});
test('RC1160: Offenlegung verlangt Re-Auth und wird nach 60 Sekunden gelöscht',()=>{
  assert.match(ui,/autocomplete="current-password"/);
  assert.match(ui,/portalApi\('reveal'/);
  assert.match(ui,/input\.value=''/);
  assert.match(ui,/setTimeout\(clearRevealedSecrets,60000\)/);
  assert.match(ui,/pagehide/);
  assert.match(ui,/beforeunload/);
  assert.match(ui,/exporthub:viewchange/);
  assert.match(ui,/customer-changed/);
});
test('RC1160: Secrets werden nicht in Browser-Speicher geschrieben',()=>{
  assert.doesNotMatch(ui,/localStorage\.setItem/);
  assert.doesNotMatch(ui,/sessionStorage\.setItem/);
  assert.doesNotMatch(ui,/portalPassword\s*[:=]/i);
  assert.doesNotMatch(ui,/portalUsername\s*[:=]/i);
});
test('RC1160: Portalöffnung ist HTTPS und opener-isoliert',()=>{
  assert.match(ui,/\^https:\\\/\\\//);
  assert.match(ui,/noopener,noreferrer/);
  assert.match(ui,/win\.opener=null/);
});
test('RC1160: Runtime wird in alle drei Builds übernommen',()=>{
  assert.match(build,/exporthub-rc1160-customer-portal/);
  assert.match(build,/assets\/rc1160-customer-portal-credentials\.js\?v=1162/);
  assert.match(build,/'assets\/rc1160-customer-portal-credentials\.js'/);
  assert.match(build,/shared\/customer-portal-store\.js/);
  assert.match(build,/customer-portal-credentials\/index\.js/);
});

test('RC1267: Kundenportal verwendet zentrale Translation Keys statt deutscher UI-Literale',()=>{
  for(const key of [
    'portal.encryptionActive','portal.serverKeyMissing','portal.encryptionNotReady',
    'portal.noneConfigured','portal.showCredentials','portal.showTitle','portal.editTitle',
    'portal.addTitle','portal.title','portal.rightsTitle','portal.userRightsLoadFailed'
  ]) assert.match(ui,new RegExp(key.replace(/[.]/g,'\\.')));
  assert.match(ui,/common\.cancel/);
  assert.match(ui,/common\.close/);
  assert.match(ui,/common\.save/);
  assert.match(ui,/common\.active/);
  assert.match(ui,/common\.inactive/);
  assert.doesNotMatch(ui,/>Kundenportal-Rechte</);
  assert.doesNotMatch(ui,/>Zugangsdaten anzeigen</);
});
