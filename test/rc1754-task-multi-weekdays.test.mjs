import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file=name=>fs.readFileSync(name,'utf8');
function setup(){
 const state={tasks:[],taskSeries:[],taskCalendar:{}},w={
  __EXPORTHUB_GET_STATE__:()=>state,
  __EXPORTHUB_GET_CURRENT_USER__:()=>({id:'u',name:'Test'}),
  ExportHUBClean:{queueSave(){}},
  ExportHUBI18n:{language:()=>'de'},
  document:null
 };
 const context=vm.createContext({window:w,globalThis:w,Date,Intl,console,setInterval(){},setTimeout(){},clearTimeout(){}});
 for(const path of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/rc1570-tasks-focus.js'])
   vm.runInContext(file(path),context,{filename:path});
 return{state,api:w.ExportHUBTasksFocus1570,recurrence:w.ExportHUBTaskRecurrenceV2};
}
const days=rows=>rows.map(t=>new Date(t.dueAt.slice(0,10)+'T12:00:00Z').getUTCDay()||7);
test('RC1754: Montag und Mittwoch erzeugen getrennte wöchentliche Aufgaben ohne manuelle Duplikate',()=>{
 const h=setup(),task={id:'task-own',title:'Regelmäßige Exportkontrolle',area:'Export',sourceType:'manual',owner:'Test',priority:'P2'};
 h.state.tasks.push(task);
 assert.equal(h.api.syncWeeklySeries(h.state,task,{weekdays:[1,3],time:'09:00'}),true);
 assert.deepEqual(Array.from(h.state.taskSeries[0].rule.weekdays),[1,3]);
 const generated=h.state.tasks.filter(t=>String(t.occurrenceKey||'').startsWith('rc1570-series:task-own|'));
 assert.ok(generated.length>=3,'current and following week should include both weekdays');
 assert.ok(days(generated).every(d=>d===1||d===3));
 assert.equal(new Set(generated.map(t=>t.occurrenceKey)).size,generated.length);
 assert.ok(generated.every(t=>t.isTemplate!==true),'real occurrences must appear in Aufgabenliste');
 assert.ok(h.state.tasks.find(t=>t.id==='task-own').isTemplate,'series parent is not a duplicate task');
});
test('RC1754: selected days are restored from stored series and from old single-day tasks',()=>{
 const h=setup();
 h.state.taskSeries=[{id:'series',rule:{type:'weekly',weekdays:[1,3]}}];
 assert.deepEqual(Array.from(h.api.weeklyDays({seriesId:'series',day:'Montag'})),[1,3]);
 assert.deepEqual(Array.from(h.api.weeklyDays({day:'Mittwoch'})),[3]);
});
test('RC1754: changing schedule cancels only future uncompleted occurrences, preserves completion history',()=>{
 const h=setup(),id='rc1570-series:original',now=new Date().toISOString().slice(0,10);
 const future=new Date();future.setDate(future.getDate()+12);
 const date=future.toISOString().slice(0,10);
 h.state.tasks=[{id:'done',seriesId:id,occurrenceKey:id+'|'+date,originalOccurrenceDate:date,status:'done',completedAt:now},
  {id:'pending',seriesId:id,occurrenceKey:id+'|'+date,originalOccurrenceDate:date,status:'open'}];
 h.api.retireSeriesDays(h.state,id,[]);
 assert.equal(h.state.tasks[0].status,'done');
 assert.equal(h.state.tasks[1].status,'cancelled');
});
test('RC1754: reselecting a weekday restores only automatically cancelled future occurrences',()=>{
 const h=setup(),id='rc1570-series:reselect',date='2026-12-16';
 h.state.tasks=[
  {id:'auto',seriesId:id,occurrenceKey:id+'|'+date,originalOccurrenceDate:date,status:'open'},
  {id:'manual',seriesId:id,occurrenceKey:id+'|'+date,originalOccurrenceDate:date,status:'cancelled'}
 ];
 h.api.retireSeriesDays(h.state,id,[]);
 assert.equal(h.state.tasks[0].cancelReason,'rc1570_schedule_change');
 h.api.retireSeriesDays(h.state,id,[3]);
 assert.equal(h.state.tasks[0].status,'planned');
 assert.equal(h.state.tasks[1].status,'cancelled','never revive a manually cancelled task');
});
test('RC1754: task form exposes seven checkboxes, not single weekday selector',()=>{
 const js=file('assets/rc1570-tasks-focus.js'),css=file('assets/rc1570-tasks-focus.css');
 assert.match(js,/name="weekdays" value=/);
 assert.doesNotMatch(js,/<select name="weekday">/);
 assert.match(js,/fWeekdaysRequired/);
 assert.match(css,/\.rc1570-weekdays/);
});
test('RC1754: all six interface languages include required weekday selection texts',()=>{
 const w={},c=vm.createContext({window:w,globalThis:w});
 vm.runInContext(file('assets/i18n/rc1570-tasks-focus.js'),c);
 const packs=w.ExportHUBTasksFocus1570I18n.packs;
 for(const lang of ['de','en','pl','es','fr','it'])for(const key of ['fWeekdays','fWeekdaysRequired'])assert.ok(packs[lang][key],lang+' '+key);
});
