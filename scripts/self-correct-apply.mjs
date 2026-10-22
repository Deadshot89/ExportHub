// RC1630 "Selbst korrigieren": applies the text changes of one claimed job to assets/i18n/*.json.
// Usage: node scripts/self-correct-apply.mjs <job.json> <summary.md>
// Re-checks every change against the packs on main (key must exist, placeholders kept, no markup,
// German texts that are fixed in the page source stay locked) and writes a summary for the pull request.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const rules=require('../api/shared/self-correct.js');
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const [jobFile,summaryFile]=process.argv.slice(2);
if(!jobFile||!summaryFile){console.error('Aufruf: node scripts/self-correct-apply.mjs <job.json> <summary.md>');process.exit(2)}

const job=JSON.parse(fs.readFileSync(jobFile,'utf8'));
if(job.type!=='texts')throw new Error('Nur Textaufträge können angewendet werden.');
const {changes,reason}=rules.normalizeTextChanges(job.changes,job.reason);
const raw={},packs={};
for(const lang of rules.LANGUAGES){
  raw[lang]=fs.readFileSync(path.join(ROOT,'assets/i18n',lang+'.json'),'utf8');
  packs[lang]=JSON.parse(raw[lang]);
}
const sources=['index.html','TESTVERSION.html'].filter(f=>fs.existsSync(path.join(ROOT,f))).map(f=>fs.readFileSync(path.join(ROOT,f),'utf8'));
for(const f of fs.readdirSync(path.join(ROOT,'assets')))if(f.endsWith('.js'))sources.push(fs.readFileSync(path.join(ROOT,'assets',f),'utf8'));

let result;
try{result=rules.applyTextChanges(packs,changes,sources)}
catch(e){console.log('BLOCKED: '+e.message);process.exit(3)}
for(const lang of rules.LANGUAGES){
  const next=rules.serializePack(result.packs[lang],raw[lang]);
  if(next!==raw[lang])fs.writeFileSync(path.join(ROOT,'assets/i18n',lang+'.json'),next);
}
const cell=v=>String(v).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
const lines=['| Sprache | Schlüssel | Vorher | Nachher |','| --- | --- | --- | --- |',...result.applied.map(a=>`| ${a.lang} | \`${a.key}\` | ${cell(a.before)} | ${cell(a.after)} |`)];
fs.writeFileSync(summaryFile,`**Begründung:** ${cell(reason)}\n\n${lines.join('\n')}\n`);
console.log(`APPLIED: ${result.applied.length} Textänderung(en)`);
