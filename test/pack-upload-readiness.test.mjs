import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadClient(normalizePdfFile){
  const html=fs.readFileSync('assets/pack-notification.js','utf8');
  const entry='  populatePackageTypes();startPage();\n})();';
  assert.ok(html.endsWith(entry),'Pack-Client Test-Einstiegspunkt fehlt');
  const script=html.slice(0,-entry.length)+'  window.__testFileToData=fileToData;\n})();';
  const control={
    addEventListener(){},querySelectorAll(){return[];},
    classList:{add(){},remove(){},toggle(){}},
    value:'',hidden:false,disabled:false
  };
  const document={getElementById(){return control;}};
  const window={
    ExportHubDocumentReferenceNormalizer:{normalizePdfFile},
    addEventListener(){}
  };
  class MockFileReader {
    readAsDataURL(file){
      this.result='data:application/pdf;base64,'+Buffer.from(file.bytes||'%PDF-1.4').toString('base64');
      queueMicrotask(()=>this.onload());
    }
  }
  vm.runInNewContext(script,{window,document,FileReader:MockFileReader,setTimeout,clearTimeout,
    crypto:{randomUUID:()=> 'mock-document-id'},console});
  return window.__testFileToData;
}

test('Packmeldung erfasst PDF trotz nie endender optionaler Normalisierung',async()=>{
  const upload=loadClient(()=>new Promise(()=>{}));
  const file={name:'SIDE250071282.pdf',type:'application/pdf',size:13,bytes:'%PDF-1.4\n%%EOF'};
  const document=await Promise.race([
    upload(file),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('PDF Upload nach 3 Sekunden noch blockiert')),3000))
  ]);
  assert.equal(document.name,file.name);
  assert.equal(document.mimeType,'application/pdf');
  assert.equal(document.id,'mock-document-id');
  assert.match(document.data,/^data:application\/pdf;base64,/);
});

test('Packmeldung meldet zu große Dateien vor dem Lesen',async()=>{
  const upload=loadClient(()=>new Promise(()=>{}));
  await assert.rejects(
    upload({name:'too-big.pdf',type:'application/pdf',size:10*1024*1024+1}),
    /maximal 10 MB/
  );
});
