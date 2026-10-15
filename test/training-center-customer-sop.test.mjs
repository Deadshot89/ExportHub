import test from 'node:test';
import assert from 'node:assert/strict';

for(const name of ['ExportHubShipmentRegistrationSop','ExportHubTrainingCustomerSop'])delete globalThis[name];
await import('../assets/training-center/catalog/shipment-registration.js').catch(()=>{});
await import('../assets/training-center/customer-sop.js').catch(()=>{});

const base=globalThis.ExportHubShipmentRegistrationSop;
const api=globalThis.ExportHubTrainingCustomerSop;
const sections=[
  'shipping','packaging','notification','avisLink','contacts','email','documents','deliveryNotes','cmr','abd','customs','labeling','deadlines','pickup','portals','attachments','specialChecks','knownErrors','notes'
];

test('Kunden-SOP-API verlangt baseProcessId und normalisiert alle freigegebenen Abweichungsbereiche',()=>{
  assert.ok(api,'ExportHubTrainingCustomerSop fehlt');
  assert.throws(()=>api.normalize({id:'customer-x'}),/CUSTOMER_SOP_BASE_PROCESS_REQUIRED/);
  const normalized=api.normalize({
    id:'customer-wuerth',customerId:'wuerth',title:'Würth Industrie',baseProcessId:'shipment-registration',
    sections:{packaging:['Nur freigegebene Verpackung verwenden'],avisLink:['Kein Avis-Link']}
  });
  assert.equal(normalized.baseProcessId,'shipment-registration');
  assert.deepEqual(Object.keys(normalized.sections),sections);
  for(const section of sections)assert.ok(Array.isArray(normalized.sections[section]),section);
  assert.deepEqual(normalized.sections.packaging,['Nur freigegebene Verpackung verwenden']);
  assert.deepEqual(normalized.sections.avisLink,['Kein Avis-Link']);
});

test('resolve trennt Standardprozess und Kundenabweichungen sichtbar ohne Standardtext zu duplizieren',()=>{
  assert.ok(base,'ExportHubShipmentRegistrationSop fehlt');
  assert.ok(api,'ExportHubTrainingCustomerSop fehlt');
  const customer={
    id:'customer-wuerth',customerId:'wuerth',title:'Würth Industrie',baseProcessId:'shipment-registration',
    version:'1.0',ownerUserId:'Tobias',changedAt:'2026-10-15T08:00:00Z',
    sections:{
      packaging:['Verpackungsvorgabe Kunde prüfen'],
      avisLink:['Kein Avis-Link versenden'],
      documents:['Kundendokument zusätzlich prüfen']
    }
  };
  const resolved=api.resolve(base,customer);
  assert.equal(resolved.baseProcess,base);
  assert.equal(resolved.customerSop.baseProcessId,base.id);
  assert.equal(resolved.notice,'Es gilt zusätzlich der Standardprozess „Sendung in ExportHUB360 anmelden“.');
  assert.deepEqual(resolved.deviations.map(item=>item.section),['packaging','avisLink','documents']);
  const deviationText=JSON.stringify(resolved.deviations);
  for(const step of base.steps)assert.equal(deviationText.includes(step.explanation),false,'Standarderklärung wurde in Kundenabweichungen dupliziert');
});

test('renderResolved zeigt den Standardhinweis und nur tatsächlich vorhandene Abweichungen',()=>{
  assert.ok(base,'ExportHubShipmentRegistrationSop fehlt');
  assert.ok(api,'ExportHubTrainingCustomerSop fehlt');
  const resolved=api.resolve(base,{
    id:'customer-1',customerId:'c1',title:'Testkunde',baseProcessId:'shipment-registration',
    sections:{pickup:['Abholung nur nach Freigabe'],notes:['Interne Kundennotiz']}
  });
  const html=api.renderResolved(resolved);
  assert.match(html,/Es gilt zusätzlich der Standardprozess „Sendung in ExportHUB360 anmelden“\./);
  assert.match(html,/Abholung nur nach Freigabe/);
  assert.match(html,/Interne Kundennotiz/);
  assert.doesNotMatch(html,/Verpackungsvorgabe Kunde prüfen/);
  assert.equal((html.match(/Sendung in ExportHUB360 anmelden/g)||[]).length,1);
});

test('resolve lehnt falschen oder fehlenden Standardprozess ab',()=>{
  assert.ok(api,'ExportHubTrainingCustomerSop fehlt');
  assert.throws(()=>api.resolve(null,{baseProcessId:'shipment-registration'}),/CUSTOMER_SOP_BASE_PROCESS_MISSING/);
  assert.throws(()=>api.resolve({id:'other',title:'Other',steps:[]},{baseProcessId:'shipment-registration'}),/CUSTOMER_SOP_BASE_PROCESS_MISMATCH/);
});
