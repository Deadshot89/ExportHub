import test from 'node:test';
import assert from 'node:assert/strict';
import policy from '../api/shared/user-policy.js';

test('RC1160: Kundenportal-Rechte sind eigenständig und standardmäßig gesperrt',()=>{
  const normal=policy.normalizeUser({user:'Normal',rights:{}},0);
  assert.deepEqual(normal.rights.customerPortal,{use:false,manage:false});
  const use=policy.normalizeUser({user:'Use',rights:{customerPortal:{use:true}}},0);
  assert.deepEqual(use.rights.customerPortal,{use:true,manage:false});
  const manage=policy.normalizeUser({user:'Manage',rights:{customerPortal:{manage:true}}},0);
  assert.deepEqual(manage.rights.customerPortal,{use:true,manage:true});
});
test('RC1160: Global Admin besitzt Kundenportal verwenden und verwalten automatisch',()=>{
  const admin=policy.normalizeUser({user:'Admin',globalAdmin:true},0);
  assert.equal(admin.rights.customerPortal.use,true);
  assert.equal(admin.rights.customerPortal.manage,true);
});
test('RC1160: customerPortal ist kein Navigationsmodul',()=>{
  assert.equal(policy.MODULES.includes('customerPortal'),false);
});
