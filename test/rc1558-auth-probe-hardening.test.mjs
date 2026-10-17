import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import Module from 'node:module';

const require=createRequire(import.meta.url);

async function run(failing){
  const original=Module._load;
  if(failing)Module._load=function(request,...rest){
    if(request==='../shared/auth-store')throw Object.assign(new Error('Cannot find module C:\\home\\site\\wwwroot\\api\\shared\\auth-store.js'),{code:'MODULE_NOT_FOUND'});
    return original.call(this,request,...rest);
  };
  try{
    const path=require.resolve('../api/exporthub-auth-probe/index.js');
    delete require.cache[path];
    const probe=require(path);
    const logs=[];
    const context={log:{error:(...a)=>logs.push(a.join(' '))}};
    await probe(context,{method:'GET'});
    return{res:context.res,body:JSON.parse(context.res.body),logs};
  }finally{Module._load=original}
}

test('RC1558 Auth-Probe liefert weiter ok und runtimeReady für das Storage-Probe-Gate',async()=>{
  const {res,body}=await run(false);
  assert.equal(res.status,200);
  assert.equal(body.ok,true);
  assert.equal(typeof body.runtimeReady,'boolean');
  for(const name of ['userPolicy','storageBlob','authStore','authEndpoint'])assert.equal(typeof body.modules[name].ok,'boolean');
  assert.equal(typeof body.configuration.signingSecretConfigured,'boolean');
});

test('RC1558 Auth-Probe verrät keine Modul-Exporte, Pfade oder genaue Laufzeitdetails',async()=>{
  const {body,logs}=await run(true);
  const text=JSON.stringify(body);
  assert.equal(body.modules.authStore.ok,false);
  assert.equal(body.modules.authStore.code,'MODULE_NOT_FOUND');
  assert.equal(body.runtimeReady,false);
  assert.doesNotMatch(text,/wwwroot|Cannot find module|"exports"|"message"|"platform"|"arch"/);
  assert.doesNotMatch(text,new RegExp(process.version.replace(/\./g,'\\.')));
  assert.ok(logs.some(l=>/auth-store/.test(l)),'Fehlerdetails gehören ins Function-Log');
});
