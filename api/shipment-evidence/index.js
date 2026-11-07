'use strict';
// RC1903: eigenstaendige Versandnachweise ohne ExportHUB-Sendungsdatensatz.
const crypto=require('node:crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const auth=require('../shared/auth-store');
const rights=require('../shared/state-write-guard');
const {isolationConfig}=require('../shared/testservice-auth-isolation');
const MAX_FILE=15*1024*1024;
const TYPES={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
const FIELDS={shipmentNumber:100,customer:200,dispatchDate:10,colli:10,weightKg:16,packaging:400,shippingMethod:80,carrier:160,trackingNumber:160,exporthubRef:20,contents:3000,loadSecuring:1500,remarks:2000};
const STATES=new Set(['offen','in_pruefung','abgeschlossen']);
function fail(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;throw e}
function txt(x,max=2000){return String(x==null?'':x).trim().slice(0,max)}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function id(x){const v=txt(x,80);if(!/^DOK-\d{8}-[A-F0-9]{8}$/.test(v))fail('BAD_ID','Ungueltige Dokumentationsnummer.');return v}
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v}
function fields(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('FIELDS_MISSING','Bitte die Versanddaten eingeben.');
 const out={};
 for(const [key,max] of Object.entries(FIELDS)){const val=String(raw[key]==null?'':raw[key]).trim();if(val.length>max)fail('FIELD_TOO_LONG','Eingabefeld zu lang.',413);out[key]=val}
 if(!out.customer||!out.shipmentNumber)fail('REQUIRED_FIELDS','Kunde und Sendungsnummer sind Pflicht.');
 if(!validDate(out.dispatchDate))fail('BAD_DATE','Bitte ein gueltiges Versanddatum eingeben.');
 if(out.colli&&(!/^\d+$/.test(out.colli)||Number(out.colli)>100000))fail('BAD_COLLI','Colli muss eine ganze Zahl sein.');
 if(out.weightKg&&(!/^\d+(?:[,.]\d{1,3})?$/.test(out.weightKg)||Number(out.weightKg.replace(',','.'))>100000000))fail('BAD_WEIGHT','Gewicht ist ungueltig.');
 out.weightKg=out.weightKg.replace(',','.');
 if(out.exporthubRef&&!/^[A-Za-z0-9]{6}$/.test(out.exporthubRef))fail('BAD_LINK','ExportHUB-Referenz muss 6 Zeichen haben.');
 out.exporthubRef=out.exporthubRef.toUpperCase();
 return out;
}
function body(req){
 const raw=req&&req.body;
 if(raw&&typeof raw==='object'&&!Buffer.isBuffer(raw))return raw;
 if(Buffer.byteLength(String(raw||''),'utf8')>23*1024*1024)fail('TOO_LARGE','Datei zu gross.',413);
 try{return JSON.parse(String(raw||'{}'))}catch(_){fail('INVALID_JSON','Ungueltige Anfrage.')}
}
async function login(req,write){
 const verified=await auth.validateSession(req);
 const user=verified.user;
 if(!rights.canReadAny(user,['shipment','shipmentoverview','documents']))fail('FORBIDDEN','Keine Berechtigung fuer Versandnachweise.',403);
 if(write&&!rights.canEditAny(user,['shipment','documents']))fail('READ_ONLY','Kein Schreibrecht fuer Versandnachweise.',403);
 const env=auth.environmentFromRequest(req),storage=auth.loginStorageEnvironment(req);
 const sessionEnv=txt(verified.session&&verified.session.environment,32).toLowerCase();
 if((sessionEnv==='testservice'&&env!=='testservice')||(storage==='testservice'&&sessionEnv!=='testservice'))
   fail('ENVIRONMENT_MISMATCH','Sitzung gehoert zu einer anderen Umgebung.',403);
 const cfg=isolationConfig(),isolated=env==='testservice'&&cfg.enabled;
 const conn=isolated?cfg.connectionString:process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'';
 if(!conn)fail('STORAGE_UNAVAILABLE','Azure-Speicher nicht konfiguriert.',503);
 const container=isolated?cfg.container:auth.TEAM_CONTAINER;
 const prefix=env==='testservice'?'testservice/shipment-evidence/v1/':'shipment-evidence/v1/';
 return{container:BlobServiceClient.fromConnectionString(conn).getContainerClient(container),prefix,user:txt(auth.usernameOf(verified.user)||user&&user.name||'Mitarbeiter',120)};
}
function docBlob(ctx,docId){return ctx.container.getBlockBlobClient(ctx.prefix+'records/'+id(docId)+'.json')}
function fileBlob(ctx,docId,fileId){return ctx.container.getBlockBlobClient(ctx.prefix+'files/'+id(docId)+'/'+fileId)}
async function getRecord(ctx,docId){
 const blob=docBlob(ctx,docId);
 try{
  const result=await blob.download(0),chunks=[];
  for await(const chunk of result.readableStreamBody)chunks.push(Buffer.from(chunk));
  const record=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(record.id!==docId||!Number.isInteger(record.revision))fail('CORRUPT','Gespeicherter Datensatz ungueltig.',503);
  return{blob,record,etag:result.etag};
 }catch(e){if(e.statusCode===404)fail('NOT_FOUND','Versandnachweis nicht gefunden.',404);throw e}
}
async function saveRecord(blob,record,etag){
 const bytes=Buffer.from(JSON.stringify(record),'utf8');
 if(bytes.length>256*1024)fail('RECORD_TOO_LARGE','Maximale Dokumentationsgroesse erreicht.',413);
 try{
  const result=await blob.uploadData(bytes,{blobHTTPHeaders:{blobContentType:'application/json'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'}});
  if(!result||!result.etag)fail('WRITE_NOT_VERIFIED','Speichern konnte nicht bestaetigt werden.',503);
  const proof=await blob.download(0),chunks=[];
  for await(const chunk of proof.readableStreamBody)chunks.push(Buffer.from(chunk));
  if(!proof.etag||!Buffer.concat(chunks).equals(bytes))fail('WRITE_READBACK_MISMATCH','Speicherung konnte nicht verifiziert werden.',503);
 }catch(e){if(e.statusCode===409||e.statusCode===412)fail('CONFLICT','Datensatz zwischenzeitlich geaendert. Bitte neu laden.',409);throw e}
}
function bump(record,ctx,action,extra){
 const now=new Date().toISOString();
 record.history=Array.isArray(record.history)?record.history:[];
 if(record.history.length>=1000)fail('HISTORY_FULL','Aenderungshistorie voll.',413);
 record.revision++;record.updatedAt=now;record.updatedBy=ctx.user;
 record.history.push(Object.assign({at:now,by:ctx.user,action,revision:record.revision},extra||{}));
}
function rawFile(input,recordId){
 const name=txt(input.fileName,240).split(/[\\/]/).pop();
 const ext=(name.match(/\.([a-zA-Z0-9]+)$/)||[])[1]?.toLowerCase();
 const kind=input.kind;
 if(kind!=='foto'&&kind!=='lieferschein')fail('BAD_KIND','Dateityp nicht erlaubt.');
 if(!ext||!TYPES[ext]||(kind==='foto'&&!['jpg','jpeg','png'].includes(ext)))fail('BAD_EXTENSION','Erlaubt: PDF, JPG, PNG.');
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64||''))fail('BAD_FILE','Datei ungueltig.');
 const bytes=Buffer.from(String(input.base64||''),'base64');
 if(!bytes.length||bytes.length>MAX_FILE)fail('MAX_FILE','Maximal 15 MB je Datei.',413);
 const valid=(ext==='pdf'&&bytes.subarray(0,5).toString()==='%PDF-')||
 ((ext==='jpg'||ext==='jpeg')&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||
 (ext==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 if(!valid)fail('FILE_SIGNATURE','Dateiinhalt stimmt nicht mit dem Format ueberein.');
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15);
 const base=name.slice(0,-(ext.length+1)).replace(/[^\p{L}\p{N}._ -]/gu,'_').slice(0,80)||'Datei';
 const fileId=crypto.randomUUID();
 const storedName=(kind==='foto'?'Versandfoto_':'Lieferschein_')+recordId+'_'+stamp+'_'+base+'_'+fileId.slice(0,8)+'.'+ext;
 return{bytes,fileId,storedName,mime:TYPES[ext],kind};
}
async function upload(ctx,record,blob,etag,input){
 if(!record.fields)fail('SAVE_FIRST','Bitte zuerst einen Versandnachweis speichern.');
 if(record.files.length>=100)fail('FILE_LIMIT','Maximal 100 Dateien pro Dokumentation.',413);
 const f=rawFile(input,record.id),target=fileBlob(ctx,record.id,f.fileId);
 await target.uploadData(f.bytes,{blobHTTPHeaders:{blobContentType:f.mime},conditions:{ifNoneMatch:'*'}});
 try{
  const res=await target.download(0),parts=[];
  for await(const part of res.readableStreamBody)parts.push(Buffer.from(part));
  if(!Buffer.concat(parts).equals(f.bytes))fail('FILE_READBACK','Foto/Lieferschein konnte nach Speichern nicht bestaetigt werden.',503);
  record.files.push({id:f.fileId,name:f.storedName,kind:f.kind,mime:f.mime,size:f.bytes.length,uploadedAt:new Date().toISOString(),uploadedBy:ctx.user});
  bump(record,ctx,'file-upload',{fileId:f.fileId,kind:f.kind});
  await saveRecord(blob,record,etag);
 }catch(e){try{await target.deleteIfExists()}catch(_){}throw e}
}
async function list(ctx,query){
 const continuationToken=txt(query.continuation,1200)||undefined;
 const pager=ctx.container.listBlobsFlat({prefix:ctx.prefix+'records/'}).byPage({continuationToken,maxPageSize:50});
 const page=(await pager.next()).value||{};
 const names=(page.segment&&page.segment.blobItems||[]).map(x=>x.name).filter(x=>/^.*\/records\/DOK-\d{8}-[A-F0-9]{8}\.json$/.test(x));
 const records=await Promise.all(names.map(async name=>{
  try{const rec=await getRecord(ctx,name.split('/').pop().slice(0,-5));return{...rec.record,history:[]}}catch(e){if(e.code==='NOT_FOUND')return null;throw e}
 }));
 return json(200,{ok:true,records:records.filter(Boolean).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),continuation:page.continuationToken||null});
}
async function process(req){
 const method=req.method,query=req.query||{},payload=method==='POST'?body(req):query;
 const action=txt(payload.action,32)||(method==='GET'?'list':'');
 const ctx=await login(req,method==='POST');
 if(method==='GET'&&action==='list')return list(ctx,payload);
 if(method==='POST'&&action==='create'){
  const normalized=fields(payload.fields),now=new Date().toISOString();
  const newId='DOK-'+now.slice(0,10).replace(/-/g,'')+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();
  const record={id:newId,revision:0,fields:normalized,files:[],complaints:[],history:[],createdAt:now,updatedAt:now,updatedBy:ctx.user};
  bump(record,ctx,'create');await saveRecord(docBlob(ctx,newId),record,null);return json(201,{ok:true,record});
 }
 const docId=id(payload.id);
 const{blob,record,etag}=await getRecord(ctx,docId);
 if(method==='GET'&&action==='get')return json(200,{ok:true,record});
 if(method==='GET'&&action==='file'){
  const entry=record.files.find(x=>x.id===payload.fileId);
  if(!entry)fail('FILE_NOT_FOUND','Datei nicht gefunden.',404);
  const source=await fileBlob(ctx,docId,entry.id).download(0),chunks=[];
  for await(const p of source.readableStreamBody)chunks.push(Buffer.from(p));
  const bytes=Buffer.concat(chunks);
  if(bytes.length!==entry.size)fail('FILE_SIZE_MISMATCH','Datei ist nicht vollstaendig.',503);
  return{status:200,headers:{'Content-Type':entry.mime,'Content-Length':String(bytes.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':'sandbox','Content-Disposition':'attachment; filename="'+entry.name.replace(/[^A-Za-z0-9._-]/g,'_')+'"'},body:bytes};
 }
 if(method!=='POST')fail('INVALID_ACTION','Unbekannte Anfrage.');
 if(!Number.isInteger(payload.expectedRevision)||payload.expectedRevision!==record.revision)fail('CONFLICT','Datensatz wurde geaendert. Bitte neu laden.',409);
 if(action==='save'){
  const before=record.fields;record.fields=fields(payload.fields);
  bump(record,ctx,'save',{before});
  await saveRecord(blob,record,etag);
 }else if(action==='complaint'){
  const comment=txt(payload.text,2001);
  if(!comment||comment.length>2000)fail('BAD_COMPLAINT','Bitte eine gueltige Kundenbeschwerde eingeben.');
  if(record.complaints.length>=200)fail('COMPLAINT_LIMIT','Zu viele Kundenbeschwerden.',413);
  const reportedDate=txt(payload.reportedDate,10)||new Date().toISOString().slice(0,10);
  if(!validDate(reportedDate))fail('BAD_DATE','Beschwerdedatum ungueltig.');
  record.complaints.push({id:crypto.randomUUID(),text:comment,reportedDate,state:'offen',createdAt:new Date().toISOString(),createdBy:ctx.user});
  bump(record,ctx,'complaint');await saveRecord(blob,record,etag);
 }else if(action==='complaint-status'){
  const complaint=record.complaints.find(x=>x.id===payload.complaintId);
  if(!complaint||!STATES.has(payload.state))fail('BAD_STATUS','Beschwerde oder Status ungueltig.');
  const from=complaint.state;complaint.state=payload.state;
  complaint.changedAt=new Date().toISOString();complaint.changedBy=ctx.user;
  bump(record,ctx,'complaint-status',{complaintId:complaint.id,from,to:complaint.state});await saveRecord(blob,record,etag);
 }else if(action==='upload')await upload(ctx,record,blob,etag,payload);
 else fail('INVALID_ACTION','Unbekannte Aktion.');
 return json(200,{ok:true,record});
}
module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'GET, POST, OPTIONS','Cache-Control':'no-store'}};return}
  if(!['GET','POST'].includes(req.method))fail('METHOD_NOT_ALLOWED','Methode nicht erlaubt.',405);
  context.res=await process(req);
 }catch(e){context.res=json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.status?e.message:'Versanddokumentation konnte nicht verarbeitet werden.'})}
};
module.exports.fields=fields;
module.exports.id=id;
module.exports.rawFile=rawFile;
