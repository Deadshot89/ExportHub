'use strict';
// Kunden-Avis: Dokumente aus dem REF-Ordner (Upload in der Sendungsansicht).
// Der Upload benennt Dateien "<Art>_<REF>_<JJJJMMTT-hhmmss>_<Originalname>".
// Nur Lieferschein, Rechnung und Packliste sind für Kunden sichtbar; Excel und
// sonstige Dokumente bleiben intern.
const CATEGORY={lieferschein:'Lieferschein',rechnung:'Rechnung',packliste:'Packliste'};
const MIME={'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};
const MAX_DOCS=30;

function text(v){return String(v==null?'':v).trim()}
function parseName(name,reference){
 const ref=text(reference).toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(!/^[A-Z0-9]{6}$/.test(ref))return null;
 const m=text(name).match(/^(Lieferschein|Rechnung|Packliste)_([A-Z0-9]{6})_\d{8}-\d{6}_(.+)$/i);
 if(!m||m[2].toUpperCase()!==ref)return null;
 const ext=(m[3].toLowerCase().match(/(\.[a-z0-9]+)$/)||[])[1]||'';
 return{category:CATEGORY[m[1].toLowerCase()],original:m[3],ext};
}
function toRecords(files,reference){
 const out=[];
 for(const f of Array.isArray(files)?files:[]){
  const id=text(f&&f.id),parsed=parseName(f&&f.name,reference);
  if(!id||!parsed)continue;
  out.push({id:'ref-'+id,refItemId:id,name:parsed.original,mime:MIME[parsed.ext]||'application/octet-stream',size:Number(f.size||0)||0,category:parsed.category,inline:null,external:'',blobName:'',uploadedAt:text(f.createdDateTime)});
  if(out.length>=MAX_DOCS)break;
 }
 return out;
}
// Fehler beim Lesen des REF-Ordners dürfen den Avis nicht blockieren.
async function load(referenceFolder,reference,environment,log){
 try{return toRecords(await referenceFolder.listFiles(reference,environment),reference)}
 catch(e){if(typeof log==='function')log('customer-avis REF-Dokumente nicht lesbar',text(e&&e.code));return[]}
}
module.exports={parseName,toRecords,load,CATEGORY};
