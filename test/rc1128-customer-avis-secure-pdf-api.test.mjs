import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';

const require=createRequire(import.meta.url);

function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){
    if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

function validPdf(label='SAFE'){
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Label ('+label+') >>\nendobj\ntrailer\n<<>>\n%%EOF\n','latin1');
}
function responseBody(res){return typeof res.body==='string'?JSON.parse(res.body):res.body}

function fixture(){
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  let etagNo=1,team={
    schemaVersion:3,
    revision:1,
    state:{shipments:[{id:'SHIP-1128',shipmentId:'SHIP-1128',reference:'ABC123',ref:'ABC123',customerName:'Testkunde',selectedLocationId:'LOC-1',status:'Erstellt',attachments:[]}]}
  };
  let teamEtag='"team-1"';
  const blobs=new Map();
  function key(container,name){return container+'/'+name}
  function container(name){
    return{
      name,
      async createIfNotExists(){return{created:false}},
      getBlockBlobClient(blobName){
        if(name==='exporthub-data'){
          return{
            name:blobName,
            async download(){return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:teamEtag}},
            async upload(raw,_length,options={}){
              const conditions=options.conditions||{};
              if(conditions.ifMatch&&conditions.ifMatch!==teamEtag){const e=new Error('conflict');e.statusCode=412;e.code='ConditionNotMet';throw e}
              team=JSON.parse(String(raw));teamEtag='"team-'+(++etagNo)+'"';return{etag:teamEtag}
            }
          };
        }
        return{
          name:blobName,
          async uploadData(buffer,options={}){
            const k=key(name,blobName),current=blobs.get(k);
            if(options.conditions&&options.conditions.ifNoneMatch==='*'&&current){const e=new Error('exists');e.statusCode=409;e.code='BlobAlreadyExists';throw e}
            blobs.set(k,{buffer:Buffer.from(buffer),metadata:Object.assign({},options.metadata||{}),tags:current&&current.tags||{},createdOn:new Date(),deleted:false,headers:options.blobHTTPHeaders||{}});
            return{etag:'"blob-'+(++etagNo)+'"'}
          },
          async upload(buffer,_length,options={}){return this.uploadData(buffer,options)},
          async download(){
            const rec=blobs.get(key(name,blobName));if(!rec||rec.deleted){const e=new Error('not found');e.statusCode=404;throw e}
            return{readableStreamBody:Readable.from([rec.buffer]),contentType:rec.headers&&rec.headers.blobContentType,etag:'"blob"'}
          },
          async getTags(){
            const rec=blobs.get(key(name,blobName));if(!rec||rec.deleted){const e=new Error('not found');e.statusCode=404;throw e}
            return{tags:Object.assign({},rec.tags)}
          },
          async getProperties(){
            const rec=blobs.get(key(name,blobName));if(!rec||rec.deleted){const e=new Error('not found');e.statusCode=404;throw e}
            return{metadata:Object.assign({},rec.metadata),createdOn:rec.createdOn,contentType:rec.headers&&rec.headers.blobContentType}
          },
          async deleteIfExists(){const rec=blobs.get(key(name,blobName));if(rec)rec.deleted=true;return{succeeded:!!rec}}
        };
      }
    };
  }
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient:container}}}};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    async resolveSession(session,kind){
      assert.equal(kind,'avis');assert.equal(session,'avis-session');
      return{environment:'testservice',record:{subjectId:'SHIP-1128',reference:'ABC123'}}
    }
  };
  const auth={};
  const handler=loadCommonJs('api/customer-avis/index.js',{
    '@azure/storage-blob':azure,
    '../shared/public-access-store':access,
    '../shared/fast-auth-store':auth,
    '../shared/document-blob-store':{DOCUMENT_CONTAINER:'exporthub-documents'}
  });
  async function call(body){
    const context={log:{error(){}},res:null};
    await handler(context,{method:'POST',headers:{'x-exporthub-avis-session':'avis-session'},query:{},body});
    return{status:context.res.status,body:responseBody(context.res)}
  }
  return{
    handler,call,blobs,
    team(){return team},
    quarantineRecords(){return[...blobs.entries()].filter(([k])=>k.startsWith('exporthub-avis-quarantine/'))},
    documentRecords(){return[...blobs.entries()].filter(([k])=>k.startsWith('exporthub-documents/'))},
    restore(){if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage}
  };
}

test('RC1128 API: PDF bleibt bis Defender-Clean ausschließlich in Quarantäne und wird danach übernommen',async()=>{
  const fx=fixture();
  try{
    const bytes=validPdf(),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    let res=await fx.call({action:'upload-document',file:{name:'Kundenfreigabe.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    assert.equal(res.status,202);
    assert.equal(res.body.status,'scanning');
    assert.equal(res.body.upload.id,hash);
    assert.equal(fx.quarantineRecords().length,1);
    assert.equal(fx.documentRecords().length,0,'vor sauberem Defender-Ergebnis darf kein finaler Dokumentblob existieren');
    assert.equal(fx.team().state.shipments[0].attachments.length,0,'vor sauberem Defender-Ergebnis darf kein Attachment existieren');
    assert.equal(fx.team().state.shipments[0].customerAvisDocumentUploads[0].status,'scanning');

    const [qKey,qRec]=fx.quarantineRecords()[0];
    assert.match(qKey,/^exporthub-avis-quarantine\/rc1128\/testservice\/[a-f0-9]{24}\/[a-f0-9]{64}\.pdf$/);
    qRec.tags['Malware scanning scan result']='No threats found';
    qRec.tags['Malware scanning scan time']='2026-09-16T12:00:00Z';

    res=await fx.call({action:'document-upload-status',uploadId:hash});
    assert.equal(res.status,200);
    assert.equal(res.body.status,'saved');
    assert.equal(qRec.deleted,true,'Quarantäneblob muss nach Promotion gelöscht werden');
    assert.equal(fx.documentRecords().length,1);
    const sh=fx.team().state.shipments[0];
    assert.equal(sh.attachments.length,1);
    assert.equal(sh.attachments[0].source,'customer-avis-upload');
    assert.equal(sh.attachments[0].customerAvisVisible,true);
    assert.equal(sh.attachments[0].sha256,hash);
    assert.equal(sh.attachments[0].malwareScan.result,'No threats found');
    assert.equal(sh.customerAvisDocumentUploads.at(-1).status,'saved');
  }finally{fx.restore()}
});

test('RC1128 API: Defender Malicious löscht Quarantäne und speichert niemals ein Sendungsdokument',async()=>{
  const fx=fixture();
  try{
    const bytes=validPdf('MALWARE-SIMULATION'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    let res=await fx.call({action:'upload-document',file:{name:'verdacht.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    assert.equal(res.status,202);
    const [,qRec]=fx.quarantineRecords()[0];
    qRec.tags['Malware scanning scan result']='Malicious';
    qRec.tags['Malware scanning scan time']='2026-09-16T12:01:00Z';

    res=await fx.call({action:'document-upload-status',uploadId:hash});
    assert.equal(res.status,200);
    assert.equal(res.body.status,'blocked');
    assert.equal(res.body.code,'PDF_MALWARE_DETECTED');
    assert.equal(qRec.deleted,true);
    assert.equal(fx.documentRecords().length,0);
    const sh=fx.team().state.shipments[0];
    assert.equal(sh.attachments.length,0);
    assert.equal(sh.customerAvisDocumentUploads.at(-1).status,'blocked');
    assert.match(sh.customerAvisDocumentUploads.at(-1).message,/schädlich erkannt/i);
  }finally{fx.restore()}
});
