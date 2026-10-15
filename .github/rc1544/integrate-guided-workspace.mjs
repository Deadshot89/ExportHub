import fs from 'node:fs';
import path from 'node:path';

export const GUIDED_I18N_DATA='assets/sop/rc1544-sop-guided-i18n.json';
export const GUIDED_ASSETS=Object.freeze([
  GUIDED_I18N_DATA,
  'assets/sop/rc1544-sop-guided-i18n.js',
  'assets/sop/rc1544-sop-guided-workspace.js',
  'assets/sop/rc1544-sop-guided-workspace.css'
]);
export const GUIDED_MARKERS=Object.freeze([
  'exporthub-rc1544-sop-guided-workspace-style',
  'exporthub-rc1544-sop-guided-i18n-data',
  'exporthub-rc1544-sop-guided-i18n',
  'exporthub-rc1544-sop-guided-workspace'
]);
export const GUIDED_ANCHOR_ID='exporthub-rc1502-sop-persistence';

const ENTRIES=['index.html','TESTVERSION.html','demo.html'];
const GUIDED_STYLE='<link id="exporthub-rc1544-sop-guided-workspace-style" rel="stylesheet" href="/assets/sop/rc1544-sop-guided-workspace.css?v=1544">';
const GUIDED_SCRIPTS=[
  '<script id="exporthub-rc1544-sop-guided-i18n" defer src="/assets/sop/rc1544-sop-guided-i18n.js?v=1544"></script>',
  '<script id="exporthub-rc1544-sop-guided-workspace" defer src="/assets/sop/rc1544-sop-guided-workspace.js?v=1544"></script>'
];

function countId(html,id){return String(html||'').split(`id="${id}"`).length-1;}
function guidedDataTag(root){
  const source=path.join(root,GUIDED_I18N_DATA);
  if(!fs.existsSync(source))throw new Error(`RC1544 Pflicht-Asset fehlt: ${GUIDED_I18N_DATA}`);
  let parsed;
  try{parsed=JSON.parse(fs.readFileSync(source,'utf8'));}
  catch(error){throw new Error(`RC1544 Guided-i18n JSON ungültig: ${error&&error.message?error.message:error}`);}
  const safe=JSON.stringify(parsed).replace(/</g,'\\u003c');
  return `<script id="exporthub-rc1544-sop-guided-i18n-data" type="application/json">${safe}</script>`;
}
function anchorRegex(){
  return new RegExp(`<script\\b(?=[^>]*\\bid=["']${GUIDED_ANCHOR_ID}["'])[^>]*>\\s*<\\/script>`,'i');
}
function validateBundle(html,file){
  for(const id of GUIDED_MARKERS){
    const count=countId(html,id);
    if(count!==1)throw new Error(`RC1544 ${file}: ${id} muss genau einmal vorhanden sein, gefunden ${count}`);
  }
  const anchor=html.indexOf(`id="${GUIDED_ANCHOR_ID}"`);
  const style=html.indexOf('id="exporthub-rc1544-sop-guided-workspace-style"');
  const data=html.indexOf('id="exporthub-rc1544-sop-guided-i18n-data"');
  const i18n=html.indexOf('id="exporthub-rc1544-sop-guided-i18n"',data+1);
  const workspace=html.indexOf('id="exporthub-rc1544-sop-guided-workspace"',style+1);
  if(anchor<0)throw new Error(`RC1544 ${file}: SOPMaster-Persistenzanker ${GUIDED_ANCHOR_ID} fehlt`);
  if(style<=anchor||data<=style||i18n<=data||workspace<=i18n){
    throw new Error(`RC1544 ${file}: Reihenfolge muss Persistenzanker → Style → Sprachdaten → Sprachmodul → Guided-Workspace sein`);
  }
}

export function integrateGuidedWorkspace(root,out){
  for(const rel of GUIDED_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1544 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }

  const bundle=[GUIDED_STYLE,guidedDataTag(root),...GUIDED_SCRIPTS].join('\n');
  for(const file of ENTRIES){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1544 Build-Datei fehlt: ${file}`);
    let html=fs.readFileSync(target,'utf8');
    const markerCounts=GUIDED_MARKERS.map(id=>countId(html,id));
    const hasAny=markerCounts.some(count=>count>0);
    const hasAll=markerCounts.every(count=>count===1);

    if(hasAny&&!hasAll){
      throw new Error(`RC1544 ${file}: unvollständige Guided-Injection (${markerCounts.join(',')})`);
    }
    if(!hasAny){
      const rx=anchorRegex();
      const match=html.match(rx);
      if(!match)throw new Error(`RC1544 ${file}: SOPMaster-Persistenzanker ${GUIDED_ANCHOR_ID} ist nicht eindeutig injizierbar`);
      html=html.replace(rx,`${match[0]}\n${bundle}`);
    }

    validateBundle(html,file);
    fs.writeFileSync(target,html);
  }
  return out;
}