import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/document-blob-store.js');
const legacy='SalesPackingSlip-Operator-123_29102026_120000_001_789_P.pdf';
function pdf(content){
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nstream\nBT ('+content+') Tj ET\nendstream\nendobj\n%%EOF','latin1');
}
function attachment(bytes,environment='testservice'){
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  return {id:'delivery-doc-1',name:legacy,storage:'blob',blobName:'rc1059/'+environment+'/'+hash.slice(0,2)+'/'+hash,sha256:hash,size:bytes.length,mimeType:'application/pdf',customerAvisVisible:true,customerVisible:false,source:'pack_notification'};
}
function container(bytes,{oversize=false,fail=false}={}){
  let downloaded=0,metadata=0;
  return {
    get reads(){return downloaded},
    get checks(){return metadata},
    getBlockBlobClient(){
      return {
        async getProperties(){metadata++;if(fail)throw new Error('simulated storage failure');return{contentLength:oversize?11*1024*1024:bytes.length}},
        async downloadToBuffer(){downloaded++;return Buffer.from(bytes)}
      };
    }
  };
}
function stateFor(file){return{schemaVersion:3,state:{shipments:[{ref:'ABC123',deliveryFiles:[file]}]}}}

test('RC1730: safe preview examines existing Blob PDF but never mutates metadata',async()=>{
  const bytes=pdf('Delivery Note DNC 3019222063'),original=attachment(bytes),state=stateFor(original),mock=container(bytes);
  const result=await store.repairLegacyBlobDocumentNames(state,{environment:'testservice',container:mock});
  assert.equal(result.found,1);
  assert.equal(result.examined,1);
  assert.equal(result.wouldRename,1);
  assert.equal(result.repaired,0);
  assert.equal(result.preview,true);
  assert.equal(mock.reads,1);
  assert.deepEqual(state.state.shipments[0].deliveryFiles[0],original);
  assert.deepEqual(result.state,state);
});
test('RC1730: opt-in repair changes name only and retains PDF Blob, access flags and original state',async()=>{
  const bytes=pdf('Lieferschein DNC3019222063'),doc=attachment(bytes),original=stateFor(doc),mock=container(bytes);
  const result=await store.repairLegacyBlobDocumentNames(original,{environment:'testservice',container:mock,apply:true});
  assert.equal(result.found,1);assert.equal(result.wouldRename,1);assert.equal(result.repaired,1);
  assert.equal(result.done,true);assert.equal(result.remaining,0);
  const file=result.state.state.shipments[0].deliveryFiles[0];
  assert.equal(file.name,'DNC3019222063.pdf');
  assert.equal(file.originalName,legacy);
  assert.equal(file.documentReference,'DNC3019222063');
  for(const key of ['id','blobName','sha256','storage','size','customerAvisVisible','customerVisible','source'])
    assert.equal(file[key],doc[key],key+' must not change');
  assert.deepEqual(original.state.shipments[0].deliveryFiles[0],doc,'input state remains untouched');
});
test('RC1730: PDF with conflicting delivery-note numbers is never silently renamed',async()=>{
  const bytes=pdf('DNC3019222063 and DNC3019229999'),mock=container(bytes);
  const result=await store.repairLegacyBlobDocumentNames(stateFor(attachment(bytes)),{environment:'testservice',container:mock,apply:true});
  assert.equal(result.repaired,0);assert.equal(result.unresolved,1);assert.equal(result.done,false);
  assert.equal(result.state.state.shipments[0].deliveryFiles[0].name,legacy);
});
test('RC1730: mismatched environment and forged Blob digest never trigger a download',async()=>{
  const bytes=pdf('DNC3019222063'),mock=container(bytes);
  const cross=await store.repairLegacyBlobDocumentNames(stateFor(attachment(bytes,'production')),{environment:'testservice',container:mock,apply:true});
  assert.equal(cross.invalid,1);assert.equal(mock.checks,0);
  const bad=attachment(bytes);bad.sha256='f'.repeat(64);
  const tampered=await store.repairLegacyBlobDocumentNames(stateFor(bad),{environment:'testservice',container:mock,apply:true});
  assert.equal(tampered.invalid,1);assert.equal(mock.reads,0);
});
test('RC1730: oversized Blob is skipped before reading its PDF bytes',async()=>{
  const bytes=pdf('DNC3019222063'),mock=container(bytes,{oversize:true});
  const result=await store.repairLegacyBlobDocumentNames(stateFor(attachment(bytes)),{environment:'testservice',container:mock,apply:true});
  assert.equal(result.oversized,1);assert.equal(result.repaired,0);assert.equal(mock.reads,0);
});
test('RC1730: missing Blob causes bounded failure, not a false success',async()=>{
  const bytes=pdf('DNC3019222063'),mock=container(bytes,{fail:true});
  const result=await store.repairLegacyBlobDocumentNames(stateFor(attachment(bytes)),{environment:'testservice',container:mock,apply:true});
  assert.equal(result.failed,1);assert.equal(result.done,false);assert.equal(result.repaired,0);
});
test('RC1730: repair batch honors limit and preserves all other shipments',async()=>{
  const a=pdf('DNC3019222063'),doc=attachment(a);
  const state={shipments:[{ref:'ABC123',deliveryFiles:[doc,{...doc,id:'second'}]}]};
  const result=await store.repairLegacyBlobDocumentNames(state,{environment:'testservice',container:container(a),apply:true,limit:1});
  assert.equal(result.found,2);assert.equal(result.examined,1);assert.equal(result.repaired,1);
  assert.equal(result.remaining,1);assert.equal(result.done,false);
  assert.equal(result.state.shipments[0].deliveryFiles[1].name,legacy);
});
