import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STYLE_TAG='<link id="exporthub-taskplanner-v2-style" rel="stylesheet" href="/assets/taskplanner-v2.css?v=2000">';
const PROJECTION_STYLE_TAG='<link id="exporthub-taskplanner-v2-projection-style" rel="stylesheet" href="/assets/taskplanner-v2-projections.css?v=2000">';
const CORE_TAG='<script id="exporthub-taskplanner-v2-core" defer src="/assets/taskplanner-v2-core.js?v=2000"></script>';
const RECURRENCE_TAG='<script id="exporthub-taskplanner-v2-recurrence" defer src="/assets/taskplanner-v2-recurrence.js?v=2000"></script>';
const PLANNER_TAG='<script id="exporthub-taskplanner-v2-planner" defer src="/assets/taskplanner-v2-planner.js?v=2000"></script>';
const PROJECTIONS_TAG='<script id="exporthub-taskplanner-v2-projections" defer src="/assets/taskplanner-v2-projections.js?v=2000"></script>';
const RUNTIME_BRIDGE_TAG='<script id="exporthub-taskplanner-v2-runtime-bridge" defer src="/assets/taskplanner-v2-runtime-bridge.js?v=2000"></script>';
const WORKFLOW_TAG='<script id="exporthub-taskplanner-v2-workflow" defer src="/assets/taskplanner-v2-workflow.js?v=2000"></script>';
const UI_TAG='<script id="exporthub-taskplanner-v2-ui" defer src="/assets/taskplanner-v2-ui.js?v=2000"></script>';
const PROJECTION_UI_TAG='<script id="exporthub-taskplanner-v2-projection-ui" defer src="/assets/taskplanner-v2-projection-ui.js?v=2000"></script>';
const PLANNER_UI_TAG='<script id="exporthub-taskplanner-v2-planner-ui" defer src="/assets/taskplanner-v2-planner-ui.js?v=2000"></script>';
const RC1537_TAG='<script id="exporthub-taskplanner-rc1537-canonical-source" defer src="/assets/rc1537-taskplanner-canonical-source.js?v=1537"></script>';

