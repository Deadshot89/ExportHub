'use strict';

const crypto=require('crypto');
const seed=require('./packaging-seed');

function text(value){return String(value==null?'':value).trim();}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function normalizePackagingName(value){return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
function normalizePackagingCode(value){return text(value).toUpperCase().replace(/\s+/g,'');}
function canonicalKey(value){const known=seed.seedFor(value);return normalizePackagingName(known?known.name:value);}
function optionalPositive(value){if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>0?n:null;}
function firstValue(raw,keys){for(const key of keys){if(raw&&raw[key]!=null&&raw[key]!=='')return raw[key];}return null;}
function actor(raw){if(raw&&typeof raw==='object')return{id:text(raw.id),name:text(raw.name)};const name=text(raw);return{id:'',name};}
function stableId(key){return`PKG-${crypto.createHash('sha1').update(String(key)).digest('hex').slice(0,12).toUpperCase()}`;}
function dimension(raw,...keys){return optionalPositive(firstValue(raw,keys));}
function sourceCandidate(raw,source){
  const name=text(raw&&firstValue(raw,['name','label','type','packaging','verpackung']));
  if(!name)return null;
  const known=seed.seedFor(name);
  const key=canonicalKey(name);
  return{
    source,
    seed:known,
    id:text(raw&&raw.id),
    name:known?known.name:name,
    normalizedName:key,
    code:text(raw&&raw.code),
    description:text(raw&&firstValue(raw,['description','note'])),
    active:raw&&raw.active===false?false:true,
    activeExplicit:!!(raw&&Object.prototype.hasOwnProperty.call(raw,'active')),
    lengthCm:dimension(raw,'lengthCm','length','l'),
    widthCm:dimension(raw,'widthCm','width','w'),
    heightCm:dimension(raw,'heightCm','height','h'),
    ldm:dimension(raw,'ldm'),
    createdAt:text(raw&&raw.createdAt)||null,
    createdBy:actor(raw&&raw.createdBy),
    updatedAt:text(raw&&raw.updatedAt)||null,
    updatedBy:actor(raw&&raw.updatedBy),
    deactivatedAt:text(raw&&raw.deactivatedAt)||null,
    deactivatedBy:raw&&raw.deactivatedBy?actor(raw.deactivatedBy):null
  };
}
function seedCandidate(raw){return{
  source:'seed',seed:raw,id:raw.id,name:raw.name,normalizedName:canonicalKey(raw.name),code:'',description:'',active:true,activeExplicit:false,
  lengthCm:optionalPositive(raw.lengthCm),widthCm:optionalPositive(raw.widthCm),heightCm:optionalPositive(raw.heightCm),ldm:optionalPositive(raw.ldm),
  createdAt:null,createdBy:{id:'system',name:'Migration'},updatedAt:null,updatedBy:{id:'system',name:'Migration'},deactivatedAt:null,deactivatedBy:null
};}
function normalizeStored(candidate){
  const c=candidate||{};
  const known=c.seed||seed.seedFor(c.name);
  return{
    id:text(c.id)||(known&&known.id)||stableId(c.normalizedName||canonicalKey(c.name)),
    name:text(c.name),
    normalizedName:c.normalizedName||canonicalKey(c.name),
    code:text(c.code),
    description:text(c.description),
    active:c.active!==false,
    lengthCm:optionalPositive(c.lengthCm),
    widthCm:optionalPositive(c.widthCm),
    heightCm:optionalPositive(c.heightCm),
    ldm:optionalPositive(c.ldm),
    createdAt:c.createdAt||null,
    createdBy:c.createdBy&&typeof c.createdBy==='object'?clone(c.createdBy):{id:'system',name:'Migration'},
    updatedAt:c.updatedAt||null,
    updatedBy:c.updatedBy&&typeof c.updatedBy==='object'?clone(c.updatedBy):{id:'system',name:'Migration'},
    deactivatedAt:c.deactivatedAt||null,
    deactivatedBy:c.deactivatedBy?clone(c.deactivatedBy):null
  };
}
function valuesDiffer(a,b){return a==null?b!=null:b==null||Number(a)!==Number(b);}
function mergeInto(current,candidate,conflicts){
  const next=current;
  const known=candidate.seed||seed.seedFor(candidate.name)||seed.seedFor(current.name);
  const protectedValues=!!(known&&known.protectedValues);
  if(candidate.source==='existing'&&candidate.id&&!known)next.id=candidate.id;
  if(candidate.source==='existing'&&!known&&candidate.name)next.name=candidate.name;
  if(known)next.name=known.name;
  if(candidate.code)next.code=candidate.code;
  if(candidate.description)next.description=candidate.description;
  if(candidate.activeExplicit)next.active=candidate.active!==false;
  for(const field of ['lengthCm','widthCm','heightCm','ldm']){
    const incoming=candidate[field];
    if(incoming==null)continue;
    if(protectedValues&&candidate.source!=='seed'){
      const canonical=known[field];
      if(canonical!=null&&valuesDiffer(incoming,canonical))conflicts.push({name:known.name,key:next.normalizedName,field,existing:incoming,canonical,source:candidate.source});
      continue;
    }
    if(protectedValues&&candidate.source==='seed')next[field]=incoming;
    else if(candidate.source==='legacy'||candidate.source==='existing'||next[field]==null)next[field]=incoming;
  }
  if(candidate.createdAt)next.createdAt=candidate.createdAt;
  if(candidate.createdBy&&candidate.createdBy.name)next.createdBy=clone(candidate.createdBy);
  if(candidate.updatedAt)next.updatedAt=candidate.updatedAt;
  if(candidate.updatedBy&&candidate.updatedBy.name)next.updatedBy=clone(candidate.updatedBy);
  if(candidate.deactivatedAt)next.deactivatedAt=candidate.deactivatedAt;
  if(candidate.deactivatedBy)next.deactivatedBy=clone(candidate.deactivatedBy);
  return next;
}
function migratePackagingState(state,options={}){
  const target=state&&typeof state==='object'?state:{};
  const before=JSON.stringify(Array.isArray(target.packagingTypes)?target.packagingTypes:[]);
  const conflicts=[];
  const byKey=new Map();
  function add(candidate){
    if(!candidate||!candidate.normalizedName)return;
    const key=candidate.normalizedName;
    if(!byKey.has(key))byKey.set(key,normalizeStored(candidate));
    else mergeInto(byKey.get(key),candidate,conflicts);
  }
  for(const raw of seed.listSeeds())add(seedCandidate(raw));
  for(const raw of Array.isArray(target.colliTypes)?target.colliTypes:[])add(sourceCandidate(raw,'legacy'));
  for(const raw of Array.isArray(target.packagingTypes)?target.packagingTypes:[])add(sourceCandidate(raw,'existing'));
  for(const item of byKey.values()){
    const known=seed.seedFor(item.name);
    if(known&&known.protectedValues){
      for(const field of ['lengthCm','widthCm','heightCm','ldm'])item[field]=optionalPositive(known[field]);
      item.id=known.id;
      item.name=known.name;
      item.normalizedName=canonicalKey(known.name);
    }
  }
  target.packagingTypes=Array.from(byKey.values()).sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'}));
  const changed=JSON.stringify(target.packagingTypes)!==before;
  return{state:target,changed,conflicts};
}
function publicPackaging(item){
  const raw=item&&typeof item==='object'?item:{};
  return{id:text(raw.id),name:text(raw.name),code:text(raw.code),description:text(raw.description),active:raw.active!==false,
    lengthCm:optionalPositive(raw.lengthCm),widthCm:optionalPositive(raw.widthCm),heightCm:optionalPositive(raw.heightCm),ldm:optionalPositive(raw.ldm)};
}
function listPackaging(state,{includeInactive=false}={}){
  return(Array.isArray(state&&state.packagingTypes)?state.packagingTypes:[])
    .filter(item=>includeInactive||item.active!==false)
    .map(publicPackaging)
    .sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'}));
}
function snapshotPackaging(item){const p=publicPackaging(item);return{name:p.name,code:p.code,description:p.description,lengthCm:p.lengthCm,widthCm:p.widthCm,heightCm:p.heightCm,ldm:p.ldm};}
function rowLabel(row){return text(firstValue(row,['type','packaging','verpackung','packageType','packagingType','name']));}
function historicalFromRow(row){
  const label=rowLabel(row);if(!label)return null;
  return{id:text(row&&row.packagingTypeId),name:label,code:text(row&&row.packagingCode),description:text(row&&row.packagingDescription),
    lengthCm:dimension(row,'lengthCm','length','l'),widthCm:dimension(row,'widthCm','width','w'),heightCm:dimension(row,'heightCm','height','h'),ldm:dimension(row,'ldm')};
}
function resolveHistoricalPackaging(row,state){
  const raw=row&&typeof row==='object'?row:{};
  if(raw.packagingSnapshot&&typeof raw.packagingSnapshot==='object'&&text(raw.packagingSnapshot.name)){
    return{id:text(raw.packagingTypeId),...snapshotPackaging(raw.packagingSnapshot)};
  }
  const persisted=historicalFromRow(raw);if(persisted)return persisted;
  const items=Array.isArray(state&&state.packagingTypes)?state.packagingTypes:[];
  const id=text(raw.packagingTypeId),label=rowLabel(raw),key=canonicalKey(label);
  const found=items.find(item=>id&&text(item.id)===id)||items.find(item=>label&&canonicalKey(item.name)===key);
  return found?{id:text(found.id),...snapshotPackaging(found)}:null;
}

module.exports={
  normalizePackagingName,normalizePackagingCode,canonicalKey,migratePackagingState,listPackaging,publicPackaging,snapshotPackaging,resolveHistoricalPackaging
};
