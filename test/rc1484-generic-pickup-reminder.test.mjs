import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');

function load(){
  const document={
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    querySelectorAll(){return[]},
    createElement(){return{setAttribute(){},removeAttribute(){},appendChild(){},addEventListener(){},remove(){},style:{},dataset:{}}},
    body:{getAttribute(){return''},appendChild(){}},
    head:{appendChild(){}},
    documentElement:{appendChild(){}}
  };
  const sandbox={
    document,
    location:{href:'https://example.test/'},
    setTimeout(){return 1},
    addEventListener(){},
    __EXPORTHUB_GET_STATE__(){return{}},
    console:{warn(){}},
    URL
  };
  sandbox.window=sandbox;
  vm.runInNewContext(runtime,sandbox,{filename:'rc1166-avis-reminder-overview.js'});
  return sandbox.ExportHUBRC1166AvisReminder;
}

test('RC1484: generische Abholerinnerung bleibt für jede offene Sendung verfügbar',()=>{
  const api=load();
  assert.equal(typeof api.genericReminderEligible,'function','RC1484 eligibility helper fehlt');
  assert.equal(api.genericReminderEligible({reference:'NO-DATE'}),true,'ohne Abholdatum muss die Erinnerung verfügbar bleiben');
  assert.equal(api.genericReminderEligible({reference:'FUTURE',plannedPickupDate:'2026-10-20'}),true,'auch vor dem Abholdatum muss die Erinnerung manuell verfügbar bleiben');
  assert.equal(api.genericReminderEligible({reference:'OVERDUE',plannedPickupDate:'2026-10-09'}),true,'überfällige Abholung muss die Erinnerung anbieten');
  assert.equal(api.genericReminderEligible({reference:'PICKED',actualPickupAt:'2026-10-10T10:00:00Z'}),false,'bereits abgeholte Sendungen dürfen keine Erinnerung anbieten');
  assert.equal(api.genericReminderEligible({reference:'DONE',status:'Abgeschlossen'}),false,'abgeschlossene Sendungen dürfen keine Erinnerung anbieten');
  assert.equal(api.genericReminderEligible({reference:'CANCELLED',status:'Storniert'}),false,'stornierte Sendungen dürfen keine Erinnerung anbieten');
});

test('RC1484: fehlenden Legacy-Erinnerungsblock ergänzt die Runtime über die bestehende Mail-API',()=>{
  assert.match(runtime,/function ensureGenericReminderActions\(/);
  assert.match(runtime,/ExportHUBIndex236/);
  assert.match(runtime,/recipientState/);
  assert.match(runtime,/reminderMail/);
  assert.match(runtime,/rc1484-generic-reminder-actions/);
  assert.match(runtime,/Kunde DE/);
  assert.match(runtime,/Kunde EN/);
  assert.match(runtime,/Spedition DE/);
  assert.match(runtime,/Spedition EN/);
});
