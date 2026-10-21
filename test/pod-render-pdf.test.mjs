import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const apiRequire=createRequire(new URL('../api/shared/pod-archive.js',import.meta.url));
const {PDFDocument}=apiRequire('pdf-lib');
const source=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
const start=source.indexOf('async function createPodPdf(');
const end=source.indexOf('async function readAutomaticPodBuffer(',start);
assert.ok(start>=0&&end>start,'POD PDF function missing');
const helpers=source.slice(source.indexOf('function text('),start);
const storeStub={
  pickupHistory:r=>r.pickupHistory||[],
  expectedCollis:r=>r.expectedColliCount,
  pickupCollectedColliCount:r=>r.pickupCollectedColliCount,
  err:(code,message,status)=>Object.assign(new Error(message),{code,status})
};
const createPodPdf=new Function('require','Buffer','store',helpers+source.slice(start,end)+'\nreturn createPodPdf;')(apiRequire,Buffer,storeStub);
const signaturePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8R8AAAAASUVORK5CYII=','base64');
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
  const pdf=await PDFDocument.load(await createPodPdf(many,signaturePng,'image/png'));
  assert.equal(pdf.getPageCount(),1);
});

test('P0 POD: embedded real signature is present as a PDF image object',async()=>{
  const bytes=await createPodPdf(record,signaturePng,'image/png');
  const raw=bytes.toString('latin1');
  assert.match(raw,/\/Subtype\s*\/Image/,'Signature image must be embedded, not replaced by placeholder');
});

test('RC1600 P0 / 8LSUHW: long signed loading list keeps all packing positions and delivery notes on A4 annex pages',async()=>{
  const many={...record,
    rows:Array.from({length:28},(_,i)=>({type:'Karton mit umfangreicher Warenbeschreibung '+(i+1),count:i+1,weight:10+i})),
    deliveryNotes:Array.from({length:115},(_,i)=>'SIDE250071'+String(i).padStart(4,'0')+'.pdf')
  };
  const pdf=await PDFDocument.load(await createPodPdf(many,signaturePng,'image/png'));
  assert.ok(pdf.getPageCount()>=4,'Positionen und Lieferscheine brauchen echte Fortsetzungsseiten statt Ueberlappung');
  for(const page of pdf.getPages()){
    assert.ok(Math.abs(page.getWidth()-595.28)<1,'every sheet must be A4');
    assert.ok(Math.abs(page.getHeight()-841.89)<1,'every sheet must be A4');
  }
});

test('RC1600 P0: invalid signature must stop PDF creation instead of faking an acknowledgement',async()=>{
  await assert.rejects(
    createPodPdf(record,Buffer.from('invalid-signature'),'image/png'),
    /POD_SIGNATURE_IMAGE_INVALID|gespeicherte Fahrerunterschrift/
  );
});

test('RC1600 P0: signed original blobs are preserved by immutable hash-backed revisions',()=>{
  assert.match(source,/automatic\/' \+ hash \+ '-' \+ safeFilePart\(name\)/);
  assert.match(source,/ifNoneMatch: '\*'/);
  assert.match(source,/POD_BLOB_INTEGRITY_FAILED/);
  assert.match(source,/RC1600-SIGNED-LOADING-LIST-V4/);
});

test('RC1600 8LSUHW: stored PNG signature survives an incorrect historical JPEG MIME tag',async()=>{
  const bytes=await createPodPdf(record,signaturePng,'image/jpeg');
  const pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),1);
  assert.match(bytes.toString('latin1'),/\/Subtype\s*\/Image/,'Original driver image must be embedded');
});

test('RC1609 P0: short browser-style JPEG signature in a nonzero-offset Node Buffer embeds unchanged',async()=>{
  const original=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6pooooA//2Q==','base64');
  const slab=Buffer.allocUnsafe(original.length+79);
  original.copy(slab,37);
  const window=slab.subarray(37,37+original.length);
  assert.ok(window.byteOffset>0,'source byte offset is nonzero');
  const before=Buffer.from(window);
  const probe=await PDFDocument.create();
  await probe.embedJpg(Uint8Array.from(window));
  const bytes=await createPodPdf(record,window,'image/jpeg');
  const parsed=await PDFDocument.load(bytes);
  assert.ok(parsed.getPageCount()>=1);
  assert.match(bytes.toString('latin1'),/\/Subtype\s*\/Image/);
  assert.deepEqual(window,before,'signed original bytes must remain unmodified');
  assert.match(source,/Uint8Array\.from\(signatureBytes\)/);
});
