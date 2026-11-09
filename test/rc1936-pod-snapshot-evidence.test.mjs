import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';

const require=createRequire(new URL('../api/shared/pod-archive.js',import.meta.url));
const pod=require('./pod-archive.js');
const store=require('./pickup-store.js');
const {PDFDocument,PDFArray,PDFRawStream,PDFHexString,decodePDFRawStream}=require('pdf-lib');
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8R8AAAAASUVORK5CYII=','base64');
const baseline=()=>({
  shipmentId:'SHIP-1',reference:'SYNTH1',recipient:'Hauptadresse',
  customer:'Synthetic Customer GmbH',address:'Testweg 7, 40000 Teststadt',
  rows:[],deliveryNotes:['SIDE000001.pdf'],expectedColliCount:2,
  pickupCollectedColliCount:2,confirmedAt:'2026-11-01T12:00:00.000Z',
  accessKey:'a'.repeat(64)
});
function shipment(rows,id='SHIP-1',ref='SYNTH1'){
  return {id,ref,rows,customerName:'Synthetic Customer GmbH',deliveryFiles:[{name:'SIDE000001.pdf'}]};
}
async function withState(state,fn){
  const saved=store.readJson;
  let readCount=0;
  try{
    store.readJson=async()=>{readCount++;return{value:{state}}};
    const result=await fn();
    return{result,readCount};
  }finally{store.readJson=saved}
}
const clients={team:{getBlockBlobClient(){return{}}}};
async function pdfText(bytes){
 const doc=await PDFDocument.load(bytes),parts=[];
 for(const page of doc.getPages()){
  const contents=page.node.Contents(),streams=contents instanceof PDFArray?contents.asArray():[contents];
  for(const ref of streams){
   const stream=doc.context.lookup(ref);
   assert.ok(stream instanceof PDFRawStream);
   const operators=Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
   for(const match of operators.matchAll(/<([A-Fa-f0-9]+)>\s*Tj/g))
     parts.push(PDFHexString.of(match[1]).decodeText());
  }
 }
 return parts.join('\n');
}

test('RC1936: matching original shipment restores missing PDF positions even when delivery notes already exist',async()=>{
 const input=baseline(),before=structuredClone(input),positions=[{type:'SYNTH-CARTON',count:2,weight:17}];
 const {result,readCount}=await withState({shipments:[shipment(positions)],savedShipments:[]},
   ()=>pod.resolvePodDeliveryNotes(input,clients,'testservice'));
 assert.equal(readCount,1,'having delivery notes must not skip missing packing rows');
 assert.deepEqual(result.rows,positions);
 assert.deepEqual(result.deliveryNotes,input.deliveryNotes);
 assert.deepEqual(input,before,'signed pickup input is immutable');
 const visible=await pdfText(await pod.createPodPdf(result,tinyPng,'image/png'));
 assert.match(visible,/SYNTH-CARTON/);
 assert.match(visible,/Synthetic Customer GmbH/);
 assert.doesNotMatch(visible,/Hauptadresse/);
 assert.ok(visible.indexOf('LIEFERSCHEINE / DELIVERY NOTES')<
   visible.indexOf('SENDUNG ABGEHOLT'),'Delivery notes must precede the signed pickup footer');
});

test('RC1936: contradictory shipment ID, reference or Colli count cannot supply a different shipment position',async()=>{
 const input=baseline();
 const state={shipments:[
   shipment([{type:'WRONG-ID',count:2}],'SHIP-OTHER'),
   shipment([{type:'WRONG-REF',count:2}],'SHIP-1','OTHER1'),
   shipment([{type:'WRONG-COLLI',count:3}])
 ]};
 const {result}=await withState(state,()=>pod.resolvePodDeliveryNotes(input,clients,'production'));
 assert.deepEqual(pod.podRowsOf(result),[],'no foreign or inconsistent package row may be borrowed');
 const visible=await pdfText(await pod.createPodPdf(result,tinyPng,'image/png'));
 assert.match(visible,/Verpackungspositionen nicht uebermittelt/,'blank table requires an explicit warning');
 assert.doesNotMatch(visible,/WRONG-ID|WRONG-REF|WRONG-COLLI/);
});

test('RC1936: ambiguous REF-only historical QR and conflicting versions remain unresolved',async()=>{
 const input={...baseline(),shipmentId:'SYNTH1'};
 const {result}=await withState({shipments:[
   shipment([{type:'FIRST',count:2}],'ID-1'),
   shipment([{type:'SECOND',count:2}],'ID-2')
 ]},()=>pod.resolvePodDeliveryNotes(input,clients,'testservice'));
 assert.deepEqual(result.rows,[],'REF alone cannot choose a different shipment ID');
 const other=await withState({shipments:[
   shipment([{type:'FIRST',count:2}],'SHIP-1'),
   shipment([{type:'SECOND',count:2}],'SHIP-1')
 ]},()=>pod.resolvePodDeliveryNotes(baseline(),clients,'testservice'));
 assert.deepEqual(other.result.rows,[],'conflicting packing versions require manual reconciliation');
});

