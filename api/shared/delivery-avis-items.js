'use strict';
// RC1349: Lieferscheinpositionen werden NUR als Entwurf erfasst.
// Kunden erhalten ausschließlich durch einen Mitarbeiter freigegebene Daten.
const crypto=require('node:crypto');
const PO=/(?:kundenbestellnummer|kunden-bestellnummer|customer\s*(?:purchase\s*)?order\s*(?:no\.?|number|#)?|customer\s*po\s*(?:no\.?)?|your\s*order\s*(?:no\.?|number)?|purchase\s*order\s*(?:no\.?|number)?)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,39})/i;
const ITEM=/(?:kundenartikelnummer|kunden-artikelnummer|customer\s*(?:item|part|material)\s*(?:no\.?|number|#)?|your\s*(?:item|part)\s*(?:no\.?|number))\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9._/-]{1,59})/i;
const QUANTITY=/(?:gelieferte(?:r)?\s*(?:menge|anzahl)|geliefert(?:e)?\s*(?:menge|stückzahl)|delivered\s*(?:qty\.?|quantity)|shipped\s*(?:qty\.?|quantity))\s*[:#]\s*([0-9][0-9., ]{0,19})\s*(Stk\.?|PCS|pc|pieces|EA|kg|g|m|mm|l|L)?\b/i;
const UNIT=/^(?:Stk\.?|PCS|pc|pieces|EA|kg|g|m|mm|l|L)$/i;
function txt(x){return String(x==null?'':x).trim()}
function cleanToken(x,max){const s=txt(x);return s.length<=max&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(s)?s:''}
function qty(x){const s=txt(x).replace(/\s/g,'');return s.length<=20&&/^[0-9]+(?:[.,][0-9]{1,3}){0,2}$/.test(s)&&/[1-9]/.test(s)?s:''}
function unit(x){const s=txt(x);return UNIT.test(s)?s:''}
function safeReviewRows(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>100)throw invalid('Lieferavis: 1 bis 100 vollständige Artikelpositionen erforderlich.');
 return rows.map((r,i)=>{
  if(!r||typeof r!=='object'||Array.isArray(r))throw invalid('Artikelposition '+(i+1)+' ist ungültig.');
  const customerOrderNumber=cleanToken(r.customerOrderNumber,40),
   customerItemNumber=cleanToken(r.customerItemNumber,60),
   deliveredQuantity=qty(r.deliveredQuantity),
   quantityUnit=unit(r.quantityUnit);
  if(!customerOrderNumber||!customerItemNumber||!deliveredQuantity||!quantityUnit)
   throw invalid('Artikelposition '+(i+1)+': Bestellnummer, Kundenartikel, gelieferte Menge und Einheit müssen geprüft werden.');
  return{customerOrderNumber,customerItemNumber,deliveredQuantity,quantityUnit};
 });
}
function invalid(message){const e=new Error(message);e.code='DELIVERY_ITEMS_INVALID';e.status=400;return e}
function fieldKind(v){
 const s=txt(v).toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ');
 if(/^(?:kundenbestellnummer|kunden bestellnummer|customer (?:purchase )?order(?: (?:no|number))?|customer po|purchase order)$/.test(s))return'po';
 if(/^(?:kundenartikelnummer|kunden artikelnummer|customer (?:item|part|material)(?: (?:no|number))?|your (?:item|part)(?: (?:no|number))?)$/.test(s))return'item';
 if(/^(?:gelieferte menge|gelieferte anzahl|geliefert menge|delivered (?:qty|quantity)|shipped (?:qty|quantity))$/.test(s))return'quantity';
 if(/^(?:einheit|me|unit|uom|unit of measure)$/.test(s))return'unit';
 return'';
}
function splitColumns(line){return txt(line).split(/\t+|\s{2,}/).map(txt).filter(Boolean)}
function parseQuantityCell(cell,defaultUnit){
 const m=txt(cell).match(/^([0-9][0-9., ]{0,19})\s*(Stk\.?|PCS|pc|pieces|EA|kg|g|m|mm|l|L)?$/i);
 if(!m)return null;
 const amount=qty(m[1]),u=unit(m[2]||defaultUnit);
 return amount&&u?{deliveredQuantity:amount,quantityUnit:u}:null;
}
// DNC / D365 SalesPackingSlip: Customer Part ist NICHT Essentra Part.
// Qty Shipped ist die gelieferte Menge, niemals Qty Ordered.
// Nur klar spaltenorientierte Textzeilen; bei verlorener PDF-Spaltenordnung
// kein Raten und automatische Freigabe bleibt ohnehin gesperrt.
function dncCustomerOrder(lines){
 const input=lines.join('\n');
 const direct=input.match(/(?:^|\n)\s*Customer Order Number[ \t]{2,}([A-Z0-9][A-Z0-9._/-]{3,39})(?:[ \t]|$)/i);
 if(direct&&cleanToken(direct[1],40))return direct[1];
 // Manche PDF-Textextraktoren geben alle Feldnamen, dann die Werte aus.
 // Diese Zuordnung ist nur bei der belegbaren DNC -> SO -> Kunden-PO-Folge gültig.
 if(!/(?:^|\n)\s*Delivery Note number\s*\n\s*Essentra Order Number\s*\n\s*Customer Order Number\s*\n/i.test(input))return'';
 const ordered=input.match(/(?:^|\n)\s*DNC[0-9]{8,}\s*\n\s*SO[0-9]{8,}\s*\n\s*([0-9]{6,20})\s*(?:\n|$)/i);
 return ordered?cleanToken(ordered[1],40):'';
}
function parseDncDeliveryText(lines){
 const head=lines.join('\n');
 if(!/\bDelivery Note\b/i.test(head)||!/\bCustomer Part\b/i.test(head)||
    !/\bEssentra Part\b/i.test(head)||!/\bQty Shipped\b/i.test(head)||
    !/\bQty Ordered\b/i.test(head)||!/\bUnit of Measure\b/i.test(head))return null;
 const order=dncCustomerOrder(lines);
 if(!order)return{rows:[],issues:['Customer Order Number im DNC nicht eindeutig lesbar.']};
 const rows=[],issues=[];
 // Bei dieser DNC-Version folgen jeweils Customer Part, Essentra Part,
 // Beschreibung, UoM, Qty Ordered und als LETZTE Spalte Qty Shipped.
 // Die Spaltentrennung benötigt keine feste Anzahl Leerzeichen.
 const itemRow=/^([A-Z0-9][A-Z0-9._/-]{3,59})[ \t]+([A-Z0-9][A-Z0-9._/-]{3,59})[ \t]+(.+?)[ \t]+(EA|PC|PCS|STK\.?|Stk\.?|kg|g|mm|m|l|L)[ \t]+([0-9][0-9., ]{0,19})[ \t]+([0-9][0-9., ]{0,19})$/i;
 let withinTable=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/\bQty Shipped\b/i.test(line))withinTable=true;
  if(!withinTable)continue;
  if(/^\s*(?:ContainerID|Essentra Components Terms and Conditions|Certification for Essentra|Page\s+\d+)/i.test(line))break;
  const match=line.match(itemRow);
  if(!match)continue;
  const customerItemNumber=cleanToken(match[1],60),ordered=parseQuantityCell(match[5],match[4]),
   shipped=parseQuantityCell(match[6],match[4]);
  if(!customerItemNumber||!ordered||!shipped){
   issues.push('DNC Zeile '+(i+1)+': Mengen/Artikel nicht eindeutig.');continue;
  }
  rows.push({customerOrderNumber:order,customerItemNumber,
   deliveredQuantity:shipped.deliveredQuantity,quantityUnit:shipped.quantityUnit,sourceLine:i+1});
 }
 if(!rows.length)issues.push('DNC-Artikelzeile nicht spaltentreu lesbar: manuelle Belegprüfung erforderlich.');
 return{rows,issues};
}
function parseDeliveryText(source){
 const input=txt(source).slice(0,250000),lines=input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,5000);
 const orders=[...new Set(lines.map(s=>(s.match(PO)||[])[1]).filter(Boolean))],onlyOrder=orders.length===1?orders[0]:'';
 const found=[],issues=[];let header=null;
 const dnc=parseDncDeliveryText(lines);
 if(dnc){found.push(...dnc.rows);issues.push(...dnc.issues)}
 for(let i=0;i<lines.length;i++){
  const line=lines[i],p=line.match(PO),article=line.match(ITEM),amount=line.match(QUANTITY);
  // Explizit beschriftete Positionszeile, niemals interne Artikelnummer oder bestellte Menge übernehmen.
  if(article&&amount){
   const value=parseQuantityCell((amount[1]||'')+' '+(amount[2]||''),'');
   if(value&&(p||onlyOrder)){found.push({customerOrderNumber:p?p[1]:onlyOrder,customerItemNumber:article[1],...value,sourceLine:i+1});continue;}
   issues.push('Zeile '+(i+1)+': Bestellnummer oder Einheit nicht eindeutig.');
  }
  const cells=splitColumns(line),fields=cells.map(fieldKind);
  if(fields.includes('item')&&fields.includes('quantity')&&(fields.includes('po')||onlyOrder)){
   header={fields,sourceLine:i+1};continue;
  }
  if(header&&cells.length===header.fields.length){
   const values=Object.fromEntries(header.fields.map((k,j)=>[k,cells[j]]).filter(x=>x[0]));
   const value=parseQuantityCell(values.quantity||'',values.unit||'');
   const order=cleanToken(values.po||onlyOrder,40),item=cleanToken(values.item,60);
   if(value&&order&&item){found.push({customerOrderNumber:order,customerItemNumber:item,...value,sourceLine:i+1});continue;}
  }
  if(header&&/^(?:summe|gesamt|total|subtotal|zwischensumme)\b/i.test(line))header=null;
 }
 const unique=found.slice(0,100);
 return{status:unique.length?'review_required':'manual_review_required',rows:unique,issues,
  scannedLines:lines.length,manualReviewRequired:true};
}
function verifiedPublicRows(documents){
 const out=[];
 for(const d of Array.isArray(documents)?documents:[]){
  if(!d||d.status!=='approved'||d.current!==true||d.scanStatus!=='clean'||!(/^[a-f0-9]{64}$/.test(txt(d.sha256))))continue;
  let rows;try{rows=safeReviewRows(d.rows)}catch(_){continue}
  for(const row of rows){if(out.length>=300)return out;out.push(row)}
 }
 return out;
}
function fingerprint(buffer){return crypto.createHash('sha256').update(buffer).digest('hex')}
module.exports={parseDeliveryText,safeReviewRows,verifiedPublicRows,fingerprint};
