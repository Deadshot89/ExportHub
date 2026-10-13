import test from 'node:test';
import assert from 'node:assert/strict';

function storage(){const data=new Map();return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),dump:()=>Object.fromEntries(data)};}
globalThis.localStorage=storage();
await import('../assets/sop/rc1501-sop-tour-validator.js');
await import('../assets/sop/rc1501-sop-tour-engine.js').catch(()=>{});
const tour=globalThis.ExportHubSopTour;

function sop(){return {number:'SOP-EH-060',title:'ABD',version:'2.0',steps:[
  {id:'open',instruction:'ABD öffnen',expectedAction:'click',target:{stableKey:'shipment-abd-request'},checks:[{type:'state',path:'shipment.dialog',equals:'open'}],tour:{enabled:true}},
  {id:'country',instruction:'Land prüfen',expectedAction:'change',target:{stableKey:'country'},checks:[{type:'field-value',key:'country',value:'CH'}],tour:{enabled:true}},
  {id:'save',instruction:'Speichern',expectedAction:'save',target:{stableKey:'shipment-save'},checks:[{type:'state',path:'shipment.saved',equals:true}],tour:{enabled:true}},
  {id:'disabled',instruction:'Nicht in Tour',expectedAction:'click',tour:{enabled:false}}
]};}
function rootFor(values={}){return {querySelectorAll(selector){const m=selector.match(/^\[data-tour-key="(.*)"\]$/);if(!m)return[];const key=m[1];if(!(key in values))return[];return [{value:values[key],hidden:false,style:{},getAttribute(){return null;}}];}};}

test('start erzeugt eine aktive Session nur aus aktivierten Tour-Schritten',()=>{
  assert.ok(tour,'ExportHubSopTour fehlt');
  const session=tour.start({sop:sop(),mode:'guided'});
  assert.equal(session.status,'active');
  assert.equal(session.sopNumber,'SOP-EH-060');
  assert.equal(session.total,3);
  assert.equal(session.stepNumber,1);
  assert.equal(session.percent,0);
  assert.equal(session.currentStep.id,'open');
});

test('falsche Aktion erhöht Fehlerzahl aber niemals den Fortschritt',()=>{
  tour.start({sop:sop(),mode:'guided'});
  const result=tour.handleAction({action:'change',stableKey:'shipment-abd-request',context:{state:{shipment:{dialog:'open'}}}});
  assert.equal(result.advanced,false);
  assert.equal(result.reason,'ACTION_MISMATCH');
  const session=tour.current();
  assert.equal(session.index,0);
  assert.equal(session.percent,0);
  assert.equal(session.wrongActions,1);
});

test('richtige Aktion ohne erfolgreichen Folgezustand bleibt offen',()=>{
  tour.start({sop:sop(),mode:'guided'});
  const result=tour.handleAction({action:'click',stableKey:'shipment-abd-request',context:{state:{shipment:{dialog:'closed'}}}});
  assert.equal(result.advanced,false);
  assert.equal(result.reason,'STATE_MISMATCH');
  assert.equal(tour.current().index,0);
});

test('richtige Aktion plus erfüllte Checks schließt Schritt ab und berechnet Fortschritt',()=>{
  tour.start({sop:sop(),mode:'guided'});
  const result=tour.handleAction({action:'click',stableKey:'shipment-abd-request',context:{state:{shipment:{dialog:'open'}}}});
  assert.equal(result.advanced,true);
  const session=tour.current();
  assert.equal(session.index,1);
  assert.equal(session.stepNumber,2);
  assert.equal(session.percent,33);
  assert.deepEqual(session.completedStepIds,['open']);
});

test('Target-Mismatch zählt als falsche Aktion und previous navigiert ohne produktive Aktion',()=>{
  tour.start({sop:sop(),mode:'guided'});
  let result=tour.handleAction({action:'click',stableKey:'wrong-target',context:{state:{shipment:{dialog:'open'}}}});
  assert.equal(result.reason,'TARGET_MISMATCH');
  tour.handleAction({action:'click',stableKey:'shipment-abd-request',context:{state:{shipment:{dialog:'open'}}}});
  const previous=tour.previous();
  assert.equal(previous.index,0);
  assert.equal(previous.currentStep.id,'open');
  assert.deepEqual(previous.completedStepIds,['open']);
});

test('pause blockiert Fortschritt und resume setzt dieselbe Session fort',()=>{
  tour.start({sop:sop(),mode:'guided'});
  const paused=tour.pause();
  assert.equal(paused.status,'paused');
  const ignored=tour.handleAction({action:'click',stableKey:'shipment-abd-request',context:{state:{shipment:{dialog:'open'}}}});
  assert.equal(ignored.advanced,false);
  assert.equal(ignored.reason,'SESSION_PAUSED');
  const resumed=tour.resume();
  assert.equal(resumed.status,'active');
  assert.equal(resumed.index,0);
});

test('letzter validierter Schritt beendet die Session mit 100 Prozent',()=>{
  tour.start({sop:sop(),mode:'guided'});
  tour.handleAction({action:'click',stableKey:'shipment-abd-request',context:{state:{shipment:{dialog:'open'}}}});
  tour.handleAction({action:'change',stableKey:'country',context:{root:rootFor({country:'CH'})}});
  const final=tour.handleAction({action:'save',stableKey:'shipment-save',context:{state:{shipment:{saved:true}}}});
  assert.equal(final.advanced,true);
  const session=tour.current();
  assert.equal(session.status,'completed');
  assert.equal(session.percent,100);
  assert.equal(session.stepNumber,3);
  assert.deepEqual(session.completedStepIds,['open','country','save']);
});

test('Persistenzmarker enthält nur Tour-Fortschritt und keine Produktdaten',()=>{
  tour.start({sop:sop(),mode:'guided'});
  tour.handleAction({action:'click',stableKey:'shipment-abd-request',context:{state:{shipment:{dialog:'open',secret:'DO-NOT-PERSIST'}}}});
  tour.pause();
  const raw=globalThis.localStorage.getItem('exporthub.sopTour.resume');
  assert.ok(raw);
  const marker=JSON.parse(raw);
  assert.deepEqual(Object.keys(marker).sort(),['completedStepIds','index','mode','sopNumber','status','version','wrongActions'].sort());
  assert.equal(raw.includes('DO-NOT-PERSIST'),false);
});

test('end beendet explizit und current liefert eine Clone-Ansicht',()=>{
  tour.start({sop:sop(),mode:'guided'});
  const copy=tour.current(); copy.index=99;
  assert.equal(tour.current().index,0);
  const ended=tour.end();
  assert.equal(ended.status,'ended');
});
