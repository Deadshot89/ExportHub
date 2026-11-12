'use strict';
const crypto=require('crypto');
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
  out.push({id:'ref-'+id,refItemId:id,refSource:source,name:parsed.original,mime:MIME[parsed.ext]||'application/octet-stream',size:Number(f.size||0)||0,category:parsed.category,inline:null,external:'',blobName:'',uploadedAt:text(f.createdDateTime),sourceName:text(f.name),sha256:/^[a-f0-9]{64}$/i.test(text(f.sha256))?text(f.sha256).toLowerCase():''});
  if(out.length>=MAX_DOCS)break;
 }
 return out;
}
// Fehler beim Lesen einer Quelle dürfen den Avis nicht blockieren; die andere Quelle bleibt sichtbar.
// Azure-Dokumente stehen vor gleichnamigen SharePoint-Dateien (gleicher Upload, verifizierte Kopie), Doppelte entfallen.
async function load(referenceFolder,reference,environment,log,refDocStore){
 const warn=code=>{if(typeof log==='function')log('customer-avis REF-Dokumente nicht lesbar',code)};
 let azure=[],graph=[];
 if(refDocStore&&typeof refDocStore.list==='function'){
  try{azure=toRecords(await refDocStore.list(reference,environment),reference,'azure')}catch(e){warn('azure:'+text(e&&e.code))}
 }
 try{graph=toRecords(await referenceFolder.listFiles(reference,environment),reference,'graph')}catch(e){warn(text(e&&e.code))}
 // A matching name alone cannot prove a matching file. Compare SHA-256
 // for the Azure/SharePoint copies when the upload names and sizes match.
 // A failed or unavailable read must never hide a customer document.
 const out=azure.slice(0,MAX_DOCS);let hashProbes=0;
 for(const d of graph){
  const paired=azure.find(a=>a.sourceName.toLowerCase()===d.sourceName.toLowerCase()&&
    Number(a.size)>0&&Number(a.size)===Number(d.size)&&/^[a-f0-9]{64}$/.test(a.sha256));
  let duplicate=false;
  if(paired&&hashProbes<6&&Number(d.size)<=2*1024*1024&&referenceFolder&&typeof referenceFolder.readFile==='function'){
   hashProbes++;
   try{
    const file=await referenceFolder.readFile(d.refItemId,environment);
    const bytes=file&&file.buffer;
    if(bytes&&bytes.length===Number(d.size)){
     duplicate=crypto.createHash('sha256').update(bytes).digest('hex')===paired.sha256;
    }
   }catch(e){warn('graph-duplicate-verification:'+text(e&&e.code))}
  }
  if(!duplicate)out.push(d);
  if(out.length>=MAX_DOCS)break;
 }
 return out;
}
module.exports={parseName,toRecords,load,CATEGORY};
