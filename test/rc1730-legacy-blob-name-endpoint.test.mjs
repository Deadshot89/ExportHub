import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);

function harness({isAdmin=true}={}){
 const target=path.resolve('api/exporthub-document-migrate/index.js');
 const saved=Module._load;
 const writes=[];
 const auth={
  async validateSession(){return{user:{admin:isAdmin},teamDoc:{value:{shipments:[]},etag:'etag-one'}}},
  isAdmin(user){return !!user?.admin},
  async clients(){return{team:'team-blob'}},
  async writeJson(client,state,etag){writes.push({client,state,etag})}
 };
 const docs={
  async migrateLegacyDocuments(){throw new Error('legacy inline migration must not be selected')},
  async repairLegacyBlobDocumentNames(state,opts){return{state:{...state,repaired:true},
   preview:!opts.apply,found:1,examined:1,wouldRename:1,repaired:opts.apply?1:0,
   unresolved:0,invalid:0,oversized:0,failed:0,remaining:opts.apply?0:1,done:!!opts.apply}}
 };
 Module._load=(name,parent,isMain)=>{
  if(name==='../shared/fast-auth-store')return auth;
  if(name==='../shared/document-blob-store')return docs;
  return saved.call(Module,name,parent,isMain);
 };
 delete require.cache[target];
 try{return{run:require(target),writes}}finally{Module._load=saved}
}
async function invoke(run,body,host='wonderful-forest-0f315e310-testservice.centralus.7.azurestaticapps.net'){
 const ctx={res:null,log:{error(){}}};
 await run(ctx,{method:'POST',headers:{host,authorization:'Bearer verified'},body});
 return ctx.res;
}

test('RC1730: admin preview is read-only, not a hidden state write',async()=>{
 const h=harness(),res=await invoke(h.run,{action:'repair-blob-names',environment:'testservice',limit:5});
 assert.equal(res.status,200);assert.equal(h.writes.length,0);
 const body=JSON.parse(res.body);
 assert.equal(body.preview,true);assert.equal(body.repaired,0);assert.equal(body.wouldRename,1);
 assert.doesNotMatch(res.body,/blobName|dataUrl|originalName|sha256/);
});
test('RC1730: explicit apply writes only with saved team ETag',async()=>{
 const h=harness(),res=await invoke(h.run,{action:'repair-blob-names',environment:'testservice',apply:true});
 assert.equal(res.status,200);assert.equal(JSON.parse(res.body).repaired,1);
 assert.equal(h.writes.length,1);assert.equal(h.writes[0].etag,'etag-one');
});
test('RC1730: production domain cannot select testservice repair',async()=>{
 const h=harness(),res=await invoke(h.run,{action:'repair-blob-names',environment:'testservice',apply:true},'exporthub360.com');
 assert.equal(res.status,409);assert.equal(h.writes.length,0);
});
test('RC1730: non-admin has no repair access',async()=>{
 const h=harness({isAdmin:false});
 const res=await invoke(h.run,{action:'repair-blob-names',environment:'testservice',apply:true});
 assert.equal(res.status,403);assert.equal(h.writes.length,0);
});
