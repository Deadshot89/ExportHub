import fs from 'node:fs';

function patchFile(path, transform){
  const before=fs.readFileSync(path,'utf8');
  const after=transform(before);
  if(after!==before)fs.writeFileSync(path,after);
  console.log(`RC1017 active pickup patch: ${path} ${after===before?'already applied':'updated'}`);
}

patchFile('api/shared/pickup-store.js',(src)=>{
  if(!src.includes('async function assertActiveLoadUnit(record)')){
    const marker="async function updateTeam(record,podsToAdd=[],rawToken=''){";
    const at=src.indexOf(marker);
    if(at<0)throw new Error('RC1017: pickup-store updateTeam marker missing');
    const fn=`async function assertActiveLoadUnit(record){\n const r=record&&typeof record==='object'?record:{};if(!r.loadUnitId)return true;\n const c=await clients(r.environment),blob=c.team.getBlockBlobClient(teamBlobName(c.environment)),d=await readJson(blob,null),doc=d.value||{},state=doc.state||{},shipments=Array.isArray(state.shipments)?state.shipments:[],ref=String(r.reference||'').trim().toUpperCase(),sid=String(r.shipmentId||'').trim(),sh=shipments.find(x=>(sid&&String(x.id||x.shipmentId||'')===sid)||(ref&&String(x.ref||x.reference||'').trim().toUpperCase()===ref));\n if(!sh)throw err('PICKUP_LOAD_UNIT_NOT_FOUND','Die LKW-Ladeeinheit ist nicht mehr aktiv.',410);\n multiTruckPickup.resolveLoadUnit(sh,r.loadUnitId,r.splitVersion);\n return true\n}\n`;
    src=src.slice(0,at)+fn+src.slice(at);
  }
  if(!src.includes('publicRecord,assertActiveLoadUnit,updateTeam')){
    const from='publicRecord,updateTeam,safeName';
    if(!src.includes(from))throw new Error('RC1017: pickup-store export marker missing');
    src=src.replace(from,'publicRecord,assertActiveLoadUnit,updateTeam,safeName');
  }
  return src;
});

patchFile('api/pickup-status/index.js',(src)=>{
  if(src.includes('await store.assertActiveLoadUnit(record);'))return src;
  const from="record=got.record||{};if(record.status==='disabled')";
  if(!src.includes(from))throw new Error('RC1017: pickup-status record marker missing');
  return src.replace(from,"record=got.record||{};await store.assertActiveLoadUnit(record);if(record.status==='disabled')");
});

patchFile('api/pickup-confirm-v2/index.js',(src)=>{
  if(src.includes('await store.assertActiveLoadUnit(current);'))return src;
  const from="const got=await store.getRecord(resolved.tokenHash,resolved.environment),current=got.record||{},providedRef=String(b.reference||b.shipmentRef||'').trim().toUpperCase();";
  if(!src.includes(from))throw new Error('RC1017: pickup-confirm current marker missing');
  return src.replace(from,"const got=await store.getRecord(resolved.tokenHash,resolved.environment),current=got.record||{};await store.assertActiveLoadUnit(current);const providedRef=String(b.reference||b.shipmentRef||'').trim().toUpperCase();");
});
