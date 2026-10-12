import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1505-sop-function-registry.js').catch(()=>{});
const registry=globalThis.ExportHubSopFunctionRegistry;

const PROCESS_SOPS=[
  'SOP-EH-001','SOP-EH-002','SOP-EH-010','SOP-EH-012','SOP-EH-020','SOP-EH-030',
  'SOP-EH-031','SOP-EH-034','SOP-EH-040','SOP-EH-050','SOP-EH-052','SOP-EH-060',
  'SOP-EH-063','SOP-EH-070','SOP-EH-075','SOP-EH-076','SOP-EH-080','SOP-EH-090',
  'SOP-EH-095','SOP-EH-100','SOP-EH-105','SOP-EH-110','SOP-EH-112','SOP-EH-114'
];

function text(value){return String(value==null?'':value).trim();}

test('Function Registry API ist vorhanden und unveränderlich exponiert',()=>{
  assert.ok(registry,'ExportHubSopFunctionRegistry fehlt');
  assert.ok(Array.isArray(registry.entries),'entries fehlt');
  assert.equal(typeof registry.get,'function','get fehlt');
  assert.ok(Object.isFrozen(registry.entries),'entries muss eingefroren sein');
});

test('alle 24 aktiven RC1016-Prozess-SOPs besitzen mindestens eine erforderliche Registry-Zuordnung',()=>{
  const required=registry.entries.filter(entry=>entry?.required===true);
  for(const sopNumber of PROCESS_SOPS){
    assert.ok(required.some(entry=>entry.sopNumber===sopNumber),`${sopNumber}: erforderliche Registry-Zuordnung fehlt`);
  }
});

test('Registry IDs sind eindeutig und get(id) liefert exakt denselben Eintrag',()=>{
  const ids=registry.entries.map(entry=>text(entry?.id));
  assert.ok(ids.every(Boolean),'leere Registry-ID gefunden');
  assert.equal(new Set(ids).size,ids.length,'doppelte Registry-ID gefunden');
  for(const entry of registry.entries)assert.strictEqual(registry.get(entry.id),entry,`${entry.id}: get liefert nicht denselben Eintrag`);
});

test('erforderliche Registry-Einträge besitzen stabile Pflichtfelder und boolesche Capability-Regeln',()=>{
  for(const entry of registry.entries.filter(item=>item?.required===true)){
    assert.ok(text(entry.id),`${entry.id||'<leer>'}: id fehlt`);
    assert.ok(text(entry.view),`${entry.id}: view fehlt`);
    assert.ok(text(entry.action),`${entry.id}: action fehlt`);
    assert.ok(/^SOP-EH-\d{3}$/.test(text(entry.sopNumber)),`${entry.id}: sopNumber ungültig`);
    assert.ok(text(entry.stepId),`${entry.id}: stepId fehlt`);
    for(const flag of ['requiredImage','requiredTour','requiredExam','required','customerScoped']){
      assert.equal(typeof entry[flag],'boolean',`${entry.id}: ${flag} muss boolean sein`);
    }
    assert.equal(typeof entry.targetKey,'string',`${entry.id}: targetKey muss String sein`);
  }
});

test('keine zwei erforderlichen Einträge beanspruchen dieselbe view+action Kombination',()=>{
  const seen=new Map();
  for(const entry of registry.entries.filter(item=>item?.required===true)){
    const key=`${text(entry.view).toLowerCase()}::${text(entry.action).toLowerCase()}`;
    assert.equal(seen.has(key),false,`${entry.id}: doppelte erforderliche view+action Zuordnung mit ${seen.get(key)||''}`);
    seen.set(key,entry.id);
  }
});

test('ABD-Pilotfluss referenziert SOP-EH-060 Schritt 1 und den stabilen Tour-Key',()=>{
  const pilot=registry.get('shipment.abd-decision');
  assert.ok(pilot,'ABD-Pilotfluss fehlt');
  assert.equal(pilot.view,'shipment');
  assert.equal(pilot.action,'abd-decision');
  assert.equal(pilot.sopNumber,'SOP-EH-060');
  assert.equal(pilot.stepId,'step-1');
  assert.equal(pilot.targetKey,'shipment-abd-decision');
  assert.equal(pilot.required,true);
  assert.equal(pilot.requiredImage,true);
  assert.equal(pilot.requiredTour,true);
  assert.equal(pilot.requiredExam,true);
});
