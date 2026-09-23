import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1207-pallet-account-fix.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function classList(active=false){
  const set=new Set(active?['active']:[]);
  return {contains:x=>set.has(x),toggle:(x,on)=>on?set.add(x):set.delete(x),has:x=>set.has(x)};
}
function makeRoot(extra={}){
  const state=extra.state||{palletAccount:[],palletSettlements:[],auditLog:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const inClass=classList(true),outClass=classList(false);
  const doc={
    readyState:'loading',body:null,documentElement:null,
    addEventListener(){},
    getElementById(id){if(id==='rc542PalIn')return{classList:inClass};if(id==='rc542PalOut')return{classList:outClass};return null},
    querySelectorAll(){return[]},
    createElement(){return{setAttribute(){},addEventListener(){},classList:classList(false)}}
  };
  const calls=[];
  const root={
    __EXPORTHUB_FORCED_ENVIRONMENT__:extra.environment||'production',
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>({name:'Admin Test'}),
    ExportHUBClean:{queueSave:r=>{calls.push(['queue',r]);return true},flushSave:r=>{calls.push(['flush',r]);return true}},
    canAdmin:()=>extra.admin!==false,confirm:()=>true,alert(){},document:doc,location:{hostname:'prod.test',pathname:'/'},
    addEventListener(){},setTimeout(){return 1},clearTimeout(){},console:{error(){}},
    rc542RenderPallet(){return false},rc542AddPalletBooking(){return state.rc542PalDirection}
  };
  Object.assign(root,extra.root||{});
  const sandbox={globalThis:root,setTimeout:root.setTimeout,clearTimeout:root.clearTimeout,console:root.console};
  vm.runInNewContext(runtime,sandbox);
  return {root,state,calls,inClass,outClass,api:root.ExportHUBRC1207PalletFix};
}

test('RC1207: sichtbare Richtung wird vor dem Speichern verbindlich übernommen',()=>{
  const x=makeRoot();
  x.state.rc542PalDirection='Ausgang';
  x.api.syncDirectionUi();
  assert.equal(x.outClass.has('active'),true);
  x.outClass.toggle('active',false);x.inClass.toggle('active',true);
  assert.equal(x.api.installBookingGuard(),true);
  assert.equal(x.root.rc542AddPalletBooking(),'Eingang');
  assert.equal(x.state.rc542PalDirection,'Eingang');
});

test('RC1207: Admin-Löschung entfernt Buchung mit Tombstone und Audit',async()=>{
  const x=makeRoot({state:{
    palletAccount:[{id:'PAL-1',date:'2026-09-20',direction:'Eingang',count:3,partyName:'Kunde A'}],
    palletSettlements:[],auditLog:[],_teamSyncMeta:{fields:{},tombstones:[]}
  }});
  assert.equal(await x.api.deletePalletBooking('PAL-1',{skipConfirm:true}),true);
  assert.equal(x.state.palletAccount.length,0);
  assert.equal(x.state._teamSyncMeta.tombstones.some(t=>t.collection==='palletAccount'&&t.id==='PAL-1'),true);
  assert.equal(x.state.auditLog.some(a=>a.type==='PALLET_BOOKING_DELETED'),true);
  assert.equal(x.calls.some(c=>c[0]==='flush'),true);
});

test('RC1207: Produktion löscht alle Palettenbuchungen vom 21.09.2026 genau einmal',async()=>{
  const x=makeRoot({state:{
    palletAccount:[
      {id:'PAL-A',date:'2026-09-21',direction:'Eingang',count:2},
      {id:'PAL-B',createdAt:'2026-09-21T09:00:00.000Z',direction:'Ausgang',count:1},
      {id:'PAL-OLD',date:'2026-09-20',direction:'Eingang',count:7}
    ],
    palletSettlements:[{id:'SET-1',status:'Confirmed',adjustmentBookingId:'PAL-B',bookingIds:['PAL-A','PAL-B']}],
    auditLog:[],_teamSyncMeta:{fields:{},tombstones:[]}
  }});
  assert.equal(await x.api.cleanupProductionDayOnce(),true);
  assert.deepEqual(Array.from(x.state.palletAccount,x=>x.id),['PAL-OLD']);
  assert.equal(x.state._teamSyncMeta.tombstones.filter(t=>t.collection==='palletAccount').length,2);
  assert.equal(x.state.palletSettlements[0].status,'Storniert');
  assert.equal(x.state.rc1207PalletCleanup20260921At.deletedCount,2);
  assert.equal(await x.api.cleanupProductionDayOnce(),false);
});

test('RC1207: Testservice/Demo führen den Produktions-Cleanup nicht aus',async()=>{
  const x=makeRoot({environment:'testservice',state:{palletAccount:[{id:'PAL-A',date:'2026-09-21'}],palletSettlements:[],auditLog:[],_teamSyncMeta:{fields:{},tombstones:[]}}});
  assert.equal(await x.api.cleanupProductionDayOnce(),false);
  assert.equal(x.state.palletAccount.length,1);
});

test('RC1207: Build liefert Runtime in Produktion, TESTSERVICE und Demo aus',()=>{
  assert.match(build,/assets\/rc1207-pallet-account-fix\.js\?v=1246/);
  assert.match(build,/RC1207 Palettenkonto-Runtime fehlt/);
  assert.match(build,/palletAccountDirectionAndAdminDelete:'RC1207/);
});
