import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1544-sop-guided-workspace.js');

const workspace=globalThis.ExportHubSopGuidedWorkspace;

function legacyDoc(){
  return {
    number:'SOP-EH-060',
    title:'ABD vom Bedarf bis zur Versandfreigabe',
    version:'2.0',
    area:'ABD und Mail',
    sections:{
      prerequisites:['Sendung ist gespeichert'],
      checks:['ABD-Status prüfen'],
      deviations:['Bei Fehler stoppen'],
      steps:[
        {id:'step-1',text:'Sendung öffnen.'},
        {id:'step-2',text:'ABD anfordern.'},
        {id:'step-3',text:'MRN prüfen.'}
      ]
    },
    visuals:[{type:'screenshot',stepId:'step-2',src:'/assets/sop/screenshots/abd.png',caption:'ABD anfordern'}]
  };
}

function unifiedDoc(){
  return {
    number:'SOP-CUST-DHL',
    title:'DHL Express',
    currentVersion:'3.1',
    versions:[{
      version:'3.1',
      status:'Freigegeben',
      content:{
        prerequisites:['Kunde und Empfänger bekannt'],
        checks:['Sendungsnummer übernehmen'],
        steps:[
          {id:'dhl-1',title:'Versandart prüfen',instruction:'Prüfe Paket oder Palette.',required:true,checks:['Versandart passt'],warnings:['Palette nicht als Paket anmelden']},
          {id:'dhl-2',title:'Zahler auswählen',instruction:'Kundenspezifischen Zahler wählen.',required:true,expectedResult:'Zahler ist gesetzt'}
        ]
      },
      visuals:[{type:'screenshot',stepId:'dhl-1',src:'/assets/sop/screenshots/dhl-1.png',caption:'Versandart'}]
    }]
  };
}

test('RC1544: Workspace API ist vorhanden',()=>{
  assert.ok(workspace,'ExportHubSopGuidedWorkspace fehlt');
  for(const name of ['documentModel','progressState','canOpenStep','completeStep','renderNavigation','renderContext']){
    assert.equal(typeof workspace[name],'function',`${name} fehlt`);
  }
});

test('RC1544: Legacy- und Unified-Schritte laufen durch dasselbe Modell ohne Textverlust',()=>{
  const legacy=workspace.documentModel(legacyDoc());
  assert.equal(legacy.steps.length,3);
  assert.equal(legacy.steps[1].instruction,'ABD anfordern.');
  assert.equal(legacy.steps[1].title,'ABD anfordern.');
  assert.equal(legacy.steps[1].visuals.length,1);
  assert.equal(legacy.steps[1].visuals[0].src,'/assets/sop/screenshots/abd.png');

  const unified=workspace.documentModel(unifiedDoc());
  assert.equal(unified.steps.length,2);
  assert.equal(unified.steps[0].title,'Versandart prüfen');
  assert.equal(unified.steps[0].instruction,'Prüfe Paket oder Palette.');
  assert.deepEqual(unified.steps[0].checks,['Versandart passt']);
  assert.deepEqual(unified.steps[0].warnings,['Palette nicht als Paket anmelden']);
  assert.equal(unified.steps[1].expectedResult,'Zahler ist gesetzt');
});

test('RC1544: Pflichtschritte verhindern Überspringen und erlauben Rücksprung',()=>{
  const model=workspace.documentModel(unifiedDoc());
  let progress=workspace.progressState(model.steps,null);
  assert.equal(workspace.canOpenStep(model.steps,progress,0),true);
  assert.equal(workspace.canOpenStep(model.steps,progress,1),false,'Schritt 2 darf vor Bestätigung von Schritt 1 nicht geöffnet werden');

  progress=workspace.completeStep(model.steps,progress,0);
  assert.equal(progress.completed['dhl-1']!==undefined,true);
  assert.equal(workspace.canOpenStep(model.steps,progress,1),true);
  assert.equal(workspace.canOpenStep(model.steps,progress,0),true,'Rücksprung muss möglich bleiben');
});

test('RC1544: Navigation kennzeichnet aktiven, erledigten und gesperrten Schritt barrierefrei',()=>{
  const model=workspace.documentModel(unifiedDoc());
  let progress=workspace.progressState(model.steps,null);
  let html=workspace.renderNavigation(model.steps,progress);
  assert.match(html,/data-sop-guided-step="dhl-1"/);
  assert.match(html,/aria-current="step"/);
  assert.match(html,/data-sop-guided-step="dhl-2"[^>]*disabled/);

  progress=workspace.completeStep(model.steps,progress,0);
  progress.currentStep=1;
  html=workspace.renderNavigation(model.steps,progress);
  assert.match(html,/data-step-state="done"/);
  assert.match(html,/data-sop-guided-step="dhl-2"[^>]*aria-current="step"/);
});

test('RC1544: Kontextpanel zeigt allgemeine und schrittspezifische Hinweise',()=>{
  const model=workspace.documentModel(unifiedDoc());
  const html=workspace.renderContext(model,model.steps[0]);
  assert.match(html,/Kunde und Empfänger bekannt/);
  assert.match(html,/Sendungsnummer übernehmen/);
  assert.match(html,/Palette nicht als Paket anmelden/);
  assert.match(html,/Versandart passt/);
});
