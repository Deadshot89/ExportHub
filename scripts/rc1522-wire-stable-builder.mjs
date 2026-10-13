import fs from 'node:fs';

const file='.github/rc1112/build-three-env.mjs';
let source=fs.readFileSync(file,'utf8');

const importAnchor="import {execFileSync} from 'node:child_process';\n";
const imports="import {integrateTour} from '../rc1501/build-three-env.mjs';\nimport {integrateEditor} from '../rc1502/build-three-env.mjs';\nimport {integrateTraining} from '../rc1503/build-three-env.mjs';\nimport {integrateCoverageAdmin} from '../rc1506/build-three-env.mjs';\n";
const callAnchor="console.log('RC1112 build pipeline ready: sichtbare Produktversion '+VISIBLE_VERSION+' auf geprüfter RC1048-Basis, RC1194 sichere Kundenportal-Key-Diagnose aktiv.');";
const calls="// RC1522: SOPMaster is an additive layer of the stable RC1112 release build.\nintegrateTour(ROOT,OUT);\nintegrateEditor(ROOT,OUT);\nintegrateTraining(ROOT,OUT);\nintegrateCoverageAdmin(ROOT,OUT);\n\n";

function count(needle){return source.split(needle).length-1}

if(!source.includes("integrateTour} from '../rc1501/build-three-env.mjs'")){
  if(count(importAnchor)!==1)throw new Error(`RC1522 import anchor must occur exactly once, got ${count(importAnchor)}`);
  source=source.replace(importAnchor,importAnchor+imports);
}
if(!source.includes('integrateTour(ROOT,OUT);')){
  if(count(callAnchor)!==1)throw new Error(`RC1522 call anchor must occur exactly once, got ${count(callAnchor)}`);
  source=source.replace(callAnchor,calls+callAnchor);
}

for(const marker of [
  "integrateTour} from '../rc1501/build-three-env.mjs'",
  "integrateEditor} from '../rc1502/build-three-env.mjs'",
  "integrateTraining} from '../rc1503/build-three-env.mjs'",
  "integrateCoverageAdmin} from '../rc1506/build-three-env.mjs'",
  'integrateTour(ROOT,OUT);',
  'integrateEditor(ROOT,OUT);',
  'integrateTraining(ROOT,OUT);',
  'integrateCoverageAdmin(ROOT,OUT);'
]){
  if(source.split(marker).length-1!==1)throw new Error(`RC1522 marker must occur exactly once: ${marker}`);
}

const order=['integrateTour(ROOT,OUT);','integrateEditor(ROOT,OUT);','integrateTraining(ROOT,OUT);','integrateCoverageAdmin(ROOT,OUT);'].map(marker=>source.indexOf(marker));
for(let i=1;i<order.length;i++)if(order[i]<=order[i-1])throw new Error(`RC1522 overlay order invalid at ${i}`);

fs.writeFileSync(file,source);
console.log('RC1522 stable RC1112 builder wired with additive SOPMaster overlays.');
