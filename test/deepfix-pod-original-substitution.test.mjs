import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const asset=fs.readFileSync('assets/rc1602-official-pod-server-download.js','utf8');
const pdf=label=>new Blob(['%PDF-1.7\n'+label+'\n'+'x'.repeat(1200)],{type:'application/pdf'});
const manual={id:'manual',kind:'manual-uploaded-pod',manualUpload:true,name:'POD_ABC123.pdf',storage:'blob'};
const original={id:'original',kind:'automatic-pod',name:'POD_ABC123_Ladeliste_unterschrieben.pdf',storage:'blob'};
function api(files){
  const window={crypto:webcrypto,ExportHUBDocumentBlob1059:{isBlobDocument:()=>true,
    fetchBlob:async file=>files[file.id]||null}};
  vm.runInNewContext(asset,{window,document:{addEventListener(){}},Blob,Uint8Array,URL,console});
  return window.ExportHUBRC1602OfficialPOD;
}

test('bulk signed-original retrieval cannot substitute a readable manual upload for a missing digital original',async()=>{
  const result=await api({manual:pdf('MANUAL')}).storedSignedBlob({ref:'ABC123',podFiles:[original,manual]},{signedOnly:true});
  assert.equal(result,null);
});

test('bulk signed-original retrieval cannot substitute a manual upload after a digital hash mismatch',async()=>{
  const result=await api({original:pdf('CORRUPTED'),manual:pdf('MANUAL')}).storedSignedBlob({ref:'ABC123',
    podFiles:[{...original,hash:'a'.repeat(64)},manual]},{signedOnly:true});
  assert.equal(result,null);
});

test('manual upload with a signed-looking filename cannot count as a digital original',async()=>{
  const result=await api({manual:pdf('MANUAL')}).storedSignedBlob({ref:'ABC123',podFiles:[
    {...manual,name:'POD_ABC123_Ladeliste_mit_Unterschrift.pdf'}]},{signedOnly:true});
  assert.equal(result,null);
});

test('legacy manual POD kind without a manualUpload flag cannot impersonate a signed original',async()=>{
  const result=await api({manual:pdf('MANUAL')}).storedSignedBlob({ref:'ABC123',podFiles:[
    {...manual,manualUpload:false,name:'POD_ABC123_Ladeliste_mit_Unterschrift.pdf'}]},{signedOnly:true});
  assert.equal(result,null);
});

test('signed-only retrieval preserves original bytes and ordinary manual viewing remains available',async()=>{
  const signed=pdf('SIGNED'),uploaded=pdf('MANUAL'),reader=api({original:signed,manual:uploaded});
  const result=await reader.storedSignedBlob({ref:'ABC123',podFiles:[manual,original]},{signedOnly:true});
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),Buffer.from(await signed.arrayBuffer()));
  assert.equal(await reader.storedSignedBlob({ref:'ABC123',podFiles:[manual]}),uploaded);
});

test('bulk download requests signed-only originals and fails instead of rendering or accepting manual bytes',async()=>{
  const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('async function savedSignedPod(sh){');
  const code=html.slice(start,html.indexOf('\nfunction ',start));
  const reader=api({manual:pdf('MANUAL')});
  const load=new Function('window','fileFormat','ref',code+';return savedSignedPod;')(
    {ExportHUBRC1602OfficialPOD:reader},()=> 'pdf',()=> 'ABC123');
  await assert.rejects(()=>load({ref:'ABC123',podFiles:[original,manual]}));
});
