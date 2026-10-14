'use strict';

const calc=require('./customs-ai-calculations');

function text(value,max=5000){return String(value==null?'':value).trim().slice(0,max)}
function fold(value){return text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function money(value,currency){
 const n=Number(value);if(!Number.isFinite(n))return'';
 return n.toFixed(2).replace('.',',')+(currency?' '+text(currency,8).toUpperCase():'')
}
function base(kind,answer,facts,uncertainty=false){return{matched:true,kind,answer,facts,uncertainty,source:'invoice-analysis'}}
function hsFrom(question){const match=text(question).match(/\b(\d{6,10})\b/);return match?match[1]:''}
function originFrom(question){
 const q=fold(question),match=q.match(/\b(?:ursprung|origin|aus)\s+([a-z]{2})\b/);
 return match?match[1].toUpperCase():''
}
function reviewGroups(analysis){
 const groups=Array.isArray(analysis&&analysis.groups)?analysis.groups:[];
 return groups.filter(group=>{
  const status=fold(group&&group.status);return status&&status!=='complete'&&status!=='ready'
 }).map(group=>({
  commodityCode:text(group&&group.commodityCode,32),originCountry:text(group&&group.originCountry,16).toUpperCase(),value:Number.isFinite(Number(group&&group.value))?Number(group.value):null,currency:text(group&&group.currency,8).toUpperCase(),status:text(group&&group.status,32),warnings:Array.isArray(group&&group.warnings)?group.warnings.map(item=>text(item,80)).filter(Boolean).slice(0,20):[]
 }))
}
function answerDeterministicCustomsQuestion(options={}){
 const question=text(options.question),q=fold(question),analysis=options.analysis&&typeof options.analysis==='object'?options.analysis:{};
 if(!q)return{matched:false};

 const hs=hsFrom(question),origin=originFrom(question);
 if(hs&&origin&&/(warenwert|wert|summe|betrag)/.test(q)){
  const result=calc.groupValue(analysis,hs,origin);
  if(!result.found)return base('group-value',`Für HS ${hs} mit Ursprung ${origin} ist in der aktuellen Analyse keine eindeutige vollständige Gruppe vorhanden.`,result,true);
  return base('group-value',`Der analysierte Warenwert für HS ${hs} mit Ursprung ${origin} beträgt ${money(result.value,result.currency)}.`,result,false)
 }

 if(origin&&!hs&&/(warenwert|wert|summe|betrag)/.test(q)){
  const result=calc.originValue(analysis,origin);
  if(!result.supported){
   const currencies=Array.isArray(result.currencies)&&result.currencies.length?` Erkannte Währungen: ${result.currencies.join(', ')}.`:'';
   return base('origin-value',`Der Warenwert für Ursprung ${origin} kann aus der aktuellen Analyse nicht sicher zu einer Summe zusammengeführt werden.${currencies} Bitte die Währungen und fehlenden Werte prüfen.`,result,true)
  }
  return base('origin-value',`Der analysierte Warenwert für Ursprung ${origin} beträgt ${money(result.value,result.currency)}.`,result,false)
 }

 if(/(kontrollsumme|rechnungssumme|summe stimmt|summen stimmen|abgleich.*summe)/.test(q)){
  const result=calc.reconciliation(analysis),parts=[];
  if(result.invoiceTotal!=null)parts.push(`Rechnungssumme ${money(result.invoiceTotal,result.currency)}`);
  if(result.accountedTotal!=null)parts.push(`zugeordnete Summe ${money(result.accountedTotal,result.currency)}`);
  if(result.difference!=null)parts.push(`Differenz ${money(result.difference,result.currency)}`);
  let answer=result.matches?`Die Kontrollsumme stimmt: ${parts.join(', ')}.`:`Die Kontrollsumme stimmt nicht eindeutig: ${parts.join(', ')}.`;
  if(!result.complete)answer+=' Der fachliche Prüfstatus ist noch nicht vollständig.';
  return base('reconciliation',answer,result,!result.matches||!result.complete)
 }

 if(/(ungeklart|unassigned|nicht zugeordnet|offene position|positionen.*offen|fehlt|fehlend)/.test(q)){
  const result=calc.unassignedSummary(analysis);
  if(!result.count)return base('unassigned','In der aktuellen Rechnungsanalyse gibt es keine ungeklärten Positionen.',result,false);
  const details=[];
  if(result.missingHsCount)details.push(`${result.missingHsCount} ohne HS-Code`);
  if(result.missingOriginCount)details.push(`${result.missingOriginCount} ohne Ursprung`);
  if(result.missingValueCount)details.push(`${result.missingValueCount} ohne Warenwert`);
  return base('unassigned',`${result.count} Position(en) sind noch ungeklärt: ${result.positions.join(', ')||'Positionsnummer nicht verfügbar'}${details.length?` (${details.join(', ')})`:''}.`,result,true)
 }

 if(/(mussen|muessen|muss).*pruf|pruf.*gruppe|review.*group/.test(q)){
  const groups=reviewGroups(analysis),facts={groups,count:groups.length};
  if(!groups.length)return base('review-groups','Aktuell ist keine HS-/Ursprungsgruppe mit Prüfstatus markiert.',facts,false);
  const labels=groups.map(group=>`${group.commodityCode||'HS fehlt'} / ${group.originCountry||'Ursprung fehlt'}`);
  return base('review-groups',`${groups.length} HS-/Ursprungsgruppe(n) müssen geprüft werden: ${labels.join(', ')}.`,facts,true)
 }

 if(/(welche|liste|nenn).*(hs code|hs codes|warennummer|zolltarifnummer)|\bhs codes?\b/.test(q)){
  const codes=calc.listCommodityCodes(analysis),facts={codes,count:codes.length};
  return base('commodity-codes',codes.length?`In der aktuellen Analyse sind folgende HS-Codes enthalten: ${codes.join(', ')}.`:'In der aktuellen Analyse ist kein belastbarer HS-Code vorhanden.',facts,codes.length===0)
 }

 if(/(welche|liste|nenn).*(ursprungsland|ursprungslander|ursprung)|\bursprungslander\b/.test(q)){
  const countries=calc.listOriginCountries(analysis),facts={countries,count:countries.length};
  return base('origin-countries',countries.length?`In der aktuellen Analyse sind folgende Ursprungsländer enthalten: ${countries.join(', ')}.`:'In der aktuellen Analyse ist kein belastbares Ursprungsland vorhanden.',facts,countries.length===0)
 }

 return{matched:false}
}

module.exports={answerDeterministicCustomsQuestion};
