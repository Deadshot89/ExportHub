import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function json(status, body){ return { status, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }; }
function error(code, message, status=400){ const e=new Error(message||code); e.code=code; e.status=status; e.statusCode=status; return e; }
function body(req){ return req && req.body && typeof req.body === 'object' ? req.body : {}; }
function bodyOf(res){ return JSON.parse(res && res.body || '{}'); }
function context(){ return {res:null,log:{error(){},warn(){},info(){}}}; }
function isAdmin(user){ return Boolean(user && user.globalAdmin === true); }

function loadFixedPickupHandler(user){
  const target=path.resolve(ROOT,'api/fixed-pickups/index.js');
  const original=Module._load;
  const records=[];
  const auth={json,error,body,isAdmin,async validateSession(){return {user};}};
  const fastAuth={isSource(){return false;}};
  const companies={resolveCompanyContext(){return {companyKey:'firma-a'};}};
  const store={
    resolveEnvironment(){return 'production';},
    async list(){return records;},
    async create(_env,_company,payload){const item={id:'FIX-1',active:true,...payload};records.push(item);return item;},
    async update(_env,_company,id,payload){const item=records.find(x=>x.id===id)||{id};Object.assign(item,payload);return item;}
  };
  Module._load=function(request,parent,isMain){
    if(request==='../shared/auth-store')return auth;
    if(request==='../shared/fast-auth-store')return fastAuth;
    if(request==='../shared/company-context')return companies;
    if(request==='../shared/fixed-pickup-store')return store;
    return original.call(this,request,parent,isMain);
  };
  try{delete require.cache[require.resolve(target)];return require(target);}finally{Module._load=original;}
}

async function postAs(user){
  const handler=loadFixedPickupHandler(user),ctx=context();
  await handler(ctx,{method:'POST',headers:{},body:{siteLabel:'Werk A',weekday:1}});
  return ctx.res;
}

for(const level of ['edit','admin']){
  test(`pickupcalendar ${level} darf fixe Abholungen bearbeiten`,async()=>{
    const right={level,visible:true,read:true,edit:true,admin:level==='admin',functionAdmin:level==='admin'};
    const res=await postAs({id:'U1',name:'Kalender Benutzer',globalAdmin:false,rights:{pickupcalendar:right}});
    assert.equal(res.status,201);
    assert.equal(bodyOf(res).ok,true);
  });
}

test('pickupcalendar Nur ansehen bleibt schreibgeschützt',async()=>{
  const res=await postAs({id:'U2',globalAdmin:false,rights:{pickupcalendar:{level:'view',visible:true,read:true,edit:false,admin:false}}});
  assert.equal(res.status,403);
  assert.equal(bodyOf(res).code,'ADMIN_REQUIRED');
});

test('GET meldet canEdit entsprechend dem Kalenderrecht',async()=>{
  const handler=loadFixedPickupHandler({id:'U3',globalAdmin:false,rights:{pickupcalendar:{level:'edit',edit:true,read:true,visible:true}}});
  const ctx=context();
  await handler(ctx,{method:'GET',headers:{},query:{includeInactive:'1'}});
  assert.equal(ctx.res.status,200);
  assert.equal(bodyOf(ctx.res).canEdit,true);
});

test('aktiver RC544-Rechteeditor zeigt Abholkalender als vergebbares Modul',async()=>{
  const source=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const moduleUrl=pathToFileURL(path.join(ROOT,'.github/rc1018/patch-calendar-shipment.mjs')).href+'?calendar-sharing='+Date.now();
  const {patchCriticalShipmentFlow}=await import(moduleUrl);
  const patched=patchCriticalShipmentFlow(source);
  const marker='<script data-inline-source="assets/rc544-auth.js">';
  const start=patched.indexOf(marker),end=patched.indexOf('</script>',start+marker.length);
  assert.ok(start>=0&&end>start,'RC544-Rechteeditor fehlt');
  const block=patched.slice(start,end);
  assert.match(block,/pickupcalendar:'Abholkalender'/);
  assert.match(block,/VALID_RIGHTS_ORDER=\[[^\]]*'pickupcalendar'\]/);
  assert.match(block,/sanitizeModules\(list\)/);
});
