import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl};context.globalThis=context;
  vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-core.js','utf8'),context,{filename:'core.js'});
  vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-recurrence.js','utf8'),context,{filename:'recurrence.js'});
  return context.ExportHUBTaskRecurrenceV2;
}
const dates=rows=>Array.from(rows,r=>r.date);
const range=(start,end)=>({start,end});

test('daily materialisiert nur gültige Arbeitstage',()=>{
  const api=load(),cal=api.calendar({});
  const rows=api.occurrences({id:'d',startDate:'2026-10-12',rule:{type:'daily'}},range('2026-10-12','2026-10-18'),cal);
  assert.deepEqual(dates(rows),['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16']);
});

test('mehrere Wochentage Montag und Donnerstag',()=>{
  const api=load(),cal=api.calendar({});
  const rows=api.occurrences({id:'wd',startDate:'2026-10-01',rule:{type:'weekly',intervalWeeks:1,weekdays:[1,4]}},range('2026-10-05','2026-10-16'),cal);
  assert.deepEqual(dates(rows),['2026-10-05','2026-10-08','2026-10-12','2026-10-15']);
});

test('alle zwei Wochen mittwochs',()=>{
  const api=load(),cal=api.calendar({});
  const rows=api.occurrences({id:'2w',startDate:'2026-10-07',rule:{type:'weekly',intervalWeeks:2,weekdays:[3]}},range('2026-10-01','2026-11-05'),cal);
  assert.deepEqual(dates(rows),['2026-10-07','2026-10-21','2026-11-04']);
});

test('jeder zweite Dienstag im Monat',()=>{
  const api=load(),cal=api.calendar({});
  const rows=api.occurrences({id:'2tu',startDate:'2026-01-01',rule:{type:'nth_weekday',nth:2,weekday:2}},range('2026-10-01','2026-12-31'),cal);
  assert.deepEqual(dates(rows),['2026-10-13','2026-11-10','2026-12-08']);
});

test('erster und letzter Arbeitstag des Monats',()=>{
  const api=load(),cal=api.calendar({});
  const first=api.occurrences({id:'first',rule:{type:'first_workday'}},range('2026-05-01','2026-06-30'),cal);
  const last=api.occurrences({id:'last',rule:{type:'last_workday'}},range('2026-05-01','2026-06-30'),cal);
  assert.deepEqual(dates(first),['2026-05-04','2026-06-01']);
  assert.deepEqual(dates(last),['2026-05-29','2026-06-30']);
});

test('drei Arbeitstage vor Monatsende und X Arbeitstage nach Monatsbeginn',()=>{
  const api=load(),cal=api.calendar({});
  const before=api.occurrences({id:'before',rule:{type:'workdays_before_month_end',offset:3}},range('2026-10-01','2026-10-31'),cal);
  const after=api.occurrences({id:'after',rule:{type:'workdays_after_month_start',offset:3}},range('2026-10-01','2026-10-31'),cal);
  assert.deepEqual(dates(before),['2026-10-27']);
  assert.deepEqual(dates(after),['2026-10-06']);
});

test('monatlich und jährlich funktionieren über Jahreswechsel',()=>{
  const api=load(),cal=api.calendar({});
  const monthly=api.occurrences({id:'m',startDate:'2026-11-30',holidayPolicy:'previous_workday',rule:{type:'monthly',day:30}},range('2026-11-01','2027-02-28'),cal);
  assert.deepEqual(dates(monthly),['2026-11-30','2026-12-30','2027-01-29','2027-02-26']);
  const yearly=api.occurrences({id:'y',startDate:'2026-01-01',holidayPolicy:'next_workday',rule:{type:'yearly',month:1,day:1}},range('2026-12-20','2028-01-10'),cal);
  assert.deepEqual(dates(yearly),['2027-01-04','2028-01-03']);
});

test('offene Vorinstanz bleibt erhalten während neue Instanz entsteht und occurrenceKey dedupliziert',()=>{
  const api=load(),cal=api.calendar({});
  const series=[{id:'s1',title:'Freitag',startDate:'2026-10-02',rule:{type:'weekly',intervalWeeks:1,weekdays:[5]},priority:'P2'}];
  const tasks=[{id:'old',title:'Freitag',seriesId:'s1',occurrenceKey:'s1|2026-10-09',dueAt:'2026-10-09T16:15:00+02:00',status:'open'}];
  const result=api.materialize({series,tasks,range:range('2026-10-05','2026-10-16'),calendar:cal,now:'2026-10-12T08:00:00+02:00'});
  assert.equal(result.tasks.filter(t=>t.occurrenceKey==='s1|2026-10-09').length,1);
  assert.equal(result.tasks.filter(t=>t.occurrenceKey==='s1|2026-10-16').length,1);
  assert.equal(result.tasks.find(t=>t.id==='old').status,'open');
});

test('Serienänderung aktualisiert nur offene zukünftige Vorkommen',()=>{
  const api=load(),cal=api.calendar({});
  const series=[{id:'s1',title:'Neu',startDate:'2026-10-02',rule:{type:'weekly',intervalWeeks:1,weekdays:[5]},priority:'P1'}];
  const tasks=[
    {id:'done',title:'Alt',seriesId:'s1',occurrenceKey:'s1|2026-10-09',dueAt:'2026-10-09T16:15:00+02:00',status:'done',priority:'P3'},
    {id:'future',title:'Alt',seriesId:'s1',occurrenceKey:'s1|2026-10-16',dueAt:'2026-10-16T16:15:00+02:00',status:'planned',priority:'P3'}
  ];
  const result=api.materialize({series,tasks,range:range('2026-10-05','2026-10-16'),calendar:cal,now:'2026-10-12T08:00:00+02:00'});
  assert.equal(result.tasks.find(t=>t.id==='done').title,'Alt');
  assert.equal(result.tasks.find(t=>t.id==='done').priority,'P3');
  assert.equal(result.tasks.find(t=>t.id==='future').title,'Neu');
  assert.equal(result.tasks.find(t=>t.id==='future').priority,'P1');
});
