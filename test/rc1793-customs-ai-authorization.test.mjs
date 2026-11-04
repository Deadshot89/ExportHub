import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../api/customs-ai/index.js',import.meta.url),'utf8');

function harness(user){
 const calls=[];
 const auth={
  isAdmin:person=>!!person?.admin,
  validateSession:async()=>user?{user}:null,
  body:req=>req.body
 };
 const service={answerCustomsQuestion:async input=>{
  calls.push(input);
  return {ok:true,answer:'Fachauskunft',sources:[],uncertainty:true};
 }};
 const i18n={t:()=> 'Nicht berechtigt',language:()=> 'de'};
 const module={exports:{}};
 vm.runInNewContext(source,{module,require:id=>{
  if(id==='../shared/fast-auth-store')return auth;
  if(id==='../shared/customs-ai-service')return service;
  if(id==='../shared/i18n')return i18n;
  throw new Error('Unexpected require: '+id);
 }},{filename:'customs-ai-endpoint.js'});
 return {calls,async send(body){
  const context={log:{error(){}}};
  await module.exports(context,{method:'POST',body});
  return {status:context.res.status,body:JSON.parse(context.res.body)};
 }};
}

test('RC1793: Zollwissen-Leserecht darf allgemeine KI-Fachfragen stellen',async()=>{
 const h=harness({id:'customs-1',rights:{customs:{read:true},abd:{level:'none'}}});
 const response=await h.send({question:'Wer ist bei EXW der Ausführer?'});
 assert.equal(response.status,200);
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].question,'Wer ist bei EXW der Ausführer?');
 assert.equal(h.calls[0].invoiceAnalysis,undefined);
});

test('RC1793: Zollwissen-only darf keinen ABD-Kontext zur KI senden, selbst leer',async()=>{
 const h=harness({id:'customs-2',rights:{customs:{level:'view'},abd:{level:'none'}}});
 for(const extra of [{invoiceAnalysis:{}},{reference:''},{destinationCountry:'DE'},{abdRequest:{}},{invoiceAnalysis:{header:{invoiceNumber:'PRIVATE-1'}}}]){
  const response=await h.send({question:'Prüfe diese Sendung',...extra});
  assert.equal(response.status,403);
  assert.equal(response.body.ok,false);
 }
 assert.equal(h.calls.length,0,'Ohne ABD-Recht darf kein interner Kontext an den Service gelangen');
});

test('RC1793: ABD-Leserecht erlaubt den kontrollierten Kontext',async()=>{
 const h=harness({id:'abd-1',rights:{abd:{read:true},customs:{level:'none'}}});
 const payload={question:'Welche Positionen sind offen?',invoiceAnalysis:{review:{unassignedCount:2}},reference:'REF-1'};
 const response=await h.send(payload);
 assert.equal(response.status,200);
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].reference,'REF-1');
 assert.equal(h.calls[0].invoiceAnalysis.review.unassignedCount,2);
});

test('RC1793: ohne passende Rechte oder Session bleibt die KI gesperrt',async()=>{
 for(const user of [null,{id:'none-1',rights:{}},{id:'none-2',rights:{customs:{level:'none'},abd:{level:'none'}}}]){
  const h=harness(user);
  const response=await h.send({question:'Was ist eine MRN?'});
  assert.equal(response.status,403);
  assert.equal(h.calls.length,0);
 }
});
