import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {externalizePackMutationDocuments}=require('../api/pack-notification/index.js');

function originalPdf(name='Original.pdf'){
  return{id:'pdf-1',name,mimeType:'application/pdf',size:12,data:'data:application/pdf;base64,JVBERi0xLjQK'};
}
function storedPdf(file){
  const {data,dataUrl,base64,payload,content,...rest}=file;
  return{...rest,storage:'blob',blobName:'rc1059/testservice/aa/'+'a'.repeat(64),sha256:'a'.repeat(64)};
}

test('pack draft externalization touches only its new draft and preserves historic shipment bytes',async()=>{
  const historic=originalPdf('Historical.pdf');
  const currentState={shipments:[{id:'old-shipment',deliveryFiles:[historic]}],packDrafts:[]};
  const next={shipments:structuredClone(currentState.shipments),packDrafts:[{id:'draft-new',documents:[originalPdf()]}]};
  const result={state:next,draft:structuredClone(next.packDrafts[0]),packDocumentScope:{root:'packDrafts',id:'draft-new'}};
  let calls=0;
  const externalize=async(state,opts)=>{
    calls++;
    assert.deepEqual(Object.keys(state),['packDrafts']);
    assert.deepEqual(Object.keys(opts.currentState),['packDrafts']);
    assert.equal(opts.environment,'testservice');
    assert.equal(opts.currentState.packDrafts.length,0);
    const draft=state.packDrafts[0];
    return{state:{packDrafts:[{...draft,documents:draft.documents.map(storedPdf)}]},stats:{externalized:1}};
  };
  const saved=await externalizePackMutationDocuments(result,currentState,'testservice',externalize);
  assert.equal(calls,1);
  assert.equal(saved.state.shipments[0].deliveryFiles[0].data,historic.data);
  assert.equal(saved.state.packDrafts[0].documents[0].storage,'blob');
  assert.equal(saved.state.packDrafts[0].documents[0].data,undefined);
  assert.equal(result.draft.documents[0].storage,'blob');
  assert.equal(result.draft.documents[0].data,undefined);
});

test('updating existing draft passes its own previous document metadata only',async()=>{
  const prior={id:'draft-1',documents:[storedPdf(originalPdf())]};
  const priorState={packDrafts:[prior,{id:'draft-2',documents:[originalPdf('Unrelated.pdf')]}]};
  const next={packDrafts:[{id:'draft-1',documents:[storedPdf(originalPdf())]},priorState.packDrafts[1]]};
  const result={state:next,draft:structuredClone(next.packDrafts[0]),packDocumentScope:{root:'packDrafts',id:'draft-1'}};
  await externalizePackMutationDocuments(result,priorState,'testservice',async(state,opts)=>{
    assert.equal(state.packDrafts.length,1);
    assert.equal(opts.currentState.packDrafts.length,1);
    assert.equal(opts.currentState.packDrafts[0].id,'draft-1');
    return{state};
  });
  assert.equal(next.packDrafts[1].documents[0].data,priorState.packDrafts[1].documents[0].data);
});

test('submission externalizes only its own notification and refreshes returned metadata',async()=>{
  const row={id:'notice-1',documents:[originalPdf()]};
  const result={state:{packNotifications:[row],packDrafts:[]},notification:structuredClone(row),packDocumentScope:{root:'packNotifications',id:'notice-1'}};
  await externalizePackMutationDocuments(result,{},'production',async(state,opts)=>{
    assert.deepEqual(Object.keys(state),['packNotifications']);
    assert.equal(opts.environment,'production');
    return{state:{packNotifications:[{id:'notice-1',documents:[storedPdf(state.packNotifications[0].documents[0])] }]}};
  });
  assert.equal(result.notification.documents[0].storage,'blob');
  assert.equal(result.notification.documents[0].data,undefined);
});

test('normal non-Pack mutations still use full document externalization',async()=>{
  const next={shipments:[],packDrafts:[]};
  const result={state:next};
  let called=false;
  const externalized=await externalizePackMutationDocuments(result,{},'production',async(value,opts)=>{
    called=true;
    assert.equal(value,next);
    assert.equal(opts.environment,'production');
    return{state:value};
  });
  assert.equal(called,true);
  assert.equal(externalized.state,next);
});

test('missing or unexpected Pack scope is rejected without losing document bytes',async()=>{
  const next={packDrafts:[{id:'valid',documents:[originalPdf()]}]};
  for(const scope of [{root:'shipments',id:'valid'},{root:'packDrafts',id:'wrong'},{root:'packDrafts',id:''}]){
    await assert.rejects(()=>externalizePackMutationDocuments({state:next,packDocumentScope:scope},{},'production',async()=>{throw Error('must never write')}),/Pack-Dokumentbereich/);
  }
  assert.equal(next.packDrafts[0].documents[0].data,originalPdf().data);
});
