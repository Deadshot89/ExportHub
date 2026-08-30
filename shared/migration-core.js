const BACKUP_TYPE = 'ExportHUB_BACKUP';
const PROFESSIONAL_VERSION = '0.1.0';

function q(v){ return v == null ? '' : String(v).trim(); }
function low(v){ return q(v).toLowerCase(); }
function obj(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }
function arr(v){ return Array.isArray(v) ? v : []; }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function normalizeKey(v){ return q(v).normalize('NFKC').toLowerCase().replace(/\s+/g,' '); }
function safeId(v){ return q(v).replace(/[^A-Za-z0-9._:-]+/g,'_').replace(/^_+|_+$/g,''); }

function refOf(sh){ return q(sh && (sh.ref || sh.reference || sh.referenceNumber || sh.folderRef || sh.shipmentRef)); }
function shipmentIdOf(sh){ return q(sh && (sh.id || sh.shipmentId || sh.uuid)); }
function customerIdOf(c){ return q(c && (c.id || c.customerId)); }
function customerAccountOf(c){ return q(c && (c.account || c.customerNumber || c.customerAccount)); }
function customerNameOf(c){ return q(c && (c.name || c.customerName)); }

function looksLikeShipment(x){
  if(!obj(x)) return false;
  const ref = refOf(x);
  if(/^[A-Z0-9]{6}$/i.test(ref)) return true;
  return !!(shipmentIdOf(x) && (Array.isArray(x.rows) || q(x.customerName) || q(x.customerId) || q(x.pickupDate) || q(x.status) || Array.isArray(x.podFiles)));
}

function looksLikeFile(x){
  if(!obj(x)) return false;
  const name = q(x.name || x.filename || x.fileName || x.originalName);
  if(!name) return false;
  return !!(q(x.data || x.dataUrl || x.base64 || x.url || x.downloadUrl || x.href || x.webUrl) || x.contentStored === true || Number(x.size || 0) > 0 || q(x.type || x.mimeType));
}

function fileNameOf(x){ return q(x.name || x.filename || x.fileName || x.originalName) || 'Dokument'; }
function filePayloadOf(x){ return q(x.data || x.dataUrl || x.base64); }
function fileUrlOf(x){ return q(x.url || x.downloadUrl || x.href || x.webUrl); }
function fileMimeOf(x){ return q(x.type || x.mimeType); }

function classifyDocument(path, file){
  const s = low(path + ' ' + fileNameOf(file) + ' ' + q(file.kind || file.docKind || file.documentKind || file.source));
  if(/pod|proof.of.delivery|unterschrift|signed-loadlist/.test(s)) return 'POD';
  if(/lieferschein|delivery.?note|packing.?slip|dnc/.test(s)) return 'LIEFERSCHEIN';
  if(/\babd\b|ausfuhr|export.?declaration/.test(s)) return 'ABD';
  if(/\bcmr\b/.test(s)) return 'CMR';
  if(/rechnung|invoice/.test(s)) return 'RECHNUNG';
  if(/ladeliste|load.?list/.test(s)) return 'LADELISTE';
  return 'DOKUMENT';
}

function shipmentCollections(state){
  const out=[];
  [['shipments', state.shipments], ['savedShipments', state.savedShipments], ['archive', state.archive]].forEach(([name,list])=>{
    arr(list).forEach((value,index)=>{
      if(name !== 'archive' || looksLikeShipment(value)) out.push({sourceCollection:name, sourceIndex:index, value});
    });
  });
  return out;
}

function shipmentIdentity(sh, pointer){
  const id=shipmentIdOf(sh), ref=refOf(sh);
  if(id) return 'id:'+normalizeKey(id);
  if(ref) return 'ref:'+normalizeKey(ref);
  return 'pointer:'+pointer;
}
function customerIdentity(c, pointer){
  const id=customerIdOf(c), acc=customerAccountOf(c), name=customerNameOf(c);
  if(id) return 'id:'+normalizeKey(id);
  if(acc) return 'account:'+normalizeKey(acc);
  if(name) return 'name:'+normalizeKey(name);
  return 'pointer:'+pointer;
}

