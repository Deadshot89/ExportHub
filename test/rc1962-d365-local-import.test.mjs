import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const worker=fs.readFileSync('assets/rc1962-d365-xlsx-worker.js','utf8');
const ui=fs.readFileSync('assets/rc1962-d365-local-import.js','utf8');
const workspace=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const proforma=fs.readFileSync('assets/rc1549-abd-proforma.js','utf8');
const secure=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const builder=fs.readFileSync('.github/rc1549/integrate-abd-proforma.mjs','utf8');

function crc32(data){let c=0xffffffff;for(const b of data){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function makeZip(entries){
 const locals=[],centrals=[];let offset=0;
 for(const [name,source] of Object.entries(entries)){
  const n=Buffer.from(name),data=Buffer.from(source),crc=crc32(data);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);
  locals.push(local,n,data);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);
  centrals.push(central,n);offset+=local.length+n.length+data.length
 }
 const cd=Buffer.concat(centrals),footer=Buffer.alloc(22);footer.writeUInt32LE(0x06054b50,0);footer.writeUInt16LE(Object.keys(entries).length,8);footer.writeUInt16LE(Object.keys(entries).length,10);footer.writeUInt32LE(cd.length,12);footer.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,cd,footer])
}
function esc(x){return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function column(i){let result='';while(i>=0){result=String.fromCharCode(65+i%26)+result;i=Math.floor(i/26)-1}return result}
const headers=['PACKINGSLIPID','ITEMNUMBER','QTY','COMMODITYCODE','SHIPPEDAMOUNT','LINEAMOUNT','SALESORDERLINESTATUS','DELIVERYADDRESSNAME','DELIVERYADDRESSCOUNTRYREGIONID','ORIGCOUNTRYREGIONID','PRODUCTDESCRIPTION','SHIPPEDQTYNETWEIGHT','SHIPPEDQTYGROSSWEIGHT'];
function xlsx(records,{formula=false,path='xl/worksheets/sheet1.xml',extra={}}={}){
 const recordsWithHeader=[headers,...records];
 const rows=recordsWithHeader.map((values,i)=>'<row r="'+(i+1)+'">'+values.map((x,k)=>'<c r="'+column(k)+(i+1)+'" t="inlineStr"><is><t>'+esc(x)+'</t></is></c>').join('')+'</row>');
 if(formula)rows[1]=rows[1].replace('<is><t>', '<f>1+1</f><is><t>');
 return makeZip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>','xl/workbook.xml':'<workbook><sheets><sheet name="D365" sheetId="1" r:id="rId1"/></sheets></workbook>',[path]:'<worksheet><sheetData>'+rows.join('')+'</sheetData></worksheet>',...extra})
}
function record(ref,item,qty,value,options={}){
 const data={PACKINGSLIPID:ref,ITEMNUMBER:item,QTY:String(qty),COMMODITYCODE:'39269097',SHIPPEDAMOUNT:value==null?'':String(value),LINEAMOUNT:'999',SALESORDERLINESTATUS:options.backorder?'backorder':'invoiced',DELIVERYADDRESSNAME:options.recipient||'Example Customer',DELIVERYADDRESSCOUNTRYREGIONID:'DEU',ORIGCOUNTRYREGIONID:'DEU',PRODUCTDESCRIPTION:'Kunststoffteil',SHIPPEDQTYNETWEIGHT:'1.5',SHIPPEDQTYGROSSWEIGHT:'2.0'};
 return headers.map(k=>data[k]||'')
}
async function run(buffer){
 let message=null;
 const self={postMessage:x=>{message=x}};
 const context={self,TextDecoder,Uint8Array,DataView,Blob,DecompressionStream,Set,Map};
 vm.runInNewContext(worker,context,{timeout:2000,filename:'rc1962-d365-xlsx-worker.js'});
 const data=Buffer.from(buffer);
 await self.onmessage({data:{file:{name:'d365.xlsx',size:data.length,arrayBuffer:async()=>Uint8Array.from(data).buffer}}});
 return JSON.parse(JSON.stringify(message))
}
test('RC1962 reads D365 XLSX locally, preserves separate packing slips and shipped values',async()=>{
 const output=await run(xlsx([record('SLIP-A','ART-1',3,24),record('SLIP-A','ART-0',0,0),record('SLIP-B','ART-2',2,12,{recipient:'Another Customer'})]));
 assert.equal(output.ok,true);
 assert.equal(output.docs.length,2);
 assert.equal(output.docs[0].reference,'SLIP-A');
 assert.equal(output.docs[0].positions.length,1);
 assert.equal(output.docs[0].positions[0].itemNumber,'ART-1');
 assert.equal(output.docs[0].positions[0].quantity,3);
 assert.equal(output.docs[0].positions[0].value,24);
 assert.equal(output.docs[0].positions[0].unitPrice,8);
 assert.equal(output.docs[0].positions[0].originCountry,'DE');
 assert.equal(output.docs[1].reference,'SLIP-B');
 assert.equal(output.docs[1].positions[0].value,12);
 assert.equal(output.docs[1].positions[0].recipient,undefined);
 assert.equal(output.docs[0].positions[0].invoiceNumber,undefined)
});
test('RC1962 never substitutes ordered backorder value when shipped amount is missing',async()=>{
 const output=await run(xlsx([record('SLIP-A','BACKORDER',3,null,{backorder:true})]));
 assert.equal(output.ok,true);
 assert.equal(output.docs[0].positions[0].value,null);
 assert.equal(output.docs[0].positions[0].unitPrice,null)
});
test('RC1962 rejects formulas, malformed format and path traversal without partial items',async()=>{
 for(const buffer of [
  xlsx([record('A','ITEM',1,12)],{formula:true}),
  xlsx([record('A','ITEM',1,12)],{path:'xl/../worksheets/sheet1.xml'}),
  xlsx([record('A','ITEM',1,12)],{extra:{'xl/externalLinks/externalLink1.xml':'<x/>'}}),
  xlsx([record('A','ITEM',1,12)],{extra:{'xl/workbook.xml.rels':'<!DOCTYPE x><x/>'}}),
  xlsx([])
 ]){
  const output=await run(buffer);assert.equal(output.ok,false);assert.match(output.code,/^D365_/)
 }
});
test('RC1962 never silently discards shipped positions beyond 500',async()=>{
 const rows=Array.from({length:501},(_,i)=>record('SAME','ART-'+i,1,2));
 const output=await run(xlsx(rows));assert.equal(output.ok,false);assert.equal(output.code,'D365_POSITION_LIMIT')
});
test('RC1962 local import transfers only allowlisted position keys; Excel bytes never reach API',()=>{
 assert.match(ui,/new w\.Worker\('\/assets\/rc1962-d365-xlsx-worker\.js\?v=1962'\)/);
 assert.match(ui,/worker\.postMessage\(\{file:file\}\)/);
 assert.doesNotMatch(worker,/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon\s*\(|importScripts\s*\(/);
 assert.doesNotMatch(ui,/fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|\/api\/abd-analysis[^/]/);
 assert.match(ui,/importPositionsOnly\(items\)/);
 assert.match(proforma,/function importPositionsOnly\(positions\)/);
 const part=proforma.slice(proforma.indexOf('function importPositionsOnly('),proforma.indexOf('function importUploaded('));
 assert.doesNotMatch(part,/headerDraft\[|headerDraft\s*=|\.header\b|\.recipient\b|\.invoiceNumber\b|\.shipmentReference\b/);
 assert.match(part,/itemNumber.*description.*quantity.*unit.*unitPrice.*value.*netMassKg.*grossMassKg.*volumeM3.*commodityCode.*originCountry/);
 assert.match(secure,/action:'upload'/);
 assert.match(workspace,/scanner\.analyzeFile\(file\)/);
});
test('RC1962 release build copies and registers browser worker and local import in existing documents workspace',()=>{
 assert.match(builder,/assets\/rc1962-d365-local-import\.js/);
 assert.match(builder,/assets\/rc1962-d365-xlsx-worker\.js/);
 assert.match(builder,/D365_LOCAL_TAG/);
 assert.match(workspace,/local\.mount\(lastMode\)/);
 assert.match(ui,/data-rc1962-file/);
 assert.match(ui,/role="status"/);
 assert.match(ui,/aria-live="polite"/);
 for(const language of ['de','en','pl','es','fr','it'])assert.match(ui,new RegExp('\\b'+language+':\\{title:'))
});
