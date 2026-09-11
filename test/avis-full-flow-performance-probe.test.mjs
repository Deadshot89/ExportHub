import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {Readable} from 'node:stream';
import {performance} from 'node:perf_hooks';

const require=createRequire(import.meta.url);
function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}
function bodyOf(res){return typeof res.body==='string'?JSON.parse(res.body||'{}'):(res.body||{})}
function ctx(){return{log:{error(){}},res:null}}

function makeHarness(targetBytes=130_000_000){
  const ref='PERF01',shipmentId='AVIS-PERF-01';
  const shipment={
    id:shipmentId,shipmentId,reference:ref,ref,status:'Erstellt',customerName:'Avis Performance Test',selectedLocationId:'LOC-PERF',recipientAddress:'Teststraße 1, 41334 Nettetal',
    rows:[{type:'EURO Pal',count:5,weight:900,ldm:0.4,l:120,w:80,h:140}],
    deliveryFiles:[{id:'LS-PERF',name:'Lieferschein.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,JVBERi0xLjQK'}]
  };
  const base={schemaVersion:3,revision:1,state:{shipments:[shipment],savedShipments:[],audit:[],performancePadding:''}};
  let raw=JSON.stringify(base);
  const missing=Math.max(0,targetBytes-Buffer.byteLength(raw));
  base.state.performancePadding='X'.repeat(missing);
  let teamBuffer=Buffer.from(JSON.stringify(base));
  const issued=new Map(),sessions=new Map();
  let downloads=0,downloadBytes=0,uploads=0,uploadBytes=0,seq=0;
  const blob={
    async download(){downloads++;downloadBytes+=teamBuffer.length;return{readableStreamBody:Readable.from([teamBuffer]),etag:'"team-'+downloads+'"'}},
    async upload(content,_length){const b=Buffer.isBuffer(content)?Buffer.from(content):Buffer.from(String(content));uploads++;uploadBytes+=b.length;teamBuffer=b;return{etag:'"uploaded-'+uploads+'"'}}
  };
  const azure={BlobServiceClient:{fromConnectionString(){return{getContainerClient(){return{getBlockBlobClient(){return blob}}}}}}};
  const access={
    body(req){return req.body||{}},json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},environment(_req,payload){return payload&&payload.environment||'testservice'},
    async issue(_req,type,record){assert.equal(type,'avis');const token=(++seq).toString(16).padStart(48,'0');issued.set(token,record);return{token,expiresAt:null,record}},
    async resolve(_req,type,token){assert.equal(type,'avis');const record=issued.get(token);if(!record){const e=new Error('not found');e.status=404;e.code='ACCESS_NOT_FOUND';throw e}return{environment:'testservice',record,tokenHash:'hash-'+token.slice(-4)}},
    async clearFailures(_env,_type,_hash){const token=[...issued.keys()][0];return{environment:'testservice',record:issued.get(token),tokenHash:'hash'}},
    issueSession(info){const session='session-'+(++seq);sessions.set(session,info.record);return{session,expiresAt:'2026-09-12T12:00:00.000Z'}},
    async resolveSession(session,type){assert.equal(type,'avis');const record=sessions.get(session);if(!record){const e=new Error('session missing');e.status=401;throw e}return{environment:'testservice',record}},
    async registerFailure(){return{failedAttempts:1,lockedUntil:null}},async revokeSubject(){return{ok:true}}
  };
  const auth={TEAM_CONTAINER:'exporthub-data',TEAM_BLOB:'team-state.json',async validateSession(){return{user:{name:'Avis Probe',rights:{shipment:{edit:true}}}}},hasAnyEditRight(){return true},error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e}};
  const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
  return{handler,shipment,ref,shipmentId,get stats(){return{downloads,downloadBytes,uploads,uploadBytes,currentBytes:teamBuffer.length}}};
}

async function timed(label,fn){const s=performance.now();const value=await fn();const ms=Math.round((performance.now()-s)*100)/100;console.log('AVIS_STAGE',JSON.stringify({label,ms}));return{value,ms}}

test('Vollständiger Lieferavis-Ablauf gegen 130-MB-Team-State',async()=>{
  const oldStorage=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='UseDevelopmentStorage=true';
  try{
    const h=makeHarness(130_000_000),startStats=h.stats;
    const issue=await timed('1_link_erzeugen',async()=>{const c=ctx();await h.handler(c,{method:'POST',headers:{host:'probe-testservice.azurestaticapps.net'},body:{action:'issue',shipmentId:h.shipmentId,reference:h.ref,environment:'testservice',shipmentSnapshot:h.shipment}});assert.equal(c.res.status,200);return bodyOf(c.res)});
    assert.equal(issue.value.issued,true);assert.ok(issue.value.url);assert.ok(issue.value.token);assert.equal(h.stats.downloads,0,'Link-Erzeugung darf keinen Team-State laden');

    const authz=await timed('2_link_autorisieren_referenz',async()=>{const c=ctx();await h.handler(c,{method:'POST',headers:{},body:{action:'authorize',token:issue.value.token,reference:h.ref,environment:'testservice'}});assert.equal(c.res.status,200);return bodyOf(c.res)});
    assert.ok(authz.value.session);const afterAuth=h.stats;assert.equal(afterAuth.downloads,1);

    const get=await timed('3_avis_daten_mit_session_laden',async()=>{const c=ctx();await h.handler(c,{method:'GET',headers:{'x-exporthub-avis-session':authz.value.session},query:{},body:{}});assert.equal(c.res.status,200);return bodyOf(c.res)});
    const afterGet=h.stats;assert.equal(afterGet.downloads,2);

    const appointment=await timed('4_abholtermin_speichern',async()=>{const c=ctx();await h.handler(c,{method:'POST',headers:{'x-exporthub-avis-session':authz.value.session},body:{action:'appointment',session:authz.value.session,pickupDate:'2026-09-15',timeFrom:'10:00',timeTo:'12:00',plate:'TEST-AV 1'}});assert.equal(c.res.status,200);return bodyOf(c.res)});
    const afterAppointment=h.stats;assert.equal(afterAppointment.downloads,3);assert.equal(afterAppointment.uploads,1);

    const document=await timed('5_dokument_oeffnen',async()=>{const c=ctx();await h.handler(c,{method:'GET',headers:{'x-exporthub-avis-session':authz.value.session},query:{action:'document',id:'LS-PERF',session:authz.value.session},body:{}});assert.equal(c.res.status,200);assert.equal(c.res.isRaw,true);return c.res});
    const final=h.stats;assert.equal(final.downloads,4);

    const mb=n=>Math.round(n/1024/1024*100)/100;
    console.log('AVIS_FULL_SUMMARY',JSON.stringify({teamStateMB:mb(startStats.currentBytes),issueMs:issue.ms,authorizeMs:authz.ms,sessionGetMs:get.ms,appointmentMs:appointment.ms,documentMs:document.ms,teamDownloads:final.downloads,totalDownloadedMB:mb(final.downloadBytes),teamUploads:final.uploads,totalUploadedMB:mb(final.uploadBytes),issueUsesTeamState:false,authorizeUsesTeamState:true,sessionGetUsesTeamState:true,appointmentUsesTeamState:true,documentUsesTeamState:true}));
  }finally{if(oldStorage===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=oldStorage}
});