function findDocuments(root, basePath, ownerType, ownerPointer){
  const docs=[];
  const seen=new WeakSet();
  function walk(v,path,depth){
    if(depth>14 || v == null) return;
    if(obj(v)){
      if(seen.has(v)) return;
      seen.add(v);
      if(looksLikeFile(v)){
        docs.push({
          sourcePath:path,
          ownerType,
          ownerPointer,
          name:fileNameOf(v),
          kind:classifyDocument(path,v),
          mimeType:fileMimeOf(v),
          size:Number(v.size||0)||0,
          inlinePayload:filePayloadOf(v),
          remoteUrl:fileUrlOf(v),
          contentStored:v.contentStored === true,
          sourceId:q(v.id || v.remoteId),
          declaredHash:q(v.hash || v.sha256 || v.podCloudBackupHash)
        });
        return;
      }
      Object.keys(v).forEach(k=>walk(v[k], path ? path+'.'+k : k, depth+1));
      return;
    }
    if(Array.isArray(v)) v.forEach((x,i)=>walk(x, path+'['+i+']', depth+1));
  }
  walk(root,basePath,0);
  return docs;
}

function knownAuditArrays(state){
  const names=['audit','auditLog','auditTrail','activityLog','history','logs','protocol','protokoll','protokolle'];
  const out=[];
  for(const name of names){ if(Array.isArray(state[name])) out.push({name, count:state[name].length}); }
  return out;
}

export function validateBackupPayload(payload){
  const errors=[], warnings=[];
  if(!obj(payload)) errors.push('BACKUP_NOT_OBJECT');
  if(obj(payload) && payload.type !== BACKUP_TYPE) errors.push('BACKUP_TYPE_INVALID');
  if(obj(payload) && !obj(payload.state)) errors.push('BACKUP_STATE_MISSING');
  if(obj(payload) && !payload.version) warnings.push('SOURCE_VERSION_MISSING');
  if(obj(payload) && !payload.exportedAt) warnings.push('SOURCE_TIMESTAMP_MISSING');
  if(obj(payload) && payload.users != null && !Array.isArray(payload.users) && !obj(payload.users)) warnings.push('USERS_FORMAT_UNKNOWN');
  return {ok:errors.length===0, errors, warnings};
}

export function inventoryBackup(payload){
  const validation=validateBackupPayload(payload);
  if(!validation.ok) return {validation, inventory:null};
  const state=payload.state;
  const customers=arr(state.customers).map((value,index)=>({sourceCollection:'customers',sourceIndex:index,value}));
  const shipments=shipmentCollections(state);
  const users=Array.isArray(payload.users) ? payload.users.map((value,index)=>({sourceCollection:'users',sourceIndex:index,value})) : (obj(payload.users) ? Object.keys(payload.users).map((key,index)=>({sourceCollection:'users',sourceIndex:index,sourceKey:key,value:payload.users[key]})) : []);
  const shipmentDocs=[];
  shipments.forEach(r=>shipmentDocs.push(...findDocuments(r.value,`${r.sourceCollection}[${r.sourceIndex}]`,'shipment',`${r.sourceCollection}[${r.sourceIndex}]`)));
  const abdDocs=[];
  arr(state.abdRequests).forEach((v,i)=>abdDocs.push(...findDocuments(v,`abdRequests[${i}]`,'abdRequest',`abdRequests[${i}]`)));
  const customerDocs=[];
  customers.forEach(r=>customerDocs.push(...findDocuments(r.value,`customers[${r.sourceIndex}]`,'customer',`customers[${r.sourceIndex}]`)));
  const documents=[...shipmentDocs,...abdDocs,...customerDocs];
  const semanticShipmentGroups=new Map();
  shipments.forEach(r=>{
    const pointer=`${r.sourceCollection}[${r.sourceIndex}]`, key=shipmentIdentity(r.value,pointer);
    if(!semanticShipmentGroups.has(key)) semanticShipmentGroups.set(key,[]);
    semanticShipmentGroups.get(key).push(pointer);
  });
  const semanticCustomerGroups=new Map();
  customers.forEach(r=>{
    const pointer=`customers[${r.sourceIndex}]`, key=customerIdentity(r.value,pointer);
    if(!semanticCustomerGroups.has(key)) semanticCustomerGroups.set(key,[]);
    semanticCustomerGroups.get(key).push(pointer);
  });
  const collectionCounts={};
  Object.keys(state).forEach(k=>{ if(Array.isArray(state[k])) collectionCounts[k]=state[k].length; });
  return {
    validation,
    inventory:{
      source:{type:payload.type,version:q(payload.version),exportedAt:q(payload.exportedAt),exportedBy:q(payload.exportedBy)},
      counts:{
        customers:customers.length,
        shipmentSourceRecords:shipments.length,
        canonicalShipmentGroups:semanticShipmentGroups.size,
        users:users.length,
        documents:documents.length,
        pods:documents.filter(d=>d.kind==='POD').length,
        deliveryNotes:documents.filter(d=>d.kind==='LIEFERSCHEIN').length,
        abdDocuments:documents.filter(d=>d.kind==='ABD').length,
        tasks:arr(state.tasks).length,
        abdRequests:arr(state.abdRequests).length,
        palletBookings:arr(state.palletBookings).length + arr(state.palletAccount).length,
        archiveEntries:arr(state.archive).length
      },
      collectionCounts,
      auditArrays:knownAuditArrays(state),
      duplicateShipmentGroups:[...semanticShipmentGroups.entries()].filter(([,p])=>p.length>1).map(([key,pointers])=>({key,pointers})),
      duplicateCustomerGroups:[...semanticCustomerGroups.entries()].filter(([,p])=>p.length>1).map(([key,pointers])=>({key,pointers})),
      documents,
      shipments,
      customers,
      users
    }
  };
}

