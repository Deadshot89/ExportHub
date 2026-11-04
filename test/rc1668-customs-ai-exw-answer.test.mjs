import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const knowledge=require('../api/shared/customs-knowledge.js');
const selector=require('../api/shared/customs-ai-sources.js');
const service=require('../api/shared/customs-ai-service.js');
const policy=require('../api/shared/customs-ai-policy.js');
const provider=require('../api/shared/customs-ai-provider.js');
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
 assert.deepEqual(new Set(result.sources.map(s=>s.id)),new Set(['incoterms-exw-fca-export','eu-customs-exporter-2018-1063']));
});

test('Zoll KI 2.0: Antwortdarstellung verwendet ausschließlich sichere DOM-Textknoten',()=>{
 const ui=fs.readFileSync(new URL('../assets/rc1532-customs-ai.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../assets/rc1532-customs-ai.css',import.meta.url),'utf8');
 assert.match(ui,/function renderAnswer\(host,raw,sources\)/);
 assert.match(ui,/renderAnswer\(answer,/);
 assert.match(ui,/d\.createTextNode\(/);
 assert.match(ui,/rc1532-answer-list/);
 assert.match(ui,/rc1532-answer-section/);
 assert.match(ui,/sourceAnchorId/);
 assert.match(ui,/rc1532-citation/);
 assert.match(ui,/rc1532-source-index/);
 assert.doesNotMatch(ui,/\.innerHTML\s*=/);
 assert.match(css,/\.rc1532-answer-section/);
 assert.match(css,/@media\s*\(max-width:\s*700px\)/);
});


test('Zoll KI 2.0: alte Offline-KI mit EXW-/FCA-/DAP-/DDP-Antwort ohne neue Provider-Aufrufe abgefangen',()=>{
 const ui=fs.readFileSync(new URL('../assets/rc1532-customs-ai.js',import.meta.url),'utf8');
 assert.match(ui,/function legacyIncotermsAnswer/);
 assert.match(ui,/function legacyCustomsIntercept/);
 assert.match(ui,/zollAiQuestion/);
 assert.match(ui,/zollAiAnswer/);
 assert.match(ui,/stopImmediatePropagation/);
 assert.match(ui,/Offline-Schnellhilfe/);
 assert.match(ui,/exw:|exw\s*:/);
 assert.match(ui,/fca:|fca\s*:/);
 assert.match(ui,/dap:|dap\s*:/);
 assert.match(ui,/ddp:|ddp\s*:/);
 const offline=ui.slice(ui.indexOf('function legacyIncotermsAnswer'),ui.indexOf('function show(active)'));
 assert.doesNotMatch(offline,/fetch\s*\(/);
});


test('Zoll KI 2.0: Klick auf historisches KI-fragen-Feld rendert eine EXW-Fachantwort',()=>{
 const runtime=fs.readFileSync(new URL('../assets/rc1532-customs-ai.js',import.meta.url),'utf8');
 function node(tag){
  let own='';
  const n={tagName:tag,children:[],attributes:{},className:'',
   appendChild(child){this.children.push(child);return child},
   removeChild(child){this.children.splice(this.children.indexOf(child),1);return child},
   get firstChild(){return this.children[0]||null},
   set textContent(value){own=String(value);this.children.length=0},
   get textContent(){return own+this.children.map(child=>child.textContent||'').join('')},
   setAttribute(key,value){this.attributes[key]=String(value)}
  };
  n.classList={add(){},contains(){return false},toggle(){}};
  return n;
 }
 const textarea={value:question},answer=node('div');
 let clickListener=null;
 const document={
  getElementById(id){if(id==='zollAiQuestion')return textarea;if(id==='zollAiAnswer')return answer;return null},
  createElement:node,
  createTextNode(value){const item=node('#text');item.textContent=value;return item},
  addEventListener(name,listener,capture){if(name==='click'&&capture)clickListener=listener}
 };
 const window={document,addEventListener(){},ExportHUBRC1532I18n:{language(){return 'de'},t(key){return key}}};
 vm.runInNewContext(runtime,{window},{timeout:1000});
 assert.equal(typeof clickListener,'function');
 let prevented=false,stopped=false;
 clickListener({target:{closest(){return {}}},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
 assert.equal(prevented,true);assert.equal(stopped,true);
 assert.match(answer.textContent,/EXW/);
 assert.match(answer.textContent,/Käufer organisiert/);
 assert.match(answer.textContent,/EU-Ausführer/);
 assert.match(answer.textContent,/ICC/);
 assert.match(answer.textContent,/AEAT/);
 assert.match(answer.textContent,/\[3\]/);
 assert.doesNotMatch(answer.textContent,/Passende Wissensbereiche/);

 textarea.value='Was ist der Unterschied zwischen EXW und FCA?';
 clickListener({target:{closest(){return {}}},preventDefault(){},stopImmediatePropagation(){}});
 assert.match(answer.textContent,/EXW/);
 assert.match(answer.textContent,/FCA/);
 assert.match(answer.textContent,/Käufer organisiert/);
 assert.match(answer.textContent,/Verkäufer organisiert/);
});


test('Zoll KI 2.0: geänderte Zoll-KI-Assets erhalten neue Cache-Version für TESTSERVICE und Produktion',()=>{
 const build=fs.readFileSync(new URL('../.github/rc1532/build-three-env.mjs',import.meta.url),'utf8');
 assert.match(build,/rc1532-customs-ai\.css\?v=1668/);
 assert.match(build,/rc1532-customs-ai\.js\?v=1668/);
 assert.doesNotMatch(build,/rc1532-customs-ai\.(?:css|js)\?v=153[23]/);
});


test('Zoll KI 2.0: Provider fordert tatsächliche Quellen-ID statt nicht existierender S1-ID an',async()=>{
 const source=knowledge.publishedArticles(articles).find(item=>item.id==='incoterms-exw-fca-export');
 assert.ok(source);
 let body=null;
 const response=await provider.askCustomsModel({
  question,
  context:{destinationCountry:'RS'},
  sources:[{...source,excerpt:source.summary}],
  env:{EXPORTHUB_CUSTOMS_AI_API_KEY:'test-only-secret',EXPORTHUB_CUSTOMS_AI_MODEL:'gpt-6.1-sol'},
  fetchImpl:async(_url,options)=>{
   body=JSON.parse(options.body);
   return{ok:true,status:200,json:async()=>({
    output_text:'## Kurzantwort\nDer Käufer organisiert bei EXW die Ausfuhr [[incoterms-exw-fca-export]].'
   })};
  }
 });
 assert.equal(response.ok,true);
 assert.deepEqual(response.citations,['incoterms-exw-fca-export']);
 const prompt=body.input[0].content[0].text;
 assert.match(prompt,/Beispiel \[\[incoterms-exw-fca-export\]\]/);
 assert.match(prompt,/Erfinde keine Quell-IDs/);
 assert.doesNotMatch(prompt,/\[\[S1\]\]/);
 assert.doesNotMatch(JSON.stringify(body),/test-only-secret/);
});

test('Zoll KI 2.0: historischer Tab nutzt dieselben Eingabe-IDs wie der neue Abfang-Handler',()=>{
 const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const key of ['rc821ZollBody','zollAiQuestion','zollAiAnswer','askZollAi()']){
  assert.ok(index.includes(key),key+' fehlt in der bestehenden Website');
 }
});


test('Zoll KI 2.0: API HTTP 200 ohne vertrauenswürdigen Inhalt darf niemals als Belegt erscheinen',async()=>{
 const runtime=fs.readFileSync(new URL('../assets/rc1532-customs-ai.js',import.meta.url),'utf8');
 function node(tag){
  let own='';
  return {tagName:tag,children:[],className:'',attributes:{},
   appendChild(child){this.children.push(child);return child},
   removeChild(child){this.children.splice(this.children.indexOf(child),1);return child},
   get firstChild(){return this.children[0]||null},
   get textContent(){return own+this.children.map(x=>x.textContent||'').join('')},
   set textContent(value){own=String(value);this.children.length=0},
   setAttribute(key,value){this.attributes[key]=String(value)}
  }
 }
 const answer=node('div');answer.parentNode={hidden:true};
 const sources=node('div'),badge=node('span'),checked=node('span'),status=node('div'),button=node('button');
 let payload={};
 const elements={
  '[data-rc1532-answer]':answer,'[data-rc1532-sources]':sources,
  '[data-rc1532-badge]':badge,'[data-rc1532-checked]':checked,
  '[data-rc1532-status]':status,'[data-rc1532-ask]':button
 };
 const document={
  createElement:node,
  createTextNode(text){const n=node('#text');n.textContent=text;return n},
  querySelector(selector){return elements[selector]||null},
  getElementById(){return null},
  addEventListener(){}
 };
 const window={document,addEventListener(){},
  ExportHUBRC1532I18n:{language(){return 'de'},t(key){return key}},
  fetch:async()=>({ok:true,text:async()=>JSON.stringify(payload)})
 };
 vm.runInNewContext(runtime,{window},{timeout:1000});
 async function check(response,label,cls){
  payload=response;
  await window.ExportHUBRC1532CustomsAI.ask('Wer erstellt das ABD?');
  assert.equal(badge.textContent,label);
  assert.ok(badge.className.includes(cls),badge.className);
 }
 await check({},'uncertain','is-warning');
 await check({ok:true,answer:'Antwort ohne Beleg',uncertainty:false,sources:[]},'uncertain','is-warning');
 await check({ok:true,mode:'deterministic',evidence:'invoice-analysis',answer:'Geprüfte Rechnungsdaten',uncertainty:false,sources:[]},'grounded','is-ok');
 await check({ok:true,mode:'ai',answer:'Ein belegter Satz [[incoterms-exw-fca-export]]',uncertainty:false,
  sources:[{id:'incoterms-exw-fca-export',sourceUrl:'https://iccwbo.org/',title:'ICC'}]},'grounded','is-ok');
 await check({ok:false,answer:'API fehlgeschlagen',uncertainty:false,
  sources:[{id:'incoterms-exw-fca-export',sourceUrl:'https://iccwbo.org/',title:'ICC'}]},'uncertain','is-warning');
});
