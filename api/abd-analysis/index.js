'use strict';
const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const auth=require('../shared/fast-auth-store');
const apiI18n=require('../shared/i18n');
const pdfSecurity=require('../shared/customer-avis-pdf-security');
const pdfContent=require('../shared/customer-avis-document-content');
const analyzer=require('../shared/abd-analysis');
const d365=require('../shared/abd-d365-import');
const analysisModel=require('../shared/abd-analysis-model');
const documentIntelligence=require('../shared/abd-document-intelligence');

const CONTAINER=process.env.EXPORTHUB_ABD_QUARANTINE_CONTAINER||'exporthub-abd-quarantine';
const MAX_BYTES=Math.max(1024,Math.min(20*1024*1024,Number(process.env.EXPORTHUB_ABD_ANALYSIS_MAX_BYTES||12*1024*1024)));
const MAX_AGE_MS=2*60*60*1000;
let containerPromise=null;

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function response(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function allowed(user){
 if(auth.isAdmin&&auth.isAdmin(user))return true;
 const r=user&&user.rights&&user.rights.abd||{},level=lower(r.level||r.access);
 return !!(r.edit===true||r.admin===true||r.functionAdmin===true||level==='edit'||level==='admin')
}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
async function quarantine(){
 if(containerPromise)return containerPromise;
 const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED',apiI18n.tLang('de','api.common.storageNotConfigured'),503);
 const container=BlobServiceClient.fromConnectionString(cs).getContainerClient(CONTAINER);
 containerPromise=Promise.resolve().then(async()=>{if(typeof container.createIfNotExists==='function')await container.createIfNotExists();return container}).catch(e=>{containerPromise=null;throw e});
 return containerPromise
}
function safeName(value){
 let name=text(value).replace(/[\\/:*?"<>|\x00-\x1f\x7f]+/g,'_').replace(/\s+/g,' ').trim();
 if(!name)name='ABD-Datei';
 if(name.length>180)name=name.slice(0,180);
 return name
}
function kindFromName(name){
 const m=safeName(name).toLowerCase().match(/\.(pdf|xlsx|csv|txt|tsv|jpg|jpeg|png)$/);if(!m)return'';
 return m[1]==='jpeg'?'jpg':m[1]
}
function jpegSignature(buffer){return buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff}
function pngSignature(buffer){return buffer.length>=8&&buffer[0]===0x89&&buffer[1]===0x50&&buffer[2]===0x4e&&buffer[3]===0x47&&buffer[4]===0x0d&&buffer[5]===0x0a&&buffer[6]===0x1a&&buffer[7]===0x0a}
function genericFile(file,req){
 if(!file||typeof file!=='object'||Array.isArray(file))throw error('ABD_FILE_REQUIRED',apiI18n.t(req,'api.abdAnalysis.fileRequired'),400);
 const name=safeName(file.name||file.fileName||file.filename),kind=kindFromName(name);
 if(!kind)throw error('ABD_FILE_TYPE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileType'),400);
 if(kind==='pdf'){
  const validated=pdfSecurity.validatePdfUpload(file);
  return{name:validated.name,kind,buffer:validated.buffer,size:validated.size,sha256:validated.sha256,mimeType:'application/pdf'}
 }
 const raw=String(file.base64||'').replace(/\s+/g,'');
 if(raw.length>Math.ceil(MAX_BYTES/3)*4+4)throw error('ABD_FILE_TOO_LARGE',apiI18n.t(req,'api.abdAnalysis.fileTooLarge',{max:Math.floor(MAX_BYTES/1048576)}),413);
 const buffer=pdfSecurity.strictBase64(raw);
 if(!buffer)throw error('ABD_FILE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileInvalid'),400);
 if(buffer.length>MAX_BYTES)throw error('ABD_FILE_TOO_LARGE',apiI18n.t(req,'api.abdAnalysis.fileTooLarge',{max:Math.floor(MAX_BYTES/1048576)}),413);
 const claimed=lower(file.type||file.mimeType||file.contentType);let mimeType='';
 if(kind==='xlsx'){
  const allowedMime=['','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'];
  if(!allowedMime.includes(claimed)||buffer.length<4||buffer[0]!==0x50||buffer[1]!==0x4b)throw error('ABD_FILE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileInvalid'),400);
  mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 }else if(kind==='jpg'){
  const allowedMime=['','image/jpeg','image/jpg','application/octet-stream'];
  if(!allowedMime.includes(claimed)||!jpegSignature(buffer))throw error('ABD_FILE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileInvalid'),400);
  mimeType='image/jpeg'
 }else if(kind==='png'){
  const allowedMime=['','image/png','application/octet-stream'];
  if(!allowedMime.includes(claimed)||!pngSignature(buffer))throw error('ABD_FILE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileInvalid'),400);
  mimeType='image/png'
 }else{
  const allowedMime=['','text/csv','text/plain','text/tab-separated-values','application/csv','application/vnd.ms-excel','application/octet-stream'];
  if(!allowedMime.includes(claimed)||buffer.includes(0))throw error('ABD_FILE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileInvalid'),400);
  mimeType=kind==='txt'?'text/plain':kind==='tsv'?'text/tab-separated-values':'text/csv'
 }
 const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
 return{name,kind,buffer,size:buffer.length,sha256,mimeType}
}
function identity(current){return text(current&&current.user&&(current.user.id||current.user.userId||current.user.username||current.user.user||current.user.name))||'user'}
function scope(environment,current){return pdfSecurity.scopeHash('abd-analysis|'+environment+'|'+identity(current))}
function uploadId(hash,kind,nonce){return hash+':'+kind+(nonce?':'+nonce:'')}
function parseUploadId(value){const m=text(value).toLowerCase().match(/^([a-f0-9]{64}):(pdf|xlsx|csv|txt|tsv|jpg|png)(?::([a-f0-9]{32}))?$/);return m?{sha256:m[1],kind:m[2],nonce:m[3]||''}:null}
function blobName(environment,current,id){return'rc1294/'+environment+'/'+scope(environment,current)+'/'+id.sha256+(id.nonce?'-'+id.nonce:'')+'.'+id.kind}
async function readBuffer(blob){
 const r=await blob.download(0),chunks=[];let total=0;
 for await(const part of r.readableStreamBody){
  const chunk=Buffer.from(part);total+=chunk.length;
  // Defender tags describe uploaded content, not arbitrarily replaced blob data.
  // Fail closed before an oversized or replaced blob can reach a parser.
  if(total>MAX_BYTES)throw error('ABD_SCAN_CONTENT_MISMATCH','Geprüfter Dateiinhalt nicht mehr unverändert. Bitte erneut hochladen.',409);
  chunks.push(chunk);
 }
 return Buffer.concat(chunks,total)
}
function cellText(cell){
 if(cell==null)return'';
 if(typeof cell==='string'||typeof cell==='number'||typeof cell==='boolean')return String(cell);
 if(cell.text!=null)return String(cell.text);
 if(cell.result!=null)return String(cell.result);
 if(cell.richText)return cell.richText.map(x=>text(x&&x.text)).join('');
 return text(cell)
}
function groupedEnvelope(result,header){
 const source=result&&typeof result==='object'?result:{};
 let positions=Array.isArray(source.positions)?source.positions:[];
 if(source.extraction==='pdf-text-candidates'||source.extraction==='azure-document-intelligence')positions=positions.map(position=>Object.assign({},position,{confirmed:false}));
 return analysisModel.enrichLegacyAnalysis(Object.assign({},source,{positions}),header||{})
}
async function analyzeXlsx(buffer,name){
 let ExcelJS;try{ExcelJS=require('exceljs')}catch(_){throw error('ABD_XLSX_RUNTIME_MISSING','Excel-Auswertung ist auf dem Server nicht verfügbar.',503)}
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
 const objects=[],sheets=[],d365Documents=[],d365Positions=[];
 const nonemptySheets=workbook.worksheets.filter(ws=>ws.actualRowCount>0);
 if(nonemptySheets.length>12)throw error('ABD_XLSX_SHEET_LIMIT','Excel-Datei enthält mehr als 12 Tabellenblätter mit Daten. Bitte die Datei aufteilen.',422);
 nonemptySheets.forEach(ws=>{
  // Never silently discard spreadsheet rows and create a partial invoice.
  if(ws.actualRowCount>1000)throw error('ABD_XLSX_ROW_LIMIT','Excel-Datei enthält mehr als 1.000 Datenzeilen in einem Blatt. Bitte die Datei aufteilen.',422);
  const matrix=[];ws.eachRow({includeEmpty:false},(row,rowNumber)=>{if(matrix.length>=1000)return;const values=[];for(let i=1;i<=Math.min(row.cellCount||row.actualCellCount||80,80);i++)values.push(cellText(row.getCell(i).value));matrix.push(values)});
  const document=d365.d365Invoice(matrix,name+' · '+ws.name,analyzer,analysisModel);
  if(document){d365Documents.push(...document.deliveryDocuments);d365Positions.push(...document.positions);sheets.push(ws.name);return}
  const parsed=analyzer.matrixToObjects(matrix,name+' · '+ws.name,501);if(parsed.length){objects.push(...parsed);sheets.push(ws.name)}
 });
 // The shared analyzer accepts at most 500 positions. Never silently truncate
 // across worksheets or discard non-D365 sheets in a mixed workbook.
 if(d365Positions.length&&objects.length)throw error('ABD_XLSX_MIXED_FORMAT','Excel-Datei enthält D365- und andere Positionsformate. Bitte die Tabellenblätter getrennt hochladen.',422);
 if(d365Positions.length>500||objects.length>500)throw error('ABD_XLSX_POSITION_LIMIT','Excel-Datei enthält insgesamt mehr als 500 Warenpositionen. Bitte nach Lieferscheinen aufteilen.',422);
 if(d365Documents.length){const combined=groupedEnvelope(Object.assign(analyzer.analyzeObjects(d365Positions),{fileName:name,fileType:'d365',sheets,requiresReview:true}));combined.deliveryDocuments=d365Documents;combined.deliveryCount=d365Documents.length;return combined}
 return groupedEnvelope(Object.assign(analyzer.analyzeObjects(objects),{fileName:name,fileType:'xlsx',sheets,requiresReview:true}))
}
function analyzeCsv(buffer,name){
 const matrix=d365.delimitedRows(buffer.toString('utf8'));
 const d365Result=d365.d365Invoice(matrix,name,analyzer,analysisModel);
 if(d365Result)return d365Result;
 const objects=analyzer.matrixToObjects(matrix,name,501);
 if(objects.length>500)throw error('ABD_TABULAR_POSITION_LIMIT','Tabellendatei enthält mehr als 500 Warenpositionen. Bitte die Datei aufteilen.',422);
 return groupedEnvelope(Object.assign(analyzer.analyzeObjects(objects),{fileName:name,fileType:kindFromName(name),requiresReview:true}))
}
async function analyzeWithOcr(buffer,name,kind){
 const ocr=await documentIntelligence.analyzeInvoiceBuffer(buffer,{name,mimeType:kind==='pdf'?'application/pdf':kind==='png'?'image/png':'image/jpeg'});
 let legacy=analyzer.extractPdfCandidates(ocr.content,name);
 if(!legacy.positions.length&&Array.isArray(ocr.items)&&ocr.items.length){
  const objects=ocr.items.map((item,index)=>Object.assign({_source:name,_row:index+1},item));
  legacy=analyzer.analyzeObjects(objects)
 }
 legacy.positions=(legacy.positions||[]).map(position=>Object.assign({},position,{confirmed:false,warnings:Array.from(new Set([].concat(position.warnings||[],'ocr-review-required')))}));
 return groupedEnvelope(Object.assign({},legacy,{fileName:name,fileType:kind,requiresReview:true,extraction:'azure-document-intelligence',ocr:{provider:'Azure Document Intelligence',modelId:ocr.modelId,apiVersion:ocr.apiVersion}}),ocr.header)
}
async function analyzePdf(buffer,name){
 let extracted='';try{extracted=await pdfContent.extractPdfText(buffer)}catch(_){}
 if(text(extracted).length<40)return analyzeWithOcr(buffer,name,'pdf');
 return groupedEnvelope(Object.assign(analyzer.extractPdfCandidates(extracted,name),{fileName:name,fileType:'pdf'}))
}
async function analyzeFile(buffer,name,kind){
 if(kind==='pdf')return analyzePdf(buffer,name);
 if(kind==='jpg'||kind==='png')return analyzeWithOcr(buffer,name,kind);
 if(kind==='xlsx')return analyzeXlsx(buffer,name);
 return analyzeCsv(buffer,name)
}
async function upload(req,current,environment,payload){
 const file=genericFile(payload.file,req),container=await quarantine(),id={sha256:file.sha256,kind:file.kind,nonce:crypto.randomBytes(16).toString('hex')},blob=container.getBlockBlobClient(blobName(environment,current,id));
 try{
  await blob.uploadData(file.buffer,{blobHTTPHeaders:{blobContentType:file.mimeType,blobCacheControl:'no-store'},metadata:{name:Buffer.from(file.name,'utf8').toString('base64url').slice(0,512),kind:file.kind,owner:scope(environment,current),uploadedAt:Date.now().toString()},conditions:{ifNoneMatch:'*'}})
 }catch(e){
  if([409,412].includes(Number(e&& (e.statusCode||e.status))))throw error('ABD_UPLOAD_CONFLICT','Die Datei konnte nicht eindeutig für eine neue Virenprüfung gespeichert werden. Bitte erneut hochladen.',409);
  throw e
 }
 return{ok:true,status:'scanning',upload:{id:uploadId(file.sha256,file.kind,id.nonce),name:file.name,size:file.size,fileType:file.kind,provider:'Microsoft Defender for Storage'}}
}
function reanalyze(req,payload){
 const positions=Array.isArray(payload&&payload.positions)?payload.positions:null;
 if(!positions||positions.length>500)throw error('ABD_REANALYZE_INVALID',apiI18n.t(req,'api.abdAnalysis.failed'),400);
 return{ok:true,status:'ready',analysis:analysisModel.rebuildReviewedAnalysis({header:payload&&payload.header,positions})}
}
async function status(req,current,environment,payload){
 const id=parseUploadId(payload.uploadId);if(!id)throw error('ABD_UPLOAD_ID_INVALID',apiI18n.t(req,'api.abdAnalysis.uploadInvalid'),400);
 const container=await quarantine(),blob=container.getBlockBlobClient(blobName(environment,current,id));
 let props;try{props=await blob.getProperties()}catch(e){if(Number(e&&e.statusCode||e&&e.status)===404)throw error('ABD_UPLOAD_EXPIRED',apiI18n.t(req,'api.abdAnalysis.uploadExpired'),410);throw e}
 const created=props&&props.createdOn?new Date(props.createdOn).getTime():Number(props&&props.metadata&&props.metadata.uploadedAt||0);
 if(created&&Date.now()-created>MAX_AGE_MS){await blob.deleteIfExists();throw error('ABD_UPLOAD_EXPIRED',apiI18n.t(req,'api.abdAnalysis.uploadExpired'),410)}
 const tagResult=await blob.getTags(),scan=pdfSecurity.scanResultFromTags(tagResult&&tagResult.tags||{});
 if(scan.status==='pending'){
  // RC1793: a delayed/missing Defender result must never be interpreted as clean.
  // Surface a non-sensitive diagnostic so staff can distinguish a stalled scan
  // from a failed upload, without deleting or releasing the quarantine blob.
  const ageSeconds=created?Math.max(0,Math.floor((Date.now()-created)/1000)):0;
  return{httpStatus:202,body:{ok:true,status:'scanning',provider:'Microsoft Defender for Storage',scanResult:scan.result||'',...(ageSeconds>=120?{diagnosticCode:'ABD_DEFENDER_RESULT_DELAYED',scanAgeSeconds:ageSeconds}:{})}}
 }
 if(scan.status!=='clean'){
  await blob.deleteIfExists();
  const malicious=scan.status==='malicious';
  return{httpStatus:200,body:{ok:false,status:'blocked',code:malicious?'ABD_MALWARE_DETECTED':'ABD_SCAN_FAILED',message:apiI18n.t(req,malicious?'api.abdAnalysis.malware':'api.abdAnalysis.scanFailed'),provider:'Microsoft Defender for Storage',scanResult:scan.result||''}}
 }
 const encoded=text(props&&props.metadata&&props.metadata.name);let name='ABD-Datei.'+id.kind;
 try{if(encoded)name=safeName(Buffer.from(encoded,'base64url').toString('utf8'))}catch(_){}
 let analysis;
 try{
  const scannedBytes=await readBuffer(blob);
  const actualSha256=crypto.createHash('sha256').update(scannedBytes).digest('hex');
  if(actualSha256!==id.sha256)throw error('ABD_SCAN_CONTENT_MISMATCH','Geprüfter Dateiinhalt nicht mehr unverändert. Bitte erneut hochladen.',409);
  analysis=await analyzeFile(scannedBytes,name,id.kind);
 }
 catch(e){throw error(e&&e.code||'ABD_ANALYSIS_FAILED',e&&e.message||apiI18n.t(req,'api.abdAnalysis.failed'),e&&e.status||422)}
 finally{await blob.deleteIfExists().catch(()=>{})}
 return{httpStatus:200,body:{ok:true,status:'ready',provider:'Microsoft Defender for Storage',scanResult:scan.result||'',analysis}}
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.postOnly')});return}
 try{
  const current=await auth.validateSession(req,{requireExportHubToken:true});if(!allowed(current.user))throw error('ABD_ANALYSIS_FORBIDDEN',apiI18n.t(req,'api.abdAnalysis.forbidden'),403);
  const payload=auth.body(req),environment=auth.environmentFromRequest(req),action=lower(payload.action);
  if(action==='upload')context.res=response(202,await upload(req,current,environment,payload));
  else if(action==='status'){const result=await status(req,current,environment,payload);context.res=response(result.httpStatus,result.body)}
  else if(action==='reanalyze')context.res=response(200,reanalyze(req,payload));
  else throw error('ABD_ACTION_INVALID',apiI18n.t(req,'api.abdAnalysis.actionInvalid'),400)
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1294 ABD analysis',e&&e.code,e&&e.message)}catch(_){}
  context.res=response(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'ABD_ANALYSIS_FAILED',message:e&&e.message||apiI18n.t(req,'api.abdAnalysis.failed')})
 }
};