import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const policy = require('../api/shared/user-policy.js');

function expected(level){
  return {
    level,
    visible: level !== 'none',
    read: level !== 'none',
    edit: level === 'edit' || level === 'admin',
    admin: level === 'admin',
    functionAdmin: level === 'admin'
  };
}

test('RC1489: zentrale Rechte-Matrix enthält jedes eigenständig geprüfte Modul',()=>{
  assert.ok(policy.MODULES.includes('shippingcosts'),'shippingcosts fehlt in der zentralen MODULES-Liste');
  assert.equal(new Set(policy.MODULES).size,policy.MODULES.length,'MODULES enthält doppelte Einträge');
});

test('RC1489: none/view/edit/admin werden für jedes Modul kanonisch normalisiert',()=>{
  for(const moduleId of policy.MODULES){
    for(const level of ['none','view','edit','admin']){
      const rights=policy.normalizeRights({[moduleId]:{level}},false);
      assert.deepEqual(rights[moduleId],expected(level),`${moduleId}:${level}`);
    }
  }
});

test('RC1489: view darf niemals implizite Schreib- oder Adminrechte erzeugen',()=>{
  for(const moduleId of policy.MODULES){
    const user=policy.normalizeUser({
      user:`Viewer-${moduleId}`,
      role:'Benutzer',
      permissions:[],
      rights:{[moduleId]:{level:'view',edit:true,admin:true,functionAdmin:true}}
    },0);
    assert.equal(user.globalAdmin,false,moduleId);
    assert.ok(!user.permissions.includes('*'),moduleId);
    assert.deepEqual(user.rights[moduleId],expected('view'),moduleId);
  }
});

test('RC1489: Versandkosten-Editrecht bleibt bei Benutzer-Normalisierung erhalten',()=>{
  const user=policy.normalizeUser({
    user:'Shipping Cost Editor',
    role:'Benutzer',
    permissions:[],
    rights:{shippingcosts:{level:'edit'}}
  },0);
  assert.equal(user.globalAdmin,false);
  assert.ok(!user.permissions.includes('*'));
  assert.deepEqual(user.rights.shippingcosts,expected('edit'));
});

test('RC1489: Standard-Nicht-Admin bekommt nur die vorgesehenen Leserechte',()=>{
  const user=policy.normalizeUser({user:'Standard',role:'Benutzer',permissions:[],rights:{}},0);
  for(const moduleId of policy.MODULES){
    const level=['start','dashboard','pickupcalendar'].includes(moduleId)?'view':'none';
    assert.deepEqual(user.rights[moduleId],expected(level),moduleId);
  }
});

test('RC1489: Kundenportal-Rechte bleiben getrennt von der Modulmatrix',()=>{
  const useOnly=policy.normalizeUser({user:'Portal',rights:{customerPortal:{use:true}}},0);
  assert.deepEqual(useOnly.rights.customerPortal,{use:true,manage:false});
  const manage=policy.normalizeUser({user:'PortalAdmin',rights:{customerPortal:{manage:true}}},0);
  assert.deepEqual(manage.rights.customerPortal,{use:true,manage:true});
});
