import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function error(code,message,statusCode=400){const e=new Error(message||code);e.code=code;e.status=e.statusCode=statusCode;return e}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(body)}}
function body(req){return req&&req.body&&typeof req.body==='object'?req.body:{}}
function bodyOf(res){return JSON.parse(res&&res.body||'{}')}
function context(){return{res:null,log:{error(){},warn(){},info(){}}}}
function isAdmin(user){return Boolean(user&&(user.globalAdmin===true||String(user.role||'').toLowerCase()==='admin'))}

function loadHandler(user){
  const target=path.resolve(ROOT,'api/fixed-pickups/index.js');
  const auth={json,error,body,isAdmin,async validateSession(){return{user}}};
  const fastAuth={isSource(){return false}};
  const company={resolveCompanyContext(){return{companyKey:String(user.companyId||'A').toLowerCase()}}};
  const records=[];
  const store={
    resolveEnvironment(){return'production'},
    async list(_env,_company,opts){return opts&&opts.includeInactive?[{id:'FIX-OLD',active:false}]:[]},
    async create(_env,_company,payload,actor){const item={id:'FIX-NEW',...payload,active:true,actor};records.push(item);return item},
    async update(_env,_company,id,payload,actor){return{id,...payload,actor}}
  };
  const policy=require(path.resolve(ROOT,'api/shared/user-policy.js'));
  const original=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='../shared/auth-store')return auth;
    if(request==='../shared/fast-auth-store')return fastAuth;
    if(request==='../shared/company-context')return company;
    if(request==='../shared/fixed-pickup-store')return store;
    if(request==='../shared/user-policy')return policy;
    return original.call(this,request,parent,isMain);
  };
  try{delete require.cache[require.resolve(target)];return require(target)}finally{Module._load=original}
}

for(const level of ['edit','admin'])test(`Benutzer mit Abholkalender-${level} darf fixe Abholungen verwalten`,async()=>{
  const user={id:'U1',name:'Planer',role:'Benutzer',companyId:'A',rights:{pickupcalendar:{level}}};
  const handler=loadHandler(user);
  const get=context();await handler(get,{method:'GET',query:{includeInactive:'1'},headers:{}});
  assert.equal(get.res.status,200);assert.equal(bodyOf(get.res).canEdit,true);assert.equal(bodyOf(get.res).items.length,1);
  const post=context();await handler(post,{method:'POST',body:{siteLabel:'Neff',weekday:1},headers:{}});
  assert.equal(post.res.status,201);
});

test('Benutzer mit Abholkalender-view kann lesen, aber nicht verwalten',async()=>{
  const user={id:'U2',role:'Benutzer',companyId:'A',rights:{pickupcalendar:{level:'view'}}};
  const handler=loadHandler(user);
  const get=context();await handler(get,{method:'GET',query:{includeInactive:'1'},headers:{}});
  assert.equal(get.res.status,200);assert.equal(bodyOf(get.res).canEdit,false);assert.equal(bodyOf(get.res).items.length,0);
  const post=context();await handler(post,{method:'POST',body:{siteLabel:'Neff',weekday:1},headers:{}});
  assert.equal(post.res.status,403);assert.equal(bodyOf(post.res).code,'ADMIN_REQUIRED');
});

test('RC1018 Build stellt Abholkalender im Rechteeditor bereit und berücksichtigt ihn als Modulrecht',()=>{
  const build=fs.readFileSync(path.join(ROOT,'.github/rc1018/build-three-env.mjs'),'utf8');
  assert.match(build,/patchCalendarUserPermissions/,'Builder muss Kalenderrechte patchen');
  const patch=fs.readFileSync(path.join(ROOT,'.github/rc1018/patch-calendar-user-permissions.mjs'),'utf8');
  assert.match(patch,/Abholkalender/);
  assert.match(patch,/pickupcalendar/);
  assert.match(patch,/hasModuleRightsForUser/);
});