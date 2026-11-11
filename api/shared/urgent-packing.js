'use strict';
// A private, versioned packaging catalog. The source TSV is never bundled into public assets.
const MAX_BYTES=5_000_000,MAX_ROWS=150_000;
function problem(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e;}
function numberGerman(raw){
 const s=String(raw==null?'':raw).trim();
 if(!/^\d+(?:\.\d{3})*(?:,\d{1,5})?$/.test(s))return NaN;
 return Number(s.replace(/\./g,'').replace(',','.'));
}
function parseCatalog(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>MAX_BYTES)throw problem('URGENT_PACKING_FILE_TOO_LARGE','Die Artikelliste ist zu groß oder ungültig.',413);
 const rows=raw.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
 if(rows.length<2||rows.length-1>MAX_ROWS)throw problem('URGENT_PACKING_ROWS_INVALID','Die Artikelliste hat zu viele oder keine Artikel.');
 const header=rows.shift().split('\t').map(s=>s.trim().toLowerCase());
 const itemIdx=header.indexOf('item number'),qtyIdx=header.indexOf('packing quantity');
 if(itemIdx<0||qtyIdx<0)throw problem('URGENT_PACKING_HEADER_INVALID','Die Liste benötigt die Spalten Item number und Packing quantity (Tab-getrennt).');
 const quantities=Object.create(null);
 let missing=0;
 for(let i=0;i<rows.length;i++){
  const cols=rows[i].split('\t'),article=String(cols[itemIdx]||'').trim(),n=numberGerman(cols[qtyIdx]);
  if(!/^\d{4,20}$/.test(article)||!Number.isSafeInteger(n)||n<0||n>10_000_000)
   throw problem('URGENT_PACKING_ROW_INVALID','Ungültiger Artikel oder Verpackungsmenge in Datenzeile '+(i+2)+'.');
  if(n===0){missing++;continue;} // 0 means unknown, never a one-piece pack.
  if(Object.hasOwn(quantities,article)&&quantities[article]!==n)
   throw problem('URGENT_PACKING_DUPLICATE','Widersprüchliche Verpackungsgröße für Artikel '+article+'.');
  quantities[article]=n;
 }
 return{schemaVersion:1,source:'secure-tsv-import',count:Object.keys(quantities).length,unknownPackSize:missing,quantities};
}
function evaluate(article,quantity,minibag,catalog){
 const id=String(article||'').trim(),size=catalog&&catalog.quantities&&catalog.quantities[id];
 if(minibag===true||!Number.isSafeInteger(quantity)||quantity<=0||!Number.isSafeInteger(size)||size<=0)return null;
 const rest=quantity%size;
 return rest>0?{article:id,quantity,packingQuantity:size,remainder:rest}:null;
}
function reviewItems(items,catalog){
 if(!Array.isArray(items))return[];
 return items.map((item,index)=>({...evaluate(item&&item.article,Number(item&&item.quantity),item&&item.minibag,catalog),index}))
  .filter(x=>x.packingQuantity>0);
}
function requireReview(items,catalog){
 const checks=reviewItems(items,catalog);
 const missing=checks.filter(c=>!(items[c.index]&&items[c.index].minibagReviewed===true));
 if(missing.length){
  const e=problem('URGENT_MINIBAG_CONFIRM_REQUIRED','Bist du sicher, dass es kein Minibag ist? Bitte die Artikelmenge prüfen.',409);
  e.minibagArticles=[...new Set(missing.map(x=>x.article))];
  throw e;
 }
 return checks;
}
module.exports={parseCatalog,evaluate,reviewItems,requireReview,problem};
