import test from 'node:test';
import assert from 'node:assert/strict';
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
