import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');

function harness(){
  let writes=0,html='';
  const section={id:'rc1307ManagedTaskPlan',parentNode:{removeChild(){}},get innerHTML(){return html;},set innerHTML(value){writes++;html=String(value);}};
  const body={getAttribute(name){return name==='data-exporthub-view'?'tasks':'';}};
  const host={querySelector(){return null;},prepend(){},insertBefore(){}};
  const doc={
    body,
    getElementById(id){if(id==='rc1307ManagedTaskPlan')return section;if(id==='content')return host;return null;},
    querySelector(){return null;},
    querySelectorAll(){return[];},
    createElement(){return{};},
    addEventListener(){}
  };
  const root={document:doc,location:{hostname:'prod.test',pathname:'/'},addEventListener(){},setTimeout(){return 1;},clearTimeout(){},console,
    ExportHUBI18n:{t(key,vars){if(key==='taskPlan.count')return String(vars?.count??0);return key;},language(){return'de';}},
    ExportHUBRC1014Tasks:{normalizeTask(t){return{...t};},dueBucket(){return'today';},reconcile(tasks){return{tasks,changed:false};}}
  };
  vm.runInNewContext(runtime,{globalThis:root,console,Date,Intl,URL,setTimeout:root.setTimeout,clearTimeout:root.clearTimeout});
  return {api:root.ExportHUBRC1014TaskRuntime,getWrites:()=>writes};
}

test('RC1477: identischer Aufgabenplan schreibt section.innerHTML nur einmal',()=>{
  const h=harness();
  const ctx={currentUserId:'USER-Tobias',state:{currentUserId:'USER-Tobias'},now:new Date('2026-10-10T10:00:00Z')};
  assert.equal(h.api.renderManagedTaskPlan(ctx),true);
  assert.equal(h.getWrites(),1);
  assert.equal(h.api.renderManagedTaskPlan(ctx),true);
  assert.equal(h.getWrites(),1,'zweiter identischer Plan darf keinen DOM-Rebuild auslösen');
});
