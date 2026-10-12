import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build as buildRc1501} from '../rc1501/build-three-env.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const OUT=path.join(ROOT,'dist-rc1112');

export const RC1502_ASSETS=Object.freeze([
  'assets/sop/rc1502-sop-visuals.js',
  'assets/sop/rc1502-sop-screenshot-manifest.js',
  'assets/sop/rc1502-sop-editor.js',
  'assets/sop/rc1502-sop-editor.css'
]);

const STYLE_TAG='<link id="exporthub-rc1502-sop-editor-style" rel="stylesheet" href="/assets/sop/rc1502-sop-editor.css?v=1502">';
const SCRIPT_TAGS=[
  '<script id="exporthub-rc1502-sop-visuals" defer src="/assets/sop/rc1502-sop-visuals.js?v=1502"></script>',
  '<script id="exporthub-rc1502-sop-screenshot-manifest" defer src="/assets/sop/rc1502-sop-screenshot-manifest.js?v=1502"></script>',
  '<script id="exporthub-rc1502-sop-editor" defer src="/assets/sop/rc1502-sop-editor.js?v=1502"></script>'
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
    if(count!==1)throw new Error(`${file}: RC1502 Tag ${id} ${count}x gefunden`);
  }
  const order=SCRIPT_TAGS.map(tag=>{
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    return out.indexOf(`id="${id}"`);
  });
  if(order.some(pos=>pos<0)||order.some((pos,index)=>index>0&&pos<=order[index-1]))throw new Error(`${file}: RC1502 Script-Reihenfolge ist ungültig`);
  return out;
}

export function integrateEditor(root=ROOT,out=OUT){
  for(const rel of RC1502_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1502 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1502 Build-Datei fehlt: ${file}`);
    fs.writeFileSync(target,injectTags(fs.readFileSync(target,'utf8'),file));
  }
  const manifest={
    version:'RC1502',
    baseBuilder:'.github/rc1501/build-three-env.mjs',
    assets:RC1502_ASSETS.slice(),
    entries:['index.html','TESTVERSION.html','demo.html'],
    editorPersistence:'existing-isoSops-save-path',
    releasedVersions:'immutable'
  };
  fs.writeFileSync(path.join(out,'rc1502-sop-editor-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

export function build(root=ROOT){
  buildRc1501(root);
  return integrateEditor(root,path.join(root,'dist-rc1112'));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))build(ROOT);
