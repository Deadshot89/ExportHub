import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const guard=require('../api/shared/state-write-guard.js');

function sample(){
  return {
    packNotifications:[{id:'PN-1',reference:'PK-1',status:'new',customer:'Customer A',
      documents:[{storage:'blob',blobName:'protected-original.pdf'}]}],
    abdRequests:[]
  };
}
const abdUser={id:'ABD-ONLY-USER',rights:{abd:{edit:true},tasks:{read:true}}};
const submitted={id:'ABD-1',ref:'A1B2C3',packNotificationId:'PN-1',
  packNotificationRef:'PK-1',source:'manual',customerName:'Customer A',linkedShipmentId:'',
  status:'Entwurf',rows:[{id:'C-1',type:'Euro Palette',count:'1',weight:'680'}]};

test('RC1382: ABD-only role can persist owned ABD without tasks edit right',()=>{
  const before=sample(),incoming=structuredClone(before);
  incoming.abdRequests.push(structuredClone(submitted));
  assert.equal(guard.canEditModule(abdUser,'abd'),true);
  assert.equal(guard.canEditModule(abdUser,'tasks'),false);
  assert.equal(guard.assertMergedStateWriteAllowed(before,incoming,incoming,abdUser),true);
  assert.deepEqual(incoming.packNotifications,before.packNotifications);
});

test('RC1382: ABD edit right cannot change a Pack notification or replace its original PDF',()=>{
  const before=sample(),incoming=structuredClone(before);
  incoming.abdRequests.push(structuredClone(submitted));
  incoming.packNotifications[0].documents[0].blobName='foreign-blob.pdf';
  assert.throws(()=>guard.assertMergedStateWriteAllowed(before,incoming,incoming,abdUser),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.vars?.key==='packNotifications');
});

test('RC1382: read-only ABD role cannot persist ABD requests',()=>{
  const before=sample(),incoming=structuredClone(before);
  incoming.abdRequests.push(structuredClone(submitted));
  const readonly={id:'READONLY',rights:{abd:{read:true},tasks:{read:true}}};
  assert.throws(()=>guard.assertMergedStateWriteAllowed(before,incoming,incoming,readonly),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.vars?.key==='abdRequests');
});
