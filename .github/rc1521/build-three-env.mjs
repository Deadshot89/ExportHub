import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildTrainingCenter} from '../training-center/build-three-env.mjs';
import {integrateAbdProforma,ABD_PROFORMA_ASSETS,ABD_PROFORMA_MARKERS} from '../rc1549/integrate-abd-proforma.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');

export function build(root=ROOT){
  const out=buildTrainingCenter(root);
  integrateAbdProforma(root,out);
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    for(const marker of ABD_PROFORMA_MARKERS)if(!html.includes(marker))throw new Error(`${file}: RC1549 Proforma marker missing: ${marker}`);
  }
  for(const asset of ABD_PROFORMA_ASSETS)if(!fs.existsSync(path.join(out,asset)))throw new Error(`RC1549 Proforma asset missing: ${asset}`);
  const manifest={
    version:'RC1521',
    visibleRelease:'RC1112',
    currentMainBase:'.github/packmeldungen/build-three-env.mjs',
    trainingCenterBuilder:'.github/training-center/build-three-env.mjs',
    abdProforma:'RC1549',
    entries:['index.html','TESTVERSION.html','demo.html'],
    deployment:false
  };
  fs.writeFileSync(path.join(out,'rc1521-training-center-release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=build(ROOT);
  console.log(`RC1521 release candidate ready: ${path.relative(ROOT,out)} · current Main/Pack + Training Center`);
}
