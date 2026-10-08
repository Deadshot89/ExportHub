import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

function fakeContainer(){
  const uploads=[];
  return{
    uploads,
    getBlockBlobClient(name){
      return{
        async uploadData(buffer,options={}){uploads.push({name,buffer:Buffer.from(buffer),options});return{etag:'"1"'};},
        async upload(buffer,_length,options={}){uploads.push({name,buffer:Buffer.from(buffer),options});return{etag:'"1"'};}
      };
    }
  };
}
function dataUrl(buffer){return `data:application/pdf;base64,${buffer.toString('base64')}`;}
function plainPdf(text){return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${text.length+12} >>\nstream\nBT (${text}) Tj ET\nendstream\nendobj\n%%EOF`,'latin1');}
function flatePdf(text){
  const stream=zlib.deflateSync(Buffer.from(`BT (${text}) Tj ET`,'latin1'));
  return Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`,'latin1'),stream,Buffer.from('\nendstream\nendobj\n%%EOF','latin1')]);
}

async function store(name,buffer){
  const mod=require('../api/shared/document-blob-store.js');
  return mod.storeInlineDocument({id:'D1',name,mimeType:'application/pdf',data:dataUrl(buffer)},{environment:'testservice',container:fakeContainer()});
}

test('server PDF normalizer turns extracted DNC text into canonical document metadata',()=>{
  const pdf=require('../api/shared/pdf-document-reference.js');
  assert.equal(pdf.normalizedPdfName('scan.pdf','DNC 3019222063').name,'DNC3019222063.pdf');
  const out=pdf.normalizePdfDocument({name:'scan.pdf',mimeType:'application/pdf'},plainPdf('DNC 3019222063'),'application/pdf');
  assert.equal(out.name,'DNC3019222063.pdf');
  assert.equal(out.documentReference,'DNC3019222063');
});

test('PDF text extractor reads literal and FlateDecode text used for DNC SIDE detection',()=>{
  const pdf=require('../api/shared/pdf-document-reference.js');
  assert.match(pdf.extractPdfText(plainPdf('Delivery note DNC 3019222063 customer copy')),/DNC 3019222063/);
  assert.match(pdf.extractPdfText(flatePdf('Packing Slip SIDE-250071282')),/SIDE-250071282/);
});

test('central document storage renames a text PDF to its unique DNC reference',async()=>{
  const out=await store('scan-4711.pdf',plainPdf('Delivery note DNC 3019222063 customer copy'));
  assert.equal(out.name,'DNC3019222063.pdf');
  assert.equal(out.originalName,'scan-4711.pdf');
  assert.equal(out.documentReference,'DNC3019222063');
});

test('central document storage recognizes SIDE inside a FlateDecode PDF stream',async()=>{
  const out=await store('scanner.pdf',flatePdf('Packing Slip SIDE-250071282'));
  assert.equal(out.name,'SIDE250071282.pdf');
  assert.equal(out.documentReference,'SIDE250071282');
});

test('central document storage preserves original name when no DNC or SIDE is recognized',async()=>{
  const out=await store('Lieferschein Kunde.pdf',plainPdf('Delivery note 47110000 without supported reference prefix'));
  assert.equal(out.name,'Lieferschein Kunde.pdf');
  assert.equal(out.documentReference,undefined);
});

test('central document storage preserves original name when PDF contains ambiguous references',async()=>{
  const out=await store('Mehrere Nummern.pdf',plainPdf('DNC3019222063 and SIDE250071282'));
  assert.equal(out.name,'Mehrere Nummern.pdf');
  assert.equal(out.documentReference,undefined);
});

test('externalizeDocumentCollections applies the same PDF naming rule to shipment and pack documents',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const container=fakeContainer();
  const state={
    shipments:[{id:'S1',deliveryFiles:[{id:'A',name:'a.pdf',mimeType:'application/pdf',data:dataUrl(plainPdf('DNC 3019222063'))}]}],
    packNotifications:[{id:'P1',documents:[{id:'B',name:'b.pdf',mimeType:'application/pdf',data:dataUrl(plainPdf('SIDE 250071282'))}]}]
  };
  const result=await mod.externalizeDocumentCollections(state,{environment:'testservice',container});
  assert.equal(result.state.shipments[0].deliveryFiles[0].name,'DNC3019222063.pdf');
  assert.equal(result.state.packNotifications[0].documents[0].name,'SIDE250071282.pdf');
});
