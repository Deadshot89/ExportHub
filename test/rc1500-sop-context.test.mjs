import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1500-sop-overlay.js');
await import('../assets/sop/rc1500-sop-context.js');
const contextApi=globalThis.ExportHubSopContext;

function processDoc({number='SOP-EH-060',status='Freigegeben',contexts=[{view:'shipment',action:'abd-request',roles:['export']}]}={}){
  return {
    number,title:'ABD vom Bedarf bis zur Versandfreigabe',type:'process',status,version:'2.0',currentVersion:'2.0',contexts,
    sections:{steps:[{id:'a',text:'Prüfen'},{id:'b',text:'ABD anfordern'}]},
    versions:[{version:'2.0',status,title:'ABD vom Bedarf bis zur Versandfreigabe',content:{steps:[{id:'a',text:'Prüfen'},{id:'b',text:'ABD anfordern'}]},visuals:[]}],auditTrail:[]
  };
}
function customerOverlay(){
  return {
    number:'SOP-CUST-C1-060',title:'C1 ABD',type:'customer',customerId:'C1',baseProcessSop:'SOP-EH-060',status:'Freigegeben',version:'1.0',currentVersion:'1.0',
    versions:[{version:'1.0',status:'Freigegeben',title:'C1 ABD',content:{overlays:[{action:'add-step',afterStepId:'a',step:{id:'customer-extra',text:'C1 Portal prüfen'}}]},visuals:[]}],auditTrail:[]
  };
}

test('löst Shipment/ABD ausschließlich über explizite Kontext-Metadaten auf',()=>{
  assert.ok(contextApi,'ExportHubSopContext fehlt');
  const doc=processDoc();
  const result=contextApi.resolve({view:'shipment',action:'abd-request',role:'export'},{documents:[doc],rights:{read:true}});
  assert.equal(result.matches.length,1);
  assert.equal(result.primary.number,'SOP-EH-060');
  assert.equal(result.effective.document.number,'SOP-EH-060');
});

test('wendet das passende freigegebene Kunden-Overlay auf den primären Prozess an',()=>{
  const result=contextApi.resolve({view:'shipment',action:'abd-request',role:'export',customerId:'C1'},{documents:[processDoc(),customerOverlay()],rights:{read:true}});
  assert.equal(result.primary.number,'SOP-EH-060');
  assert.equal(result.effective.overlay.number,'SOP-CUST-C1-060');
  assert.ok(result.effective.document.steps.some(step=>step.id==='customer-extra'));
});

test('liefert bei nicht passendem Kontext ein leeres Ergebnis',()=>{
  const result=contextApi.resolve({view:'dashboard',action:'open',role:'export'},{documents:[processDoc()],rights:{read:true}});
  assert.deepEqual(result.matches,[]);
  assert.equal(result.primary,null);
  assert.equal(result.effective,null);
});

test('Leser sehen nur freigegebene Prozess-SOPs; Editoren dürfen Drafts finden',()=>{
  const draft=processDoc({number:'SOP-EH-061',status:'Entwurf'});
  const reader=contextApi.resolve({view:'shipment',action:'abd-request',role:'export'},{documents:[draft],rights:{read:true}});
  assert.equal(reader.primary,null);
  const editor=contextApi.resolve({view:'shipment',action:'abd-request',role:'export'},{documents:[draft],rights:{read:true,edit:true}});
  assert.equal(editor.primary.number,'SOP-EH-061');
});

test('Rollenbeschränkung wird exakt ausgewertet',()=>{
  const doc=processDoc();
  const blocked=contextApi.resolve({view:'shipment',action:'abd-request',role:'warehouse'},{documents:[doc],rights:{read:true}});
  assert.equal(blocked.primary,null);
  const allowed=contextApi.resolve({view:'shipment',action:'abd-request',role:'export'},{documents:[doc],rights:{read:true}});
  assert.equal(allowed.primary.number,'SOP-EH-060');
});

test('Titel- oder Textähnlichkeit erzeugt ohne Context-Metadaten keinen Treffer',()=>{
  const doc=processDoc({contexts:[]});
  const result=contextApi.resolve({view:'shipment',action:'abd-request',role:'export'},{documents:[doc],rights:{read:true}});
  assert.equal(result.primary,null);
});
