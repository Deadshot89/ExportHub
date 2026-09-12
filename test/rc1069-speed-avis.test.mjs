import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
const CLIENT=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
const MAIL=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
const API=fs.readFileSync('api/customer-avis/index.js','utf8');
const ACCESS=fs.readFileSync('api/shared/public-access-store.js','utf8');
const MIGRATION=fs.readFileSync('assets/rc1061-document-migration-admin.js','utf8');
const PERF=fs.readFileSync('assets/rc1069-performance.js','utf8');
const BUILDER=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const FIXER=fs.readFileSync('.github/rc1018/fix-mail-wording.mjs','utf8');

function loadCommonJs(relative,mocks){
  const absolute=path.resolve(relative),original=Module._load;
  Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

test('RC1069: abgeschlossene Dokumentmigration wird in der normalen ExportHUB-Oberfläche nicht mehr gerendert',()=>{
  const start=MIGRATION.indexOf('function ensureCard(){'),end=MIGRATION.indexOf('window.ExportHUBRC1061DocumentMigrationAdmin=',start);
  assert.ok(start>=0&&end>start);
  const block=MIGRATION.slice(start,end);
  assert.match(block,/rc1061DocumentMigrationAdmin/);
  assert.match(block,/removeChild\(old\)/);
  assert.match(block,/return false/);
  assert.doesNotMatch(block,/createElement\(['"]section['"]\)|MutationObserver|exporthub:ready/);
  assert.match(MIGRATION,/runAll:runAll/,'Recovery-/Migrations-API muss für Notfälle erhalten bleiben');
});

test('RC1069: Avis-Link wird im Sendungsentwurf ohne Kunden- oder Standortpflicht sofort ausstellbar',()=>{
  assert.match(CLIENT,/function shipmentViewActive\(/);
  assert.match(CLIENT,/function eligible\(sh\)\{return !!\(sh&&shipmentViewActive\(\)/);
  const eligible=CLIENT.slice(CLIENT.indexOf('function eligible('),CLIENT.indexOf('function draftSignature',CLIENT.indexOf('function eligible(')));
  assert.doesNotMatch(eligible,/customerName\(|selectedLocation\(/);
  const ensure=CLIENT.slice(CLIENT.indexOf('async function ensureCustomerAvis'),CLIENT.indexOf('async function coordinatedToggle'));
  assert.match(ensure,/ensureReference\(sh\)/);
  assert.match(ensure,/issueDraftAvis\(current\)/);
  assert.ok(ensure.indexOf('ensureReference(sh)')<ensure.indexOf('issueDraftAvis(current)'));
});

test('RC1069: aktive Avis-Seite erhält Draft-Eingaben inklusive Colli ohne normalen Team-State-Save',()=>{
  assert.match(CLIENT,/function draftRows\(/);
  assert.match(CLIENT,/out\.rows=rows/);
  assert.match(CLIENT,/action:'draft-sync'/);
  assert.match(CLIENT,/document\.addEventListener\('input'/);
  assert.match(CLIENT,/scheduleDraftRefresh\('draft-input',260\)/);
  assert.doesNotMatch(CLIENT,/persistShipment\(/,'RC1069 Fast-Draft darf keinen normalen Sendungsspeicher auslösen');
  assert.match(API,/action==='draft-sync'/);
  assert.match(API,/access\.updateSubjectSnapshot/);
  assert.match(API,/teamReadMs:0/);
  assert.match(API,/sanitizeDraftRows/);
  assert.match(ACCESS,/async function updateSubjectSnapshot/);
  assert.match(ACCESS,/legacyReissued/,'alte reissued Avis-Tokens müssen ihren Snapshot weiter aktualisieren können');
});

test('RC1069: Draft-Sync Endpoint aktualisiert Snapshot ohne Team-Blob zu lesen oder zu schreiben',async()=>{
  let blobTouched=0,received=null;
  const azure={BlobServiceClient:{fromConnectionString(){blobTouched++;throw new Error('Team storage must not be touched by draft-sync')}}};
  const access={
    body(req){return req.body||{}},
    json(status,body,headers={}){return{status,headers,body:JSON.stringify(body)}},
    environment(_req,payload){return payload&&payload.environment==='testservice'?'testservice':'production'},
    async updateSubjectSnapshot(_req,kind,subjectId,snapshot,actor,payload){received={kind,subjectId,snapshot,actor,payload};return{ok:true,updated:1,found:1}}
  };
  const auth={
    async validateSession(){return{user:{name:'Tester'}}},
    hasAnyEditRight(){return true},
    error(code,message,status){const e=new Error(message);e.code=code;e.status=status;return e},
    TEAM_CONTAINER:'exporthub-data',TEAM_BLOB:'team-state.json'
  };
  const handler=loadCommonJs('api/customer-avis/index.js',{'@azure/storage-blob':azure,'../shared/public-access-store':access,'../shared/fast-auth-store':auth});
  const context={log:{error(){}},res:null};
  await handler(context,{method:'POST',headers:{},body:{
    action:'draft-sync',shipmentId:'ABC123',reference:'ABC123',environment:'production',
    shipmentSnapshot:{reference:'ABC123',customerName:'Live Kunde',goodsDescription:'Plastic Parts',rows:[{type:'EURO Pal',count:2,weight:180,ldm:0.4}]}
  }});
  assert.equal(context.res.status,200);
  const body=JSON.parse(context.res.body);
  assert.equal(body.synced,true);
  assert.equal(body.updated,1);
  assert.equal(blobTouched,0);
  assert.equal(received.kind,'avis');
  assert.equal(received.subjectId,'ABC123');
  assert.equal(received.snapshot.customerName,'Live Kunde');
  assert.equal(received.snapshot.rows.length,1);
  assert.equal(received.snapshot.rows[0].count,2);
  assert.equal(received.snapshot.rows[0].weight,180);
});

test('RC1069: alter Speichern-Hinweis ist entfernt und Browser laden frischen Avis-Cache-Key',()=>{
  assert.doesNotMatch(MAIL,/Link wird beim ersten sicheren Speichern erstellt/);
  assert.match(MAIL,/Link wird sofort aus dem aktuellen Entwurf erstellt und während der Eingabe aktualisiert/);
  assert.match(FIXER,/rc1027-lieferavis-immediate\.js\?v=1069/);
  assert.doesNotMatch(FIXER,/rc1027-lieferavis-immediate\.js\?v=1052/);
});

test('RC1069: globale Suche rendert nicht mehr bei jedem einzelnen Tastendruck',()=>{
  assert.match(PERF,/SEARCH_DELAY=140/);
  assert.match(PERF,/__rc1069OriginalOnInput/);
  assert.match(PERF,/__rc1069DebouncedOnInput/);
  assert.match(PERF,/e&&e\.key==='Enter'/);
  assert.match(BUILDER,/rc1069-performance\.js\?v=1069/);
});

test('RC1069: häufige datenlastige Ansichten bleiben in einem größeren validierten Fast-View-Cache',()=>{
  assert.match(BUILDER,/fastViewMax=5/);
  assert.match(BUILDER,/view==='customers'/);
  assert.match(BUILDER,/view==='customerfolder'/);
  assert.match(BUILDER,/patchRc1069Performance/);
});
