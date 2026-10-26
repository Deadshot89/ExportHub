import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {randomBytes} from 'node:crypto';

function load(){
  const source=fs.readFileSync('assets/document-reference-normalizer.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,String,Object,Array,Set,RegExp,Uint8Array,ArrayBuffer,Promise,DecompressionStream}),{filename:'document-reference-normalizer.js'});
  return root.ExportHubDocumentReferenceNormalizer;
}
function plain(value){return JSON.parse(JSON.stringify(value));}
function fileFromBytes(name,bytes,type='application/pdf'){const view=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);return{name,type,size:bytes.length,arrayBuffer:async()=>view};}
function utf16beHex(value){return Buffer.from(String(value),'utf16le').swap16().toString('hex').toUpperCase();}

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

test('normalizePdfFile reads an embedded DNC reference and returns the canonical upload name',async()=>{
  const api=load();
  const bytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 42 >>\nstream\nBT (Delivery note DNC 3019222063) Tj ET\nendstream\nendobj\n%%EOF','latin1');
  const result=await api.normalizePdfFile(fileFromBytes('Scanner Export 4711.pdf',bytes));
  assert.equal(result.name,'DNC3019222063.pdf');
  assert.equal(result.reference,'DNC3019222063');
  assert.equal(result.renamed,true);
});

test('normalizePdfFile reads a SIDE reference from a FlateDecode stream',async()=>{
  const api=load();
  const compressed=zlib.deflateSync(Buffer.from('BT (Packing Slip SIDE-250071282) Tj ET','latin1'));
  const bytes=Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,'latin1'),compressed,Buffer.from('\nendstream\nendobj\n%%EOF','latin1')]);
  const result=await api.normalizePdfFile(fileFromBytes('scan.pdf',bytes));
  assert.equal(result.name,'SIDE250071282.pdf');
  assert.equal(result.reference,'SIDE250071282');
});

test('normalizePdfFile decodes UTF-16BE hex text used by generated PDFs',async()=>{
  const api=load();
  const encoded=utf16beHex('Delivery note DNC 3019222063');
  const bytes=Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${encoded.length+12} >>\nstream\nBT <${encoded}> Tj ET\nendstream\nendobj\n%%EOF`,'latin1');
  const result=await api.normalizePdfFile(fileFromBytes('unicode-scan.pdf',bytes));
  assert.equal(result.name,'DNC3019222063.pdf');
  assert.equal(result.reference,'DNC3019222063');
});

test('normalizePdfFile treats application/x-pdf as a PDF instead of bypassing normalization',async()=>{
  const api=load();
  const bytes=Buffer.from('%PDF-1.4\nBT (SIDE 250071282) Tj ET\n%%EOF','latin1');
  const result=await api.normalizePdfFile(fileFromBytes('legacy.pdf',bytes,'application/x-pdf'));
  assert.equal(result.name,'SIDE250071282.pdf');
  assert.equal(result.reference,'SIDE250071282');
});

test('large FlateDecode streams do not stall the PDF upload normalizer',async()=>{
  const api=load();
  const expanded=Buffer.concat([Buffer.from('BT (Packing Slip SIDE-250071282) Tj ET\n','latin1'),randomBytes(256*1024)]);
  const compressed=zlib.deflateSync(expanded);
  const bytes=Buffer.concat([
    Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,'latin1'),
    compressed,
    Buffer.from('\nendstream\nendobj\n%%EOF','latin1')
  ]);
  let timer;
  try{
    const result=await Promise.race([
      api.normalizePdfFile(fileFromBytes('scanner.pdf',bytes)),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('FlateDecode stalled during delivery-note upload')),4000);})
    ]);
    assert.equal(result.name,'SIDE250071282.pdf');
    assert.equal(result.reference,'SIDE250071282');
  }finally{
    clearTimeout(timer);
  }
});
