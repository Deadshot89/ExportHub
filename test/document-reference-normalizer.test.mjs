import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const source=fs.readFileSync('assets/document-reference-normalizer.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,String,Object,Array,Set,RegExp}),{filename:'document-reference-normalizer.js'});
  return root.ExportHubDocumentReferenceNormalizer;
}
function plain(value){return JSON.parse(JSON.stringify(value));}

test('extractDocumentReferences recognizes DNC and SIDE formatting variants case-insensitively',()=>{
  const api=load();
  for(const [input,canonical] of [
    ['DNC3019222063','DNC3019222063'],
    ['DNC 3019222063','DNC3019222063'],
    ['DNC-3019222063','DNC3019222063'],
    ['dnc: 3019222063','DNC3019222063'],
    ['SIDE250071282','SIDE250071282'],
    ['SIDE 250071282','SIDE250071282'],
    ['side-250071282','SIDE250071282']
  ]){
    assert.deepEqual(plain(api.extractDocumentReferences(input).map(x=>x.canonical)),[canonical]);
  }
});

test('duplicate occurrences of the same reference remain one unique reference',()=>{
  const api=load();
  const refs=api.extractDocumentReferences('DNC3019222063\nDNC 3019222063\nDNC-3019222063');
  assert.deepEqual(plain(refs),[{type:'DNC',number:'3019222063',canonical:'DNC3019222063'}]);
});

test('normalizedPdfName renames only when exactly one unique DNC or SIDE exists',()=>{
  const api=load();
  assert.deepEqual(plain(api.normalizedPdfName('scan.pdf','foo DNC 3019222063 bar')),{name:'DNC3019222063.pdf',renamed:true,reference:'DNC3019222063',reason:'dncs'});
  assert.deepEqual(plain(api.normalizedPdfName('scan.PDF','foo SIDE-250071282 bar')),{name:'SIDE250071282.pdf',renamed:true,reference:'SIDE250071282',reason:'side'});
});

test('normalizedPdfName preserves original filename for no reference, ambiguous references, or non PDF',()=>{
  const api=load();
  assert.deepEqual(plain(api.normalizedPdfName('Lieferschein.pdf','keine passende Nummer')),{name:'Lieferschein.pdf',renamed:false,reference:null,reason:'none'});
  assert.deepEqual(plain(api.normalizedPdfName('Mehrfach.pdf','DNC3019222063 SIDE250071282')),{name:'Mehrfach.pdf',renamed:false,reference:null,reason:'ambiguous'});
  assert.deepEqual(plain(api.normalizedPdfName('Mehrfach.pdf','DNC3019222063 DNC3019229999')),{name:'Mehrfach.pdf',renamed:false,reference:null,reason:'ambiguous'});
  assert.deepEqual(plain(api.normalizedPdfName('scan.jpg','DNC3019222063')),{name:'scan.jpg',renamed:false,reference:null,reason:'none'});
});

test('printDocumentName hides only a terminal PDF extension for presentation',()=>{
  const api=load();
  assert.equal(api.printDocumentName('DNC3019222063.pdf'),'DNC3019222063');
  assert.equal(api.printDocumentName('SIDE250071282.PDF'),'SIDE250071282');
  assert.equal(api.printDocumentName('datei.pdf.backup'),'datei.pdf.backup');
  assert.equal(api.printDocumentName('bild.png'),'bild.png');
});
