import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import analyzer from '../api/shared/abd-analysis.js';
import d365 from '../api/shared/abd-d365-import.js';
import model from '../api/shared/abd-analysis-model.js';

test('RC1784: parses multiline D365 TSV and keeps packing slips separate',()=>{
 const columns=['PACKINGSLIPID','DELIVERYADDRESSNAME','FORMATTEDDELVERYADDRESS','DELIVERYADDRESSCOUNTRYREGIONISOCODE','ITEMNUMBER','QTY','SHIPPEDAMOUNT','COMMODITYCODE','ORIGCOUNTRYREGIONID','SHIPPEDQTYNETWEIGHT','SHIPPEDQTYGROSSWEIGHT','SALESUNIT','CURRENCYCODE','PRODUCTDESCRIPTION','SALESORDERLINESTATUS'];
 const a=['DNC1','Example A','Street 1','GB','A1','12','258,475512','3926909790','IND','68,4','68,4','EA','EUR','Spiralguard\n2 lines','Invoiced'];
 const b=['DNC2','Example B','Street 2','GB','B1','1500','186,225','3923509000','GBR','47,4','47,4','EA','EUR','Insert','Invoiced'];
 const source=[columns,a,b].map(row=>row.map((cell)=>/\n/.test(cell)?'"'+cell+'"':cell).join('\t')).join('\r\n');
 const matrix=d365.delimitedRows(source);
 assert.equal(matrix.length,3);
 assert.equal(matrix[1][13],'Spiralguard\n2 lines');
 const result=d365.d365Invoice(matrix,'D365.txt',analyzer,model);
 assert.equal(result.deliveryCount,2);
 assert.equal(result.deliveryDocuments[0].header.recipient,'Example A');
 assert.equal(result.deliveryDocuments[1].header.recipient,'Example B');
 assert.equal(result.deliveryDocuments[0].positions[0].quantity,12);
 assert.equal(result.deliveryDocuments[0].positions[0].value,258.475512);
 assert.equal(result.deliveryDocuments[0].positions[0].originCountry,'IN');
 assert.equal(result.deliveryDocuments[1].positions[0].originCountry,'GB');
});


test('RC1784: 70 shipped rows stay in 46 packing slips, 29 recipient groups',()=>{
 const head=['PACKINGSLIPID','DELIVERYADDRESSNAME','FORMATTEDDELVERYADDRESS','DELIVERYADDRESSCOUNTRYREGIONISOCODE','ITEMNUMBER','QTY','SHIPPEDAMOUNT','LINEAMOUNT','COMMODITYCODE','ORIGCOUNTRYREGIONID','SHIPPEDQTYNETWEIGHT','SHIPPEDQTYGROSSWEIGHT','SALESUNIT','CURRENCYCODE','PRODUCTDESCRIPTION','SALESORDERLINESTATUS'];
 const data=[head];
 for(let i=0;i<70;i++){
  const slip=i%46,recipient=slip%29;
  data.push(['DNC'+slip,'Recipient '+recipient,'Warehouse '+recipient,'GB','Item'+i,'2','3,525','5,29','3926909790','GBR','0,5','0,6','EA','EUR','Part '+i,i%7===0?'Backorder':'Invoiced']);
 }
 const result=d365.d365Invoice(data,'D365.txt',analyzer,model);
 assert.equal(result.positions.length,70);
 assert.equal(result.deliveryCount,46);
 assert.equal(new Set(result.deliveryDocuments.map(d=>d.header.recipient)).size,29);
 assert.equal(result.deliveryDocuments.reduce((n,d)=>n+d.positions.length,0),70);
 assert.equal(result.deliveryDocuments[0].positions[0].value,3.525);
 assert.equal(result.deliveryDocuments[0].positions[0].commodityCode,'3926909790');
});


