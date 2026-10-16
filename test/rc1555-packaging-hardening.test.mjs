import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

function loadStore(){
  delete require.cache[require.resolve('../api/shared/packaging-admin-store.js')];
  return require('../api/shared/packaging-admin-store.js');
}
function legacyState(){
  return {
    colliTypes:[{id:'CT1',name:'Euro Palette',code:'EUR',l:120,w:80,h:145,createdAt:'2026-01-01T00:00:00.000Z',createdBy:'Alt'}],
    inactiveColliTypes:[{id:'CT2',name:'Alte Kiste',code:'OLD',l:40,w:30,h:20,createdAt:'2026-01-02T00:00:00.000Z',createdBy:'Alt'}],
    disabledPackagingAliases:[],
    shipments:[],packNotifications:[],packDrafts:[],tasks:[],archive:[],archivedShipments:[]
  };
}

test('RC1555 migrates legacy packaging into one canonical packagingTypes collection and keeps compatibility projections',()=>{
  const store=loadStore(),state=legacyState();
  const list=store.listPackaging(state);
  assert.equal(Array.isArray(state.packagingTypes),true,'canonical state.packagingTypes must be created on first access');
  assert.ok(state.packagingTypes.length>=2);
  assert.equal(list.find(x=>x.id==='CT1').active,true);
  assert.equal(list.find(x=>x.id==='CT2').active,false);
  const created=store.createPackaging(state,{name:'Neue Kiste',code:'NEW'},'Admin','2026-10-16T16:45:00.000Z');
  assert.equal(created.state.packagingTypes.some(x=>x.name==='Neue Kiste'),true);
  assert.equal(created.state.colliTypes.some(x=>x.name==='Neue Kiste'),true,'legacy active projection must stay compatible during cutover');
});

test('RC1555 server migration seeds canonical packaging defaults and protects E3 from stale legacy dimensions',()=>{
  const store=loadStore(),state={colliTypes:[{id:'OLD-E3',name:'E3',l:60,w:40,h:22,ldm:0.2}],inactiveColliTypes:[],disabledPackagingAliases:[]};
  const list=store.listPackaging(state),names=new Set(list.map(x=>x.name));
  for(const name of ['Düsseldorfer Palette','Kunststoffpalette','Industrie Palette','Palettengestell','Euro Palette','Einwegpalette','E3'])assert.ok(names.has(name),`${name} missing from canonical seed migration`);
  const e3=list.find(x=>x.name==='E3');
  assert.equal(e3.l,43);assert.equal(e3.w,31);assert.equal(e3.h,31);assert.equal(e3.ldm,0.06);
});

