import fs from 'node:fs';
import path from 'node:path';

export const ABD_PROFORMA_ASSETS=['assets/rc1549-abd-proforma.js','assets/essentra-company-logo.png','assets/rc1790-delivery-note.js','assets/i18n/rc1790-delivery-note.js','assets/rc1940-documents-workspace.js','assets/rc1962-d365-local-import.js','assets/rc1962-d365-xlsx-worker.js'];
export const ABD_PROFORMA_MARKERS=['exporthub-rc1549-abd-proforma','assets/rc1549-abd-proforma.js?v=1962'];
const ENTRIES=['index.html','TESTVERSION.html','demo.html'];
const TAG='<script id="exporthub-rc1549-abd-proforma" defer src="/assets/rc1549-abd-proforma.js?v=1962"></script>';
const DELIVERY_I18N_TAG='<script id="exporthub-rc1790-delivery-note-i18n" defer src="/assets/i18n/rc1790-delivery-note.js?v=1790"></script>';
const DELIVERY_TAG='<script id="exporthub-rc1790-delivery-note" defer src="/assets/rc1790-delivery-note.js?v=1790"></script>';
const DOCUMENT_TAG='<script id="exporthub-rc1940-documents" defer src="/assets/rc1940-documents-workspace.js?v=1962"></script>';
const D365_LOCAL_TAG='<script id="exporthub-rc1962-d365-local-import" defer src="/assets/rc1962-d365-local-import.js?v=1970"></script>';

function copyFile(root,out,rel){
 const source=path.join(root,rel),target=path.join(out,rel);
 if(!fs.existsSync(source))throw new Error(`RC1549 Pflicht-Asset fehlt: ${rel}`);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)
}
function inject(html,file){
 if(!html.includes('id="exporthub-rc1549-abd-proforma"')){
  const index=html.toLowerCase().indexOf('</head>');
  if(index<0)throw new Error(`RC1549 ${file}: </head>-Anker fehlt`);
  html=html.slice(0,index)+TAG+'\n'+html.slice(index)
 }
 // Legacy entrypoints can already contain the old invoice tag. Normalize it
 // before using TAG as the insertion anchor for delivery/documents runtimes.
 html=html.replace(/(id="exporthub-rc1549-abd-proforma"[^>]*src="\/assets\/rc1549-abd-proforma\.js\?v=)\d+/g,(_m,p)=>p+'1962');
 if(!html.includes('id="exporthub-rc1790-delivery-note"'))html=html.replace(TAG,TAG+'\n'+DELIVERY_I18N_TAG+'\n'+DELIVERY_TAG);
 if(!html.includes('id="exporthub-rc1940-documents"'))html=html.replace(DELIVERY_TAG,DELIVERY_TAG+'\n'+DOCUMENT_TAG);
 // Normalize legacy cache keys BEFORE positioning the new local importer after the document runtime.
 html=html.replace(/(id="exporthub-rc1549-abd-proforma"[^>]*src="\/assets\/rc1549-abd-proforma\.js\?v=)\d+/g,(_m,p)=>p+'1962');
 html=html.replace(/(id="exporthub-rc1940-documents"[^>]*src="\/assets\/rc1940-documents-workspace\.js\?v=)\d+/g,(_m,p)=>p+'1962');
 if(!html.includes('id="exporthub-rc1962-d365-local-import"'))html=html.replace(DOCUMENT_TAG,DOCUMENT_TAG+'\n'+D365_LOCAL_TAG);
 // Upgrade existing local import tags: an old cached JS would still invoke the broken worker.
 html=html.replace(/(id="exporthub-rc1962-d365-local-import"[^>]*src="\/assets\/rc1962-d365-local-import\.js\?v=)\d+/g,(_m,p)=>p+'1970');
 // Existing built entrypoints can contain the previous stable filename: bump its query too.
 html=html.replace(/(id="exporthub-rc1940-documents"[^>]*src="\/assets\/rc1940-documents-workspace\.js\?v=)\d+/g,(_match,prefix)=>prefix+'1962');
 // RC325 must accept the additional navigation entry without rebuilding the entire menu.
 const oldAddons="var ADDON_BUTTONS='[data-pack-notifications-nav],[data-rc1555-packaging-nav],[data-exporthub-urgent-nav]';";
 const newAddons="var ADDON_BUTTONS='[data-pack-notifications-nav],[data-rc1555-packaging-nav],[data-exporthub-urgent-nav],[data-exporthub-documents-nav]';";
 if(html.includes(oldAddons))html=html.replace(oldAddons,newAddons);
 if(html.includes('var ADDON_BUTTONS=')&&!html.includes(newAddons))throw new Error('RC1940 '+file+': document menu addon not registered');
 return html
}
export function integrateAbdProforma(root,out){
 for(const rel of ABD_PROFORMA_ASSETS)copyFile(root,out,rel);
 for(const file of ENTRIES){
  const target=path.join(out,file);if(!fs.existsSync(target))throw new Error(`RC1549 Build-Datei fehlt: ${file}`);
  const next=inject(fs.readFileSync(target,'utf8'),file);fs.writeFileSync(target,next);
  for(const marker of ABD_PROFORMA_MARKERS.concat(['exporthub-rc1790-delivery-note','assets/rc1790-delivery-note.js?v=1790','exporthub-rc1790-delivery-note-i18n','assets/i18n/rc1790-delivery-note.js?v=1790','exporthub-rc1940-documents','assets/rc1940-documents-workspace.js?v=1962','exporthub-rc1962-d365-local-import','assets/rc1962-d365-local-import.js?v=1970']))if(!next.includes(marker))throw new Error(`RC1549 ${file}: Pflichtmarker fehlt: ${marker}`)
 }
 return out
}
