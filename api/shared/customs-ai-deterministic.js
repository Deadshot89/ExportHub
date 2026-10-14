'use strict';

const calc=require('./customs-ai-calculations');
const apiI18n=require('./i18n');

const LOCALES=Object.freeze({de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'});
function text(value,max=5000){return String(value==null?'':value).trim().slice(0,max)}
function fold(value){return text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function money(value,currency,language){
 const n=Number(value);if(!Number.isFinite(n))return'';
 const lang=apiI18n.normalize(language)||'de',locale=LOCALES[lang]||LOCALES.de;
 let formatted='';
 try{formatted=new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}catch(_){formatted=n.toFixed(2).replace('.',lang==='de'?',':'.')}
 return formatted+(currency?' '+text(currency,8).toUpperCase():'')
}
function tr(language,key,vars){return apiI18n.tLang(language,key,vars)}
function base(kind,answer,facts,uncertainty=false){return{matched:true,kind,answer,facts,uncertainty,source:'invoice-analysis'}}
function hsFrom(question){const match=text(question).match(/\b(\d{6,10})\b/);return match?match[1]:''}
function originFrom(question){
 const q=fold(question),match=q.match(/\b(?:ursprung|origin|aus|from|pochodzenie|origen|origine)\s+([a-z]{2})\b/);
 return match?match[1].toUpperCase():''
}
function hasAny(q,values){return values.some(value=>q.includes(value))}
function valueIntent(q){return hasAny(q,['warenwert','wert','summe','betrag','value','amount','wartosc','suma','valor','importe','valeur','montant','valore','totale'])}
function reconciliationIntent(q){return hasAny(q,['kontrollsumme','rechnungssumme','summe stimmt','summen stimmen','control total','invoice total','suma kontrolna','suma faktury','suma de control','total de factura','total de controle','total facture','totale di controllo','totale fattura'])||/abgleich.*summe/.test(q)}
function unresolvedIntent(q){
 const position=hasAny(q,['position','positionen','positions','pozyc','partid','posicion','posizioni','item','items']);
 const unresolved=hasAny(q,['ungeklart','offen','unassigned','nicht zugeordnet','fehlend','fehlt','unresolved','niewyjasn','sin resolver','non resolu','irrisolt']);
 return unresolved&&(position||q.includes('unassigned'))
}
function reviewIntent(q){return /(?:mussen|muessen).*pruf|pruf.*gruppe|review.*group/.test(q)||hasAny(q,['wymagaja kontroli','requieren revision','doivent etre controles','richiedono verifica'])}
function commodityIntent(q){
 const codeToken=/\b(?:hs|sh)\b/.test(q)||hasAny(q,['warennummer','zolltarifnummer']);
 const askToken=hasAny(q,['welche','liste','nenn','which','what','jakie','ktore','que','quels','quelles','quali','codes','kody','codigos','codici']);
 return codeToken&&askToken
}
function originCountriesIntent(q){return hasAny(q,['ursprungsland','ursprungslander','origin countr','kraje pochodzenia','pais de origen','paises de origen','pays d origine','paesi di origine'])}
function reviewGroups(analysis){
 const groups=Array.isArray(analysis&&analysis.groups)?analysis.groups:[];
 return groups.filter(group=>{
  const status=fold(group&&group.status);return status&&status!=='complete'&&status!=='ready'
 }).map(group=>({
  commodityCode:text(group&&group.commodityCode,32),originCountry:text(group&&group.originCountry,16).toUpperCase(),value:Number.isFinite(Number(group&&group.value))?Number(group.value):null,currency:text(group&&group.currency,8).toUpperCase(),status:text(group&&group.status,32),warnings:Array.isArray(group&&group.warnings)?group.warnings.map(item=>text(item,80)).filter(Boolean).slice(0,20):[]
 }))
}
function answerDeterministicCustomsQuestion(options={}){
 const question=text(options.question),q=fold(question),analysis=options.analysis&&typeof options.analysis==='object'?options.analysis:{},language=apiI18n.normalize(options.language)||'de';
 if(!q)return{matched:false};

 const hs=hsFrom(question),origin=originFrom(question);
 if(hs&&origin&&valueIntent(q)){
  const result=calc.groupValue(analysis,hs,origin);
  if(!result.found)return base('group-value',tr(language,'api.customsAi.groupValueMissing',{hs,origin}),result,true);
  return base('group-value',tr(language,'api.customsAi.groupValue',{hs,origin,value:money(result.value,result.currency,language)}),result,false)
 }

 if(origin&&!hs&&valueIntent(q)){
  const result=calc.originValue(analysis,origin);
  if(!result.supported){
   const currencies=Array.isArray(result.currencies)&&result.currencies.length?tr(language,'api.customsAi.originCurrencies',{currencies:result.currencies.join(', ')}):'';
   return base('origin-value',tr(language,'api.customsAi.originValueUnsupported',{origin,currencyInfo:currencies?' '+currencies:''}),result,true)
  }
  return base('origin-value',tr(language,'api.customsAi.originValue',{origin,value:money(result.value,result.currency,language)}),result,false)
 }

 if(reconciliationIntent(q)){
  const result=calc.reconciliation(analysis),parts=[];
  if(result.invoiceTotal!=null)parts.push(tr(language,'api.customsAi.reconciliationInvoiceTotal',{value:money(result.invoiceTotal,result.currency,language)}));
  if(result.accountedTotal!=null)parts.push(tr(language,'api.customsAi.reconciliationAccountedTotal',{value:money(result.accountedTotal,result.currency,language)}));
  if(result.difference!=null)parts.push(tr(language,'api.customsAi.reconciliationDifference',{value:money(result.difference,result.currency,language)}));
  let answer=tr(language,result.matches?'api.customsAi.reconciliationMatch':'api.customsAi.reconciliationMismatch',{details:parts.join(', ')});
  if(!result.complete)answer+=' '+tr(language,'api.customsAi.reconciliationIncomplete');
  return base('reconciliation',answer,result,!result.matches||!result.complete)
 }

 if(unresolvedIntent(q)){
  const result=calc.unassignedSummary(analysis);
  if(!result.count)return base('unassigned',tr(language,'api.customsAi.unassignedNone'),result,false);
  const details=[];
  if(result.missingHsCount)details.push(tr(language,'api.customsAi.unassignedMissingHs',{count:result.missingHsCount}));
  if(result.missingOriginCount)details.push(tr(language,'api.customsAi.unassignedMissingOrigin',{count:result.missingOriginCount}));
  if(result.missingValueCount)details.push(tr(language,'api.customsAi.unassignedMissingValue',{count:result.missingValueCount}));
  const positions=result.positions.join(', ')||tr(language,'api.customsAi.unassignedUnknownPosition');
  return base('unassigned',tr(language,'api.customsAi.unassignedSummary',{count:result.count,positions,details:details.length?` (${details.join(', ')})`:''}),result,true)
 }

 if(reviewIntent(q)){
  const groups=reviewGroups(analysis),facts={groups,count:groups.length};
  if(!groups.length)return base('review-groups',tr(language,'api.customsAi.reviewNone'),facts,false);
  const labels=groups.map(group=>`${group.commodityCode||tr(language,'api.customsAi.reviewHsMissing')} / ${group.originCountry||tr(language,'api.customsAi.reviewOriginMissing')}`);
  return base('review-groups',tr(language,'api.customsAi.reviewSummary',{count:groups.length,groups:labels.join(', ')}),facts,true)
 }

 if(commodityIntent(q)){
  const codes=calc.listCommodityCodes(analysis),facts={codes,count:codes.length};
  return base('commodity-codes',codes.length?tr(language,'api.customsAi.commodityCodes',{codes:codes.join(', ')}):tr(language,'api.customsAi.commodityCodesNone'),facts,codes.length===0)
 }

 if(originCountriesIntent(q)){
  const countries=calc.listOriginCountries(analysis),facts={countries,count:countries.length};
  return base('origin-countries',countries.length?tr(language,'api.customsAi.originCountries',{countries:countries.join(', ')}):tr(language,'api.customsAi.originCountriesNone'),facts,countries.length===0)
 }

 return{matched:false}
}

module.exports={answerDeterministicCustomsQuestion};
