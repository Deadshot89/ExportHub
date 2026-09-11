import fs from 'node:fs';

const path='api/exporthub-state/index.js';
let source=fs.readFileSync(path,'utf8');

const anchor="function usableTeamDocument(value){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&value.state&&typeof value.state==='object'&&!Array.isArray(value.state)&&Array.isArray(value.users))}\n";
const helper=`function usableTeamDocument(value){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&value.state&&typeof value.state==='object'&&!Array.isArray(value.state)&&Array.isArray(value.users))}
function stateSizeDiagnostics(state){
 const root=isObj(state)?state:{},documentFields=new Set(['podFiles','abdFiles','deliveryFiles','deliveryNotesFiles','lieferscheine','documents','generatedDocuments','files','attachments','invoiceFiles','mailAttachments']);
 const sectionBytes=Object.entries(root).map(([key,value])=>{let bytes=0;try{bytes=Buffer.byteLength(JSON.stringify(value))}catch(_){}return {key,bytes,items:Array.isArray(value)?value.length:(isObj(value)?Object.keys(value).length:0)}}).sort((a,b)=>b.bytes-a.bytes).slice(0,20);
 const documentFieldCounts={},seen=new WeakSet();let documentPayloadBytes=0,inlinePayloadCount=0,documentEntries=0;
 const scanFile=(value,depth=0,keyHint='')=>{
  if(value==null||depth>10)return;
  if(typeof value==='string'){
   const s=value,k=lower(keyHint),isData=/^data:[^,]*;base64,/i.test(s),isPayloadKey=/^(data|payload|content|base64|filedata|body)$/i.test(k);
   if(isData||(isPayloadKey&&s.length>1024)){documentPayloadBytes+=Buffer.byteLength(s);inlinePayloadCount++}
   return;
  }
  if(typeof value!=='object')return;if(seen.has(value))return;seen.add(value);
  if(Array.isArray(value)){value.forEach(v=>scanFile(v,depth+1,keyHint));return}
  Object.entries(value).forEach(([k,v])=>scanFile(v,depth+1,k));
 };
 const walk=(value,depth=0)=>{
  if(value==null||depth>12||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return}
  Object.entries(value).forEach(([key,val])=>{
   if(documentFields.has(key)&&Array.isArray(val)){
    documentFieldCounts[key]=(documentFieldCounts[key]||0)+val.length;documentEntries+=val.length;val.forEach(v=>scanFile(v,0,key));return;
   }
   walk(val,depth+1);
  });
 };
 walk(root);
 return {sectionBytes,documentEntries,documentPayloadBytes,inlinePayloadCount,documentFieldCounts};
}
`;
if(!source.includes(anchor))throw new Error('RC1058 Helper-Zielstelle nicht gefunden');
source=source.replace(anchor,helper);

const oldHealth="   context.res=json(200,{ok:true,service:'exporthub-state',version:API_VERSION,storageConfigured:true,storageReachable:true,authBlobReadable:authReadable,teamStateReadable:true,teamStateRecoveredFromHistory:teamCheck.recoveredFromHistory===true,storageSource:connectionSource(),container:TEAM_CONTAINER,environment:c.environment,blob:c.teamBlobName,authBlobBytes:Number(authCheck.bytes||0),teamStateBytes:Number(teamCheck.bytes||0),authReadMs,teamReadMs,totalMs:Date.now()-requestStarted,time:now()});return;";
const newHealth="   context.res=json(200,{ok:true,service:'exporthub-state',version:API_VERSION,storageConfigured:true,storageReachable:true,authBlobReadable:authReadable,teamStateReadable:true,teamStateRecoveredFromHistory:teamCheck.recoveredFromHistory===true,storageSource:connectionSource(),container:TEAM_CONTAINER,environment:c.environment,blob:c.teamBlobName,authBlobBytes:Number(authCheck.bytes||0),teamStateBytes:Number(teamCheck.bytes||0),stateDiagnostics:stateSizeDiagnostics(teamCheck.value&&teamCheck.value.state),authReadMs,teamReadMs,totalMs:Date.now()-requestStarted,time:now()});return;";
if(!source.includes(oldHealth))throw new Error('RC1058 Health-Zielstelle nicht gefunden');
source=source.replace(oldHealth,newHealth);
fs.writeFileSync(path,source);
