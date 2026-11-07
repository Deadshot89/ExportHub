import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadMaster(file,state){
  const html=fs.readFileSync(file,'utf8');
  const m=html.match(/<script id="index243-idempotent-task-seed-migration">([\s\S]*?)<\/script>/);
  assert.ok(m,'RC848-Wochenstamm im Quelltext');
  const window={__EXPORTHUB_GET_STATE__:()=>state,addEventListener(){},dispatchEvent(){},ExportHUBClean:{queueSave(){}}};
  const document={readyState:'complete',addEventListener(){}};
  vm.runInNewContext(m[1],{window,document,console,CustomEvent:class{constructor(n,o){this.type=n;this.detail=o&&o.detail}},setTimeout:()=>0});
  return window.ExportHUBTaskMasterRC848;
}

function captureFn(file){
  const html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('function captureCollectionDeletions(');
  assert.ok(start>0);
  const end=html.indexOf('\n}\n',start)+3;
  const marked=[];
  const ctx={marked,console:{warn(){}},lower:v=>String(v==null?'':v).toLowerCase(),deletionRecordId:(n,i,x)=>String(i&&i.id||x),markDeleted:(n,id)=>marked.push(id)};
  vm.runInNewContext(html.slice(start,end)+';this.capture=captureCollectionDeletions;',ctx);
  return ctx;
}

const pickIds=['mo-p-uk','mo-p-china-air','di-p-uk','mi-p-uk','do-p-uk','fr-p-uk','mo-p-usa','di-p-usa','mi-p-usa','do-p-usa','fr-p-usa'];

for(const file of ['index.html','TESTVERSION.html']){
  test(`${file}: eine geleerte Aufgabenliste löscht nicht alle Aufgaben auf dem Server`,()=>{
    const c=captureFn(file);
    const base=Array.from({length:40},(_,i)=>({id:'T'+i}));
    c.capture('tasks',base,[]);
    assert.equal(c.marked.length,0);
    c.capture('tasks',base,base.slice(0,38));
    assert.deepEqual(c.marked,['T38','T39'],'einzelne Löschungen bleiben Löschungen');
  });

  test(`${file}: Massenlöschung schaltet den Wochenplan (Picks) nicht ab, bewusste Löschung schon`,()=>{
    const t0=Date.parse('2026-11-06T13:20:59.990Z');
    const wiped=pickIds.map((m,i)=>({collection:'tasks',id:`M848:${m}:2026-W45`,deletedAt:new Date(t0+i*3).toISOString(),deletedBy:'Tobias'}));
    // auch die ':neu'-Kopie wurde schon gelöscht
    wiped.push({collection:'tasks',id:'M848:mo-p-uk:2026-W45:neu',deletedAt:new Date(t0+40).toISOString(),deletedBy:'Tobias'});
    const state={tasks:[],_teamSyncMeta:{fields:{},tombstones:wiped.concat([
      {collection:'tasks',id:'M848:mo-p-china-air:2026-W40',deletedAt:'2026-10-01T08:00:00Z',deletedBy:'Tobias'}
    ])}};
    const api=loadMaster(file,state);
    api.ensureWeek('2026-11-05',false);
    const ids=state.tasks.map(t=>t.id);
    assert.ok(ids.includes('M848:mo-p-uk:2026-W45:neu2'),'neue, noch nicht gelöschte ID');
    assert.ok(ids.includes('M848:di-p-uk:2026-W45:neu'));
    assert.ok(!ids.some(id=>/mo-p-china-air/.test(id)),'früher einzeln gelöschte Serie bleibt gelöscht');
    assert.ok(state.tasks.filter(t=>t.area==='Picken').length>30);
  });
}
