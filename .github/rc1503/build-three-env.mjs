import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildRc1502} from '../rc1502/build-three-env.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const OUT=path.join(ROOT,'dist-rc1112');

export const RC1503_TRAINING_ASSETS=Object.freeze([
  'assets/sop/rc1503-sop-training.js',
  'assets/sop/rc1503-sop-training.css',
  'assets/sop/rc1503-sop-exam.js',
  'assets/sop/rc1503-sop-exam.css',
  'assets/sop/rc1503-sop-progress.js'
]);

const TRAINING_STYLE_TAG='<link id="exporthub-rc1503-sop-training-style" rel="stylesheet" href="/assets/sop/rc1503-sop-training.css?v=1503">';
const EXAM_STYLE_TAG='<link id="exporthub-rc1503-sop-exam-style" rel="stylesheet" href="/assets/sop/rc1503-sop-exam.css?v=1503">';
const TRAINING_TAG='<script id="exporthub-rc1503-sop-training" defer src="/assets/sop/rc1503-sop-training.js?v=1503"></script>';
const EXAM_TAG='<script id="exporthub-rc1503-sop-exam" defer src="/assets/sop/rc1503-sop-exam.js?v=1503"></script>';
const PROGRESS_TAG='<script id="exporthub-rc1503-sop-progress" defer src="/assets/sop/rc1503-sop-progress.js?v=1503"></script>';
const RUNTIME_ID='exporthub-rc1501-sop-tour-runtime';

function injectTraining(html,file){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(`${file}: </head> fehlt`);
  if(!out.includes(`id="${RUNTIME_ID}"`))throw new Error(`${file}: RC1501 Tour-Runtime fehlt`);
  if(!out.includes('id="exporthub-rc1503-sop-training-style"'))out=out.replace(/<\/head>/i,`${TRAINING_STYLE_TAG}\n</head>`);
  if(!out.includes('id="exporthub-rc1503-sop-exam-style"'))out=out.replace(/<\/head>/i,`${EXAM_STYLE_TAG}\n</head>`);

  const runtimeRx=/(<script\s+id=["']exporthub-rc1501-sop-tour-runtime["'][^>]*><\/script>)/i;
  if(!runtimeRx.test(out))throw new Error(`${file}: RC1501 Tour-Runtime-Tag nicht eindeutig injizierbar`);
  const scripts=[];
  if(!out.includes('id="exporthub-rc1503-sop-training"'))scripts.push(TRAINING_TAG);
  if(!out.includes('id="exporthub-rc1503-sop-exam"'))scripts.push(EXAM_TAG);
  if(!out.includes('id="exporthub-rc1503-sop-progress"'))scripts.push(PROGRESS_TAG);
  if(scripts.length)out=out.replace(runtimeRx,`${scripts.join('\n')}\n$1`);

  for(const id of [
    'exporthub-rc1503-sop-training-style',
    'exporthub-rc1503-sop-exam-style',
    'exporthub-rc1503-sop-training',
    'exporthub-rc1503-sop-exam',
    'exporthub-rc1503-sop-progress'
  ]){
    const count=out.split(`id="${id}"`).length-1;
    if(count!==1)throw new Error(`${file}: RC1503 Tag ${id} ${count}x gefunden`);
  }
  const training=out.indexOf('id="exporthub-rc1503-sop-training"');
  const exam=out.indexOf('id="exporthub-rc1503-sop-exam"');
  const progress=out.indexOf('id="exporthub-rc1503-sop-progress"');
  const runtime=out.indexOf(`id="${RUNTIME_ID}"`);
  if(training<0||exam<0||progress<0||runtime<=training||runtime<=exam||runtime<=progress)throw new Error(`${file}: Training, Exam und Progress müssen vor der Tour-Runtime geladen werden`);
  return out;
}

export function integrateTraining(root=ROOT,out=OUT){
  for(const rel of RC1503_TRAINING_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1503 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1503 Build-Datei fehlt: ${file}`);
    fs.writeFileSync(target,injectTraining(fs.readFileSync(target,'utf8'),file));
  }
  const manifest={
    version:'RC1503',
    baseBuilder:'.github/rc1502/build-three-env.mjs',
    assets:RC1503_TRAINING_ASSETS.slice(),
    entries:['index.html','TESTVERSION.html','demo.html'],
    trainingEnvironment:'demo-only',
    examEnvironment:'demo-only',
    productiveEffects:'simulation-only',
    trainingBeforeTourRuntime:true,
    examBeforeTourRuntime:true,
    progressBeforeTourRuntime:true
  };
  fs.writeFileSync(path.join(out,'rc1503-sop-training-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

export function build(root=ROOT){
  buildRc1502(root);
  return integrateTraining(root,path.join(root,'dist-rc1112'));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build(ROOT);
