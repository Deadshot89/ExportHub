import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1044');
const OUT=path.join(ROOT,'dist-rc1045');
const VERSION='RC1045';
const NUMBER='1045';

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=html.replace(/ExportHUB RC1044 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1044',cache:'1044',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)1044/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1044(['"])/g,`$1${VERSION}$2`);
  if(!html.includes('function shipmentDashboardOpenList()'))throw new Error(`${file}: RC1045 Dashboard-Filter für nicht abgeholte Sendungen fehlt`);
  if(!html.includes('function dashboardShipmentPickedUp(s)'))throw new Error(`${file}: RC1045 Kern-Dashboard erkennt Abholung nicht`);
  if(!html.includes("metric('Offene Sendungen',open.length,'kpi-orange','noch nicht abgeholt')"))throw new Error(`${file}: RC1045 Dashboard-Kachel ist fachlich nicht auf Abholung begrenzt`);
  if(!html.includes("function workspaceTaskDate(t){var keys=['dueDate','due','date','plannedDate','targetDate','deadline']"))throw new Error(`${file}: RC1045 fällige Aufgaben nutzen kein echtes Fälligkeitsdatum`);
  if(!html.includes('workspaceTaskForUser(t) && workspaceTaskVisible(t)'))throw new Error(`${file}: RC1045 persönlicher Aufgabenfilter fehlt`);
  if(!html.includes('.filter(taskForUser);'))throw new Error(`${file}: RC1045 Aufgaben-Dashboard fällt auf fremde Aufgaben zurück`);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(`${file}: BUILD ${VERSION} fehlt`);
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(`${file}: Environment ${VERSION} fehlt`);
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1044/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1044'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1045 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const previousManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1044-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1045-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1045-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1044',
  sourceManifest:previousManifest,
  compatibility:{
    qr:'stable-qr-v1',
    rule:'issued QR codes remain resolvable across later releases'
  },
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1045 build ready: QR-Bestandsschutz sowie korrekte offene Sendungen und fällige Aufgaben im Dashboard, Produktion/TESTSERVICE/Demo synchronisiert.');