export function createNormalizedSkeleton(payload, inventory){
  const tenantId='tenant-legacy-import';
  const migrationMap=[];
  const customers=inventory.customers.map((r,index)=>{
    const pointer=`customers[${r.sourceIndex}]`, c=r.value, id='cust-'+String(index+1).padStart(6,'0');
    migrationMap.push({sourcePointer:pointer,targetType:'customer',targetId:id});
    return {id,tenantId,legacy:{pointer,id:customerIdOf(c),account:customerAccountOf(c)},account:customerAccountOf(c),name:customerNameOf(c),sourcePointer:pointer};
  });
  const shipmentGroupMap=new Map(), shipments=[];
  inventory.shipments.forEach(r=>{
    const pointer=`${r.sourceCollection}[${r.sourceIndex}]`, sh=r.value, key=shipmentIdentity(sh,pointer);
    let target=shipmentGroupMap.get(key);
    if(!target){
      target={id:'ship-'+String(shipments.length+1).padStart(7,'0'),tenantId,reference:refOf(sh),legacyShipmentId:shipmentIdOf(sh),status:q(sh.status||sh.processStatus),sourcePointers:[]};
      shipmentGroupMap.set(key,target); shipments.push(target);
    }
    target.sourcePointers.push(pointer);
    migrationMap.push({sourcePointer:pointer,targetType:'shipment',targetId:target.id,duplicateAlias:target.sourcePointers.length>1});
  });
  const users=inventory.users.map((r,index)=>{
    const pointer=r.sourceKey?`users.${r.sourceKey}`:`users[${r.sourceIndex}]`, u=r.value, id='user-'+String(index+1).padStart(5,'0');
    migrationMap.push({sourcePointer:pointer,targetType:'user',targetId:id});
    return {id,tenantId,name:q(u&& (u.name||u.user||u.username||u.displayName||r.sourceKey)),legacyPointer:pointer};
  });
  const documents=inventory.documents.map((d,index)=>{
    const id='doc-'+String(index+1).padStart(8,'0');
    migrationMap.push({sourcePointer:d.sourcePath,targetType:'document',targetId:id});
    return {id,tenantId,kind:d.kind,name:d.name,mimeType:d.mimeType,size:d.size,ownerType:d.ownerType,ownerPointer:d.ownerPointer,sourcePointer:d.sourcePath,storage:d.inlinePayload?'inline-source':(d.remoteUrl?'remote-source':'metadata-only'),remoteUrl:d.remoteUrl||'',declaredHash:d.declaredHash||''};
  });
  return {
    schemaVersion:'professional-0.1',
    tenant:{id:tenantId,name:'Legacy ExportHUB Import',migrationOnly:true},
    users,customers,shipments,documents,
    tasks:arr(payload.state.tasks).map((x,i)=>({id:'task-'+String(i+1).padStart(7,'0'),tenantId,sourcePointer:`tasks[${i}]`,title:q(x&&x.title),status:q(x&&x.status)})),
    migrationMap
  };
}

function bytesFromDataUrl(payload){
  const raw=q(payload);
  const comma=raw.indexOf(',');
  const body=comma>=0?raw.slice(comma+1):raw;
  if(!body) return new Uint8Array();
  const isB64=comma>=0 ? /;base64/i.test(raw.slice(0,comma)) : /^[A-Za-z0-9+/=\r\n]+$/.test(body);
  if(isB64){
    if(typeof Buffer!=='undefined') return new Uint8Array(Buffer.from(body.replace(/\s+/g,''),'base64'));
    const bin=atob(body.replace(/\s+/g,'')); const out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i); return out;
  }
  return new TextEncoder().encode(decodeURIComponent(body));
}

