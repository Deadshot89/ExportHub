import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Kompakt/Detailliert (setViewPreference) and template saves call ctx.persist with
// taskSettings / taskTemplates. The canonical planner wrapper must never treat
// those values as the task list: before the fix every task was wiped and saved.
function load(shared){
  const saves=[];
  const ctx={console,Date,setTimeout(){},
    __EXPORTHUB_GET_STATE__:()=>shared,
    ExportHUBClean:{queueSave:r=>{saves.push(r);return true}},
    ExportHUBTaskUIV2:{renderPlannerPage(target,c){target.ctx=c;return target},bindPlannerDnD(target,c){target.dnd=c;return target}}};
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.runInNewContext(fs.readFileSync('assets/rc1537-taskplanner-canonical-source.js','utf8'),ctx);
  return {ui:ctx.ExportHUBTaskUIV2,saves};
}

test('RC1537 persist: Ansicht Kompakt/Detailliert löscht keine Aufgaben',()=>{
  const shared={tasks:[{id:'a',title:'Pick Montag'},{id:'b',title:'Pick Dienstag'}],taskSettings:{users:{}},taskTemplates:[{id:'tpl'}]};
  const {ui,saves}=load(shared);
  const target={innerHTML:''};
  ui.renderPlannerPage(target,{state:shared});
  const persist=target.ctx.persist;
  persist(shared.taskSettings);
  assert.equal(shared.tasks.length,2,'taskSettings-Objekt ersetzt nicht die Aufgaben');
  persist(shared.taskTemplates);
  assert.equal(shared.tasks.length,2,'Vorlagen ersetzen nicht die Aufgaben');
  assert.equal(shared.tasks[0].id,'a');
  assert.equal(saves.length,2,'Einstellungen werden trotzdem gespeichert');
  const next=[...shared.tasks,{id:'c',title:'Neu'}];
  persist(next);
  assert.equal(shared.tasks,next,'eine echte Aufgabenliste wird weiter übernommen');
});

test('RC1537 persist: Drag-and-drop-Kontext hat denselben Schutz',()=>{
  const shared={tasks:[{id:'a'}],taskSettings:{users:{}}};
  const {ui}=load(shared);
  const target={innerHTML:''};
  ui.bindPlannerDnD(target,{state:shared});
  target.dnd.persist({users:{x:{viewMode:'compact'}}});
  assert.equal(shared.tasks.length,1);
});
