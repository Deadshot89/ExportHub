import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const knowledge=require('../api/shared/customs-knowledge.js');
const selector=require('../api/shared/customs-ai-sources.js');
const service=require('../api/shared/customs-ai-service.js');
const policy=require('../api/shared/customs-ai-policy.js');
const articles=JSON.parse(fs.readFileSync(new URL('../api/data/customs-knowledge.json',import.meta.url),'utf8'));
const question='Sendung von Deutschland nach Serbien Incoterms EXW. Deutschland ist Versender. Wer muss das ABD erstellen?';

test('Zoll KI 2.0: EXW-Frage findet ICC und EU-Ausführerdefinition',()=>{
 const sources=selector.selectCustomsAiSources({question,articles,limit:6,minScore:2});
 const ids=sources.map(source=>source.id);
 assert.ok(ids.includes('incoterms-exw-fca-export'),ids.join(', '));
 assert.ok(ids.includes('eu-customs-exporter-2018-1063'),ids.join(', '));
 assert.ok(sources.every(source=>/^https:\/\//.test(source.sourceUrl)));
});

test('Zoll KI 2.0: neue EXW-Artikel sind veröffentlicht und quellengeprüft',()=>{
 const published=knowledge.publishedArticles(articles);
 for(const id of ['incoterms-exw-fca-export','eu-customs-exporter-2018-1063','eu-export-declarant-representation']){
  const item=published.find(a=>a.id===id);
  assert.ok(item,id+' fehlt');
  assert.equal(item.checkedAt,'2026-11-04');
  assert.ok(item.sourceUrl.startsWith('https://'));
 }
});

test('Zoll KI 2.0: Zuständigkeitsfragen erzwingen sachlich getrennte Rollen und Antwortgliederung',()=>{
 const instructions=policy.buildSystemInstructions('de');
 for(const phrase of ['vertragliche Organisation','zollrechtlichen Ausführer','Anmelder oder Zollvertreter','vertragliche Kostenpflicht','## Kurzantwort','## Wer macht was?','## Vorgehen im Warenausgang']){
  assert.ok(instructions.includes(phrase),phrase);
 }
 assert.match(instructions,/nicht automatisch zollrechtlicher Ausführer/);
 assert.match(instructions,/keine Tabellen/);
});

test('Zoll KI 2.0: EXW-Frage wird als Fachfrage an geprüfte Quellen geroutet',async()=>{
 let seen=null;
 const result=await service.answerCustomsQuestion({
  question,
  articles,
  askModel:async input=>{
   seen=input;
   return {ok:true,answer:'## Kurzantwort\nDer Käufer organisiert die Ausfuhr [[incoterms-exw-fca-export]].\n\n## Wer macht was?\n- EU-Ausführer separat bestimmen [[eu-customs-exporter-2018-1063]].',
    citations:['incoterms-exw-fca-export','eu-customs-exporter-2018-1063'],
    modelInfo:{provider:'test',model:'fixture'}};
  }
 });
 assert.equal(result.ok,true);
 assert.equal(result.mode,'ai');
 assert.equal(result.uncertainty,false);
 assert.ok(seen.sources.some(s=>s.id==='incoterms-exw-fca-export'));
 assert.ok(seen.sources.some(s=>s.id==='eu-customs-exporter-2018-1063'));
 assert.deepEqual(result.sources.map(s=>s.id),['incoterms-exw-fca-export','eu-customs-exporter-2018-1063']);
});

test('Zoll KI 2.0: Antwortdarstellung verwendet ausschließlich sichere DOM-Textknoten',()=>{
 const ui=fs.readFileSync(new URL('../assets/rc1532-customs-ai.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../assets/rc1532-customs-ai.css',import.meta.url),'utf8');
 assert.match(ui,/function renderAnswer\(host,raw\)/);
 assert.match(ui,/renderAnswer\(answer,/);
 assert.match(ui,/d\.createTextNode\(/);
 assert.match(ui,/rc1532-answer-list/);
 assert.match(ui,/rc1532-answer-section/);
 assert.doesNotMatch(ui,/\.innerHTML\s*=/);
 assert.match(css,/\.rc1532-answer-section/);
 assert.match(css,/@media\s*\(max-width:\s*700px\)/);
});
