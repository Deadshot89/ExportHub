import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const service=require('../api/shared/customs-ai-service.js');

function invoice(){return{
 header:{invoiceNumber:'INV-4711',destinationCountry:'CH',invoiceTotal:500,currency:'EUR'},
 groups:[{commodityCode:'39269097',originCountry:'DE',value:300,currency:'EUR',status:'complete',positionRefs:['10']},{commodityCode:'73181595',originCountry:'CN',value:200,currency:'EUR',status:'complete',positionRefs:['20']}],
 unassigned:[],totals:{invoiceTotal:500,accountedTotal:500,difference:0,currency:'EUR'},review:{complete:true,unassignedCount:0,missingHsCount:0,missingOriginCount:0,missingValueCount:0}
}}
const articles=[{
 id:'pref',slug:'praeferenz',title:'Präferenzieller Ursprung',summary:'Präferenzursprung kann Zollvorteile ermöglichen.',content:'Die einschlägigen Regeln des Abkommens müssen erfüllt werden.',topics:['ursprung','praeferenz','schweiz'],countries:['EU','CH'],sourceName:'EU-Kommission',sourceUrl:'https://taxation-customs.ec.europa.eu/customs/rules-origin-goods/preferential-rules-origin_en',publishedAt:'',checkedAt:'2026-10-14',status:'published',updatedAt:'2026-10-14'
}];

test('RC1532 Service: Rechnungsfakt wird ohne Provider beantwortet',async()=>{
 let called=0;
 const result=await service.answerCustomsQuestion({question:'Welche HS-Codes sind in der Rechnung?',invoiceAnalysis:invoice(),articles,askModel:async()=>{called++;throw new Error('darf nicht aufgerufen werden')}});
 assert.equal(result.ok,true);assert.equal(result.mode,'deterministic');assert.equal(called,0);
 assert.deepEqual(result.facts.codes,['39269097','73181595']);
 assert.equal(result.contextSummary.invoiceNumber,'INV-4711');
 assert.equal(result.contextSummary.groupCount,2);
});

test('RC1532 Service: Fachfrage nutzt nur verifizierte Quellen und gefilterte Citations',async()=>{
 let received=null;
 const askModel=async input=>{received=input;return{ok:true,answer:'Für Präferenzfragen gilt die geprüfte Quelle [[pref]].',citations:['pref'],modelInfo:{provider:'test',model:'test-model'}}};
 const result=await service.answerCustomsQuestion({question:'Welche Präferenzregel muss ich für die Schweiz prüfen?',destinationCountry:'CH',invoiceAnalysis:invoice(),articles,askModel,now:'2026-10-14T10:00:00.000Z'});
 assert.equal(result.ok,true);assert.equal(result.mode,'ai');assert.equal(result.uncertainty,false);
 assert.deepEqual(result.sources.map(s=>s.id),['pref']);
 assert.equal(result.checkedAt,'2026-10-14');
 assert.equal(received.sources.length,1);assert.equal(received.context.invoice.invoiceNumber,'INV-4711');
});

test('RC1532 Service: Modellantwort ohne Citation zeigt keine Kandidatenquelle als Beleg',async()=>{
 const result=await service.answerCustomsQuestion({question:'Welche Präferenzregel muss ich für die Schweiz prüfen?',destinationCountry:'CH',invoiceAnalysis:invoice(),articles,askModel:async()=>({ok:true,answer:'Allgemeine Einordnung ohne Quellenmarker.',citations:[],modelInfo:{provider:'test',model:'test-model'}})});
 assert.equal(result.ok,true);assert.equal(result.mode,'ai');assert.equal(result.uncertainty,true);
 assert.deepEqual(result.sources,[]);
});

test('RC1532 Service: keine geprüfte Quelle ruft Provider nicht auf',async()=>{
 let called=0;
 const result=await service.answerCustomsQuestion({question:'Was ist die Mondzoll-Regel?',invoiceAnalysis:invoice(),articles,askModel:async()=>{called++;return{ok:true}}});
 assert.equal(called,0);assert.equal(result.ok,true);assert.equal(result.mode,'no-source');assert.equal(result.uncertainty,true);
 assert.deepEqual(result.sources,[]);assert.match(result.answer,/keine geprüfte Quelle/i);
});

test('RC1532 Service: Providerfehler bleibt recoverable und Quellen bleiben sichtbar',async()=>{
 const result=await service.answerCustomsQuestion({question:'Welche Präferenzregel muss ich für die Schweiz prüfen?',invoiceAnalysis:invoice(),articles,askModel:async()=>({ok:false,code:'AI_TIMEOUT',recoverable:true,message:'timeout',citations:[]})});
 assert.equal(result.ok,false);assert.equal(result.code,'AI_TIMEOUT');assert.equal(result.recoverable,true);
 assert.equal(result.sources.length,1);assert.equal(result.uncertainty,true);
});

test('RC1532 Service: Kontextzusammenfassung enthält keine Gruppenwerte oder Secrets',async()=>{
 const input=invoice();input.secret='DO-NOT-LEAK';input.groups[0].internal='HIDDEN';
 const result=await service.answerCustomsQuestion({question:'Welche HS-Codes sind in der Rechnung?',reference:'ABC123',invoiceAnalysis:input,articles});
 const serialized=JSON.stringify(result.contextSummary);
 assert.equal(result.contextSummary.reference,'ABC123');assert.doesNotMatch(serialized,/DO-NOT-LEAK|HIDDEN|300/);
});

test('RC1532 Service: leere oder zu lange Frage wird vor jeder KI-Nutzung abgewiesen',async()=>{
 const empty=await service.answerCustomsQuestion({question:'   ',invoiceAnalysis:invoice(),articles});
 assert.equal(empty.ok,false);assert.equal(empty.code,'QUESTION_REQUIRED');
 const long=await service.answerCustomsQuestion({question:'x'.repeat(2501),invoiceAnalysis:invoice(),articles});
 assert.equal(long.ok,false);assert.equal(long.code,'QUESTION_TOO_LONG');
});
