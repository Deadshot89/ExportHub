import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const https=require('https');
const modulePath=require.resolve('../api/shared/graph-drive.js');
const PDF=Buffer.from('%PDF-1.4\nRC1750 POD\n%%EOF');

function setEnv(extra={}){
  process.env.EXPORTHUB_GRAPH_TENANT_ID='tenant-test';
  process.env.EXPORTHUB_GRAPH_CLIENT_ID='client-test';
  process.env.EXPORTHUB_GRAPH_CLIENT_SECRET='secret-test';
  process.env.EXPORTHUB_POD_DRIVE_USER='pod-user@essentra.com';
  process.env.EXPORTHUB_POD_FOLDER='003 Export/ExportHub/Abliefernachweise';
  for(const k of ['EXPORTHUB_POD_DRIVE_ID','EXPORTHUB_POD_FOLDER_ID','EXPORTHUB_REFERENCE_DRIVE_ID','EXPORTHUB_REFERENCE_FOLDER_ID','EXPORTHUB_REFERENCE_DRIVE_USER','EXPORTHUB_REFERENCE_FOLDER'])delete process.env[k];
  Object.assign(process.env,extra);
}
function fresh(){delete require.cache[modulePath];return require(modulePath)}

async function withFakeHttps(handler,fn){
  const original=https.request,calls=[];
  https.request=(options,callback)=>{
    const req=new EventEmitter(),chunks=[];
    req.write=chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
    req.destroy=error=>queueMicrotask(()=>req.emit('error',error));
    req.end=()=>{
      const call={method:String(options.method||'GET'),hostname:String(options.hostname||''),path:decodeURIComponent(String(options.path||'')),body:Buffer.concat(chunks)};
      calls.push(call);
      Promise.resolve().then(()=>handler(call)).then(result=>{
        const res=new EventEmitter();res.statusCode=Number(result&&result.status||200);res.headers=result&&result.headers||{};callback(res);
        const body=result&&Object.prototype.hasOwnProperty.call(result,'body')?result.body:{};
        const raw=Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
        if(raw.length)res.emit('data',raw);res.emit('end');
      }).catch(error=>req.emit('error',error));
    };
    return req;
  };
  try{return await fn(calls)}finally{https.request=original}
}
const notFound={status:404,body:{error:{code:'itemNotFound',message:'not found'}}};
const token={status:200,body:{access_token:'token-test',expires_in:3600}};

// The configured POD user drive is unreachable (live situation of issue #999).
function brokenPodDrive(call){
  if(call.hostname==='login.microsoftonline.com')return token;
  if(call.path.includes('/users/pod-user@essentra.com')||call.path.includes('/shares/')||call.path.includes('/sites/'))return notFound;
  return null;
}
const stored={};
function sharepoint(call,{folderExists=true}={}){
  if(call.method==='GET'&&call.path.startsWith('/v1.0/drives/ref-drive/items/ref-root?'))
    return{status:200,body:{id:'ref-root',folder:{},parentReference:{id:'exporthub-folder',driveId:'ref-drive'}}};
  if(call.method==='GET'&&call.path.startsWith('/v1.0/drives/ref-drive/items/exporthub-folder:/Abliefernachweise?'))
    return folderExists?{status:200,body:{id:'pod-folder',name:'Abliefernachweise',folder:{},parentReference:{id:'exporthub-folder',driveId:'ref-drive'}}}:notFound;
  if(call.method==='GET'&&call.path.startsWith('/v1.0/drives/ref-drive/items/exporthub-folder:/'))return notFound;
  if(call.method==='PUT'&&call.path.startsWith('/v1.0/drives/ref-drive/items/pod-folder:/')){
    const name=call.path.split(':/')[1];stored.bytes=call.body;
    return{status:201,body:{id:'pod-item',name,size:call.body.length,webUrl:'https://essentra.sharepoint.com/x'}};
  }
  if(call.method==='GET'&&call.path==='/v1.0/drives/ref-drive/items/pod-item/content')return{status:200,body:stored.bytes};
  return null;
}

test('RC1750: Produktion speichert POD im vorhandenen Ordner Abliefernachweise neben der REF-Ablage und bestätigt SHA-256',async()=>{
  setEnv({EXPORTHUB_REFERENCE_DRIVE_ID:'ref-drive',EXPORTHUB_REFERENCE_FOLDER_ID:'ref-root'});
  const graph=fresh();
  await withFakeHttps(call=>brokenPodDrive(call)||sharepoint(call)||notFound,async calls=>{
    const result=await graph.uploadPdf(PDF,'POD_ABC123.pdf',{environment:'production'});
    assert.equal(result.target,'reference-library');
    assert.equal(result.driveId,'ref-drive');
    assert.equal(result.id,'pod-item');
    const verified=await graph.verifyPdf(PDF,result);
    assert.equal(verified.hash,crypto.createHash('sha256').update(PDF).digest('hex'));
    assert.ok(!calls.some(c=>c.method==='POST'&&c.hostname==='graph.microsoft.com'),'Ordner darf nie angelegt werden');
    assert.equal(calls.filter(c=>c.method==='PUT'&&c.path.includes('/ref-drive/')).length,1);
  });
});

