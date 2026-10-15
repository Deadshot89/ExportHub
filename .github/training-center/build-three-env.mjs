import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildPack} from '../packmeldungen/build-three-env.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const ENTRIES=Object.freeze(['index.html','TESTVERSION.html','demo.html']);
const SOURCE_DIR='assets/training-center';
const RETIRED_ASSET_SEGMENTS=Object.freeze(['assets','sop']);

const REQUIRED_ASSETS=Object.freeze([
  'model.js',
  'store.js',
  'i18n.js',
  'customer-sop.js',
  'screenshots.js',
  'coverage-registry.js',
  'coverage.js',
  'coverage-dashboard.js',
  'catalog/shipment-registration.js',
  'catalog/dhl-express.js',
  'training-state.js',
  'demo-adapter.js',
  'training-write-guard.js',
  'training-controller.js',
  'target-registry.js',
  'integration/shipment-targets.js',
  'tour-engine.js',
  'tour-ui.js',
  'scenarios/first-shipment.js',
  'legacy-cleanup.js',
  'ui.js',
  'runtime.js',
  'ui.css',
  'tour.css'
]);

const STYLE_TAGS=Object.freeze([
  '<link id="exporthub-training-center-style" rel="stylesheet" href="/assets/training-center/ui.css?v=1">',
  '<link id="exporthub-training-tour-style" rel="stylesheet" href="/assets/training-center/tour.css?v=1">'
]);
const SCRIPT_TAGS=Object.freeze([
  '<script id="exporthub-training-center-model" defer src="/assets/training-center/model.js?v=1"></script>',
  '<script id="exporthub-training-center-store" defer src="/assets/training-center/store.js?v=1"></script>',
  '<script id="exporthub-training-center-i18n" defer src="/assets/training-center/i18n.js?v=1"></script>',
  '<script id="exporthub-training-center-customer-sop" defer src="/assets/training-center/customer-sop.js?v=1"></script>',
  '<script id="exporthub-training-center-screenshots" defer src="/assets/training-center/screenshots.js?v=1"></script>',
  '<script id="exporthub-training-coverage-registry" defer src="/assets/training-center/coverage-registry.js?v=1"></script>',
  '<script id="exporthub-training-coverage" defer src="/assets/training-center/coverage.js?v=1"></script>',
  '<script id="exporthub-training-coverage-dashboard" defer src="/assets/training-center/coverage-dashboard.js?v=1"></script>',
  '<script id="exporthub-training-center-shipment-sop" defer src="/assets/training-center/catalog/shipment-registration.js?v=1"></script>',
  '<script id="exporthub-training-center-dhl-express" defer src="/assets/training-center/catalog/dhl-express.js?v=1"></script>',
  '<script id="exporthub-training-state" defer src="/assets/training-center/training-state.js?v=1"></script>',
  '<script id="exporthub-training-demo-adapter" defer src="/assets/training-center/demo-adapter.js?v=1"></script>',
  '<script id="exporthub-training-write-guard" defer src="/assets/training-center/training-write-guard.js?v=1"></script>',
  '<script id="exporthub-training-controller" defer src="/assets/training-center/training-controller.js?v=1"></script>',
  '<script id="exporthub-training-target-registry" defer src="/assets/training-center/target-registry.js?v=1"></script>',
  '<script id="exporthub-training-shipment-targets" defer src="/assets/training-center/integration/shipment-targets.js?v=1"></script>',
  '<script id="exporthub-training-tour-engine" defer src="/assets/training-center/tour-engine.js?v=1"></script>',
  '<script id="exporthub-training-tour-ui" defer src="/assets/training-center/tour-ui.js?v=1"></script>',
  '<script id="exporthub-training-first-shipment" defer src="/assets/training-center/scenarios/first-shipment.js?v=1"></script>',
  '<script id="exporthub-training-legacy-cleanup" defer src="/assets/training-center/legacy-cleanup.js?v=1"></script>',
  '<script id="exporthub-training-center-ui" defer src="/assets/training-center/ui.js?v=1"></script>',
  '<script id="exporthub-training-center-runtime" defer src="/assets/training-center/runtime.js?v=1"></script>'
]);

function idOf(tag){return (tag.match(/\bid="([^"]+)"/)||[])[1]||'';}
function injectMissing(html,tags,file){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(`${file}: </head> fehlt`);
  const missing=tags.filter(tag=>{const id=idOf(tag);return id&&!out.includes(`id="${id}"`);});
  if(missing.length)out=out.replace(/<\/head>/i,`${missing.join('\n')}\n</head>`);
  return out;
}
function retiredAssetNeedle(){return `/${RETIRED_ASSET_SEGMENTS.join('/')}/`;}

export function assertNoRetiredSopReferences(html,file='index.html'){
  const source=String(html||'');
  if(source.includes(retiredAssetNeedle()))throw new Error(`${file}: retired SOP asset reference detected`);
  return true;
}

export function injectTrainingCenter(html,file='index.html'){
  assertNoRetiredSopReferences(html,file);
  let out=injectMissing(html,STYLE_TAGS,file);
  out=injectMissing(out,SCRIPT_TAGS,file);
  assertNoRetiredSopReferences(out,file);
  return out;
}

function copyTrainingCenter(root,out){
  const source=path.join(root,SOURCE_DIR);
  const target=path.join(out,SOURCE_DIR);
  if(!fs.existsSync(source))throw new Error('Training-Center Quellverzeichnis fehlt');
  fs.rmSync(target,{recursive:true,force:true});
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.cpSync(source,target,{recursive:true,errorOnExist:false,force:true});
}

function assertPackage(out){
  for(const file of ENTRIES){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`Training-Center Build-Datei fehlt: ${file}`);
    const html=fs.readFileSync(target,'utf8');
    if(!html.includes('id="exporthub-training-center-runtime"'))throw new Error(`${file}: Training-Center Runtime fehlt`);
    if(!html.includes('id="exporthub-training-center-i18n"'))throw new Error(`${file}: Training-Center i18n fehlt`);
    if(!html.includes('id="exporthub-training-center-style"'))throw new Error(`${file}: Training-Center Styles fehlen`);
    if(!html.includes('id="exporthub-training-coverage-dashboard"'))throw new Error(`${file}: Training-Center Coverage fehlt`);
    assertNoRetiredSopReferences(html,file);
  }
  for(const rel of REQUIRED_ASSETS){
    const target=path.join(out,SOURCE_DIR,rel);
    if(!fs.existsSync(target))throw new Error(`Training-Center Build-Asset fehlt: ${rel}`);
  }
}

export function build(root=ROOT){
  const out=buildPack(root);
  copyTrainingCenter(root,out);
  for(const file of ENTRIES){
    const target=path.join(out,file);
    const current=fs.readFileSync(target,'utf8');
    const next=injectTrainingCenter(current,file);
    fs.writeFileSync(target,next);
  }
  assertPackage(out);
  const manifest={
    version:'TRAINING-CENTER-1',
    base:'.github/packmeldungen/build-three-env.mjs',
    namespace:SOURCE_DIR,
    entries:[...ENTRIES],
    retiredSopAssetsPresent:false,
    deployment:false
  };
  fs.writeFileSync(path.join(out,'training-center-release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=build(ROOT);
  console.log(`Training Center release package ready: ${path.relative(ROOT,out)}`);
}