export function patchBuilderSource(source){
  let out=String(source||'');
  const runtimeAnchor="html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1266|1312|1353|1359)/g,'assets/rc1014-task-runtime.js?v=1359');";
  const sampleAnchor="html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1359)/g,'assets/rc1014-task-runtime.js?v=1359');";
  const anchor=out.includes(runtimeAnchor)?runtimeAnchor:(out.includes(sampleAnchor)?sampleAnchor:'');
  if(!anchor)throw new Error('TaskPlanner V2: Runtime-Cache-Anker im RC1112 Builder fehlt');

  const desiredLifecycleInjection=`html=html.replace(taskLifecycleMatch[0],'${STYLE_TAG}\\n${PROJECTION_STYLE_TAG}\\n${CORE_TAG}\\n${RECURRENCE_TAG}\\n${PLANNER_TAG}\\n${PROJECTIONS_TAG}\\n'+taskLifecycleMatch[0]);`;
  if(!out.includes('exporthub-taskplanner-v2-core')){
    const wiring=`${anchor}\n  const taskLifecycleTag=/<script\\b[^>]*src=[\"']\\/assets\\/rc1014-task-lifecycle\\.js\\?v=[^\"']+[\"'][^>]*><\\/script>/i;\n  if(!html.includes('id=\"exporthub-taskplanner-v2-core\"')){\n    const taskLifecycleMatch=html.match(taskLifecycleTag);\n    if(!taskLifecycleMatch)throw new Error(file+': TaskPlanner V2 Lifecycle-Anker fehlt');\n    ${desiredLifecycleInjection}\n  }`;
    out=out.replace(anchor,wiring);
  }else{
    const candidates=[
      `html=html.replace(taskLifecycleMatch[0],'${STYLE_TAG}\\n${CORE_TAG}\\n${RECURRENCE_TAG}\\n${PLANNER_TAG}\\n${PROJECTIONS_TAG}\\n'+taskLifecycleMatch[0]);`,
      `html=html.replace(taskLifecycleMatch[0],'${STYLE_TAG}\\n${CORE_TAG}\\n${RECURRENCE_TAG}\\n${PLANNER_TAG}\\n'+taskLifecycleMatch[0]);`,
      `html=html.replace(taskLifecycleMatch[0],'${CORE_TAG}\\n${RECURRENCE_TAG}\\n${PLANNER_TAG}\\n'+taskLifecycleMatch[0]);`,
      `html=html.replace(taskLifecycleMatch[0],'${CORE_TAG}\\n${RECURRENCE_TAG}\\n'+taskLifecycleMatch[0]);`,
      `html=html.replace(taskLifecycleMatch[0],'${CORE_TAG}\\n'+taskLifecycleMatch[0]);`
    ];
    if(!out.includes('exporthub-taskplanner-v2-projections')||!out.includes('exporthub-taskplanner-v2-projection-style')){
      const current=candidates.find(x=>out.includes(x));
      if(!current)throw new Error('TaskPlanner V2: vorhandenes Lifecycle-Wiring konnte nicht um Projections ergänzt werden');
      out=out.replace(current,desiredLifecycleInjection);
    }else if(!out.includes('exporthub-taskplanner-v2-style')){
      const current=candidates.find(x=>out.includes(x));
      if(current)out=out.replace(current,desiredLifecycleInjection);
      else throw new Error('TaskPlanner V2: vorhandenes Lifecycle-Wiring konnte nicht um Styles ergänzt werden');
    }
  }

  const desiredRuntimeInjection=`html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\\n${RUNTIME_BRIDGE_TAG}\\n${WORKFLOW_TAG}\\n${UI_TAG}\\n${PROJECTION_UI_TAG}\\n${PLANNER_UI_TAG}\\n${RC1537_TAG}');`;
  if(!out.includes('exporthub-taskplanner-v2-runtime-bridge')){
    const bridgeWiring=`${anchor}\n  const taskRuntimeTag=/<script\\b[^>]*src=[\"']\\/assets\\/rc1014-task-runtime\\.js\\?v=[^\"']+[\"'][^>]*><\\/script>/i;\n  if(!html.includes('id=\"exporthub-taskplanner-v2-runtime-bridge\"')){\n    const taskRuntimeMatch=html.match(taskRuntimeTag);\n    if(!taskRuntimeMatch)throw new Error(file+': TaskPlanner V2 Runtime-Anker fehlt');\n    ${desiredRuntimeInjection}\n  }`;
    out=out.replace(anchor,bridgeWiring);
  }else if(!out.includes('exporthub-taskplanner-v2-workflow')||!out.includes('exporthub-taskplanner-v2-planner-ui')||!out.includes('exporthub-taskplanner-v2-projection-ui')||!out.includes('exporthub-taskplanner-rc1537-canonical-source')){
    const candidates=[
      `html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\\n${RUNTIME_BRIDGE_TAG}\\n${WORKFLOW_TAG}\\n${UI_TAG}\\n${PROJECTION_UI_TAG}\\n${PLANNER_UI_TAG}');`,
      `html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\\n${RUNTIME_BRIDGE_TAG}\\n${WORKFLOW_TAG}\\n${UI_TAG}\\n${PLANNER_UI_TAG}');`,
      `html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\\n${RUNTIME_BRIDGE_TAG}\\n${UI_TAG}\\n${PLANNER_UI_TAG}');`,
      `html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\\n${RUNTIME_BRIDGE_TAG}\\n${UI_TAG}');`,
      `html=html.replace(taskRuntimeMatch[0],taskRuntimeMatch[0]+'\\n${RUNTIME_BRIDGE_TAG}');`
    ];
    const old=candidates.find(x=>out.includes(x));
    if(!old)throw new Error('TaskPlanner V2: vorhandenes Runtime-Wiring konnte nicht um Workflow/Projection-UI/RC1537 ergänzt werden');
    out=out.replace(old,desiredRuntimeInjection);
  }

  const validation="if(!html.includes('assets/rc1014-task-runtime.js?v=1359'))throw new Error(file+': RC1359 Aufgaben-Runtime Cache-Key fehlt');";
  if(out.includes(validation)&&!out.includes("TaskPlanner V2 Core fehlt")){
    out=out.replace(validation,validation+"\n  if(!html.includes('assets/taskplanner-v2.css?v=2000'))throw new Error(file+': TaskPlanner V2 Styles fehlen');\n  if(!html.includes('assets/taskplanner-v2-projections.css?v=2000'))throw new Error(file+': TaskPlanner V2 Projection Styles fehlen');\n  if(!html.includes('assets/taskplanner-v2-core.js?v=2000'))throw new Error(file+': TaskPlanner V2 Core fehlt');\n  if(!html.includes('assets/taskplanner-v2-recurrence.js?v=2000'))throw new Error(file+': TaskPlanner V2 Recurrence fehlt');\n  if(!html.includes('assets/taskplanner-v2-planner.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner fehlt');\n  if(!html.includes('assets/taskplanner-v2-projections.js?v=2000'))throw new Error(file+': TaskPlanner V2 Projections fehlen');\n  if(!html.includes('assets/taskplanner-v2-runtime-bridge.js?v=2000'))throw new Error(file+': TaskPlanner V2 Runtime Bridge fehlt');\n  if(!html.includes('assets/taskplanner-v2-workflow.js?v=2000'))throw new Error(file+': TaskPlanner V2 Workflow fehlt');\n  if(!html.includes('assets/taskplanner-v2-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 UI fehlt');\n  if(!html.includes('assets/taskplanner-v2-projection-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 Projection UI fehlt');\n  if(!html.includes('assets/taskplanner-v2-planner-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner UI fehlt');\n  if(!html.includes('assets/rc1537-taskplanner-canonical-source.js?v=1537'))throw new Error(file+': RC1537 Canonical Source fehlt');");
  }else{
    const plannerValidation="if(!html.includes('assets/taskplanner-v2-planner.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner fehlt');";
    if(out.includes(plannerValidation)&&!out.includes("TaskPlanner V2 Projections fehlen"))out=out.replace(plannerValidation,plannerValidation+"\n  if(!html.includes('assets/taskplanner-v2-projections.js?v=2000'))throw new Error(file+': TaskPlanner V2 Projections fehlen');");
    const uiValidation="if(!html.includes('assets/taskplanner-v2-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 UI fehlt');";
    if(out.includes(uiValidation)&&!out.includes("TaskPlanner V2 Projection UI fehlt"))out=out.replace(uiValidation,uiValidation+"\n  if(!html.includes('assets/taskplanner-v2-projection-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 Projection UI fehlt');");
    const plannerUiValidation="if(!html.includes('assets/taskplanner-v2-planner-ui.js?v=2000'))throw new Error(file+': TaskPlanner V2 Planner UI fehlt');";
    if(out.includes(plannerUiValidation)&&!out.includes("RC1537 Canonical Source fehlt"))out=out.replace(plannerUiValidation,plannerUiValidation+"\n  if(!html.includes('assets/rc1537-taskplanner-canonical-source.js?v=1537'))throw new Error(file+': RC1537 Canonical Source fehlt');");
  }

  const copyAnchor="  'assets/rc1014-task-runtime.js',";
  if(!out.includes(copyAnchor))throw new Error('TaskPlanner V2: Asset-Copy-Anker fehlt');
  if(!out.includes("'assets/taskplanner-v2-core.js'"))out=out.replace(copyAnchor,copyAnchor+"\n  'assets/taskplanner-v2-core.js',");
  const coreCopy="  'assets/taskplanner-v2-core.js',";
  if(!out.includes("'assets/taskplanner-v2-recurrence.js'"))out=out.replace(coreCopy,coreCopy+"\n  'assets/taskplanner-v2-recurrence.js',");
  const recurrenceCopy="  'assets/taskplanner-v2-recurrence.js',";
  if(!out.includes("'assets/taskplanner-v2-planner.js'"))out=out.replace(recurrenceCopy,recurrenceCopy+"\n  'assets/taskplanner-v2-planner.js',");
  const plannerCopy="  'assets/taskplanner-v2-planner.js',";
  if(!out.includes("'assets/taskplanner-v2-projections.js'"))out=out.replace(plannerCopy,plannerCopy+"\n  'assets/taskplanner-v2-projections.js',");
  const projectionsCopy="  'assets/taskplanner-v2-projections.js',";
  if(!out.includes("'assets/taskplanner-v2-runtime-bridge.js'"))out=out.replace(projectionsCopy,projectionsCopy+"\n  'assets/taskplanner-v2-runtime-bridge.js',");
  const bridgeCopy="  'assets/taskplanner-v2-runtime-bridge.js',";
  if(!out.includes("'assets/taskplanner-v2-workflow.js'"))out=out.replace(bridgeCopy,bridgeCopy+"\n  'assets/taskplanner-v2-workflow.js',");
  const workflowCopy="  'assets/taskplanner-v2-workflow.js',";
  if(!out.includes("'assets/taskplanner-v2-ui.js'"))out=out.replace(workflowCopy,workflowCopy+"\n  'assets/taskplanner-v2-ui.js',\n  'assets/taskplanner-v2.css',");
  const uiCopy="  'assets/taskplanner-v2-ui.js',";
  if(!out.includes("'assets/taskplanner-v2-projection-ui.js'"))out=out.replace(uiCopy,uiCopy+"\n  'assets/taskplanner-v2-projection-ui.js',\n  'assets/taskplanner-v2-projections.css',");
  const projectionUiCopy="  'assets/taskplanner-v2-projection-ui.js',";
  if(!out.includes("'assets/taskplanner-v2-planner-ui.js'"))out=out.replace(projectionUiCopy,projectionUiCopy+"\n  'assets/taskplanner-v2-planner-ui.js',");
  const plannerUiCopy="  'assets/taskplanner-v2-planner-ui.js',";
  if(!out.includes("'assets/rc1537-taskplanner-canonical-source.js'"))out=out.replace(plannerUiCopy,plannerUiCopy+"\n  'assets/rc1537-taskplanner-canonical-source.js',");
  const rc1537Copy="  'assets/rc1537-taskplanner-canonical-source.js',";
  if(!out.includes("'assets/task-public-read.js'"))out=out.replace(rc1537Copy,rc1537Copy+"\n  'assets/task-public-read.js',");

  const publicPageAnchor="fs.copyFileSync(rc1114PickupSource,path.join(OUT,'pickup.html'));";
  if(out.includes(publicPageAnchor)&&!out.includes("const taskPublicPageSource=path.join(ROOT,'task.html');")){
    out=out.replace(publicPageAnchor,publicPageAnchor+"\nconst taskPublicPageSource=path.join(ROOT,'task.html');\nif(!fs.existsSync(taskPublicPageSource))throw new Error('TaskPlanner V2 task.html fehlt');\nfs.copyFileSync(taskPublicPageSource,path.join(OUT,'task.html'));\nif(!fs.existsSync(path.join(OUT,'task.html')))throw new Error('TaskPlanner V2 task.html wurde nicht gebaut');");
  }
  return out;
}

export function patchRepository(root=process.cwd()){
  const builder=path.join(root,'.github/rc1112/build-three-env.mjs');
  if(!fs.existsSync(builder))throw new Error('TaskPlanner V2: RC1112 Builder fehlt');
  for(const required of ['task.html','assets/task-public-read.js','assets/taskplanner-v2-projections.js','assets/taskplanner-v2-projection-ui.js','assets/taskplanner-v2-projections.css','assets/rc1537-taskplanner-canonical-source.js'])if(!fs.existsSync(path.join(root,required)))throw new Error('TaskPlanner V2: erforderliche Datei fehlt '+required);
  const before=fs.readFileSync(builder,'utf8');
  const after=patchBuilderSource(before);
  if(after!==before)fs.writeFileSync(builder,after);
  return {changed:after!==before,builder};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=patchRepository();
  console.log(`TaskPlanner V2 builder wiring ${result.changed?'applied':'already present'}`);
}
