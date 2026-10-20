import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {finalizeAutoUpdate} from '../rc1488/finalize-auto-update.mjs';
import {integrateGuidedWorkspace} from '../rc1544/integrate-guided-workspace.mjs';

export const PACK_ASSETS=Object.freeze([
  'i18n/pack-notification.js',
  'rc1555-packaging-store.js',
  'packaging-catalog.js',
  'document-reference-normalizer.js',
  'document-upload-normalizer.js',
  'document-print-name.js',
  'pack-notification.css',
  'pack-notification.js',
  'pack-notification-internal.css',
  'pack-notification-internal.js',
  'pack-notification-nav.js',
  'pack-station-admin.js',
  'packaging-admin.js',
  'pack-notification-shipment.js',
  'pack-notification-avis.css',
  'pack-notification-avis.js'
]);

const STYLE_TAGS=[
  '<link id="exporthub-pack-notification-internal-style" rel="stylesheet" href="/assets/pack-notification-internal.css?v=1">',
  '<link id="exporthub-pack-notification-avis-style" rel="stylesheet" href="/assets/pack-notification-avis.css?v=1">'
];
const DOCUMENT_SCRIPT_TAGS=[
  '<script id="exporthub-document-reference-normalizer" defer src="/assets/document-reference-normalizer.js?v=2"></script>',
  '<script id="exporthub-document-upload-normalizer" defer src="/assets/document-upload-normalizer.js?v=1"></script>'
];
const PACK_SCRIPT_TAGS=[
  '<script id="exporthub-pack-notification-i18n" defer src="/assets/i18n/pack-notification.js?v=1"></script>',
  '<script id="exporthub-pack-notification-internal" defer src="/assets/pack-notification-internal.js?v=1"></script>',
  '<script id="exporthub-pack-notification-nav" defer src="/assets/pack-notification-nav.js?v=1"></script>',
  '<script id="exporthub-pack-notification-shipment" defer src="/assets/pack-notification-shipment.js?v=1"></script>',
  '<script id="exporthub-pack-notification-avis" defer src="/assets/pack-notification-avis.js?v=1"></script>',
  '<script id="exporthub-document-print-name" defer src="/assets/document-print-name.js?v=1"></script>'
];

const PACKAGING_LIST_PREFIX="function packagingList(){var s=state(),fixed=PACK.filter(function(x){return /^E[0-6]$/i.test(q(x.name))}),sources=[fixed,arr(s.colliTypes)],out=[],seen={};";
const INACTIVE_PACKAGING_MARKER="arr(s.inactiveColliTypes).forEach(function(x){var n=q(x&&x.name);if(n&&!/^E[0-6]$/i.test(n))seen[n.toLowerCase()]=1});arr(s.disabledPackagingAliases).forEach(function(name){var n=q(name);if(n&&!/^E[0-6]$/i.test(n))seen[n.toLowerCase()]=1});";

function injectTags(html,tags,file,label){
  let out=String(html||'');
  if(!/<\/head>/i.test(out))throw new Error(`${file}: </head> fehlt`);
  const missing=tags.filter(tag=>{
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    return !id||!out.includes(`id="${id}"`);
  });
  if(missing.length)out=out.replace(/<\/head>/i,`${missing.join('\n')}\n</head>`);
  for(const tag of tags){
    const id=(tag.match(/id="([^"]+)"/)||[])[1];
    if(id&&!out.includes(`id="${id}"`))throw new Error(`${file}: ${label} ${id} fehlt`);
  }
  return out;
}

export function injectInactivePackagingSuppression(html,file='index.html'){
  const out=String(html||'');
  if(out.includes(INACTIVE_PACKAGING_MARKER))return out;
  if(!out.includes(PACKAGING_LIST_PREFIX)){
    if(out.includes('function packagingList()'))throw new Error(`${file}: packagingList-Signatur hat sich geändert; RC1554-Inaktivschutz konnte nicht gesetzt werden.`);
    return out;
  }
  const patched=out.replace(PACKAGING_LIST_PREFIX,PACKAGING_LIST_PREFIX+INACTIVE_PACKAGING_MARKER);
  if(!patched.includes(INACTIVE_PACKAGING_MARKER))throw new Error(`${file}: inaktive Verpackungen konnten nicht gegen PACK-Fallback geschützt werden.`);
  return patched;
}

export function injectDocumentUploadRuntime(html,file='customer-avis.html'){
  return injectTags(html,DOCUMENT_SCRIPT_TAGS,file,'Dokument-Runtime');
}

export function injectPackRuntime(html,file='index.html'){
  let out=injectDocumentUploadRuntime(html,file);
  out=injectTags(out,STYLE_TAGS,file,'Pack-Runtime');
  out=injectTags(out,PACK_SCRIPT_TAGS,file,'Pack-Runtime');
  return out;
}

export function copyPackFiles(root,out){
  fs.mkdirSync(path.join(out,'assets'),{recursive:true});
  fs.copyFileSync(path.join(root,'pack.html'),path.join(out,'pack.html'));
  for(const asset of PACK_ASSETS){
    const target=path.join(out,'assets',asset);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(root,'assets',asset),target);
  }
}

export function build(root=process.cwd()){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{cwd:root,stdio:'inherit'});
  const out=path.join(root,'dist-rc1112');
  copyPackFiles(root,out);
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const target=path.join(out,file);
    const html=fs.readFileSync(target,'utf8');
    fs.writeFileSync(target,injectPackRuntime(injectInactivePackagingSuppression(html,file),file));
  }
  const customerAvis=path.join(out,'customer-avis.html');
  if(fs.existsSync(customerAvis)){
    const avisHtml=fs.readFileSync(customerAvis,'utf8');
    fs.writeFileSync(customerAvis,injectDocumentUploadRuntime(avisHtml,'customer-avis.html'));
  }
  for(const config of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const src=path.join(root,config);if(fs.existsSync(src))fs.copyFileSync(src,path.join(out,config));
  }
  finalizeAutoUpdate({root,out});
  integrateGuidedWorkspace(root,out);
  return out;
}

const current=fileURLToPath(import.meta.url);
const invoked=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(current);
if(invoked)build();