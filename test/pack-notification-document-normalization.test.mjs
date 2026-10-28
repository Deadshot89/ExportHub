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
function utf16beHex(value){return Buffer.from(String(value),'utf16le').swap16().toString('hex').toUpperCase();}
function hexPdf(text){const encoded=utf16beHex(text);return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${encoded.length+12} >>\nstream\nBT <${encoded}> Tj ET\nendstream\nendobj\n%%EOF`,'latin1');}

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

test('server PDF extractor decodes UTF-16BE hex text references',()=>{
  const pdf=require('../api/shared/pdf-document-reference.js');
  assert.match(pdf.extractPdfText(hexPdf('Delivery note DNC 3019222063')),/DNC 3019222063/);
  const out=pdf.normalizePdfDocument({name:'unicode.pdf',mimeType:'application/pdf'},hexPdf('SIDE 250071282'),'application/pdf');
  assert.equal(out.name,'SIDE250071282.pdf');
});

test('server PDF normalizer accepts application/x-pdf as a PDF MIME alias',()=>{
  const pdf=require('../api/shared/pdf-document-reference.js');
  const out=pdf.normalizePdfDocument({name:'legacy.pdf',mimeType:'application/x-pdf'},plainPdf('DNC 3019222063'),'application/x-pdf');
  assert.equal(out.name,'DNC3019222063.pdf');
  assert.equal(out.documentReference,'DNC3019222063');
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

test('central document storage names the stored PDF after the unique DNC even with incidental SIDE text',async()=>{
  const out=await store('Mehrere Nummern.pdf',plainPdf('DNC3019222063 and SIDE250071282'));
  assert.equal(out.name,'DNC3019222063.pdf');
  assert.equal(out.originalName,'Mehrere Nummern.pdf');
  assert.equal(out.documentReference,'DNC3019222063');
  assert.equal(out.storage,'blob');
  assert.match(out.blobName,/^rc1059\/testservice\//);
});

test('server retains an unambiguous filename DNC instead of an incidental PDF SIDE number',async()=>{
  const out=await store('DNC 3019222063 Scan.pdf',plainPdf('Packing paperwork SIDE250071282'));
  assert.equal(out.name,'DNC3019222063.pdf');
  assert.equal(out.originalName,'DNC 3019222063 Scan.pdf');
  assert.equal(out.documentReference,'DNC3019222063');
  assert.equal(out.storage,'blob');
});

test('server never guesses when filename DNC conflicts with PDF DNC',async()=>{
  const out=await store('DNC 3019222063 Scan.pdf',plainPdf('Delivery note DNC3019229999'));
  assert.equal(out.name,'DNC 3019222063 Scan.pdf');
  assert.equal(out.documentReference,undefined);
});

test('multiple different DNC references remain ambiguous to prevent a wrong file name',async()=>{
  const out=await store('Mehrere Nummern.pdf',plainPdf('DNC3019222063 and DNC3019229999'));
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

test('RC1703: stored SalesPackingSlip PDF with DNC split across TJ glyphs is renamed on server',async()=>{
  const content='BT [(Delivery Note ) 0 (D) -20 (N) -20 (C) (3) (0) (1) (9) (2) (2) (6) (8) (9) (1)] TJ ET';
  const bytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream\nendobj\n%%EOF','latin1');
  const out=await store('SalesPackingSlip-JolantaBatkowska-55132_28102026_084418_828_55253_P.pdf',bytes);
  assert.equal(out.name,'DNC3019226891.pdf');
  assert.equal(out.documentReference,'DNC3019226891');
  assert.match(out.originalName,/^SalesPackingSlip-/);
  assert.equal(out.storage,'blob');
});