export async function sha256Hex(input){
  let bytes;
  if(typeof input==='string') bytes=new TextEncoder().encode(input);
  else if(input instanceof Uint8Array) bytes=input;
  else if(input instanceof ArrayBuffer) bytes=new Uint8Array(input);
  else throw new Error('Unsupported hash input');
  if(globalThis.crypto && globalThis.crypto.subtle){
    const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  const {createHash}=await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}

export async function buildMigrationPackage(payload, sourceText){
  const invResult=inventoryBackup(payload);
  if(!invResult.validation.ok) throw new Error('Ungültiges ExportHUB-Backup: '+invResult.validation.errors.join(', '));
  const inv=invResult.inventory;
  const normalized=createNormalizedSkeleton(payload,inv);
  const sourceSha256=await sha256Hex(sourceText ?? JSON.stringify(payload));
  const docVerification=[];
  let inlineCount=0, remoteCount=0, missingCount=0, hashErrors=0;
  for(let i=0;i<inv.documents.length;i++){
    const d=inv.documents[i];
    const rec={sourcePointer:d.sourcePath,name:d.name,kind:d.kind,storage:d.inlinePayload?'inline':(d.remoteUrl?'remote':'metadata-only'),sha256:'',status:''};
    if(d.inlinePayload){
      inlineCount++;
      try{ rec.sha256=await sha256Hex(bytesFromDataUrl(d.inlinePayload)); rec.status='HASHED'; }
      catch(e){ rec.status='HASH_ERROR'; rec.error=q(e&&e.message||e); hashErrors++; }
    }else if(d.remoteUrl){ remoteCount++; rec.status='REMOTE_CAPTURE_REQUIRED'; }
    else{ missingCount++; rec.status='CONTENT_MISSING'; }
    docVerification.push(rec);
  }
  const sourceCoverage=normalized.migrationMap.length;
  const expectedCoverage=inv.customers.length+inv.shipments.length+inv.users.length+inv.documents.length;
  const readOnlyErrors=[];
  if(sourceCoverage!==expectedCoverage) readOnlyErrors.push('SOURCE_MAPPING_INCOMPLETE');
  if(hashErrors) readOnlyErrors.push('INLINE_DOCUMENT_HASH_ERROR');
  const cutoverBlockers=[...readOnlyErrors];
  if(remoteCount) cutoverBlockers.push('REMOTE_DOCUMENTS_REQUIRE_CAPTURE');
  if(missingCount) cutoverBlockers.push('DOCUMENT_CONTENT_MISSING');
  const manifest={
    professionalVersion:PROFESSIONAL_VERSION,
    generatedAt:new Date().toISOString(),
    sourceSha256,
    sourceMetadata:inv.source,
    sourceCounts:inv.counts,
    collectionCounts:inv.collectionCounts,
    mapping:{expected:expectedCoverage,mapped:sourceCoverage,complete:sourceCoverage===expectedCoverage},
    documents:{total:inv.documents.length,inlineHashed:inlineCount,remoteCaptureRequired:remoteCount,contentMissing:missingCount,hashErrors,verification:docVerification},
    duplicates:{shipmentGroups:inv.duplicateShipmentGroups,customerGroups:inv.duplicateCustomerGroups},
    gates:{
      readOnlyReady:readOnlyErrors.length===0,
      readOnlyErrors,
      cutoverReady:cutoverBlockers.length===0,
      cutoverBlockers
    }
  };
  return {
    type:'ExportHUB_Professional_Migration_Package',
    version:PROFESSIONAL_VERSION,
    mode:'READ_ONLY',
    manifest,
    normalized,
    sourceSnapshot:clone(payload)
  };
}

export function summarizePackage(pkg){
  const m=pkg&&pkg.manifest||{}, c=m.sourceCounts||{}, d=m.documents||{}, g=m.gates||{};
  return {
    sourceVersion:q(m.sourceMetadata&&m.sourceMetadata.version),
    customers:Number(c.customers||0),
    shipmentSourceRecords:Number(c.shipmentSourceRecords||0),
    canonicalShipments:Number(c.canonicalShipmentGroups||0),
    pods:Number(c.pods||0),
    documents:Number(c.documents||0),
    users:Number(c.users||0),
    inlineHashed:Number(d.inlineHashed||0),
    remoteCaptureRequired:Number(d.remoteCaptureRequired||0),
    readOnlyReady:!!g.readOnlyReady,
    cutoverReady:!!g.cutoverReady
  };
}

export { BACKUP_TYPE, PROFESSIONAL_VERSION };
