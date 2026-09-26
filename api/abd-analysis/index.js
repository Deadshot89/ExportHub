'use strict';
const crypto=require('crypto');
const {BlobServiceClient}=require('@azure/storage-blob');
const auth=require('../shared/fast-auth-store');
const apiI18n=require('../shared/i18n');
const pdfSecurity=require('../shared/customer-avis-pdf-security');
const pdfContent=require('../shared/customer-avis-document-content');
const analyzer=require('../shared/abd-analysis');

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
function kindFromName(name){const m=safeName(name).toLowerCase().match(/\.(pdf|xlsx|csv)$/);return m?m[1]:''}
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
 const claimed=lower(file.type||file.mimeType||file.contentType);
 if(kind==='xlsx'){
  const allowedMime=['','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'];
  if(!allowedMime.includes(claimed)||buffer.length<4||buffer[0]!==0x50||buffer[1]!==0x4b)throw error('ABD_FILE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileInvalid'),400)
 }else{
  const allowedMime=['','text/csv','text/plain','application/csv','application/vnd.ms-excel'];
  if(!allowedMime.includes(claimed)||buffer.includes(0))throw error('ABD_FILE_INVALID',apiI18n.t(req,'api.abdAnalysis.fileInvalid'),400)
 }
 const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
 return{name,kind,buffer,size:buffer.length,sha256,mimeType:kind==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv'}
}
function identity(current){return text(current&&current.user&&(current.user.id||current.user.userId||current.user.username||current.user.user||current.user.name))||'user'}
function scope(environment,current){return pdfSecurity.scopeHash('abd-analysis|'+environment+'|'+identity(current))}
function uploadId(hash,kind){return hash+':'+kind}
function parseUploadId(value){const m=text(value).toLowerCase().match(/^([a-f0-9]{64}):(pdf|xlsx|csv)$/);return m?{sha256:m[1],kind:m[2]}:null}
function blobName(environment,current,id){return'rc1294/'+environment+'/'+scope(environment,current)+'/'+id.sha256+'.'+id.kind}
async function readBuffer(blob){const r=await blob.download(0),chunks=[];for await(const part of r.readableStreamBody)chunks.push(Buffer.from(part));return Buffer.concat(chunks)}
function cellText(cell){
 if(cell==null)return'';
 if(typeof cell==='string'||typeof cell==='number'||typeof cell==='boolean')return String(cell);
 if(cell.text!=null)return String(cell.text);
 if(cell.result!=null)return String(cell.result);
 if(cell.richText)return cell.richText.map(x=>text(x&&x.text)).join('');
 return text(cell)
}
async function analyzeXlsx(buffer,name){
 let ExcelJS;try{ExcelJS=require('exceljs')}catch(_){throw error('ABD_XLSX_RUNTIME_MISSING','Excel-Auswertung ist auf dem Server nicht verfügbar.',503)}
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
 const objects=[],sheets=[];
 workbook.worksheets.slice(0,12).forEach(ws=>{
  const matrix=[];ws.eachRow({includeEmpty:false},(row,rowNumber)=>{if(matrix.length>=1000)return;const values=[];for(let i=1;i<=Math.min(row.cellCount||row.actualCellCount||40,40);i++)values.push(cellText(row.getCell(i).value));matrix.push(values)});
  const parsed=analyzer.matrixToObjects(matrix,name+' · '+ws.name);if(parsed.length){objects.push(...parsed);sheets.push(ws.name)}
 });
 return Object.assign(analyzer.analyzeObjects(objects),{fileName:name,fileType:'xlsx',sheets,requiresReview:true})
}
function analyzeCsv(buffer,name){
 const matrix=analyzer.parseDelimited(buffer.toString('utf8')),objects=analyzer.matrixToObjects(matrix,name);
 return Object.assign(analyzer.analyzeObjects(objects),{fileName:name,fileType:'csv',requiresReview:true})
}
async function analyzePdf(buffer,name){
 const extracted=await pdfContent.extractPdfText(buffer);
 return Object.assign(analyzer.extractPdfCandidates(extracted,name),{fileName:name,fileType:'pdf'})
}
async function analyzeFile(buffer,name,kind){
 if(kind==='pdf')return analyzePdf(buffer,name);
 if(kind==='xlsx')return analyzeXlsx(buffer,name);
 return analyzeCsv(buffer,name)
}
async function upload(req,current,environment,payload){
 const file=genericFile(payload.file,req),container=await quarantine(),id={sha256:file.sha256,kind:file.kind},blob=container.getBlockBlobClient(blobName(environment,current,id));
 try{
  await blob.uploadData(file.buffer,{blobHTTPHeaders:{blobContentType:file.mimeType,blobCacheControl:'no-store'},metadata:{name:Buffer.from(file.name,'utf8').toString('base64url').slice(0,512),kind:file.kind,owner:scope(environment,current),uploadedAt:Date.now().toString()},conditions:{ifNoneMatch:'*'}})
 }catch(e){if(!e||![409,412].includes(Number(e.statusCode||e.status)))throw e}
 return{ok:true,status:'scanning',upload:{id:uploadId(file.sha256,file.kind),name:file.name,size:file.size,fileType:file.kind,provider:'Microsoft Defender for Storage'}}
}
async function status(req,current,environment,payload){
 const id=parseUploadId(payload.uploadId);if(!id)throw error('ABD_UPLOAD_ID_INVALID',apiI18n.t(req,'api.abdAnalysis.uploadInvalid'),400);
 const container=await quarantine(),blob=container.getBlockBlobClient(blobName(environment,current,id));
 let props;try{props=await blob.getProperties()}catch(e){if(Number(e&&e.statusCode||e&&e.status)===404)throw error('ABD_UPLOAD_EXPIRED',apiI18n.t(req,'api.abdAnalysis.uploadExpired'),410);throw e}
 const created=props&&props.createdOn?new Date(props.createdOn).getTime():Number(props&&props.metadata&&props.metadata.uploadedAt||0);
 if(created&&Date.now()-created>MAX_AGE_MS){await blob.deleteIfExists();throw error('ABD_UPLOAD_EXPIRED',apiI18n.t(req,'api.abdAnalysis.uploadExpired'),410)}
 const tagResult=await blob.getTags(),scan=pdfSecurity.scanResultFromTags(tagResult&&tagResult.tags||{});
 if(scan.status==='pending')return{httpStatus:202,body:{ok:true,status:'scanning',provider:'Microsoft Defender for Storage',scanResult:scan.result||''}};
 if(scan.status!=='clean'){
  await blob.deleteIfExists();
  const malicious=scan.status==='malicious';
  return{httpStatus:200,body:{ok:false,status:'blocked',code:malicious?'ABD_MALWARE_DETECTED':'ABD_SCAN_FAILED',message:apiI18n.t(req,malicious?'api.abdAnalysis.malware':'api.abdAnalysis.scanFailed'),provider:'Microsoft Defender for Storage',scanResult:scan.result||''}}
 }
 const encoded=text(props&&props.metadata&&props.metadata.name);let name='ABD-Datei.'+id.kind;
 try{if(encoded)name=safeName(Buffer.from(encoded,'base64url').toString('utf8'))}catch(_){}
 let analysis;
 try{analysis=await analyzeFile(await readBuffer(blob),name,id.kind)}
 catch(e){throw error(e&&e.code||'ABD_ANALYSIS_FAILED',e&&e.message||apiI18n.t(req,'api.abdAnalysis.failed'),e&&e.status||422)}
 finally{await blob.deleteIfExists().catch(()=>{})}
 return{httpStatus:200,body:{ok:true,status:'ready',provider:'Microsoft Defender for Storage',scanResult:scan.result||'',analysis}}
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=response(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:apiI18n.t(req,'api.common.postOnly')});return}
 try{
  const current=await auth.validateSession(req);if(!allowed(current.user))throw error('ABD_ANALYSIS_FORBIDDEN',apiI18n.t(req,'api.abdAnalysis.forbidden'),403);
  const payload=auth.body(req),environment=auth.environmentFromRequest(req),action=lower(payload.action);
  if(action==='upload')context.res=response(202,await upload(req,current,environment,payload));
  else if(action==='status'){const result=await status(req,current,environment,payload);context.res=response(result.httpStatus,result.body)}
  else throw error('ABD_ACTION_INVALID',apiI18n.t(req,'api.abdAnalysis.actionInvalid'),400)
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1294 ABD analysis',e&&e.code,e&&e.message)}catch(_){}
  context.res=response(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'ABD_ANALYSIS_FAILED',message:e&&e.message||apiI18n.t(req,'api.abdAnalysis.failed')})
 }
};
