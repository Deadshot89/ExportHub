import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1501-sop-tour-validator.js').catch(()=>{});
const validator=globalThis.ExportHubSopTourValidator;

function element({value='',hidden=false,ariaHidden='',display='',visibility=''}={}){
  return {value,hidden,style:{display,visibility},getAttribute(name){return name==='aria-hidden'?ariaHidden:null;}};
}
function rootFor(entries={}){
  return {querySelectorAll(selector){
    const match=selector.match(/^\[data-tour-key="(.*)"\]$/);
    return match?(entries[match[1]]||[]):[];
  }};
}

test('element-visible besteht nur bei eindeutig sichtbarem stableKey',()=>{
  assert.ok(validator,'ExportHubSopTourValidator fehlt');
  const root=rootFor({'abd-dialog':[element()]});
  assert.deepEqual(validator.evaluate({type:'element-visible',key:'abd-dialog'},{root}),{ok:true,reason:'OK',details:{type:'element-visible',key:'abd-dialog'}});
});

test('element-visible scheitert bei fehlendem, verborgenem oder doppeltem Ziel fail-closed',()=>{
  const missing=validator.evaluate({type:'element-visible',key:'missing'},{root:rootFor({})});
  assert.equal(missing.ok,false); assert.equal(missing.reason,'TARGET_NOT_FOUND');
  const hidden=validator.evaluate({type:'element-visible',key:'hidden'},{root:rootFor({hidden:[element({hidden:true})]})});
  assert.equal(hidden.ok,false); assert.equal(hidden.reason,'TARGET_NOT_VISIBLE');
  const duplicate=validator.evaluate({type:'element-visible',key:'dup'},{root:rootFor({dup:[element(),element()]})});
  assert.equal(duplicate.ok,false); assert.equal(duplicate.reason,'TARGET_AMBIGUOUS');
});

test('field-value prüft den tatsächlichen Feldwert',()=>{
  const root=rootFor({country:[element({value:'CH'})]});
  assert.equal(validator.evaluate({type:'field-value',key:'country',value:'CH'},{root}).ok,true);
  const wrong=validator.evaluate({type:'field-value',key:'country',value:'DE'},{root});
  assert.equal(wrong.ok,false); assert.equal(wrong.reason,'FIELD_VALUE_MISMATCH');
});

test('state prüft verschachtelte Zustände ohne eval',()=>{
  const context={state:{shipment:{status:'Bereit zur Abholung'}}};
  assert.equal(validator.evaluate({type:'state',path:'shipment.status',equals:'Bereit zur Abholung'},context).ok,true);
  const wrong=validator.evaluate({type:'state',path:'shipment.status',equals:'Abgeholt'},context);
  assert.equal(wrong.ok,false); assert.equal(wrong.reason,'STATE_MISMATCH');
});

test('document-present findet Dokumentkategorien im bereitgestellten Dokumentkontext',()=>{
  const context={documents:[{category:'Lieferschein'},{category:'ABD'}]};
  assert.equal(validator.evaluate({type:'document-present',category:'ABD'},context).ok,true);
  const missing=validator.evaluate({type:'document-present',category:'CMR'},context);
  assert.equal(missing.ok,false); assert.equal(missing.reason,'DOCUMENT_NOT_PRESENT');
});

test('fehlende Pflichtparameter und unbekannte Bedingungen sind niemals implizit erfolgreich',()=>{
  for(const condition of [{type:'element-visible'},{type:'field-value',key:''},{type:'state'},{type:'document-present'},{type:'magic'}]){
    const result=validator.evaluate(condition,{root:rootFor({}),state:{},documents:[]});
    assert.equal(result.ok,false);
  }
});

test('evaluateAll akzeptiert keine fehlerhafte Teilbedingung und liefert den Fehlerindex',()=>{
  const context={state:{shipment:{status:'Entwurf'}},root:rootFor({}),documents:[]};
  const result=validator.evaluateAll([
    {type:'state',path:'shipment.status',equals:'Entwurf'},
    {type:'document-present',category:'ABD'}
  ],context);
  assert.equal(result.ok,false);
  assert.equal(result.details.index,1);
  assert.equal(validator.evaluateAll([],context).ok,true);
});
