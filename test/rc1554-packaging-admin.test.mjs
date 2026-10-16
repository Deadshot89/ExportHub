import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const STORE='api/shared/packaging-admin-store.js';
function loadStore(){
  assert.equal(fs.existsSync(STORE),true,'RC1554 packaging store is missing');
  delete require.cache[require.resolve('../'+STORE)];
  return require('../'+STORE);
}

function baseState(){
  return {
    colliTypes:[{id:'CT1',name:'Euro Palette',code:'EUR',l:120,w:80,h:145,active:true}],
    inactiveColliTypes:[],
    packNotifications:[{id:'N1',packageType:'Euro Palette',packages:[{packageNo:1,length:120,width:80,height:145}]}],
    shipments:[{id:'S1',colli:[{type:'Euro Palette',count:1}]}]
  };
}

test('RC1554 creates packaging and rejects case-insensitive duplicates',()=>{
  const store=loadStore();
  const created=store.createPackaging(baseState(),{name:'Spezialkiste',code:'SK',length:88,width:55,height:44,description:'intern'},'Admin','2026-10-16T15:30:00.000Z');
  assert.equal(created.packaging.name,'Spezialkiste');
  assert.equal(created.packaging.active,true);
  assert.equal(created.state.colliTypes.some(x=>x.name==='Spezialkiste'),true);
  assert.throws(()=>store.createPackaging(created.state,{name:' spezialKISTE '},'Admin','2026-10-16T15:31:00.000Z'),/existiert bereits/i);
});

test('RC1554 edits master packaging without rewriting historical shipment snapshots',()=>{
  const store=loadStore();
  const state=baseState();
  const before=JSON.stringify(state.packNotifications);
  const result=store.updatePackaging(state,'CT1',{name:'Euro Palette Neu',code:'EUR2',length:121,width:81,height:146,description:'neu'},'Admin','2026-10-16T15:32:00.000Z');
  assert.equal(result.packaging.name,'Euro Palette Neu');
  assert.equal(result.packaging.l,121);
  assert.equal(JSON.stringify(result.state.packNotifications),before,'historical pack notification snapshot must stay unchanged');
  assert.equal(result.state.shipments[0].colli[0].type,'Euro Palette','historical shipment snapshot must stay unchanged');
});

test('RC1554 deactivates and reactivates packaging by moving it out of the active colliTypes source',()=>{
  const store=loadStore();
  const off=store.setPackagingActive(baseState(),'CT1',false,'Admin','2026-10-16T15:33:00.000Z');
  assert.equal(off.packaging.active,false);
  assert.equal(off.state.colliTypes.some(x=>x.id==='CT1'),false);
  assert.equal(off.state.inactiveColliTypes.some(x=>x.id==='CT1'),true);
  const on=store.setPackagingActive(off.state,'CT1',true,'Admin','2026-10-16T15:34:00.000Z');
  assert.equal(on.packaging.active,true);
  assert.equal(on.state.colliTypes.some(x=>x.id==='CT1'),true);
  assert.equal(on.state.inactiveColliTypes.some(x=>x.id==='CT1'),false);
});

test('RC1554 hard-deletes unused packaging but archives packaging already referenced historically',()=>{
  const store=loadStore();
  const unused=store.createPackaging(baseState(),{name:'Nur Test',length:10,width:10,height:10},'Admin','2026-10-16T15:35:00.000Z');
  const hard=store.removePackaging(unused.state,unused.packaging.id,'Admin','2026-10-16T15:36:00.000Z');
  assert.equal(hard.deleted,true);
  assert.equal(hard.archived,false);
  assert.equal(store.listPackaging(hard.state).some(x=>x.id===unused.packaging.id),false);

  const soft=store.removePackaging(baseState(),'CT1','Admin','2026-10-16T15:37:00.000Z');
  assert.equal(soft.deleted,false);
  assert.equal(soft.archived,true);
  assert.equal(soft.packaging.active,false);
  assert.equal(soft.state.inactiveColliTypes.some(x=>x.id==='CT1'),true);
  assert.equal(soft.state.packNotifications[0].packageType,'Euro Palette');
});

test('RC1554 admin API and UI surface expose CRUD without changing normal-user pack flow',()=>{
  assert.equal(fs.existsSync('api/packaging-admin/index.js'),true,'packaging admin API is missing');
  assert.equal(fs.existsSync('api/packaging-admin/function.json'),true,'packaging admin function binding is missing');
  assert.equal(fs.existsSync('assets/packaging-admin.js'),true,'packaging admin UI is missing');
  const api=fs.readFileSync('api/packaging-admin/index.js','utf8');
  const ui=fs.readFileSync('assets/packaging-admin.js','utf8');
  const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
  assert.match(api,/GLOBAL_ADMIN_REQUIRED/);
  for(const action of ['list','create','update','toggle','delete'])assert.match(api,new RegExp(`['\"]${action}['\"]`));
  assert.match(ui,/Verpackungen/);
  assert.match(ui,/data-packaging-admin-open/);
  assert.match(ui,/data-packaging-action=[\\]?['\"]create/);
  assert.match(ui,/data-packaging-action=[\\]?['\"]edit/);
  assert.match(ui,/data-packaging-action=[\\]?['\"]toggle/);
  assert.match(ui,/data-packaging-action=[\\]?['\"]delete/);
  assert.match(nav,/packaging-admin\.js\?v=1554/,'Packmeldungen navigation must load the packaging admin runtime');
});
