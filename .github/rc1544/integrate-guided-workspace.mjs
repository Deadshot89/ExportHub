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

const ENTRIES=['index.html','TESTVERSION.html','demo.html'];
const GUIDED_STYLE='<link id="exporthub-rc1544-sop-guided-workspace-style" rel="stylesheet" href="/assets/sop/rc1544-sop-guided-workspace.css?v=1544">';
const GUIDED_SCRIPTS=[
  '<script id="exporthub-rc1544-sop-guided-i18n" defer src="/assets/sop/rc1544-sop-guided-i18n.js?v=1544"></script>',
  '<script id="exporthub-rc1544-sop-guided-workspace" defer src="/assets/sop/rc1544-sop-guided-workspace.js?v=1544"></script>'
];

function countId(html,id){return String(html||'').split(`id="${id}"`).length-1;}
function insertBeforeLastClosingTag(html,tag,payload,file){
  const source=String(html||'');
  const token=`</${String(tag||'').toLowerCase()}>`;
  const index=source.toLowerCase().lastIndexOf(token);
  if(index<0)throw new Error(`RC1544 ${file}: ${token} fehlt`);
  return `${source.slice(0,index)}${payload}\n${source.slice(index)}`;
}
function guidedDataTag(root){
  const source=path.join(root,GUIDED_I18N_DATA);
  if(!fs.existsSync(source))throw new Error(`RC1544 Pflicht-Asset fehlt: ${GUIDED_I18N_DATA}`);
  let parsed;
  try{parsed=JSON.parse(fs.readFileSync(source,'utf8'));}
  catch(error){throw new Error(`RC1544 Guided-i18n JSON ungültig: ${error&&error.message?error.message:error}`);}
  const safe=JSON.stringify(parsed).replace(/</g,'\\u003c');
  return `<script id="exporthub-rc1544-sop-guided-i18n-data" type="application/json">${safe}</script>`;
}

export function integrateGuidedWorkspace(root,out){
  for(const rel of GUIDED_ASSETS){
    const source=path.join(root,rel),target=path.join(out,rel);
    if(!fs.existsSync(source))throw new Error(`RC1544 Pflicht-Asset fehlt: ${rel}`);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target);
  }

  const dataTag=guidedDataTag(root);
  for(const file of ENTRIES){
    const target=path.join(out,file);
    if(!fs.existsSync(target))throw new Error(`RC1544 Build-Datei fehlt: ${file}`);
    let html=fs.readFileSync(target,'utf8');

    if(!html.includes('id="exporthub-rc1544-sop-guided-workspace-style"')){
      html=insertBeforeLastClosingTag(html,'head',GUIDED_STYLE,file);
    }

    const payload=[];
    if(!html.includes('id="exporthub-rc1544-sop-guided-i18n-data"'))payload.push(dataTag);
    for(const tag of GUIDED_SCRIPTS){
      const id=(tag.match(/id="([^"]+)"/)||[])[1];
      if(id&&!html.includes(`id="${id}"`))payload.push(tag);
    }
    if(payload.length)html=insertBeforeLastClosingTag(html,'body',payload.join('\n'),file);

    for(const id of GUIDED_MARKERS){
      if(countId(html,id)!==1)throw new Error(`RC1544 ${file}: ${id} muss genau einmal vorhanden sein`);
    }
    const data=html.indexOf('id="exporthub-rc1544-sop-guided-i18n-data"');
    const i18n=html.indexOf('id="exporthub-rc1544-sop-guided-i18n"');
    const workspace=html.indexOf('id="exporthub-rc1544-sop-guided-workspace"');
    if(data<0||i18n<=data||workspace<=i18n)throw new Error(`RC1544 ${file}: Reihenfolge muss Sprachdaten → Sprachmodul → Guided-Workspace sein`);

    fs.writeFileSync(target,html);
  }
  return out;
}
