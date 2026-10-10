import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');

function makeHarness(){
  let clears=0;
  const attrs=new Map();
  const row={
    children:[],
    getAttribute(name){return attrs.get(name)||null;},
    setAttribute(name,value){attrs.set(name,String(value));},
    appendChild(node){this.children.push(node);return node;},
    get textContent(){return this.children.map(child=>child.textContent||'').join(' ');},
    set textContent(value){clears++;this.children=[];}
  };
  const button={setAttribute(){},addEventListener(){},textContent:'',className:''};
  const card={
    dataset:{taskId:'TASK-1',rc1152TaskOpen:'1'},
    querySelector(selector){
      if(selector==='.rc1014-task-meta')return row;
      if(selector==='[data-rc1014-open-task]')return button;
      return null;
    },
    appendChild(){},
    addEventListener(){}
  };
  const doc={
    querySelectorAll(selector){return selector.includes('task-card')?[card]:[];},
    createElement(tag){
      return {tagName:String(tag).toUpperCase(),className:'',textContent:'',setAttribute(){},addEventListener(){},appendChild(){}};
    },
    getElementById(){return null;}
  };
  const root={
    document:doc,
    ExportHUBRC1014Tasks:{
      normalizeTask(task){return {...task};},
      dueBucket(){return 'today';},
      reconcile(tasks){return {tasks,changed:false};}
    },
    ExportHUBI18n:{
      t(key,vars){
        if(key==='taskDetail.priority')return `Priorität: ${vars.priority}`;
        if(key==='taskDetail.dueLabel')return `Fällig: ${vars.due}`;
        if(key==='taskDetail.ownerLabel')return `Verantwortlich: ${vars.owner}`;
        if(key==='taskDetail.due.today')return 'Heute';
        return key;
      },
      language(){return 'de';}
    },
    addEventListener(){},
    setTimeout(){return 1;},
    clearTimeout(){},
    location:{hostname:'prod.test',pathname:'/'},
    console
  };
  vm.runInNewContext(runtime,{globalThis:root,console,Date,Intl,URL,setTimeout:root.setTimeout,clearTimeout:root.clearTimeout});
  return {api:root.ExportHUBRC1014TaskRuntime,card,row,getClears:()=>clears};
}

test('RC1477: unveränderte Aufgaben-Metadaten werden beim zweiten Enhance nicht erneut geleert/aufgebaut',()=>{
  const h=makeHarness();
  const task={id:'TASK-1',priority:'P2',dueAt:'2026-10-10',effectiveAssignee:'Tobias',status:'open'};
  assert.equal(h.api.enhanceTaskCards([task],{}),1);
  const afterFirst=h.getClears();
  assert.equal(afterFirst,1,'erster Enhance baut die Metadaten genau einmal auf');
  assert.equal(h.api.enhanceTaskCards([task],{}),1);
  assert.equal(h.getClears(),afterFirst,'zweiter identischer Enhance darf keinen DOM-Rebuild auslösen');
});
