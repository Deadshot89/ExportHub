import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const ocr=require('../api/shared/abd-document-intelligence.js');

function response(status,body,headers={}){
 return{ok:status>=200&&status<300,status,headers:{get(name){return headers[String(name).toLowerCase()]||headers[name]||null}},async json(){return body}};
}

test('RC1499 OCR fails explicitly when Azure Document Intelligence is not configured',async()=>{
 await assert.rejects(()=>ocr.analyzeInvoiceBuffer(Buffer.from('x'),{env:{},fetchImpl:async()=>{throw new Error('must not call')}}),error=>error&&error.code==='ABD_OCR_NOT_CONFIGURED');
});

test('RC1499 OCR uses prebuilt-invoice 2024-11-30 and returns source-backed invoice fields',async()=>{
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url,options});
  if(calls.length===1)return response(202,{}, {'operation-location':'https://example.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/abc?api-version=2024-11-30'});
  return response(200,{status:'succeeded',analyzeResult:{content:'Invoice INV-7\n39269097 Ursprung DE 100,00 EUR',documents:[{fields:{
   InvoiceId:{type:'string',valueString:'INV-7',content:'INV-7',confidence:0.99},
   InvoiceDate:{type:'date',valueDate:'2026-10-12',content:'12.10.2026',confidence:0.98},
   CustomerName:{type:'string',valueString:'Customer GmbH',confidence:0.97},
   ShippingAddressRecipient:{type:'string',valueString:'Receiver AG',confidence:0.96},
   ShippingAddress:{type:'address',valueAddress:{countryRegion:'DE'},confidence:0.96},
   InvoiceTotal:{type:'currency',valueCurrency:{amount:100,currencyCode:'EUR'},content:'100,00 EUR',confidence:0.99},
   Items:{type:'array',valueArray:[{type:'object',valueObject:{Description:{valueString:'Teil A'},ProductCode:{valueString:'A-1'},Quantity:{valueNumber:2},Amount:{valueCurrency:{amount:100,currencyCode:'EUR'}}}}]}
  }}]}});
 };
 const out=await ocr.analyzeInvoiceBuffer(Buffer.from('image'),{name:'invoice.png',mimeType:'image/png',env:{EXPORTHUB_DOCUMENT_INTELLIGENCE_ENDPOINT:'https://example.cognitiveservices.azure.com/',EXPORTHUB_DOCUMENT_INTELLIGENCE_KEY:'secret'},fetchImpl,pollDelay:async()=>{}});
 assert.match(calls[0].url,/documentModels\/prebuilt-invoice:analyze/);
 assert.match(calls[0].url,/api-version=2024-11-30/);
 assert.equal(calls[0].options.headers['Ocp-Apim-Subscription-Key'],'secret');
 assert.equal(out.header.invoiceNumber,'INV-7');
 assert.equal(out.header.invoiceDate,'2026-10-12');
 assert.equal(out.header.customer,'Customer GmbH');
 assert.equal(out.header.recipient,'Receiver AG');
 assert.equal(out.header.destinationCountry,'DE');
 assert.equal(out.header.invoiceTotal,100);
 assert.equal(out.header.currency,'EUR');
 assert.equal(out.items.length,1);
 assert.equal(out.items[0].description,'Teil A');
 assert.equal(out.items[0].value,100);
 assert.equal(out.content.includes('39269097'),true);
});

test('RC1499 OCR never guesses currency from an ambiguous symbol',()=>{
 const header=ocr.extractInvoiceHeader({InvoiceTotal:{type:'currency',valueCurrency:{amount:25,currencySymbol:'$'},content:'$25.00'}});
 assert.equal(header.invoiceTotal,25);
 assert.equal(header.currency,'');
});

test('RC1499 OCR surfaces provider failures without leaking the subscription key',async()=>{
 const secret='super-secret-key';
 await assert.rejects(()=>ocr.analyzeInvoiceBuffer(Buffer.from('x'),{env:{EXPORTHUB_DOCUMENT_INTELLIGENCE_ENDPOINT:'https://example.cognitiveservices.azure.com',EXPORTHUB_DOCUMENT_INTELLIGENCE_KEY:secret},fetchImpl:async()=>response(500,{error:{message:'provider failed'}})}),error=>error&&error.code==='ABD_OCR_FAILED'&&!String(error.message).includes(secret));
});
