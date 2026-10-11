import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
let source=fs.readFileSync(builderPath,'utf8');

const functionName='function patchRc1471ReminderEligibility(html,file){';
const call='html=patchRc1471ReminderEligibility(html,file);';

if(!source.includes(functionName)){
  const insertBefore='function patchTaskDetailTab(html,file){';
  const at=source.indexOf(insertBefore);
  if(at<0)throw new Error('RC1471 builder insertion anchor fehlt');

  const patch=`function patchRc1471ReminderEligibility(html,file){
  const before="function reminderEligible(sh){if(!sh||isDone(sh)||sh.actualPickupDate||sh.pickedUpAt)return false;var d=shipmentPickup(sh);return !!d&&dayDiff(d,localISO())>0}";
  const after="function reminderEligible(sh){return !!sh&&!isDone(sh)&&!sh.actualPickupDate&&!sh.pickedUpAt}";
  const count=html.split(before).length-1;
  if(count===0)return html;
  if(count!==1)throw new Error(file+': RC1471 reminderEligible-Anker '+count+'x gefunden');
  html=html.replace(before,after);
  if(!html.includes(after)||html.includes(before))throw new Error(file+': RC1471 Reminder-Eligibility-Patch unvollständig');
  return html;
}

`;
  source=source.slice(0,at)+patch+source.slice(at);
}

if(!source.includes(call)){
  const anchor='html=patchRc1470NewShipmentCleanSlate(html,file);';
  const count=source.split(anchor).length-1;
  if(count!==1)throw new Error('RC1471 build-call anchor '+count+'x gefunden');
  source=source.replace(anchor,anchor+'\n  '+call);
}

if(!source.includes(functionName)||!source.includes(call))throw new Error('RC1471 builder integration unvollständig');
fs.writeFileSync(builderPath,source,'utf8');
console.log('RC1471 reminder eligibility hotfix applied');
