import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const files=['TESTVERSION.html','index.html'];
const historicalSha='9e0817070134434ef997a0f0d04b04f5de3eb3cb';
const helperNames=[
  'taskManualDistinctRC874',
  'taskDisplayKeyRC874',
  'taskDedupeScoreRC874',
  'dedupeVisibleTasksRC874',
  'taskGroupStateRC874'
];

function historicalHelpers(file){
  const old=execFileSync('git',['show',`${historicalSha}:${file}`],{encoding:'utf8',maxBuffer:32*1024*1024});
  const groupStart=old.indexOf('function taskGroupNameRC874(t){');
  const helperStart=old.indexOf('function taskManualDistinctRC874',groupStart);
  const groupOpen=old.indexOf('function taskGroupOpenRC874',helperStart);
  if(groupStart<0||helperStart<0||groupOpen<=helperStart)throw new Error(`${file}: historischer RC874-Helferblock nicht gefunden`);
  const helpers=old.slice(helperStart,groupOpen);
  for(const name of helperNames){
    if(!helpers.includes(`function ${name}`))throw new Error(`${file}: historischer Helfer ${name} fehlt`);
  }
  if(!helpers.includes('const TASK_GROUP_STORE_RC874='))throw new Error(`${file}: historischer Gruppenstatus-Schluessel fehlt`);
  return helpers;
}

for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  const currentGroup=html.indexOf('function taskGroupNameRC874(t){');
  const currentOpen=html.indexOf('function taskGroupOpenRC874',currentGroup);
  if(currentGroup<0||currentOpen<=currentGroup)throw new Error(`${file}: aktueller RC874-Gruppenblock nicht gefunden`);

  const missing=helperNames.filter(name=>!html.includes(`function ${name}`));
  const missingStore=!html.includes('const TASK_GROUP_STORE_RC874=');
  if(!missing.length&&!missingStore){
    console.log(`${file}: RC874-Helfer bereits vorhanden`);
    continue;
  }

  const helpers=historicalHelpers(file);
  html=html.slice(0,currentOpen)+helpers+html.slice(currentOpen);

  for(const name of helperNames){
    if(!html.includes(`function ${name}`))throw new Error(`${file}: ${name} wurde nicht wiederhergestellt`);
  }
  if(!html.includes('const TASK_GROUP_STORE_RC874='))throw new Error(`${file}: TASK_GROUP_STORE_RC874 wurde nicht wiederhergestellt`);

  fs.writeFileSync(file,html,'utf8');
  console.log(`${file}: verlorene RC874-Aufgabenhelfer wiederhergestellt`);
}
