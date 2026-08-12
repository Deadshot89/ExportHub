'use strict';

const crypto = require('crypto');
const { Readable } = require('stream');

const STORAGE_API_VERSION = '2023-11-03';
const TRANSIENT = new Set([408,425,429,500,502,503,504]);

function text(v){ return String(v == null ? '' : v).trim(); }
function parseConnectionString(raw){
  const parts={};
  String(raw||'').split(';').forEach(part=>{
    if(!part)return;
    const i=part.indexOf('='); if(i<1)return;
    parts[part.slice(0,i).trim()]=part.slice(i+1).trim();
  });
  if(/^true$/i.test(parts.UseDevelopmentStorage||'')) throw makeError(500,'UnsupportedConnectionString','DevelopmentStorage wird in Azure Static Web Apps nicht als ExportHUB-Datenspeicher unterstützt.');
  const accountName=text(parts.AccountName);
  const accountKey=text(parts.AccountKey);
  const sas=text(parts.SharedAccessSignature).replace(/^\?/,'');
  const protocol=text(parts.DefaultEndpointsProtocol)||'https';
  const suffix=text(parts.EndpointSuffix)||'core.windows.net';
  const endpoint=(text(parts.BlobEndpoint)||(`${protocol}://${accountName}.blob.${suffix}`)).replace(/\/+$/,'');
  if(!accountName)throw makeError(500,'InvalidConnectionString','AccountName fehlt in der ExportHUB-Speicherverbindung.');
  if(!accountKey&&!sas)throw makeError(500,'InvalidConnectionString','AccountKey oder SharedAccessSignature fehlt in der ExportHUB-Speicherverbindung.');
  return {accountName,accountKey,sas,endpoint};
}
function makeError(statusCode,code,message){
  const e=new Error(message||code||('HTTP '+statusCode));
  e.statusCode=Number(statusCode)||500;e.code=code||('HTTP_'+e.statusCode);e.details={errorCode:e.code};return e;
}
function xmlDecode(s){return String(s||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
function xmlValue(xml,tag){const m=String(xml||'').match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));return m?xmlDecode(m[1].trim()):'';}
function normalizeHeaders(input){
  const out={};
  if(input&&typeof input.forEach==='function'){input.forEach((v,k)=>{out[String(k).toLowerCase()]=String(v)});return out}
  Object.keys(input||{}).forEach(k=>{if(input[k]!==undefined&&input[k]!==null)out[String(k).toLowerCase()]=String(input[k])});return out;
}
function canonicalizedResource(account,url){
  let path=url.pathname;try{path=decodeURIComponent(path)}catch(_){}
  let result='/'+account+path;
  const q={};url.searchParams.forEach((v,k)=>{const key=String(k).toLowerCase();(q[key]||(q[key]=[])).push(String(v))});
  Object.keys(q).sort().forEach(k=>{result+='\n'+k+':'+q[k].sort().join(',')});
  return result;
}
function sharedKeyAuthorization(config,method,url,headers){
  const h=normalizeHeaders(headers);
  const contentLength=(h['content-length']==='0'?'':(h['content-length']||''));
  const canonicalHeaders=Object.keys(h).filter(k=>k.startsWith('x-ms-')).sort().map(k=>k+':'+h[k].replace(/\s+/g,' ').trim()+'\n').join('');
  const fields=[
    method.toUpperCase(),h['content-encoding']||'',h['content-language']||'',contentLength,h['content-md5']||'',h['content-type']||'',h['date']||'',
    h['if-modified-since']||'',h['if-match']||'',h['if-none-match']||'',h['if-unmodified-since']||'',h['range']||''
  ];
  const toSign=fields.join('\n')+'\n'+canonicalHeaders+canonicalizedResource(config.accountName,url);
  const sig=crypto.createHmac('sha256',Buffer.from(config.accountKey,'base64')).update(toSign,'utf8').digest('base64');
  return 'SharedKey '+config.accountName+':'+sig;
}
function encodePath(name){return String(name||'').split('/').map(seg=>encodeURIComponent(seg)).join('/');}
function responseMetadata(headers){const out={};headers.forEach((v,k)=>{if(k.toLowerCase().startsWith('x-ms-meta-'))out[k.slice(10).toLowerCase()]=v});return out;}
async function parseAzureError(res){
  let raw='';try{raw=await res.text()}catch(_){}
  const code=xmlValue(raw,'Code')||res.headers.get('x-ms-error-code')||('HTTP_'+res.status);
  const msg=xmlValue(raw,'Message')||raw.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||('Azure Blob HTTP '+res.status);
  return makeError(res.status,code,msg);
}
async function doFetch(config,method,url,headers={},body=null,attempts=3){
  const target=new URL(url.toString());
  if(config.sas){const sas=new URLSearchParams(config.sas);sas.forEach((v,k)=>{if(!target.searchParams.has(k))target.searchParams.append(k,v)})}
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    const h=normalizeHeaders(headers);h['x-ms-date']=new Date().toUTCString();h['x-ms-version']=STORAGE_API_VERSION;
    if(!config.sas)h.authorization=sharedKeyAuthorization(config,method,target,h);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const res=await fetch(target,{method,headers:h,body,signal:controller.signal});clearTimeout(timer);
      if(res.ok)return res;
      const err=await parseAzureError(res);last=err;
      if(!TRANSIENT.has(res.status)||attempt===attempts)throw err;
    }catch(e){clearTimeout(timer);last=e;if((e&&e.statusCode&&!TRANSIENT.has(Number(e.statusCode)))||attempt===attempts)throw e;}
    await new Promise(r=>setTimeout(r,Math.min(1600,250*attempt)));
  }
  throw last||makeError(503,'StorageRequestFailed','Azure Blob konnte nicht erreicht werden.');
}
function parseListXml(xml){
  const out=[];const s=String(xml||'');const re=/<Blob>([\s\S]*?)<\/Blob>/gi;let m;
  while((m=re.exec(s))){
    const b=m[1],name=xmlValue(b,'Name');if(!name)continue;
    const p=xmlValue(b,'Properties')||b;const metaBlock=xmlValue(b,'Metadata');const metadata={};
    if(metaBlock){const mr=/<([A-Za-z0-9_.-]+)>([\s\S]*?)<\/\1>/g;let mm;while((mm=mr.exec(metaBlock)))metadata[mm[1].toLowerCase()]=xmlDecode(mm[2].trim());}
    const lm=xmlValue(p,'Last-Modified');
    out.push({name,versionId:xmlValue(b,'VersionId')||undefined,snapshot:xmlValue(b,'Snapshot')||undefined,isCurrentVersion:/^true$/i.test(xmlValue(b,'IsCurrentVersion')),deleted:/^true$/i.test(xmlValue(b,'Deleted')),metadata,properties:{lastModified:lm?new Date(lm):undefined,etag:xmlValue(p,'Etag')||undefined}});
  }
  return {items:out,nextMarker:xmlValue(s,'NextMarker')};
}
class RestBlobClient{
  constructor(config,container,name,versionId='',snapshot=''){this.config=config;this.containerName=container;this.name=name;this.versionId=versionId;this.snapshot=snapshot;}
  url(){const u=new URL(this.config.endpoint+'/'+encodeURIComponent(this.containerName)+'/'+encodePath(this.name));if(this.versionId)u.searchParams.set('versionid',this.versionId);else if(this.snapshot)u.searchParams.set('snapshot',this.snapshot);return u;}
  withVersion(v){return new RestBlobClient(this.config,this.containerName,this.name,String(v||''),'');}
  withSnapshot(v){return new RestBlobClient(this.config,this.containerName,this.name,'',String(v||''));}
  async download(offset=0){
    const headers={};if(Number(offset)>0)headers.range='bytes='+Number(offset)+'-';
    const res=await doFetch(this.config,'GET',this.url(),headers,null,3);const buf=Buffer.from(await res.arrayBuffer());
    return {etag:res.headers.get('etag'),lastModified:res.headers.get('last-modified')?new Date(res.headers.get('last-modified')):null,metadata:responseMetadata(res.headers),readableStreamBody:Readable.from(buf)};
  }
  async getProperties(){
    const res=await doFetch(this.config,'HEAD',this.url(),{},null,3);
    return {etag:res.headers.get('etag'),lastModified:res.headers.get('last-modified')?new Date(res.headers.get('last-modified')):null,metadata:responseMetadata(res.headers)};
  }
  async upload(content,length,options={}){
    const buf=Buffer.isBuffer(content)?content:Buffer.from(content);const headers={'x-ms-blob-type':'BlockBlob','content-length':String(Number(length)>=0?Number(length):buf.length)};
    const ct=options&&options.blobHTTPHeaders&&options.blobHTTPHeaders.blobContentType;if(ct)headers['content-type']=ct;
    const cond=options&&options.conditions||{};if(cond.ifMatch)headers['if-match']=cond.ifMatch;if(cond.ifNoneMatch)headers['if-none-match']=cond.ifNoneMatch;
    Object.keys(options&&options.metadata||{}).forEach(k=>{const v=options.metadata[k];if(v!==undefined&&v!==null)headers['x-ms-meta-'+String(k).toLowerCase()]=String(v)});
    const res=await doFetch(this.config,'PUT',this.url(),headers,buf,3);return {etag:res.headers.get('etag'),lastModified:res.headers.get('last-modified')};
  }
}
class RestContainerClient{
  constructor(config,name){this.config=config;this.containerName=name;}
  getBlockBlobClient(name){return new RestBlobClient(this.config,this.containerName,name);}
  getBlobClient(name){return new RestBlobClient(this.config,this.containerName,name);}
  async *listBlobsFlat(options={}){
    let marker='';
    do{
      const u=new URL(this.config.endpoint+'/'+encodeURIComponent(this.containerName));u.searchParams.set('restype','container');u.searchParams.set('comp','list');u.searchParams.set('maxresults','5000');
      if(options.prefix)u.searchParams.set('prefix',String(options.prefix));if(marker)u.searchParams.set('marker',marker);
      const include=[];if(options.includeSnapshots)include.push('snapshots');if(options.includeMetadata)include.push('metadata');if(options.includeVersions)include.push('versions');if(options.includeDeleted)include.push('deleted');if(options.includeDeletedWithVersions)include.push('deletedwithversions');if(include.length)u.searchParams.set('include',include.join(','));
      const res=await doFetch(this.config,'GET',u,{},null,3);const parsed=parseListXml(await res.text());for(const item of parsed.items)yield item;marker=parsed.nextMarker||'';
    }while(marker);
  }
}
class RestBlobServiceClient{
  constructor(config){this.config=config;}
  getContainerClient(name){return new RestContainerClient(this.config,name);}
}
function createBlobServiceClient(connectionString){return new RestBlobServiceClient(parseConnectionString(connectionString));}
module.exports={createBlobServiceClient,parseConnectionString,RestBlobServiceClient,RestContainerClient,RestBlobClient};
