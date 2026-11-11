import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {finalizeAutoUpdate} from '../rc1488/finalize-auto-update.mjs';
import {integrateGuidedWorkspace} from '../rc1544/integrate-guided-workspace.mjs';
import {fingerprintAssets} from '../asset-fingerprint/fingerprint-assets.mjs';

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
  'pack-notification-abd.js',
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
  '<script id="exporthub-document-reference-normalizer" defer src="/assets/document-reference-normalizer.js?v=3"></script>',
  '<script id="exporthub-document-upload-normalizer" defer src="/assets/document-upload-normalizer.js?v=1"></script>'
];
const PACK_SCRIPT_TAGS=[
  '<script id="exporthub-pack-notification-i18n" defer src="/assets/i18n/pack-notification.js?v=4"></script>',
  '<script id="exporthub-pack-notification-internal" defer src="/assets/pack-notification-internal.js?v=1"></script>',
  '<script id="exporthub-pack-notification-nav" defer src="/assets/pack-notification-nav.js?v=1"></script>',
  '<script id="exporthub-pack-notification-shipment" defer src="/assets/pack-notification-shipment.js?v=4"></script>',
  '<script id="exporthub-pack-notification-abd" defer src="/assets/pack-notification-abd.js?v=1"></script>',
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


/* RC1382: the legacy ABD module lives in the large HTML source. These
   narrowly-scoped signature-checked changes preserve its existing editor,
   while ensuring a standalone Pack ABD never attaches to a shipment. */
export function injectPackAbdOwnership(html,file='index.html'){
  let out=String(html||'');
  if(!out.includes('function saveAbdInternal(showAlert,status)')){
    if(file==='demo.html'||!out.includes('rc626-shipping-inspections-abd-controller'))return out;
    throw new Error(file+': RC1382 legacy ABD storage hook missing');
  }
  function replaceOnce(needle,replacement){
    if(out.split(needle).length!==2)throw new Error(file+': RC1382 ABD ownership contract drift: '+needle.slice(0,62));
    out=out.replace(needle,replacement);
  }
  replaceOnce(
    'function shipmentForAbd(a){if(!a)return null;',
    'function shipmentForAbd(a){if(!a||q(a.packNotificationId))return null;'
  );
  replaceOnce(
    'function saveAbdInternal(showAlert,status){var d=abdState();if(!validateAbd(showAlert))return null;',
    "function saveAbdInternal(showAlert,status){var d=abdState();if(!validateAbd(showAlert))return null;if(q(d.packNotificationId)){if(!window.ExportHUBPackAbd||typeof window.ExportHUBPackAbd.canSave!=='function'||!window.ExportHUBPackAbd.canSave(d)){if(showAlert)alert('ABD-Speicherung läuft oder Packmodul fehlt.');return null}var pn=arr(state().packNotifications).find(function(n){return q(n.id)===q(d.packNotificationId)&&q(n.reference)===q(d.packNotificationRef)}),other=arr(state().abdRequests).find(function(a){return q(a.id)===q(d.id)||cleanRef(a.ref||a.reference)===cleanRef(d.ref)}),duplicated=arr(state().abdRequests).some(function(a){return q(a.packNotificationId)===q(d.packNotificationId)&&q(a.id)!==q(d.id)}),shipRefUsed=shipments().some(function(sh){return cleanRef(sh.ref||sh.reference||sh.shipmentRef)===cleanRef(d.ref)});if(!pn||low(pn.status)==='cancelled'||!q(d.packNotificationRef)||(other&&(q(other.packNotificationId)!==q(d.packNotificationId)||q(other.packNotificationRef)!==q(d.packNotificationRef)))||duplicated||shipRefUsed||q(d.linkedShipmentId)){if(showAlert)alert('ABD-Zuordnung nicht eindeutig. Keine Anfrage gespeichert.');return null}}"
  );
  replaceOnce(
    'source:d.source,linkedShipmentId:q(d.linkedShipmentId||existing&&existing.linkedShipmentId),',
    "source:d.source,packNotificationId:q(d.packNotificationId||existing&&existing.packNotificationId),packNotificationRef:q(d.packNotificationRef||existing&&existing.packNotificationRef),linkedShipmentId:q(d.packNotificationId||existing&&existing.packNotificationId)?'':q(d.linkedShipmentId||existing&&existing.linkedShipmentId),"
  );
  replaceOnce(
    "s.abdDraft=clone(item);var sh=item.linkedShipmentId&&findShipment(item.linkedShipmentId);if(!sh&&item.ref)sh=findShipment(item.ref);if(sh){",
    "s.abdDraft=clone(item);var sh=!item.packNotificationId&&item.linkedShipmentId&&findShipment(item.linkedShipmentId);if(!item.packNotificationId&&!sh&&item.ref)sh=findShipment(item.ref);if(sh){"
  );
  replaceOnce(
    "source=d.source==='shipment'?'Aus Sendung übernommen':'Manuelle Erstellung'",
    "source=d.packNotificationId?'Aus Packmeldung übernommen':d.source==='shipment'?'Aus Sendung übernommen':'Manuelle Erstellung'"
  );
  replaceOnce(
    "persist('ABD-Anfrage gespeichert');if(showAlert)alert('ABD-Anfrage gespeichert: '+item.ref);return item}",
    "if(item.packNotificationId){window.ExportHUBPackAbd.confirmSave(item,{showAlert:!!showAlert,openMail:status==='Angefragt'});}else{persist('ABD-Anfrage gespeichert');if(showAlert)alert('ABD-Anfrage gespeichert: '+item.ref);}return item}"
  );
  replaceOnce(
    "var item=saveAbdInternal(false,'Angefragt');if(!item)return false;if(!window.__EXPORTHUB_TEST_NO_MAILTO__)",
    "var item=saveAbdInternal(false,'Angefragt');if(!item)return false;if(item.packNotificationId){renderAbd();return false;}if(!window.__EXPORTHUB_TEST_NO_MAILTO__)"
  );
  return out;
}

export function injectPackRuntime(html,file='index.html'){
  let out=injectPackAbdOwnership(injectDocumentUploadRuntime(html,file),file);
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
  // Must stay last: hashes the files exactly as they are shipped.
  fingerprintAssets({root,out});
  return out;
}

const current=fileURLToPath(import.meta.url);
const invoked=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(current);
if(invoked)build();