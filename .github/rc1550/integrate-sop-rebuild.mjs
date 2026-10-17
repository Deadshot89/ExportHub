import fs from 'node:fs';
import path from 'node:path';

export const RC1550_BSH_IMAGES=Object.freeze([
  'assets/sop/screenshots/bsh/01-portaluebersicht.png',
  'assets/sop/screenshots/bsh/02-funktion-auswaehlen.png',
  'assets/sop/screenshots/bsh/03-kunde-werk.png',
  'assets/sop/screenshots/bsh/04-hinzufuegen.png',
  'assets/sop/screenshots/bsh/05-werk-termin.png',
  'assets/sop/screenshots/bsh/06-verpackungsdaten.png',
  'assets/sop/screenshots/bsh/07-exporthub-referenz.png',
  'assets/sop/screenshots/bsh/08-lieferavis-anlegen.png',
  'assets/sop/screenshots/bsh/09-lieferscheine-mengen.png',
  'assets/sop/screenshots/bsh/10-sendungsnummer-erstellen.png',
  'assets/sop/screenshots/bsh/11-erfolgsbestaetigung.png'
]);

export const SOP_REBUILD_ASSETS=Object.freeze([
  'assets/sop/rc1550-sop-active-catalog.js',
  'assets/sop/rc1550-sop-runtime.js',
  'assets/sop/rc1550-sop-ui.js',
  'assets/sop/rc1550-sop.css',
  ...RC1550_BSH_IMAGES
]);

export const SOP_REBUILD_MARKERS=Object.freeze([
  'exporthub-rc1550-sop-style',
  'exporthub-rc1550-sop-active-catalog',
  'exporthub-rc1550-sop-runtime',
  'exporthub-rc1550-sop-ui'
]);

const ENTRIES=Object.freeze(['index.html','TESTVERSION.html','demo.html']);
const GUIDED_ANCHOR_ID='exporthub-rc1544-sop-guided-workspace';
const STYLE_TAG='<link id="exporthub-rc1550-sop-style" rel="stylesheet" href="/assets/sop/rc1550-sop.css?v=1550">';
const SCRIPT_TAGS=Object.freeze([
  '<script id="exporthub-rc1550-sop-active-catalog" defer src="/assets/sop/rc1550-sop-active-catalog.js?v=1550"></script>',
  '<script id="exporthub-rc1550-sop-runtime" defer src="/assets/sop/rc1550-sop-runtime.js?v=1550"></script>',
  '<script id="exporthub-rc1550-sop-ui" defer src="/assets/sop/rc1550-sop-ui.js?v=1550"></script>'
]);

function countId(html,id){return String(html||'').split(`id="${id}"`).length-1;}
function guidedAnchorRegex(){return new RegExp(`<script\\b(?=[^>]*\\bid=["']${GUIDED_ANCHOR_ID}["'])[^>]*>\\s*<\\/script>`,'i');}
function injectStyle(html,file){
  if(countId(html,'exporthub-rc1550-sop-style')===1)return html;
  if(countId(html,'exporthub-rc1550-sop-style')>1)throw new Error(`RC1550 ${file}: Style ist mehrfach vorhanden`);
  if(!/<\/head>/i.test(html))throw new Error(`RC1550 ${file}: </head> fehlt`);
  return html.replace(/<\/head>/i,`${STYLE_TAG}\n</head>`);
}
function injectScripts(html,file){
  const counts=SCRIPT_TAGS.map(tag=>countId(html,(tag.match(/id="([^"]+)"/)||[])[1]));
  if(counts.every(count=>count===1))return html;
  if(counts.some(count=>count!==0))throw new Error(`RC1550 ${file}: unvollständige Script-Injection (${counts.join(',')})`);
  const rx=guidedAnchorRegex();const match=html.match(rx);
  if(!match)throw new Error(`RC1550 ${file}: Guided-Workspace-Anker ${GUIDED_ANCHOR_ID} fehlt`);
  // Laufzeit-Reihenfolge: bestehende Persistenz/Guided-Wrapper → RC1550 active-catalog → runtime → sop-ui.
  // So bleibt der Guided-Workspace aktiv, der persistierte State wird bereinigt und RC1550 wird autoritativ sichtbar.
  return html.replace(rx,`${match[0]}\n${SCRIPT_TAGS.join('\n')}`);
}

export function validateBundle(html,file='index.html'){
  for(const id of SOP_REBUILD_MARKERS){const count=countId(html,id);if(count!==1)throw new Error(`RC1550 ${file}: ${id} muss genau einmal vorhanden sein, gefunden ${count}`);}
  const guided=html.indexOf(`id="${GUIDED_ANCHOR_ID}"`);
  const catalog=html.indexOf('id="exporthub-rc1550-sop-active-catalog"');
  const runtime=html.indexOf('id="exporthub-rc1550-sop-runtime"');
  const ui=html.indexOf('id="exporthub-rc1550-sop-ui"');
  if(guided<0||catalog<=guided||runtime<=catalog||ui<=runtime)throw new Error(`RC1550 ${file}: Reihenfolge muss Guided-Workspace → RC1550 active-catalog → runtime → sop-ui sein`);
}

export function integrateSopRebuild(root,out){
  for(const rel of SOP_REBUILD_ASSETS){
    const source=path.join(root,rel);const target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1550 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }
  for(const file of ENTRIES){
    const target=path.join(out,file);if(!fs.existsSync(target))throw new Error(`RC1550 Build-Datei fehlt: ${file}`);
    let html=fs.readFileSync(target,'utf8');
    html=injectStyle(html,file);html=injectScripts(html,file);validateBundle(html,file);fs.writeFileSync(target,html);
  }
  return out;
}
