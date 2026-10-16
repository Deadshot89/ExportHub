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
  assert.equal(state.packagingTypes.length,2);
  assert.equal(list.find(x=>x.id==='CT1').active,true);
  assert.equal(list.find(x=>x.id==='CT2').active,false);
  const created=store.createPackaging(state,{name:'Neue Kiste',code:'NEW'},'Admin','2026-10-16T16:45:00.000Z');
  assert.equal(created.state.packagingTypes.some(x=>x.name==='Neue Kiste'),true);
  assert.equal(created.state.colliTypes.some(x=>x.name==='Neue Kiste'),true,'legacy active projection must stay compatible during cutover');
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
