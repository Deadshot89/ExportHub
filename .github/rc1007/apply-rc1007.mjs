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
