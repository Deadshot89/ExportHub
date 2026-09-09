'use strict';
const fs=require('fs');
const {patchTask3Html}=require('./task3-html.cjs');

function replaceOnce(source,search,replacement,label){
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(label+': erwartet 1 Treffer, gefunden '+count);
  return source.replace(search,replacement);
}

const htmlPath='index.html';
const rootHtml=fs.readFileSync(htmlPath,'utf8');
fs.writeFileSync(htmlPath,patchTask3Html(rootHtml));

const buildPath='.github/rc1016/build-three-env.mjs';
let build=fs.readFileSync(buildPath,'utf8');

if(!build.includes("createRequire from 'node:module'")){
  build=replaceOnce(
    build,
    "import {execFileSync} from 'node:child_process';",
    "import {execFileSync} from 'node:child_process';\nimport {createRequire} from 'node:module';",
    'RC1017 createRequire Import'
  );
}
if(!build.includes("require('../rc1017/task3-html.cjs')")){
  build=replaceOnce(
    build,
    "const CACHE='1016';",
    "const CACHE='1016';\nconst require=createRequire(import.meta.url);\nconst {patchTask3Html}=require('../rc1017/task3-html.cjs');",
    'RC1017 gemeinsamer HTML-Patcher'
  );
}
if(!build.includes('html=patchTask3Html(html);')){
  build=replaceOnce(
    build,
    "  html=patchWarningCenterStateSource(html);\n  writeOut(file,html);",
    "  html=patchWarningCenterStateSource(html);\n  html=patchTask3Html(html);\n  writeOut(file,html);",
    'RC1017 Overlay auf alle drei Umgebungen'
  );
}
if(!build.includes("'assets/rc1017-multi-truck.js'")){
  build=replaceOnce(
    build,
    "  'assets/rc1016-demo-task-seed.js'\n])writeOut(asset,read(asset));",
    "  'assets/rc1016-demo-task-seed.js','assets/rc1017-multi-truck.js'\n])writeOut(asset,read(asset));",
    'RC1017 Modell-Asset kopieren'
  );
}
fs.writeFileSync(buildPath,build);

console.log('RC1017 Task 3 angewendet: gemeinsamer Stauplan-, Persistenz- und Drei-Umgebungen-Patcher aktiv.');
