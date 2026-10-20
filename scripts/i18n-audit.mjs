import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT=process.cwd();
const TRACE=process.env.EXPORTHUB_I18N_TRACE==='1';
function diag(stage){if(TRACE)console.error('[I18N-AUDIT] '+stage+' heap='+Math.round(process.memoryUsage().heapUsed/1048576)+'MB')}
diag('startup');
const LANGS=['de','en','pl','es','fr','it'];
const STRICT=process.argv.includes('--strict');
const JSON_MODE=process.argv.includes('--json');
const SCOPE_ARG=process.argv.find(arg=>arg.startsWith('--scope='));
const SCOPE_REL=SCOPE_ARG?String(SCOPE_ARG.slice('--scope='.length)).replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/$/,''):'';
const SCOPE_ROOT=SCOPE_REL?path.resolve(ROOT,SCOPE_REL):ROOT;
if(SCOPE_REL&&SCOPE_ROOT!==ROOT&&!SCOPE_ROOT.startsWith(ROOT+path.sep))throw new Error('Ungültiger i18n-Audit-Scope: '+SCOPE_REL);
if(SCOPE_REL&&!fs.existsSync(SCOPE_ROOT))throw new Error('i18n-Audit-Scope fehlt: '+SCOPE_REL);

const EXCLUDED_DIRS=new Set(['.git','.github','node_modules','test','tests','docs','dist','dist-rc1018','android','migration','scripts']);
const EXCLUDED_FILES=[
  /^assets\/i18n\//,
  /^assets\/training-center\/catalog\//,
  /^assets\/training-center\/scenarios\//,
  /^assets\/rc1177-release-notes\.js$/,
  /^assets\/rc1267-i18n\.js$/,
  /^scripts\/i18n-audit\.mjs$/
];
const SCAN_EXT=new Set(['.html','.js','.mjs','.cjs']);

