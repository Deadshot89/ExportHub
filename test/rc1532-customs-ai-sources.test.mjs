import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const knowledge=require('../api/shared/customs-knowledge.js');
const sources=require('../api/shared/customs-ai-sources.js');

function article(overrides={}){
  return Object.assign({
    id:'taric-basics',slug:'taric-grundlagen',title:'TARIC und Warentarifierung',
    summary:'TARIC bündelt Maßnahmen des EU-Zolltarifs.',
    content:'TARIC enthält Maßnahmen zu Zolltarif, Handelspolitik sowie Ein- und Ausfuhrbeschränkungen.',
    topics:['taric','hs-code','warentarifierung'],countries:['EU'],sourceName:'Europäische Kommission',
    sourceUrl:'https://taxation-customs.ec.europa.eu/online-services/online-services-and-databases-customs/eu-customs-tariff-taric_de',
    publishedAt:'',checkedAt:'2026-10-14',status:'published',updatedAt:'2026-10-14'
  },overrides);
}

test('RC1532 Wissen: veröffentlichte Artikel brauchen Quelle, HTTPS und Prüfdatum',()=>{
  assert.equal(knowledge.validateKnowledgeArticle(article()).valid,true);
  assert.equal(knowledge.validateKnowledgeArticle(article({sourceUrl:'http://example.com'})).valid,false);
  assert.equal(knowledge.validateKnowledgeArticle(article({sourceUrl:''})).valid,false);
  assert.equal(knowledge.validateKnowledgeArticle(article({checkedAt:''})).valid,false);
  assert.equal(knowledge.validateKnowledgeArticle(article({status:'draft',sourceUrl:'',checkedAt:''})).valid,true);
});

test('RC1532 Wissen: nur valide veröffentlichte Artikel werden als Wissensbasis angeboten',()=>{
  const rows=[article(),article({id:'draft',slug:'draft',status:'draft'}),article({id:'bad',slug:'bad',sourceUrl:'javascript:alert(1)'})];
  const published=knowledge.publishedArticles(rows);
  assert.deepEqual(published.map(row=>row.id),['taric-basics']);
});

test('RC1532 Quellen: deterministisches Matching priorisiert Frage und Kontext',()=>{
  const rows=[
    article(),
    article({id:'origin',slug:'ursprung',title:'Präferenzieller Ursprung',summary:'Präferenzursprung kann Zollvorteile ermöglichen.',content:'Die Regeln des jeweiligen Präferenzabkommens müssen erfüllt sein.',topics:['ursprung','praeferenz','ursprungserklaerung'],sourceUrl:'https://taxation-customs.ec.europa.eu/customs/rules-origin-goods/preferential-rules-origin_en'}),
    article({id:'atlas',slug:'atlas-ausfuhr',title:'ATLAS Ausfuhrverfahren',summary:'ATLAS unterstützt das elektronische Ausfuhrverfahren.',content:'Das Ausfuhrverfahren dient der Überführung von Unionswaren in die Ausfuhr.',topics:['atlas','abd','ausfuhrverfahren'],sourceName:'Deutscher Zoll',sourceUrl:'https://www.zoll.de/SharedDocs/Downloads/DE/Links-fuer-Inhaltseiten/Fachthemen/Zoelle/Atlas/va_atlas.pdf'})
  ];
  const out=sources.selectCustomsAiSources({question:'Brauche ich für diese Ausfuhr ein ABD in ATLAS?',context:{destinationCountry:'CH'},articles:rows,limit:2});
  assert.equal(out.length,2);
  assert.equal(out[0].id,'atlas');
  assert.ok(out.every(row=>row.sourceUrl.startsWith('https://')));
  assert.ok(out.every(row=>row.checkedAt==='2026-10-14'));
});

test('RC1532 Quellen: keine passende belastbare Quelle ergibt leere Liste statt erfundener Quelle',()=>{
  const out=sources.selectCustomsAiSources({question:'Wie ist die Mondzoll-Regel?',articles:[article()],limit:4,minScore:2});
  assert.deepEqual(out,[]);
});

test('RC1532 Quellen: Ausgabe ist begrenzt und enthält nur zitierbare Felder',()=>{
  const rows=Array.from({length:10},(_,index)=>article({id:'a'+index,slug:'a'+index,title:'TARIC '+index,privateNote:'intern'}));
  const out=sources.selectCustomsAiSources({question:'TARIC Warentarifierung',articles:rows,limit:3});
  assert.equal(out.length,3);
  assert.deepEqual(Object.keys(out[0]).sort(),['checkedAt','excerpt','id','publishedAt','sourceName','sourceUrl','title'].sort());
  assert.equal(JSON.stringify(out).includes('privateNote'),false);
});
