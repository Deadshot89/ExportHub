import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {CLEANUP_DATE,countPalletDay,cleanupPalletDay}=require('../api/shared/pallet-account-cleanup.js');
const API='api/state-maintenance/index.js';
const WF='.github/workflows/rc1137-state-compaction.yml';

test('RC1208: Produktionsbereinigung entfernt ausschließlich Palettenbuchungen vom 21.09.2026',()=>{
 const team={schemaVersion:3,revision:7,state:{
  palletAccount:[
   {id:'IN-1',date:'2026-09-21',direction:'Eingang',count:3},
   {id:'OUT-1',createdAt:'2026-09-21T08:10:00.000Z',direction:'Ausgang',count:2},
   {id:'OLD-1',date:'2026-09-20',direction:'Eingang',count:4}
  ],
  palletSettlements:[{id:'S1',status:'confirmed',bookingIds:['IN-1','OLD-1'],adjustmentBookingId:'OUT-1'}],
  auditLog:[]
 }};
 const result=cleanupPalletDay(team,{at:'2026-09-21T12:00:00.000Z',actor:'RC1208 Test'});
 assert.equal(result.changed,true);
 assert.equal(result.deletedCount,2);
 assert.equal(result.remaining,0);
 assert.equal(countPalletDay(result.team,CLEANUP_DATE),0);
 assert.deepEqual(result.team.state.palletAccount.map(x=>x.id),['OLD-1']);
 assert.equal(result.team.state._teamSyncMeta.tombstones.filter(x=>x.collection==='palletAccount').length,2);
 assert.deepEqual(result.team.state.palletSettlements[0].bookingIds,['OLD-1']);
 assert.equal(result.team.state.palletSettlements[0].status,'Storniert');
 assert.equal(result.team.state.rc1207PalletCleanup20260921At.date,CLEANUP_DATE);
 assert.equal(result.team.state.rc1207PalletCleanup20260921At.deletedCount,2);
 assert.equal(result.team.revision,8);
 assert.equal(result.team.clientVersion,'RC1208-pallet-cleanup');
 assert.equal(team.state.palletAccount.length,3,'Eingangsdokument darf nicht mutiert werden');
});

test('RC1208: bereits bereinigter State bleibt idempotent',()=>{
 const team={schemaVersion:3,revision:8,state:{palletAccount:[{id:'OLD',date:'2026-09-20'}],rc1207PalletCleanup20260921At:{at:'2026-09-21T12:00:00.000Z',date:CLEANUP_DATE,deletedCount:2}}};
 const result=cleanupPalletDay(team,{at:'2026-09-21T13:00:00.000Z'});
 assert.equal(result.changed,false);
 assert.equal(result.remaining,0);
 assert.equal(result.team.revision,8);
});

test('RC1208: Maintenance API ist production-only, erstellt Backup und verifiziert remaining=0',()=>{
 const api=fs.readFileSync(API,'utf8');
 assert.match(api,/cleanup-pallet-20260921/);
 assert.match(api,/PRODUCTION_ONLY/);
 assert.match(api,/createVerifiedBackup\(/);
 assert.match(api,/countPalletDay\(/);
 assert.match(api,/PALLET_CLEANUP_VERIFY_FAILED/);
 assert.match(api,/backupVerified:true/);
});

test('RC1208: Produktions-Wartungsworkflow führt Cleanup aus und fordert remaining=0',()=>{
 const wf=fs.readFileSync(WF,'utf8');
 const prod=wf.slice(wf.indexOf('PRODUCTION State kompaktieren'));
 assert.match(prod,/cleanup-pallet-20260921/);
 assert.match(prod,/RC1208 Palettenkonto/);
 assert.match(prod,/Number\(v\.remaining\|\|0\)!==0/);
 assert.match(prod,/v\.verified!==true/);
});
