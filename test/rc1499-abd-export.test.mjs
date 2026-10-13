import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const apiRequire=createRequire(new URL('../api/shared/abd-analysis-export.js',import.meta.url));
const exporter=apiRequire('./abd-analysis-export.js');
const ExcelJS=apiRequire('exceljs');
const {extractPdfText}=apiRequire('./customer-avis-document-content.js');

function snapshot(){
  return{
    header:{
      invoiceNumber:'INV-42',invoiceDate:'2026-10-12',customer:'Musterkunde GmbH',recipient:'Empfang GmbH',
      destinationCountry:'CH',invoiceTotal:300,currency:'EUR'
    },
    groups:[
      {key:'39269097|CN',commodityCode:'39269097',originCountry:'CN',value:125.5,currency:'EUR',positionCount:2,status:'complete',warnings:[]},
      {key:'73181595|DE',commodityCode:'73181595',originCountry:'DE',value:174.5,currency:'EUR',positionCount:1,status:'complete',warnings:[]}
    ],
    positions:[
      {position:'10',itemNumber:'A-1',description:'Kunststoffteil',commodityCode:'39269097',originCountry:'CN',quantity:10,netMassKg:2.5,grossMassKg:2.8,value:100,currency:'EUR',source:'invoice.xlsx',confirmed:true},
      {position:'20',itemNumber:'A-2',description:'Kunststoffteil 2',commodityCode:'39269097',originCountry:'CN',quantity:5,netMassKg:1.2,grossMassKg:1.4,value:25.5,currency:'EUR',source:'invoice.xlsx',confirmed:true},
      {position:'30',itemNumber:'B-1',description:'Schraube',commodityCode:'73181595',originCountry:'DE',quantity:25,netMassKg:4,grossMassKg:4.4,value:174.5,currency:'EUR',source:'invoice.xlsx',confirmed:true}
    ],
    unassigned:[],
    totals:{invoiceTotal:300,groupedTotal:300,unassignedKnownValue:0,accountedTotal:300,difference:0,currency:'EUR',currencies:['EUR'],currencyCompatible:true,valueCoverageComplete:true,unassignedCount:0},
    review:{groupCount:2,readyGroupCount:2,reviewGroupCount:0,unassignedCount:0,missingHsCount:0,missingOriginCount:0,missingValueCount:0,complete:true,warnings:[]}
  }
}

test('RC1499 export: immutable model mirrors reviewed groups and original positions without regrouping',()=>{
  const source=snapshot();
  const model=exporter.createExportModel(source);
  assert.deepEqual(model.groups,source.groups.map(g=>({
    commodityCode:g.commodityCode,originCountry:g.originCountry,value:g.value,currency:g.currency,positionCount:g.positionCount
  })));
  assert.deepEqual(model.positions,source.positions.map(p=>({
    position:p.position,itemNumber:p.itemNumber,description:p.description,commodityCode:p.commodityCode,originCountry:p.originCountry,
    quantity:p.quantity,netMassKg:p.netMassKg,grossMassKg:p.grossMassKg,value:p.value,currency:p.currency,source:p.source
  })));
  source.groups[0].value=999;
  assert.equal(model.groups[0].value,125.5,'Exportmodell darf nicht am Eingabeobjekt hängen');
});

test('RC1499 export: PDF contains one customs row per reviewed ABD group',async()=>{
  const bytes=await exporter.createPdf(snapshot());
  assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
  const text=await extractPdfText(Buffer.from(bytes));
  assert.match(text,/INV-42/);
  assert.match(text,/39269097/);
  assert.match(text,/73181595/);
  assert.match(text,/CN/);
  assert.match(text,/DE/);
  assert.match(text,/125[,.]50/);
  assert.match(text,/174[,.]50/);
});

test('RC1499 export: XLSX mirrors groups and keeps original invoice details on second sheet',async()=>{
  const bytes=await exporter.createXlsx(snapshot());
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes));
  assert.deepEqual(workbook.worksheets.map(ws=>ws.name),['ABD-Auswertung','Rechnungsdetails']);
  const summary=workbook.getWorksheet('ABD-Auswertung');
  assert.deepEqual(summary.getRow(2).values.slice(1),['39269097','CN',125.5,'EUR',2]);
  assert.deepEqual(summary.getRow(3).values.slice(1),['73181595','DE',174.5,'EUR',1]);
  const details=workbook.getWorksheet('Rechnungsdetails');
  assert.equal(details.rowCount,4);
  assert.deepEqual(details.getRow(2).values.slice(1),['10','A-1','Kunststoffteil','39269097','CN',10,2.5,2.8,100,'EUR','invoice.xlsx']);
});

test('RC1499 export: incomplete or mismatching analysis snapshots are blocked',async()=>{
  const incomplete=snapshot();incomplete.review.complete=false;
  assert.throws(()=>exporter.createExportModel(incomplete),/ABD_EXPORT_NOT_READY/);
  const mismatch=snapshot();mismatch.totals.difference=1;
  await assert.rejects(()=>exporter.createPdf(mismatch),/ABD_EXPORT_NOT_READY/);
  const unassigned=snapshot();unassigned.unassigned=[{position:'40'}];unassigned.review.unassignedCount=1;
  await assert.rejects(()=>exporter.createXlsx(unassigned),/ABD_EXPORT_NOT_READY/);
});

test('RC1499 export: dedicated endpoint and isolated UI use the immutable RC1294 snapshot',()=>{
  const endpoint=fs.readFileSync(new URL('../api/abd-analysis-export/index.js',import.meta.url),'utf8');
  const route=fs.readFileSync(new URL('../api/abd-analysis-export/function.json',import.meta.url),'utf8');
  const runtime=fs.readFileSync(new URL('../assets/rc1294-abd-self-service.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../assets/rc1499-abd-export.js',import.meta.url),'utf8');
  const handoff=fs.readFileSync(new URL('../assets/rc1499-exportexperte-handoff.js',import.meta.url),'utf8');
  assert.match(endpoint,/require\(['"]\.\.\/shared\/abd-analysis-export['"]\)/,'Shared Exportmodul fehlt im Endpoint');
  assert.match(route,/abd-analysis\/export/,'Dedizierte Export-Route fehlt');
  assert.match(runtime,/snapshot:snapshot/,'RC1294 stellt keinen unveränderlichen Analyse-Snapshot bereit');
  assert.match(ui,/data-rc1499-export-pdf/,'PDF-Exportaktion fehlt in der UI');
  assert.match(ui,/data-rc1499-export-xlsx/,'Excel-Exportaktion fehlt in der UI');
  assert.match(ui,/action:'export'[\s\S]*snapshot:data/,'UI übergibt den geprüften Analyse-Snapshot nicht an den Exportendpoint');
  assert.match(ui,/\/api\/abd-analysis\/export/,'UI verwendet nicht die dedizierte Export-Route');
  assert.match(handoff,/rc1499-abd-export\.js\?v=1499/,'Isoliertes Exportmodul wird nicht geladen');
});
