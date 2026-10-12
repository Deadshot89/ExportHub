import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const builderPath=path.join(ROOT,'.github/rc1112/build-three-env.mjs');
let source=fs.readFileSync(builderPath,'utf8');

const functionName='function patchRc1495LegacyQrPersistence(html,file){';
const call='html=patchRc1495LegacyQrPersistence(html,file);';
const runtimeBefore="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||!id||/^DRAFT-/i.test(id)||!/^[A-Z0-9]{6}$/.test(ref))return false;return states().some(function(st){return arr(st.shipments).concat(arr(st.savedShipments)).some(function(x){return x===sh||sid(x)===id||sref(x)===ref})})}";
const runtimeRc1495="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||/^DRAFT-/i.test(id)||!/^[A-Z0-9]{6}$/.test(ref))return false;return states().some(function(st){return arr(st.shipments).concat(arr(st.savedShipments)).some(function(x){var xid=sid(x),xref=sref(x);if(x===sh)return true;if(id&&xid&&xid===id)return true;return xref===ref})})}";
const runtimeRc1496="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||!/^[A-Z0-9]{6}$/.test(ref))return false;return states().some(function(st){return arr(st.shipments).concat(arr(st.savedShipments)).some(function(x){var xid=sid(x),xref=sref(x);if(x===sh)return true;if(ref&&xref===ref)return true;if(id&&!/^DRAFT-/i.test(id)&&xid&&xid===id)return true;return false})})}";

if(!source.includes(functionName)){
  const insertBefore='function patchTaskDetailTab(html,file){';
  const at=source.indexOf(insertBefore);
  if(at<0)throw new Error('RC1495 builder insertion anchor fehlt');

  const patch=`function patchRc1495LegacyQrPersistence(html,file){
  const before=${JSON.stringify(runtimeBefore)};
  const rc1495=${JSON.stringify(runtimeRc1495)};
  const after=${JSON.stringify(runtimeRc1496)};
  if(html.includes(after))return html;
  if(html.includes(rc1495))html=html.replace(rc1495,after);
  else{
    const count=html.split(before).length-1;
    if(count!==1)throw new Error(file+': RC1495/RC1496 persisted()-Anker '+count+'x gefunden');
    html=html.replace(before,after);
  }
  if(!html.includes(after)||html.includes(before)||html.includes(rc1495))throw new Error(file+': RC1496 Legacy-QR-Persistenz-Patch unvollständig');
  return html;
}

`;
  source=source.slice(0,at)+patch+source.slice(at);
}else{
  const oldAfter=`  const after=${JSON.stringify(runtimeRc1495)};`;
  const newBlock=`  const rc1495=${JSON.stringify(runtimeRc1495)};\n  const after=${JSON.stringify(runtimeRc1496)};`;
  if(source.includes(oldAfter))source=source.replace(oldAfter,newBlock);
  const oldFlow="  if(html.includes(after))return html;\n  const count=html.split(before).length-1;\n  if(count!==1)throw new Error(file+': RC1495 persisted()-Anker '+count+'x gefunden');\n  html=html.replace(before,after);\n  if(!html.includes(after)||html.includes(before))throw new Error(file+': RC1495 Legacy-QR-Persistenz-Patch unvollständig');";
  const newFlow="  if(html.includes(after))return html;\n  if(html.includes(rc1495))html=html.replace(rc1495,after);\n  else{\n    const count=html.split(before).length-1;\n    if(count!==1)throw new Error(file+': RC1495/RC1496 persisted()-Anker '+count+'x gefunden');\n    html=html.replace(before,after);\n  }\n  if(!html.includes(after)||html.includes(before)||html.includes(rc1495))throw new Error(file+': RC1496 Legacy-QR-Persistenz-Patch unvollständig');";
  if(source.includes(oldFlow))source=source.replace(oldFlow,newFlow);
}

if(!source.includes(call)){
  const anchor='html=patchRc1471ReminderEligibility(html,file);';
  const count=source.split(anchor).length-1;
  if(count!==1)throw new Error('RC1495 build-call anchor '+count+'x gefunden');
  source=source.replace(anchor,anchor+'\n  '+call);
}

if(!source.includes(functionName)||!source.includes(call)||!source.includes(runtimeRc1496))throw new Error('RC1496 builder integration unvollständig');
fs.writeFileSync(builderPath,source,'utf8');
console.log('RC1496 legacy QR persistence hotfix applied');
