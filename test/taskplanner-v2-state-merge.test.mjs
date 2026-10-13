import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {COLLECTION_KEYS,mergeState}=require('../api/shared/merge.js');

const ids=list=>(Array.isArray(list)?list:[]).map(x=>x&&x.id).sort();

test('TaskPlanner V2 Collections besitzen explizite stabile ID-Mergeverträge',()=>{
  assert.deepEqual(COLLECTION_KEYS.taskSeries,['id']);
  assert.deepEqual(COLLECTION_KEYS.taskTemplates,['id']);
  assert.deepEqual(COLLECTION_KEYS.taskArchive,['id']);
});

test('konkurrierende Saves verlieren keine unabhängigen Serien, Vorlagen oder Archivdatensätze',()=>{
  const server={
    taskSeries:[{id:'S-server',title:'Server series',updatedAt:'2026-10-13T10:00:00Z'}],
    taskTemplates:[{id:'T-server',title:'Server template',updatedAt:'2026-10-13T10:00:00Z'}],
    taskArchive:[{id:'A-server',title:'Server archive',completedAt:'2026-10-12T10:00:00Z'}]
  };
  const incoming={
    taskSeries:[{id:'S-client',title:'Client series',updatedAt:'2026-10-13T10:01:00Z'}],
    taskTemplates:[{id:'T-client',title:'Client template',updatedAt:'2026-10-13T10:01:00Z'}],
    taskArchive:[{id:'A-client',title:'Client archive',completedAt:'2026-10-12T11:00:00Z'}]
  };
  const merged=mergeState(server,incoming);
  assert.deepEqual(ids(merged.taskSeries),['S-client','S-server']);
  assert.deepEqual(ids(merged.taskTemplates),['T-client','T-server']);
  assert.deepEqual(ids(merged.taskArchive),['A-client','A-server']);
});

test('gleiche V2-ID folgt dem neueren Datensatz statt Dubletten zu erzeugen',()=>{
  const merged=mergeState(
    {taskTemplates:[{id:'T1',title:'Alt',updatedAt:'2026-10-13T10:00:00Z'}],taskArchive:[]},
    {taskTemplates:[{id:'T1',title:'Neu',updatedAt:'2026-10-13T10:05:00Z'}],taskArchive:[]}
  );
  assert.equal(merged.taskTemplates.length,1);
  assert.equal(merged.taskTemplates[0].title,'Neu');
});

test('unabhängige TaskSettings- und TaskCalendar-Felder bleiben bei parallelen Saves erhalten',()=>{
  const server={
    taskSettings:{users:{u1:{viewMode:'compact'}},reminderLedger:{server:{taskId:'A'}}},
    taskCalendar:{region:'NRW',companyName:'Server Company'}
  };
  const incoming={
    taskSettings:{users:{u2:{viewMode:'detailed'}},reminderLedger:{client:{taskId:'B'}}},
    taskCalendar:{timezone:'Europe/Berlin'}
  };
  const merged=mergeState(server,incoming);
  assert.equal(merged.taskSettings.users.u1.viewMode,'compact');
  assert.equal(merged.taskSettings.users.u2.viewMode,'detailed');
  assert.equal(merged.taskSettings.reminderLedger.server.taskId,'A');
  assert.equal(merged.taskSettings.reminderLedger.client.taskId,'B');
  assert.equal(merged.taskCalendar.region,'NRW');
  assert.equal(merged.taskCalendar.companyName,'Server Company');
  assert.equal(merged.taskCalendar.timezone,'Europe/Berlin');
});
