import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for(const name of ['ExportHubTrainingCenterUi','ExportHubTrainingCenterRuntime'])delete globalThis[name];
await import('../assets/training-center/model.js').catch(()=>{});
await import('../assets/training-center/store.js').catch(()=>{});
await import('../assets/training-center/ui.js').catch(()=>{});
await import('../assets/training-center/runtime.js').catch(()=>{});

const ui=globalThis.ExportHubTrainingCenterUi;
const runtime=globalThis.ExportHubTrainingCenterRuntime;
const center={
  version:1,
  standardProcesses:[{id:'shipment-registration',title:'Sendung anmelden',categoryId:'shipping',version:'1.0',ownerUserId:'Tobias',changedAt:'2026-10-15T08:00:00Z'}],
  customerSops:[{id:'customer-wuerth',title:'Würth Industrie',baseProcessId:'shipment-registration',categoryId:'shipping',version:'1.0',ownerUserId:'Tobias',changedAt:'2026-10-15T08:00:00Z'}],
  trainings:[{id:'first-shipment',title:'Meine erste Sendung',categoryId:'shipping',version:'1.0',ownerUserId:'Tobias',changedAt:'2026-10-15T08:00:00Z'}],
  categories:[{id:'shipping',title:'Versand'}],
  favorites:['shipment-registration'],
  recents:['first-shipment'],
  screenshots:[],learningProgress:[]
};
const tr=(key)=>({
  'trainingCenter.title':'SOP & Training Center',
  'trainingCenter.section.standard':'Standardprozesse',
  'trainingCenter.section.customer':'Kundenspezifische SOPs',
  'trainingCenter.section.training':'Interaktive Touren / Trainings',
  'trainingCenter.search':'SOP suchen',
  'trainingCenter.categories':'Kategorien',
  'trainingCenter.favorites':'Favoriten',
  'trainingCenter.recents':'Zuletzt verwendet',
  'trainingCenter.metadata.version':'Version',
  'trainingCenter.metadata.owner':'Verantwortlicher',
  'trainingCenter.metadata.changed':'Geändert'
}[key]||key);

test('neue UI- und Runtime-APIs existieren ohne Legacy-SOPMaster-Abhängigkeit',()=>{
  assert.ok(ui,'ExportHubTrainingCenterUi fehlt');
  assert.ok(runtime,'ExportHubTrainingCenterRuntime fehlt');
  assert.equal(typeof ui.render,'function');
  assert.equal(typeof runtime.mount,'function');
});

test('render enthält alle drei Hauptbereiche, Suche, Kategorien, Favoriten, Recents und Metadaten',()=>{
  assert.ok(ui,'ExportHubTrainingCenterUi fehlt');
  const html=ui.render(center,{t:tr,section:'standard'});
  for(const marker of [
    'data-training-center-shell',
    'data-training-center-section="standard"',
    'data-training-center-section="customer"',
    'data-training-center-section="training"',
    'data-training-center-search',
    'data-training-center-categories',
    'data-training-center-favorites',
    'data-training-center-recents',
    'data-training-center-metadata'
  ])assert.match(html,new RegExp(marker));
  for(const text of ['Standardprozesse','Kundenspezifische SOPs','Interaktive Touren / Trainings','Sendung anmelden','Version','Verantwortlicher','Geändert'])assert.match(html,new RegExp(text));
  assert.doesNotMatch(html,/SOPMaster|rc150[1-6]|rc101[068]-sop/i);
});

test('Suche und Kategorie filtern die sichtbaren Karten rein funktional',()=>{
  assert.ok(ui,'ExportHubTrainingCenterUi fehlt');
  const shipment=ui.render(center,{t:tr,section:'standard',query:'Sendung',categoryId:'shipping'});
  assert.match(shipment,/Sendung anmelden/);
  const none=ui.render(center,{t:tr,section:'standard',query:'Zoll',categoryId:'shipping'});
  assert.doesNotMatch(none,/Sendung anmelden/);
});

test('CSS enthält responsive Einspalten-/Drawer-Regeln, Fokuszustände und Theme-Token ohne Legacy-Klassen',()=>{
  const css=fs.readFileSync(new URL('../assets/training-center/ui.css',import.meta.url),'utf8');
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(css,/focus-visible/);
  assert.match(css,/data-eh-design/);
  assert.match(css,/minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/\.rc150|sopmaster/i);
});

test('Runtime unterstützt Tastaturnavigation mit Pfeilen, Home und End',()=>{
  const src=fs.readFileSync(new URL('../assets/training-center/runtime.js',import.meta.url),'utf8');
  for(const key of ['ArrowRight','ArrowLeft','Home','End'])assert.match(src,new RegExp(key));
  assert.doesNotMatch(src,/ExportHubIsoSopCatalog|sopLearningProgress|isoSops/);
});

test('alle sechs Sprachen enthalten den vollständigen neuen Training-Center-Namensraum',()=>{
  const files=['de','en','pl','es','fr','it'];
  const keys=[
    'trainingCenter.title','trainingCenter.section.standard','trainingCenter.section.customer','trainingCenter.section.training',
    'trainingCenter.search','trainingCenter.searchPlaceholder','trainingCenter.categories','trainingCenter.allCategories',
    'trainingCenter.favorites','trainingCenter.recents','trainingCenter.metadata.version','trainingCenter.metadata.owner',
    'trainingCenter.metadata.changed','trainingCenter.empty','trainingCenter.mobile.navigation'
  ];
  for(const lang of files){
    const json=JSON.parse(fs.readFileSync(new URL(`../assets/i18n/${lang}.json`,import.meta.url),'utf8'));
    for(const key of keys)assert.equal(typeof json[key],'string',`${lang}: ${key} fehlt`);
  }
});
