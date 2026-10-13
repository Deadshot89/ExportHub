import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function load(){const c={console,Date,Intl};c.globalThis=c;vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-core.js','utf8'),c);vm.runInNewContext(fs.readFileSync('assets/taskplanner-v2-recurrence.js','utf8'),c);return c.ExportHUBTaskRecurrenceV2;}

test('NRW Feiertage werden algorithmisch für mehrere und spätere Jahre berechnet',()=>{
  const api=load();
  for(const year of [2026,2027,2028,2035]){
    const rows=api.nrwHolidays(year),set=new Set(Array.from(rows,r=>r.date));
    assert.ok(set.has(`${year}-01-01`));assert.ok(set.has(`${year}-05-01`));assert.ok(set.has(`${year}-10-03`));assert.ok(set.has(`${year}-11-01`));assert.ok(set.has(`${year}-12-25`));assert.ok(set.has(`${year}-12-26`));
    assert.equal(rows.length,11);
  }
});

test('Wochenende, Firmenfeiertag und Betriebsruhe sind keine Arbeitstage',()=>{
  const api=load();
  const cal=api.calendar({companyHolidays:[{date:'2026-10-14',label:'Firma'}],shutdowns:[{startDate:'2026-10-19',endDate:'2026-10-20',label:'Betriebsruhe'}]});
  assert.equal(api.isWorkday('2026-10-17',cal),false);
  assert.equal(api.isWorkday('2026-10-14',cal),false);
  assert.equal(api.isWorkday('2026-10-19',cal),false);
  assert.equal(api.isWorkday('2026-10-21',cal),true);
});

test('moveWorkdays überspringt mehrere aufeinanderfolgende freie Tage',()=>{
  const api=load();
  const cal=api.calendar({companyHolidays:[{date:'2026-12-24'}],shutdowns:[{startDate:'2026-12-28',endDate:'2026-12-31'}]});
  assert.equal(api.moveWorkdays('2026-12-23',1,cal),'2027-01-04');
  assert.equal(api.moveWorkdays('2027-01-04',-1,cal),'2026-12-23');
});

test('Feiertagspolicies previous next manual und process sind fail-closed',()=>{
  const api=load(),cal=api.calendar({companyHolidays:[{date:'2026-10-15'}]});
  assert.equal(api.resolveHoliday('2026-10-15','previous_workday',cal).date,'2026-10-14');
  assert.equal(api.resolveHoliday('2026-10-15','next_workday',cal).date,'2026-10-16');
  const manual=api.resolveHoliday('2026-10-15','manual_decision',cal);
  assert.equal(manual.date,null);assert.equal(manual.conflict,true);assert.equal(manual.requiresDecision,true);
  const process=api.resolveHoliday('2026-10-15','process_rule',cal);
  assert.equal(process.date,null);assert.equal(process.conflict,true);assert.equal(process.requiresProcessRule,true);
});

test('validateRule blockiert unvollständige Wiederholungsregeln',()=>{
  const api=load();
  assert.equal(api.validateRule({type:'weekly',weekdays:[]}).valid,false);
  assert.equal(api.validateRule({type:'nth_weekday',weekday:2,nth:2}).valid,true);
  assert.equal(api.validateRule({type:'workdays_before_month_end',offset:3}).valid,true);
});