test('RC1936: multi-truck POD selects only its exact sub-shipment positions',async()=>{
 const input={...baseline(),subShipmentId:'TRUCK-2',expectedColliCount:1,rows:[]};
 const source={id:'SHIP-1',ref:'SYNTH1',rows:[{type:'FULL-SHIPMENT',count:2}],subShipments:[
   {subShipmentId:'TRUCK-1',rows:[{type:'TRUCK-ONE',count:1}]},
   {subShipmentId:'TRUCK-2',rows:[{type:'TRUCK-TWO',count:1}]}
 ]};
 const {result}=await withState({shipments:[source]},()=>pod.resolvePodDeliveryNotes(input,clients,'testservice'));
 assert.equal(result.rows?.[0]?.type,'TRUCK-TWO');
 assert.equal(result.rows.length,1);
});

test('RC1936: long delivery lists continue on A4 annex sheets without splitting the original signature',async()=>{
 const input={...baseline(),rows:Array.from({length:6},(_,i)=>({type:'CARTON-'+i,count:1,weight:10+i})),
   expectedColliCount:6,pickupCollectedColliCount:6,
   deliveryNotes:Array.from({length:34},(_,i)=>'SIDE'+String(250000000+i)+'.pdf')};
 const bytes=await pod.createPodPdf(input,tinyPng,'image/png');
 const pdf=await PDFDocument.load(bytes),visible=await pdfText(bytes);
 assert.ok(pdf.getPageCount()>1,'Overflow must create annex pages, not invisible text');
 for(const page of pdf.getPages()){
   assert.ok(Math.abs(page.getWidth()-595.28)<1);
   assert.ok(Math.abs(page.getHeight()-841.89)<1);
 }
 for(const name of input.deliveryNotes)
   assert.equal(visible.split(name).length-1,1,'Every delivery note must appear exactly once: '+name);
 assert.ok(visible.indexOf('LIEFERSCHEINE / DELIVERY NOTES')<
   visible.indexOf('SENDUNG ABGEHOLT'),'Notes must render above the signed footer');
 assert.match(visible,/Fahrerunterschrift/i);
 assert.match(Buffer.from(bytes).toString('latin1'),/\/Subtype\s*\/Image/,'Signed original ink must remain embedded as an image');
});

test('RC1936: printable PDF labels are readable and original immutable storage contract remains intact',()=>{
 const source=fs.readFileSync(new URL('../api/shared/pod-archive.js',import.meta.url),'utf8');
 assert.match(source,/normal\.widthOfTextAtSize\(pdfText\(name\),9\)/);
 assert.match(source,/draw\(name,x\+col\*colW\+4,firstY-row\*lineHeight,9\)/);
 assert.match(source,/conditions:\s*\{ ifNoneMatch: '\*' \}/);
 assert.match(source,/const existing = await readAutomaticPodBuffer\(accessKey, environment, record\)/);
});

test('RC1936: legacy packagingRows persist through QR pickup and restore exactly two Colli',async()=>{
 const stored=[{type:'SYNTH-PALETTE',count:1,weight:70},{type:'SYNTH-KARTON',count:1,weight:12}];
 assert.deepEqual(pod.podRowsOf({rows:[],packagingRows:stored}),stored);
 assert.equal(store.expectedCollis({packagingRows:stored}),2);
 const source=fs.readFileSync(new URL('../api/pickup-init/index.js',import.meta.url),'utf8');
 assert.match(source,/function rowsOf\(src\)/);
 assert.match(source,/['"]packagingRows['"]/,'QR initialization must preserve this real-world row alias');
 const input=baseline(),before=structuredClone(input);
 const found=await withState({shipments:[shipment([], 'SHIP-1', 'SYNTH1')],savedShipments:[
   {id:'SHIP-1',ref:'SYNTH1',packagingRows:stored}
 ]},()=>pod.resolvePodDeliveryNotes(input,clients,'testservice'));
 assert.deepEqual(found.result.rows,stored);
 assert.deepEqual(input,before);
 const pdf=await pdfText(await pod.createPodPdf(found.result,tinyPng,'image/png'));
 assert.match(pdf,/SYNTH-PALETTE/);
 assert.match(pdf,/SYNTH-KARTON/);
});
