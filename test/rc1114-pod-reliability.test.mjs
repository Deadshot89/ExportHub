import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}

const confirm=read('api/pickup-confirm-v2/index.js');
const backup=read('api/pod-backup/index.js');
const archive=read('api/shared/pod-archive.js');
const graph=read('api/shared/graph-drive.js');
const store=read('api/shared/pickup-store.js');
const pickup=read('pickup.html');
const apiPackage=JSON.parse(read('api/package.json'));
const build=read('.github/rc1112/build-three-env.mjs');
const settings=JSON.parse(read('api/local.settings.example.json'));

test('RC1114: POD-Backup nutzt stabilen resourceKey statt ausschließlich Token-Hash',()=>{
  assert.match(backup,/resolved\.resourceKey\s*\|\|\s*resolved\.tokenHash/);
  assert.match(confirm,/resolved\.resourceKey\s*\|\|\s*resolved\.tokenHash/);
});

test('RC1114: vollständige Abholung startet serverseitige POD-Archivierung',()=>{
  assert.match(confirm,/require\('\.\.\/shared\/pod-archive'\)/);
  assert.match(confirm,/ensureAutomaticPod\(accessKey,resolved\.environment,\{copyToDrive:true\}\)/);
  assert.match(confirm,/podAzureSaved/);
  assert.match(confirm,/podDriveSaved/);
});

test('RC1114: Azure ist primäre POD-Sicherung vor Microsoft 365',()=>{
  const azure=archive.indexOf('await saveAzurePod(accessKey, environment, record, pdf)');
  const drive=archive.indexOf('await copyToDrive(accessKey, environment, record, pdf, file)');
  assert.ok(azure>=0,'Azure-Speicherung fehlt');
  assert.ok(drive>azure,'Microsoft-365-Kopie darf erst nach Azure-Speicherung erfolgen');
  for(const marker of ["status: 'azure-saved'","status: 'pending'","status: 'saved'","kind: 'automatic-pod'"]){
    assert.ok(archive.includes(marker),marker+' fehlt');
  }
});

test('RC1143: POD vorhanden wird erst bei echter herunterladbarer POD-Datei gesetzt',()=>{
  assert.match(store,/const hasPodFile=realPodFiles\(record\)\.length>0/);
  assert.match(store,/sh\.status=hasPodFile\?'POD vorhanden':'Abgeholt'/);
  assert.match(store,/sh\.podAvailable=hasPodFile/);
  assert.match(store,/sh\.podConfirmed=hasPodFile/);
  assert.match(store,/sh\.podStatus=hasPodFile\?'POD vorhanden':'POD-Datei wird erstellt'/);
  assert.match(store,/function rc1017SubHasPod\(sub\)\{return!!\(sub&&Array\.isArray\(sub\.podFiles\)&&sub\.podFiles\.length>0\)\}/);
});

test('RC1114: Graph-Upload wiederholt temporäre Fehler',()=>{
  assert.match(graph,/for \(let attempt = 1; attempt <= 3; attempt\+\+\)/);
  assert.match(graph,/status === 429/);
  assert.match(graph,/status === 503/);
  assert.match(graph,/GRAPH_TIMEOUT/);
  assert.match(graph,/retry-after/);
});

test('RC1114: POD-Sicherungsstatus wird in Team-State und öffentliche Statusantwort gespiegelt',()=>{
  assert.match(store,/function podBackupSummary\(/);
  assert.match(store,/sh\.podBackup=podBackupSummary\(record\)/);
  assert.match(store,/podBackupStatus:/);
  assert.match(store,/podAzureSaved:/);
  assert.match(store,/podDriveSaved:/);
});

test('RC1114: öffentliche Abholseite wartet auf serverseitige Sicherung und zeigt Archivstatus',()=>{
  assert.match(pickup,/pickup-confirm-v2[^\n]{0,180}timeout:90000/);
  assert.match(pickup,/data&&data\.podAzureSaved/);
  assert.match(pickup,/data\.podDriveSaved/);
});

test('RC1114: Server-PDF-Abhängigkeit und POD-Konfiguration sind Releasebestandteil',()=>{
  assert.equal(apiPackage.dependencies['pdf-lib'],'1.17.1');
  assert.equal(settings.Values.EXPORTHUB_POD_CONTAINER,'exporthub-pod');
  assert.ok(settings.Values.EXPORTHUB_GRAPH_TENANT_ID);
  assert.ok(settings.Values.EXPORTHUB_GRAPH_CLIENT_ID);
  assert.ok(settings.Values.EXPORTHUB_GRAPH_CLIENT_SECRET);
});

test('RC1114: Drei-Umgebungen-Build übernimmt aktuelle POD-API',()=>{
  assert.match(build,/const currentApi=path\.join\(ROOT,'api'\),builtApi=path\.join\(OUT,'api'\)/);
  assert.match(build,/fs\.cpSync\(currentApi,builtApi,\{recursive:true,force:true\}\)/);
  assert.match(build,/shared\/pod-archive\.js/);
  assert.match(build,/podReliability:'RC1114 server-side Azure primary \+ Microsoft 365 retry'/);
});