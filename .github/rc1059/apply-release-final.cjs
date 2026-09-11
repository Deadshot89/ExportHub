const fs=require('fs');

function patchFile(path,changes){
  let s=fs.readFileSync(path,'utf8');
  for(const change of changes){
    const [oldText,newText,label]=change;
    if(s.includes(newText))continue;
    const i=s.indexOf(oldText);
    if(i<0)throw new Error('RC1059 Patchstelle fehlt: '+label+' in '+path);
    if(s.indexOf(oldText,i+oldText.length)>=0)throw new Error('RC1059 Patchstelle nicht eindeutig: '+label+' in '+path);
    s=s.slice(0,i)+newText+s.slice(i+oldText.length);
  }
  fs.writeFileSync(path,s);
}

patchFile('api/shared/blob-rest.js',[
  [
    "return {etag:res.headers.get('etag'),lastModified:res.headers.get('last-modified')?new Date(res.headers.get('last-modified')):null,metadata:responseMetadata(res.headers),readableStreamBody:Readable.from(buf)};",
    "return {etag:res.headers.get('etag'),lastModified:res.headers.get('last-modified')?new Date(res.headers.get('last-modified')):null,contentType:res.headers.get('content-type')||'',metadata:responseMetadata(res.headers),readableStreamBody:Readable.from(buf)};",
    'Blob download content type'
  ],
  [
    "  constructor(config,name){this.config=config;this.containerName=name;}\n  getBlockBlobClient(name){return new RestBlobClient(this.config,this.containerName,name);}",
    "  constructor(config,name){this.config=config;this.containerName=name;}\n  async createIfNotExists(){const u=new URL(this.config.endpoint+'/'+encodeURIComponent(this.containerName));u.searchParams.set('restype','container');try{const res=await doFetch(this.config,'PUT',u,{},null,STORAGE_ATTEMPTS);return {succeeded:true,created:true,etag:res.headers.get('etag')}}catch(e){const status=Number(e&&e.statusCode||0),code=String(e&&e.code||'');if(status===409&&/ContainerAlreadyExists/i.test(code))return {succeeded:true,created:false};throw e}}\n  getBlockBlobClient(name){return new RestBlobClient(this.config,this.containerName,name);}",
    'REST container createIfNotExists'
  ]
]);

patchFile('api/exporthub-state/index.js',[
  [
    "const documentFieldCounts={},seen=new WeakSet();let documentPayloadBytes=0,inlinePayloadCount=0,documentEntries=0;",
    "const documentFieldCounts={},seen=new WeakSet();let documentPayloadBytes=0,inlinePayloadCount=0,documentEntries=0,blobDocumentEntries=0;",
    'diagnostic counter declaration'
  ],
  [
    "documentFieldCounts[key]=(documentFieldCounts[key]||0)+val.length;documentEntries+=val.length;val.forEach(v=>scanFile(v,0,key));return;",
    "documentFieldCounts[key]=(documentFieldCounts[key]||0)+val.length;documentEntries+=val.length;val.forEach(v=>{if(isObj(v)&&v.storage==='blob'&&text(v.blobName))blobDocumentEntries++;scanFile(v,0,key)});return;",
    'diagnostic blob document count'
  ],
  [
    "return {sectionBytes,documentEntries,documentPayloadBytes,inlinePayloadCount,documentFieldCounts};",
    "return {sectionBytes,documentEntries,blobDocumentEntries,documentPayloadBytes,inlinePayloadCount,documentFieldCounts};",
    'diagnostic return'
  ]
]);

console.log('RC1059 finale Storage- und Diagnosepatches angewendet.');
