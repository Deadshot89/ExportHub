import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('RC1525: persisted State user is repaired in place so the next team-state write stores the migration marker',()=>{
  assert.equal(typeof policy.repairLegacySevastianExportRights,'function');
  const stored=staleSevastian();
  const returned=policy.repairLegacySevastianExportRights(stored);
  assert.equal(returned,stored);
  assert.equal(stored.rights.shipment.edit,true);
  assert.equal(stored.rights.tasks.edit,true);
  assert.equal(stored.rightsRepairVersion,'RC1525');
});

test('RC1525: state runtime repairs the raw stored user before capture and permission evaluation',()=>{
  const runtime=fs.readFileSync(new URL('../api/exporthub-state/runtime.js',import.meta.url),'utf8');
  const repairCall='basePolicy.repairLegacySevastianExportRights(user)';
  const captureCall='writeContext.captureUser(user)';
  assert.match(runtime,/repairLegacySevastianExportRights\(user\)/);
  assert.ok(runtime.indexOf(repairCall)>=0,'state runtime must call the legacy rights repair');
  assert.ok(runtime.indexOf(repairCall)<runtime.indexOf(captureCall),'repair must happen before the user is captured for secure merge');
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
