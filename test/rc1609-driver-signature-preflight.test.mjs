import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { signatureJpegBase64 } from './fixtures/rc1609-synthetic-driver-jpeg.mjs';

const require=createRequire(import.meta.url);
const store=require('../api/shared/pickup-store.js');
const accessKey='a'.repeat(64);
function harness(){
  const uploads=[];
  const clients={
    environment:'testservice',
    pods:{getBlockBlobClient:name=>({
      uploadData:async(bytes,options)=>{
        uploads.push({name,bytes:Buffer.from(bytes),options});
      }
    })}
  };
  return {clients,uploads};
}
const dataUrl=(mime,bytes)=>'data:image/'+mime+';base64,'+bytes.toString('base64');

test('RC1609 valid original JPEG is PDF-compatible before immutable blob upload',async()=>{
  const {clients,uploads}=harness(),bytes=Buffer.from(signatureJpegBase64,'base64');
  const result=await store.saveDriverSignature(clients,{accessKey,reference:'SYNTH01'},dataUrl('jpeg',bytes),'1');
  assert.equal(uploads.length,1);
  assert.deepEqual(uploads[0].bytes,bytes);
  assert.equal(uploads[0].options.blobHTTPHeaders.blobContentType,'image/jpeg');
  assert.match(result.signatureBlobName,/driver-signature-1[.]jpg$/);
});

test('RC1609 rejects corrupted JPEG before a pickup signature is stored',async()=>{
  const {clients,uploads}=harness(),broken=Buffer.alloc(256,0x43);
  broken[0]=0xff;broken[1]=0xd8;broken[2]=0xff;
  await assert.rejects(store.saveDriverSignature(clients,{accessKey,reference:'SYNTH02'},dataUrl('jpeg',broken),'1'),e=>e.code==='INVALID_SIGNATURE_IMAGE');
  assert.equal(uploads.length,0);
});

test('RC1609 does not accept a MIME mismatch despite valid image bytes',async()=>{
  const {clients,uploads}=harness(),bytes=Buffer.from(signatureJpegBase64,'base64');
  await assert.rejects(store.saveDriverSignature(clients,{accessKey,reference:'SYNTH03'},dataUrl('png',bytes),'1'),e=>e.code==='INVALID_SIGNATURE_IMAGE');
  assert.equal(uploads.length,0);
});

test('RC1609 rejects unsupported WebP rather than accepting a pickup with an unprintable POD',async()=>{
  const {clients,uploads}=harness(),bytes=Buffer.alloc(256,0x45);
  await assert.rejects(store.saveDriverSignature(clients,{accessKey,reference:'SYNTH04'},dataUrl('webp',bytes),'1'),e=>e.code==='INVALID_SIGNATURE_IMAGE');
  assert.equal(uploads.length,0);
});
