import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {hardenCustomerSaveHtml, RC1600_PATCH_COUNT} from '../scripts/rc1600-customer-save-readback.mjs';

const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

test('RC1600: explicitly cleared carrier and customer aliases stay cleared after Azure merge',()=>{
  const old={id:'C-1600',name:'Sweden',account:'3019001',customerMail:'old@example.com',
    customerEmail:'old@example.com',mailToCustomer:'old@example.com',rc385CustomerTo:'old@example.com',
    email:'old@example.com',mailAddress:'old@example.com',mail:'old@example.com',
    carrierEmail:'carrier@example.com',carrierMail:'carrier@example.com',
    speditionEmail:'carrier@example.com',speditionMail:'carrier@example.com',
    anmeldungMail:'carrier@example.com',rc385CarrierTo:'carrier@example.com',
    mailRecipients:'carrier@example.com',updatedAt:'2026-10-14T08:00:00Z'};
  const cleared={...old,customerMail:'',customerEmail:'',mailToCustomer:'',rc385CustomerTo:'',
    email:'',mailAddress:'',mail:'',carrierEmail:'',carrierMail:'',
    speditionEmail:'',speditionMail:'',anmeldungMail:'',rc385CarrierTo:'',
    mailRecipients:'',updatedAt:'2026-10-14T09:00:00Z'};
  const next=mergeState({customers:[old]},{customers:[cleared]}).customers[0];
  for(const key of ['customerMail','customerEmail','mailToCustomer','rc385CustomerTo','email',
    'mailAddress','mail','carrierEmail','carrierMail','speditionEmail','speditionMail',
    'anmeldungMail','rc385CarrierTo','mailRecipients']){
    assert.equal(next[key],'',key+' darf nicht wiederhergestellt werden');
  }
});

test('RC1600: removing one CC address preserves the unrelated address after merge',()=>{
  const first={email:'old@example.com',name:'Old',role:'cc'};
  const second={email:'keep@example.com',name:'Keep',role:'cc'};
  const old={id:'C-1600',name:'Sweden',cc:'old@example.com; keep@example.com',
    mailCc:'old@example.com; keep@example.com',rc385Cc:'old@example.com; keep@example.com',
    ccContacts:[first,second],customerCcContacts:[first,second],
    updatedAt:'2026-10-14T08:00:00Z'};
  const incoming={...old,cc:'keep@example.com',mailCc:'keep@example.com',rc385Cc:'keep@example.com',
    ccContacts:[second],customerCcContacts:[second],updatedAt:'2026-10-14T09:00:00Z'};
  const out=mergeState({customers:[old]},{customers:[incoming]}).customers[0];
  assert.equal(out.cc,'keep@example.com');
  assert.deepEqual(out.ccContacts,[second]);
  assert.deepEqual(out.customerCcContacts,[second]);
});

test('RC1600: all seven customer-save patches apply exactly once and enable mandatory readback',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const hardened=hardenCustomerSaveHtml(html);
  assert.equal(RC1600_PATCH_COUNT,7);
  assert.ok(hardened.length>html.length);
  assert.match(hardened,/if\(ackOk&&!customerChanged\)return/);
  assert.match(hardened,/fastAck=serverAck[^;]*!newer&&/);
  assert.match(hardened,/const confirmed=\(Array\.isArray\(stateDelta\.customers\)/);
  assert.match(hardened,/function clearRemovedMailAliases\(/);
  assert.match(hardened,/if\(ccEdited\)\{var permittedCc/);
  assert.throws(()=>hardenCustomerSaveHtml(hardened),/expected one source anchor/);
});

test('RC1600: RC1112 build uses hardened customer save flow for all environments',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/hardenCustomerSaveHtml\(fs\.readFileSync\(target,'utf8'\)\)/);
  assert.match(build,/for\(const file of \['index.html','TESTVERSION.html','demo.html'\]\)/);
});
