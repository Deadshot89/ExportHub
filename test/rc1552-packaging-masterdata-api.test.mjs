import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function error(code,message,status=400){const e=new Error(message||code);e.code=code;e.status=status;e.statusCode=status;return e;}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
function body(req){return req&&req.body&&typeof req.body==='object'?req.body:{};}
function bodyOf(res){return JSON.parse(res&&res.body||'{}');}
function context(){return{res:null,log:{error(){},warn(){},info(){}}};}
function isAdmin(user){return Boolean(user&&(user.globalAdmin===true||String(user.role||'').toLowerCase()==='admin'));}
function clone(v){return JSON.parse(JSON.stringify(v));}

function loadHandler(auth){
  const target=path.resolve(ROOT,'api/packaging-masterdata/index.js');
  const original=Module._load;
  Module._load=function(request,parent,isMain){if(request==='../shared/auth-store')return auth;return original.call(this,request,parent,isMain);};
  try{delete require.cache[require.resolve(target)];return require(target);}finally{Module._load=original;}
}
function fixture(user,initial={}){
  const team={state:{colliTypes:[],packagingTypes:[],auditLog:[],...clone(initial)}};
  const auth={
    json,error,body,isAdmin,
    async validateSession(){return{user,team};},
    async mutateTeamForRequest(_req,mutator){return mutator(team);},
    addAudit(doc,type,actor,details={}){doc.state.auditLog.push({type,actor,details:clone(details)});}
  };
  return{auth,team};
}

test('RC1552 domain create rejects normalized name and code duplicates',()=>{
  const m=require('../api/shared/packaging-masterdata.js');
  const state={packagingTypes:[]};
  const first=m.createPackaging(state,{name:'Europalette Spezial',code:' ESP ',description:'Test'},'Admin',{now:'2026-10-16T12:00:00.000Z'});
  assert.equal(first.after.name,'Europalette Spezial');
  assert.equal(first.after.code,'ESP');
  assert.equal(first.after.active,true);
  assert.throws(()=>m.createPackaging(state,{name:' EUROPALETTE-SPEZIAL ',code:'X'},'Admin'),e=>e.code==='PACKAGING_NAME_DUPLICATE');
  assert.throws(()=>m.createPackaging(state,{name:'Andere Palette',code:'esp'},'Admin'),e=>e.code==='PACKAGING_CODE_DUPLICATE');
});

test('RC1552 domain update and status changes preserve before/after evidence',()=>{
  const m=require('../api/shared/packaging-masterdata.js');
  const state={packagingTypes:[]};
  const created=m.createPackaging(state,{name:'Einweg Test',code:'EWT',active:true},'Admin',{now:'2026-10-16T12:00:00.000Z'}).after;
  const changed=m.updatePackaging(state,created.id,{name:'Holz Einweg Test',description:'Neu'},'Admin',{now:'2026-10-16T12:01:00.000Z'});
  assert.equal(changed.before.name,'Einweg Test');
  assert.equal(changed.after.name,'Holz Einweg Test');
  assert.equal(changed.after.description,'Neu');
  const off=m.setPackagingActive(state,created.id,false,'Admin',{now:'2026-10-16T12:02:00.000Z'});
  assert.equal(off.before.active,true);assert.equal(off.after.active,false);
  const on=m.setPackagingActive(state,created.id,true,'Admin',{now:'2026-10-16T12:03:00.000Z'});
  assert.equal(on.after.active,true);
});

test('RC1552 used packaging cannot hard-delete and legacy-label evidence also archives',()=>{
  const m=require('../api/shared/packaging-masterdata.js');
  const state={packagingTypes:[]};
  const pkg=m.createPackaging(state,{name:'Historische Palette',code:'HIS'},'Admin').after;
  state.shipments=[{id:'S1',rows:[{packagingTypeId:pkg.id,type:'Historische Palette'}]}];
  const usage=m.usageOfPackaging(state,pkg);
  assert.equal(usage.used,true);assert.equal(usage.references.shipments,1);
  const archived=m.deleteOrArchivePackaging(state,pkg.id,'Admin');
  assert.equal(archived.deleted,false);assert.equal(archived.archived,true);assert.equal(archived.after.active,false);

  const state2={packagingTypes:[]};
  const legacy=m.createPackaging(state2,{name:'Legacy Kiste'},'Admin').after;
  state2.tasks=[{id:'T1',packageType:'LEGACY-KISTE'}];
  const legacyResult=m.deleteOrArchivePackaging(state2,legacy.id,'Admin');
  assert.equal(legacyResult.archived,true,'case/punctuation-normalized historical labels must block hard delete');
});

