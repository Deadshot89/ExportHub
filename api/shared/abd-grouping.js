'use strict';

function text(value){return String(value==null?'':value).trim()}
function normalizeCommodityCode(value){return text(value).replace(/\D/g,'').slice(0,10)}
function normalizeOriginCountry(value){return text(value).toUpperCase().replace(/\s+/g,' ').slice(0,80)}
function moneyAdd(a,b){return (Math.round(Number(a||0)*100)+Math.round(Number(b||0)*100))/100}
function metricAdd(a,b){return Math.round((Number(a||0)+Number(b||0))*1000)/1000}
function positionRef(position,index){
 const source=text(position&&position.source),row=Number(position&&position.sourceRow||0),pos=text(position&&position.position);
 return [source,row||'',pos||String(index+1)].join(':')
}
function isAssignable(position){
 if(!position||typeof position!=='object')return false;
 if(position.confirmed===false)return false;
 if(normalizeCommodityCode(position.commodityCode).length<6)return false;
 if(!normalizeOriginCountry(position.originCountry))return false;
 if(position.value==null||!Number.isFinite(Number(position.value)))return false;
 const missing=Array.isArray(position.missing)?position.missing:[];
 return !missing.includes('commodityCode')&&!missing.includes('originCountry')&&!missing.includes('value')
}
function groupPositionsByHsOrigin(positions){
 const groups=[],unassigned=[],byKey=new Map();
 (Array.isArray(positions)?positions:[]).forEach((position,index)=>{
  if(!isAssignable(position)){unassigned.push(position);return}
  const commodityCode=normalizeCommodityCode(position.commodityCode),originCountry=normalizeOriginCountry(position.originCountry),key=commodityCode+'|'+originCountry;
  let group=byKey.get(key);
  if(!group){
   group={key,commodityCode,originCountry,value:0,currency:'',valuesByCurrency:{},positionRefs:[],positionCount:0,warnings:[],status:'complete'};
   byKey.set(key,group);groups.push(group)
  }
  const currency=text(position.currency).toUpperCase().slice(0,3),amount=Number(position.value);
  group.positionRefs.push(positionRef(position,index));group.positionCount++;
  for(const field of ['netMassKg','grossMassKg','volumeM3']){
   if(position[field]!=null&&Number.isFinite(Number(position[field])))
    group[field]=metricAdd(group[field],position[field]);
  }
  group.valuesByCurrency[currency]=moneyAdd(group.valuesByCurrency[currency]||0,amount);
  const currencies=Object.keys(group.valuesByCurrency);
  if(currencies.length===1){group.currency=currencies[0];group.value=group.valuesByCurrency[group.currency]}
  else{
   group.currency='';group.value=null;group.status='review';
   if(!group.warnings.includes('multiple-currencies'))group.warnings.push('multiple-currencies')
  }
 });
 return{groups,unassigned}
}

module.exports={normalizeCommodityCode,normalizeOriginCountry,groupPositionsByHsOrigin};
