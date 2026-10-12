import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
let source=fs.readFileSync(builderPath,'utf8');

const functionName='function patchRc1498QrStatusSync(html,file){';
const call='html=patchRc1498QrStatusSync(html,file);';
const doneBefore="function done(data,compat){var serverToken=q(data&&data.token);";
const helper="function done(data,compat){function rc1498QrCopies(one){var out=[],id=sid(one),ref=sref(one),roots=states(),names=['shipments','savedShipments','salesSharedShipments','sharedShipments'];var add=function(x){if(!x||typeof x!=='object'||out.indexOf(x)>=0)return;var xid=sid(x),xref=sref(x);if(x===one||(ref&&xref===ref)||(id&&!/^DRAFT-/i.test(id)&&xid&&xid===id))out.push(x)};add(one);roots=Array.isArray(roots)?roots.slice():[];var addRoot=function(st){if(st&&typeof st==='object'&&roots.indexOf(st)<0)roots.push(st)};try{addRoot(window.ExportHUBClean&&window.ExportHUBClean.runtime&&window.ExportHUBClean.runtime.state);addRoot(window.ExportHUBClean&&window.ExportHUBClean.state);addRoot(window.appState);addRoot(window.state)}catch(_){}roots.forEach(function(st){names.forEach(function(name){arr(st&&st[name]).forEach(add)})});return out}var serverToken=q(data&&data.token);";

if(!source.includes(functionName)){
  const insertBefore='function patchTaskDetailTab(html,file){';
  const at=source.indexOf(insertBefore);
  if(at<0)throw new Error('RC1498 Statussync builder insertion anchor fehlt');
  const patch=`function patchRc1498QrStatusSync(html,file){
  const before=${JSON.stringify(doneBefore)};
  const after=${JSON.stringify(helper)};
  if(!html.includes(after)){
    const count=html.split(before).length-1;
    if(count!==1)throw new Error(file+': RC1498 QR-done()-Anker '+count+'x gefunden');
    html=html.replace(before,after);
  }
  const start=html.indexOf(after);
  const status="one.status='Bereit zur Abholung';one.processStatus='Bereit zur Abholung'";
  const statusAt=html.indexOf(status,start);
  if(start<0||statusAt<start)throw new Error(file+': RC1498 QR-Erfolgsblock fehlt');
  const returnAt=html.indexOf('return true}',statusAt);
  if(returnAt<statusAt)throw new Error(file+': RC1498 QR-done()-Ende fehlt');
  const end=returnAt+'return true}'.length;
  let block=html.slice(start,end);
  block=block.replace('copies(sh).map(function(x)','rc1498QrCopies(sh).map(function(x)');
  block=block.replace('copies(sh).forEach(function(x)','rc1498QrCopies(sh).forEach(function(x)');
  if(!block.includes('rc1498QrCopies(sh).map(function(x)')||!block.includes('rc1498QrCopies(sh).forEach(function(x)'))throw new Error(file+': RC1498 QR-Kopien-Synchronisierung unvollständig');
  html=html.slice(0,start)+block+html.slice(end);
  return html;
}

`;
  source=source.slice(0,at)+patch+source.slice(at);
}

if(!source.includes(call)){
  const anchor='html=patchRc1495LegacyQrPersistence(html,file);';
  const count=source.split(anchor).length-1;
  if(count!==1)throw new Error('RC1498 Statussync build-call anchor '+count+'x gefunden');
  source=source.replace(anchor,anchor+'\n  '+call);
}

if(!source.includes(functionName)||!source.includes(call)||!source.includes(helper))throw new Error('RC1498 QR-Statussync builder integration unvollständig');
fs.writeFileSync(builderPath,source,'utf8');
console.log('RC1498 QR status sync hotfix applied');