test('RC1750: fehlt der Ordner Abliefernachweise, wird nichts angelegt und die Kopie bleibt offen',async()=>{
  setEnv({EXPORTHUB_REFERENCE_DRIVE_ID:'ref-drive',EXPORTHUB_REFERENCE_FOLDER_ID:'ref-root'});
  const graph=fresh();
  await withFakeHttps(call=>brokenPodDrive(call)||sharepoint(call,{folderExists:false})||notFound,async calls=>{
    await assert.rejects(graph.uploadPdf(PDF,'POD_ABC123.pdf',{environment:'production'}),error=>{
      assert.equal(error.referenceFallbackCode,'GRAPH_REFERENCE_FALLBACK_FOLDER_MISSING');return true;
    });
    assert.ok(!calls.some(c=>c.method==='POST'&&c.hostname==='graph.microsoft.com'));
    assert.ok(!calls.some(c=>c.method==='PUT'&&c.path.includes('/ref-drive/')));
  });
});

test('RC1750: TESTSERVICE schreibt nie in die produktive REF-Ablage',async()=>{
  setEnv({EXPORTHUB_REFERENCE_DRIVE_ID:'ref-drive',EXPORTHUB_REFERENCE_FOLDER_ID:'ref-root'});
  const graph=fresh();
  await withFakeHttps(call=>brokenPodDrive(call)||sharepoint(call)||notFound,async calls=>{
    await assert.rejects(graph.uploadPdf(PDF,'POD_ABC123.pdf',{environment:'testservice'}));
    assert.ok(!calls.some(c=>c.path.includes('/ref-drive/')));
  });
});

test('RC1750: explizit gesetzte POD-Drive-/Ordner-IDs haben Vorrang, kein Ausweichen',async()=>{
  setEnv({EXPORTHUB_POD_DRIVE_ID:'pod-drive',EXPORTHUB_POD_FOLDER_ID:'pod-folder-x',EXPORTHUB_REFERENCE_DRIVE_ID:'ref-drive',EXPORTHUB_REFERENCE_FOLDER_ID:'ref-root'});
  const graph=fresh();
  await withFakeHttps(call=>call.hostname==='login.microsoftonline.com'?token:(sharepoint(call)&&call.path.includes('/ref-drive/')?sharepoint(call):notFound),async calls=>{
    await assert.rejects(graph.uploadPdf(PDF,'POD_ABC123.pdf',{environment:'production'}));
    assert.ok(!calls.some(c=>c.path.includes('/ref-drive/')));
  });
});

test('RC1750: REF-Ablage im Benutzerlaufwerk (ohne IDs) nutzt 003 Export/ExportHub/Abliefernachweise',async()=>{
  setEnv({EXPORTHUB_REFERENCE_DRIVE_USER:'export@essentra.com'});
  const graph=fresh();
  await withFakeHttps(call=>{
    const broken=brokenPodDrive(call);if(broken)return broken;
    if(call.method==='GET'&&call.path.startsWith('/v1.0/users/export@essentra.com/drive/root:/003 Export/ExportHub/Abliefernachweise?'))
      return{status:200,body:{id:'user-pod-folder',name:'Abliefernachweise',folder:{},parentReference:{driveId:'user-drive'}}};
    if(call.method==='PUT'&&call.path.startsWith('/v1.0/drives/user-drive/items/user-pod-folder:/'))
      return{status:201,body:{id:'item-2',name:call.path.split(':/')[1],size:call.body.length}};
    return notFound;
  },async()=>{
    const result=await graph.uploadPdf(PDF,'POD_XYZ789.pdf',{environment:'production'});
    assert.equal(result.driveId,'user-drive');
    assert.equal(result.folder,'003 Export/ExportHub/Abliefernachweise');
  });
});

test('RC1750: Diagnose meldet den lesbaren Ausweichordner ohne IDs oder Pfade preiszugeben',async()=>{
  setEnv({EXPORTHUB_REFERENCE_DRIVE_ID:'ref-drive',EXPORTHUB_REFERENCE_FOLDER_ID:'ref-root'});
  const graph=fresh();
  await withFakeHttps(call=>brokenPodDrive(call)||sharepoint(call)||notFound,async calls=>{
    const result=await graph.diagnoseTarget({environment:'production'});
    assert.equal(result.ok,true);
    assert.equal(result.code,'GRAPH_DIAGNOSTIC_REFERENCE_FALLBACK_READABLE');
    assert.ok(!JSON.stringify(result).includes('ref-drive'));
    assert.ok(!calls.some(c=>c.method!=='GET'&&c.hostname==='graph.microsoft.com'),'Diagnose bleibt read-only');
  });
});

test('RC1750: Kopie im Ausweichordner wird nur nach Rücklesen mit gleichem SHA-256 als gesichert übernommen',()=>{
  const fs=require('fs');
  const archive=fs.readFileSync(require.resolve('../api/shared/pod-archive.js'),'utf8');
  assert.match(archive,/graphDrive\.uploadPdf\(pdf,[^\n]*\{ environment \}\)/);
  assert.match(archive,/graphDrive\.verifyPdf\(pdf, result\)/);
});
