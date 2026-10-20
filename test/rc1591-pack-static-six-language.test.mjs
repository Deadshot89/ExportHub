import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('pack.html','utf8');
const source=fs.readFileSync('assets/i18n/pack-notification.js','utf8');
const originals={
  'pack.static.intro':'Neue Sendung erfassen oder einen offenen Entwurf fortsetzen.',
  'pack.static.homeHelp':'Entwürfe können an jedem Packtisch weiterbearbeitet werden.',
  'pack.static.newShipment':'+ Neue Sendung melden',
  'pack.static.noOpenShipments':'Keine offenen Sendungen vorhanden.',
  'pack.static.overview':'← Übersicht',
  'pack.static.deliveryNotesHelp':'Mindestens einen Lieferschein als PDF, JPG oder PNG hochladen. Mehrere Lieferscheine sind möglich.',
  'pack.static.saveHint':'Entwurf kann jederzeit gespeichert werden.',
  'pack.static.saveDraft':'Entwurf speichern',
  'pack.static.backToOverview':'Zur Übersicht'
};
const languages=['de','en','pl','es','fr','it'];

function runtime(){
  const nodes=Object.values(originals).map(value=>({
    nodeType:3,nodeValue:value,parentElement:{tagName:'SPAN'}
  }));
  const body={nodeType:1,hasAttribute(){return false}};
  const document={
    body,documentElement:{lang:'de'},readyState:'loading',addEventListener(){},
    createTreeWalker(){let pos=0;return{nextNode(){return nodes[pos++]||null}}}
  };
  const window={document};
  const ctx={window};
  vm.runInNewContext(source,ctx,{filename:'assets/i18n/pack-notification.js',timeout:3000});
  return{nodes,document,api:window.ExportHUBPackI18n};
}

test('Packmeldungs-UI: nine static source labels remain backed by all six dictionary packs',()=>{
  const {api}=runtime();
  assert.ok(api&&api.packs);
  for(const [key,sourceText] of Object.entries(originals)){
    assert.ok(html.includes('>'+sourceText+'<'),'pack.html source label missing: '+key);
    assert.equal(api.packs.de[key],sourceText,'German source mismatch: '+key);
    for(const language of languages){
      const translated=api.packs[language][key];
      assert.ok(typeof translated==='string'&&translated.trim(),language+' missing: '+key);
      assert.equal(api.t(key,null,language),translated,'runtime lookup failed: '+language+' '+key);
      if(language!=='de')assert.notEqual(translated,sourceText,'untranslated: '+language+' '+key);
    }
  }
});

test('Packmeldungs-UI: original labels translate and switch back without retaining a previous language',()=>{
  const {nodes,document,api}=runtime();
  for(const language of ['en','pl','es','fr','it','de']){
    api.setLanguage(language);
    assert.equal(document.documentElement.lang,language);
    for(const [index,key] of Object.keys(originals).entries()){
      assert.equal(nodes[index].nodeValue,api.packs[language][key],language+' wrong DOM label: '+key);
    }
  }
});
