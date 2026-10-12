import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1500-sop-overlay.js');
await import('../assets/sop/rc1502-sop-visuals.js');
await import('../assets/sop/rc1502-sop-editor.js');
await import('../assets/sop/rc1007-sop-ui.js');

const model=globalThis.ExportHubIsoSopModel;
const catalog=globalThis.ExportHubIsoSopCatalog;
const editor=globalThis.ExportHubSopEditor;
const ui=globalThis.ExportHubIsoSopUi;

function released(number='SOP-EH-060'){
  return model.seedState({},[catalog.get(number)]).isoSops[0];
}

test('Admin-SOP zeigt strukturierten Editorbereich mit explizitem Typ und Draft-Status',()=>{
  const html=ui.renderDocument(released(),{rights:{read:true,edit:true,admin:true},embedded:true});
  assert.match(html,/data-sop-editor/);
  assert.match(html,/data-sop-editor-type="process"/);
  assert.match(html,/Kein Entwurf|Entwurf/i);
  assert.match(html,/data-sop-editor-create-overlay/);
});

test('Editorbereich zeigt aktive Draft-Version Änderungsgrund Validierung und Schrittsteuerung',()=>{
  const doc=editor.createDraft(released(),{version:'2.1',actor:'Admin',reason:'ABD-Ablauf aktualisieren'});
  const html=ui.renderDocument(doc,{rights:{read:true,edit:true,admin:true},embedded:true});
  assert.match(html,/data-sop-editor-version="2\.1"/);
  assert.match(html,/ABD-Ablauf aktualisieren/);
  assert.match(html,/data-sop-editor-validation="valid"/);
  assert.match(html,/data-sop-editor-step=/);
  assert.match(html,/data-sop-editor-action="move-up"/);
  assert.match(html,/data-sop-editor-action="move-down"/);
  assert.match(html,/data-sop-editor-action="remove-step"/);
  assert.match(html,/data-sop-editor-add-step/);
  assert.match(html,/data-sop-editor-visual-src/);
});

test('Kunden-Overlay wird im Editor eindeutig als Kunden-SOP gekennzeichnet',()=>{
  const overlay=editor.createCustomerOverlay(released(),{number:'SOP-CUST-060-TEST',customerId:'TEST',version:'1.0',actor:'Admin',reason:'Kundenabweichung'});
  const html=ui.renderDocument(overlay,{rights:{read:true,edit:true,admin:true},embedded:true});
  assert.match(html,/data-sop-editor-type="customer"/);
  assert.match(html,/TEST/);
  assert.match(html,/SOP-EH-060/);
});

test('Leser ohne Edit-Recht sehen keinen Editor',()=>{
  const html=ui.renderDocument(released(),{rights:{read:true},embedded:true});
  assert.doesNotMatch(html,/data-sop-editor(?:\s|=|>)/);
});

test('Editor-CSS besitzt responsive Layout Fokuszustände und mobile Einspaltigkeit',()=>{
  assert.ok(fs.existsSync('assets/sop/rc1502-sop-editor.css'),'Editor-CSS fehlt');
  const css=fs.readFileSync('assets/sop/rc1502-sop-editor.css','utf8');
  assert.match(css,/\.rc1502-sop-editor/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(css,/grid-template-columns:\s*1fr/);
});

test('SOP-UI bindet Editoraktionen an denselben Dokumentzustand und bestehenden save-Pfad',()=>{
  const source=fs.readFileSync('assets/sop/rc1007-sop-ui.js','utf8');
  assert.match(source,/ExportHubSopEditor/);
  assert.match(source,/data-sop-editor-action/);
  assert.match(source,/root\.save/);
  assert.match(source,/state\.documents/);
});

test('Draft-Schritte zeigen Tourziel, Ziel auswählen, Ziel testen und Picker-Abbruch',()=>{
  let doc=editor.createDraft(released(),{version:'2.1',actor:'Admin',reason:'Tourziel pflegen'});
  const stepId=doc.versions.find(v=>v.version==='2.1').content.steps[0].id;
  doc=editor.updateStep(doc,{version:'2.1',stepId,patch:{target:{stableKey:'shipment-abd-decision',selector:'[data-tour-key="shipment-abd-decision"]'}}});
  const html=ui.renderDocument(doc,{rights:{read:true,edit:true,admin:true},embedded:true});
  assert.match(html,/data-sop-editor-target-key="shipment-abd-decision"/);
  assert.match(html,/data-sop-editor-action="pick-target"/);
  assert.match(html,/data-sop-editor-action="test-target"/);
  assert.match(html,/data-sop-editor-action="cancel-target-pick"/);
  assert.match(html,/shipment-abd-decision/);
});

test('Target-Picker UI nutzt die fail-closed Editor-API und speichert über denselben Dokumentpfad',()=>{
  const source=fs.readFileSync('assets/sop/rc1007-sop-ui.js','utf8');
  assert.match(source,/beginTargetPick/);
  assert.match(source,/cancelTargetPick/);
  assert.match(source,/testTarget/);
  assert.match(source,/TARGET_KEY_REQUIRED|TARGET_NOT_FOUND|TARGET_AMBIGUOUS/);
  assert.match(source,/replaceDocument/);
  assert.match(source,/persist/);
});

test('Target-Picker CSS hebt ausschließlich stabile Tourziele hervor und unterstützt Mobile',()=>{
  const css=fs.readFileSync('assets/sop/rc1502-sop-editor.css','utf8');
  assert.match(css,/\.rc1502-sop-target-picking/);
  assert.match(css,/\[data-tour-key\]/);
  assert.match(css,/cursor:\s*crosshair/);
  assert.match(css,/\.rc1502-sop-target-status/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
});
