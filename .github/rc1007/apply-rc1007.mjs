import fs from 'node:fs';

function patchFile(path,transform){
  const before=fs.readFileSync(path,'utf8');
  const after=transform(before);
  if(after===before){
    console.log(`${path}: keine Änderung erforderlich`);
    return false;
  }
  fs.writeFileSync(path,after,'utf8');
  console.log(`${path}: RC1007-Patch angewendet`);
  return true;
}

patchFile('api/shared/merge.js',(src)=>{
  if(/isoSops:\s*\['id',\s*'number',\s*'_syncId'\]/.test(src)) return src;
  const anchor="  customSops: ['id', 'name', '_syncId'],\n";
  if(!src.includes(anchor)) throw new Error('RC1007: customSops-Anker in merge.js nicht gefunden');
  return src.replace(anchor,anchor+"  isoSops: ['id', 'number', '_syncId'],\n");
});

for(const path of [
  'docs/superpowers/specs/2026-09-08-iso-sop-handbook-design.md',
  'docs/superpowers/plans/2026-09-08-iso-sop-handbook.md'
]){
  patchFile(path,(src)=>src.replace(/\b33\b/g,'36').replace('vier Hauptbereiche','fünf Hauptbereiche'));
}

patchFile('assets/sop/rc1007-sop-catalog.js',(src)=>{
  let out=src;
  if(!out.includes('function buildVisuals(input,sections){')){
    const anchor='function list(value){return Array.isArray(value)?value:(value?[value]:[]);}\n';
    if(!out.includes(anchor)) throw new Error('RC1007: list-Anker im SOP-Katalog nicht gefunden');
    const helper=`function buildVisuals(input,sections){\n  const process={type:'process',stepId:'process-flow',caption:\`Prozessübersicht – \${input.number}: \${input.title}\`,required:true};\n  if(input.number==='SOP-LOG-011'){\n    return [\n      process,\n      {type:'placeholder',stepId:'step-1',caption:'Bild noch zu erstellen: ExportHUB – Ladeliste mit QR-Code der aktuellen Sendung.',required:true},\n      {type:'placeholder',stepId:'step-2',caption:'Bild noch zu erstellen: ExportHUB – Abholseite mit Referenz und Empfängerprüfung.',required:true},\n      {type:'placeholder',stepId:'step-4',caption:'Bild noch zu erstellen: ExportHUB – Eingabefeld für den Verlade-PIN.',required:true},\n      {type:'placeholder',stepId:'step-5',caption:'Bild noch zu erstellen: ExportHUB – Soll-/Ist-Colli prüfen und bestätigen.',required:true},\n      {type:'placeholder',stepId:'step-8',caption:'Bild noch zu erstellen: ExportHUB – Abschluss der Abholung mit Status und Zeitstempel.',required:true}\n    ];\n  }\n  return [\n    process,\n    {type:'placeholder',stepId:'step-1',caption:\`Bild noch zu erstellen: \${input.number} – \${input.title} – erster wesentlicher Arbeitsschritt.\`,required:false}\n  ];\n}\n`;
    out=out.replace(anchor,anchor+helper);
  }
  const oldVisual="    visuals:[{type:'placeholder',stepId:'step-1',caption:`Bild noch zu erstellen: ${input.number} – erster wesentlicher Prozessschritt.`,required:false}],";
  if(out.includes(oldVisual)) out=out.replace(oldVisual,'    visuals:buildVisuals(input,sections),');
  if(!out.includes('visuals:buildVisuals(input,sections)')) throw new Error('RC1007: Visual-Builder wurde nicht in den SOP-Katalog eingebunden');
  return out;
});

patchFile('assets/sop/rc1007-sop-ui.js',(src)=>{
  let out=src;
  if(!out.includes('function applyWorkflowAction(document,action,options={}){')){
    const anchor='function printDocument(){\n';
    if(!out.includes(anchor)) throw new Error('RC1007: printDocument-Anker im SOP-UI nicht gefunden');
    const helper=`function applyWorkflowAction(document,action,options={}){\n  const model=root.ExportHubIsoSopModel;\n  if(!model) throw new Error('ISO-SOP-Modell nicht geladen');\n  switch(String(action||'').toLowerCase()){\n    case 'draft':\n    case 'new-version': return model.createDraftVersion(document,options);\n    case 'review': return model.submitForReview(document,options);\n    case 'approve': return model.approveVersion(document,options);\n    case 'archive': return model.archiveVersion(document,options);\n    default: throw new Error('Unbekannte SOP-Workflow-Aktion');\n  }\n}\n`;
    out=out.replace(anchor,helper+anchor);
  }
  out=out.replace('root.ExportHubIsoSopUi=Object.freeze({mount,renderOverview,renderDocument,renderProcessGraphic,printDocument});','root.ExportHubIsoSopUi=Object.freeze({mount,renderOverview,renderDocument,renderProcessGraphic,printDocument,applyWorkflowAction});');
  if(!out.includes('applyWorkflowAction});')) throw new Error('RC1007: Workflow-Aktion wurde nicht exportiert');
  return out;
});

