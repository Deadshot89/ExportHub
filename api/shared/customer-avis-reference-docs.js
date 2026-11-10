'use strict';
// Kunden-Avis: Dokumente aus der Sendungsansicht (REF-Ordner in SharePoint und unabhängige Azure-Kopie).
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
function toRecords(files,reference,source='graph'){
 const out=[];
 for(const f of Array.isArray(files)?files:[]){
  const id=text(f&&f.id),parsed=parseName(f&&f.name,reference);
  if(!id||!parsed)continue;
  out.push({id:'ref-'+id,refItemId:id,refSource:source,name:parsed.original,mime:MIME[parsed.ext]||'application/octet-stream',size:Number(f.size||0)||0,category:parsed.category,inline:null,external:'',blobName:'',uploadedAt:text(f.createdDateTime),sourceName:text(f.name)});
  if(out.length>=MAX_DOCS)break;
 }
 return out;
}
// Fehler beim Lesen einer Quelle dürfen den Avis nicht blockieren; die andere Quelle bleibt sichtbar.
// Azure-Dokumente stehen vor gleichnamigen SharePoint-Dateien (gleicher Upload, verifizierte Kopie), Doppelte entfallen.
async function load(referenceFolder,reference,environment,log,refDocStore){
 const warn=code=>{if(typeof log==='function')log('customer-avis REF-Dokumente nicht lesbar',code)};
 let azure=[],graph=[],hidden=new Set();
 if(refDocStore&&typeof refDocStore.hiddenNames==='function'){
  try{hidden=await refDocStore.hiddenNames(reference,environment)}catch(e){warn('removal-ledger:'+text(e&&e.code));return []}
 }
 if(refDocStore&&typeof refDocStore.list==='function'){
  try{azure=toRecords(await refDocStore.list(reference,environment),reference,'azure')}catch(e){warn('azure:'+text(e&&e.code))}
 }
 try{graph=toRecords(await referenceFolder.listFiles(reference,environment),reference,'graph')}catch(e){warn(text(e&&e.code))}
 const seen=new Set(),out=[];
 for(const d of azure.concat(graph)){
  const key=d.sourceName.toLowerCase();
  // Azure list already excludes removed IDs; suppress tombstoned names only from Graph.
  // A freshly re-uploaded Azure file with the same name must remain visible.
  if(seen.has(key)||(d.refSource==='graph'&&hidden.has(key)))continue;
  seen.add(key);out.push(d);
  if(out.length>=MAX_DOCS)break;
 }
 return out;
}
module.exports={parseName,toRecords,load,CATEGORY};
