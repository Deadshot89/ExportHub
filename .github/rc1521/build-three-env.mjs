import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildPack} from '../packmeldungen/build-three-env.mjs';
import {integrateTour} from '../rc1501/build-three-env.mjs';
import {integrateEditor} from '../rc1502/build-three-env.mjs';
import {integrateTraining} from '../rc1503/build-three-env.mjs';
import {integrateCoverageAdmin} from '../rc1506/build-three-env.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');

const ENTRIES=['index.html','TESTVERSION.html','demo.html'];
const GUIDED_I18N_DATA='assets/sop/rc1544-sop-guided-i18n.json';
const GUIDED_ASSETS=[
  GUIDED_I18N_DATA,
  'assets/sop/rc1544-sop-guided-i18n.js',
  'assets/sop/rc1544-sop-guided-workspace.js',
  'assets/sop/rc1544-sop-guided-workspace.css'
];
const GUIDED_STYLE='<link id="exporthub-rc1544-sop-guided-workspace-style" rel="stylesheet" href="/assets/sop/rc1544-sop-guided-workspace.css?v=1544">';
const GUIDED_SCRIPTS=[
  '<script id="exporthub-rc1544-sop-guided-i18n" defer src="/assets/sop/rc1544-sop-guided-i18n.js?v=1544"></script>',
  '<script id="exporthub-rc1544-sop-guided-workspace" defer src="/assets/sop/rc1544-sop-guided-workspace.js?v=1544"></script>'
];
const REQUIRED_MARKERS=[
  'assets/rc1027-lieferavis-immediate.js?v=20261005',
  'exporthub-pack-notification-nav',
  'exporthub-rc1501-sop-tour-runtime',
  'exporthub-rc1502-sop-editor',
  'exporthub-rc1503-sop-training',
  'exporthub-rc1505-sop-function-registry',
  'exporthub-rc1506-sop-coverage-runtime',
  'exporthub-rc1544-sop-guided-workspace-style',
  'exporthub-rc1544-sop-guided-i18n-data',
  'exporthub-rc1544-sop-guided-i18n',
  'exporthub-rc1544-sop-guided-workspace'
];

function countId(html,id){return String(html||'').split(`id="${id}"`).length-1;}
function guidedDataTag(root){
  const source=path.join(root,GUIDED_I18N_DATA);
  if(!fs.existsSync(source))throw new Error(`RC1544 Pflicht-Asset fehlt: ${GUIDED_I18N_DATA}`);
  let parsed;
  try{parsed=JSON.parse(fs.readFileSync(source,'utf8'));}
  catch(error){throw new Error(`RC1544 Guided-i18n JSON ungültig: ${error&&error.message?error.message:error}`);}
  const safe=JSON.stringify(parsed).replace(/</g,'\\u003c');
  return `<script id="exporthub-rc1544-sop-guided-i18n-data" type="application/json">${safe}</script>`;
}
function integrateGuidedWorkspace(root,out){
  for(const rel of GUIDED_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1544 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }
  const dataTag=guidedDataTag(root);
  for(const file of ENTRIES){
    const target=path.join(out,file);if(!fs.existsSync(target))throw new Error(`RC1544 Build-Datei fehlt: ${file}`);
    let html=fs.readFileSync(target,'utf8');
    if(!html.includes('id="exporthub-rc1544-sop-guided-workspace-style"')){
      if(!/<\/head>/i.test(html))throw new Error(`RC1544 ${file}: </head> fehlt`);
      html=html.replace(/<\/head>/i,`${GUIDED_STYLE}\n</head>`);
    }
    const payload=[];
    if(!html.includes('id="exporthub-rc1544-sop-guided-i18n-data"'))payload.push(dataTag);
    for(const tag of GUIDED_SCRIPTS){
      const id=(tag.match(/id="([^"]+)"/)||[])[1];
      if(id&&!html.includes(`id="${id}"`))payload.push(tag);
    }
    if(payload.length){
      if(!/<\/body>/i.test(html))throw new Error(`RC1544 ${file}: </body> fehlt`);
      html=html.replace(/<\/body>/i,`${payload.join('\n')}\n</body>`);
    }
    for(const id of ['exporthub-rc1544-sop-guided-workspace-style','exporthub-rc1544-sop-guided-i18n-data','exporthub-rc1544-sop-guided-i18n','exporthub-rc1544-sop-guided-workspace']){
      if(countId(html,id)!==1)throw new Error(`RC1544 ${file}: ${id} muss genau einmal vorhanden sein`);
    }
    const data=html.indexOf('id="exporthub-rc1544-sop-guided-i18n-data"');
    const i18n=html.indexOf('id="exporthub-rc1544-sop-guided-i18n"');
    const workspace=html.indexOf('id="exporthub-rc1544-sop-guided-workspace"');
    if(data<0||i18n<=data||workspace<=i18n)throw new Error(`RC1544 ${file}: Reihenfolge muss Sprachdaten → Sprachmodul → Guided-Workspace sein`);
    fs.writeFileSync(target,html);
  }
}

function assertCombinedPackage(out){
  for(const file of ENTRIES){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1521 Build-Datei fehlt: ${file}`);
    const html=fs.readFileSync(target,'utf8');
    for(const marker of REQUIRED_MARKERS){
      if(!html.includes(marker))throw new Error(`RC1521 ${file}: Pflichtmarker fehlt: ${marker}`);
    }
  }

  for(const rel of [
    'assets/pack-notification-nav.js',
    'assets/sop/rc1501-sop-tour-runtime.js',
    'assets/sop/rc1502-sop-editor.js',
    'assets/sop/rc1503-sop-training.js',
    'assets/sop/rc1505-sop-function-registry.js',
    'assets/sop/rc1506-sop-coverage-runtime.js',
    ...GUIDED_ASSETS
  ]){
    if(!fs.existsSync(path.join(out,rel)))throw new Error(`RC1521 Build-Asset fehlt: ${rel}`);
  }
}

export function build(root=ROOT){
  const out=buildPack(root);
  integrateTour(root,out);
  integrateEditor(root,out);
  integrateTraining(root,out);
  integrateCoverageAdmin(root,out);
  integrateGuidedWorkspace(root,out);
  assertCombinedPackage(out);

  const manifest={
    version:'RC1521',
    visibleRelease:'RC1112',
    currentMainBase:'.github/packmeldungen/build-three-env.mjs',
    overlays:[
      '.github/rc1501/integrateTour',
      '.github/rc1502/integrateEditor',
      '.github/rc1503/integrateTraining',
      '.github/rc1506/integrateCoverageAdmin',
      'RC1544 guided SOP workspace'
    ],
    entries:ENTRIES.slice(),
    guidedWorkspace:'RC1544',
    deployment:false
  };
  fs.writeFileSync(path.join(out,'rc1521-sop-release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=build(ROOT);
  console.log(`RC1521 release candidate ready: ${path.relative(ROOT,out)} · current Main/Pack + SOPMaster + RC1544 Guided Workspace`);
}
