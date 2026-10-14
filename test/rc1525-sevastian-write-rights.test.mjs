import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const policy = require('../api/shared/user-policy.js');
const secureMerge = require('../api/shared/secure-merge.js');
const writeContext = require('../api/shared/state-write-context.js');

function none(){
  return {level:'none',visible:false,read:false,edit:false,admin:false,functionAdmin:false};
}

function staleSevastian(){
  const rights={};
  for(const id of policy.MODULES) rights[id]=none();
  rights.start={level:'view',visible:true,read:true,edit:false,admin:false,functionAdmin:false};
  rights.dashboard={level:'view',visible:true,read:true,edit:false,admin:false,functionAdmin:false};
  return {
    id:'USER-Sevastian',
    user:'Sevastian',login:'Sevastian',username:'Sevastian',name:'Sevastian',
    role:'Export',permissions:[],active:true,disabled:false,rights
  };
}

function runAs(user,fn){
  return writeContext.run(()=>{
    writeContext.captureUser(user);
    return fn();
  });
}

test('RC1525: legacy Sevastian Export account regains operational edit rights without admin access',()=>{
  const user=policy.normalizeUser(staleSevastian(),0);
  for(const id of ['tasks','vacation','planning','shipment','abd','shipmentoverview','cmr','documents','pallet','customers','customerfolder','calculator','shippingcosts','customs','sop','academy','ideas','notifications','reports','teamfile','archive','pickupcalendar']){
    assert.equal(user.rights[id]?.edit,true,`${id} must be editable`);
  }
  for(const id of ['rights','update','settings','history']){
    assert.equal(user.rights[id]?.edit,false,`${id} must remain protected`);
  }
  assert.equal(user.globalAdmin,false);
  assert.deepEqual(user.permissions,[]);
  assert.equal(user.rightsRepairVersion,'RC1525');
});

test('RC1525: repaired Sevastian can persist a shipment through the server write guard',()=>{
  const user=policy.normalizeUser(staleSevastian(),0);
  const server={
    shipments:[{id:'S1',ref:'ABC123',status:'Erstellt',updatedAt:'2026-10-14T08:00:00.000Z'}],
    _teamSyncMeta:{fields:{shipments:{updatedAt:'2026-10-14T08:00:00.000Z'}},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.shipments[0]={...incoming.shipments[0],status:'Bereit zur Abholung',updatedAt:'2026-10-14T09:00:00.000Z'};
  incoming._teamSyncMeta.fields.shipments={updatedAt:'2026-10-14T09:00:00.000Z'};
  const merged=runAs(user,()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.shipments[0].status,'Bereit zur Abholung');
});

test('RC1525: repair is one-time and does not undo a later deliberate rights restriction',()=>{
  const source=staleSevastian();
  source.rightsRepairVersion='RC1525';
  const user=policy.normalizeUser(source,0);
  assert.equal(user.rights.shipment.edit,false);
  assert.equal(user.rights.tasks.edit,false);
});

test('RC1525: another Export user is not granted rights implicitly',()=>{
  const source=staleSevastian();
  source.id='USER-Other';
  source.user=source.login=source.username=source.name='Other Export';
  const user=policy.normalizeUser(source,0);
  assert.equal(user.rights.shipment.edit,false);
  assert.equal(user.rights.tasks.edit,false);
  assert.equal(user.rightsRepairVersion,undefined);
});
