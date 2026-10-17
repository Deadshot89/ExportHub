import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildPack} from '../packmeldungen/build-three-env.mjs';
import {integrateTour} from '../rc1501/build-three-env.mjs';
import {integrateEditor} from '../rc1502/build-three-env.mjs';
import {integrateTraining} from '../rc1503/build-three-env.mjs';
import {integrateCoverageAdmin} from '../rc1506/build-three-env.mjs';
import {GUIDED_ASSETS,GUIDED_MARKERS,integrateGuidedWorkspace} from '../rc1544/integrate-guided-workspace.mjs';
import {ABD_PROFORMA_ASSETS,ABD_PROFORMA_MARKERS,integrateAbdProforma} from '../rc1549/integrate-abd-proforma.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');

const ENTRIES=['index.html','TESTVERSION.html','demo.html'];
const REQUIRED_MARKERS=[
  'assets/rc1027-lieferavis-immediate.js?v=20261005',
  'exporthub-pack-notification-nav',
  'exporthub-rc1501-sop-tour-runtime',
  'exporthub-rc1502-sop-editor',
  'exporthub-rc1503-sop-training',
  'exporthub-rc1505-sop-function-registry',
  'exporthub-rc1506-sop-coverage-runtime',
  ...GUIDED_MARKERS,
  ...ABD_PROFORMA_MARKERS
];

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
    ...GUIDED_ASSETS,
    ...ABD_PROFORMA_ASSETS
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
  integrateAbdProforma(root,out);
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
      '.github/rc1544/integrateGuidedWorkspace',
      '.github/rc1549/integrateAbdProforma'
    ],
    entries:ENTRIES.slice(),
    guidedWorkspace:'RC1544',
    abdProforma:'RC1549',
    deployment:false
  };
  fs.writeFileSync(path.join(out,'rc1521-sop-release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=build(ROOT);
  console.log(`RC1521 release candidate ready: ${path.relative(ROOT,out)} · current Main/Pack + SOPMaster + RC1544 Guided Workspace + RC1549 ABD Proforma`);
}
