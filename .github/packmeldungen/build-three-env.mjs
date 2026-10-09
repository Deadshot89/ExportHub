import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

export const PACK_ASSETS=Object.freeze([
  'packaging-catalog.js',
  'document-print-name.js',
  'pack-notification.css',
  'pack-notification.js',
  'pack-notification-internal.css',
  'pack-notification-internal.js',
  'pack-notification-nav.js',
  'pack-notification-shipment.js',
  'pack-notification-avis.css',
  'pack-notification-avis.js'
]);

const STYLE_TAGS=[
  '<link id="exporthub-pack-notification-internal-style" rel="stylesheet" href="/assets/pack-notification-internal.css?v=1">',
  '<link id="exporthub-pack-notification-avis-style" rel="stylesheet" href="/assets/pack-notification-avis.css?v=1">'
];
const SCRIPT_TAGS=[
  '<script id="exporthub-pack-notification-internal" defer src="/assets/pack-notification-internal.js?v=1"></script>',
  '<script id="exporthub-pack-notification-nav" defer src="/assets/pack-notification-nav.js?v=1"></script>',
  '<script id="exporthub-pack-notification-shipment" defer src="/assets/pack-notification-shipment.js?v=1"></script>',
  '<script id="exporthub-pack-notification-avis" defer src="/assets/pack-notification-avis.js?v=1"></script>',
  '<script id="exporthub-document-print-name" defer src="/assets/document-print-name.js?v=1"></script>'
];

export function injectPackRuntime(html,file='index.html'){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(`${file}: </head> fehlt`);
  const tags=[...STYLE_TAGS,...SCRIPT_TAGS].filter(tag=>{
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    return !id||!out.includes(`id="${id}"`);
  });
  if(tags.length)out=out.replace(/<\/head>/i,`${tags.join('\n')}\n</head>`);
  for(const tag of [...STYLE_TAGS,...SCRIPT_TAGS]){
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    if(id&&!out.includes(`id="${id}"`))throw new Error(`${file}: Pack-Runtime ${id} fehlt`);
  }
  return out;
}

export function copyPackFiles(root,out){
  fs.mkdirSync(path.join(out,'assets'),{recursive:true});
  fs.copyFileSync(path.join(root,'pack.html'),path.join(out,'pack.html'));
  for(const asset of PACK_ASSETS)fs.copyFileSync(path.join(root,'assets',asset),path.join(out,'assets',asset));
}

export function build(root=process.cwd()){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{cwd:root,stdio:'inherit'});
  const out=path.join(root,'dist-rc1112');
  copyPackFiles(root,out);
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const target=path.join(out,file);
    const html=fs.readFileSync(target,'utf8');
    fs.writeFileSync(target,injectPackRuntime(html,file));
  }
  for(const config of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const src=path.join(root,config);if(fs.existsSync(src))fs.copyFileSync(src,path.join(out,config));
  }
  return out;
}

const current=fileURLToPath(import.meta.url);
const invoked=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(current);
if(invoked)build();
