'use strict';

const {groupPositionsByHsOrigin}=require('./abd-grouping');
const legacyAnalyzer=require('./abd-analysis');

function text(value){return String(value==null?'':value).trim()}
function numberOrNull(value){
 if(value==null||value==='')return null;
 const number=Number(value);
 return Number.isFinite(number)?number:null
}
function money(value){return value==null?null:Math.round(Number(value)*100)/100}
function moneySum(values){return Math.round((values||[]).reduce((sum,value)=>sum+Math.round(Number(value||0)*100),0))/100}
function metricSum(values){return Math.round((values||[]).reduce((sum,value)=>sum+Number(value||0),0)*1000)/1000}
function uniqueText(values){return Array.from(new Set((values||[]).map(text).filter(Boolean)))}
function normalizeHeader(header){
 const source=header&&typeof header==='object'?header:{};
 return{
  invoiceNumber:text(source.invoiceNumber).slice(0,80),
  invoiceDate:text(source.invoiceDate).slice(0,40),
  customer:text(source.customer).slice(0,160),
  recipient:text(source.recipient).slice(0,160),
  destinationCountry:text(source.destinationCountry).slice(0,80),
  invoiceTotal:money(numberOrNull(source.invoiceTotal)),
  currency:text(source.currency).toUpperCase().slice(0,3)
 }
}
function groupCurrencies(groups){
 const out=new Set();
 for(const group of Array.isArray(groups)?groups:[]){
  if(group&&group.currency)out.add(String(group.currency).toUpperCase());
  if(group&&group.valuesByCurrency&&typeof group.valuesByCurrency==='object'){
   for(const currency of Object.keys(group.valuesByCurrency))if(currency)out.add(String(currency).toUpperCase())
  }
 }
 return Array.from(out)
}
function unassignedValueSummary(unassigned){
 const list=Array.isArray(unassigned)?unassigned:[],currencies=new Set(),values=[];
 let valueCoverageComplete=true,currencyCoverageComplete=true;
 for(const position of list){
  const value=numberOrNull(position&&position.value);
  if(value==null){valueCoverageComplete=false;continue}
  values.push(value);
  const currency=text(position&&position.currency).toUpperCase().slice(0,3);
  if(currency)currencies.add(currency);else currencyCoverageComplete=false
 }
 return{
  rawKnownValue:moneySum(values),
  currencies:Array.from(currencies),
  valueCoverageComplete,
  currencyCoverageComplete
 }
}
function calculateAnalysisTotals(header,groups,unassigned){
 const normalized=normalizeHeader(header),list=Array.isArray(groups)?groups:[],unassignedList=Array.isArray(unassigned)?unassigned:[];
 const groupedCurrencies=groupCurrencies(list),unassignedSummary=unassignedValueSummary(unassignedList),currencies=uniqueText(groupedCurrencies.concat(unassignedSummary.currencies));
 const groupsHaveSingleCurrency=list.every(group=>group&&group.value!=null&&group.currency&&!(group.warnings||[]).includes('multiple-currencies'));
 const groupedCurrencyCompatible=Boolean(normalized.currency)&&groupsHaveSingleCurrency&&groupedCurrencies.every(currency=>currency===normalized.currency);
 const unassignedCurrencyCompatible=unassignedSummary.currencyCoverageComplete&&unassignedSummary.currencies.every(currency=>currency===normalized.currency);
 const currencyCompatible=Boolean(normalized.currency)&&groupedCurrencyCompatible&&unassignedCurrencyCompatible;
 const groupedTotal=groupedCurrencyCompatible?moneySum(list.map(group=>group.value)):null;
 const unassignedKnownValue=unassignedCurrencyCompatible?unassignedSummary.rawKnownValue:null;
 const valueCoverageComplete=unassignedSummary.valueCoverageComplete;
 const accountedTotal=currencyCompatible&&valueCoverageComplete&&groupedTotal!=null&&unassignedKnownValue!=null?money(groupedTotal+unassignedKnownValue):null;
 const difference=normalized.invoiceTotal!=null&&accountedTotal!=null?money(normalized.invoiceTotal-accountedTotal):null;
 return{
  invoiceTotal:normalized.invoiceTotal,
  groupedTotal,
  unassignedKnownValue,
  accountedTotal,
  difference,
  currency:normalized.currency,
  currencies,
  currencyCompatible,
  valueCoverageComplete,
  unassignedCount:unassignedList.length
 }
}
function physicalTotals(positions){
 const list=Array.isArray(positions)?positions:[];
 return{
  netMassKg:metricSum(list.map(position=>numberOrNull(position&&position.netMassKg))),
  grossMassKg:metricSum(list.map(position=>numberOrNull(position&&position.grossMassKg))),
  volumeM3:metricSum(list.map(position=>numberOrNull(position&&position.volumeM3)))
 }
}
function missingCount(positions,field){
 return (Array.isArray(positions)?positions:[]).filter(position=>Array.isArray(position&&position.missing)&&position.missing.includes(field)).length
}
function buildReview(groups,unassigned,totals){
 const groupList=Array.isArray(groups)?groups:[],unassignedList=Array.isArray(unassigned)?unassigned:[],warnings=[];
 if(!totals.currencyCompatible)warnings.push('currency-mismatch');
 if(totals.invoiceTotal==null)warnings.push('invoice-total-missing');
 if(!totals.valueCoverageComplete)warnings.push('value-coverage-incomplete');
 if(unassignedList.length)warnings.push('unassigned-positions');
 if(totals.difference!=null&&totals.difference!==0)warnings.push('invoice-total-mismatch');
 const reviewGroupCount=groupList.filter(group=>!group||group.status!=='complete').length;
 const complete=groupList.length>0&&unassignedList.length===0&&reviewGroupCount===0&&totals.currencyCompatible&&totals.valueCoverageComplete&&totals.invoiceTotal!=null&&totals.difference===0;
 return{
  groupCount:groupList.length,
  readyGroupCount:groupList.length-reviewGroupCount,
  reviewGroupCount,
  unassignedCount:unassignedList.length,
  missingHsCount:missingCount(unassignedList,'commodityCode'),
  missingOriginCount:missingCount(unassignedList,'originCountry'),
  missingValueCount:missingCount(unassignedList,'value'),
  complete,
  warnings
 }
}
function buildAbdAnalysis(input){
 const source=input&&typeof input==='object'?input:{},header=normalizeHeader(source.header),positions=Array.isArray(source.positions)?source.positions:[];
 const grouped=groupPositionsByHsOrigin(positions),totals=Object.assign(calculateAnalysisTotals(header,grouped.groups,grouped.unassigned),physicalTotals(positions)),review=buildReview(grouped.groups,grouped.unassigned,totals);
 return{header,positions,groups:grouped.groups,unassigned:grouped.unassigned,totals,review}
}
function normalizeReviewedPosition(position,index){
 const source=position&&typeof position==='object'?position:{};
 const input=Object.assign({},source,{
  _source:text(source.source||source.sourceFile),
  _row:Number(source.sourceRow||source._row||0)||null
 });
 const normalized=legacyAnalyzer.normalizePosition(input,index);
 normalized.warnings=uniqueText([].concat(Array.isArray(source.warnings)?source.warnings:[],normalized.warnings||[]));
 if(source.confirmed===false)normalized.confirmed=false;
 else if(source.confirmed===true)normalized.confirmed=true;
 return normalized
}
function rebuildReviewedAnalysis(input){
 const source=input&&typeof input==='object'?input:{},positions=(Array.isArray(source.positions)?source.positions:[]).slice(0,500).map(normalizeReviewedPosition);
 return buildAbdAnalysis({header:source.header,positions})
}
function deriveHeader(legacy,header){
 const positions=legacy&&Array.isArray(legacy.positions)?legacy.positions:[],input=Object.assign({},header&&typeof header==='object'?header:{});
 if(!text(input.invoiceNumber)){
  const invoiceNumbers=uniqueText(positions.map(position=>position&&position.invoiceNumber));
  if(invoiceNumbers.length===1)input.invoiceNumber=invoiceNumbers[0]
 }
 if(!text(input.currency)){
  const currencies=uniqueText(positions.map(position=>text(position&&position.currency).toUpperCase()));
  if(currencies.length===1)input.currency=currencies[0]
 }
 return input
}
function enrichLegacyAnalysis(legacy,header){
 const source=legacy&&typeof legacy==='object'?legacy:{},abd=buildAbdAnalysis({header:deriveHeader(source,header),positions:Array.isArray(source.positions)?source.positions:[]}),legacyTotals=source.totals&&typeof source.totals==='object'?source.totals:{};
 return Object.assign({},source,abd,{totals:Object.assign({},legacyTotals,abd.totals)})
}

module.exports={normalizeHeader,calculateAnalysisTotals,buildAbdAnalysis,rebuildReviewedAnalysis,enrichLegacyAnalysis};
