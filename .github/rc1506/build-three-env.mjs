import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildRc1503} from '../rc1503/build-three-env.mjs';
import {integrateShipmentRepairAccess} from '../rc1534/build-three-env.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const OUT=path.join(ROOT,'dist-rc1112');

export const RC1506_COVERAGE_ASSETS=Object.freeze([
  'assets/sop/rc1505-sop-function-registry.js',
  'assets/sop/rc1505-sop-coverage.js',
  'assets/sop/rc1506-sop-coverage-dashboard.js',
  'assets/sop/rc1506-sop-coverage-runtime.js',
  'assets/sop/rc1506-sop-coverage-dashboard.css'
]);

const STYLE_TAG='<link id="exporthub-rc1506-sop-coverage-dashboard-style" rel="stylesheet" href="/assets/sop/rc1506-sop-coverage-dashboard.css?v=1506">';
const SCRIPT_TAGS=[
  '<script id="exporthub-rc1505-sop-function-registry" defer src="/assets/sop/rc1505-sop-function-registry.js?v=1506"></script>',
  '<script id="exporthub-rc1505-sop-coverage" defer src="/assets/sop/rc1505-sop-coverage.js?v=1506"></script>',
  '<script id="exporthub-rc1506-sop-coverage-dashboard" defer src="/assets/sop/rc1506-sop-coverage-dashboard.js?v=1506"></script>',
  '<script id="exporthub-rc1506-sop-coverage-runtime" defer src="/assets/sop/rc1506-sop-coverage-runtime.js?v=1506"></script>'
];
const TOUR_RUNTIME_ID='exporthub-rc1501-sop-tour-runtime';

function tagId(tag){return (tag.match(/id="([^"]+)"/)||[])[1]||'';}
function countId(html,id){return String(html||'').split(`id="${id}"`).length-1;}

export function injectCoverageAdmin(html,file){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(`${file}: </head> fehlt`);
  if(!out.includes(`id="${TOUR_RUNTIME_ID}"`))throw new Error(`${file}: RC1501 Tour-Runtime fehlt`);

  if(!out.includes('id="exporthub-rc1506-sop-coverage-dashboard-style"')){
    out=out.replace(/<\/head>/i,`${STYLE_TAG}\n</head>`);
  }

  const runtimeRx=/(<script\s+id=["']exporthub-rc1501-sop-tour-runtime["'][^>]*><\/script>)/i;
  if(!runtimeRx.test(out))throw new Error(`${file}: RC1501 Tour-Runtime-Tag nicht eindeutig injizierbar`);
  const missing=SCRIPT_TAGS.filter(tag=>!out.includes(`id="${tagId(tag)}"`));
  if(missing.length)out=out.replace(runtimeRx,`${missing.join('\n')}\n$1`);

  for(const tag of [STYLE_TAG,...SCRIPT_TAGS]){
    const id=tagId(tag);const count=countId(out,id);
    if(count!==1)throw new Error(`${file}: RC1506 Tag ${id} ${count}x gefunden`);
  }

  const registry=out.indexOf('id="exporthub-rc1505-sop-function-registry"');
  const coverage=out.indexOf('id="exporthub-rc1505-sop-coverage"');
  const dashboard=out.indexOf('id="exporthub-rc1506-sop-coverage-dashboard"');
  const runtime=out.indexOf('id="exporthub-rc1506-sop-coverage-runtime"');
  if(registry<0||coverage<=registry)throw new Error(`${file}: RC1505 Registry muss vor Coverage geladen werden`);
  if(dashboard<=coverage)throw new Error(`${file}: RC1505 Coverage muss vor RC1506 Dashboard geladen werden`);
  if(runtime<=dashboard)throw new Error(`${file}: RC1506 Dashboard muss vor Runtime geladen werden`);
  return out;
}

export function integrateCoverageAdmin(root=ROOT,out=OUT){
  for(const rel of RC1506_COVERAGE_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1506 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }
  const entries=['index.html','TESTVERSION.html','demo.html'];
  for(const file of entries){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1506 Build-Datei fehlt: ${file}`);
    fs.writeFileSync(target,injectCoverageAdmin(fs.readFileSync(target,'utf8'),file));
  }
  const shipmentRepairAccess=integrateShipmentRepairAccess(root,out);
  const manifest={
    version:'RC1506',
    baseBuilder:'.github/rc1503/build-three-env.mjs',
    assets:RC1506_COVERAGE_ASSETS.slice(),
    entries,
    coverageMode:'static-metadata-by-default',
    dashboard:'admin-read-only',
    statusSource:'RC1505-only',
    customerFilter:'coverage-context-not-denominator',
    shipmentRepairAccess:shipmentRepairAccess&&shipmentRepairAccess.version||'RC1534',
    productionDeploy:false
  };
  fs.writeFileSync(path.join(out,'rc1506-sop-coverage-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

export function build(root=ROOT){
  buildRc1503(root);
  return integrateCoverageAdmin(root,path.join(root,'dist-rc1112'));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build(ROOT);
