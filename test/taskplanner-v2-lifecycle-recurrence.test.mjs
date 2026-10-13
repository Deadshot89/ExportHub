import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
 const c={console,Date,Intl};c.globalThis=c;
 for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/rc1014-task-lifecycle.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 return c.ExportHUBRC1014Tasks;
}

test('Lifecycle delegiert Legacy-Folgevorkommen an Recurrence V2 und erzeugt keine Dublette',()=>{
 const api=load(),ctx={companyId:'essentra',environment:'production',now:'2026-10-12T08:00:00+02:00'};
 const done={id:'weekly',group:'Picks',sourceType:'manual',sourceId:'legacy',companyId:'essentra',environment:'production',title:'Weekly',status:'done',dueAt:'2026-10-09',recurrence:'weekly',occurrenceKey:'2026-W41'};
 const first=api.reconcile([done],{},ctx);
 assert.equal(first.tasks.length,2);
 const second=api.reconcile(first.tasks,{},ctx);
 assert.equal(second.tasks.length,2);
});

test('Lifecycle materialisiert state.taskSeries für aktuelle und nächste Woche über V2',()=>{
 const api=load(),ctx={companyId:'essentra',environment:'production',now:'2026-10-12T08:00:00+02:00'};
 const domain={taskSeries:[{id:'s1',title:'Mo+Do',startDate:'2026-10-01',rule:{type:'weekly',weekdays:[1,4]},priority:'P2'}],taskCalendar:{}};
 const result=api.reconcile([],domain,ctx);
 const keys=result.tasks.map(t=>t.occurrenceKey).sort();
 assert.deepEqual(keys,['s1|2026-10-12','s1|2026-10-15','s1|2026-10-19','s1|2026-10-22']);
 assert.equal(result.changed,true);
});

test('migrierte Legacy-Serie mit Platzhalterregel erzeugt weiter Folgevorkommen',()=>{
 const api=load(),ctx={companyId:'essentra',environment:'production',now:'2026-10-12T08:00:00+02:00'};
 const done={id:'legacy-series-task',group:'Picks',sourceType:'manual',sourceId:'legacy-series-source',companyId:'essentra',environment:'production',title:'Legacy Weekly',status:'done',dueAt:'2026-10-09',recurrence:'weekly',seriesId:'legacy-series',occurrenceKey:'2026-W41'};
 const domain={taskSeries:[{id:'legacy-series',schemaVersion:2,migratedFromLegacy:true}],taskCalendar:{}};
 const result=api.reconcile([done],domain,ctx);
 assert.equal(result.tasks.length,2,'Legacy-Serienplatzhalter darf Folgevorkommen nicht blockieren');
 assert.ok(result.tasks.some(t=>t.id.startsWith('legacy-series-task:next:')));
});