test('RC1552 unused packaging hard-deletes',()=>{
  const m=require('../api/shared/packaging-masterdata.js');
  const state={packagingTypes:[]};
  const pkg=m.createPackaging(state,{name:'Nie benutzt'},'Admin').after;
  const result=m.deleteOrArchivePackaging(state,pkg.id,'Admin');
  assert.equal(result.deleted,true);assert.equal(result.archived,false);
  assert.equal(state.packagingTypes.some(x=>x.id===pkg.id),false);
});

test('RC1552 normal user reads active only and cannot mutate',async()=>{
  const f=fixture({id:'U1',name:'User',role:'Benutzer'},{packagingTypes:[
    {id:'P1',name:'Aktiv',normalizedName:'aktiv',code:'A',description:'',active:true},
    {id:'P2',name:'Inaktiv',normalizedName:'inaktiv',code:'I',description:'',active:false}
  ]});
  const handler=loadHandler(f.auth);
  const read=context();await handler(read,{method:'GET',headers:{},query:{includeInactive:'1'}});
  assert.equal(read.res.status,200);const payload=bodyOf(read.res);assert.equal(payload.canEdit,false);assert.deepEqual(payload.items.map(x=>x.id),['P1']);
  const write=context();await handler(write,{method:'POST',headers:{},body:{action:'create',name:'Verboten'}});
  assert.equal(write.res.status,403);assert.equal(bodyOf(write.res).code,'ADMIN_REQUIRED');
});

test('RC1552 admin CRUD writes audit before/after and exposes inactive metadata',async()=>{
  const f=fixture({id:'A1',name:'Admin',role:'admin',globalAdmin:true});
  const handler=loadHandler(f.auth);
  const created=context();await handler(created,{method:'POST',headers:{},body:{action:'create',name:'Spezialkiste',code:'SK',description:'A'}});
  assert.equal(created.res.status,201);const id=bodyOf(created.res).item.id;
  const changed=context();await handler(changed,{method:'PATCH',headers:{},body:{action:'update',id,name:'Spezialkiste Neu',description:'B'}});
  assert.equal(changed.res.status,200);
  const off=context();await handler(off,{method:'PATCH',headers:{},body:{action:'deactivate',id}});assert.equal(off.res.status,200);
  const read=context();await handler(read,{method:'GET',headers:{},query:{includeInactive:'1'}});const item=bodyOf(read.res).items.find(x=>x.id===id);
  assert.equal(item.active,false);assert.equal(item.updatedBy.name,'Admin');assert.ok(item.updatedAt);
  assert.deepEqual(f.team.state.auditLog.map(x=>x.type),['packaging.created','packaging.updated','packaging.deactivated']);
  const updateAudit=f.team.state.auditLog[1].details;assert.equal(updateAudit.before.name,'Spezialkiste');assert.equal(updateAudit.after.name,'Spezialkiste Neu');
});

test('RC1552 used DELETE auto-deactivates with required history message',async()=>{
  const f=fixture({id:'A1',name:'Admin',role:'admin',globalAdmin:true});
  const handler=loadHandler(f.auth);
  const created=context();await handler(created,{method:'POST',headers:{},body:{action:'create',name:'Euro Test'}});const id=bodyOf(created.res).item.id;
  f.team.state.packNotifications=[{id:'N1',packagingTypeId:id,packageType:'Euro Test'}];
  const del=context();await handler(del,{method:'DELETE',headers:{},body:{id}});
  const payload=bodyOf(del.res);assert.equal(del.res.status,200);assert.equal(payload.deleted,false);assert.equal(payload.archived,true);
  assert.equal(payload.message,'Diese Verpackung wurde bereits verwendet und kann aus Gründen der Datenhistorie nicht vollständig gelöscht werden. Sie wird deaktiviert und künftig nicht mehr zur Auswahl angeboten.');
});

test('RC1552 endpoint uses environment-aware team mutation and keeps unrelated state',async()=>{
  const f=fixture({id:'A1',name:'Admin',role:'admin',globalAdmin:true},{unrelated:{keep:true}});
  let mutations=0;const original=f.auth.mutateTeamForRequest;f.auth.mutateTeamForRequest=async(req,fn)=>{mutations++;return original(req,fn);};
  const handler=loadHandler(f.auth);const ctx=context();await handler(ctx,{method:'POST',headers:{'x-exporthub-environment':'testservice'},body:{action:'create',name:'Concurrent Safe'}});
  assert.equal(ctx.res.status,201);assert.equal(mutations,1);assert.deepEqual(f.team.state.unrelated,{keep:true});
});

test('RC1552 function route supports GET POST PATCH DELETE OPTIONS',()=>{
  const cfg=JSON.parse(fs.readFileSync(path.resolve(ROOT,'api/packaging-masterdata/function.json'),'utf8'));
  const trigger=cfg.bindings.find(x=>x.type==='httpTrigger');assert.equal(trigger.route,'packaging-masterdata');assert.deepEqual(trigger.methods,['get','post','patch','delete','options']);
});
