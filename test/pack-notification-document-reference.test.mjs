import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadNormalizer(){
  const code=fs.readFileSync(new URL('../assets/document-reference-normalizer.js',import.meta.url),'utf8');
  const sandbox={globalThis:{}};
  vm.createContext(sandbox);
  vm.runInContext(code,sandbox,{filename:'document-reference-normalizer.js'});
  return sandbox.globalThis.ExportHubDocumentReferenceNormalizer;
}

test('DNC und SIDE werden kanonisch erkannt und nur bei eindeutigem Treffer umbenannt',()=>{
  const api=loadNormalizer();
  for(const [text,expected] of [
    ['DNC3019222063','DNC3019222063.pdf'],
    ['DNC 3019222063','DNC3019222063.pdf'],
    ['DNC-3019222063','DNC3019222063.pdf'],
    ['dnc 3019222063','DNC3019222063.pdf'],
    ['SIDE250071282','SIDE250071282.pdf'],
    ['SIDE 250071282','SIDE250071282.pdf']
  ]){
    const result=api.normalizedPdfName('Scan.pdf',text);
    assert.equal(result.name,expected);
    assert.equal(result.renamed,true);
  }
  assert.equal(api.normalizedPdfName('Original.pdf','DNC 3019222063 und DNC3019222063').name,'DNC3019222063.pdf');
  assert.equal(api.normalizedPdfName('Original.pdf','DNC3019222063 SIDE250071282').name,'Original.pdf');
  assert.equal(api.normalizedPdfName('Original.pdf','DNC3019222063 DNC3019222475').name,'Original.pdf');
  assert.equal(api.normalizedPdfName('Original.pdf','kein Lieferscheinbezug').name,'Original.pdf');
  assert.equal(api.normalizedPdfName('Bild.png','DNC3019222063').name,'Bild.png');
});

test('Druckname blendet nur terminales .pdf aus',()=>{
  const api=loadNormalizer();
  assert.equal(api.printDocumentName('DNC3019222063.pdf'),'DNC3019222063');
  assert.equal(api.printDocumentName('SIDE250071282.PDF'),'SIDE250071282');
  assert.equal(api.printDocumentName('Lieferschein.png'),'Lieferschein.png');
});
