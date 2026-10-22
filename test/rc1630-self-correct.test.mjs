import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const rules=require('../api/shared/self-correct.js');
const api=fs.readFileSync('api/self-correct/index.js','utf8');
const autofix=fs.readFileSync('api/diagnostic-autofix/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/self-correct.yml','utf8');
const ui=fs.readFileSync('assets/rc1630-self-correct.js','utf8');
const menu=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function packs(){return{de:{'shipment.title':'Sendung {ref}','legacyUi.save':'Speichern','x.free':'Freier Text'},en:{'shipment.title':'Shipment {ref}','legacyUi.save':'Save','x.free':'Free text'},pl:{},es:{},fr:{},it:{}}}

test('RC1630: Textänderungen werden auf Form, Menge und Begründung geprüft',()=>{
  assert.throws(()=>rules.normalizeTextChanges([],'Tippfehler'),/Keine Textänderung/);
  assert.throws(()=>rules.normalizeTextChanges([{lang:'en',key:'x.free',value:'a'}],''),/warum/);
  assert.throws(()=>rules.normalizeTextChanges([{lang:'xx',key:'x.free',value:'a'}],'Tippfehler'),/Unbekannte Sprache/);
  assert.throws(()=>rules.normalizeTextChanges([{lang:'en',key:'../etc',value:'a'}],'Tippfehler'),/Ungültiger Textschlüssel/);
  assert.throws(()=>rules.normalizeTextChanges([{lang:'en',key:'x.free',value:'  '}],'Tippfehler'),/leer/);
  assert.throws(()=>rules.normalizeTextChanges([{lang:'de',key:'legacyUi.save',value:'Sichern'}],'Tippfehler'),/steht fest in der Seite/);
  assert.throws(()=>rules.normalizeTextChanges(Array.from({length:21},(_,i)=>({lang:'en',key:'x.k'+i,value:'v'})),'Tippfehler'),/Höchstens 20/);
  assert.throws(()=>rules.normalizeTextChanges([{lang:'en',key:'x.free',value:'a'},{lang:'en',key:'x.free',value:'b'}],'Tippfehler'),/Doppelte/);
  const ok=rules.normalizeTextChanges([{lang:'EN',key:'x.free',value:'Free text!'}],' Tippfehler ');
  assert.deepEqual(ok,{changes:[{lang:'en',key:'x.free',value:'Free text!'}],reason:'Tippfehler'});
});

test('RC1630: nur vorhandene Schlüssel, Platzhalter bleiben, kein HTML, fester deutscher Seitentext bleibt gesperrt',()=>{
  assert.throws(()=>rules.applyTextChanges(packs(),[{lang:'en',key:'x.missing',value:'a'}],[]),/gibt es in en nicht/);
  assert.throws(()=>rules.applyTextChanges(packs(),[{lang:'en',key:'shipment.title',value:'Shipment'}],[]),/Platzhalter/);
  assert.throws(()=>rules.applyTextChanges(packs(),[{lang:'en',key:'x.free',value:'<img src=x onerror=alert(1)>'}],[]),/Zeichen < > sind in Texten nicht erlaubt/);
  assert.throws(()=>rules.applyTextChanges(packs(),[{lang:'en',key:'x.free',value:'x" onmouseover="alert(1)'}],[]),/Zeichen " sind/);
  assert.equal(rules.applyTextChanges(packs(),[{lang:'en',key:'x.free',value:'It’s „free“'}],[]).packs.en['x.free'],'It’s „free“');
  assert.throws(()=>rules.applyTextChanges(packs(),[{lang:'de',key:'x.free',value:'Neu'}],['<b>Freier Text</b>']),/steht fest im Seitenquelltext/);
  assert.throws(()=>rules.applyTextChanges(packs(),[{lang:'en',key:'x.free',value:'Free text'}],[]),/nichts hochzuladen/);
  const r=rules.applyTextChanges(packs(),[{lang:'en',key:'shipment.title',value:'Consignment {ref}'},{lang:'de',key:'x.free',value:'Neuer Text'}],['anderer Quelltext']);
  assert.equal(r.packs.en['shipment.title'],'Consignment {ref}');
  assert.equal(r.packs.de['x.free'],'Neuer Text');
  assert.deepEqual(r.applied.map(a=>a.before),['Shipment {ref}','Freier Text']);
});

test('RC1630: Packs werden byte-genau zurückgeschrieben (nur geänderte Zeilen im PR)',()=>{
  for(const lang of rules.LANGUAGES){
    const raw=fs.readFileSync(`assets/i18n/${lang}.json`,'utf8');
    assert.equal(rules.serializePack(JSON.parse(raw),raw),raw,lang);
  }
});

test('RC1630: Apply-Skript ändert nur die betroffene Zeile und blockiert sonst mit Begründung',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rc1630-'));
  const en=fs.readFileSync('assets/i18n/en.json','utf8');
  try{
    fs.writeFileSync(path.join(dir,'ok.json'),JSON.stringify({type:'texts',reason:'Test',changes:[{lang:'en',key:'common.save',value:'Save now'}]}));
    const out=execFileSync(process.execPath,['scripts/self-correct-apply.mjs',path.join(dir,'ok.json'),path.join(dir,'ok.md')],{encoding:'utf8'});
    assert.match(out,/APPLIED: 1/);
    const after=fs.readFileSync('assets/i18n/en.json','utf8');
    assert.equal(after,en.replace('"common.save": "Save"','"common.save": "Save now"'));
    assert.match(fs.readFileSync(path.join(dir,'ok.md'),'utf8'),/\| en \| `common.save` \| Save \| Save now \|/);
    fs.writeFileSync('assets/i18n/en.json',en);
    fs.writeFileSync(path.join(dir,'bad.json'),JSON.stringify({type:'texts',reason:'Test',changes:[{lang:'de',key:'common.save',value:'Sichern'}]}));
    let blocked='';
    try{execFileSync(process.execPath,['scripts/self-correct-apply.mjs',path.join(dir,'bad.json'),path.join(dir,'bad.md')],{encoding:'utf8'})}catch(e){blocked=String(e.stdout);assert.equal(e.status,3)}
    assert.match(blocked,/BLOCKED: .*Seitenquelltext/);
  }finally{fs.writeFileSync('assets/i18n/en.json',en);fs.rmSync(dir,{recursive:true,force:true})}
});

