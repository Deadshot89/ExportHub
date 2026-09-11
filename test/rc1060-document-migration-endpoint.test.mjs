import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);

function loadEndpoint({admin=true,migration}={}){
  const target=path.resolve('api/exporthub-document-migrate/index.js');
  const original=Module._load;
  const writes=[];
  const fastAuth={
    async validateSession(req){
      const h=req&&req.headers||{};
      if(!String(h.authorization||'').startsWith('Bearer ')){const e=new Error('Anmeldung erforderlich');e.code='AUTH_REQUIRED';e.status=401;throw e}
      return {user:{id:'U1',admin},teamDoc:{value:{shipments:[]},etag:'etag-1'}};
    },
    isAdmin(user){return user&&user.admin===true;},
    async clients(){return {team:{name:'team'}};},
    async writeJson(client,state,etag){writes.push({client,state,etag});return {etag:'etag-2'};}
  };
  const documentStore={
    async migrateLegacyDocuments(state,options){
      if(migration)return migration(state,options);
      return {state:{...state,migrated:true},found:2,migrated:1,skipped:3,failed:0,remaining:1,bytesMoved:123,done:false};
    }
  };
  Module._load=function(request,parent,isMain){
    if(request==='../shared/fast-auth-store')return fastAuth;
    if(request==='../shared/document-blob-store')return documentStore;
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[target];
  try{return {endpoint:require(target),writes};}finally{Module._load=original;}
}

async function invoke(endpoint,{authorization='Bearer ok',host='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net',body={environment:'testservice',limit:5}}={}){
  const context={res:null,log:{error(){}}};
  await endpoint(context,{method:'POST',headers:{host,authorization},body});
  return context.res;
}

test('RC1060: Migration verlangt Anmeldung und Adminrolle',async()=>{
  let loaded=loadEndpoint();
  let res=await invoke(loaded.endpoint,{authorization:''});
  assert.equal(res.status,401);
  loaded=loadEndpoint({admin:false});
  res=await invoke(loaded.endpoint);
  assert.equal(res.status,403);
});

test('RC1060: Environment-Mismatch wird abgewiesen und Limit wird auf 1 bis 10 begrenzt',async()=>{
  let loaded=loadEndpoint();
  let res=await invoke(loaded.endpoint,{body:{environment:'production',limit:5}});
  assert.equal(res.status,409);

  let seenLimit=0;
  loaded=loadEndpoint({migration:async(state,options)=>{seenLimit=options.limit;return{state,found:0,migrated:0,skipped:0,failed:0,remaining:0,bytesMoved:0,done:true}}});
  res=await invoke(loaded.endpoint,{body:{environment:'testservice',limit:999}});
  assert.equal(res.status,200);
  assert.equal(seenLimit,10);
});

test('RC1060: erfolgreiche Admin-Migration persistiert atomar und Antwort bleibt rein aggregiert',async()=>{
  const loaded=loadEndpoint();
  const res=await invoke(loaded.endpoint);
  assert.equal(res.status,200);
  const body=JSON.parse(res.body);
  assert.deepEqual(body,{ok:true,found:2,migrated:1,skipped:3,failed:0,remaining:1,bytesMoved:123,done:false});
  assert.equal(loaded.writes.length,1);
  assert.equal(loaded.writes[0].etag,'etag-1');
  assert.doesNotMatch(res.body,/dataUrl|base64|blobName|payload/i);
});
