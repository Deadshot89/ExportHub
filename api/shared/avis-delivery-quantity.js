'use strict';
// Read-only interpretation of explicitly labelled D365 delivery-note lines.
// Never use invoice quantities, package counts, weights or inferred totals.
const DOC=/\b(?:delivery\s*note|packing\s*slip|lieferschein|lieferschein\s*nr)\b/i;
const INVOICE=/\b(?:invoice\s*(?:number|no\.?|nr\.?|#)|commercial\s*invoice|proforma\s*invoice|rechnungs(?:nummer|nr\.?))\b/i;
const SHIPPED=/\b(?:qty\s*shipped|shipped\s*(?:qty|quantity)|delivered\s*(?:qty|quantity)|quantity\s*delivered|gelieferte\s*menge|liefermenge|menge\s*geliefert)\b/i;
const ITEM_HEADER=/\b(?:item\s*(?:number|no\.?|nr\.?)|part\s*(?:number|no\.?|nr\.?)|article\s*(?:number|no\.?|nr\.?)|artikel(?:nummer|nr\.?)|material(?:nummer|nr\.?))\b/i;
const UNIT=/^(?:EA|PCS|PC|STK|ST|PCE|EACH)$/i;
const DNC=/(?<![A-Za-z0-9])DNC\s*[-_:]?\s*([0-9]{6,20})(?![0-9])/gi;
function clean(s,max=200){return String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function number(s){
 const value=String(s||'').trim();
 if(!/^\d{1,9}(?:[.,]\d{1,3})?$/.test(value))return null;
 // An isolated comma/dot followed by three digits could mean thousands or decimals.
 if(/[.,]\d{3}$/.test(value))return null;
 const n=Number(value.replace(',','.'));
 return Number.isFinite(n)&&n>0&&n<=100000000? n:null;
}
function parse(text,filename=''){
 const raw=String(text||'').replace(/\r/g,'').slice(0,250000);
 const lines=raw.split('\n').map(v=>v.trim()).filter(Boolean);
 const firstLines=lines.slice(0,35),head=firstLines.join(' ').slice(0,2000);
 // "Packing slip No.: DNC..." on an invoice is a cross-reference, not proof
 // that the PDF itself is a delivery note. Do not display invoice quantities.
 const invoiceHeading=INVOICE.test(head)||firstLines.some(line=>
    /^(?:invoice|rechnung|facture|factura|faktura)(?:\\b|\\s*[:#])/i.test(line));
 const deliveryHeading=firstLines.some(line=>
    /^(?:delivery[\\s-]*note|packing[\\s-]*slip|lieferschein)\\b(?!\\s*(?:no\\.?|nr\\.?|number)\\b)/i.test(line));
 if(!deliveryHeading||invoiceHeading)return{status:'unavailable',reason:'not-delivery-note',positions:[]};
 const refs=new Set();let match;DNC.lastIndex=0;
 while((match=DNC.exec(raw)))refs.add('DNC'+match[1]);
 if(!refs.size){DNC.lastIndex=0;while((match=DNC.exec(String(filename||''))))refs.add('DNC'+match[1]);}
 if(refs.size!==1)return{status:'unavailable',reason:refs.size?'ambiguous-reference':'no-dnc',positions:[]};
 const headerIndex=lines.findIndex((line,i)=>i<55&&(SHIPPED.test(line)&&ITEM_HEADER.test(line)||
     (i+1<lines.length&&ITEM_HEADER.test(line)&&SHIPPED.test(lines[i+1]))||
     (i+1<lines.length&&SHIPPED.test(line)&&ITEM_HEADER.test(lines[i+1]))));
 if(headerIndex<0)return{status:'unavailable',reason:'no-explicit-shipped-table',positions:[]};
 const positions=[];
 // Do not parse subtotals or footer information into physical delivered goods.
 for(const line of lines.slice(headerIndex+1,headerIndex+90)){
   if(/^(?:subtotal|total\b|summe|gesamt|order\s*total|notes\b|bemerkung|tax\b|vat\b|freight\b|invoice\b)/i.test(line))break;
   const m=line.match(/^([A-Z0-9][A-Z0-9._-]{3,39})\s+(.{3,180}?)\s+(\d{1,9}(?:[.,]\d{1,3})?)\s+(EA|PCS|PC|STK|ST|PCE|EACH)\s*$/i);
   if(!m||!/[0-9]/.test(m[1])||!UNIT.test(m[4]))continue;
   const quantity=number(m[3]),description=clean(m[2],160);
   if(quantity==null||!description||!/[A-Za-z]/.test(description))continue;
   positions.push({article:clean(m[1],40),description,quantity,unit:m[4].toUpperCase()});
   if(positions.length>=60)break;
 }
 if(!positions.length)return{status:'unavailable',reason:'no-unambiguous-lines',positions:[]};
 return{status:'parsed',documentReference:Array.from(refs)[0],positions};
}
module.exports={parse};
