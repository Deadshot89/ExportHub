import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadRuntime(){
  const code=fs.readFileSync(new URL('../assets/rc1061-document-migration-admin.js',import.meta.url),'utf8');
  const calls=[];
  const context={
    window:{
      ExportHUBClean:{runtime:{authToken:'TOKEN'},state:{}},
      __EXPORTHUB_GET_STATE__:()=>({currentUser:{}})
    },
    location:{hostname:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'},
    fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>({ok:true,found:76,migrated:5,skipped:0,failed:0,remaining:71,bytesMoved:1234,done:false})}},
    console
  };
  vm.createContext(context);
  vm.runInContext(code,context);
  return {api:context.window.ExportHUBRC1061DocumentMigrationAdmin,calls};
}

test('RC1061: Dokumentmigration wird nur globalen Admins angeboten',()=>{
  const {api}=loadRuntime();
  assert.equal(api.isAdmin({role:'admin'}),true);
  assert.equal(api.isAdmin({globalAdmin:true}),true);
  assert.equal(api.isAdmin({role:'Benutzer'}),false);
  assert.equal(api.isAdmin({rights:{settings:{admin:true}}}),false);
});

test('RC1061: jeder UI-Migrationslauf sendet exakt ein 5er-Batch in die aktuelle Umgebung',async()=>{
  const {api,calls}=loadRuntime();
  const result=await api.runBatch();
  assert.equal(result.migrated,5);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/api/exporthub-document-migrate');
  assert.equal(calls[0].options.method,'POST');
  const body=JSON.parse(calls[0].options.body);
  assert.deepEqual(body,{environment:'testservice',limit:5});
  assert.equal(calls[0].options.headers.Authorization,'Bearer TOKEN');
});

test('RC1061: finaler Drei-Umgebungen-Build lädt die Admin-Steuerung nur in Produktion und TESTSERVICE',()=>{
  const build=fs.readFileSync(new URL('../.github/rc1048/build-three-env.mjs',import.meta.url),'utf8');
  assert.match(build,/exporthub-rc1061-document-migration-admin/);
  assert.match(build,/assets\/rc1061-document-migration-admin\.js/);
  assert.match(build,/\['index\.html','TESTVERSION\.html'\]/);
  assert.doesNotMatch(build,/\['index\.html','TESTVERSION\.html','demo\.html'\][\s\S]{0,250}rc1061-document-migration-admin/);
});
