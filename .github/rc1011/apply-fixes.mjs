import fs from 'node:fs';

function countOf(source,needle){return source.split(needle).length-1}
function replaceExact(file,from,to){
  let src=fs.readFileSync(file,'utf8');
  const count=countOf(src,from);
  if(count===0){
    if(to===''||src.includes(to)){console.log(file+': bereits angewendet');return false}
    throw new Error(`${file}: erwartete genau 1 Fundstelle, gefunden 0: ${from.slice(0,120)}`);
  }
  if(count!==1)throw new Error(`${file}: erwartete genau 1 Fundstelle, gefunden ${count}: ${from.slice(0,120)}`);
  src=src.replace(from,to);
  fs.writeFileSync(file,src);
  console.log(file+': 1 Änderung angewendet');
  return true;
}
function replaceEvery(file,from,to,expected){
  let src=fs.readFileSync(file,'utf8');
  const count=countOf(src,from);
  if(count===0&&src.includes(to)){console.log(file+': bereits angewendet');return false}
  if(count!==expected)throw new Error(`${file}: erwartete ${expected} Fundstellen, gefunden ${count}: ${from.slice(0,120)}`);
  src=src.split(from).join(to);
  fs.writeFileSync(file,src);
  console.log(`${file}: ${count} Änderungen angewendet`);
  return true;
}

for(const file of ['index.html','TESTVERSION.html']){
  replaceExact(file,
    '<label class="field">Sendungsreferenz<input id="rc542PalRef" placeholder="bei Ausgang Pflicht"></label>',
    '<label class="field">Sendungsreferenz optional<input id="rc542PalRef" placeholder="optional"></label>');
  replaceExact(file,
    "if(dir==='Ausgang'&&!ref)return alert('Für einen Ausgang ist die Sendungsreferenz Pflicht.');",
    '');
}

const access='api/shared/public-access-store.js';
replaceExact(access,
  "  const createdAt=now(),ttl=Math.max(60*1000,Number(ttlMs)|| (kind==='pickup'?DEFAULT_PICKUP_TTL_MS:DEFAULT_AVIS_TTL_MS)),expiresAt=new Date(Date.now()+ttl).toISOString();",
  "  const createdAt=now(),indefinite=ttlMs===null,ttl=indefinite?null:Math.max(60*1000,Number(ttlMs)|| (kind==='pickup'?DEFAULT_PICKUP_TTL_MS:DEFAULT_AVIS_TTL_MS)),expiresAt=indefinite?null:new Date(Date.now()+ttl).toISOString();");
replaceExact(access,
  "  if(record.expiresAt&&Date.now()>=Date.parse(record.expiresAt))throw error('ACCESS_EXPIRED','Dieser öffentliche Link ist abgelaufen.',410);",
  "  if(record.kind!=='avis'&&record.expiresAt&&Date.now()>=Date.parse(record.expiresAt))throw error('ACCESS_EXPIRED','Dieser öffentliche Link ist abgelaufen.',410);");

const avis='api/customer-avis/index.js';
replaceEvery(avis,'singleUse:true','singleUse:false',2);
replaceExact(avis,'},7*86400000,payload);','},null,payload);');
replaceExact(avis,'oneTime:true','oneTime:false');
replaceExact(avis,"access.resolve(req,'avis',raw,{allowUsed:false},payload)","access.resolve(req,'avis',raw,{allowUsed:true},payload)");
replaceExact(avis,
  "await access.clearFailures(resolved.environment,'avis',resolved.tokenHash);const consumed=await access.consume(resolved.environment,'avis',resolved.tokenHash,{reason:'authorized'}),sessionInfo=access.issueSession(consumed),response=publicShipment(sh,sessionInfo.session);",
  "const cleared=await access.clearFailures(resolved.environment,'avis',resolved.tokenHash),sessionInfo=access.issueSession(cleared),response=publicShipment(sh,sessionInfo.session);");
replaceExact(avis,'response.rawLinkConsumed=true','response.rawLinkConsumed=false');

console.log('RC1011-Korrekturen vollständig angewendet – ohne Änderungen am Rollenmodell.');
