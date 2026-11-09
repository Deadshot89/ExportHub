import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const model=require('../api/shared/urgent-orders.js');

const actor={id:'CS-cutoff',name:'Customer Service'};
const payload={orderNumber:'SO31515',delivery:'DRP',priority:'P4',email:'cs@example.com',language:'de',
 items:[{line:'10',article:'TEST-1',quantity:1,pickableStock:true,holdsClear:true}]};

test('15:15 in Europe/Berlin remains within the same-day window; 15:16 is late',()=>{
 const before=model.createOrder({...payload,requestedDispatchDate:'2026-11-09'},actor,'2026-11-09T14:14:59.000Z');
 const at=model.createOrder({...payload,requestedDispatchDate:'2026-11-09'},actor,'2026-11-09T14:15:59.000Z');
 const late=model.createOrder({...payload,requestedDispatchDate:'2026-11-09'},actor,'2026-11-09T14:16:00.000Z');
 assert.equal(before.cutoff.lateSameDay,false);
 assert.equal(at.cutoff.lateSameDay,false);
 assert.equal(late.cutoff.lateSameDay,true);
 assert.equal(late.cutoff.nextProcessingDate,'2026-11-10');
 assert.equal(late.cutoff.timeZone,'Europe/Berlin');
 assert.equal(late.cutoff.cutoffLocalTime,'15:15');
 assert.equal(late.items[0].status,'Open','late warning must never pretend D365 automatic release happened');
 assert.equal(late.requestedDispatchDate,'2026-11-09');
});

test('warning applies to all same-day priorities, but tomorrow is allowed',()=>{
 for(const priority of model.PRIORITIES){
  const late=model.createOrder({...payload,priority,requestedDispatchDate:'2026-11-09'},actor,'2026-11-09T14:16:00Z');
  assert.equal(late.cutoff.lateSameDay,true,priority);
 }
 const moved=model.createOrder({...payload,requestedDispatchDate:'2026-11-10'},actor,'2026-11-09T15:00:00Z');
 assert.equal(moved.cutoff.lateSameDay,false);
 assert.equal(moved.cutoff.nextProcessingDate,null);
});

test('German daylight saving time and next-day rollover are correct',()=>{
 assert.equal(model.dispatchCutoff('2026-07-01','2026-07-01T13:15:59Z').cutoff.lateSameDay,false);
 assert.equal(model.dispatchCutoff('2026-07-01','2026-07-01T13:16:00Z').cutoff.lateSameDay,true);
 assert.equal(model.dispatchCutoff('2026-12-31','2026-12-31T14:16:00Z').cutoff.nextProcessingDate,'2027-01-01');
});

test('server rejects invalid and past shipping dates but supports older API clients',()=>{
 assert.equal(model.dispatchCutoff(undefined,'2026-11-09T14:16:00Z').requestedDispatchDate,'2026-11-09');
 for(const value of ['2026-11-08','2026-11-31','2026-13-01','2026-2-4','nonsense']){
  assert.throws(()=>model.dispatchCutoff(value,'2026-11-09T14:16:00Z'),e=>/^URGENT_DISPATCH_DATE_(PAST|INVALID)$/.test(e.code),value);
 }
});

test('both forms show a two-action choice only on late submission',()=>{
 for(const file of ['urgent-orders.html','urgent-order-report.html']){
  const html=fs.readFileSync(new URL('../assets/'+file,import.meta.url),'utf8');
  assert.match(html,/name="requestedDispatchDate"/);
  assert.match(html,/lateCutoffChoice|internalLateCutoffChoice/);
  assert.match(html,/cutoffSubmitToday/);
  assert.match(html,/cutoffMoveTomorrow/);
  assert.match(html,/requestSubmit\(\)/);
  assert.match(html,/if\(lateToday&&!approved\)/);
  assert.match(html,/const late=control.value===clock.date&&clock.minutes>15\*60\+15/);
  assert.doesNotMatch(html,/id="(?:cutoffWarning|internalCutoffWarning)"/);
  assert.match(html,/15:15 Uhr/);
  assert.match(html,/requestedDispatchDate:/);
  assert.match(html,/lateSameDay/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script[1]),file+' inline JS syntax');
 }
 const publicApi=fs.readFileSync(new URL('../api/urgent-order-public/index.js',import.meta.url),'utf8');
 assert.match(publicApi,/requestedDispatchDate:order\.requestedDispatchDate/);
 assert.match(publicApi,/cutoff:order\.cutoff/);
});


