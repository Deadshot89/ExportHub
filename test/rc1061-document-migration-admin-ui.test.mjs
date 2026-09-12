import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function defaultBatch(){return{ok:true,found:76,migrated:5,skipped:0,failed:0,remaining:71,bytesMoved:1234,done:false}}

function loadRuntime({responses}={}){
  const code=fs.readFileSync(new URL('../assets/rc1061-document-migration-admin.js',import.meta.url),'utf8');
  const calls=[],queue=Array.isArray(responses)?responses.slice():[];
  const context={
    window:{ExportHUBClean:{runtime:{authToken:'TOKEN'},state:{}},__EXPORTHUB_GET_STATE__:()=>({currentUser:{}})},
    location:{hostname:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'},
    fetch:async(url,options)=>{
      calls.push({url,options});
      const next=queue.length?queue.shift():defaultBatch();
      if(next instanceof Error)throw next;
      return{ok:next&&next.httpOk!==false,status:next&&next.status||200,json:async()=>next&&next.body?next.body:next};
    },
    setTimeout:(fn)=>{fn();return 1},
    clearTimeout:()=>{},
    console
  };
  vm.createContext(context);vm.runInContext(code,context);
  return{api:context.window.ExportHUBRC1061DocumentMigrationAdmin,calls};
}

test('RC1061: Dokumentmigration wird nur globalen Admins angeboten',()=>{
  const {api}=loadRuntime();
  assert.equal(api.isAdmin({role:'admin'}),true);assert.equal(api.isAdmin({globalAdmin:true}),true);
  assert.equal(api.isAdmin({role:'Benutzer'}),false);assert.equal(api.isAdmin({rights:{settings:{admin:true}}}),false);
});

test('RC1066: jeder interne Migrationsaufruf bleibt exakt ein sicherer 5er-Batch in der aktuellen Umgebung',async()=>{
  const {api,calls}=loadRuntime();const result=await api.runBatch();assert.equal(result.migrated,5);assert.equal(calls.length,1);
  assert.equal(api.batchSize,5);
  assert.equal(calls[0].url,'/api/exporthub-document-migrate');assert.equal(calls[0].options.method,'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body),{environment:'testservice',limit:5});assert.equal(calls[0].options.headers.Authorization,'Bearer TOKEN');
});

test('RC1066: ein Klick verarbeitet alle verbleibenden Dokumente automatisch als fortlaufende 5er-Batches',async()=>{
  const responses=[
    {ok:true,found:12,migrated:5,skipped:0,failed:0,remaining:7,bytesMoved:100,done:false},
    {ok:true,found:7,migrated:5,skipped:5,failed:0,remaining:2,bytesMoved:120,done:false},
    {ok:true,found:2,migrated:2,skipped:10,failed:0,remaining:0,bytesMoved:80,done:true}
  ];
  const {api,calls}=loadRuntime({responses}),progress=[];
  const result=await api.runAll({waitMs:0,onProgress(_batch,total){progress.push(total)}});
  assert.equal(result.done,true);assert.equal(result.found,12);assert.equal(result.migrated,12);assert.equal(result.remaining,0);assert.equal(result.failed,0);assert.equal(result.bytesMoved,300);assert.equal(result.batches,3);
  assert.equal(calls.length,3);assert.deepEqual(progress.map(x=>x.migrated),[5,10,12]);assert.deepEqual(progress.map(x=>x.remaining),[7,2,0]);
  for(const call of calls)assert.deepEqual(JSON.parse(call.options.body),{environment:'testservice',limit:5});
});

test('RC1066: Automatik stoppt sofort nach einem Dokumentfehler und meldet den verbleibenden sicheren Stand',async()=>{
  const {api,calls}=loadRuntime({responses:[{ok:true,found:6,migrated:4,skipped:0,failed:1,remaining:2,bytesMoved:100,done:false}]});
  let error=null;try{await api.runAll({waitMs:0})}catch(e){error=e}
  assert.ok(error);assert.equal(error.code,'DOCUMENT_MIGRATION_BATCH_FAILED');assert.equal(error.result.migrated,4);assert.equal(error.result.failed,1);assert.equal(error.result.remaining,2);assert.equal(calls.length,1);
});

test('RC1066: Automatik verhindert Endlosschleifen wenn ein Batch trotz Restbestand keinen Fortschritt macht',async()=>{
  const {api,calls}=loadRuntime({responses:[{ok:true,found:3,migrated:0,skipped:0,failed:0,remaining:3,bytesMoved:0,done:false}]});
  let error=null;try{await api.runAll({waitMs:0})}catch(e){error=e}
  assert.ok(error);assert.equal(error.code,'DOCUMENT_MIGRATION_STALLED');assert.equal(error.result.remaining,3);assert.equal(calls.length,1);
});

test('RC1069: abgeschlossene Dokumentmigration bleibt als sichere API erhalten, aber verschwindet aus der normalen Admin-Oberfläche',()=>{
  const source=fs.readFileSync(new URL('../assets/rc1061-document-migration-admin.js',import.meta.url),'utf8');
  assert.match(source,/function ensureCard\(\)/);
  assert.match(source,/removeChild\(old\)/);
  assert.doesNotMatch(source,/Alle verbleibenden migrieren|Nach aktuellem Paket stoppen|rc1061MigrationProgress/);
  assert.match(source,/runAll:runAll/);
  assert.match(source,/batchSize:BATCH_SIZE/);
});

test('RC1061: Release-Vorbereitung hält die Admin-Steuerung ausschließlich an der finalen Build-Grenze',()=>{
  const prep=fs.readFileSync(new URL('../.github/rc1049/fix-mail-abd-gate.mjs',import.meta.url),'utf8');
  assert.match(prep,/\.github\/rc1048\/build-three-env\.mjs/);assert.match(prep,/exporthub-rc1061-document-migration-admin/);
  assert.match(prep,/assets\/rc1061-document-migration-admin\.js\?v=1066/);assert.match(prep,/for\(const file of \['index\.html','TESTVERSION\.html'\]\)/);
  assert.doesNotMatch(prep,/function injectAdminMigration\(/);assert.doesNotMatch(prep,/migrationInjected/);
});

test('RC1069: die temporäre RC1060-TESTSERVICE-Box bleibt aus der normalen Oberfläche entfernt',()=>{
  const legacy=fs.readFileSync(new URL('../assets/rc1059-document-blob.js',import.meta.url),'utf8');
  assert.doesNotMatch(legacy,/rc1060MigrationControl/);
  assert.doesNotMatch(legacy,/ExportHUBDocumentMigration1060/);
});
