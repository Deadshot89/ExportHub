import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}

const confirm=read('api/pickup-confirm-v2/index.js');
const backup=read('api/pod-backup/index.js');
const archive=read('api/shared/pod-archive.js');
const graph=read('api/shared/graph-drive.js');
const store=read('api/shared/pickup-store.js');
const reconcileApiPath='api/pod-backup-reconcile/index.js';
const reconcileApi=fs.existsSync(reconcileApiPath)?read(reconcileApiPath):'';
const reconcileWorkflowPath='.github/workflows/rc1144-pod-backup-reconcile.yml';
const reconcileWorkflow=fs.existsSync(reconcileWorkflowPath)?read(reconcileWorkflowPath):'';
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
  assert.match(confirm,/podArchiveSaved/);
  assert.match(confirm,/podDriveSaved/);
});

test('RC1220: Azure-Primärspeicher wird vor unveränderlicher Azure-Archivkopie geschrieben',()=>{
  const azure=archive.indexOf('await saveAzurePod(accessKey, environment, record, pdf)');
  const second=archive.indexOf('await saveAzureArchive(accessKey, environment, record, pdf, file)');
  const drive=archive.indexOf('await copyToDrive(accessKey, environment, record, pdf, file)');
  assert.ok(azure>=0,'Azure-Speicherung fehlt');
  assert.ok(second>azure,'Azure-Archivkopie muss nach dem Primärspeicher erfolgen');
  assert.ok(drive>second,'Optionales Microsoft 365 darf erst nach bestätigtem Azure-Archiv erfolgen');
  for(const marker of ["status: 'azure-saved'","status: 'saved'","archiveSaved: true","kind: 'automatic-pod'","kind: 'automatic-pod-archive'"]){
    assert.ok(archive.includes(marker),marker+' fehlt');
  }
});

test('RC1143: POD vorhanden wird erst bei echter herunterladbarer POD-Datei gesetzt',()=>{
  assert.match(store,/hasPodFile=realPodFiles\(record\)\.length>0/);
  assert.match(store,/sh\.status=hasPodFile\?'POD vorhanden':'Abgeholt'/);
  assert.match(store,/sh\.podAvailable=hasPodFile/);
  assert.match(store,/sh\.podConfirmed=hasPodFile/);
  assert.match(store,/sh\.podStatus=hasPodFile\?'POD vorhanden':'POD-Datei wird erstellt'/);
  assert.match(store,/function rc1017SubHasPod\(sub\)\{return!!\(sub&&Array\.isArray\(sub\.podFiles\)&&sub\.podFiles\.length>0\)\}/);
});

