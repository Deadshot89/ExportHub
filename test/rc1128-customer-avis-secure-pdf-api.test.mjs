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

function fixture(contentResult={ok:true,code:'PDF_CONTENT_VALID',message:'PDF-Inhalt passt zur Sendung.',documentType:'other',documentTypeLabel:'Sonstiges',matched:['Sendungsreferenz']},options={}){
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  const environment=options.environment||'testservice',sentMails=[];
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
      return{environment,record:{subjectId:'SHIP-1128',reference:'ABC123'}}
    }
  };
  const auth={};
  const contentCheck={
    documentType(value){return String(value||'').trim()||'other'},
    async validateShipmentDocument(){return Object.assign({},contentResult)}
  };
  const handler=loadCommonJs('api/customer-avis/index.js',{
    '@azure/storage-blob':azure,
    '../shared/public-access-store':access,
    '../shared/fast-auth-store':auth,
    '../shared/document-blob-store':{DOCUMENT_CONTAINER:'exporthub-documents'},
    '../shared/customer-avis-document-content':contentCheck,
    '../shared/graph-mail':{
      async sendTextMail(mail){
        sentMails.push(Object.assign({},mail));
        if(typeof options.onSendMail==='function')await options.onSendMail(mail,{team,blobs});
        if(options.mailError){const e=new Error('mail failed');e.code=options.mailError;throw e}
        return{ok:true,to:mail.to,attempts:1}
      }
    }
  });
  async function call(body){
    const context={log:{error(){}},res:null};
    await handler(context,{method:'POST',headers:{'x-exporthub-avis-session':'avis-session'},query:{},body});
    return{status:context.res.status,body:responseBody(context.res)}
  }
  return{
    handler,call,blobs,sentMails,
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
    let res=await fx.call({action:'upload-document',documentType:'other',file:{name:'Kundenfreigabe.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    assert.equal(res.status,202,JSON.stringify(res.body));
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
    assert.equal(res.status,200,JSON.stringify(res.body));
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
    assert.ok(Array.isArray(fx.team().state.notifications),'AVIS-Upload muss eine interne Benachrichtigung erzeugen');
    const notice=fx.team().state.notifications.find(x=>x&&x.type==='customer-avis-document'&&x.documentSha256===hash);
    assert.ok(notice,'Benachrichtigung für das gespeicherte Kundendokument fehlt');
    assert.equal(notice.title,'Neues AVIS-Dokument');
    assert.equal(notice.shipmentRef,'ABC123');
    assert.equal(notice.customerName,'Testkunde');
    assert.equal(notice.documentName,'Kundenfreigabe.pdf');
    assert.equal(notice.documentBlobName,sh.attachments[0].blobName);
    assert.equal(notice.read,false);
  }finally{fx.restore()}
});

test('RC1128 API: Defender Malicious löscht Quarantäne und speichert niemals ein Sendungsdokument',async()=>{
  const fx=fixture();
  try{
    const bytes=validPdf('MALWARE-SIMULATION'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    let res=await fx.call({action:'upload-document',documentType:'other',file:{name:'verdacht.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    assert.equal(res.status,202,JSON.stringify(res.body));
    const [,qRec]=fx.quarantineRecords()[0];
    qRec.tags['Malware scanning scan result']='Malicious';
    qRec.tags['Malware scanning scan time']='2026-09-16T12:01:00Z';

    res=await fx.call({action:'document-upload-status',uploadId:hash});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.status,'blocked');
    assert.equal(res.body.code,'PDF_MALWARE_DETECTED');
    assert.equal(qRec.deleted,true);
    assert.equal(fx.documentRecords().length,0);
    const sh=fx.team().state.shipments[0];
    assert.equal(sh.attachments.length,0);
    assert.equal(sh.customerAvisDocumentUploads.at(-1).status,'blocked');
    assert.match(sh.customerAvisDocumentUploads.at(-1).message,/schädlich erkannt/i);
    assert.equal((fx.team().state.notifications||[]).filter(x=>x&&x.type==='customer-avis-document').length,0,'blockierte PDFs dürfen keine Druck-Benachrichtigung erzeugen');
  }finally{fx.restore()}
});


test('RC1129 API: virenfreies aber fachlich falsches PDF wird nicht als Sendungsdokument gespeichert',async()=>{
  const fx=fixture({ok:false,code:'PDF_SHIPMENT_MISMATCH',message:'Das PDF konnte der Sendung nicht eindeutig zugeordnet werden. Es wird nicht gespeichert.',documentType:'other',matched:[],missing:['Sendungsreferenz ABC123']});
  try{
    const bytes=validPdf('FREMDE-SENDUNG'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    let res=await fx.call({action:'upload-document',documentType:'other',file:{name:'fremd.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    assert.equal(res.status,202,JSON.stringify(res.body));
    const [,qRec]=fx.quarantineRecords()[0];
    qRec.tags['Malware scanning scan result']='No threats found';
    qRec.tags['Malware scanning scan time']='2026-09-16T12:02:00Z';

    res=await fx.call({action:'document-upload-status',uploadId:hash});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.status,'blocked');
    assert.equal(res.body.code,'PDF_SHIPMENT_MISMATCH');
    assert.equal(qRec.deleted,true);
    assert.equal(fx.documentRecords().length,0,'fachlich falsches PDF darf keinen finalen Dokumentblob erzeugen');
    const sh=fx.team().state.shipments[0];
    assert.equal(sh.attachments.length,0);
    assert.equal(sh.customerAvisDocumentUploads.at(-1).status,'blocked');
    assert.equal(sh.customerAvisDocumentUploads.at(-1).contentCode,'PDF_SHIPMENT_MISMATCH');
  }finally{fx.restore()}
});


test('RC1249 API: erfolgreicher Produktionsupload sendet genau eine Despatch-Mail nach Persistenz',async()=>{
  let persistedAtSend=false;
  const fx=fixture(undefined,{
    environment:'production',
    onSendMail(_mail,{team}){
      const sh=team.state.shipments[0];
      persistedAtSend=Array.isArray(sh.attachments)&&sh.attachments.some(x=>x&&x.source==='customer-avis-upload');
    }
  });
  try{
    const bytes=validPdf('PRODUCTION-MAIL'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    let res=await fx.call({action:'upload-document',documentType:'other',file:{name:'Kundenfreigabe.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    assert.equal(res.status,202,JSON.stringify(res.body));
    const [qKey,qRec]=fx.quarantineRecords()[0];
    assert.match(qKey,/^exporthub-avis-quarantine\/rc1128\/production\//);
    qRec.tags['Malware scanning scan result']='No threats found';
    qRec.tags['Malware scanning scan time']='2026-09-23T19:10:00Z';

    res=await fx.call({action:'document-upload-status',uploadId:hash});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.status,'saved');
    assert.equal(res.body.mailNotification.ok,true);
    assert.equal(res.body.mailNotification.to,'DespatchNettetal@essentra.onmicrosoft.com');
    assert.equal(fx.sentMails.length,1);
    assert.equal(fx.sentMails[0].to,'DespatchNettetal@essentra.onmicrosoft.com');
    assert.match(fx.sentMails[0].subject,/Neues AVIS-Dokument/);
    assert.match(fx.sentMails[0].subject,/ABC123/);
    assert.match(fx.sentMails[0].body,/Sendungsreferenz: ABC123/);
    assert.match(fx.sentMails[0].body,/Kunde: Testkunde/);
    assert.match(fx.sentMails[0].body,/Dokument: Kundenfreigabe\.pdf/);
    assert.match(fx.sentMails[0].body,/PDF öffnen \/ drucken/);
    assert.equal(persistedAtSend,true,'Mail darf erst nach gespeichertem Kundendokument ausgelöst werden');
  }finally{fx.restore()}
});

test('RC1249 API: TESTSERVICE speichert sauber, verschickt aber keine echte Despatch-Mail',async()=>{
  const fx=fixture();
  try{
    const bytes=validPdf('TESTSERVICE-NO-MAIL'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    let res=await fx.call({action:'upload-document',documentType:'other',file:{name:'Kundenfreigabe.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    const [,qRec]=fx.quarantineRecords()[0];
    qRec.tags['Malware scanning scan result']='No threats found';
    qRec.tags['Malware scanning scan time']='2026-09-23T19:11:00Z';

    res=await fx.call({action:'document-upload-status',uploadId:hash});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.status,'saved');
    assert.equal(res.body.mailNotification.ok,true);
    assert.equal(res.body.mailNotification.skipped,true);
    assert.equal(res.body.mailNotification.reason,'non-production');
    assert.equal(fx.sentMails.length,0);
  }finally{fx.restore()}
});

test('RC1249 API: Mailfehler lässt geprüften Kundenupload gespeichert und sichtbar',async()=>{
  const fx=fixture(undefined,{environment:'production',mailError:'GRAPH_TIMEOUT'});
  try{
    const bytes=validPdf('MAIL-FAILURE'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    let res=await fx.call({action:'upload-document',documentType:'other',file:{name:'Kundenfreigabe.pdf',type:'application/pdf',base64:bytes.toString('base64')}});
    const [,qRec]=fx.quarantineRecords()[0];
    qRec.tags['Malware scanning scan result']='No threats found';
    qRec.tags['Malware scanning scan time']='2026-09-23T19:12:00Z';

    res=await fx.call({action:'document-upload-status',uploadId:hash});
    assert.equal(res.status,200,JSON.stringify(res.body));
    assert.equal(res.body.status,'saved');
    assert.equal(res.body.mailNotification.ok,false);
    assert.equal(res.body.mailNotification.code,'GRAPH_TIMEOUT');
    const sh=fx.team().state.shipments[0];
    assert.equal(sh.attachments.length,1);
    assert.equal(sh.attachments[0].source,'customer-avis-upload');
    assert.equal((fx.team().state.notifications||[]).some(x=>x&&x.type==='customer-avis-document'&&x.documentSha256===hash),true);
  }finally{fx.restore()}
});
