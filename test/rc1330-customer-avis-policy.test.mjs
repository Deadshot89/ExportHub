import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const contacts=read('assets/rc1092-customer-mail-contacts.js');
const avis=read('assets/rc1015-lieferavis-mail-flow.js');

test('RC1330 Kundenordner steuert AVIS-Link dauerhaft selbst',()=>{
  assert.match(contacts,/data-rc1092-avis-toggle/);
  assert.match(contacts,/avisLinkEnabled/);
  assert.match(contacts,/customerAvisLinkEnabled/);
  assert.match(contacts,/async function setAvisAllowed/);
  assert.match(contacts,/Kundenordner aktiviert/);
  assert.match(contacts,/Kundenordner deaktiviert/);
  assert.match(contacts,/exporthub:customer-avis-policy-updated/);
});

test('RC1330 bekannte AVIS-Ausnahmen bleiben sichere Voreinstellung und sind danach manuell überschreibbar',()=>{
  assert.match(contacts,/3019100629/);
  assert.match(contacts,/v-zug@lebert\.com/);
  assert.match(contacts,/würth industrie/);
  assert.match(avis,/if\(explicit===true\)return null/);
  assert.match(avis,/if\(explicit===false\)return\{customer:shipmentCustomerName\(sh\),key:'customer-policy'/);
  assert.match(avis,/customer\.avisLinkEnabled===true\|\|customer\.customerAvisLinkEnabled===true/);
});

test('RC1330 AVIS-Policy wird im zentralen Lieferavis-Pfad erzwungen',()=>{
  assert.match(avis,/function rc1330AvisPolicyBlock/);
  assert.match(avis,/return rc1330AvisPolicyBlock\(sh\)/);
  assert.match(avis,/function rc1018Enabled\(sh\)/);
  assert.match(avis,/rc1018AvisException\(sh\)/);
  assert.match(avis,/function rc1021ShouldAutoEnable\(sh\)/);
  assert.match(avis,/rc1018AvisException\(sh\)/);
});

test('RC1330 AVIS-Einstellung ist in allen unterstützten Sprachen vorhanden',()=>{
  for(const lang of ['de','en','pl','es','fr','it']){
    const data=JSON.parse(read('assets/i18n/'+lang+'.json'));
    for(const key of [
      'customerContacts.avisHeading',
      'customerContacts.avisHelp',
      'customerContacts.avisWanted',
      'customerContacts.avisEnabled',
      'customerContacts.avisDisabled',
      'customerContacts.avisSaveFailed'
    ]) assert.equal(typeof data[key],'string',lang+': '+key+' fehlt');
  }
});
