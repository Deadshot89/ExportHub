import fs from 'node:fs';

function read(file){return fs.readFileSync(file,'utf8')}
function write(file,content){fs.writeFileSync(file,content)}
function replaceOnce(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`${label}: erwartet 1 Treffer, gefunden ${count}`);
  return source.replace(before,after);
}
function removeBetween(source,start,end,label){
  const a=source.indexOf(start),b=a<0?-1:source.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error(`${label}: Blockanker fehlt`);
  return source.slice(0,a)+source.slice(b);
}

function patchRc1013(){
  const file='.github/rc1013/build-three-env.mjs';
  let src=read(file);
  src=replaceOnce(src,"const SOP_RELEASE_SRC='/assets/sop/rc1010-sop-release.js?v=1010';\n",'', 'RC1013 SOP release constant');
  src=replaceOnce(src,"const SOP_STABILITY_SRC='/assets/sop/rc1013-sop-stability.js?v=1013';\n",'', 'RC1013 SOP stability constant');
  src=replaceOnce(src,"function sopReleaseTag(){return `<script id=\"exporthub-rc1013-sop-release\" src=\"${SOP_RELEASE_SRC}\"><\\/script>\\n<script id=\"exporthub-rc1013-sop-stability\" defer src=\"${SOP_STABILITY_SRC}\"><\\/script>`;}\n",'', 'RC1013 SOP tags');
  src=replaceOnce(src,"out=injectBeforeHeadClose(out,sopReleaseTag(),'exporthub-rc1013-sop-release');",'', 'RC1013 SOP inject');
  src=replaceOnce(src,"write('assets/exporthub-environment-hub.js',environmentHub);write('assets/exporthub-demo-bootstrap.js',demoAsset());copy('assets/sop/rc1010-sop-release.js');copy('assets/sop/rc1013-sop-stability.js');\n","write('assets/exporthub-environment-hub.js',environmentHub);write('assets/exporthub-demo-bootstrap.js',demoAsset());\n",'RC1013 SOP copy');
  src=replaceOnce(src,"releaseEnvironments:RELEASE_ENVIRONMENTS,sopRelease:'assets/sop/rc1010-sop-release.js',sopStability:'assets/sop/rc1013-sop-stability.js',calendar:","releaseEnvironments:RELEASE_ENVIRONMENTS,calendar:",'RC1013 SOP manifest');
  src=replaceOnce(src,",sop:'Filter-Render wird aus laufenden DOM-Events entkoppelt'",'', 'RC1013 SOP fix manifest');
  src=replaceOnce(src,", SOP-Stabilität",'', 'RC1013 log');
  if(/\/assets\/sop\//.test(src)||/sopReleaseTag|SOP_RELEASE_SRC|SOP_STABILITY_SRC|sopRelease:|sopStability:/.test(src))throw new Error('RC1013 Legacy-SOP-Rest gefunden');
  write(file,src);
}

function patchRc1016(){
  const file='.github/rc1016/build-three-env.mjs';
  let src=read(file);
  src=removeBetween(src,'function injectSopConsolidation(html){','function patchDemoDataEnvironment(html){','RC1016 SOP consolidation function');
  src=replaceOnce(src,'  html=injectSopConsolidation(html);\n','', 'RC1016 SOP inject');
  src=replaceOnce(src,"const sopSource=path.join(ROOT,'assets/sop');\nif(fs.existsSync(sopSource))fs.cpSync(sopSource,path.join(OUT,'assets/sop'),{recursive:true});\n",'', 'RC1016 SOP tree copy');
  src=replaceOnce(src,"  sop:{catalog:'assets/sop/rc1016-sop-consolidation.js',activeWorkflows:24,legacyDocuments:75,screenshotDirectory:'assets/sop/screenshots'},\n",'', 'RC1016 SOP manifest');
  src=replaceOnce(src,', SOP 2.0','', 'RC1016 log');
  if(/injectSopConsolidation|assets\/sop/.test(src))throw new Error('RC1016 Legacy-SOP-Rest gefunden');
  write(file,src);
}

function patchRc1018(){
  const file='.github/rc1018/build-three-env.mjs';
  let src=read(file);
  src=replaceOnce(src,"const SOP_IMAGES_TAG='<script id=\"exporthub-rc1018-sop-system-images\" defer src=\"/assets/sop/rc1018-sop-system-images.js?v=1018\"></script>';\n",'', 'RC1018 SOP image constant');
  src=removeBetween(src,'function injectSopImages(html){','function patchGate41NationalOnly(html){','RC1018 SOP image function');
  src=replaceOnce(src,'  html=injectSopImages(html);\n','', 'RC1018 SOP image inject');
  src=replaceOnce(src,"  sop:{systemImages:'assets/sop/rc1018-sop-system-images.js',screenshotDirectory:'assets/sop/screenshots'},\n",'', 'RC1018 SOP manifest');
  src=replaceOnce(src,', SOP-Systembilder','', 'RC1018 log');
  if(/injectSopImages|assets\/sop/.test(src))throw new Error('RC1018 Legacy-SOP-Rest gefunden');
  write(file,src);
}

function patchRc1112(){
  const file='.github/rc1112/build-three-env.mjs';
  let src=read(file);
  for(const line of [
    "import {integrateTour} from '../rc1501/build-three-env.mjs';\n",
    "import {integrateEditor} from '../rc1502/build-three-env.mjs';\n",
    "import {integrateTraining} from '../rc1503/build-three-env.mjs';\n",
    "import {integrateCoverageAdmin} from '../rc1506/build-three-env.mjs';\n"
  ])src=replaceOnce(src,line,'','RC1112 retired SOP import');
  src=replaceOnce(src,"// RC1522: SOPMaster is an additive layer of the stable RC1112 release build.\nintegrateTour(ROOT,OUT);\nintegrateEditor(ROOT,OUT);\nintegrateTraining(ROOT,OUT);\nintegrateCoverageAdmin(ROOT,OUT);\n\n",'', 'RC1112 retired SOP integrations');
  for(const retired of ['rc1501/build-three-env.mjs','rc1502/build-three-env.mjs','rc1503/build-three-env.mjs','rc1506/build-three-env.mjs','integrateTour','integrateEditor','integrateTraining','integrateCoverageAdmin'])if(src.includes(retired))throw new Error(`RC1112 Legacy-SOP-Rest gefunden: ${retired}`);
  write(file,src);
}

patchRc1013();
patchRc1016();
patchRc1018();
patchRc1112();
console.log('Retired SOPMaster build hooks removed; non-SOP build stages preserved.');
