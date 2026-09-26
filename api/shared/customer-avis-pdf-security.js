'use strict';
const crypto=require('crypto');

const DEFAULT_MAX_PDF_BYTES=10*1024*1024;
const HARD_MAX_PDF_BYTES=20*1024*1024;
const DEFENDER_RESULT_TAG='Malware scanning scan result';
const DEFENDER_TIME_TAG='Malware scanning scan time';

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function err(code,message,status=400,vars){const e=new Error(message);e.code=code;e.status=status;e.vars=vars||{};return e}
function normalizeEnvironment(value){return lower(value)==='testservice'?'testservice':'production'}
function maxPdfBytes(){
  const raw=Number(process.env.EXPORTHUB_AVIS_PDF_MAX_BYTES||DEFAULT_MAX_PDF_BYTES);
  return Math.max(1024,Math.min(HARD_MAX_PDF_BYTES,Number.isFinite(raw)?Math.round(raw):DEFAULT_MAX_PDF_BYTES));
}
function safeFileName(value){
  let name=text(value).replace(/[\\/:*?"<>|\x00-\x1f\x7f]+/g,'_').replace(/\s+/g,' ').trim();
  if(!name)name='Kunden-Dokument.pdf';
  if(name.length>160)name=name.slice(0,156)+'.pdf';
  return name;
}
function strictBase64(raw){
  const value=String(raw||'').replace(/\s+/g,'');
  if(!value||value.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))return null;
  try{
    const bytes=Buffer.from(value,'base64');
    if(!bytes.length)return null;
    if(bytes.toString('base64').replace(/=+$/,'')!==value.replace(/=+$/,''))return null;
    return bytes;
  }catch(_){return null}
}
function assertPdfStructure(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<16)throw err('PDF_INVALID','Die Datei ist kein gültiges PDF.',400);
  if(buffer.subarray(0,5).toString('ascii')!=='%PDF-')throw err('PDF_MAGIC_INVALID','Die Datei besitzt keine gültige PDF-Signatur.',400);
  const tail=buffer.subarray(Math.max(0,buffer.length-4096)).toString('latin1');
  if(!/%%EOF[\x00\t\n\f\r ]*$/.test(tail))throw err('PDF_EOF_INVALID','Die PDF-Datei ist unvollständig oder beschädigt.',400);
  const source=buffer.toString('latin1');
  if(/\/Encrypt\b/.test(source))throw err('PDF_ENCRYPTED','Passwortgeschützte oder verschlüsselte PDFs können aus Sicherheitsgründen nicht hochgeladen werden.',400);
  const active=[
    ['/JavaScript',/\/JavaScript\b/i],
    ['/JS',/\/JS\b/i],
    ['/Launch',/\/Launch\b/i],
    ['/EmbeddedFile',/\/EmbeddedFile\b/i],
    ['/OpenAction',/\/OpenAction\b/i],
    ['/AA',/\/AA\b/i],
    ['/RichMedia',/\/RichMedia\b/i]
  ];
  for(const [label,rx] of active)if(rx.test(source))throw err('PDF_ACTIVE_CONTENT','api.pdf.activeContent',400,{label});
  return true;
}
function validatePdfUpload(file){
  if(!file||typeof file!=='object'||Array.isArray(file))throw err('PDF_REQUIRED','Bitte eine PDF-Datei auswählen.',400);
  const name=safeFileName(file.name||file.fileName||file.filename);
  if(!/\.pdf$/i.test(name))throw err('PDF_EXTENSION_REQUIRED','Es sind ausschließlich PDF-Dateien zulässig.',400);
  const claimedMime=lower(file.type||file.mimeType||file.contentType);
  if(claimedMime&&claimedMime!=='application/pdf'&&claimedMime!=='application/x-pdf')throw err('PDF_MIME_INVALID','Es sind ausschließlich PDF-Dateien zulässig.',400);
  const limit=maxPdfBytes(),rawBase64=String(file.base64||'').replace(/\s+/g,''),maxBase64Chars=Math.ceil(limit/3)*4;
  if(rawBase64.length>maxBase64Chars+4)throw err('PDF_TOO_LARGE','Die PDF-Datei ist zu groß. Maximal '+Math.floor(limit/1048576)+' MB sind zulässig.',413);
  const buffer=strictBase64(rawBase64);
  if(!buffer)throw err('PDF_BASE64_INVALID','Die PDF-Datei konnte nicht gelesen werden.',400);
  if(buffer.length>limit)throw err('PDF_TOO_LARGE','Die PDF-Datei ist zu groß. Maximal '+Math.floor(limit/1048576)+' MB sind zulässig.',413);
  assertPdfStructure(buffer);
  const hash=crypto.createHash('sha256').update(buffer).digest('hex');
  return{name,buffer,size:buffer.length,mimeType:'application/pdf',sha256:hash};
}
function scopeHash(scope){return crypto.createHash('sha256').update(text(scope)).digest('hex').slice(0,24)}
function quarantinePrefix(environment,scope){return 'rc1128/'+normalizeEnvironment(environment)+'/'+scopeHash(scope)+'/' }
function quarantineBlobName(environment,scope,sha256){if(!/^[a-f0-9]{64}$/.test(text(sha256)))throw err('UPLOAD_ID_INVALID','Upload-ID ist ungültig.',400);return quarantinePrefix(environment,scope)+sha256+'.pdf'}
function finalBlobName(environment,sha256){if(!/^[a-f0-9]{64}$/.test(text(sha256)))throw err('UPLOAD_ID_INVALID','Upload-ID ist ungültig.',400);const env=normalizeEnvironment(environment);return 'rc1059/'+env+'/'+sha256.slice(0,2)+'/'+sha256}
function encodeNameMetadata(name){return Buffer.from(safeFileName(name),'utf8').toString('base64url').slice(0,512)}
function decodeNameMetadata(value){try{return safeFileName(Buffer.from(text(value),'base64url').toString('utf8'))}catch(_){return'Kunden-Dokument.pdf'}}
function tagValue(tags,name){
  const target=lower(name);
  for(const [key,value] of Object.entries(tags&&typeof tags==='object'?tags:{}))if(lower(key)===target)return text(value);
  return'';
}
function scanResultFromTags(tags){
  const raw=tagValue(tags,DEFENDER_RESULT_TAG),time=tagValue(tags,DEFENDER_TIME_TAG),v=lower(raw);
  if(v==='no threats found')return{status:'clean',result:raw,scanTime:time};
  if(v==='malicious')return{status:'malicious',result:raw,scanTime:time};
  if(v==='not scanned'||v.startsWith('not scanned'))return{status:'not-scanned',result:raw,scanTime:time};
  if(v==='error'||v.startsWith('error')||v.includes('scan timed out'))return{status:'error',result:raw,scanTime:time};
  return{status:'pending',result:raw,scanTime:time};
}

module.exports={
  DEFAULT_MAX_PDF_BYTES,
  HARD_MAX_PDF_BYTES,
  DEFENDER_RESULT_TAG,
  DEFENDER_TIME_TAG,
  normalizeEnvironment,
  maxPdfBytes,
  safeFileName,
  strictBase64,
  assertPdfStructure,
  validatePdfUpload,
  scopeHash,
  quarantinePrefix,
  quarantineBlobName,
  finalBlobName,
  encodeNameMetadata,
  decodeNameMetadata,
  scanResultFromTags
};
