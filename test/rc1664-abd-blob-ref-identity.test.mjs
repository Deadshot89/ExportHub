import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const store=require('../api/shared/document-blob-store.js');
const bytes=Buffer.from('%PDF-1.4\nRC1664-VALID-NEW\n%%EOF');
const inline='data:application/pdf;base64,'+bytes.toString('base64');
const file=(id='ABD-FILE')=>({id,name:'ABD.pdf',data:inline,mimeType:'application/pdf'});
const prior=(id='ABD-FILE')=>({id,name:'ABD.pdf',storage:'blob',blobName:'rc1059/production/cc/'+'c'.repeat(64),sha256:'c'.repeat(64),size:20,mimeType:'application/pdf'});
function container(){
  const uploads=[];
  return{uploads,getBlockBlobClient(name){return{async uploadData(buf,opts){uploads.push({name,bytes:Buffer.from(buf),opts});return {etag:'"new"'}}}}};
}
for(const root of ['shipments','savedShipments','sharedShipments']){
  test('RC1664: '+root+' rejects an old ABD from another REF with recycled technical ID',async()=>{
    const c=container();
    const currentState={[root]:[{id:'LEGACY-DUPLICATE-ID',ref:'8BAGGQ',abdFiles:[prior()]}]};
    const incoming={[root]:[{id:'LEGACY-DUPLICATE-ID',ref:'9Z7L82',abdFiles:[file()]}]};
    const result=await store.externalizeDocumentCollections(incoming,{environment:'production',container:c,currentState});
    const actual=result.state[root][0].abdFiles[0],hash=crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(c.uploads.length,1,'a different reference must upload its own original');
    assert.equal(actual.storage,'blob');
    assert.equal(actual.sha256,hash);
    assert.notEqual(actual.blobName,prior().blobName,'the other shipment blob must not be stolen');
    assert.equal(actual.data,undefined);
    assert.equal(result.stats.blobReused,0);
    assert.equal(result.stats.externalized,1);
    assert.equal(currentState[root][0].abdFiles[0].blobName,prior().blobName,'the other original stays unchanged');
  });
}
test('RC1664: two refs with same editor ID retain distinct historical blob pointers',async()=>{
  const c=container(),other=Object.assign(prior(),{sha256:'d'.repeat(64),blobName:'rc1059/production/dd/'+'d'.repeat(64)});
  const state={sharedShipments:[
    {id:'OLD-ID',ref:'8BAGGQ',abdFiles:[prior()]},
    {id:'OLD-ID',ref:'9Z7L82',abdFiles:[other]}
  ]};
  const input={sharedShipments:[
    {id:'OLD-ID',ref:'8BAGGQ',abdFiles:[file()]},
    {id:'OLD-ID',ref:'9Z7L82',abdFiles:[file()]}
  ]};
  const r=await store.externalizeDocumentCollections(input,{currentState:state,environment:'production',container:c});
  const one=r.state.sharedShipments[0].abdFiles[0],two=r.state.sharedShipments[1].abdFiles[0];
  assert.equal(one.blobName,prior().blobName);
  assert.equal(two.blobName,other.blobName);
  assert.notEqual(one.blobName,two.blobName);
  assert.equal(c.uploads.length,0);
  assert.equal(r.stats.blobReused,2);
});
test('RC1664: same REF keeps a confirmed blob across changed editor IDs',async()=>{
  const c=container();
  const r=await store.externalizeDocumentCollections(
    {savedShipments:[{id:'NEW-EDITOR-ID',ref:'9Z7L82',abdFiles:[file()]}]},
    {currentState:{savedShipments:[{id:'OLD-EDITOR-ID',ref:'9Z7L82',abdFiles:[prior()]}]},environment:'production',container:c}
  );
  assert.equal(r.state.savedShipments[0].abdFiles[0].blobName,prior().blobName);
  assert.equal(c.uploads.length,0);
});
test('RC1664: legacy ID-only records keep existing safe fallback behavior',async()=>{
  const c=container();
  const r=await store.externalizeDocumentCollections(
    {shipments:[{id:'OLD-ID',abdFiles:[file()]}]},
    {currentState:{shipments:[{id:'OLD-ID',abdFiles:[prior()]}]},environment:'production',container:c}
  );
  assert.equal(r.state.shipments[0].abdFiles[0].blobName,prior().blobName);
  assert.equal(c.uploads.length,0);
});
