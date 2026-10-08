import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const write=(rel,content)=>fs.writeFileSync(path.join(ROOT,rel),content,'utf8');

function functionBlock(source,startMarker,endMarker,label){
  const start=source.indexOf(startMarker);
  const end=start<0?-1:source.indexOf(endMarker,start+startMarker.length);
  if(start<0||end<0)throw new Error(`${label}: Funktionsgrenze fehlt`);
  return {start,end,block:source.slice(start,end)};
}

// RC1467 root cause: the automatic Lieferavis lifecycle is invoked by startup events
// (exporthub:ready/rendered/viewchange). The shipment is already a persisted shipment,
// but the old auto-enable path called the normal user save bridge again. That bridge
// validates Colli and therefore displayed the blocking Colli alert during login.
// Automatic lifecycle events must never invoke user-initiated shipment persistence.
{
  const rel='assets/rc1015-lieferavis-mail-flow.js';
  let source=read(rel);
  const start='async function rc1021AutoEnable(reason){';
  const end='function stripAvisBlocks(text){';
  let target=functionBlock(source,start,end,'RC1467 Lieferavis startup guard');
  const before="  var saveAlreadyConfirmed=reason==='exporthub:sync'||reason==='exporthub:shipment-saved';\n  if(!saveAlreadyConfirmed)await rc1015PersistBeforeAvis();";
  const after="  // RC1467: background/startup auto-enable operates only on an already persisted shipment.\n  // Never enter the strict user-save bridge here; Colli validation belongs to explicit user actions.\n  var saveAlreadyConfirmed=true;";
  if(target.block.includes(before)){
    target.block=target.block.replace(before,after);
    source=source.slice(0,target.start)+target.block+source.slice(target.end);
  }else if(!target.block.includes('RC1467: background/startup auto-enable')){
    throw new Error('RC1467 Lieferavis startup guard: erwarteter Persistenz-Anker fehlt');
  }
  target=functionBlock(source,start,end,'RC1467 Lieferavis startup guard verify');
  if(/rc1015PersistBeforeAvis\s*\(/.test(target.block))throw new Error('RC1467: Startup-AutoEnable darf keine strikte Sendungsspeicherung auslösen');
  write(rel,source);
}

// Force browsers to request the corrected Lieferavis runtime. Keep v=1383 as the
// historical release identifier so existing release contracts continue to match.
{
  const rel='.github/rc1112/build-three-env.mjs';
  let source=read(rel);
  const oldUrl='/assets/rc1015-lieferavis-mail-flow.js?v=1383';
  const newUrl='/assets/rc1015-lieferavis-mail-flow.js?v=1383&rc=1467';
  if(!source.includes(newUrl)){
    if(!source.includes(oldUrl))throw new Error('RC1467 Lieferavis cache bust: Build-URL fehlt');
    source=source.replaceAll(oldUrl,newUrl);
  }
  write(rel,source);
}

const flow=read('assets/rc1015-lieferavis-mail-flow.js');
const target=functionBlock(flow,'async function rc1021AutoEnable(reason){','function stripAvisBlocks(text){','RC1467 final verify');
const builder=read('.github/rc1112/build-three-env.mjs');
if(!target.block.includes('RC1467: background/startup auto-enable')||/rc1015PersistBeforeAvis\s*\(/.test(target.block))throw new Error('RC1467 startup guard unvollständig');
if(!builder.includes('/assets/rc1015-lieferavis-mail-flow.js?v=1383&rc=1467'))throw new Error('RC1467 cache bust fehlt');
console.log('RC1467 startup Lieferavis guard + cache bust applied');
