import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const LANGS=['de','en','pl','es','fr','it'];
const STRICT=process.argv.includes('--strict');
const JSON_MODE=process.argv.includes('--json');

const EXCLUDED_DIRS=new Set(['.git','.github','node_modules','test','tests','docs','dist','dist-rc1018','android','migration','scripts']);
const EXCLUDED_FILES=[
  /^assets\/i18n\//,
  /^assets\/rc1177-release-notes\.js$/,
  /^assets\/rc1267-i18n\.js$/,
  /^scripts\/i18n-audit\.mjs$/
];
const SCAN_EXT=new Set(['.html','.js','.mjs','.cjs']);

const GERMAN_HINT=/\b(?:Abmelden|Abholung|Abholdatum|Abholtermin|Abbrechen|Aktivieren|Adresse|Anmelden|Anmeldung|Anzeigename|Archiv|Archiviert|Aufgabe|Aufgaben|Auswählen|Bearbeiten|Bereit|Bestätigen|Bitte|Drucken|Einstellungen|Empfänger|Erstellt|Fehler|Gewicht|Historie|Hinweis|Kunde|Kunden|Laden|Löschen|Nachbearbeitung|Passwort|Prüfen|Schließen|Sendung|Sendungen|Speichern|Spedition|Standort|Suche|Suchen|Überfällig|Unterlagen|Versand|Warnung|Weiter|Zurück|Öffnen|Warenbeschreibung|Zeitfenster|Verschlüsselung|Benutzername|Fälligkeit|Verantwortlich|Zugehörige|Einträge|Bereich|Aktion|Objekt|Verlader|Kennzeichen|Empfänger|Absender|Lieferschein|Rechnung|Dokumentart|hochladen|gespeichert|geladen|gelöscht|angelegt|verfügbar|freigegeben)\b|[äöüß]/i;
const UI_CONTEXT=/(?:innerHTML|outerHTML|textContent|innerText|insertAdjacentHTML|placeholder|aria-label|title\s*=|setAttribute\s*\(\s*['"](?:title|aria-label|placeholder)|alert\s*\(|confirm\s*\(|prompt\s*\(|toast|status\s*\(|showMessage|message|label|button|option|<button|<label|<h[1-6]|<th|<td|<span|<p|<div|<option)/i;
const KEY_LITERAL=/\b(?:common|login|profile|nav|dashboard|shipment|customer|task|document|mail|avis|pickup|public|safety|status|errors|history|settings|calendar|pallet|reports|admin)\.[a-zA-Z0-9_.-]+\b/;

function productionPath(rel){return /^(?:assets\/|api\/)/.test(rel)||/^[^/]+\\.(?:html|js|mjs|cjs)$/.test(rel)}
function walk(dir,out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(EXCLUDED_DIRS.has(ent.name))continue;
    const abs=path.join(dir,ent.name),rel=path.relative(ROOT,abs).replace(/\\/g,'/');
    if(ent.isDirectory())walk(abs,out);
    else if(productionPath(rel)&&SCAN_EXT.has(path.extname(ent.name))&&!EXCLUDED_FILES.some(rx=>rx.test(rel)))out.push({abs,rel});
  }
  return out;
}
function lineNo(source,index){let n=1;for(let i=0;i<index;i++)if(source.charCodeAt(i)===10)n++;return n}
function compact(value){return String(value||'').replace(/\s+/g,' ').trim().slice(0,220)}
function likelyVisible(line){
  if(!GERMAN_HINT.test(line))return false;
  if(/^\s*(?:\/\/|\*|\/\*)/.test(line))return false;
  if(/(?:console\.|throw\s+new\s+Error|\.code\s*=|test\(|assert\.|RegExp\(|\/[^/]+\/)/.test(line)&&!UI_CONTEXT.test(line))return false;
  return UI_CONTEXT.test(line);
}
function literalTexts(line){
  const values=[],rx=/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|\`((?:\\.|[^\`\\])*)\`/g;let m;
  while((m=rx.exec(line))){const value=(m[1]??m[2]??m[3]??'').replace(/\\n/g,' ').trim();if(value)values.push(value)}
  const tagRx=/>\s*([^<>]+?)\s*</g;while((m=tagRx.exec(line))){const value=String(m[1]||'').trim();if(value)values.push(value)}
  return values
}
function scanVisibleGerman(file,source,registeredGerman){
  const rows=[],lines=source.split(/\r?\n/);
  lines.forEach((line,i)=>{
    if(!UI_CONTEXT.test(line))return;
    if(/^\s*(?:\/\/|\*|\/\*)/.test(line))return;
    if(file.rel==='api/shared/rc1014-fixed-pickup-seed.js'&&/siteLabel\s*:/.test(line))return;
    const hits=literalTexts(line).filter(value=>GERMAN_HINT.test(value)&&!/^[-_a-z0-9./:]+$/i.test(value)&&!registeredGerman.has(value));
    if(!hits.length)return;
    for(const literal of hits)rows.push({file:file.rel,line:i+1,literal:compact(literal),text:compact(line)});
  });
  return rows;
}
function scanVisibleKeys(file,source){
  const rows=[],lines=source.split(/\r?\n/);
  lines.forEach((line,i)=>{
    if(!KEY_LITERAL.test(line)||!UI_CONTEXT.test(line))return;
    if(/data-i18n(?:-[a-z]+)?\s*=/.test(line))return;
    const visibleLiteral=/(?:>|textContent\s*=|innerText\s*=|placeholder\s*=|aria-label\s*=|title\s*=)\s*['"`]?(?:common|login|profile|nav|dashboard|shipment|customer|task|document|mail|avis|pickup|public|safety|status|errors|history|settings|calendar|pallet|reports|admin)\.[a-zA-Z0-9_.-]+/i.test(line);
    if(!visibleLiteral)return;
    rows.push({file:file.rel,line:i+1,text:compact(line)});
  });
  return rows;
}
function loadPacks(){
  const packs={};
  for(const lang of LANGS){
    const p=path.join(ROOT,'assets','i18n',lang+'.json');
    if(!fs.existsSync(p))throw new Error('Sprachdatei fehlt: '+p);
    packs[lang]=JSON.parse(fs.readFileSync(p,'utf8'));
  }
  return packs;
}
function keyAudit(packs){
  const base=Object.keys(packs.de).sort(),issues=[];
  for(const lang of LANGS){
    const keys=Object.keys(packs[lang]).sort();
    const missing=base.filter(k=>!Object.prototype.hasOwnProperty.call(packs[lang],k));
    const extra=keys.filter(k=>!Object.prototype.hasOwnProperty.call(packs.de,k));
    const empty=keys.filter(k=>typeof packs[lang][k]!=='string'||!packs[lang][k].trim());
    if(missing.length||extra.length||empty.length)issues.push({language:lang,missing,extra,empty});
  }
  return{baseKeyCount:base.length,issues}
}
const packs=loadPacks(),keys=keyAudit(packs),files=walk(ROOT),hardcoded=[],visibleKeys=[],apiDePath=path.join(ROOT,'api','shared','i18n','de.json'),apiDe=fs.existsSync(apiDePath)?JSON.parse(fs.readFileSync(apiDePath,'utf8')):{},registeredGerman=new Set([...Object.values(packs.de),...Object.values(apiDe)].filter(v=>typeof v==='string'&&v.trim()));
for(const file of files){
  const source=fs.readFileSync(file.abs,'utf8');
  hardcoded.push(...scanVisibleGerman(file,source,registeredGerman));
  visibleKeys.push(...scanVisibleKeys(file,source));
}
const report={
  version:'RC1267',
  languages:LANGS,
  scannedFiles:files.length,
  translationKeys:keys.baseKeyCount,
  keyIssues:keys.issues,
  missingTranslationKeyCount:keys.issues.reduce((n,x)=>n+x.missing.length,0),
  extraTranslationKeyCount:keys.issues.reduce((n,x)=>n+x.extra.length,0),
  emptyTranslationCount:keys.issues.reduce((n,x)=>n+x.empty.length,0),
  visibleTranslationKeyCount:visibleKeys.length,
  hardcodedGermanUiCount:hardcoded.length,
  visibleTranslationKeys:visibleKeys.slice(0,500),
  hardcodedGermanUi:hardcoded.slice(0,2000)
};
if(JSON_MODE)process.stdout.write(JSON.stringify(report,null,2)+'\n');
else{
  console.log('ExportHUB RC1267 i18n audit');
  console.log('Sprachen:',LANGS.join(', '));
  console.log('Gescannte produktive Dateien:',report.scannedFiles);
  console.log('Translation Keys:',report.translationKeys);
  console.log('Fehlende Keys:',report.missingTranslationKeyCount);
  console.log('Zusätzliche/falsche Keys:',report.extraTranslationKeyCount);
  console.log('Leere Übersetzungen:',report.emptyTranslationCount);
  console.log('Sichtbare Translation-Key-Literale:',report.visibleTranslationKeyCount);
  console.log('Hardcodierte deutsche UI-Kandidaten:',report.hardcodedGermanUiCount);
  const byFile=Object.entries(hardcoded.reduce((acc,row)=>{acc[row.file]=(acc[row.file]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1]);
  console.log('Hardcoded nach Datei:');
  for(const [file,count] of byFile.slice(0,40))console.log('  '+String(count).padStart(4,' ')+'  '+file);
  for(const row of hardcoded.slice(0,80))console.log('  HARD '+row.file+':'+row.line+' '+row.text);
  for(const row of visibleKeys.slice(0,40))console.log('  KEY  '+row.file+':'+row.line+' '+row.text);
}
const failed=report.missingTranslationKeyCount||report.extraTranslationKeyCount||report.emptyTranslationCount||report.visibleTranslationKeyCount||report.hardcodedGermanUiCount;
if(STRICT&&failed)process.exitCode=2;
