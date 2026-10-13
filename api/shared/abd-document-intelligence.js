'use strict';

const API_VERSION='2024-11-30';
const MODEL_ID='prebuilt-invoice';
const DEFAULT_POLLS=30;

function text(value){return String(value==null?'':value).trim()}
function codedError(code,message,status=503){const error=new Error(message);error.code=code;error.status=status;return error}
function config(env){
 const source=env||process.env,endpoint=text(source.EXPORTHUB_DOCUMENT_INTELLIGENCE_ENDPOINT),key=text(source.EXPORTHUB_DOCUMENT_INTELLIGENCE_KEY);
 if(!endpoint||!key)throw codedError('ABD_OCR_NOT_CONFIGURED','Azure Document Intelligence ist für die Rechnungsanalyse nicht konfiguriert.',503);
 let url;try{url=new URL(endpoint)}catch(_){throw codedError('ABD_OCR_NOT_CONFIGURED','Azure Document Intelligence ist ungültig konfiguriert.',503)}
 if(url.protocol!=='https:')throw codedError('ABD_OCR_NOT_CONFIGURED','Azure Document Intelligence benötigt einen HTTPS-Endpunkt.',503);
 return{endpoint:url.origin,key}
}
function fieldString(field){
 if(!field||typeof field!=='object')return'';
 return text(field.valueString||field.valueDate||field.content)
}
function fieldNumber(field){
 if(!field||typeof field!=='object')return null;
 if(field.valueCurrency&&Number.isFinite(Number(field.valueCurrency.amount)))return Number(field.valueCurrency.amount);
 if(Number.isFinite(Number(field.valueNumber)))return Number(field.valueNumber);
 return null
}
function currencyCode(field){
 if(!field||typeof field!=='object')return'';
 const direct=text(field.valueCurrency&&field.valueCurrency.currencyCode).toUpperCase();
 if(/^[A-Z]{3}$/.test(direct))return direct;
 const content=text(field.content).toUpperCase(),match=content.match(/(?:^|\s)([A-Z]{3})(?:\s|$)/);
 return match?match[1]:''
}
function countryFromAddress(field){
 const raw=text(field&&field.valueAddress&&field.valueAddress.countryRegion).toUpperCase();
 return raw.slice(0,80)
}
function extractInvoiceHeader(fields){
 const source=fields&&typeof fields==='object'?fields:{},total=source.InvoiceTotal;
 return{
  invoiceNumber:fieldString(source.InvoiceId).slice(0,80),
  invoiceDate:fieldString(source.InvoiceDate).slice(0,40),
  customer:fieldString(source.CustomerName).slice(0,160),
  recipient:(fieldString(source.ShippingAddressRecipient)||fieldString(source.BillingAddressRecipient)).slice(0,160),
  destinationCountry:countryFromAddress(source.ShippingAddress)||countryFromAddress(source.BillingAddress),
  invoiceTotal:fieldNumber(total),
  currency:currencyCode(total)
 }
}
function itemObject(item){
 return item&&typeof item==='object'&&(item.valueObject||item.properties)||{}
}
function extractInvoiceItems(fields){
 const source=fields&&typeof fields==='object'?fields:{},items=source.Items&&Array.isArray(source.Items.valueArray)?source.Items.valueArray:[];
 return items.slice(0,500).map((item,index)=>{
  const values=itemObject(item),amount=values.Amount;
  return{
   position:String(index+1),
   itemNumber:fieldString(values.ProductCode).slice(0,80),
   description:fieldString(values.Description).slice(0,300),
   quantity:fieldNumber(values.Quantity),
   value:fieldNumber(amount),
   currency:currencyCode(amount),
   confidence:Number(item&&item.confidence||values.Description&&values.Description.confidence||0)||null
  }
 }).filter(item=>item.itemNumber||item.description||item.quantity!=null||item.value!=null)
}
function parseAnalyzeResult(payload){
 const result=payload&&payload.analyzeResult||{},document=Array.isArray(result.documents)&&result.documents[0]||{},fields=document&&document.fields||{};
 return{
  header:extractInvoiceHeader(fields),
  items:extractInvoiceItems(fields),
  content:text(result.content),
  modelId:text(result.modelId||document.modelId||MODEL_ID),
  apiVersion:text(result.apiVersion||API_VERSION)
 }
}
function operationLocation(response,endpoint){
 const raw=text(response&&response.headers&&typeof response.headers.get==='function'&&response.headers.get('operation-location'));
 if(!raw)throw codedError('ABD_OCR_FAILED','Azure Document Intelligence hat keine Ergebnisreferenz geliefert.',502);
 let location,base;try{location=new URL(raw);base=new URL(endpoint)}catch(_){throw codedError('ABD_OCR_FAILED','Azure Document Intelligence hat eine ungültige Ergebnisreferenz geliefert.',502)}
 if(location.protocol!=='https:'||location.origin!==base.origin||!location.pathname.includes('/documentintelligence/'))throw codedError('ABD_OCR_FAILED','Azure Document Intelligence hat eine nicht vertrauenswürdige Ergebnisreferenz geliefert.',502);
 return location.toString()
}
function safeProviderError(status){return codedError('ABD_OCR_FAILED','Azure Document Intelligence konnte die Rechnung nicht analysieren ('+String(status||'Fehler')+').',502)}
async function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function analyzeInvoiceBuffer(buffer,options={}){
 const cfg=config(options.env),fetchImpl=options.fetchImpl||globalThis.fetch;
 if(typeof fetchImpl!=='function')throw codedError('ABD_OCR_FAILED','Für die OCR-Analyse ist keine HTTP-Runtime verfügbar.',503);
 const source=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer||'');
 if(!source.length)throw codedError('ABD_OCR_FAILED','Die OCR-Datei ist leer.',400);
 const analyzeUrl=cfg.endpoint+'/documentintelligence/documentModels/'+MODEL_ID+':analyze?_overload=analyzeDocument&api-version='+API_VERSION;
 let start;
 try{
  start=await fetchImpl(analyzeUrl,{method:'POST',headers:{'Content-Type':'application/json','Ocp-Apim-Subscription-Key':cfg.key},body:JSON.stringify({base64Source:source.toString('base64')})})
 }catch(_){throw safeProviderError('Netzwerk')}
 if(!start||start.status!==202)throw safeProviderError(start&&start.status);
 const resultUrl=operationLocation(start,cfg.endpoint),pollDelay=typeof options.pollDelay==='function'?options.pollDelay:()=>delay(500),maxPolls=Math.max(1,Math.min(60,Number(options.maxPolls||DEFAULT_POLLS)));
 for(let attempt=0;attempt<maxPolls;attempt++){
  if(attempt>0)await pollDelay();
  let response;try{response=await fetchImpl(resultUrl,{method:'GET',headers:{'Ocp-Apim-Subscription-Key':cfg.key,'Accept':'application/json'}})}catch(_){throw safeProviderError('Netzwerk')}
  if(!response||!response.ok)throw safeProviderError(response&&response.status);
  let payload;try{payload=await response.json()}catch(_){throw safeProviderError('Antwort')}
  const status=text(payload&&payload.status).toLowerCase();
  if(status==='succeeded')return parseAnalyzeResult(payload);
  if(status==='failed'||status==='canceled')throw safeProviderError(status);
 }
 throw codedError('ABD_OCR_TIMEOUT','Azure Document Intelligence hat die Analyse nicht rechtzeitig abgeschlossen.',504)
}

module.exports={API_VERSION,MODEL_ID,extractInvoiceHeader,extractInvoiceItems,parseAnalyzeResult,analyzeInvoiceBuffer};
