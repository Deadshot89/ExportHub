import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

function loadWithMocks(relativeFile,mocks){
  const absolute=path.resolve(ROOT,relativeFile),original=Module._load;
  Module._load=function(request,parent,isMain){
    if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

test('RC1259: drei definierte Containerfotos werden unter der Referenz gespeichert und zusätzlich in den echten Ref-Ordner kopiert',async()=>{
  const previousStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  const uploaded=[],referenceUploads=[];
  const container={
    async createIfNotExists(){},
    getBlockBlobClient(name){return{async uploadData(buffer,options){uploaded.push({name,size:buffer.length,options})}}}
  };
  const mocks={
    '@azure/storage-blob':{BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return container}}}}},
    './reference-folder-upload':{async upload(reference,name,buffer,mimeType){referenceUploads.push({reference,name,size:buffer.length,mimeType});return{id:'graph-1',name,size:buffer.length,folderPath:'003 Export/ExportHub/Sendungen/'+reference,webUrl:'https://example.invalid/'+reference+'/'+name}}}
  };
  const absolute=path.resolve(ROOT,'api/shared/container-document-store.js'),originalLoad=Module._load;
  Module._load=function(request,parent,isMain){
    if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];
    return originalLoad.call(this,request,parent,isMain);
  };
  let saved;
  try{
    delete require.cache[require.resolve(absolute)];
    const docs=require(absolute);
    const dataUrl='data:image/jpeg;base64,'+Buffer.alloc(2048,1).toString('base64');
    saved=await docs.savePhoto({environment:'production',reference:'ABC123',kind:'loaded',dataUrl,shipmentId:'S1'});
  }finally{
    Module._load=originalLoad;
    if(previousStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previousStorage;
  }
  assert.equal(uploaded[0].name,'production/ABC123/Containerdokumentation/01_Geladener_Container_ABC123.jpg');
  assert.equal(referenceUploads[0].reference,'ABC123');
  assert.equal(referenceUploads[0].name,'01_Geladener_Container_ABC123.jpg');
  assert.equal(saved.referenceFolderSaved,true);
  assert.equal(saved.referenceFolderPath,'003 Export/ExportHub/Sendungen/ABC123');
});

test('RC1263: Container-Dokumentmodul lädt ohne Azure Blob SDK bis zum echten Speicherzugriff',()=>{
  const absolute=path.resolve(ROOT,'api/shared/container-document-store.js'),original=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='@azure/storage-blob')throw new Error('Azure SDK darf beim reinen Modulimport nicht geladen werden');
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve(absolute)];
  try{
    const docs=require(absolute);
    assert.equal(docs.completePhotos([{kind:'loaded'},{kind:'number'},{kind:'sealed'}]),true);
  }finally{Module._load=original;delete require.cache[require.resolve(absolute)]}
});

test('RC1259: genau alle drei Fotoarten ergeben vollständige Containerdokumentation',()=>{
  const docs=loadWithMocks('api/shared/container-document-store.js',{
    '@azure/storage-blob':{BlobServiceClient:{}},
    './reference-folder-upload':{}
  });
  assert.equal(docs.completePhotos([{kind:'loaded'},{kind:'number'}]),false);
  assert.equal(docs.completePhotos([{kind:'loaded'},{kind:'number'},{kind:'sealed'}]),true);
  assert.equal(docs.fileName('ABC123','sealed','jpg'),'03_Versiegelt_Siegel_Kennzeichen_Papiere_ABC123.jpg');
});

