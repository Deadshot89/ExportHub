import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

function makeHarness(){
  let seq=0,teamDownloads=0;
  const issued=new Map();
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{getBlockBlobClient(){return{async download(){teamDownloads++;const e=new Error('unexpected team read');e.statusCode=404;throw e},async upload(){throw new Error('unexpected team write')}}}}}}}}};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(req,payload){return payload&&payload.environment||'testservice'},
    async issue(_req,type,record){
      assert.equal(type,'avis');
      const token=(++seq).toString(16).padStart(48,'0');
      issued.set(token,record);
      return{token,expiresAt:null,record};
    },
    async revokeSubject(){return{ok:true}},
    async resolve(_req,type,token){
      assert.equal(type,'avis');
      const record=issued.get(token);
      if(!record){const e=new Error('not found');e.code='ACCESS_NOT_FOUND';e.status=404;throw e}
      return{environment:'testservice',record,tokenHash:'probe'};
    }
  };
  const auth={
    TEAM_CONTAINER:'exporthub-data',TEAM_BLOB:'team-state.json',
    async validateSession(){return{user:{name:'Avis Probe',rights:{shipment:{edit:true}}}}},
    hasAnyEditRight(){return true},
    error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}
  };
  const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
  return{handler,issued,get teamDownloads(){return teamDownloads}};
}

function refFor(i){return('AV'+String(i).padStart(4,'0')).slice(-6).toUpperCase()}

test('Lieferavis Funktionsprobe: 20 neu erzeugte Sendungen liefern den Avis-Zugriff direkt in derselben erfolgreichen Antwort',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  try{
    const h=makeHarness(),rows=[];
    for(let i=1;i<=20;i++){
      const ref=refFor(i),shipmentId='AVIS-PROBE-'+String(i).padStart(2,'0');
      const snapshot={id:shipmentId,shipmentId,ref,reference:ref,customerName:'Avis Testkunde '+i,selectedLocationId:'LOC-'+i,status:'Entwurf',recipientAddress:'Teststraße '+i+', 41334 Nettetal'};
      const beforeDownloads=h.teamDownloads;
      const context={log:{error(){}},res:null};
      const wallStart=performance.now();
      await h.handler(context,{method:'POST',headers:{host:'probe-testservice.azurestaticapps.net'},body:{action:'issue',shipmentId,reference:ref,environment:'testservice',shipmentSnapshot:snapshot}});
      const wallMs=Math.round((performance.now()-wallStart)*100)/100;
      assert.equal(context.res.status,200,'Avis-Issue muss HTTP 200 liefern');
      const body=JSON.parse(context.res.body);
      assert.equal(body.issued,true);
      assert.equal(body.reference,ref);
      const downloads=h.teamDownloads-beforeDownloads;
      assert.equal(downloads,0,'Fast-Path darf den großen Team-State nicht wirklich herunterladen');
      const token=String(body.token||body.accessToken||body.avisToken||'');
      const url=String(body.url||body.link||body.avisUrl||body.customerAvisUrl||'');
      assert.ok(token||url,'Die erfolgreiche Antwort muss Token oder fertigen Avis-Link enthalten');
      if(token)assert.ok(h.issued.has(token),'Ausgegebener Token muss unmittelbar auflösbar sein');
      rows.push({case:i,reference:ref,wallMs,serverTotalMs:Number(body.timing&&body.timing.totalMs||0),teamReadMs:Number(body.timing&&body.timing.teamReadMs||0),teamDownloads:downloads,tokenReady:!!token,urlReady:!!url,responseKeys:Object.keys(body).sort()});
      console.log('AVIS_PROBE',JSON.stringify(rows.at(-1)));
    }
    const values=rows.map(r=>r.wallMs).sort((a,b)=>a-b);
    const avg=Math.round((rows.reduce((a,r)=>a+r.wallMs,0)/rows.length)*100)/100;
    const p95=values[Math.min(values.length-1,Math.ceil(values.length*0.95)-1)];
    console.log('AVIS_PROBE_SUMMARY',JSON.stringify({count:rows.length,avgWallMs:avg,p95WallMs:p95,maxWallMs:values.at(-1),allImmediate:rows.every(r=>r.tokenReady||r.urlReady),actualTeamDownloads:rows.reduce((a,r)=>a+r.teamDownloads,0),reportedTeamReadMs:rows.map(r=>r.teamReadMs)}));
  }finally{
    if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage;
  }
});
