'use strict';

function text(v){return String(v==null?'':v).trim()}
function normalize(v){
 return text(v).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()
}
function unique(values){return Array.from(new Set((values||[]).map(text).filter(Boolean)))}
function safeNumber(v){
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 let s=text(v).replace(/\s+/g,'');
 if(!s)return null;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0){
  if(comma>dot)s=s.replace(/\./g,'').replace(',','.');
  else s=s.replace(/,/g,'');
 }else if(comma>=0)s=s.replace(',','.');
 s=s.replace(/[^0-9+\-.]/g,'');
 const n=Number(s);return Number.isFinite(n)?n:null
}
function codeDigits(v){return text(v).replace(/\D/g,'').slice(0,10)}
function yCodes(v){
 const source=text(v).toUpperCase(),out=[];
 const rx=/\bY\s*[-/.]?\s*(\d{3})\b/g;let m;
 while((m=rx.exec(source)))out.push('Y'+m[1]);
 return unique(out)
}
const ALIASES=Object.freeze({
 position:['pos','position','positionsnummer','laufende nummer','item','item no','item number','line','line no'],
 itemNumber:['artikel','artikelnummer','material','materialnummer','item number','part number','part no','sku','product code'],
 description:['warenbeschreibung','bezeichnung','beschreibung','goods description','description','product description','artikelbezeichnung'],
 commodityCode:['hs code','hscode','hs-code','warennummer','zolltarifnummer','zolltarif','commodity code','taric','cn code','customs code'],
 originCountry:['herkunftsland','ursprungsland','ursprung','origin country','country of origin','origin','coo'],
 quantity:['menge','anzahl','qty','quantity','pieces','pcs'],
 netMassKg:['eigenmasse','nettomasse','nettogewicht','net mass','net weight','net kg','netto kg'],
 grossMassKg:['rohmasse','bruttomasse','bruttogewicht','gross mass','gross weight','gross kg','brutto kg'],
 value:['warenwert','positionswert','wert','item value','invoice value','customs value','amount','value','line value'],
 currency:['wahrung','waehrung','currency','currency code','curr'],
 supplementaryCodes:['y nummer','y nummern','y code','y codes','y-codes','unterlagencode','unterlagencodes','document code','document codes','additional code'],
 invoiceNumber:['rechnungsnummer','rechnung nr','invoice number','invoice no','invoice']
});
const NORMAL_ALIASES=Object.fromEntries(Object.entries(ALIASES).map(([key,values])=>[key,values.map(normalize)]));
function fieldForHeader(header){
 const h=normalize(header);if(!h)return'';
 let best='',score=0;
 for(const [key,aliases] of Object.entries(NORMAL_ALIASES)){
  for(const alias of aliases){
   if(!alias)continue;
   let s=0;
   if(h===alias)s=100+alias.length;
   else if(h.includes(alias)&&alias.length>=4)s=70+alias.length;
   else if(alias.includes(h)&&h.length>=5)s=40+h.length;
   if(s>score){score=s;best=key}
  }
 }
 return best
}
function headerMap(headers){
 const out={};(headers||[]).forEach((h,index)=>{const key=fieldForHeader(h);if(key&&!Object.prototype.hasOwnProperty.call(out,key))out[key]=index});
 return out
}
function countMapped(headers){return Object.keys(headerMap(headers)).length}
function matrixToObjects(matrix,source){
 const rows=Array.isArray(matrix)?matrix:[];if(!rows.length)return[];
 let bestIndex=-1,bestCount=0;
 for(let i=0;i<Math.min(rows.length,12);i++){const count=countMapped(rows[i]);if(count>bestCount){bestCount=count;bestIndex=i}}
 if(bestIndex<0||bestCount<2)return[];
 const map=headerMap(rows[bestIndex]),out=[];
 for(let i=bestIndex+1;i<rows.length&&out.length<500;i++){
  const row=Array.isArray(rows[i])?rows[i]:[],obj={_source:source||'',_row:i+1};let nonEmpty=0;
  for(const [key,index] of Object.entries(map)){const value=row[index];if(text(value))nonEmpty++;obj[key]=value}
  if(nonEmpty)out.push(obj)
 }
 return out
}
function splitDelimitedLine(line,delimiter){
 const out=[];let cur='',quoted=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(ch==='"'){
   if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted;
  }else if(ch===delimiter&&!quoted){out.push(cur);cur=''}else cur+=ch
 }
 out.push(cur);return out
}
function delimiterFor(raw){
 const sample=String(raw||'').split(/\r?\n/).filter(Boolean).slice(0,5),options=[';','\t',','];
 let best=';',score=-1;
 for(const d of options){
  const counts=sample.map(line=>splitDelimitedLine(line,d).length-1),current=counts.reduce((a,b)=>a+b,0);
  if(current>score){score=current;best=d}
 }
 return best
}
function parseDelimited(raw){
 const source=String(raw==null?'':raw).replace(/^\uFEFF/,'').replace(/\u0000/g,''),delimiter=delimiterFor(source);
 return source.split(/\r?\n/).filter(line=>line.trim().length).map(line=>splitDelimitedLine(line,delimiter).map(v=>v.trim()))
}
function normalizedCountry(v){
 const raw=text(v).toUpperCase();if(/^[A-Z]{2}$/.test(raw))return raw;
 return text(v).slice(0,80)
}
function normalizePosition(row,index){
 row=row&&typeof row==='object'?row:{};
 const code=codeDigits(row.commodityCode),origin=normalizedCountry(row.originCountry),net=safeNumber(row.netMassKg),gross=safeNumber(row.grossMassKg),value=safeNumber(row.value),quantity=safeNumber(row.quantity);
 const pos=text(row.position)||String(index+1),supp=unique([].concat(Array.isArray(row.supplementaryCodes)?row.supplementaryCodes:yCodes(row.supplementaryCodes)));
 const missing=[];
 if(!text(row.description))missing.push('description');
 if(code.length<6)missing.push('commodityCode');
 if(!origin)missing.push('originCountry');
 if(net==null&&gross==null)missing.push('weight');
 if(value==null)missing.push('value');
 const warnings=[];
 if(code&&code.length<8)warnings.push('commodity-code-short');
 if(code&&code.length>8)warnings.push('commodity-code-extended');
 if(origin&&!/^[A-Z]{2}$/.test(origin))warnings.push('origin-not-iso2');
 return{
  position:pos.slice(0,40),
  itemNumber:text(row.itemNumber).slice(0,80),
  description:text(row.description).slice(0,300),
  commodityCode:code,
  originCountry:origin,
  quantity:quantity==null?null:quantity,
  netMassKg:net,
  grossMassKg:gross,
  value:value,
  currency:text(row.currency).toUpperCase().slice(0,3),
  supplementaryCodes:supp.slice(0,20),
  invoiceNumber:text(row.invoiceNumber).slice(0,80),
  source:text(row._source).slice(0,160),
  sourceRow:Number(row._row||0)||null,
  missing,
  warnings,
  readyForReview:missing.length===0
 }
}
function analyzeObjects(rows){
 const positions=(rows||[]).slice(0,500).map(normalizePosition).filter(p=>p.description||p.commodityCode||p.itemNumber||p.value!=null||p.netMassKg!=null||p.grossMassKg!=null);
 const currencies=unique(positions.map(p=>p.currency)),totalValue=positions.reduce((sum,p)=>sum+(p.value||0),0),totalNetMassKg=positions.reduce((sum,p)=>sum+(p.netMassKg||0),0),totalGrossMassKg=positions.reduce((sum,p)=>sum+(p.grossMassKg||0),0);
 return{
  positions,
  totals:{value:Number(totalValue.toFixed(2)),netMassKg:Number(totalNetMassKg.toFixed(3)),grossMassKg:Number(totalGrossMassKg.toFixed(3))},
  currencies,
  readyCount:positions.filter(p=>p.readyForReview).length,
  reviewCount:positions.filter(p=>!p.readyForReview).length
 }
}
function valueNear(line){
 const m=String(line||'').match(/(?:EUR|USD|GBP|CHF)?\s*([0-9]{1,3}(?:[. ][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:[.,][0-9]{2}))\s*(EUR|USD|GBP|CHF)?/i);
 return m?{value:safeNumber(m[1]),currency:text(m[2]).toUpperCase()}:null
}
function extractPdfCandidates(raw,source){
 const full=String(raw||''),lines=full.split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean),positions=[];
 for(let i=0;i<lines.length&&positions.length<200;i++){
  const line=lines[i],matches=Array.from(line.matchAll(/\b(\d{6,10})\b/g));
  for(const match of matches){
   const code=match[1],windowText=[lines[i-1]||'',line,lines[i+1]||''].join(' ');
   let origin='';
   const om=windowText.match(/(?:ursprung(?:sland)?|herkunftsland|country of origin|origin)\s*[:\-]?\s*([A-Z]{2}|[A-Za-zÄÖÜäöüß]{3,30})/i);if(om)origin=om[1];
   const nm=windowText.match(/(?:netto(?:gewicht|masse)?|net(?:\s+weight|\s+mass)?|eigenmasse)\s*[:\-]?\s*([0-9.,]+)/i);
   const gm=windowText.match(/(?:brutto(?:gewicht|masse)?|gross(?:\s+weight|\s+mass)?|rohmasse)\s*[:\-]?\s*([0-9.,]+)/i);
   const vm=valueNear(windowText);
   const clean=line.replace(code,'').replace(/\s+/g,' ').trim();
   positions.push({_source:source,_row:i+1,position:String(positions.length+1),description:clean.slice(0,300),commodityCode:code,originCountry:origin,netMassKg:nm&&nm[1],grossMassKg:gm&&gm[1],value:vm&&vm.value,currency:vm&&vm.currency,supplementaryCodes:yCodes(windowText)})
  }
 }
 const analysis=analyzeObjects(positions),globalY=yCodes(full);
 return Object.assign(analysis,{documentCodes:globalY,extraction:'pdf-text-candidates',requiresReview:true,textLength:full.length})
}
module.exports={ALIASES,normalize,safeNumber,codeDigits,yCodes,fieldForHeader,headerMap,matrixToObjects,parseDelimited,normalizePosition,analyzeObjects,extractPdfCandidates};