test('RC1259: QR-Abholung bietet Siegelnummer, drei Kameraaufnahmen und sofortigen Upload',()=>{
  const page=read('pickup.html');
  assert.match(page,/id="sealNumber"/);
  for(const id of ['containerPhotoLoaded','containerPhotoNumber','containerPhotoSealed']){
    assert.match(page,new RegExp('id="'+id+'"[^>]*type="file"[^>]*accept="image/\\*"[^>]*capture="environment"'));
  }
  assert.match(page,/pickup-container-document/);
  assert.match(page,/Für diese Sendung müssen alle 3 Containerfotos gespeichert sein/);
  assert.match(page,/Foto wurde im Referenzordner der Sendung gespeichert/);
  assert.match(page,/containerSealNumber:seal/);
  const colliPos=page.indexOf('id="colliSection"');
  const containerPos=page.indexOf('id="containerSection"');
  const detailsPos=page.indexOf('id="details"');
  const driverPos=page.indexOf('id="driverStep"');
  assert.ok(colliPos>=0&&containerPos>colliPos,'Colli-Prüfung muss zuerst stehen');
  assert.ok(detailsPos>containerPos,'Siegelnummer und Fotos müssen vor den Sendungsdetails stehen');
  assert.ok(driverPos>detailsPos,'Fahrerbereich muss nach den priorisierten Abholdaten stehen');
});

test('RC1259: vollständige Abholung ist bei Containerpflicht serverseitig ohne Siegel oder Fotos gesperrt',()=>{
  const confirm=read('api/pickup-confirm-v2/index.js');
  assert.match(confirm,/mode==='complete'&&containerRequired&&!sealNumber/);
  assert.match(confirm,/CONTAINER_SEAL_REQUIRED/);
  assert.match(confirm,/mode==='complete'&&containerRequired&&!containerDocs\.completePhotos\(containerPhotos\)/);
  assert.match(confirm,/CONTAINER_PHOTOS_REQUIRED/);
  assert.match(confirm,/r\.sealNumber=sealNumber/);
  assert.match(confirm,/updateTeamContainerDocumentation/);
});

test('RC1259: Pickup-Status veröffentlicht Containerdaten und bestehende QR-Codes laden die aktuelle Pflicht aus dem Team-State',()=>{
  const store=read('api/shared/pickup-store.js'),status=read('api/pickup-status/index.js'),init=read('api/pickup-init/index.js');
  assert.match(store,/containerDocumentationRequired:containerRequired/);
  assert.match(store,/sealNumber:sanitizeText/);
  assert.match(store,/containerPhotos,containerPhotoCount:containerPhotos\.length/);
  assert.match(status,/resolveShipmentContainerConfig/);
  assert.match(init,/containerDocumentationRequired:snapshot\.containerDocumentationRequired===true/);
});

