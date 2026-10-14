import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/sop/rc1502-sop-visuals.js');
await import('../assets/sop/rc1007-sop-ui.js');

const ui=globalThis.ExportHubIsoSopUi;

function visualDocument(visual){
  return {
    number:'SOP-EH-060',
    title:'ABD durchführen',
    area:'Export',
    status:'Freigegeben',
    version:'2.0',
    validFrom:'2026-10-12',
    processOwner:'Export',
    sections:{
      purpose:'ABD sicher bearbeiten',
      scope:'Nicht-EU-Sendungen',
      steps:[{id:'step-1',text:'ABD-Bereich öffnen und prüfen.'}]
    },
    visuals:[visual]
  };
}

test('Schrittbild rendert Zoom-Dialog, Annotationen und erwartetes Ergebnis',()=>{
  assert.ok(ui,'ExportHubIsoSopUi fehlt');
  const html=ui.renderDocument(visualDocument({
    type:'screenshot',
    stepId:'step-1',
    src:'/assets/sop/screenshots/rc1018-abd.png',
    caption:'ABD-Bereich in der Sendung',
    annotations:[
      {type:'focus',x:12,y:18,width:42,height:24},
      {type:'marker',x:66,y:30,label:'1'},
      {type:'arrow',x:20,y:70,toX:58,toY:42},
      {type:'caption',x:10,y:84,text:'Hier ABD anfordern'},
      {type:'expectedResult',text:'ABD-Dialog ist geöffnet'}
    ]
  }),{rights:{read:true}});

  assert.match(html,/data-sop-visual-zoom=/);
  assert.match(html,/<dialog[^>]+class="[^"]*rc1502-sop-zoom/);
  assert.match(html,/aria-modal="true"/);
  assert.match(html,/data-annotation-type="focus"/);
  assert.match(html,/data-annotation-type="marker"/);
  assert.match(html,/data-annotation-type="arrow"/);
  assert.match(html,/data-annotation-type="caption"/);
  assert.match(html,/ABD-Dialog ist geöffnet/);
  assert.match(html,/ABD-Bereich in der Sendung/);
});

test('Placeholder bleibt lesbarer Fallback und bietet keinen leeren Zoom an',()=>{
  const html=ui.renderDocument(visualDocument({
    type:'placeholder',
    stepId:'step-1',
    caption:'Screenshot noch nicht vorhanden'
  }),{rights:{read:true}});
  assert.match(html,/rc1007-sop-placeholder/);
  assert.match(html,/Screenshot noch nicht vorhanden/);
  assert.doesNotMatch(html,/data-sop-visual-zoom=/);
});

test('Escape schließt den Zoom und gibt den Fokus an den Auslöser zurück',()=>{
  assert.equal(typeof ui.handleZoomKeydown,'function','Keyboard-Zoom-Handler fehlt');
  let closed=0;
  let focused=0;
  let prevented=0;
  const trigger={focus(){focused++;}};
  const dialog={
    __rc1502ReturnFocus:trigger,
    close(){closed++;},
    removeAttribute(){},
    matches(selector){return selector==='.rc1502-sop-zoom';}
  };
  const event={
    key:'Escape',
    target:{closest(selector){return selector==='.rc1502-sop-zoom'?dialog:null;}},
    preventDefault(){prevented++;}
  };
  assert.equal(ui.handleZoomKeydown(event),true);
  assert.equal(closed,1);
  assert.equal(focused,1);
  assert.equal(prevented,1);
});

test('Visual-CSS enthält Zoom, Fokus, Mobile und Print-Regeln',()=>{
  const css=fs.readFileSync('assets/sop/rc1007-sop.css','utf8');
  assert.match(css,/\.rc1502-sop-visual-stage/);
  assert.match(css,/\.rc1502-sop-annotation/);
  assert.match(css,/\.rc1502-sop-zoom/);
  assert.match(css,/\.rc1502-sop-zoom-close:focus-visible/);
  assert.match(css,/@media\s*\(max-width:760px\)[\s\S]*rc1502-sop-zoom/);
  assert.match(css,/@media print[\s\S]*rc1502-sop-zoom/);
});