test('late cutoff choices stay hidden until a late same-day submit and tomorrow is calculated from Berlin date',()=>{
 for(const [file,ids,begin,end,sync,apply] of [
  ['urgent-orders.html',['internalRequestedDispatchDate','internalLateCutoffChoice','internalLateCutoffText','createButton','internalLateMoveTomorrow','internalWizardReview','newOrder'],
   'function berlinCutoffClock(){','async function submit(ev){','syncInternalCutoff','internalLateChoice'],
  ['urgent-order-report.html',['requestedDispatchDate','lateCutoffChoice','lateCutoffText','submitOrder','lateMoveTomorrow','reportForm'],
   'function berlinCutoffClock(){','function buildPayload(){','syncCutoff','applyLateCutoffChoice']
 ]){
  const html=fs.readFileSync(new URL('../assets/'+file,import.meta.url),'utf8');
  const start=html.indexOf(begin),end=html.indexOf(end,start);
  assert.ok(start>=0&&end>start,file+' cutoff helpers found');
  const controls=Object.fromEntries(ids.map(id=>[id,{value:'',hidden:false,textContent:'',min:'',focus(){}}]));
  const isInternal=file==='urgent-orders.html';
  const dateId=isInternal?'internalRequestedDispatchDate':'requestedDispatchDate';
  const panelId=isInternal?'internalLateCutoffChoice':'lateCutoffChoice';
  const buttonId=isInternal?'createButton':'submitOrder';
  const textId=isInternal?'internalLateCutoffText':'lateCutoffText';
  const formId=isInternal?'newOrder':'reportForm';
  let submits=0;
  controls[panelId].hidden=true;
  controls[dateId].value='2026-11-09';
  controls[formId].elements={language:{value:'de'},plannedDispatchAt:{value:'2026-11-09T18:00'}};
  controls[formId].requestSubmit=()=>{submits++};
  let clock='2026-11-09T14:15:59Z'; // 15:15:59 Berlin
  class ClockDate extends Date{
   constructor(...args){super(...(args.length?args:[clock]));}
  }
  const context=vm.createContext({
   Intl,Date:ClockDate,
   $:id=>controls[id],
   localeV2:(_key,fallback)=>fallback,
   showWizardStep:()=>{},
  });
  vm.runInContext(html.slice(start,end),context);
  assert.equal(context[sync](),false,file+' at 15:15:59');
  assert.equal(controls[panelId].hidden,true,'warning starts hidden');
  clock='2026-11-09T14:16:00Z'; // 15:16 Berlin
  assert.equal(context[sync](),true,'same-day cutoff crossed');
  assert.equal(controls[panelId].hidden,true,'warning is not shown before user submits');
  const show=isInternal?'showInternalCutoffChoice':'showLateCutoffChoice';
  context[show]();
  assert.equal(controls[panelId].hidden,false,'two actions are visible after attempted late submit');
  assert.equal(controls[buttonId].hidden,true,'ordinary submit hidden while decision needed');
  assert.match(controls[textId].textContent,/15:15/);
  context[apply](true);
  assert.equal(controls[dateId].value,'2026-11-10');
  assert.equal(controls[panelId].hidden,true);
  assert.equal(controls[buttonId].hidden,false);
  assert.equal(submits,1,'moving to tomorrow submits exactly once');
  if(!isInternal)assert.equal(controls[formId].elements.plannedDispatchAt.value,'2026-11-10T18:00','linked dispatch time follows new date');
 }
});
