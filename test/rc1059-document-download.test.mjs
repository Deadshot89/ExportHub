import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);
process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='rc1059-test-connection';

function loadEndpoint({buffer=Buffer.from('PDF'),contentType='application/pdf'}={}){
  const target=path.resolve('api/exporthub-document/index.js');
  const original=Module._load;
  const fastAuth={
    async validateSession(req){
      const h=req&&req.headers||{};
      if(!String(h.authorization||h.Authorization||'').startsWith('Bearer ')){
        const e=new Error('ExportHUB-Anmeldung erforderlich.');e.code='AUTH_REQUIRED';e.status=401;throw e;
      }
      return {user:{id:'U1',active:true},session:{id:'S1'}};
    }
  };
  const blob={
    async download(){return{readableStreamBody:Readable.from(buffer),contentType,etag:'"doc"'};}
  };
  const container={getBlockBlobClient(){return blob;}};
  const service={getContainerClient(){return container;}};
  const blobRest={createBlobServiceClient(){return service;}};
  Module._load=function(request,parent,isMain){
    if(request==='../shared/fast-auth-store')return fastAuth;
    if(request==='../shared/blob-rest')return blobRest;
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[target];
  try{return require(target);}finally{Module._load=original;}
}

async function invoke(endpoint,{authorization='Bearer ok',blob,host='wonderful-forest-0f315e310.7.azurestaticapps.net',environment}={}){
  const context={res:null,log:{error(){}}};
  const query={};if(blob!==undefined)query.blob=blob;if(environment)query.environment=environment;
  const req={method:'GET',headers:{host,authorization},query};
  await endpoint(context,req);
  return context.res;
}

const hash='a'.repeat(64);

test('RC1059: Dokumentabruf verlangt eine gültige ExportHUB-Sitzung',async()=>{
  const endpoint=loadEndpoint();
  const res=await invoke(endpoint,{authorization:'',blob:`rc1059/production/aa/${hash}`});
  assert.equal(res.status,401);
  assert.equal(JSON.parse(res.body).code,'AUTH_REQUIRED');
});

test('RC1059: ungültige Blobpfade werden abgewiesen',async()=>{
  const endpoint=loadEndpoint();
  const res=await invoke(endpoint,{blob:'../secret'});
  assert.equal(res.status,400);
  assert.equal(JSON.parse(res.body).code,'DOCUMENT_BLOB_INVALID');
});

test('RC1059: TESTSERVICE-Dokument wird binär über geschützten Endpoint geliefert',async()=>{
  const endpoint=loadEndpoint({buffer:Buffer.from('%PDF-test'),contentType:'application/pdf'});
  const res=await invoke(endpoint,{blob:`rc1059/testservice/aa/${hash}`,host:'wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net'});
  assert.equal(res.status,200);
  assert.equal(res.headers['Content-Type'],'application/pdf');
  assert.equal(res.headers['Cache-Control'],'private, no-store');
  assert.ok(Buffer.isBuffer(res.body));
  assert.equal(res.body.toString(),'%PDF-test');
});

test('RC1059: Produktion darf keinen TESTSERVICE-Blob abrufen',async()=>{
  const endpoint=loadEndpoint();
  const res=await invoke(endpoint,{blob:`rc1059/testservice/aa/${hash}`,host:'wonderful-forest-0f315e310.7.azurestaticapps.net'});
  assert.equal(res.status,409);
  assert.equal(JSON.parse(res.body).code,'ENVIRONMENT_MISMATCH');
});

test('RC1059: REST-Blob-Client übernimmt den echten Content-Type aus Azure',()=>{
  const source=fs.readFileSync(new URL('../api/shared/blob-rest.js',import.meta.url),'utf8');
  assert.match(source,/contentType\s*:\s*res\.headers\.get\(['"]content-type['"]\)/);
});
