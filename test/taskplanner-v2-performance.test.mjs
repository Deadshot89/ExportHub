import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout,performance};
  context.globalThis=context;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-projections.js']){
    vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return context.ExportHUBTaskProjectionsV2;
}

function activeTasks(count){
  return Array.from({length:count},(_,i)=>({
    id:`a${i}`,title:`Active ${i}`,customerId:`C${i%50}`,processId:i%2?'PICK':'REG',seriesId:`S${i%20}`,
    status:i%11===0?'waiting':'open',priority:i%37===0?'P0':'P2',
    plannedAt:`2026-10-${String(12+(i%5)).padStart(2,'0')}T09:00:00+02:00`,
    dueAt:`2026-10-${String(12+(i%5)).padStart(2,'0')}T16:15:00+02:00`
  }));
}

function archiveTasks(count){
  return Array.from({length:count},(_,i)=>({
    id:`h${i}`,title:`History ${i}`,customerId:`C${i%50}`,processId:i%2?'PICK':'REG',seriesId:`S${i%20}`,
    status:'done',completionMode:i%3===0?'automatic':'manual',completedAt:'2026-09-30T12:00:00+02:00',archivedAt:'2026-10-08T12:00:00+02:00'
  }));
}

test('index/today/week/dashboard iterieren bei 5k aktiv niemals das 50k-Archiv',()=>{
  const p=load(),tasks=activeTasks(5000);
  const archive=archiveTasks(50000);
  const guarded=new Proxy(archive,{
    get(target,prop,receiver){
      if(prop===Symbol.iterator||prop==='forEach'||prop==='map'||prop==='filter'||prop==='reduce'||prop==='slice')throw new Error('active projection touched archive');
      return Reflect.get(target,prop,receiver);
    }
  });
  const state={tasks,taskArchive:guarded},ctx={now:'2026-10-13T12:00:00+02:00',persist(){throw new Error('projection must be read-only');}};
  assert.equal(p.index(state,ctx).activeCount,5000);
  assert.ok(p.today(state,ctx));
  assert.ok(p.week(state,ctx));
  assert.ok(p.dashboard(state,ctx));
});

test('identische aktive Projektion nutzt stabilen Cache und UI-Filter lösen keinen Persist aus',()=>{
  const p=load(),state={tasks:activeTasks(5000),taskArchive:archiveTasks(10)};
  let persists=0;
  const a=p.dashboard(state,{now:'2026-10-13T12:00:00+02:00',uiFilter:{priority:'P0'},persist(){persists++;}});
  const b=p.dashboard(state,{now:'2026-10-13T12:00:00+02:00',uiFilter:{priority:'P3'},persist(){persists++;}});
  assert.strictEqual(a,b,'UI-only Filter darf aktiven Dashboard-Cache nicht invalidieren');
  assert.equal(persists,0);
  assert.ok(typeof a.signature==='string'&&a.signature.length>0);
});

test('Kunden-/Archivpfad paginiert 50k Historie statt Vollbestand in Ergebnis zu kopieren',()=>{
  const p=load(),state={tasks:activeTasks(5000),taskArchive:archiveTasks(50000)};
  const customer=p.customer('C7',state,{now:'2026-10-13T12:00:00+02:00',page:2,pageSize:25});
  assert.equal(customer.history.items.length,25);
  assert.equal(customer.history.total,1000);
  assert.equal(customer.history.pages,40);
  const archive=p.archive({customerId:'C7',page:1,pageSize:50},state,{});
  assert.equal(archive.items.length,50);
  assert.equal(archive.total,1000);
});

test('Monatsdarstellung bleibt Tagesaggregation und enthält keine Vollkarten aus Projektionen',()=>{
  const p=load(),state={tasks:activeTasks(5000),taskArchive:archiveTasks(50000)};
  const index=p.index(state,{now:'2026-10-13T12:00:00+02:00'});
  assert.ok(index.byDay&&typeof index.byDay==='object');
  for(const value of Object.values(index.byDay)){
    assert.equal(typeof value.count,'number');
    assert.equal(value.items,undefined,'Index darf keine vollständigen Karten je Tag materialisieren');
  }
});
