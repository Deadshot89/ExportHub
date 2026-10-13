import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1501-sop-tour-targets.js').catch(()=>{});
const targets=globalThis.ExportHubSopTourTargets;

function node(attrs={}){
  const data=new Map(Object.entries(attrs));
  return {
    getAttribute(name){return data.has(name)?data.get(name):null;},
    setAttribute(name,value){data.set(name,String(value));},
    hasAttribute(name){return data.has(name);},
    attrs:data
  };
}
function root(entries={}){
  return {
    querySelectorAll(selector){return entries[selector]||[];},
    querySelector(selector){const list=entries[selector]||[];return list[0]||null;}
  };
}

test('find liefert genau ein Element für einen eindeutigen data-tour-key',()=>{
  assert.ok(targets,'ExportHubSopTourTargets fehlt');
  const el=node({'data-tour-key':'shipment-abd-decision'});
  const result=targets.find('shipment-abd-decision',root({'[data-tour-key="shipment-abd-decision"]':[el]}));
  assert.equal(result.ok,true);
  assert.equal(result.element,el);
});

test('find schlägt bei fehlendem oder doppeltem Ziel fail-closed fehl',()=>{
  const missing=targets.find('missing',root({}));
  assert.equal(missing.ok,false); assert.equal(missing.error,'TARGET_NOT_FOUND');
  const dup=targets.find('dup',root({'[data-tour-key="dup"]':[node(),node()]}));
  assert.equal(dup.ok,false); assert.equal(dup.error,'TARGET_AMBIGUOUS');
});

test('find verlangt einen stabilen Schlüssel und eine DOM-ähnliche Root',()=>{
  assert.equal(targets.find('',root({})).error,'KEY_REQUIRED');
  assert.equal(targets.find('x',null).error,'ROOT_UNAVAILABLE');
});

test('annotatePilotTargets markiert SOP-EH-060 und den ABD-Entscheidungsbereich ohne Handler zu ersetzen',()=>{
  const sop=node({'data-sop-open':'SOP-EH-060'});
  const abd=node({id:'rc363BlockAbdDecision'});
  const fake=root({
    '[data-sop-open="SOP-EH-060"]':[sop],
    '#rc363BlockAbdDecision':[abd]
  });
  const result=targets.annotatePilotTargets(fake);
  assert.equal(result.ok,true);
  assert.equal(sop.getAttribute('data-tour-key'),'sop-open-SOP-EH-060');
  assert.equal(abd.getAttribute('data-tour-key'),'shipment-abd-decision');
  assert.deepEqual(result.annotated.sort(),['shipment-abd-decision','sop-open-SOP-EH-060'].sort());
});

test('annotatePilotTargets meldet mehrdeutige technische Anker und setzt keinen Schlüssel',()=>{
  const a=node({'data-sop-open':'SOP-EH-060'}),b=node({'data-sop-open':'SOP-EH-060'});
  const result=targets.annotatePilotTargets(root({'[data-sop-open="SOP-EH-060"]':[a,b]}));
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.code==='ANCHOR_AMBIGUOUS'));
  assert.equal(a.getAttribute('data-tour-key'),null);
  assert.equal(b.getAttribute('data-tour-key'),null);
});

test('annotatePilotTargets erkennt kollidierende bereits gesetzte Tour-Keys',()=>{
  const sop=node({'data-sop-open':'SOP-EH-060','data-tour-key':'wrong-key'});
  const result=targets.annotatePilotTargets(root({'[data-sop-open="SOP-EH-060"]':[sop]}));
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.code==='KEY_CONFLICT'));
  assert.equal(sop.getAttribute('data-tour-key'),'wrong-key');
});