test('RC1164: Graph-Bereitschaft erkennt fehlende Konfiguration ohne Secret-Werte',()=>{
  assert.match(graph,/function readiness\(\)/);
  assert.match(graph,/configured:\s*missing\.length === 0/);
  assert.match(graph,/missing\.push\('EXPORTHUB_GRAPH_TENANT_ID'\)/);
  assert.match(graph,/missing\.push\('EXPORTHUB_GRAPH_CLIENT_ID'\)/);
  assert.match(graph,/missing\.push\('EXPORTHUB_GRAPH_CLIENT_SECRET'\)/);
  assert.match(graph,/missing\.push\('EXPORTHUB_POD_DRIVE_USER'\)/);
  assert.match(graph,/missing\.push\('EXPORTHUB_POD_FOLDER'\)/);
  assert.doesNotMatch(graph,/tobiaslimberg@essentra\.com/);
  assert.doesNotMatch(graph,/\|\|\s*['\"]003 Export\/ExportHub\/Abliefernachweise['\"]/);
  assert.match(graph,/module\.exports\s*=\s*\{\s*readiness,/);
});

test('RC1220: Reconcile bleibt ohne Microsoft Graph aktiv',()=>{
  assert.match(reconcileApi,/graphDrive\.readiness\(\)/);
  assert.doesNotMatch(reconcileApi,/code:\s*'GRAPH_NOT_CONFIGURED'/);
  assert.match(reconcileApi,/backupMode:\s*'azure-archive'/);
  const readinessIndex=reconcileApi.indexOf('graphDrive.readiness()');
  const reconcileIndex=reconcileApi.indexOf('podArchive.reconcilePendingBackups');
  assert.ok(readinessIndex>=0&&reconcileIndex>readinessIndex,'Graph-Status darf erfasst werden, aber den Azure-Reconcile nicht blockieren');
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
  assert.match(store,/podArchiveSaved:/);
  assert.match(store,/podDriveSaved:/);
});

test('RC1144: fehlgeschlagene POD-Backups werden dauerhaft serverseitig nachgeholt',()=>{
  assert.match(archive,/async function reconcilePendingBackups\(/);
  assert.match(archive,/listBlobsFlat\(\{\s*prefix\s*\}\)/);
  assert.match(archive,/await retryArchiveBackup\(/);
  assert.match(archive,/await store\.updateTeam\(/);
  assert.match(archive,/reconcilePendingBackups/);
});

test('RC1144: offene POD-Backups werden fair nach ältestem Versuch ausgewählt',()=>{
  assert.match(archive,/candidates\.sort\(/);
  assert.match(archive,/candidates\.slice\(0, limit\)/);
  assert.doesNotMatch(archive,/if \(candidates\.length >= limit\) break/);
});

test('RC1144: eigener OIDC-geschützter Wartungsendpunkt stößt offene POD-Backups erneut an',()=>{
  assert.ok(reconcileApi,'POD-Reconcile-API fehlt');
  assert.match(reconcileApi,/OIDC_AUDIENCE=['"]exporthub-pod-backup-reconcile['"]/);
  assert.match(reconcileApi,/WORKFLOW\s*=\s*['"]rc1144-pod-backup-reconcile\.yml['"]/);
  assert.match(reconcileApi,/podArchive\.reconcilePendingBackups\(/);
  assert.ok(reconcileApi.includes("['workflow_run','schedule','workflow_dispatch']"),'erlaubte Workflow-Ereignisse fehlen');
});

test('RC1144: POD-Nachholung läuft nach Deployments und zusätzlich alle 15 Minuten',()=>{
  assert.ok(reconcileWorkflow,'POD-Reconcile-Workflow fehlt');
  assert.match(reconcileWorkflow,/schedule:\s*\n\s*- cron:\s*['"]7,22,37,52 \* \* \* \*['"]/);
  assert.match(reconcileWorkflow,/POD-Backup-Nachholung TESTSERVICE/);
  assert.match(reconcileWorkflow,/POD-Backup-Nachholung PRODUCTION/);
  assert.match(reconcileWorkflow,/pod-backup-reconcile/);
});

test('RC1184: POD-Nachholung bleibt von fehlgeschlagenem Release entkoppelt',()=>{
  assert.match(reconcileWorkflow,/github\.event\.workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(reconcileWorkflow,/workflow_run\.conclusion == 'success'/);
  assert.match(reconcileWorkflow,/types:\s*\n\s*- completed/);
});

test('RC1114: öffentliche Abholseite wartet auf serverseitige Sicherung und zeigt Archivstatus',()=>{
  assert.match(pickup,/pickup-confirm-v2[^\n]{0,180}timeout:90000/);
  assert.match(pickup,/data&&data\.podAzureSaved/);
  assert.match(pickup,/data\.podArchiveSaved/);
});

test('RC1114: Server-PDF-Abhängigkeit und POD-Konfiguration sind Releasebestandteil',()=>{
  assert.equal(apiPackage.dependencies['pdf-lib'],'1.17.1');
  assert.equal(settings.Values.EXPORTHUB_POD_CONTAINER,'exporthub-pod');
  assert.equal(settings.Values.EXPORTHUB_POD_BACKUP_CONTAINER,'exporthub-pod-backup');
  assert.equal(settings.Values.EXPORTHUB_POD_M365_ENABLED,'false');
  assert.ok(settings.Values.EXPORTHUB_GRAPH_TENANT_ID);
  assert.ok(settings.Values.EXPORTHUB_GRAPH_CLIENT_ID);
  assert.ok(settings.Values.EXPORTHUB_GRAPH_CLIENT_SECRET);
});

test('RC1114: Drei-Umgebungen-Build übernimmt aktuelle POD-API',()=>{
  assert.match(build,/const currentApi=path\.join\(ROOT,'api'\),builtApi=path\.join\(OUT,'api'\)/);
  assert.match(build,/fs\.cpSync\(currentApi,builtApi,\{recursive:true,force:true\}\)/);
  assert.match(build,/shared\/pod-archive\.js/);
  assert.match(build,/podReliability:'RC1220 Azure primary \+ immutable Azure archive; M365 optional'/);
  assert.match(build,/podGraphReadiness:'RC1220 Graph optional; Azure archive is release-critical secondary backup'/);
});

test('RC1195: POD-Ziel muss explizit konfiguriert sein und darf nicht auf ein persönliches Laufwerk zurückfallen',()=>{
  assert.match(graph,/const user = text\(process\.env\.EXPORTHUB_POD_DRIVE_USER\);/);
  assert.match(graph,/const folder = text\(process\.env\.EXPORTHUB_POD_FOLDER\);/);
  assert.match(graph,/missing\.push\('EXPORTHUB_POD_DRIVE_USER'\)/);
  assert.match(graph,/missing\.push\('EXPORTHUB_POD_FOLDER'\)/);
  assert.doesNotMatch(graph,/@essentra\.com/);
});
