'use strict';

function text(value,max=200){return String(value==null?'':value).trim().slice(0,max)}
function upper(value,max=8){return text(value,max).toUpperCase()}
function numberOrNull(value){
  if(value==null||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null
}
function stringList(value,maxItems=40,maxLen=80){
  return (Array.isArray(value)?value:[]).slice(0,maxItems).map(item=>text(item,maxLen)).filter(Boolean)
}
function safeGroup(group){
  const source=group&&typeof group==='object'?group:{};
  return{
    commodityCode:text(source.commodityCode,32),
    originCountry:upper(source.originCountry,16),
    value:numberOrNull(source.value),
    currency:upper(source.currency,8),
    status:text(source.status,32),
    positionRefs:stringList(source.positionRefs,100,40),
    warnings:stringList(source.warnings,30,80)
  }
}
function safeUnassigned(item){
  const source=item&&typeof item==='object'?item:{};
  return{
    position:text(source.position||source.line||source.sourceRow,40),
    commodityCode:text(source.commodityCode,32),
    originCountry:upper(source.originCountry,16),
    value:numberOrNull(source.value),
    currency:upper(source.currency,8),
    missing:stringList(source.missing,20,48)
  }
}
function safeTotals(totals){
  const source=totals&&typeof totals==='object'?totals:{};
  return{
    invoiceTotal:numberOrNull(source.invoiceTotal),
    groupedTotal:numberOrNull(source.groupedTotal),
    unassignedKnownValue:numberOrNull(source.unassignedKnownValue),
    accountedTotal:numberOrNull(source.accountedTotal),
    difference:numberOrNull(source.difference),
    currency:upper(source.currency,8),
    currencyCompatible:source.currencyCompatible===true,
    valueCoverageComplete:source.valueCoverageComplete===true,
    unassignedCount:Number.isFinite(Number(source.unassignedCount))?Number(source.unassignedCount):0
  }
}
function safeReview(review){
  const source=review&&typeof review==='object'?review:{};
  const count=name=>Number.isFinite(Number(source[name]))?Number(source[name]):0;
  return{
    groupCount:count('groupCount'),
    readyGroupCount:count('readyGroupCount'),
    reviewGroupCount:count('reviewGroupCount'),
    unassignedCount:count('unassignedCount'),
    missingHsCount:count('missingHsCount'),
    missingOriginCount:count('missingOriginCount'),
    missingValueCount:count('missingValueCount'),
    complete:source.complete===true,
    warnings:stringList(source.warnings,30,80)
  }
}
function safeInvoice(header){
  const source=header&&typeof header==='object'?header:{};
  return{
    invoiceNumber:text(source.invoiceNumber,80),
    invoiceDate:text(source.invoiceDate,40),
    customer:text(source.customer,160),
    recipient:text(source.recipient,160),
    destinationCountry:text(source.destinationCountry,80),
    invoiceTotal:numberOrNull(source.invoiceTotal),
    currency:upper(source.currency,8)
  }
}

function buildCustomsAiContext(input){
  const source=input&&typeof input==='object'?input:{},abd=source.abdRequest&&typeof source.abdRequest==='object'?source.abdRequest:{},analysis=source.invoiceAnalysis&&typeof source.invoiceAnalysis==='object'?source.invoiceAnalysis:{};
  const header=analysis.header&&typeof analysis.header==='object'?analysis.header:{};
  return{
    reference:text(source.reference||abd.reference||abd.ref||abd.referenceNumber,80),
    destinationCountry:text(source.destinationCountry||abd.destinationCountry||abd.recipientCountry||header.destinationCountry,80),
    invoice:safeInvoice(header),
    analysis:{
      groups:(Array.isArray(analysis.groups)?analysis.groups:[]).slice(0,500).map(safeGroup),
      unassigned:(Array.isArray(analysis.unassigned)?analysis.unassigned:[]).slice(0,500).map(safeUnassigned),
      totals:safeTotals(analysis.totals),
      review:safeReview(analysis.review)
    }
  }
}

module.exports={buildCustomsAiContext};
