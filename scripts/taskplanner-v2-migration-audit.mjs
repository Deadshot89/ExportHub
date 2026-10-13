import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const CORE_FILE=path.join(ROOT,'assets/taskplanner-v2-core.js');

let cachedCore=null;

function loadCore(){
  if(cachedCore)return cachedCore;
  const source=fs.readFileSync(CORE_FILE,'utf8');
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:CORE_FILE});
  if(!context.ExportHUBTaskCoreV2||typeof context.ExportHUBTaskCoreV2.migrateState!=='function')throw new Error('TaskPlanner V2 Core migration API fehlt');
  cachedCore=context.ExportHUBTaskCoreV2;
  return cachedCore;
}

function arr(value){return Array.isArray(value)?value:[];}
function nativeArray(value){return Array.from(arr(value),item=>JSON.parse(JSON.stringify(item)));}

function summarizeState(state,core,ctx){
  const tasks=arr(state&&state.tasks);
  let active=0,done=0,customerLinks=0,shipmentLinks=0;
  for(const raw of tasks){
    const task=core.normalizeTask(raw||{},ctx);
    if(task.status==='done')done++;
    else if(task.status!=='cancelled')active++;
    if(String(task.customerId||'').trim())customerLinks++;
    if(String(task.shipmentId||task.shipmentRef||'').trim())shipmentLinks++;
  }
  return {
    tasks:tasks.length,
    active,
    done,
    series:arr(state&&state.taskSeries).length,
    customerLinks,
    shipmentLinks
  };
}

export function auditState(input,ctx={}){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const core=loadCore();
  const before=summarizeState(source,core,ctx);
  const migration=core.migrateState(source,ctx);
  const report=migration&&migration.report||{};
  const after=summarizeState(migration&&migration.state||{},core,ctx);
  const collisions=nativeArray(report.collisions);
  const unresolvedRelationships=nativeArray(report.unresolvedRelationships);
  return {
    before,
    after,
    collisions,
    unresolvedRelationships,
    safe:report.safe===true&&collisions.length===0&&unresolvedRelationships.length===0
  };
}

function parseCli(argv){
  const args=argv.slice(2),file=args[0]||'';
  let now='';
  for(let i=1;i<args.length;i++)if(args[i]==='--now'&&args[i+1]){now=args[++i];}
  return {file,now};
}

export function runCli(argv=process.argv){
  const {file,now}=parseCli(argv);
  if(!file)throw new Error('Verwendung: node scripts/taskplanner-v2-migration-audit.mjs <state.json> [--now <ISO>]');
  const absolute=path.resolve(process.cwd(),file);
  const state=JSON.parse(fs.readFileSync(absolute,'utf8'));
  const report=auditState(state,now?{now}:{});
  process.stdout.write(JSON.stringify(report)+'\n');
  return report.safe?0:1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    process.exitCode=runCli(process.argv);
  }catch(error){
    process.stderr.write(String(error&&error.message||error)+'\n');
    process.exitCode=2;
  }
}
