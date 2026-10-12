import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function patchBuilderSource(source){
  let out=String(source||'');
  if(out.includes('exporthub-taskplanner-v2-core')&&out.includes("'assets/taskplanner-v2-core.js'"))return out;

  const runtimeAnchor="html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1266|1312|1353|1359)/g,'assets/rc1014-task-runtime.js?v=1359');";
  const sampleAnchor="html=html.replace(/assets\\/rc1014-task-runtime\\.js\\?v=(?:1016|1359)/g,'assets/rc1014-task-runtime.js?v=1359');";
  const anchor=out.includes(runtimeAnchor)?runtimeAnchor:(out.includes(sampleAnchor)?sampleAnchor:'');
  if(!anchor)throw new Error('TaskPlanner V2: Runtime-Cache-Anker im RC1112 Builder fehlt');
  const wiring=`${anchor}\n  const taskLifecycleTag=/<script\\b[^>]*src=[\"']\\/assets\\/rc1014-task-lifecycle\\.js\\?v=[^\"']+[\"'][^>]*><\\/script>/i;\n  if(!html.includes('id=\"exporthub-taskplanner-v2-core\"')){\n    const taskLifecycleMatch=html.match(taskLifecycleTag);\n    if(!taskLifecycleMatch)throw new Error(file+': TaskPlanner V2 Lifecycle-Anker fehlt');\n    html=html.replace(taskLifecycleMatch[0],'<script id=\"exporthub-taskplanner-v2-core\" defer src=\"/assets/taskplanner-v2-core.js?v=2000\"></script>\\n'+taskLifecycleMatch[0]);\n  }`;
  out=out.replace(anchor,wiring);

  const validation="if(!html.includes('assets/rc1014-task-runtime.js?v=1359'))throw new Error(file+': RC1359 Aufgaben-Runtime Cache-Key fehlt');";
  if(out.includes(validation))out=out.replace(validation,validation+"\n  if(!html.includes('assets/taskplanner-v2-core.js?v=2000'))throw new Error(file+': TaskPlanner V2 Core fehlt');");

  const copyAnchor="  'assets/rc1014-task-runtime.js',";
  if(!out.includes(copyAnchor))throw new Error('TaskPlanner V2: Asset-Copy-Anker fehlt');
  out=out.replace(copyAnchor,copyAnchor+"\n  'assets/taskplanner-v2-core.js',");
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
