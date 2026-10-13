import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const RENDER_NEEDLE="function render(){if(rendering||view()!=='planning')return false;";
const CUTOVER_BLOCK=`if(window.__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__!==false&&window.ExportHUBTaskUIV2&&typeof window.ExportHUBTaskUIV2.renderPlannerPage==='function'){var __tpv2root=root();if(!__tpv2root)return false;window.__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__=true;return window.ExportHUBTaskUIV2.renderPlannerPage(__tpv2root,{state:st(),weekStart:selectedWeek(),runtime:window.ExportHUBRC1014TaskRuntime});}`;
const BUILDER_FUNCTION=`function patchTaskPlannerV2UiCutover(html,file){\n  const marker='__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__';\n  if(html.includes(marker))return html;\n  const needle=${JSON.stringify(RENDER_NEEDLE)};\n  const at=html.indexOf(needle);\n  if(at<0)return html;\n  html=html.slice(0,at)+needle+${JSON.stringify(CUTOVER_BLOCK)}+html.slice(at+needle.length);\n  if(!html.includes(marker)||!html.includes('return window.ExportHUBTaskUIV2.renderPlannerPage'))throw new Error(file+': TaskPlanner V2 Planner-Cutover unvollständig');\n  return html;\n}\n\n`;

export function patchPlannerHtmlSource(source){
  const html=String(source||'');
  if(html.includes('__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__'))return html;
  const at=html.indexOf(RENDER_NEEDLE);
  if(at<0)throw new Error('TaskPlanner V2: autoritärer Planner-render-Einstieg fehlt');
  const out=html.slice(0,at)+RENDER_NEEDLE+CUTOVER_BLOCK+html.slice(at+RENDER_NEEDLE.length);
  if(!out.includes('__EXPORTHUB_TASKPLANNER_V2_UI_CUTOVER__')||!out.includes('return window.ExportHUBTaskUIV2.renderPlannerPage'))throw new Error('TaskPlanner V2: Planner-Cutover konnte nicht verifiziert werden');
  return out;
}

export function patchBuilderSource(source){
  let out=String(source||'');
  if(!out.includes('function patchTaskPlannerV2UiCutover(')){
    const anchor='function patchRc1296BrowserBranding(html,file){';
    if(!out.includes(anchor))throw new Error('TaskPlanner V2: Builder-Funktionsanker fehlt');
    out=out.replace(anchor,BUILDER_FUNCTION+anchor);
  }
  if(!out.includes('html=patchTaskPlannerV2UiCutover(html,file);')){
    const write='  fs.writeFileSync(target,html);';
    if(!out.includes(write))throw new Error('TaskPlanner V2: Builder-Write-Anker fehlt');
    out=out.replace(write,"  html=patchTaskPlannerV2UiCutover(html,file);\n"+write);
  }
  return out;
}

export function patchRepository(root=process.cwd()){
  const builder=path.join(root,'.github/rc1112/build-three-env.mjs');
  if(!fs.existsSync(builder))throw new Error('TaskPlanner V2: RC1112 Builder fehlt');
  const beforeBuilder=fs.readFileSync(builder,'utf8'),afterBuilder=patchBuilderSource(beforeBuilder);
  if(afterBuilder!==beforeBuilder)fs.writeFileSync(builder,afterBuilder);

  const testVersion=path.join(root,'TESTVERSION.html');
  let htmlChanged=false;
  if(fs.existsSync(testVersion)){
    const before=fs.readFileSync(testVersion,'utf8'),after=patchPlannerHtmlSource(before);
    htmlChanged=after!==before;if(htmlChanged)fs.writeFileSync(testVersion,after);
  }
  return{builderChanged:afterBuilder!==beforeBuilder,htmlChanged,builder,testVersion};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=patchRepository();
  console.log(`TaskPlanner V2 planner cutover builder=${result.builderChanged?'patched':'ready'} testservice=${result.htmlChanged?'patched':'ready'}`);
}
