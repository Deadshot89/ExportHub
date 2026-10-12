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
const runtimeRc1498="function persisted(sh){var id=sid(sh),ref=sref(sh);if(!sh||!/^[A-Z0-9]{6}$/.test(ref))return false;var roots=states(),names=['shipments','savedShipments','salesSharedShipments','sharedShipments'];roots=Array.isArray(roots)?roots.slice():[];function add(st){if(st&&typeof st==='object'&&roots.indexOf(st)<0)roots.push(st)}try{add(window.ExportHUBClean&&window.ExportHUBClean.runtime&&window.ExportHUBClean.runtime.state);add(window.ExportHUBClean&&window.ExportHUBClean.state);add(window.appState);add(window.state)}catch(_){}return roots.some(function(st){return names.some(function(name){return arr(st&&st[name]).some(function(x){var xid=sid(x),xref=sref(x);if(x===sh)return true;if(ref&&xref===ref)return true;if(id&&!/^DRAFT-/i.test(id)&&xid&&xid===id)return true;return false})})})}";

if(!source.includes(functionName)){
  const insertBefore='function patchTaskDetailTab(html,file){';
  const at=source.indexOf(insertBefore);
  if(at<0)throw new Error('RC1495 builder insertion anchor fehlt');

  const patch=`function patchRc1495LegacyQrPersistence(html,file){
  const before=${JSON.stringify(runtimeBefore)};
  const rc1495=${JSON.stringify(runtimeRc1495)};
  const rc1496=${JSON.stringify(runtimeRc1496)};
  const after=${JSON.stringify(runtimeRc1498)};
  if(html.includes(after))return html;
  if(html.includes(rc1496))html=html.replace(rc1496,after);
  else if(html.includes(rc1495))html=html.replace(rc1495,after);
  else{
    const count=html.split(before).length-1;
    if(count!==1)throw new Error(file+': RC1495/RC1496/RC1498 persisted()-Anker '+count+'x gefunden');
    html=html.replace(before,after);
  }
  if(!html.includes(after)||html.includes(before)||html.includes(rc1495)||html.includes(rc1496))throw new Error(file+': RC1498 Legacy-QR-Persistenz-Patch unvollständig');
  return html;
}

`;
  source=source.slice(0,at)+patch+source.slice(at);
}else{
  const oldRc1496Block=`  const rc1495=${JSON.stringify(runtimeRc1495)};\n  const after=${JSON.stringify(runtimeRc1496)};`;
  const rc1498Block=`  const rc1495=${JSON.stringify(runtimeRc1495)};\n  const rc1496=${JSON.stringify(runtimeRc1496)};\n  const after=${JSON.stringify(runtimeRc1498)};`;
  if(source.includes(oldRc1496Block))source=source.replace(oldRc1496Block,rc1498Block);

  const oldRc1495After=`  const after=${JSON.stringify(runtimeRc1495)};`;
  const oldRc1495Block=`  const rc1495=${JSON.stringify(runtimeRc1495)};\n  const after=${JSON.stringify(runtimeRc1496)};`;
  if(source.includes(oldRc1495After))source=source.replace(oldRc1495After,rc1498Block);
  else if(source.includes(oldRc1495Block))source=source.replace(oldRc1495Block,rc1498Block);

  const oldFlow1496="  if(html.includes(after))return html;\n  if(html.includes(rc1495))html=html.replace(rc1495,after);\n  else{\n    const count=html.split(before).length-1;\n    if(count!==1)throw new Error(file+': RC1495/RC1496 persisted()-Anker '+count+'x gefunden');\n    html=html.replace(before,after);\n  }\n  if(!html.includes(after)||html.includes(before)||html.includes(rc1495))throw new Error(file+': RC1496 Legacy-QR-Persistenz-Patch unvollständig');";
  const flow1498="  if(html.includes(after))return html;\n  if(html.includes(rc1496))html=html.replace(rc1496,after);\n  else if(html.includes(rc1495))html=html.replace(rc1495,after);\n  else{\n    const count=html.split(before).length-1;\n    if(count!==1)throw new Error(file+': RC1495/RC1496/RC1498 persisted()-Anker '+count+'x gefunden');\n    html=html.replace(before,after);\n  }\n  if(!html.includes(after)||html.includes(before)||html.includes(rc1495)||html.includes(rc1496))throw new Error(file+': RC1498 Legacy-QR-Persistenz-Patch unvollständig');";
  if(source.includes(oldFlow1496))source=source.replace(oldFlow1496,flow1498);

  if(!source.includes(`  const after=${JSON.stringify(runtimeRc1498)};`)||!source.includes(flow1498)){
    throw new Error('RC1498 vorhandene Builder-Patchfunktion konnte nicht sicher aktualisiert werden');
  }
}

if(!source.includes(call)){
  const anchor='html=patchRc1471ReminderEligibility(html,file);';
  const count=source.split(anchor).length-1;
  if(count!==1)throw new Error('RC1495 build-call anchor '+count+'x gefunden');
  source=source.replace(anchor,anchor+'\n  '+call);
}

if(!source.includes(functionName)||!source.includes(call)||!source.includes(runtimeRc1498))throw new Error('RC1498 builder integration unvollständig');
fs.writeFileSync(builderPath,source,'utf8');
console.log('RC1498 legacy QR persistence hotfix applied');