test('RC1555 public pack metadata endpoint returns active canonical packaging, not only disabled names',()=>{
  const source=fs.readFileSync('api/packaging-public-state/index.js','utf8');
  assert.match(source,/packaging-admin-store/,'public station endpoint must consume canonical packaging domain');
  assert.match(source,/const\s+packaging\s*=\s*publicPackaging\(state\)/,'public station endpoint must materialize canonical active packaging');
  assert.match(source,/context\.res=json\(200,\{ok:true,packaging,/,'public station response must include active canonical packaging records');
});

test('RC1555 enforces case-insensitive unique packaging codes across active and inactive records',()=>{
  const store=loadStore(),state=legacyState();
  assert.throws(()=>store.createPackaging(state,{name:'Andere Palette',code:' eur '},'Admin','2026-10-16T16:46:00.000Z'),e=>e&&e.code==='PACKAGING_CODE_EXISTS');
  assert.throws(()=>store.createPackaging(state,{name:'Andere Kiste',code:'old'},'Admin','2026-10-16T16:46:00.000Z'),e=>e&&e.code==='PACKAGING_CODE_EXISTS');
});

test('RC1555 mutations expose immutable before and after payloads for audit evidence',()=>{
  const store=loadStore(),state=legacyState();
  const updated=store.updatePackaging(state,'CT1',{name:'Euro Palette Neu',code:'EUR2'},'Admin','2026-10-16T16:47:00.000Z');
  assert.equal(updated.before.name,'Euro Palette');
  assert.equal(updated.after.name,'Euro Palette Neu');
  assert.notStrictEqual(updated.before,updated.after);
  const deactivated=store.setPackagingActive(updated.state,'CT1',false,'Admin','2026-10-16T16:48:00.000Z');
  assert.equal(deactivated.before.active,true);
  assert.equal(deactivated.after.active,false);
});

test('RC1555 packaging API audit persists before and after snapshots',()=>{
  const api=fs.readFileSync('api/packaging-admin/index.js','utf8');
  assert.match(api,/before\s*:/,'audit payload must persist before snapshot');
  assert.match(api,/after\s*:/,'audit payload must persist after snapshot');
});

test('RC1555 historical snapshot helper returns id plus immutable packaging fields',()=>{
  const store=loadStore();
  assert.equal(typeof store.snapshotPackaging,'function');
  const snap=store.snapshotPackaging({id:'CT1',name:'Euro Palette',code:'EUR',description:'Test',l:120,w:80,h:145,ldm:0.4});
  assert.deepEqual(snap,{name:'Euro Palette',code:'EUR',description:'Test',lengthCm:120,widthCm:80,heightCm:145,ldm:0.4});
});

test('RC1555 state save snapshots a newly selected packaging with id and actual row dimensions',()=>{
  const store=loadStore(),state=legacyState();
  state.shipments=[{id:'S1',rows:[{type:'Euro Palette',count:1,l:121,w:81,h:146,ldm:0.41}]}];
  const result=store.applyPackagingSnapshots(state);
  const row=result.shipments[0].rows[0];
  assert.equal(row.packagingTypeId,'CT1');
  assert.deepEqual(row.packagingSnapshot,{name:'Euro Palette',code:'EUR',description:'',lengthCm:121,widthCm:81,heightCm:146,ldm:0.41});
});

test('RC1555 unrelated saves preserve an existing historical snapshot after master rename',()=>{
  const store=loadStore(),state=legacyState();
  state.shipments=[{id:'S1',rows:[{type:'Euro Palette',packagingTypeId:'CT1',packagingSnapshot:{name:'Euro Palette',code:'EUR',description:'',lengthCm:120,widthCm:80,heightCm:145,ldm:0.4},l:120,w:80,h:145,ldm:0.4}]}];
  const renamed=store.updatePackaging(state,'CT1',{name:'Euro Palette Neu',code:'EUR2'},'Admin','2026-10-16T16:50:00.000Z');
  const snapState=store.applyPackagingSnapshots(renamed.state);
  const row=snapState.shipments[0].rows[0];
  assert.equal(row.packagingTypeId,'CT1');
  assert.equal(row.packagingSnapshot.name,'Euro Palette');
  assert.equal(row.packagingSnapshot.code,'EUR');
});

test('RC1555 deliberate packaging change refreshes the snapshot exactly once',()=>{
  const store=loadStore(),state=legacyState();
  state.shipments=[{id:'S1',rows:[{type:'Euro Palette',packagingTypeId:'CT1',packagingSnapshot:{name:'Euro Palette',code:'EUR',description:'',lengthCm:120,widthCm:80,heightCm:145,ldm:0.4},l:40,w:30,h:20,ldm:0.2}]}];
  const row=state.shipments[0].rows[0];row.type='Alte Kiste';
  const result=store.applyPackagingSnapshots(state),saved=result.shipments[0].rows[0];
  assert.equal(saved.packagingTypeId,'CT2');
  assert.equal(saved.packagingSnapshot.name,'Alte Kiste');
  assert.equal(saved.packagingSnapshot.code,'OLD');
  assert.equal(saved.packagingSnapshot.lengthCm,40);
});

test('RC1555 central storage compaction applies packaging snapshots before ExportHUB persistence',()=>{
  const storage=fs.readFileSync('api/shared/state-compaction.js','utf8');
  assert.match(storage,/packaging-admin-store/,'central persistence compaction must share the packaging snapshot domain');
  assert.match(storage,/applyPackagingSnapshots\(/,'storage compaction must enrich shipment rows before persistence');
  const {compactStateForStorage}=require('../api/shared/state-compaction.js');
  const state=legacyState();state.shipments=[{id:'S1',rows:[{type:'Euro Palette',l:120,w:80,h:145,ldm:0.4}]}];
  const compacted=compactStateForStorage(state);
  assert.equal(compacted.shipments[0].rows[0].packagingTypeId,'CT1');
  assert.equal(compacted.shipments[0].rows[0].packagingSnapshot.name,'Euro Palette');
});
