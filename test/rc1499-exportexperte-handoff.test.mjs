import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridgePath='assets/rc1499-exportexperte-handoff.js';
const packPath='assets/i18n/rc1499-exportexperte.js';

test('RC1499: ABD handoff bridge exists and transfers only supported customs fields',()=>{
  assert.equal(fs.existsSync(bridgePath),true,'ABD handoff bridge fehlt');
  const source=fs.readFileSync(bridgePath,'utf8');
  let opened=0,confirmed=0;
  const sandbox={
    console,
    window:null,
    ExportHUBRC626:{
      openAbd(){opened++},
      confirmRc626Abd(){confirmed++}
    }
  };
  sandbox.window=sandbox;
  vm.runInNewContext(source,sandbox,{filename:bridgePath});
  const api=sandbox.ExportHUBRC1499Handoff;
  assert.ok(api&&typeof api.prepare==='function','prepare API fehlt');
  const prepared=api.prepare({
    review:{complete:true},
    totals:{difference:0,invoiceTotal:125.5,accountedTotal:125.5,currency:'EUR'},
    header:{invoiceNumber:'INV-42',reference:'REF-7',customer:'DARF-NICHT-UEBERTRAGEN'},
    groups:[{
      commodityCode:'39269097',originCountry:'CN',value:125.5,currency:'EUR',positionCount:2,
      description:'DARF-NICHT-UEBERTRAGEN',sourceFile:'invoice.pdf'
    }]
  });
  assert.equal(opened,1,'Legacy-ABD wird nicht geöffnet');
  assert.equal(confirmed,0,'ABD darf nicht automatisch bestätigt werden');
  assert.deepEqual(JSON.parse(JSON.stringify(prepared.groups)),[{
    commodityCode:'39269097',originCountry:'CN',value:125.5,currency:'EUR',positionCount:2
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(prepared.header)),{invoiceNumber:'INV-42',reference:'REF-7'});
  assert.equal('customer' in prepared.header,false,'Legacy-Grunddaten dürfen nicht überschrieben werden');
});

test('RC1499: handoff is blocked until review and totals are valid',()=>{
  const source=fs.readFileSync(bridgePath,'utf8');
  let opened=0;
  const sandbox={console,window:null,ExportHUBRC626:{openAbd(){opened++}}};
  sandbox.window=sandbox;
  vm.runInNewContext(source,sandbox,{filename:bridgePath});
  const api=sandbox.ExportHUBRC1499Handoff;
  for(const input of [
    {review:{complete:false},totals:{difference:0},groups:[{commodityCode:'1',originCountry:'DE',value:1,currency:'EUR',positionCount:1}]},
    {review:{complete:true},totals:{difference:1},groups:[{commodityCode:'1',originCountry:'DE',value:1,currency:'EUR',positionCount:1}]},
    {review:{complete:true},totals:{difference:0},groups:[]}
  ])assert.throws(()=>api.prepare(input),/ABD_HANDOFF_NOT_READY|ABD_HANDOFF_EMPTY/);
  assert.equal(opened,0,'Gesperrte Übergabe darf Legacy-ABD nicht öffnen');
});

test('RC1499: isolated loader exposes guarded prepare action without save/send/confirm side effects',()=>{
  const bridge=fs.readFileSync(bridgePath,'utf8');
  const pack=fs.readFileSync(packPath,'utf8');
  assert.match(pack,/rc1499-exportexperte-handoff\.js\?v=1499/,'Handoff bridge wird nicht geladen');
  assert.match(bridge,/data-rc1499-prepare-abd/,'Vorbereitungsaktion fehlt');
  assert.match(bridge,/function prepare\(input\)/,'Bridge-Prepare fehlt');
  assert.match(bridge,/ExportHUBRC626[\s\S]*?openAbd/,'Bestehender ABD-Dialog wird nicht verwendet');
  assert.doesNotMatch(bridge,/(confirmRc626Abd|confirmAbd|saveAbd|sendAbd|openOutlook)/i,'Bridge darf Legacy-Speichern/Senden/Bestätigen nicht auslösen');
});