const GERMAN_HINT=/\b(?:Abmelden|Abholung|Abholdatum|Abholtermin|Abbrechen|Aktivieren|Adresse|Anmelden|Anmeldung|Anzeigename|Archiv|Archiviert|Aufgabe|Aufgaben|Auswählen|Bearbeiten|Bereit|Bestätigen|Bitte|Drucken|Einstellungen|Empfänger|Erstellt|Fehler|Gewicht|Historie|Hinweis|Kunde|Kunden|Laden|Löschen|Nachbearbeitung|Passwort|Prüfen|Schließen|Sendung|Sendungen|Speichern|Spedition|Standort|Suche|Suchen|Überfällig|Unterlagen|Versand|Warnung|Weiter|Zurück|Öffnen|Warenbeschreibung|Zeitfenster|Verschlüsselung|Benutzername|Fälligkeit|Verantwortlich|Zugehörige|Einträge|Bereich|Aktion|Objekt|Verlader|Kennzeichen|Empfänger|Absender|Lieferschein|Rechnung|Dokumentart|hochladen|gespeichert|geladen|gelöscht|angelegt|verfügbar|freigegeben)\b|[äöüß]/i;
const UI_CONTEXT=/(?:innerHTML|outerHTML|textContent|innerText|insertAdjacentHTML|placeholder|aria-label|title\s*=|setAttribute\s*\(\s*['"](?:title|aria-label|placeholder)|alert\s*\(|confirm\s*\(|prompt\s*\(|toast|status\s*\(|showMessage|message|label|button|option|<button|<label|<h[1-6]|<th|<td|<span|<p|<div|<option)/i;
const KEY_LITERAL=/\b(?:common|login|profile|nav|dashboard|shipment|customer|task|document|mail|avis|pickup|public|safety|status|errors|history|settings|calendar|pallet|reports|admin)\.[a-zA-Z0-9_.-]+\b/;

function productionPath(rel){return /^(?:assets\/|api\/)/.test(rel)||/^[^/]+\.(?:html|js|mjs|cjs)$/.test(rel)}
function walk(dir,out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(EXCLUDED_DIRS.has(ent.name)||/^dist(?:-|$)/i.test(ent.name)||/^(?:releases|playwright-report|test-results|\.cache)$/.test(ent.name))continue;
    const abs=path.join(dir,ent.name),rel=path.relative(ROOT,abs).replace(/\\/g,'/');
    if(ent.isDirectory())walk(abs,out);
    else if(productionPath(rel)&&SCAN_EXT.has(path.extname(ent.name))&&!EXCLUDED_FILES.some(rx=>rx.test(rel)))out.push({abs,rel});
  }
  return out;
}
function compact(value){return String(value||'').replace(/\s+/g,' ').trim().slice(0,220)}
// Bounded linear scan: generated HTML contains multi-megabyte JS lines.
// Avoid unbounded quoted strings and backtracking quote expressions.
// Process giant quoted tokens directly from their source spans.
// Never append individual characters to retained rope strings.
function literalTexts(line,withOffsets=false){
  const values=[],limit=384,overlap=64,step=limit-overlap;
  function record(value,position){values.push(withOffsets?{value,position}:value)}
  function addRange(start,end){
    for(let pos=start;pos<end;pos+=step){
      const value=line.slice(pos,Math.min(end,pos+limit)).replace(/\\n/g,' ').trim();
      if(value)record(value,pos);
      if(pos+limit>=end)break;
    }
  }
  let quote='',start=0;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(!quote){
      if(ch==="'"||ch==='"'||ch.charCodeAt(0)===96){quote=ch;start=i+1}
      continue
    }
    if(ch==='\\'){i++;continue}
    if(ch===quote){addRange(start,i);quote=''}
  }
  if(quote&&start<line.length)addRange(start,line.length);
  let afterTag=-1;
  for(let i=0;i<line.length;i++){
    if(line[i]==='>'){afterTag=i+1;continue}
    if(line[i]==='<'){
      if(afterTag>=0&&i-afterTag<=384){const value=line.slice(afterTag,i).trim();if(value)record(value,afterTag)}
      afterTag=-1;
    }
    if(afterTag>=0&&i-afterTag>384)afterTag=-1
  }
  return values
}
function isNonUiPayloadLine(line){
  const head=line.slice(0,256);
  return /^\s*<script\b/i.test(head)&&/(?:type=["']application\/json|id=["']exporthub-canonical-modules)/i.test(head);
}
function scanVisibleGerman(file,source,registeredGerman){
  const rows=[],lines=source.split(/\r?\n/);
  lines.forEach((line,i)=>{
    if(isNonUiPayloadLine(line))return;
    if(TRACE&&line.length>10000)diag('german line '+file.rel+':'+(i+1)+' chars='+line.length);
    if(!UI_CONTEXT.test(line))return;
    if(/^\s*(?:\/\/|\*|\/\*)/.test(line))return;
    if(file.rel==='api/shared/rc1014-fixed-pickup-seed.js'&&/siteLabel\s*:/.test(line))return;
    const hits=literalTexts(line,true).filter(({value,position})=>{
      // A minified JS line may contain thousands of unrelated strings.
      // UI relevance must be established next to the literal, not anywhere on the line.
      const nearby=line.length<=2400?line:line.slice(Math.max(0,position-320),Math.min(line.length,position+512));
      return UI_CONTEXT.test(nearby)&&GERMAN_HINT.test(value)&&!/^[-_a-z0-9./:]+$/i.test(value)&&!registeredGerman.has(value)&&!/\b(?:tr|th)\s*\(/.test(value);
    });
    if(!hits.length)return;
    for(const hit of hits)rows.push({file:file.rel,line:i+1,literal:compact(hit.value),text:compact(line.length<=2400?line:line.slice(Math.max(0,hit.position-120),Math.min(line.length,hit.position+250)))})
  });
  return rows;
}
// Only report a translation key when it actually flows to a visible text sink.
// A key elsewhere on a large/minified line is not proof of raw key rendering.
function scanVisibleKeys(file,source){
  const rows=[],lines=source.split(/\r?\n/),seen=new Set();
  const directSink=/(?:\.(?:textContent|innerText|placeholder|title)|\b(?:textContent|innerText|placeholder|aria-label|title)|\[\s*['"](?:textContent|innerText|placeholder|title|aria-label)['"]\s*\])\s*=\s*$/i;
  const attrSink=/\bsetAttribute\s*\(\s*['"](?:title|aria-label|placeholder)['"]\s*,\s*$/i;
  const htmlKey=/(?:>\s*|\b(?:title|aria-label|placeholder)\s*=\s*['"])(?:common|login|profile|nav|dashboard|shipment|customer|task|document|mail|avis|pickup|public|safety|status|errors|history|settings|calendar|pallet|reports|admin)\.[a-zA-Z0-9_.-]+(?=\s*<|['"]|\s*$)/g;
  lines.forEach((line,i)=>{
    if(isNonUiPayloadLine(line)||!KEY_LITERAL.test(line)||!UI_CONTEXT.test(line))return;
    if(/^\s*(?:\/\/|\*|\/\*)/.test(line))return;
    for(const hit of literalTexts(line,true)){
      const value=hit.value.trim(),left=line.slice(Math.max(0,hit.position-150),hit.position).trimEnd();
      const rawKey=new RegExp('^(?:'+KEY_LITERAL.source+')$').test(value);
      const nearbySink=directSink.test(left)||attrSink.test(left);
      const plainHtml=rawKey&&/>\s*$/.test(left);
      const htmlString=htmlKey.test(value);
      htmlKey.lastIndex=0;
      if(!((rawKey&&(nearbySink||plainHtml))||htmlString))continue;
      const unique=i+':'+hit.position+':'+value;
      if(seen.has(unique))continue;seen.add(unique);
      rows.push({file:file.rel,line:i+1,literal:compact(value),text:compact(line.length<=2400?line:line.slice(Math.max(0,hit.position-120),Math.min(line.length,hit.position+250)))});
    }
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
function loadFeatureGerman(rel,globalName){
  const file=path.join(ROOT,rel);if(!fs.existsSync(file))return[];
  const sandbox={console,Intl,URL,setTimeout,clearTimeout};sandbox.globalThis=sandbox;
  vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:rel});
  const runtime=sandbox[globalName],pack=runtime&&runtime.packs&&runtime.packs.de;
  return pack&&typeof pack==='object'?Object.values(pack):[];
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
diag('before packs and walk');
const packs=loadPacks(),keys=keyAudit(packs),files=walk(SCOPE_ROOT),hardcoded=[],visibleKeys=[],apiDePath=path.join(ROOT,'api','shared','i18n','de.json'),apiDe=fs.existsSync(apiDePath)?JSON.parse(fs.readFileSync(apiDePath,'utf8')):{},featureGerman=loadFeatureGerman('assets/i18n/pack-notification.js','ExportHUBPackI18n'),trainingGerman=loadFeatureGerman('assets/training-center/i18n.js','ExportHubTrainingCenterI18n'),registeredGerman=new Set([...Object.values(packs.de),...Object.values(apiDe),...featureGerman,...trainingGerman].filter(v=>typeof v==='string'&&v.trim()));
diag('scan begin '+files.length+' files');
let scanN=0;
for(const file of files){
  if(TRACE)diag('START '+(++scanN)+' '+file.rel);
  const source=fs.readFileSync(file.abs,'utf8');
  hardcoded.push(...scanVisibleGerman(file,source,registeredGerman));
  visibleKeys.push(...scanVisibleKeys(file,source));
  if(TRACE)diag('END '+file.rel+' hardcoded='+hardcoded.length);
}
diag('scanning done');
const report={
  version:'RC1267',
  scope:SCOPE_REL||'.',
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
  console.log('Scope:',report.scope);
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
