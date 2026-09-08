import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function error(code, message, statusCode = 400){ const e = new Error(message || code); e.code = code; e.status = statusCode; e.statusCode = statusCode; return e; }
function json(status, body){ return { status, headers: { 'Content-Type':'application/json; charset=utf-8' }, body: JSON.stringify(body) }; }
function body(req){ if (req && req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req && req.body || '{}'); } catch (_) { return {}; } }
function bodyOf(res){ return JSON.parse(res && res.body || '{}'); }
function context(){ return { res:null, log:{error(){},warn(){},info(){}} }; }
function isAdmin(user){ return Boolean(user && (user.globalAdmin === true || String(user.role || '').toLowerCase() === 'admin')); }

function loadHandler(auth, store){
  const target = path.resolve(ROOT, 'api/fixed-pickups/index.js');
  const original = Module._load;
  Module._load = function(request, parent, isMain){
    if (request === '../shared/auth-store') return auth;
    if (request === '../shared/fixed-pickup-store') return store;
    return original.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(target)];
    return require(target);
  } finally {
    Module._load = original;
  }
}

function fixture(user){
  let listCalls = 0;
  const auth = {
    json, error, body, isAdmin,
    async validateSession(){ return { user }; }
  };
  const records = [{id:'FIX-1',siteLabel:'Standort A',weekday:1,note:'',active:true}];
  const store = {
    resolveEnvironment(req, payload){
      const raw = String(req?.headers?.['x-exporthub-environment'] || payload?.environment || '').toLowerCase();
      const origin = String(req?.headers?.origin || '').toLowerCase();
      if (origin.includes('.azurestaticapps.net') && !origin.includes('-testservice.') && raw === 'testservice') throw error('ENVIRONMENT_MISMATCH','Umgebung passt nicht.',409);
      return raw === 'testservice' ? 'testservice' : 'production';
    },
    async list(){ listCalls += 1; return records.filter(x=>x.active); },
    async create(_environment,_company,payload){ const item={id:'FIX-2',siteLabel:payload.siteLabel,weekday:payload.weekday,note:payload.note||'',active:true}; records.push(item); return item; },
    async update(_environment,_company,id,payload){ const item=records.find(x=>x.id===id); if(!item) throw error('FIX_NOT_FOUND','Nicht gefunden.',404); Object.assign(item,payload); return {...item}; }
  };
  return { auth, store, records, getListCalls:()=>listCalls };
}

test('Mitarbeiter kann aktive fixe Abholungen lesen', async () => {
  const f = fixture({id:'U1',role:'Benutzer',companyId:'A'});
  const handler = loadHandler(f.auth,f.store);
  const ctx = context();
  await handler(ctx,{method:'GET',headers:{'x-exporthub-environment':'testservice'},query:{}});
  assert.equal(ctx.res.status,200);
  assert.equal(bodyOf(ctx.res).canEdit,false);
  assert.equal(bodyOf(ctx.res).environment,'testservice');
  assert.equal(bodyOf(ctx.res).companyKey,'a');
});

test('Mitarbeiter kann FIX-Daten nicht schreiben', async () => {
  const f = fixture({id:'U1',role:'Benutzer',companyId:'A'});
  const handler = loadHandler(f.auth,f.store);
  const ctx = context();
  await handler(ctx,{method:'POST',headers:{},body:{siteLabel:'A',weekday:1}});
  assert.equal(ctx.res.status,403);
  assert.equal(bodyOf(ctx.res).code,'ADMIN_REQUIRED');
});

test('Admin kann anlegen und deaktivieren', async () => {
  const f = fixture({id:'A1',name:'Admin',role:'admin',globalAdmin:true,companyId:'A'});
  const handler = loadHandler(f.auth,f.store);
  const created = context();
  await handler(created,{method:'POST',headers:{'x-exporthub-environment':'testservice'},body:{siteLabel:'A',weekday:1}});
  assert.equal(created.res.status,201);
  const id = bodyOf(created.res).item.id;
  const changed = context();
  await handler(changed,{method:'PATCH',headers:{'x-exporthub-environment':'testservice'},body:{id,active:false}});
  assert.equal(changed.res.status,200);
  assert.equal(bodyOf(changed.res).item.active,false);
});

test('Fremdfirma wird vor Store-Zugriff abgewiesen', async () => {
  const f = fixture({id:'U1',role:'Benutzer',companyId:'A'});
  const handler = loadHandler(f.auth,f.store);
  const ctx = context();
  await handler(ctx,{method:'GET',headers:{'x-exporthub-company-id':'B'},query:{}});
  assert.equal(ctx.res.status,403);
  assert.equal(bodyOf(ctx.res).code,'COMPANY_FORBIDDEN');
  assert.equal(f.getListCalls(),0);
});

test('Umgebungs-Mismatch wird als 409 zurückgegeben', async () => {
  const f = fixture({id:'U1',role:'Benutzer',companyId:'A'});
  const handler = loadHandler(f.auth,f.store);
  const ctx = context();
  await handler(ctx,{method:'GET',headers:{origin:'https://example.azurestaticapps.net','x-exporthub-environment':'testservice'},query:{}});
  assert.equal(ctx.res.status,409);
  assert.equal(bodyOf(ctx.res).code,'ENVIRONMENT_MISMATCH');
});

test('OPTIONS ist ohne Datenzugriff erlaubt und andere Methoden liefern 405', async () => {
  const f = fixture({id:'U1',role:'Benutzer',companyId:'A'});
  const handler = loadHandler(f.auth,f.store);
  const options = context();
  await handler(options,{method:'OPTIONS',headers:{}});
  assert.equal(options.res.status,204);
  const del = context();
  await handler(del,{method:'DELETE',headers:{}});
  assert.equal(del.res.status,405);
  assert.equal(bodyOf(del.res).code,'METHOD_NOT_ALLOWED');
});
