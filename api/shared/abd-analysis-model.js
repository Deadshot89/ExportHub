'use strict';

const {groupPositionsByHsOrigin}=require('./abd-grouping');

function text(value){return String(value==null?'':value).trim()}
function numberOrNull(value){
 if(value==null||value==='')return null;
 const number=Number(value);
 return Number.isFinite(number)?number:null
}
function money(value){return value==null?null:Math.round(Number(value)*100)/100}
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
function calculateAnalysisTotals(header,groups,unassigned){
 const normalized=normalizeHeader(header),list=Array.isArray(groups)?groups:[];
 const currencies=groupCurrencies(list);
 const groupsHaveSingleCurrency=list.every(group=>group&&group.value!=null&&group.currency&&!(group.warnings||[]).includes('multiple-currencies'));
 const currencyCompatible=Boolean(normalized.currency)&&groupsHaveSingleCurrency&&currencies.length<=1&&(currencies.length===0||currencies[0]===normalized.currency);
 const groupedTotal=currencyCompatible?money(list.reduce((sum,group)=>sum+Number(group.value||0),0)):null;
 const difference=normalized.invoiceTotal!=null&&groupedTotal!=null?money(normalized.invoiceTotal-groupedTotal):null;
 return{
  invoiceTotal:normalized.invoiceTotal,
  groupedTotal,
  difference,
  currency:normalized.currency,
  currencies,
  currencyCompatible,
  unassignedCount:Array.isArray(unassigned)?unassigned.length:0
 }
}
function missingCount(positions,field){
 return (Array.isArray(positions)?positions:[]).filter(position=>Array.isArray(position&&position.missing)&&position.missing.includes(field)).length
}
function buildReview(groups,unassigned,totals){
 const groupList=Array.isArray(groups)?groups:[],unassignedList=Array.isArray(unassigned)?unassigned:[],warnings=[];
 if(!totals.currencyCompatible)warnings.push('currency-mismatch');
 if(totals.invoiceTotal==null)warnings.push('invoice-total-missing');
 if(unassignedList.length)warnings.push('unassigned-positions');
 if(totals.difference!=null&&totals.difference!==0)warnings.push('invoice-total-mismatch');
 const reviewGroupCount=groupList.filter(group=>!group||group.status!=='complete').length;
 const complete=groupList.length>0&&unassignedList.length===0&&reviewGroupCount===0&&totals.currencyCompatible&&totals.invoiceTotal!=null&&totals.difference===0;
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
 const grouped=groupPositionsByHsOrigin(positions),totals=calculateAnalysisTotals(header,grouped.groups,grouped.unassigned),review=buildReview(grouped.groups,grouped.unassigned,totals);
 return{header,positions,groups:grouped.groups,unassigned:grouped.unassigned,totals,review}
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

module.exports={normalizeHeader,calculateAnalysisTotals,buildAbdAnalysis,enrichLegacyAnalysis};
