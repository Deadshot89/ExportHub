import test from 'node:test';
import assert from 'node:assert/strict';

for(const name of ['ExportHubShipmentRegistrationSop','ExportHubTrainingScreenshots'])delete globalThis[name];
await import('../assets/training-center/screenshots.js').catch(()=>{});
await import('../assets/training-center/catalog/shipment-registration.js').catch(()=>{});

const sop=globalThis.ExportHubShipmentRegistrationSop;
const screenshots=globalThis.ExportHubTrainingScreenshots;
const chapters=[
  'Sendungsfunktion öffnen',
  'Neue Sendung beginnen',
  'Kunde auswählen',
  'Empfänger / Standort prüfen',
  'Referenz prüfen',
  'Sendungsdaten erfassen',
  'Colli erfassen',
  'Gewicht erfassen',
  'Dokumente prüfen',
  'Lieferscheine prüfen',
  'Gesamtprüfung',
  'ABD-Pflicht prüfen',
  'Zollprozess bei Bedarf',
  'Sendung speichern',
  'Status kontrollieren',
  'QR-/Abholprozess',
  'Abschlusskontrolle'
];

test('erste Standard-SOP enthält exakt die 17 freigegebenen Kapitel in Reihenfolge',()=>{
  assert.ok(sop,'ExportHubShipmentRegistrationSop fehlt');
  assert.equal(sop.id,'shipment-registration');
  assert.equal(sop.title,'Sendung in ExportHUB360 anmelden');
  assert.deepEqual(sop.steps.map(step=>step.title),chapters);
  assert.equal(sop.steps.length,17);
});

test('jeder SOP-Schritt besitzt den vollständigen strukturierten Vertrag und beide Arbeitsaktionen',()=>{
  assert.ok(sop,'ExportHubShipmentRegistrationSop fehlt');
  assert.ok(screenshots,'ExportHubTrainingScreenshots fehlt');
  const ids=new Set();
  sop.steps.forEach((step,index)=>{
    assert.equal(step.order,index+1);
    assert.ok(step.stepId);
    assert.equal(ids.has(step.stepId),false,`doppelte stepId: ${step.stepId}`);
    ids.add(step.stepId);
    for(const key of ['route','title','shortInstruction','explanation','purpose','screenshotId','targetElement','expectedAction','helpText','successText'])assert.ok(step[key],`${step.stepId}: ${key} fehlt`);
    for(const key of ['checkpoints','commonErrors','warnings','validation'])assert.ok(Array.isArray(step[key]),`${step.stepId}: ${key} muss Array sein`);
    assert.ok(step.checkpoints.length>0,`${step.stepId}: Kontrollpunkte fehlen`);
    assert.ok(step.actions&&typeof step.actions==='object',`${step.stepId}: actions fehlen`);
    assert.equal(step.actions.showOnWebsiteLabel,'Auf Website zeigen');
    assert.equal(step.actions.startTourLabel,'Tour ab hier starten');
    assert.ok(screenshots.get(step.screenshotId),`${step.stepId}: Screenshot ${step.screenshotId} nicht registriert`);
    if(index<sop.steps.length-1)assert.equal(step.nextStep,sop.steps[index+1].stepId);
    else assert.equal(step.nextStep,null);
  });
});

test('Sendungsreferenz wird ausschließlich als automatisch erzeugt/read-only geprüft und niemals manuell eingegeben',()=>{
  assert.ok(sop,'ExportHubShipmentRegistrationSop fehlt');
  const step=sop.steps.find(item=>item.title==='Referenz prüfen');
  assert.ok(step);
  assert.equal(step.targetElement,'shipment.reference');
  assert.equal(step.expectedAction,'verify-readonly-reference');
  const text=[step.shortInstruction,step.explanation,step.purpose,step.helpText,...step.checkpoints].join(' ').toLowerCase();
  assert.match(text,/automatisch|erzeugt/);
  assert.match(text,/read-only|schreibgeschützt|nicht bearbeit/);
  assert.match(text,/prüf/);
  assert.doesNotMatch(text,/referenz (manuell )?eingeben|referenz eintragen/);
});

test('SOP verwendet aktuelle reale ExportHUB-Ziele für Kernschritte',()=>{
  assert.ok(sop,'ExportHubShipmentRegistrationSop fehlt');
  const targets=new Map(sop.steps.map(step=>[step.title,step.targetElement]));
  assert.equal(targets.get('Neue Sendung beginnen'),'shipment.new');
  assert.equal(targets.get('Kunde auswählen'),'shipment.customer-search');
  assert.equal(targets.get('Empfänger / Standort prüfen'),'shipment.location');
  assert.equal(targets.get('Colli erfassen'),'shipment.colli');
  assert.equal(targets.get('Gewicht erfassen'),'shipment.weight');
  assert.equal(targets.get('Dokumente prüfen'),'shipment.documents');
  assert.equal(targets.get('ABD-Pflicht prüfen'),'shipment.abd-decision');
  assert.equal(targets.get('Sendung speichern'),'shipment.save');
});

test('Screenshot-Registry enthält nur neue Training-Center-Referenzen ohne echte Kundendaten',()=>{
  assert.ok(screenshots,'ExportHubTrainingScreenshots fehlt');
  const all=screenshots.list();
  assert.equal(all.length,17);
  for(const shot of all){
    assert.equal(shot.processId,'shipment-registration');
    assert.ok(shot.id&&shot.stepId&&shot.src&&shot.alt&&shot.caption);
    assert.match(shot.src,/^\/assets\/training-center\/screenshots\//);
    assert.doesNotMatch(JSON.stringify(shot),/900000|SIDE\d|DNC\d|Produktivkunde/i);
  }
});
