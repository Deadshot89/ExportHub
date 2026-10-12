import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/sop/rc1501-sop-tour-ui.js').catch(()=>{});
const ui=globalThis.ExportHubSopTourUi;

function session(overrides={}){return {sopNumber:'SOP-EH-060',title:'ABD durchführen',status:'active',stepNumber:2,total:5,percent:40,wrongActions:1,currentStep:{id:'abd-open',instruction:'Öffne den ABD-Bereich.',warnings:['Prüfe zuerst den ABD-Bedarf.'],target:{stableKey:'shipment-abd-decision'}},feedback:null,...overrides};}

test('render zeigt Titel, Schritt, Fortschritt, Anweisung und Tipp barrierearm',()=>{
  assert.ok(ui,'ExportHubSopTourUi fehlt');
  const html=ui.render(session());
  assert.match(html,/ABD durchführen/);
  assert.match(html,/Schritt\s*2\s*von\s*5/i);
  assert.match(html,/40\s*%/);
  assert.match(html,/Öffne den ABD-Bereich/);
  assert.match(html,/Prüfe zuerst den ABD-Bedarf/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/role="status"/);
  assert.match(html,/data-sop-tour-previous/);
  assert.match(html,/data-sop-tour-pause/);
  assert.match(html,/data-sop-tour-end/);
});

test('render enthält keine Schaltfläche, die den produktiven Arbeitsschritt automatisch ausführt',()=>{
  const html=ui.render(session());
  assert.doesNotMatch(html,/automatisch ausführen|für mich ausführen|auto-action|data-sop-tour-execute/i);
});

test('paused und completed werden verständlich dargestellt',()=>{
  assert.match(ui.render(session({status:'paused'})),/Fortsetzen/i);
  assert.match(ui.render(session({status:'completed',percent:100})),/100\s*%/);
  assert.match(ui.render(session({status:'completed',percent:100})),/abgeschlossen/i);
});

test('hasEnabledTour und startButtonHtml zeigen Anleitung nur bei aktivierten Tour-Schritten',()=>{
  const active={number:'SOP-EH-060',steps:[{tour:{enabled:false}},{tour:{enabled:true}}]};
  assert.equal(ui.hasEnabledTour(active),true);
  assert.match(ui.startButtonHtml(active),/Anleitung starten/);
  assert.match(ui.startButtonHtml(active),/data-sop-tour-start/);
  assert.equal(ui.hasEnabledTour({steps:[{tour:{enabled:false}}]}),false);
  assert.equal(ui.startButtonHtml({steps:[]}),'' );
});

test('eventDescriptor liest nur beobachtete Benutzeraktion und nächsten stabilen Tour-Key',()=>{
  const target={getAttribute:n=>n==='data-tour-key'?'shipment-abd-decision':'',closest(sel){return sel==='[data-tour-key]'?this:null;}};
  const descriptor=ui.eventDescriptor({type:'click',target});
  assert.deepEqual(descriptor,{action:'click',stableKey:'shipment-abd-decision'});
});

test('Highlight desselben Tour-Ziels scrollt nur einmal und bleibt stabil',()=>{
  assert.equal(typeof ui.highlightCurrent,'function','highlightCurrent fehlt');
  let scrolls=0,adds=0,removes=0;
  const target={
    classList:{add(){adds+=1;},remove(){removes+=1;}},
    scrollIntoView(){scrolls+=1;}
  };
  const previous=globalThis.ExportHubSopTourTargets;
  globalThis.ExportHubSopTourTargets={find(){return {ok:true,element:target};}};
  const active=session();
  ui.highlightCurrent(active);
  ui.highlightCurrent(active);
  assert.equal(scrolls,1,'gleiches Ziel darf Smooth-Scroll nicht wiederholt neu starten');
  assert.equal(adds,1,'gleiches Ziel darf Highlight nicht wiederholt neu aufbauen');
  assert.equal(removes,0,'gleiches Ziel darf Highlight nicht zwischen Mutationen entfernen');
  ui.highlightCurrent(session({status:'paused'}));
  assert.equal(removes,1,'bei Pause muss Highlight entfernt werden');
  globalThis.ExportHubSopTourTargets=previous;
});

test('CSS besitzt responsive Tour-Steuerung, Fokusmarkierung und reduziert Bewegung',()=>{
  const css=fs.readFileSync('assets/sop/rc1501-sop-tour.css','utf8');
  assert.match(css,/\.rc1501-sop-tour-panel/);
  assert.match(css,/\.rc1501-sop-tour-target/);
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
