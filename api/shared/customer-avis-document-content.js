'use strict';

const TYPES=Object.freeze({
  cmr:{label:'CMR / Frachtbrief',keywords:['cmr','frachtbrief','consignment note','international consignment']},
  delivery_note:{label:'Lieferschein',keywords:['lieferschein','delivery note','delivery slip']},
  invoice:{label:'Rechnung / Commercial Invoice',keywords:['rechnung','invoice','commercial invoice']},
  packing_list:{label:'Packliste / Packing List',keywords:['packliste','packing list','packing slip']},
  other:{label:'Sonstiges',keywords:[]}
});

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLocaleLowerCase('de-DE')}
function normalize(v){return lower(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function compact(v){return normalize(v).replace(/\s+/g,'')}
function unique(values){return Array.from(new Set(values.filter(Boolean)))}
function documentType(value){const key=lower(value);if(!Object.prototype.hasOwnProperty.call(TYPES,key)){const e=new Error('Bitte eine gültige Dokumentart auswählen.');e.code='PDF_DOCUMENT_TYPE_INVALID';e.status=400;throw e}return key}
function shipmentIdentifiers(sh){
  sh=sh||{};
  const reference=text(sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber||sh.referenceNo||sh.id||sh.shipmentId).toUpperCase();
  const customerNumber=text(sh.customerNumber||sh.customerAccount||sh.customerNo);
  const salesOrder=text(sh.salesOrder||sh.salesOrderNumber||sh.orderNumber);
  const customerReference=text(sh.customerReference||sh.customerRef||sh.orderReference||sh.purchaseOrder||sh.poNumber);
  const customerName=text(sh.customerName||(sh.customer&&sh.customer.name));
  return{reference,customerNumber,salesOrder,customerReference,customerName};
}
function containsIdentifier(haystack,value){
  const raw=text(value);if(!raw)return false;
  const a=compact(haystack),b=compact(raw);
  if(!b)return false;
  return a.includes(b);
}
function customerNameMatch(haystack,name){
  const words=unique(normalize(name).split(' ').filter(w=>w.length>=4));
  if(!words.length)return false;
  const h=' '+normalize(haystack)+' ';
  const matched=words.filter(w=>h.includes(' '+w+' '));
  return matched.length>=Math.min(2,words.length);
}
function evaluateExtractedText(extracted,shipment,type){
  const kind=documentType(type),raw=text(extracted),normalized=normalize(raw),ids=shipmentIdentifiers(shipment);
  if(normalized.length<40)return{ok:false,code:'PDF_TEXT_UNREADABLE',message:'Der PDF-Inhalt ist nicht ausreichend maschinenlesbar. Bitte ein durchsuchbares PDF hochladen.',documentType:kind,matched:[],missing:['lesbarer PDF-Text']};

  const matched=[],missing=[];
  const referenceMatch=containsIdentifier(raw,ids.reference);
  if(referenceMatch)matched.push('Sendungsreferenz');

  const alternatives=[
    ['Kundennummer',ids.customerNumber],
    ['Sales Order',ids.salesOrder],
    ['Kundenreferenz',ids.customerReference]
  ];
  let alternativeCount=0;
  for(const [label,value] of alternatives){
    if(value&&containsIdentifier(raw,value)){matched.push(label);alternativeCount++}
  }
  const nameMatch=ids.customerName&&customerNameMatch(raw,ids.customerName);
  if(nameMatch){matched.push('Kundenname');alternativeCount++}

  const identityOk=referenceMatch||alternativeCount>=2;
  if(!identityOk){
    if(ids.reference&&!referenceMatch)missing.push('Sendungsreferenz '+ids.reference);
    if(alternativeCount<2)missing.push('mindestens zwei weitere Sendungsmerkmale');
  }

  const rules=TYPES[kind],keywordMatch=!rules.keywords.length||rules.keywords.some(k=>normalized.includes(normalize(k)));
  if(!keywordMatch)missing.push('Dokumentart '+rules.label);

  if(!identityOk)return{ok:false,code:'PDF_SHIPMENT_MISMATCH',message:'Das PDF konnte der Sendung nicht eindeutig zugeordnet werden. Es wird nicht gespeichert.',documentType:kind,matched,missing};
  if(!keywordMatch)return{ok:false,code:'PDF_DOCUMENT_TYPE_MISMATCH',message:'Der PDF-Inhalt passt nicht eindeutig zur ausgewählten Dokumentart '+rules.label+'. Es wird nicht gespeichert.',documentType:kind,matched,missing};

  return{ok:true,code:'PDF_CONTENT_VALID',message:'PDF-Inhalt passt zur Sendung.',documentType:kind,documentTypeLabel:rules.label,matched,missing:[]};
}
async function extractPdfText(buffer){
  let parser;
  try{
    const {PDFParse}=require('pdf-parse');
    parser=new PDFParse({data:Buffer.from(buffer)});
    const result=await parser.getText();
    return text(result&&result.text).slice(0,250000);
  }finally{
    if(parser&&typeof parser.destroy==='function')try{await parser.destroy()}catch(_){}
  }
}
async function validateShipmentDocument(buffer,shipment,type,options={}){
  const extractor=typeof options.extractText==='function'?options.extractText:extractPdfText;
  let extracted='';
  try{extracted=await extractor(buffer)}catch(e){
    return{ok:false,code:'PDF_TEXT_EXTRACTION_FAILED',message:'Der PDF-Inhalt konnte nicht sicher gelesen und der Sendung nicht zugeordnet werden. Die Datei wird nicht gespeichert.',documentType:documentType(type),matched:[],missing:['lesbarer PDF-Text'],error:text(e&&e.message).slice(0,160)};
  }
  return evaluateExtractedText(extracted,shipment,type);
}

module.exports={TYPES,documentType,shipmentIdentifiers,containsIdentifier,customerNameMatch,evaluateExtractedText,extractPdfText,validateShipmentDocument};
