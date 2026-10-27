import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const auth=require('../api/shared/auth-store.js');
const guard=require('../api/shared/state-write-guard.js');
function employee(right){return {active:true,role:'Benutzer',rights:{shipment:right}}}

test('RC1693: manual-auth edit-right precheck matches the authoritative shipment-module guard',()=>{
  for(const right of [{access:'edit'},{level:'EDIT'},{edit:true},{functionAdmin:true}]){
    const user=employee(right);
    assert.equal(guard.canEditModule(user,'shipment'),true);
    assert.equal(auth.hasAnyEditRight(user),true);
  }
});

test('RC1693: view-only, denied and inactive edit flags never grant write access',()=>{
  for(const right of [{access:'view'},{level:'VIEW'},{edit:false},{admin:false}]){
    const user=employee(right);
    assert.equal(guard.canEditModule(user,'shipment'),false);
    assert.equal(auth.hasAnyEditRight(user),false);
  }
});