test('RC1785: D365 with 501 shipped positions fails closed instead of dropping rows',()=>{
 const head=['PACKINGSLIPID','DELIVERYADDRESSNAME','FORMATTEDDELVERYADDRESS','DELIVERYADDRESSCOUNTRYREGIONISOCODE','ITEMNUMBER','QTY','SHIPPEDAMOUNT','COMMODITYCODE','ORIGCOUNTRYREGIONID'];
 const rows=[head];
 for(let i=0;i<500;i++)rows.push(['SLIP1','Recipient A','Road 1','GB','Item'+i,'1','2,50','3926909790','DEU']);
 rows.push(['SLIP1','Recipient A','Road 1','GB','Not shipped','0','0','3926909790','DEU']);
 const accepted=d365.d365Invoice(rows,'500-items.txt',analyzer,model);
 assert.equal(accepted.positions.length,500);
 assert.equal(accepted.deliveryDocuments[0].positions.length,500);
 rows.push(['SLIP1','Recipient A','Road 1','GB','Item 501','1','2,50','3926909790','DEU']);
 assert.throws(()=>d365.d365Invoice(rows,'501-items.txt',analyzer,model),e=>e.code==='ABD_D365_POSITION_LIMIT'&&e.status===422);
});

test('RC1785: XLSX parsing rejects sheets above the old 1000-row cutoff instead of truncating',()=>{
 const api=fs.readFileSync('api/abd-analysis/index.js','utf8');
 assert.match(api,/ws\.actualRowCount>1000\)throw error\('ABD_XLSX_ROW_LIMIT'/);
 assert.match(api,/Excel-Datei enthält mehr als 1\.000 Datenzeilen/);
});


test('RC1785: multi-sheet Excel workbooks never silently omit data',()=>{
 const api=fs.readFileSync('api/abd-analysis/index.js','utf8');
 assert.match(api,/nonemptySheets\.length>12/,'Excess worksheets must be rejected');
 assert.match(api,/d365Positions\.length&&objects\.length/,'Mixed D365 and conventional sheets must fail closed');
 assert.match(api,/d365Positions\.length>500\|\|objects\.length>500/,'Aggregate line counts must fail closed across all worksheets');
 for(const code of ['ABD_XLSX_SHEET_LIMIT','ABD_XLSX_MIXED_FORMAT','ABD_XLSX_POSITION_LIMIT'])assert.ok(api.includes(code),code+' error is missing');
});


test('RC1785: generic delimited imports reject over-limit position totals',()=>{
 const api=fs.readFileSync('api/abd-analysis/index.js','utf8');
 const from=api.indexOf('function analyzeCsv('),to=api.indexOf('async function analyzeWithOcr(',from);
 assert.ok(from>=0&&to>from,'Delimited analyzer entrypoint missing');
 const parser=api.slice(from,to);
 const guard=parser.indexOf('ABD_TABULAR_POSITION_LIMIT'),analyze=parser.indexOf('analyzer.analyzeObjects(objects)');
 assert.ok(guard>=0&&guard<analyze,'Generic CSV/TXT/TSV must reject >500 positions before analysis truncation');
 assert.match(parser,/objects\.length>500/);
});

test('RC1785: the 501st standard CSV or Excel position is observable to safety guards',()=>{
 const matrix=[['Artikelnummer','Warenbeschreibung']];
 for(let i=0;i<501;i++)matrix.push(['SKU-'+i,'A valid goods description '+i]);
 assert.equal(analyzer.matrixToObjects(matrix,'standard.csv').length,500,'Normal parser keeps existing 500-row contract');
 assert.equal(analyzer.matrixToObjects(matrix,'standard.csv',501).length,501,'Importer can see the extra position before rejecting');
 const api=fs.readFileSync('api/abd-analysis/index.js','utf8');
 assert.ok(api.includes("analyzer.matrixToObjects(matrix,name+' · '+ws.name,501)"),'XLSX branch requests overflow sentinel');
 assert.ok(api.includes("analyzer.matrixToObjects(matrix,name,501)"),'CSV/TXT/TSV branch requests overflow sentinel');
});
