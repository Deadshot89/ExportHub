import test from 'node:test';
import assert from 'node:assert/strict';

const tourCalls=[];
globalThis.ExportHubSopTour={
  start(options){tourCalls.push({type:'start',options});return{status:'active',mode:options.mode,sopNumber:options.sop?.number||''};},
  end(){tourCalls.push({type:'end'});return{status:'ended'};}
};
await import('../assets/sop/rc1503-sop-training.js').catch(()=>{});
const training=globalThis.ExportHubSopTraining;

const SOP={number:'SOP-EH-060',title:'ABD Prozess',version:'2.0',steps:[{id:'s1',tour:{enabled:true}}]};

function reset(){
  tourCalls.length=0;
  if(training&&typeof training.end==='function')training.end();
}

test('Training API ist vorhanden',()=>{
  assert.ok(training,'ExportHubSopTraining fehlt');
  for(const name of ['canStart','start','simulate','end'])assert.equal(typeof training[name],'function',`${name} fehlt`);
});

test('canStart erlaubt ausschließlich die aufgelöste Demo-Umgebung',()=>{
  reset();
  assert.equal(training.canStart({environment:'demo'}).ok,true);
  assert.equal(training.canStart({environment:'production'}).ok,false);
  assert.equal(training.canStart({environment:'testservice'}).ok,false);
  assert.equal(training.canStart({}).ok,false);
  assert.equal(training.canStart(null).ok,false);
});

test('start verweigert Produktion TESTSERVICE und fehlende Umgebung ohne Tourstart',()=>{
  reset();
  for(const environment of ['production','testservice','']){
    const result=training.start({sop:SOP,context:{environment}});
    assert.equal(result.ok,false);
    assert.equal(result.reason,'TRAINING_DEMO_ONLY');
  }
  assert.equal(tourCalls.filter(call=>call.type==='start').length,0);
});

test('Demo-Training startet dieselbe SOP im Trainingsmodus',()=>{
  reset();
  const result=training.start({sop:SOP,context:{environment:'demo'}});
  assert.equal(result.ok,true);
  assert.equal(result.simulation,true);
  assert.equal(result.environment,'demo');
  assert.equal(result.session?.status,'active');
  const starts=tourCalls.filter(call=>call.type==='start');
  assert.equal(starts.length,1);
  assert.equal(starts[0].options.sop,SOP);
  assert.equal(starts[0].options.mode,'training');
});

test('Simulation ist ohne aktive Demo-Trainingssitzung gesperrt',()=>{
  reset();
  const result=training.simulate('mail',{to:'demo@example.invalid'});
  assert.equal(result.ok,false);
  assert.equal(result.reason,'TRAINING_NOT_ACTIVE');
});

test('freigegebene Außenwirkungen werden ausschließlich als Simulationsergebnis zurückgegeben',()=>{
  reset();
  training.start({sop:SOP,context:{environment:'demo'}});
  const effects=['mail','avis','qr','status','pallet','external-portal'];
  for(const effect of effects){
    const payload={reference:'DEMO01',effect};
    const result=training.simulate(effect,payload);
    assert.equal(result.ok,true,effect);
    assert.equal(result.simulated,true,effect);
    assert.equal(result.effect,effect,effect);
    assert.equal(result.environment,'demo',effect);
    assert.equal(result.externalExecuted,false,effect);
    assert.deepEqual(result.payload,payload,effect);
  }
});

test('unbekannte oder gefährliche Effekte schlagen fail-closed fehl',()=>{
  reset();
  training.start({sop:SOP,context:{environment:'demo'}});
  for(const effect of ['delete','http','email-live','token-create','']){
    const result=training.simulate(effect,{danger:true});
    assert.equal(result.ok,false,effect||'<leer>');
    assert.equal(result.reason,'TRAINING_EFFECT_NOT_ALLOWED',effect||'<leer>');
  }
});

test('Trainingssimulation ruft weder fetch noch produktive Außenwirkungs-Handler auf',async()=>{
  reset();
  let fetchCalls=0;
  let productiveCalls=0;
  const oldFetch=globalThis.fetch;
  const oldHandlers=globalThis.ExportHubProductiveActions;
  globalThis.fetch=async()=>{fetchCalls+=1;throw new Error('fetch darf nicht aufgerufen werden');};
  globalThis.ExportHubProductiveActions={mail(){productiveCalls+=1;},avis(){productiveCalls+=1;},qr(){productiveCalls+=1;},pallet(){productiveCalls+=1;}};
  try{
    training.start({sop:SOP,context:{environment:'demo'}});
    for(const effect of ['mail','avis','qr','status','pallet','external-portal'])training.simulate(effect,{reference:'DEMO01'});
    assert.equal(fetchCalls,0);
    assert.equal(productiveCalls,0);
  }finally{
    globalThis.fetch=oldFetch;
    globalThis.ExportHubProductiveActions=oldHandlers;
  }
});

test('end beendet Tour und sperrt weitere Simulation',()=>{
  reset();
  training.start({sop:SOP,context:{environment:'demo'}});
  const ended=training.end();
  assert.equal(ended.ok,true);
  assert.equal(ended.status,'ended');
  assert.equal(tourCalls.filter(call=>call.type==='end').length>=1,true);
  const after=training.simulate('status',{status:'Erstellt'});
  assert.equal(after.ok,false);
  assert.equal(after.reason,'TRAINING_NOT_ACTIVE');
});