test('RC1259: Sendungsansicht zeigt Siegel und Fotos mit authentifiziertem Ansehen und Download',()=>{
  const ui=read('assets/rc1014-shipment-overview.js');
  assert.match(ui,/container\\.sealNumber/);
  assert.match(ui,/container\\.view/);
  assert.match(ui,/container\\.download/);
  assert.match(ui,/enhanceShipmentDetailedView/);
  assert.match(ui,/rc786ReferenceFilesCard/);
  assert.match(ui,/Authorization':'Bearer '/);
  assert.match(ui,/fetchContainerBlob/);
  assert.match(ui,/queueSave\('container-documentation-config'\)/);
  assert.match(ui,/container\\.transportMode/);
  assert.match(ui,/container\\.sea/);
  assert.match(ui,/data-rc1259-seal/);
  assert.match(ui,/sh\.sealNumber=sealValue/);
  assert.match(ui,/sh\.containerSealNumber=sealValue/);
  assert.match(ui,/sh\.siegelnummer=sealValue/);
});

test('RC1259: Siegelnummer wird in Sendungsübersicht und Sendungsansicht als Suchfeld gebaut',()=>{
  const build=read('.github/rc1112/build-three-env.mjs');
  assert.match(build,/x&&x\.sealNumber/);
  assert.match(build,/sh&&sh\.sealNumber/);
  assert.match(build,/Siegelnummer, Kundennummer/);
  assert.match(build,/exporthub-rc1259-container-runtime/);
  assert.match(build,/rc1014-shipment-overview\.js\?v=1284/);
});

test('RC1259: stale Browser-Saves dürfen serverseitige Siegel- und Fotodaten nicht verlieren',()=>{
  const merge=read('api/shared/merge.js');
  assert.match(merge,/mergeContainerPhotosProtected/);
  assert.match(merge,/protectContainerDocumentation/);
  assert.match(merge,/meaningfulValue\(serverItem&&serverItem\.sealNumber\)/);
  assert.match(merge,/containerDocumentationUpdatedAt/);
  assert.match(merge,/containerPhotos/);
});

test('RC1272: Foto-Upload meldet erst Erfolg wenn das Foto mit der Sendung verknüpft ist',async()=>{
  const handler=loadWithMocks('api/pickup-container-document/index.js',{
    '../shared/public-access-store':{
      async resolve(){return{resourceKey:'access-key',tokenHash:'token-hash',environment:'production'}}
    },
    '../shared/pickup-store':{
      json(status,body){return{status,body}},
      body(req){return req.body||{}},
      async getRecord(){return{record:{reference:'ABC123',shipmentId:'S1',containerPhotos:[]}}},
      expired(){return false},
      pickupComplete(){return false},
      async mutateRecord(_key,_environment,mutator){return mutator({reference:'ABC123',shipmentId:'S1',containerPhotos:[]})},
      now(){return'2026-09-25T08:30:00.000Z'},
      err(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e},
      async updateTeamContainerDocumentation(){return{state:{shipments:[{id:'S1',reference:'ABC123',containerPhotos:[]}]}}}
    },
    '../shared/container-document-store':{
      kindOf(){return'loaded'},
      async savePhoto(){return{id:'container-loaded',kind:'loaded',blobName:'production/ABC123/Containerdokumentation/01_Geladener_Container_ABC123.jpg'}},
      publicPhoto(photo){return photo}
    }
  });
  const context={log:{error(){}},res:null};
  await handler(context,{method:'POST',body:{token:'pickup-token',kind:'loaded',dataUrl:'data:image/jpeg;base64,AA=='}});
  assert.equal(context.res.status,503);
  assert.equal(context.res.body.code,'CONTAINER_TEAM_SYNC_FAILED');
});

test('RC1272: erfolgreicher Foto-Upload bestätigt die Verknüpfung zur Sendung',async()=>{
  const photo={id:'container-loaded',kind:'loaded',blobName:'production/ABC123/Containerdokumentation/01_Geladener_Container_ABC123.jpg'};
  const handler=loadWithMocks('api/pickup-container-document/index.js',{
    '../shared/public-access-store':{
      async resolve(){return{resourceKey:'access-key',tokenHash:'token-hash',environment:'production'}}
    },
    '../shared/pickup-store':{
      json(status,body){return{status,body}},
      body(req){return req.body||{}},
      async getRecord(){return{record:{reference:'ABC123',shipmentId:'S1',containerPhotos:[]}}},
      expired(){return false},
      pickupComplete(){return false},
      async mutateRecord(_key,_environment,mutator){return mutator({reference:'ABC123',shipmentId:'S1',containerPhotos:[]})},
      now(){return'2026-09-25T08:30:00.000Z'},
      err(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e},
      async updateTeamContainerDocumentation(){return{state:{shipments:[{id:'S1',reference:'ABC123',containerPhotos:[photo]}]}}}
    },
    '../shared/container-document-store':{
      kindOf(){return'loaded'},
      async savePhoto(){return photo},
      publicPhoto(value){return value}
    }
  });
  const context={log:{error(){}},res:null};
  await handler(context,{method:'POST',body:{token:'pickup-token',kind:'loaded',dataUrl:'data:image/jpeg;base64,AA=='}});
  assert.equal(context.res.status,200);
  assert.equal(context.res.body.linkedToShipment,true);
  assert.equal(context.res.body.version,'RC1272');
});

test('RC1259: neue Browser- und Serverdateien sind syntaktisch prüfbar',()=>{
  for(const file of [
    'assets/rc1014-shipment-overview.js',
    'api/shared/container-document-store.js',
    'api/shared/reference-folder-upload.js',
    'api/pickup-container-document/index.js',
    'api/container-document/index.js',
    'api/shared/pickup-store.js',
    'api/pickup-init/index.js',
    'api/pickup-status/index.js',
    'api/pickup-confirm-v2/index.js'
  ])new Function(read(file));

  const page=read('pickup.html');
  for(const match of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    if(match[1].trim())new Function(match[1]);
  }
});
