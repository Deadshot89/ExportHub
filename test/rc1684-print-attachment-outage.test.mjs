import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function printRuntime(fetchBlob){
  const source=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  const start=source.indexOf('const rc1340Runtime=`');
  const end=source.indexOf('\n`;',start);
  assert.ok(start>=0&&end>start,'Original-Druckruntime im Release-Build nicht gefunden');
  const script=vm.runInNewContext(source.slice(start,end+3)+'\nrc1340Runtime');
  const printed=[];
  const revoked=[];
  const window={
    ExportHUBDocumentBlob1059:{
      legacyUrl(){return''},
      isBlobDocument(file){return file.storage==='blob'},
      blobName(file){return file.blobName},
      fetchBlob
    },
    __EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__({name}){printed.push(name)}
  };
  const context={
    window,
    q:value=>String(value??'').trim(),
    low:value=>String(value??'').trim().toLowerCase(),
    arr:value=>Array.isArray(value)?value:[],
    URL:{createObjectURL(){return'blob:test'},revokeObjectURL(url){revoked.push(url)}}
  };
  vm.runInNewContext(script,context);
  return{api:window.ExportHUBRC1340AttachmentPrint,printed,revoked,source};
}

function shipment(){
  return{deliveryFiles:[
    {id:'broken',name:'Nicht_erreichbar.pdf',storage:'blob',blobName:'broken',contentType:'application/pdf'},
    {id:'good',name:'Verfuegbar.pdf',storage:'blob',blobName:'good',contentType:'application/pdf'}
  ]};
}

test('RC1684: ein umgeleiteter Lieferschein blockiert nicht den Druck der verfügbaren Original-PDFs',async()=>{
  const {api,printed,revoked}=printRuntime(async file=>{
    if(file.blobName==='broken'){
      const error=new Error('Azure API login redirect');
      error.code='AZURE_ROUTE_BLOCKED';
      throw error;
    }
    return new Blob(['%PDF-1.4\nRC1684 TEST PDF\n'],{type:'application/pdf'});
  });
  const jobs=await api.prepare(shipment());
  assert.deepEqual(Array.from(jobs,item=>item.name),['Verfuegbar.pdf']);
  assert.deepEqual(Array.from(jobs.failed,item=>item.name),['Nicht_erreichbar.pdf']);
  assert.equal(jobs.failed[0].code,'AZURE_ROUTE_BLOCKED');
  const printedCount=await api.printPrepared(jobs);
  assert.equal(printedCount,1);
  assert.deepEqual(printed,['Verfuegbar.pdf']);
  assert.equal(revoked.length,1);
});

test('RC1684: vollständig erreichbare Lieferscheine bleiben vollständig druckbar',async()=>{
  const {api,printed}=printRuntime(async()=>(new Blob(['%PDF-1.4\nRC1684 TEST PDF\n'],{type:'application/pdf'})));
  const jobs=await api.prepare(shipment());
  assert.equal(jobs.length,2);
  assert.equal(jobs.failed.length,0);
  assert.equal(await api.printPrepared(jobs),2);
  assert.deepEqual(printed,['Nicht_erreichbar.pdf','Verfuegbar.pdf']);
});
