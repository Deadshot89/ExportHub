import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1007-sop-ui.js');

const model=globalThis.ExportHubIsoSopModel;
const catalog=globalThis.ExportHubIsoSopCatalog;
const ui=globalThis.ExportHubIsoSopUi;

function legacy36(){
  return Array.from({length:36},(_,index)=>({
    id:`SOP-ALT-${String(index+1).padStart(3,'0')}`,
    number:`SOP-ALT-${String(index+1).padStart(3,'0')}`,
    title:`Alte SOP ${index+1}`,
    area:index<9?'System-Grundlagen':'Alter Bereich',
    status:'Entwurf',
    version:'1.0'
  }));
}

test('RC1009 gleicht einen gespeicherten 36er-Altbestand auf den kanonischen 75er-Systemkatalog ab',()=>{
  assert.equal(typeof model.reconcileCatalog,'function');
  const reconciled=model.reconcileCatalog(legacy36(),catalog.documents);
  assert.equal(reconciled.length,75);
  assert.equal(new Set(reconciled.map(doc=>doc.number)).size,75);
  assert.ok(reconciled.every(doc=>/^SOP-EH-\d{3}$/.test(doc.number)));
  assert.equal(reconciled.some(doc=>doc.number.startsWith('SOP-ALT-')),false);
});

test('Übersicht zählt exakt die SOPs, die auch auswählbar gerendert werden',()=>{
  const html=ui.renderOverview({documents:legacy36(),rights:{admin:true}});
  const count=Number((html.match(/class="rc1007-sop-count"[^>]*>\s*<strong>(\d+)<\/strong>/)||[])[1]);
  const selectable=(html.match(/data-sop-open="SOP-EH-\d{3}"/g)||[]).length;
  assert.equal(count,75);
  assert.equal(selectable,75);
});

test('RC1009 verwendet eine klare zweispaltige SOP-Arbeitsfläche mit Liste und Dokumentbereich',()=>{
  assert.equal(typeof ui.renderWorkspace,'function');
  const html=ui.renderWorkspace({documents:legacy36(),rights:{admin:true},activeNumber:'SOP-EH-001'});
  assert.match(html,/rc1009-sop-workspace/);
  assert.match(html,/rc1009-sop-sidebar/);
  assert.match(html,/rc1009-sop-document-pane/);
  assert.match(html,/data-sop-open="SOP-EH-001"/);
  assert.match(html,/data-sop-open="SOP-EH-115"/);
  assert.match(html,/Schritt-für-Schritt-Ablauf/);
});
