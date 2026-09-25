(function(root){
'use strict';

const STATUS=Object.freeze([
  'draft','files_uploaded','extraction_pending','extracted','mapping_required',
  'validation_required','ready_for_review','ready_for_portal','externally_submitted',
  'mrn_received','abd_received','completed'
]);
const q=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const arr=v=>Array.isArray(v)?v:[];
const num=v=>{const n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:0};
const upper=v=>q(v).toUpperCase();

function digits(v,max){
  const s=q(v).replace(/\D/g,'');
  return max?s.slice(0,max):s;
}
function country(v){
  const s=upper(v).replace(/[^A-Z]/g,'');
  return s.length===2?s:'';
}
function aliases(row){
  row=row&&typeof row==='object'?row:{};
  const get=(...keys)=>{
    for(const k of keys)if(row[k]!=null&&q(row[k])!=='')return row[k];
    return '';
  };
  return {
    positionNo:get('positionNo','POSITION','Pos','POS'),
    articleNumber:get('articleNumber','ARTIKELNUMMER','Artikelnummer','ITEM','Item'),
    goodsDescription:get('goodsDescription','WARENBESCHREIBUNG','Warenbeschreibung','DESCRIPTION','Description'),
    hsCode6:get('hsCode6','HS_CODE','HS CODE','HSCode'),
    commodityCode8:get('commodityCode8','WARENNUMMER_8','WARENNUMMER','Warennummer'),
    originCountry:get('originCountry','HERKUNFTSLAND','URSPRUNGSLAND','Ursprungsland'),
    destinationCountry:get('destinationCountry','BESTIMMUNGSLAND','Bestimmungsland'),
    invoiceValue:get('invoiceValue','WARENWERT','Warenwert','VALUE','Value'),
    currency:get('currency','WAEHRUNG','WÄHRUNG','Currency'),
    statisticalValueEur:get('statisticalValueEur','STATISTISCHER_WERT_EUR','Statistischer Wert'),
    netMassKg:get('netMassKg','EIGENMASSE_KG','NETTO_KG','Net weight'),
    grossMassKg:get('grossMassKg','ROHMASSE_KG','BRUTTO_KG','Gross weight'),
    packageTypeCode:get('packageTypeCode','PACKSTUECKART','PACKSTÜCKART','Package type'),
    packageCount:get('packageCount','PACKSTUECKE','PACKSTÜCKE','Packages'),
    packageMarks:get('packageMarks','PACKSTUECK_ZEICHEN','PACKSTÜCK_ZEICHEN'),
    taricAdditionalCodes:get('taricAdditionalCodes','TARIC_ZUSATZCODE'),
    nationalAdditionalCodes:get('nationalAdditionalCodes','NATIONALER_ZUSATZCODE'),
    yCodes:get('yCodes','Y_CODE','Y CODES'),
    supportingDocumentCode:get('supportingDocumentCode','UNTERLAGEN_CODE'),
    supportingDocumentReference:get('supportingDocumentReference','UNTERLAGEN_REFERENZ'),
    additionalProcedures:get('additionalProcedures','ZUSATZVERFAHREN')
  };
}
function splitCodes(v){
  if(Array.isArray(v))return v.map(upper).filter(Boolean);
  return q(v).split(/[;,|\s]+/).map(upper).filter(Boolean);
}
function normalizePosition(input,index){
  const r=aliases(input);
  const commodity=digits(r.commodityCode8,8);
  const hs=digits(r.hsCode6,6)||(commodity.length>=6?commodity.slice(0,6):'');
  const supporting=splitCodes(r.supportingDocumentCode).map((code,i)=>({
    code,
    reference:splitCodes(r.supportingDocumentReference)[i]||q(r.supportingDocumentReference),
    reviewRequired:true
  }));
  return {
    id:q(input&&input.id)||('pos-'+String(index==null?1:index+1).padStart(3,'0')),
    positionNo:Number(r.positionNo)||((index||0)+1),
    articleNumber:q(r.articleNumber),
    goodsDescription:q(r.goodsDescription),
    hsCode6:hs,
    commodityCode8:commodity,
    originCountry:country(r.originCountry),
    destinationCountry:country(r.destinationCountry),
    invoiceValue:num(r.invoiceValue),
    currency:upper(r.currency),
    statisticalValueEur:num(r.statisticalValueEur),
    netMassKg:num(r.netMassKg),
    grossMassKg:num(r.grossMassKg),
    packageTypeCode:upper(r.packageTypeCode),
    packageCount:num(r.packageCount),
    packageMarks:q(r.packageMarks),
    taricAdditionalCodes:splitCodes(r.taricAdditionalCodes),
    nationalAdditionalCodes:splitCodes(r.nationalAdditionalCodes),
    yCodes:splitCodes(r.yCodes),
    supportingDocuments:supporting,
    additionalProcedures:splitCodes(r.additionalProcedures),
    sourceEvidence:arr(input&&input.sourceEvidence).slice(),
    confidence:Number.isFinite(Number(input&&input.confidence))?Number(input.confidence):null,
    reviewRequired:true
  };
}
function validatePosition(p){
  p=p||{};
  const issues=[];
  const add=(code,severity,message)=>issues.push({code,severity,message});
  if(!q(p.goodsDescription))add('MISSING_GOODS_DESCRIPTION','error','Warenbeschreibung fehlt.');
  if(!/^\d{8}$/.test(q(p.commodityCode8)))add('COMMODITY_CODE_REQUIRES_8_DIGITS','error','Warennummer ist nicht vollständig mit 8 Stellen erfasst.');
  if(!/^[A-Z]{2}$/.test(q(p.originCountry)))add('INVALID_ORIGIN_COUNTRY','error','Ursprungsland fehlt oder ist kein zweistelliger Ländercode.');
  if(!(Number(p.invoiceValue)>0))add('MISSING_VALUE','error','Warenwert fehlt.');
  if(!q(p.currency))add('MISSING_CURRENCY','error','Währung fehlt.');
  if(!(Number(p.netMassKg)>0))add('MISSING_NET_MASS','error','Eigenmasse fehlt.');
  if(Number(p.grossMassKg)>0&&Number(p.netMassKg)>0&&Number(p.grossMassKg)<Number(p.netMassKg))add('GROSS_LT_NET','error','Rohmasse ist kleiner als Eigenmasse.');
  if(!q(p.packageTypeCode))add('MISSING_PACKAGE_TYPE','warning','Packstückart fehlt.');
  if(!(Number(p.packageCount)>0))add('MISSING_PACKAGE_COUNT','warning','Packstückanzahl fehlt.');
  if(arr(p.yCodes).length||arr(p.supportingDocuments).length||arr(p.taricAdditionalCodes).length||arr(p.nationalAdditionalCodes).length){
    add('SUPPORTING_CODES_NEED_REVIEW','review','Unterlagen-, Y- und Zusatzcodes müssen vor der finalen Anmeldung fachlich bestätigt werden.');
  }
  return {valid:!issues.some(x=>x.severity==='error'),issues};
}
function summarize(positions){
  const rows=arr(positions);
  const totals=rows.reduce((a,p)=>{
    a.invoiceValue+=num(p.invoiceValue);
    a.statisticalValueEur+=num(p.statisticalValueEur);
    a.netMassKg+=num(p.netMassKg);
    a.grossMassKg+=num(p.grossMassKg);
    a.packageCount+=num(p.packageCount);
    return a;
  },{invoiceValue:0,statisticalValueEur:0,netMassKg:0,grossMassKg:0,packageCount:0});
  const validations=rows.map(validatePosition);
  return {
    positionCount:rows.length,
    totals,
    errorCount:validations.reduce((n,v)=>n+v.issues.filter(x=>x.severity==='error').length,0),
    reviewCount:validations.reduce((n,v)=>n+v.issues.filter(x=>x.severity==='review').length,0),
    readyForReview:rows.length>0&&validations.every(v=>v.valid),
    validations
  };
}
function importRows(rows){
  return arr(rows).filter(r=>r&&typeof r==='object').map(normalizePosition);
}

root.ExportHUBRC1276AbdSelfService=Object.freeze({
  STATUS,
  normalizePosition,
  validatePosition,
  summarize,
  importRows
});
})(globalThis);
