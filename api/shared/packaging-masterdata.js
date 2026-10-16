'use strict';

const crypto=require('crypto');
const seed=require('./packaging-seed');

function text(value){return String(value==null?'':value).trim();}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function fail(code,message,status=400){const e=new Error(message||code);e.code=code;e.status=status;e.statusCode=status;throw e;}
function normalizePackagingName(value){return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
function normalizePackagingCode(value){return text(value).toUpperCase().replace(/\s+/g,'');}
function canonicalKey(value){const known=seed.seedFor(value);return normalizePackagingName(known?known.name:value);}
function optionalPositive(value){if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>0?n:null;}
function firstValue(raw,keys){for(const key of keys){if(raw&&raw[key]!=null&&raw[key]!=='')return raw[key];}return null;}
function actor(raw){if(raw&&typeof raw==='object')return{id:text(raw.id),name:text(raw.name||raw.displayName||raw.user||raw.username)};const name=text(raw);return{id:'',name};}
function actorOrSystem(raw){const a=actor(raw);return{id:a.id,name:a.name||'System'};}
function stableId(key){return`PKG-${crypto.createHash('sha1').update(String(key)).digest('hex').slice(0,12).toUpperCase()}`;}
function newId(){return`PKG-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;}
function dimension(raw,...keys){return optionalPositive(firstValue(raw,keys));}
function stamp(options){const value=options&&options.now;return text(typeof value==='function'?value():value)||new Date().toISOString();}
function sourceCandidate(raw,source){
  const name=text(raw&&firstValue(raw,['name','label','type','packaging','verpackung']));
  if(!name)return null;
  const known=seed.seedFor(name);
  const key=canonicalKey(name);
  return{source,seed:known,id:text(raw&&raw.id),name:known?known.name:name,normalizedName:key,code:text(raw&&raw.code),description:text(raw&&firstValue(raw,['description','note'])),active:raw&&raw.active===false?false:true,activeExplicit:!!(raw&&Object.prototype.hasOwnProperty.call(raw,'active')),lengthCm:dimension(raw,'lengthCm','length','l'),widthCm:dimension(raw,'widthCm','width','w'),heightCm:dimension(raw,'heightCm','height','h'),ldm:dimension(raw,'ldm'),createdAt:text(raw&&raw.createdAt)||null,createdBy:actor(raw&&raw.createdBy),updatedAt:text(raw&&raw.updatedAt)||null,updatedBy:actor(raw&&raw.updatedBy),deactivatedAt:text(raw&&raw.deactivatedAt)||null,deactivatedBy:raw&&raw.deactivatedBy?actor(raw.deactivatedBy):null};
}
function seedCandidate(raw){return{source:'seed',seed:raw,id:raw.id,name:raw.name,normalizedName:canonicalKey(raw.name),code:'',description:'',active:true,activeExplicit:false,lengthCm:optionalPositive(raw.lengthCm),widthCm:optionalPositive(raw.widthCm),heightCm:optionalPositive(raw.heightCm),ldm:optionalPositive(raw.ldm),createdAt:null,createdBy:{id:'system',name:'Migration'},updatedAt:null,updatedBy:{id:'system',name:'Migration'},deactivatedAt:null,deactivatedBy:null};}
function normalizeStored(candidate){
  const c=candidate||{},known=c.seed||seed.seedFor(c.name);
  return{id:text(c.id)||(known&&known.id)||stableId(c.normalizedName||canonicalKey(c.name)),name:text(c.name),normalizedName:c.normalizedName||canonicalKey(c.name),code:text(c.code),description:text(c.description),active:c.active!==false,lengthCm:optionalPositive(c.lengthCm),widthCm:optionalPositive(c.widthCm),heightCm:optionalPositive(c.heightCm),ldm:optionalPositive(c.ldm),createdAt:c.createdAt||null,createdBy:c.createdBy&&typeof c.createdBy==='object'?clone(c.createdBy):{id:'system',name:'Migration'},updatedAt:c.updatedAt||null,updatedBy:c.updatedBy&&typeof c.updatedBy==='object'?clone(c.updatedBy):{id:'system',name:'Migration'},deactivatedAt:c.deactivatedAt||null,deactivatedBy:c.deactivatedBy?clone(c.deactivatedBy):null};
}
function valuesDiffer(a,b){return a==null?b!=null:b==null||Number(a)!==Number(b);}
function mergeInto(current,candidate,conflicts){
  const next=current,known=candidate.seed||seed.seedFor(candidate.name)||seed.seedFor(current.name),protectedValues=!!(known&&known.protectedValues);
  if(candidate.source==='existing'&&candidate.id&&!known)next.id=candidate.id;
  if(candidate.source==='existing'&&!known&&candidate.name)next.name=candidate.name;
  if(known)next.name=known.name;
  if(candidate.code)next.code=candidate.code;
  if(candidate.description)next.description=candidate.description;
  if(candidate.activeExplicit)next.active=candidate.active!==false;
  for(const field of ['lengthCm','widthCm','heightCm','ldm']){
    const incoming=candidate[field];if(incoming==null)continue;
    if(protectedValues&&candidate.source!=='seed'){const canonical=known[field];if(canonical!=null&&valuesDiffer(incoming,canonical))conflicts.push({name:known.name,key:next.normalizedName,field,existing:incoming,canonical,source:candidate.source});continue;}
    if(protectedValues&&candidate.source==='seed')next[field]=incoming;else if(candidate.source==='legacy'||candidate.source==='existing'||next[field]==null)next[field]=incoming;
  }
  if(candidate.createdAt)next.createdAt=candidate.createdAt;if(candidate.createdBy&&candidate.createdBy.name)next.createdBy=clone(candidate.createdBy);if(candidate.updatedAt)next.updatedAt=candidate.updatedAt;if(candidate.updatedBy&&candidate.updatedBy.name)next.updatedBy=clone(candidate.updatedBy);if(candidate.deactivatedAt)next.deactivatedAt=candidate.deactivatedAt;if(candidate.deactivatedBy)next.deactivatedBy=clone(candidate.deactivatedBy);
  return next;
}
function migratePackagingState(state,options={}){
  const target=state&&typeof state==='object'?state:{},before=JSON.stringify(Array.isArray(target.packagingTypes)?target.packagingTypes:[]),conflicts=[],byKey=new Map();
  function add(candidate){if(!candidate||!candidate.normalizedName)return;const key=candidate.normalizedName;if(!byKey.has(key))byKey.set(key,normalizeStored(candidate));else mergeInto(byKey.get(key),candidate,conflicts);}
  for(const raw of seed.listSeeds())add(seedCandidate(raw));
  for(const raw of Array.isArray(target.colliTypes)?target.colliTypes:[])add(sourceCandidate(raw,'legacy'));
  for(const raw of Array.isArray(target.packagingTypes)?target.packagingTypes:[])add(sourceCandidate(raw,'existing'));
  for(const item of byKey.values()){
    const known=seed.seedFor(item.name);if(known&&known.protectedValues){for(const field of ['lengthCm','widthCm','heightCm','ldm'])item[field]=optionalPositive(known[field]);item.id=known.id;item.name=known.name;item.normalizedName=canonicalKey(known.name);}
  }
  target.packagingTypes=Array.from(byKey.values()).sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'}));
  return{state:target,changed:JSON.stringify(target.packagingTypes)!==before,conflicts};
}
function publicPackaging(item){const raw=item&&typeof item==='object'?item:{};return{id:text(raw.id),name:text(raw.name),code:text(raw.code),description:text(raw.description),active:raw.active!==false,lengthCm:optionalPositive(raw.lengthCm),widthCm:optionalPositive(raw.widthCm),heightCm:optionalPositive(raw.heightCm),ldm:optionalPositive(raw.ldm)};}
function adminPackaging(item){const p=publicPackaging(item),raw=item||{};return{...p,createdAt:raw.createdAt||null,createdBy:clone(raw.createdBy||null),updatedAt:raw.updatedAt||null,updatedBy:clone(raw.updatedBy||null),deactivatedAt:raw.deactivatedAt||null,deactivatedBy:clone(raw.deactivatedBy||null)};}
function listPackaging(state,{includeInactive=false,admin=false}={}){return(Array.isArray(state&&state.packagingTypes)?state.packagingTypes:[]).filter(item=>includeInactive||item.active!==false).map(admin?adminPackaging:publicPackaging).sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true,sensitivity:'base'}));}
function snapshotPackaging(item){const p=publicPackaging(item);return{name:p.name,code:p.code,description:p.description,lengthCm:p.lengthCm,widthCm:p.widthCm,heightCm:p.heightCm,ldm:p.ldm};}
function rowLabel(row){return text(firstValue(row,['type','packaging','verpackung','packageType','packagingType','packageName','packagingName','name']));}
function historicalFromRow(row){const label=rowLabel(row);if(!label)return null;return{id:text(row&&row.packagingTypeId),name:label,code:text(row&&row.packagingCode),description:text(row&&row.packagingDescription),lengthCm:dimension(row,'lengthCm','length','l'),widthCm:dimension(row,'widthCm','width','w'),heightCm:dimension(row,'heightCm','height','h'),ldm:dimension(row,'ldm')};}
function resolveHistoricalPackaging(row,state){
  const raw=row&&typeof row==='object'?row:{};
  if(raw.packagingSnapshot&&typeof raw.packagingSnapshot==='object'&&text(raw.packagingSnapshot.name))return{id:text(raw.packagingTypeId),...snapshotPackaging(raw.packagingSnapshot)};
  const persisted=historicalFromRow(raw);if(persisted)return persisted;
  const items=Array.isArray(state&&state.packagingTypes)?state.packagingTypes:[],id=text(raw.packagingTypeId),label=rowLabel(raw),key=canonicalKey(label),found=items.find(item=>id&&text(item.id)===id)||items.find(item=>label&&canonicalKey(item.name)===key);
  return found?{id:text(found.id),...snapshotPackaging(found)}:null;
}
function cleanDescription(value){return text(value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').slice(0,1000);}
function validatedNumber(source,key,partial){if(partial&&!Object.prototype.hasOwnProperty.call(source,key))return undefined;if(source[key]==null||source[key]==='')return null;const value=Number(source[key]);if(!Number.isFinite(value)||value<=0)fail('PACKAGING_DIMENSION_INVALID',`${key} muss größer als 0 sein.`);return value;}
function validatePackagingInput(payload,{partial=false}={}){
  const source=payload&&typeof payload==='object'?payload:{},out={};
  if(!partial||Object.prototype.hasOwnProperty.call(source,'name')){out.name=text(source.name).replace(/\s+/g,' ').slice(0,160);if(!out.name)fail('PACKAGING_NAME_REQUIRED','Bezeichnung ist erforderlich.');out.normalizedName=canonicalKey(out.name);}
  if(!partial||Object.prototype.hasOwnProperty.call(source,'code'))out.code=normalizePackagingCode(source.code).slice(0,40);
  if(!partial||Object.prototype.hasOwnProperty.call(source,'description'))out.description=cleanDescription(source.description);
  if(!partial||Object.prototype.hasOwnProperty.call(source,'active')){if(source.active!==undefined&&typeof source.active!=='boolean')fail('PACKAGING_ACTIVE_INVALID','Aktiv-Status muss wahr oder falsch sein.');out.active=source.active===undefined?true:source.active;}
  for(const key of ['lengthCm','widthCm','heightCm','ldm']){const value=validatedNumber(source,key,partial);if(value!==undefined)out[key]=value;}
  if(partial&&Object.keys(out).length===0)fail('PACKAGING_EMPTY_PATCH','Keine änderbaren Verpackungsfelder übergeben.');
  return out;
}
function ensureCollection(state){migratePackagingState(state);if(!Array.isArray(state.packagingTypes))state.packagingTypes=[];return state.packagingTypes;}
function findItem(state,id){const key=text(id),item=ensureCollection(state).find(x=>text(x&&x.id)===key);if(!item)fail('PACKAGING_NOT_FOUND','Verpackung wurde nicht gefunden.',404);return item;}
function ensureUnique(state,input,ignoreId=''){
  const items=ensureCollection(state),nameKey=input.normalizedName,codeKey=normalizePackagingCode(input.code);
  if(nameKey&&items.some(x=>text(x.id)!==ignoreId&&canonicalKey(x.name)===nameKey))fail('PACKAGING_NAME_DUPLICATE','Eine Verpackung mit dieser Bezeichnung existiert bereits.',409);
  if(codeKey&&items.some(x=>text(x.id)!==ignoreId&&normalizePackagingCode(x.code)===codeKey))fail('PACKAGING_CODE_DUPLICATE','Eine Verpackung mit diesem Code existiert bereits.',409);
}
function createPackaging(state,payload,who,options={}){
  const input=validatePackagingInput(payload),items=ensureCollection(state);ensureUnique(state,input);const at=stamp(options),by=actorOrSystem(who),item={id:newId(),...input,createdAt:at,createdBy:by,updatedAt:at,updatedBy:by,deactivatedAt:input.active===false?at:null,deactivatedBy:input.active===false?by:null};items.push(item);return{before:null,after:adminPackaging(item)};
}
function updatePackaging(state,id,patch,who,options={}){
  const item=findItem(state,id),before=adminPackaging(item),input=validatePackagingInput(patch,{partial:true});ensureUnique(state,input,text(item.id));Object.assign(item,input);const at=stamp(options),by=actorOrSystem(who);item.updatedAt=at;item.updatedBy=by;if(input.active===true){item.deactivatedAt=null;item.deactivatedBy=null;}else if(input.active===false){item.deactivatedAt=at;item.deactivatedBy=by;}return{before,after:adminPackaging(item)};
}
function duplicatePackaging(state,id,payload,who,options={}){
  const original=findItem(state,id),base=publicPackaging(original),items=ensureCollection(state);let index=1,name='';do{name=`${base.name} Kopie${index>1?` ${index}`:''}`;index++;}while(items.some(x=>canonicalKey(x.name)===canonicalKey(name)));
  return createPackaging(state,{...base,name,code:'',...(payload&&typeof payload==='object'?payload:{})},who,options);
}
function setPackagingActive(state,id,active,who,options={}){if(typeof active!=='boolean')fail('PACKAGING_ACTIVE_INVALID','Aktiv-Status muss wahr oder falsch sein.');return updatePackaging(state,id,{active},who,options);}
const USAGE_COLLECTIONS={shipments:['shipments','archivedShipments','shipmentHistory','shipmentArchive'],tasks:['tasks'],packNotifications:['packNotifications'],packDrafts:['packDrafts'],pickups:['pickups','pickupHistory','pickupRecords'],avis:['avisRecords','customerAvisRecords'],other:['shippingRecords','shipmentRecords','history']};
const ID_KEYS=new Set(['packagingtypeid','packagetypeid','packagingid']);
const LABEL_KEYS=new Set(['type','packaging','verpackung','packagetype','packagingtype','packagename','packagingname']);
function nodeReferencesPackaging(node,target,seen=new Set()){
  if(node==null)return false;if(typeof node!=='object')return false;if(seen.has(node))return false;seen.add(node);
  for(const [key,value] of Object.entries(node)){
    const low=key.toLowerCase();
    if(ID_KEYS.has(low)&&text(value)&&text(value)===text(target.id))return true;
    if(LABEL_KEYS.has(low)&&typeof value!=='object'&&canonicalKey(value)===canonicalKey(target.name))return true;
    if(low==='packagingsnapshot'&&value&&typeof value==='object'&&canonicalKey(value.name)===canonicalKey(target.name))return true;
    if(value&&typeof value==='object'&&nodeReferencesPackaging(value,target,seen))return true;
  }
  return false;
}
function usageOfPackaging(state,itemOrId){
  const target=typeof itemOrId==='object'?itemOrId:findItem(state,itemOrId),references={shipments:0,tasks:0,packNotifications:0,packDrafts:0,pickups:0,avis:0,other:0};
  for(const [group,keys] of Object.entries(USAGE_COLLECTIONS))for(const key of keys)for(const record of Array.isArray(state&&state[key])?state[key]:[])if(nodeReferencesPackaging(record,target))references[group]++;
  return{used:Object.values(references).some(n=>n>0),references};
}
function deleteOrArchivePackaging(state,id,who,options={}){
  const item=findItem(state,id),before=adminPackaging(item),usage=usageOfPackaging(state,item);
  if(usage.used){const changed=setPackagingActive(state,id,false,who,options);return{deleted:false,archived:true,before,after:changed.after,usage};}
  const items=ensureCollection(state),index=items.findIndex(x=>text(x.id)===text(id));if(index>=0)items.splice(index,1);return{deleted:true,archived:false,before,after:null,usage};
}

module.exports={normalizePackagingName,normalizePackagingCode,canonicalKey,migratePackagingState,listPackaging,publicPackaging,adminPackaging,snapshotPackaging,resolveHistoricalPackaging,validatePackagingInput,createPackaging,updatePackaging,duplicatePackaging,setPackagingActive,usageOfPackaging,deleteOrArchivePackaging};
