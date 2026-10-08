import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const apiRequire=createRequire(new URL('../api/shared/pod-archive.js',import.meta.url));
const {PDFDocument}=apiRequire('pdf-lib');
const source=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
const start=source.indexOf('async function createPodPdf(');
const end=source.indexOf('async function readAutomaticPodBuffer(',start);
assert.ok(start>=0&&end>start,'POD PDF function missing');
const helpers=source.slice(source.indexOf('function text('),start);
const ctx={require:apiRequire,Buffer,Date,Math,Array,String,Number,JSON,store:{pickupHistory:r=>r.pickupHistory||[],expectedCollis:r=>r.expectedColliCount,pickupCollectedColliCount:r=>r.pickupCollectedColliCount}};
const createPodPdf=vm.runInNewContext(helpers+source.slice(start,end)+'\ncreatePodPdf',ctx);
const signaturePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=','base64');
const record={
  reference:'ABC123',customer:'Testkunde',recipient:'Muster GmbH',
  address:'Musterstrasse 1, 12345 Musterstadt',carrier:'Fedex',confirmedAt:'2026-10-08T12:00:00Z',
  driverName:'Paul',licensePlate:'DU PX 509',loaderName:'Carsten Nellesen',
  expectedColliCount:2,pickupCollectedColliCount:2,
  rows:[{type:'Karton',count:1,weight:12},{type:'Palette',count:1,weight:90}]
};
test('P0 POD: real PDF generated as a valid single-page A4 document',async()=>{
  const bytes=await createPodPdf(record,signaturePng,'image/png');
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),1);
  assert.ok(bytes.length>1000);
  const [page]=pdf.getPages();
  assert.ok(Math.abs(page.getWidth()-595.28)<1);
  assert.ok(Math.abs(page.getHeight()-841.89)<1);
});
test('P0 POD: six pack rows still fit on one page',async()=>{
  const many={...record,rows:Array.from({length:6},(_,i)=>({type:'Karton',count:i+1,weight:12}))};
  const pdf=await PDFDocument.load(await createPodPdf(many,Buffer.from('invalid image'),'image/png'));
  assert.equal(pdf.getPageCount(),1);
});

test('P0 POD: embedded real signature is present in PDF resources',async()=>{
  const pdf=await PDFDocument.load(await createPodPdf(record,signaturePng,'image/png'));
  const page=pdf.getPages()[0];
  const {PDFName}=apiRequire('pdf-lib');
  const resources=page.node.Resources();
  const xobjects=resources.lookup(PDFName.of('XObject'));
  assert.ok(xobjects&&xobjects.size()>0,'Signature image must be embedded, not replaced by placeholder');
});
