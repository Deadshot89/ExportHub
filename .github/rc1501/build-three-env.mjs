import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const OUT=path.join(ROOT,'dist-rc1112');

export const TOUR_ASSETS=Object.freeze([
  'assets/sop/rc1500-sop-step-contract.js',
  'assets/sop/rc1500-sop-overlay.js',
  'assets/sop/rc1500-sop-context.js',
  'assets/sop/rc1501-sop-tour-catalog.js',
  'assets/sop/rc1501-sop-tour-validator.js',
  'assets/sop/rc1501-sop-tour-targets.js',
  'assets/sop/rc1501-sop-tour-engine.js',
  'assets/sop/rc1501-sop-tour-ui.js',
  'assets/sop/rc1501-sop-tour-runtime.js',
  'assets/sop/rc1501-sop-tour.css'
]);

const STYLE_TAG='<link id="exporthub-rc1501-sop-tour-style" rel="stylesheet" href="/assets/sop/rc1501-sop-tour.css?v=1501">';
const SCRIPT_TAGS=[
  '<script id="exporthub-rc1500-sop-step-contract" defer src="/assets/sop/rc1500-sop-step-contract.js?v=1501"></script>',
  '<script id="exporthub-rc1500-sop-overlay" defer src="/assets/sop/rc1500-sop-overlay.js?v=1501"></script>',
  '<script id="exporthub-rc1500-sop-context" defer src="/assets/sop/rc1500-sop-context.js?v=1501"></script>',
  '<script id="exporthub-rc1501-sop-tour-catalog" defer src="/assets/sop/rc1501-sop-tour-catalog.js?v=1501"></script>',
  '<script id="exporthub-rc1501-sop-tour-validator" defer src="/assets/sop/rc1501-sop-tour-validator.js?v=1501"></script>',
  '<script id="exporthub-rc1501-sop-tour-targets" defer src="/assets/sop/rc1501-sop-tour-targets.js?v=1501"></script>',
  '<script id="exporthub-rc1501-sop-tour-engine" defer src="/assets/sop/rc1501-sop-tour-engine.js?v=1501"></script>',
  '<script id="exporthub-rc1501-sop-tour-ui" defer src="/assets/sop/rc1501-sop-tour-ui.js?v=1501"></script>',
  '<script id="exporthub-rc1501-sop-tour-runtime" defer src="/assets/sop/rc1501-sop-tour-runtime.js?v=1501"></script>'
];

function injectTags(html,file){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(`${file}: </head> fehlt`);
  const tags=[STYLE_TAG,...SCRIPT_TAGS];
  const missing=tags.filter(tag=>{
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    return !id||!out.includes(`id="${id}"`);
  });
  if(missing.length)out=out.replace(/<\/head>/i,`${missing.join('\n')}\n</head>`);
  for(const tag of tags){
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    const count=id?(out.split(`id="${id}"`).length-1):0;
    if(count!==1)throw new Error(`${file}: RC1501 Tag ${id} ${count}x gefunden`);
  }
  const order=SCRIPT_TAGS.map(tag=>{
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    return out.indexOf(`id="${id}"`);
  });
  if(order.some(pos=>pos<0)||order.some((pos,index)=>index>0&&pos<=order[index-1]))throw new Error(`${file}: RC1501 Script-Reihenfolge ist ungültig`);
  return out;
}

export function integrateTour(root=ROOT,out=OUT){
  for(const rel of TOUR_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1501 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1501 Build-Datei fehlt: ${file}`);
    fs.writeFileSync(target,injectTags(fs.readFileSync(target,'utf8'),file));
  }
  const manifest={
    version:'RC1501',
    baseBuilder:'.github/rc1112/build-three-env.mjs',
    assets:TOUR_ASSETS.slice(),
    entries:['index.html','TESTVERSION.html','demo.html'],
    productiveActions:'observed-not-invoked'
  };
  fs.writeFileSync(path.join(out,'rc1501-sop-tour-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

export function build(root=ROOT){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{cwd:root,stdio:'inherit'});
  return integrateTour(root,path.join(root,'dist-rc1112'));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build(ROOT);
