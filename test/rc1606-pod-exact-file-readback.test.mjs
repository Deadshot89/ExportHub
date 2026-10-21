import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';

const require=createRequire(import.meta.url);
const archive=require('../api/shared/pod-archive.js');
const store=require('../api/shared/pickup-store.js');
const access=require('../api/shared/public-access-store.js');
const pickupPod=require('../api/pickup-pod/index.js');

const serverSource=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
const endpointSource=fs.readFileSync(new URL('../api/pickup-pod/index.js',import.meta.url),'utf8');
const key='a'.repeat(64);
const oldPdf=Buffer.from('%PDF-1.7\\nIMMUTABLE_OLD_SIGNED_POD\\n');
const currentPdf=Buffer.from('%PDF-1.7\\nCANONICAL_CURRENT_SIGNED_POD\\n');
const oldFile={
  id:'automatic-pod-original',remoteId:'legacy-document-alias',
  kind:'automatic-pod',layoutVersion:'RC1595',
  blobName:'rc995/testservice/original/automatic/immutable.pdf',
  size:oldPdf.length
};
const currentFile={
  id:'automatic-pod-current',kind:'automatic-pod',
  layoutVersion:archive.POD_PDF_LAYOUT_VERSION,
  blobName:'rc995/testservice/current/automatic/canonical.pdf',
  size:currentPdf.length
};

test('RC1606: exact historical POD ID and remote alias return original signed bytes, never a new version',async()=>{
  const saved={getRecord:store.getRecord,readBuffer:store.readBuffer};
  const record={reference:'8LSUHW',confirmedAt:'2026-10-21T15:00:00Z',signatureBlobName:'original-signature',podFiles:[oldFile,currentFile]};
  const snapshot=JSON.stringify(record),reads=[];
  try{
    store.getRecord=async()=>({record,clients:{pods:{getBlobClient:(name)=>{reads.push(name);return {name};}}}});
    store.readBuffer=async blob=>({buffer:blob.name===oldFile.blobName?oldPdf:currentPdf});
    const historical=await archive.getPodDownload(key,'testservice',oldFile.id);
    assert.deepEqual(historical.buffer,oldPdf);
    assert.equal(historical.file.id,oldFile.id);
    const alias=await archive.getPodDownload(key,'testservice',oldFile.remoteId);
    assert.deepEqual(alias.buffer,oldPdf);
    assert.equal(alias.file.id,oldFile.id);
    const current=await archive.getPodDownload(key,'testservice',currentFile.id);
    assert.deepEqual(current.buffer,currentPdf);
    assert.deepEqual(reads,[oldFile.blobName,oldFile.blobName,currentFile.blobName]);
    assert.equal(JSON.stringify(record),snapshot,'original signed record and file metadata must be immutable');
  }finally{store.getRecord=saved.getRecord;store.readBuffer=saved.readBuffer}
});

test('RC1606: unknown, retired, and empty-blob named IDs fail closed; no automatic fallback',async()=>{
  const saved={getRecord:store.getRecord,readBuffer:store.readBuffer};
  let blobReads=0;
  const record={reference:'8LSUHW',podFiles:[oldFile,currentFile]};
  try{
    store.getRecord=async()=>({record,clients:{pods:{getBlobClient:()=>{blobReads++;throw Error('Unexpected blob access');}}}});
    store.readBuffer=async()=>{throw Error('Unexpected blob read')};
    await assert.rejects(archive.getPodDownload(key,'testservice','retired-original-id'),e=>e.code==='POD_FILE_NOT_FOUND'&&e.status===404);
    assert.equal(blobReads,0);
    record.podFiles=[{id:'no-blob',kind:'automatic-pod',layoutVersion:'RC1499'}];
    await assert.rejects(archive.getPodDownload(key,'testservice','no-blob'),e=>e.code==='POD_FILE_NOT_STORED'&&e.status===404);
    assert.equal(blobReads,0);
    assert.match(serverSource,/if \(requestedId && !file\)/);
    assert.match(serverSource,/if \(!requestedId && !isCurrentAutomaticPod\(file\)/,
      'canonical requests without a named ID must still regenerate outdated PDFs');
  }finally{store.getRecord=saved.getRecord;store.readBuffer=saved.readBuffer}
});

test('RC1606: authenticated pickup endpoint respects historical remoteId, not current canonical replacement',async()=>{
  const saved={resolve:access.resolve,getRecord:store.getRecord,pickupComplete:store.pickupComplete,readBuffer:store.readBuffer};
  const record={reference:'8LSUHW',confirmedAt:'2026-10-21T15:00:00Z',signatureBlobName:'original-signature',podFiles:[oldFile,currentFile]};
  try{
    access.resolve=async()=>({resourceKey:key,environment:'testservice'});
    store.getRecord=async()=>({record,clients:{pods:{getBlobClient:(name)=>({name})}}});
    store.pickupComplete=()=>true;
    store.readBuffer=async blob=>({buffer:blob.name===oldFile.blobName?oldPdf:currentPdf});
    const ctx={log:{error(){}}};
    await pickupPod(ctx,{method:'GET',query:{token:'controlled-valid-token',file:oldFile.remoteId},headers:{}});
    assert.equal(ctx.res.status,200);
    assert.equal(ctx.res.headers['Content-Type'],'application/pdf');
    assert.deepEqual(ctx.res.body,oldPdf);
    assert.match(endpointSource,/text\(x&&x\.remoteId\)===fileId/);
  }finally{
    access.resolve=saved.resolve;store.getRecord=saved.getRecord;
    store.pickupComplete=saved.pickupComplete;store.readBuffer=saved.readBuffer;
  }
});
