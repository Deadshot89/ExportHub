'use strict';
// RC1349 – ausschließlich private, sendungs- und umgebungsgebundene Azure-Metadaten.
const {BlobServiceClient}=require('@azure/storage-blob');
const parser=require('./delivery-avis-items');
const content=require('./customer-avis-document-content');
const docs=require('./ref-doc-blob-store');
const pdfSecurity=require('./customer-avis-pdf-security');
const MAX_DOCUMENTS=40;
function t(v){return String(v==null?'':v).trim()}
function env(v){return t(v).toLowerCase()==='testservice'?'testservice':'production'}
function ref(v){const s=t(v).toUpperCase();if(!/^[A-Z0-9]{6}$/.test(s))throw problem('INVALID_REFERENCE','Ungültige Sendungsreferenz.',400);return s}
function problem(code,message,status){const e=new Error(message);e.code=code;e.status=status||409;return e}
function client(r,e){
 const connection=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage;
 if(!connection)throw problem('STORAGE_NOT_CONFIGURED','Azure-Dokumentenspeicher fehlt.',503);
 const c=BlobServiceClient.fromConnectionString(connection).getContainerClient(process.env.EXPORTHUB_DOCUMENT_CONTAINER||'exporthub-documents');
 return {c,blob:c.getBlockBlobClient('delivery-avis-items/v1/'+env(e)+'/'+ref(r)+'.json')};
}
async function load(r,e){
 const {blob}=client(r,e);
 try{
  const response=await blob.download(0),parts=[];
  for await(const chunk of response.readableStreamBody)parts.push(Buffer.from(chunk));
  const data=Buffer.concat(parts);
  if(data.length>1024*1024)throw problem('DELIVERY_ITEMS_TOO_LARGE','Artikelübersicht überschreitet die Größenbegrenzung.',413);
  const parsed=JSON.parse(data.toString('utf8'));
  return {state:{documents:Array.isArray(parsed.documents)?parsed.documents:[]},etag:response.etag||null};
 }catch(err){
  if(Number(err&&err.statusCode)===404)return {state:{documents:[]},etag:null};
  throw err;
 }
}
async function mutate(r,e,callback){
 const {c,blob}=client(r,e);
 await c.createIfNotExists();
 for(let attempt=0;attempt<6;attempt++){
  const current=await load(r,e),state=current.state;
  const value=await callback(state);
  if(value===false)return state;
  const bytes=Buffer.from(JSON.stringify(state));
  if(bytes.length>1024*1024)throw problem('DELIVERY_ITEMS_TOO_LARGE','Zu viele Artikelpositionen.',413);
  try{
   await blob.uploadData(bytes,{conditions:current.etag?{ifMatch:current.etag}:{ifNoneMatch:'*'},
    blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8',blobCacheControl:'private, no-store'}});
   return state;
  }catch(err){if(![409,412].includes(Number(err&&err.statusCode||err&&err.status))||attempt===5)throw err;}
 }
 throw problem('DELIVERY_ITEMS_CONFLICT','Artikelübersicht konnte nicht gespeichert werden.',409);
}
function originalName(filename){
 const m=t(filename).match(/^Lieferschein_[A-Z0-9]{6}_[0-9]{8}-[0-9]{6}_(.+)\.pdf$/i);
 return m?m[1].toLowerCase()+'.pdf':'';
}
function isCandidate(file,r){
 return /^refdoc:[a-f0-9]{32}$/.test(t(file&&file.id))&&
  new RegExp('^Lieferschein_'+ref(r)+'_[0-9]{8}-[0-9]{6}_.+\\.pdf$','i').test(t(file.name))&&
  Number(file.size||0)>0&&Number(file.size)<=15*1024*1024;
}
function timestamp(file){
 const raw=t(file&&file.createdDateTime)||t(file&&file.lastModifiedDateTime);
 const parsed=Date.parse(raw);
 // For an upload response no server creation date is available yet.
 return Number.isFinite(parsed)?new Date(parsed).toISOString():new Date().toISOString();
}
async function register(r,e,file,sha){
 if(!file||!isCandidate(file,r)||!(/^[a-f0-9]{64}$/.test(t(sha))))return;
 return mutate(r,e,state=>{
  if(state.documents.some(d=>d.sha256===sha&&d.current===true))return false; // echte identische Kopie
  const same=originalName(file.name),when=timestamp(file);
  // A delayed discovery of an older copy must never re-activate an outdated delivery note.
  if(state.documents.some(d=>d.current===true&&d.originalName===same&&Date.parse(d.createdAt||'')>Date.parse(when)))return false;
  state.documents.forEach(d=>{if(d.current===true&&d.originalName===same){d.current=false;d.status='superseded'}});
  if(state.documents.length>=MAX_DOCUMENTS)throw problem('DELIVERY_ITEMS_DOCUMENT_LIMIT','Zu viele Lieferscheine für eine automatische Prüfung.',409);
  state.documents.push({id:file.id,name:file.name,originalName:same,sha256:sha,
   current:true,status:'scan_pending',scanStatus:'pending',rows:[],createdAt:when});
 });
}
// Bei Ersatz eines PDF-Lieferscheins alte Freigaben sofort zurückziehen,
// auch wenn nur SharePoint erreichbar und die neue Azure-Kopie ausgefallen ist.
async function invalidateByName(r,e,fileName){
 const same=originalName(fileName);
 if(!same)return;
 await mutate(r,e,state=>{
  let changed=false;
  state.documents.forEach(doc=>{if(doc.current===true&&doc.originalName===same){
   doc.current=false;doc.status='superseded';changed=true;
  }});
  return changed;
 });
}
async function discover(r,e){
 const files=(await docs.list(r,e)).filter(file=>isCandidate(file,r))
  .sort((a,b)=>Date.parse(b.createdDateTime||'')-Date.parse(a.createdDateTime||''))
  .slice(0,MAX_DOCUMENTS);
 let current=(await load(r,e)).state.documents;
 const candidates=files.filter(file=>{
  if(current.some(d=>d.id===file.id))return false;
  const date=Date.parse(file.createdDateTime||file.lastModifiedDateTime||'');
  // Unknown timestamps cannot safely supersede an existing current approval.
  if(current.some(d=>d.current===true&&d.originalName===originalName(file.name)&&
       (!Number.isFinite(date)||Date.parse(d.createdAt||'')>date)))return false;
  return true;
 }).slice(0,2);
 for(const file of candidates){
  // Vor der fachlichen Erkennung nur neue Dokument-ID vormerken, noch keinen Parser ausführen.
  const result=await docs.read(r,e,file.id);
  const sha=parser.fingerprint(result.buffer);
  await register(r,e,file,sha);
  current=(await load(r,e)).state.documents;
 }
 return current;
}
async function scanStatus(r,e,id){
 return docs.scanResult(r,e,id);
}
async function processPending(r,e){
 const current=await discover(r,e);
 // Pro Aufruf maximal zwei PDFs auswerten; kein parser-Lauf bei fehlender AV-Freigabe.
 for(const d of current.filter(x=>x.current===true&&['scan_pending','blocked'].includes(x.status)).slice(0,2)){
  let scan;try{scan=await scanStatus(r,e,d.id)}catch(_){scan={status:'pending'}}
  if(scan.status!=='clean'){
   if(scan.status==='pending')continue;
   await mutate(r,e,state=>{const existing=state.documents.find(x=>x.id===d.id&&x.sha256===d.sha256&&x.current);
    if(!existing)return false;if(existing.scanStatus===scan.status&&existing.status==='blocked')return false;
    existing.scanStatus=scan.status;existing.status='blocked';existing.rows=[];});
   continue;
  }
  const file=await docs.read(r,e,d.id);
  if(parser.fingerprint(file.buffer)!==d.sha256){
   await mutate(r,e,state=>{const existing=state.documents.find(x=>x.id===d.id&&x.current);if(!existing)return false;
    existing.status='hash_mismatch';existing.rows=[];existing.current=false;});
   continue;
  }
  let result;
  try{result=parser.parseDeliveryText(await content.extractPdfText(file.buffer))}
  catch(_){result={status:'manual_review_required',rows:[],issues:['PDF-Text konnte nicht gelesen werden.']}}
  await mutate(r,e,state=>{
   const existing=state.documents.find(x=>x.id===d.id&&x.sha256===d.sha256&&x.current&&x.status!=='approved');
   if(!existing)return false;
   existing.scanStatus='clean';existing.status=result.status;existing.rows=result.rows;
   existing.issues=(result.issues||[]).slice(0,10);existing.checkedAt=new Date().toISOString();
  });
 }
 const result=await load(r,e);
 return result.state.documents.map(d=>({id:d.id,name:d.name,status:d.status,scanStatus:d.scanStatus,
  current:d.current,sha256:d.sha256,rows:d.rows||[],issues:d.issues||[],reviewedBy:d.reviewedBy||''}));
}
async function approve(r,e,id,hash,rows,reviewer){
 if(!/^refdoc:[a-f0-9]{32}$/.test(t(id))||!/^[a-f0-9]{64}$/.test(t(hash)))
  throw problem('DELIVERY_ITEMS_SOURCE_INVALID','Ungültiger Lieferscheinbeleg.',400);
 const reviewed=parser.safeReviewRows(rows);
 const scan=await scanStatus(r,e,id);
 if(scan.status!=='clean')throw problem('DELIVERY_ITEMS_SCAN_REQUIRED','Der Lieferschein wurde nicht als schadsoftwarefrei geprüft.',409);
 const original=await docs.read(r,e,id);
 if(parser.fingerprint(original.buffer)!==hash)throw problem('DELIVERY_ITEMS_HASH_CHANGED','Lieferscheininhalt hat sich geändert.',409);
 await mutate(r,e,state=>{
  const target=state.documents.find(d=>d.id===id&&d.sha256===hash&&d.current===true);
  if(!target||!['review_required','manual_review_required','approved'].includes(target.status))
   throw problem('DELIVERY_ITEMS_NOT_REVIEWABLE','Lieferschein ist nicht für die Freigabe verfügbar.',409);
  const approvedAt=new Date().toISOString(),actor=t(reviewer).slice(0,120);
  const prior=Array.isArray(target.reviewHistory)?target.reviewHistory:[];
  // Bounded append-only approval ledger, without duplicating customer line data.
  target.reviewHistory=prior.slice(-19).concat([{event:target.status==='approved'?'reapproved':'approved',
   at:approvedAt,actor,rowCount:reviewed.length,rowsSha256:parser.fingerprint(Buffer.from(JSON.stringify(reviewed))),sourceSha256:hash}]);
  target.rows=reviewed;target.scanStatus='clean';target.status='approved';
  target.reviewedBy=actor;target.reviewedAt=approvedAt;
 });
}
async function publicRows(r,e){
 try{return parser.verifiedPublicRows((await load(r,e)).state.documents)}
 catch(_){return []} // Keine öffentlichen Fehlermeldungen über interne Metadaten.
}
module.exports={register,invalidateByName,discover,processPending,approve,publicRows,originalName,isCandidate,load};