const sopAssets=`\n<!-- ExportHUB RC1007 ISO-SOP-Handbuch -->\n<link rel="stylesheet" href="assets/sop/rc1007-sop.css">\n<script src="assets/sop/rc1007-sop-model.js"></script>\n<script src="assets/sop/rc1007-sop-catalog.js"></script>\n<script src="assets/sop/rc1007-sop-ui.js"></script>\n`;

const legacyRender="function renderSop(){var r=root();if(r){r.innerHTML=sopHtml();r.className='content rc524-sop-view'}}";
const rc1007Render=`function renderSop(){var r=root();if(!r)return;try{var model=window.ExportHubIsoSopModel,catalog=window.ExportHubIsoSopCatalog,ui=window.ExportHubIsoSopUi,s=S();if(!model||!catalog||!ui)throw new Error('RC1007 SOP-Modul nicht geladen');if(!Array.isArray(s.isoSops)||!s.isoSops.length){var seeded=model.seedState({isoSops:s.isoSops},catalog.documents);s.isoSops=seeded.isoSops;save('RC1007 ISO-SOP-Katalog initialisiert')}var rights={read:typeof window.canRead==='function'?window.canRead('sop'):true,edit:typeof window.canWrite==='function'?window.canWrite('sop'):false,admin:typeof window.canAdmin==='function'?window.canAdmin('sop'):false,functionAdmin:typeof window.canAdmin==='function'?window.canAdmin('sop'):false};r.className='content rc1007-sop-view';ui.mount(r,{documents:s.isoSops,rights:rights,onAction:function(payload){try{var doc=payload&&payload.document,el=payload&&payload.element;if(!doc||!el)return;var u=CU()||{},actor=Q(u.displayName||u.name||u.fullName||u.user||u.username||u.login||'Benutzer'),updated=null,version=Q(doc.draftVersion||doc.currentVersion||doc.version||'1.0');if(el.hasAttribute('data-sop-new-version')){var parts=version.split('.'),major=parseInt(parts[0]||'1',10)||1,minor=(parseInt(parts[1]||'0',10)||0)+1,nextVersion=major+'.'+minor,newVersion=window.prompt('Neue SOP-Version',nextVersion);if(newVersion===null)return;newVersion=Q(newVersion);if(!newVersion)return window.alert('Versionsnummer fehlt.');var reason=window.prompt('Änderungsgrund','Prozess oder Inhalt aktualisiert');if(reason===null)return;updated=ui.applyWorkflowAction(doc,'new-version',{version:newVersion,actor:actor,reason:Q(reason)})}else if(el.hasAttribute('data-sop-review')){updated=ui.applyWorkflowAction(doc,'review',{version:version,actor:actor})}else if(el.hasAttribute('data-sop-approve')){var validFrom=window.prompt('Gültig ab',new Date().toISOString().slice(0,10));if(validFrom===null)return;updated=ui.applyWorkflowAction(doc,'approve',{version:version,actor:actor,validFrom:Q(validFrom)})}if(updated){var idx=s.isoSops.findIndex(function(x){return Q(x&&x.number)===Q(updated.number)});if(idx>=0)s.isoSops[idx]=updated;else s.isoSops.push(updated);save('RC1007 SOP-Workflow '+Q(updated.number));renderSop()}}catch(error){console.error('RC1007 SOP-Workflow',error);window.alert(error&&error.message?error.message:'SOP-Aktion konnte nicht ausgeführt werden.')}}})}catch(e){console.error('RC1007 SOP render',e);r.innerHTML='<div class="noaccess"><h2>SOP-Handbuch konnte nicht geladen werden</h2><p>Die Navigation bleibt verfügbar. Bitte die Fehlerdiagnose prüfen.</p></div>';r.className='content rc1007-sop-view'}}`;

for(const path of ['index.html','TESTVERSION.html']){
  patchFile(path,(src)=>{
    let out=src;
    if(!out.includes('assets/sop/rc1007-sop-catalog.js')){
      const head='</head>';
      if(!out.includes(head)) throw new Error(`RC1007: </head>-Anker in ${path} nicht gefunden`);
      out=out.replace(head,sopAssets+head);
    }
    if(!out.includes("r.className='content rc1007-sop-view'")){
      if(!out.includes(legacyRender)) throw new Error(`RC1007: zentraler renderSop-Anker in ${path} nicht gefunden`);
      out=out.replace(legacyRender,rc1007Render);
    }
    return out;
  });
}
