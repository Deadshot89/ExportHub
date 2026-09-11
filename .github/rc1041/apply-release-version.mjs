import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'dist-rc1018');
const VERSION='RC1041';
const NUMBER='1041';

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=html.replace(/ExportHUB RC1018 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1018',cache:'1018',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)\d+/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1018(['"])/g,`$1${VERSION}$2`);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(`${file}: sichtbare BUILD-Version ${VERSION} fehlt`);
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(`${file}: Environment-Marker ${VERSION} fehlt`);
  fs.writeFileSync(target,html);
}

for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC\d+'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('production-version.js: RC1041-Probe fehlt');
fs.writeFileSync(probeFile,probe);

const manifestFile=path.join(OUT,'rc1041-release.json');
fs.writeFileSync(manifestFile,JSON.stringify({
  schema:'exporthub-visible-release-v1',
  version:VERSION,
  buildBase:'RC1018',
  preservesHistoricalBase:true,
  environments:['production','testservice','demo']
},null,2)+'\n');

console.log(`${VERSION} visible release applied on RC1018 base for production, TESTSERVICE and demo.`);
