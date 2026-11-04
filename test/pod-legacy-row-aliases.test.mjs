import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../api/shared/pod-archive.js',import.meta.url));
const {PDFDocument,PDFArray,PDFRawStream,PDFHexString,decodePDFRawStream}=require('pdf-lib');
const renderers=[require('./pod-archive.js'),require('./pod-archive-rc1432.js')];
const positions=[{type:'SYNTH-PALLET',count:1,weight:123},{packageType:'SYNTH-CARTON',quantity:1,kg:163}];
const signature=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8R8AAAAASUVORK5CYII=','base64');
const record={reference:'SYNTHETIC-ONLY',customer:'Synthetic test',expectedColliCount:2,pickupCollectedColliCount:2,confirmedAt:'2026-01-01T12:00:00Z',accessKey:'a'.repeat(64)};

async function pdfText(bytes){
 const pdf=await PDFDocument.load(bytes),texts=[];
 for(const page of pdf.getPages()){
  const contents=page.node.Contents(),streams=contents instanceof PDFArray?contents.asArray():[contents];
  for(const ref of streams){
   const stream=pdf.context.lookup(ref);
   assert.ok(stream instanceof PDFRawStream);
   const operators=Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
   for(const match of operators.matchAll(/<([A-Fa-f0-9]+)>\s*Tj/g))texts.push(PDFHexString.of(match[1]).decodeText());
  }
 }
 return texts.join('\n');
}

for(const [index,renderer] of renderers.entries()){
 for(const key of ['colli','collis','packages','packageRows']){
  for(const emptyRows of [false,true])test(`renderer ${index}: legacy ${key} positions survive ${emptyRows?'empty':'missing'} canonical rows`,async()=>{
   const input={...record,[key]:structuredClone(positions),...(emptyRows?{rows:[]}:{})},before=structuredClone(input);
   const text=await pdfText(await renderer.createPodPdf(input,signature,'image/png'));
   assert.match(text,/SYNTH-PALLET/,'Existing pallet position must appear in the actual PDF');
   assert.match(text,/SYNTH-CARTON/,'Existing carton position must appear in the actual PDF');
   assert.match(text,/123/);assert.match(text,/163/);
   assert.deepEqual(input,before,'Rendering must not mutate the historical snapshot');
  });
 }
 test(`renderer ${index}: canonical rows take precedence and unavailable details are not invented`,async()=>{
  const canonical=await pdfText(await renderer.createPodPdf({...record,rows:[{type:'SYNTH-CANONICAL',count:2,weight:286}],packages:positions},signature,'image/png'));
  assert.match(canonical,/SYNTH-CANONICAL/);assert.doesNotMatch(canonical,/SYNTH-PALLET|SYNTH-CARTON/);
  const missing=await pdfText(await renderer.createPodPdf(record,signature,'image/png'));
  assert.doesNotMatch(missing,/SYNTH-PALLET|SYNTH-CARTON|286/);
 });
}