test('RC1630: API ist Global-Admin-geschützt, Workflow-Rückrufe nur per GitHub-OIDC von self-correct.yml',async()=>{
  assert.match(api,/validateGlobalAdmin\(req, payload, env\)/);
  assert.match(api,/OIDC_AUDIENCE = 'exporthub-self-correct'/);
  assert.match(api,/githubOidcAuthorized\(req, WORKFLOW, \['workflow_dispatch'\], OIDC_AUDIENCE\)/);
  assert.match(autofix,/aud\.includes\(audience\|\|OIDC_AUDIENCE\)/);
  assert.match(autofix,/module\.exports\.helpers=Object\.freeze/);
  assert.doesNotMatch(ui,/EXPORTHUB_GITHUB_AUTOFIX_TOKEN|OPENAI_API_KEY/);
  const handler=require('../api/self-correct/index.js');
  for(const action of ['claim','workflow-status']){
    const ctx={log:{error(){}}};
    await handler(ctx,{method:'POST',headers:{},body:{action,jobId:'SC-1-ABCDEF',status:'pr-open'}});
    assert.equal(ctx.res.status,401,action);
  }
  for(const action of ['submit-texts','revert','list']){
    const ctx={log:{error(){}}};
    await handler(ctx,{method:'POST',headers:{},body:{action}});
    assert.equal(ctx.res.status,401,action);
    assert.equal(JSON.parse(ctx.res.body).code,'AUTH_REQUIRED');
  }
  const fn=JSON.parse(fs.readFileSync('api/self-correct/function.json','utf8')).bindings.find(b=>b.type==='httpTrigger');
  assert.equal(fn.route,'self-correct');
  assert.deepEqual(fn.methods,['post','options']);
});

test('RC1630: freie Fehlerbeschreibung läuft über den bestehenden, getesteten Autofix-PR-Weg',()=>{
  assert.match(autofix,/action==='request-manual'\)result=await requestManualAutofix/);
  assert.match(autofix,/async function requestManualAutofix\(req,payload,env\)\{\n const admin=await validateGlobalAdmin/);
  assert.match(autofix,/category:'manual'/);
  assert.match(autofix,/return requestAutofix\(req,\{diagnosticId:id\},env,admin\)/);
  assert.match(ui,/action:'request-manual'/);
});

test('RC1630: Workflow öffnet nur PRs, ändert nur i18n-Dateien und testet vorher',()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\bpush:\n/);
  assert.match(workflow,/audience=exporthub-self-correct/);
  assert.match(workflow,/grep -Ev '\^assets\/i18n\/\(de\|en\|pl\|es\|fr\|it\)\\\.json\$'/);
  assert.match(workflow,/npm run verify:i18n\n\s+npm test/);
  assert.match(workflow,/gh pr create --base main/);
  assert.doesNotMatch(workflow,/git push origin (HEAD:)?(refs\/heads\/)?main\b/);
  assert.match(workflow,/startswith\("self-correct\/"\)/);
});

test('RC1630: Oberfläche als IT-Reiter, nur für Admins, in sechs Sprachen und im Build',()=>{
  assert.match(menu,/function selfCorrectTab\(\)/);
  assert.match(menu,/sc\.allowed\(\)/);
  assert.match(menu,/ICONS\.selfcorrect=/);
  assert.match(ui,/function allowed\(\)\{return isAdmin\(\)&&!isDemo\(\)\}/);
  assert.match(ui,/data-rc1630-self-correct/);
  const win={};new Function('window',fs.readFileSync('assets/i18n/rc1630-self-correct.js','utf8'))(win);
  const p=win.ExportHUBSelfCorrect1630I18n.packs,keys=Object.keys(p.de).sort();
  assert.deepEqual(Object.keys(p).sort(),['de','en','es','fr','it','pl']);
  for(const l of Object.keys(p))assert.deepEqual(Object.keys(p[l]).sort(),keys,l);
  for(const k of ['s_queued','s_claimed','s_running','s_pr_open','s_merged','s_closed','s_failed'])assert.ok(p.de[k],k);
  assert.match(build,/RC1630_SELF_CORRECT_SCRIPT_TAG/);
  assert.match(build,/'assets\/rc1630-self-correct\.js',\n  'assets\/i18n\/rc1630-self-correct\.js',/);
});
