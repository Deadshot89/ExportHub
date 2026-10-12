import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1502-sop-visuals.js').catch(()=>{});
const visuals=globalThis.ExportHubSopVisuals;

function document(overrides={}){
  return {
    number:'SOP-EH-060',
    sections:{steps:[{id:'step-1',text:'ABD öffnen'},{id:'step-2',text:'ABD prüfen'}]},
    visuals:[],
    ...overrides
  };
}

test('normalize erhält bestehende RC1018-Screenshotdaten und ergänzt sichere Defaults ohne Mutation',()=>{
  assert.ok(visuals,'ExportHubSopVisuals fehlt');
  const input={type:'screenshot',stepId:'step-1',caption:'ABD-Bereich',required:true,src:'/assets/sop/screenshots/rc1018-abd.png'};
  const before=JSON.stringify(input);
  const out=visuals.normalize(input);
  assert.equal(JSON.stringify(input),before,'Quelldaten dürfen nicht mutiert werden');
  assert.equal(out.type,'screenshot');
  assert.equal(out.stepId,'step-1');
  assert.equal(out.src,input.src);
  assert.equal(out.caption,'ABD-Bereich');
  assert.equal(out.required,true);
  assert.deepEqual(out.annotations,[]);
});

test('normalize unterstützt Screenshot, Placeholder und alle freigegebenen Annotationstypen',()=>{
  const out=visuals.normalize({
    type:'screenshot',stepId:'step-2',src:'/assets/sop/screenshots/example.png',order:7,
    annotations:[
      {type:'focus',x:10,y:20,width:30,height:40,label:'Hier klicken'},
      {type:'arrow',x:1,y:2,toX:3,toY:4},
      {type:'marker',x:5,y:6,number:2},
      {type:'caption',text:'Feld prüfen'},
      {type:'crop',x:0,y:0,width:50,height:50},
      {type:'expectedResult',text:'ABD-Bereich sichtbar'}
    ]
  });
  assert.equal(out.order,7);
  assert.deepEqual(out.annotations.map(item=>item.type),['focus','arrow','marker','caption','crop','expectedResult']);
  assert.equal(out.annotations[0].label,'Hier klicken');
  assert.equal(out.annotations[5].text,'ABD-Bereich sichtbar');

  const placeholder=visuals.normalize({type:'placeholder',stepId:'step-1',caption:'Bild wird noch erstellt'});
  assert.equal(placeholder.type,'placeholder');
  assert.equal(placeholder.src,'');
});

test('validateForDocument meldet fehlende Quelle, verwaiste Step-ID und Placeholder sichtbar statt künstlich grün',()=>{
  const doc=document({visuals:[
    {type:'screenshot',stepId:'step-1',src:'',caption:'Quelle fehlt'},
    {type:'screenshot',stepId:'removed-step',src:'/assets/sop/screenshots/orphan.png'},
    {type:'placeholder',stepId:'step-2',caption:'Noch offen'}
  ]});
  const result=visuals.validateForDocument(doc);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(item=>item.code==='SCREENSHOT_SRC_REQUIRED'&&item.stepId==='step-1'));
  assert.ok(result.errors.some(item=>item.code==='ORPHANED_STEP_ID'&&item.stepId==='removed-step'));
  assert.ok(result.warnings.some(item=>item.code==='PLACEHOLDER_VISUAL'&&item.stepId==='step-2'));
  assert.deepEqual(result.orphaned,['removed-step']);
});

test('validateForDocument akzeptiert bestehende Screenshotform und prüft unbekannte Annotationen fail-closed',()=>{
  const valid=visuals.validateForDocument(document({visuals:[{type:'screenshot',stepId:'step-1',src:'/assets/sop/screenshots/rc1018-abd.png',caption:'ABD'}]}));
  assert.equal(valid.ok,true);
  assert.equal(valid.errors.length,0);

  const invalid=visuals.validateForDocument(document({visuals:[{type:'screenshot',stepId:'step-1',src:'/assets/sop/screenshots/a.png',annotations:[{type:'magic'}]}]}));
  assert.equal(invalid.ok,false);
  assert.ok(invalid.errors.some(item=>item.code==='ANNOTATION_TYPE_UNSUPPORTED'));
});

test('visualsForStep liefert mehrere Bilder deterministisch nach order und danach Quellreihenfolge',()=>{
  const doc=document({visuals:[
    {type:'screenshot',stepId:'step-1',src:'/assets/sop/screenshots/c.png',order:20},
    {type:'screenshot',stepId:'step-2',src:'/assets/sop/screenshots/x.png',order:1},
    {type:'screenshot',stepId:'step-1',src:'/assets/sop/screenshots/a.png',order:10},
    {type:'screenshot',stepId:'step-1',src:'/assets/sop/screenshots/b.png',order:10}
  ]});
  const result=visuals.visualsForStep(doc,'step-1');
  assert.deepEqual(result.map(item=>item.src),[
    '/assets/sop/screenshots/a.png',
    '/assets/sop/screenshots/b.png',
    '/assets/sop/screenshots/c.png'
  ]);
});

test('aktuelle Versionsvisuals werden berücksichtigt, ohne historische Fassungen umzuschreiben',()=>{
  const doc=document({
    currentVersion:'2.0',
    visuals:[],
    versions:[
      {version:'1.0',visuals:[{type:'screenshot',stepId:'step-1',src:'/assets/sop/screenshots/old.png'}]},
      {version:'2.0',visuals:[{type:'screenshot',stepId:'step-2',src:'/assets/sop/screenshots/current.png'}]}
    ]
  });
  assert.deepEqual(visuals.visualsForStep(doc,'step-2').map(item=>item.src),['/assets/sop/screenshots/current.png']);
  assert.deepEqual(visuals.visualsForStep(doc,'step-1'),[]);
});
