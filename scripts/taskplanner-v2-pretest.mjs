import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CORE_TAG='<script id="exporthub-taskplanner-v2-core" defer src="/assets/taskplanner-v2-core.js?v=2000"></script>';
const RECURRENCE_TAG='<script id="exporthub-taskplanner-v2-recurrence" defer src="/assets/taskplanner-v2-recurrence.js?v=2000"></script>';
const PLANNER_TAG='<script id="exporthub-taskplanner-v2-planner" defer src="/assets/taskplanner-v2-planner.js?v=2000"></script>';
const RUNTIME_BRIDGE_TAG='<script id="exporthub-taskplanner-v2-runtime-bridge" defer src="/assets/taskplanner-v2-runtime-bridge.js?v=2000"></script>';

export function patchBuilderSource(source){
  let out=String(source||'');
  const runtimeAnchor="html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1266|1312|1353|1359)/g,'assets/rc1014-task-runtime.js?v=1359');";
  const sampleAnchor="html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1359)/g,'assets/rc1014-task-runtime.js?v=1359');";
  const anchor=out.includes(runtimeAnchor)?runtimeAnchor:(out.includes(sampleAnchor)?sampleAnchor:'');
  if(!anchor)throw new Error('TaskPlanner V2: Runtime-Cache-Anker im RC1112 Builder fehlt');

  const desiredLifecycleInjection=`html=html.replace(taskLifecycleMatch[0],'${CORE_TAG}\\n${RECURRENCE_TAG}\\n${PLANNER_TAG}\\n'+taskLifecycleMatch[0]);`;
  if(!out.includes('exporthub-taskplanner-v2-core')){
    const wiring=`${anchor}\n  const taskLifecycleTag=/<script\\b[^>]*src=[\"']\\/assets\\/rc1014-task-lifecycle\\.js\\?v=[^\"']+[\"'][^>]*><\\/script>/i;\n  if(!html.includes('id=\"exporthub-taskplanner-v2-core\"')){\n    const taskLifecycleMatch=html.match(taskLifecycleTag);\n    if(!taskLifecycleMatch)throw new Error(file+': TaskPlanner V2 Lifecycle-Anker fehlt');\n    ${desiredLifecycleInjection}\n  }`;
    out=out.replace(anchor,wiring);
  }else if(!out.includes('exporthub-taskplanner-v2-planner')){
    const candidates=[
      `html=html.replace(taskLifecycleMatch[0],'${CORE_TAG}\\n${RECURRENCE_TAG}\\n'+taskLifecycleMatch[0]);`,
      `html=html.replace(taskLifecycleMatch[0],'${CORE_TAG}\\n'+taskLifecycleMatch[0]);`
    ];
    const current=candidates.find(x=>out.includes(x));
    if(!current)throw new Error('TaskPlanner V2: vorhandenes Lifecycle-Wiring konnte nicht um Planner ergänzt werden');
    out=out.replace(current,desiredLifecycleInjection);
  }

  if(!out.includes('exporthub-taskplanner-v2-runtime-bridge')){
    const bridgeWiring=`${anchor}\n  const taskRuntimeTag=/<script\\b[^>]*src=[\"']\\/assets\\/rc1014-task-runtime\\.js\\?v=[^\"']+[\"'][^>]*><\\/script>/i;\n  if(!html.includes('id=\"exporthub-taskplanner-v2-runtime-bridge\"')){\n    const taskRuntimeMatch=html.match(taskRuntimeTag);\n    if(!taskRuntimeMatch)throw new Error(file+': TaskPlanner V2 Runtime-Anker fehlt');\n    html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\\n${RUNTIME_BRIDGE_TAG}');\n  }`;
    out=out.replace(anchor,bridgeWiring);
  }

  const validation="if(!html.includes('assets/rc1014-task-runtime.js?v=1359'))throw new Error(file+': RC1359 Aufgaben-Runtime Cache-Key fehlt');";
  if(out.includes(validation)&&!out.includes("TaskPlanner V2 Core fehlt")){
    out=out.replace(validation,validation+"\n  if(!html.includes('assets/taskplanner-v2-core.js?v=2000'))throw new Error(file+': TaskPlanner V2 Core fehlt');\n  if(!html.includes('assets/taskplanner-v2-recurrence.js?v=2000'))throw new Error(file+': TaskPlanner V2 Recurrence fehlt');\n  if(!html.includes('assets/taskplanner-v2-planner.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner fehlt');\n  if(!html.includes('assets/taskplanner-v2-runtime-bridge.js?v=2000'))throw new Error(file+': TaskPlanner V2 Runtime Bridge fehlt');");
  }else{
    const recValidation="if(!html.includes('assets/taskplanner-v2-recurrence.js?v=2000'))throw new Error(file+': TaskPlanner V2 Recurrence fehlt');";
    if(out.includes(recValidation)&&!out.includes("TaskPlanner V2 Planner fehlt"))out=out.replace(recValidation,recValidation+"\n  if(!html.includes('assets/taskplanner-v2-planner.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner fehlt');\n  if(!html.includes('assets/taskplanner-v2-runtime-bridge.js?v=2000'))throw new Error(file+': TaskPlanner V2 Runtime Bridge fehlt');");
  }

  const copyAnchor="  'assets/rc1014-task-runtime.js',";
  if(!out.includes(copyAnchor))throw new Error('TaskPlanner V2: Asset-Copy-Anker fehlt');
  if(!out.includes("'assets/taskplanner-v2-core.js'"))out=out.replace(copyAnchor,copyAnchor+"\n  'assets/taskplanner-v2-core.js',");
  const coreCopy="  'assets/taskplanner-v2-core.js',";
  if(!out.includes("'assets/taskplanner-v2-recurrence.js'"))out=out.replace(coreCopy,coreCopy+"\n  'assets/taskplanner-v2-recurrence.js',");
  const recurrenceCopy="  'assets/taskplanner-v2-recurrence.js',";
  if(!out.includes("'assets/taskplanner-v2-planner.js'"))out=out.replace(recurrenceCopy,recurrenceCopy+"\n  'assets/taskplanner-v2-planner.js',");
  const plannerCopy="  'assets/taskplanner-v2-planner.js',";
  if(!out.includes("'assets/taskplanner-v2-runtime-bridge.js'"))out=out.replace(plannerCopy,plannerCopy+"\n  'assets/taskplanner-v2-runtime-bridge.js',");
  return out;
}

export function patchRepository(root=process.cwd()){
  const builder=path.join(root,'.github/rc1112/build-three-env.mjs');
  if(!fs.existsSync(builder))throw new Error('TaskPlanner V2: RC1112 Builder fehlt');
  const before=fs.readFileSync(builder,'utf8');
  const after=patchBuilderSource(before);
  if(after!==before)fs.writeFileSync(builder,after);
  return {changed:after!==before,builder};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=patchRepository();
  console.log(`TaskPlanner V2 builder wiring ${result.changed?'applied':'already present'}`);
}
