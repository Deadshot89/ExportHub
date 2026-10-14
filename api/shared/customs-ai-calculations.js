'use strict';

function text(value){return String(value==null?'':value).trim()}
function upper(value){return text(value).toUpperCase()}
function numberOrNull(value){
  if(value==null||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null
}
function money(value){return value==null?null:Math.round(Number(value)*100)/100}
function uniqueSorted(values){return Array.from(new Set((values||[]).map(text).filter(Boolean))).sort()}
function groups(analysis){return Array.isArray(analysis&&analysis.groups)?analysis.groups:[]}
function unassigned(analysis){return Array.isArray(analysis&&analysis.unassigned)?analysis.unassigned:[]}

function listCommodityCodes(analysis){
  return uniqueSorted(groups(analysis).concat(unassigned(analysis)).map(item=>text(item&&item.commodityCode)))
}

function listOriginCountries(analysis){
  return uniqueSorted(groups(analysis).concat(unassigned(analysis)).map(item=>upper(item&&item.originCountry)))
}

function groupValue(analysis,commodityCode,originCountry){
  const hs=text(commodityCode).replace(/\s+/g,''),origin=upper(originCountry);
  const matches=groups(analysis).filter(group=>text(group&&group.commodityCode).replace(/\s+/g,'')===hs&&upper(group&&group.originCountry)===origin);
  if(matches.length!==1)return{found:false,commodityCode:hs,originCountry:origin};
  const group=matches[0],value=numberOrNull(group&&group.value),currency=upper(group&&group.currency);
  if(value==null||!currency)return{found:false,commodityCode:hs,originCountry:origin};
  return{found:true,value:money(value),currency,commodityCode:hs,originCountry:origin}
}

function originValue(analysis,originCountry){
  const origin=upper(originCountry),matchingGroups=groups(analysis).filter(group=>upper(group&&group.originCountry)===origin),matchingUnassigned=unassigned(analysis).filter(item=>upper(item&&item.originCountry)===origin);
  const entries=matchingGroups.concat(matchingUnassigned),currencies=uniqueSorted(entries.map(item=>upper(item&&item.currency)));
  const values=entries.map(item=>numberOrNull(item&&item.value));
  if(!entries.length)return{supported:false,currencies:[]};
  if(currencies.length!==1||values.some(value=>value==null))return{supported:false,currencies};
  const total=money(values.reduce((sum,value)=>sum+value,0));
  return{supported:true,value:total,currency:currencies[0],originCountry:origin,groupCount:matchingGroups.length}
}

function unassignedSummary(analysis){
  const list=unassigned(analysis),review=analysis&&analysis.review&&typeof analysis.review==='object'?analysis.review:{};
  const missingCount=field=>list.filter(item=>Array.isArray(item&&item.missing)&&item.missing.includes(field)).length;
  return{
    count:list.length,
    positions:list.map(item=>text(item&&(item.position||item.line||item.sourceRow))).filter(Boolean),
    missingHsCount:Number.isFinite(Number(review.missingHsCount))?Number(review.missingHsCount):missingCount('commodityCode'),
    missingOriginCount:Number.isFinite(Number(review.missingOriginCount))?Number(review.missingOriginCount):missingCount('originCountry'),
    missingValueCount:Number.isFinite(Number(review.missingValueCount))?Number(review.missingValueCount):missingCount('value')
  }
}

function reconciliation(analysis){
  const totals=analysis&&analysis.totals&&typeof analysis.totals==='object'?analysis.totals:{},review=analysis&&analysis.review&&typeof analysis.review==='object'?analysis.review:{};
  const invoiceTotal=money(numberOrNull(totals.invoiceTotal)),accountedTotal=money(numberOrNull(totals.accountedTotal)),difference=money(numberOrNull(totals.difference)),currency=upper(totals.currency);
  const matches=difference!=null&&difference===0&&invoiceTotal!=null&&accountedTotal!=null;
  return{invoiceTotal,accountedTotal,difference,currency,matches,complete:review.complete===true}
}

module.exports={listCommodityCodes,listOriginCountries,groupValue,originValue,unassignedSummary,reconciliation};
