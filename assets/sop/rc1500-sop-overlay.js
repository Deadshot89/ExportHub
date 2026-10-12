(function(root){
'use strict';
if(root.ExportHubSopOverlay)return;

function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function text(value){return String(value==null?'':value).trim();}
function rightsOf(value){const r=value&&typeof value==='object'?value:{};const admin=r.admin===true||r.functionAdmin===true||r.level==='admin';const edit=admin||r.edit===true||r.level==='edit';const read=edit||r.read===true||r.visible===true||r.level==='view';return {read,edit,admin};}
function model(){return root.ExportHubIsoSopModel;}
function normalize(doc){const m=model();return m&&typeof m.normalizeDocument==='function'?m.normalizeDocument(doc):clone(doc);}
function current(doc){const m=model();return m&&typeof m.currentVersionRecord==='function'?m.currentVersionRecord(doc):null;}
function statusOf(doc){const version=current(doc);return text(version&&version.status)||text(doc&&doc.status);}
function operationsOf(doc){
  const version=current(doc);
  const content=version&&version.content&&typeof version.content==='object'?version.content:{};
  if(Array.isArray(content.overlays))return clone(content.overlays);
  if(Array.isArray(content.overlayOps))return clone(content.overlayOps);
  if(Array.isArray(doc&&doc.overlays))return clone(doc.overlays);
  return [];
}
function conflict(code,message,details){return Object.assign({code,message},details||{});}
function byId(steps,id){return steps.findIndex(step=>text(step&&step.id)===text(id));}
function dedupeConcat(left,right){
  const out=Array.isArray(left)?clone(left):[];
  const seen=new Set(out.map(item=>JSON.stringify(item)));
  for(const item of Array.isArray(right)?right:[]){const key=JSON.stringify(item);if(!seen.has(key)){seen.add(key);out.push(clone(item));}}
  return out;
}
function renumber(steps){steps.forEach((step,index)=>{step.order=index+1;});return steps;}

function applyOverlay(base,overlay){
  const contract=root.ExportHubSopStepContract;
  const working=clone(base);
  const baseSnapshot=clone(base);
  const conflicts=[];
  const ops=operationsOf(overlay);
  const customerId=text(overlay&&overlay.customerId);
  const overlayNumber=text(overlay&&overlay.number);
  for(const op of ops){
    const action=text(op&&op.action);
    if(action==='add-step'){
      const raw=op&&op.step;
      const insertionAnchor=text(op&&op.afterStepId);
      const index=insertionAnchor?byId(working.steps,insertionAnchor):working.steps.length-1;
      if(insertionAnchor&&index<0){conflicts.push(conflict('STEP_NOT_FOUND',`Overlay-Zielschritt fehlt: ${insertionAnchor}`,{stepId:insertionAnchor}));break;}
      const normalized=contract&&typeof contract.normalizeStep==='function'?contract.normalizeStep(raw,Math.max(index+1,0)):clone(raw||{});
      if(!text(normalized&&normalized.id)){conflicts.push(conflict('INVALID_ADDED_STEP','Hinzugefügter Schritt hat keine ID'));break;}
      if(byId(working.steps,normalized.id)>=0){conflicts.push(conflict('DUPLICATE_STEP_ID',`Overlay-Step-ID existiert bereits: ${normalized.id}`,{stepId:normalized.id}));break;}
      normalized.origin={type:'customer',customerId,overlayNumber};
      working.steps.splice(index+1,0,normalized);
      renumber(working.steps);
      continue;
    }
    if(action==='skip-step'){
      const stepId=text(op&&op.stepId),index=byId(working.steps,stepId);
      if(index<0){conflicts.push(conflict('STEP_NOT_FOUND',`Overlay-Zielschritt fehlt: ${stepId}`,{stepId}));break;}
      working.steps[index].notRelevant=true;
      working.steps[index].customerNote=text(op&&op.reason);
      working.steps[index].origin={type:'customer',customerId,overlayNumber};
      continue;
    }
    if(action==='enrich-step'){
      const stepId=text(op&&op.stepId),index=byId(working.steps,stepId);
      if(index<0){conflicts.push(conflict('STEP_NOT_FOUND',`Overlay-Zielschritt fehlt: ${stepId}`,{stepId}));break;}
      working.steps[index].warnings=dedupeConcat(working.steps[index].warnings,op&&op.warnings);
      working.steps[index].checks=dedupeConcat(working.steps[index].checks,op&&op.checks);
      working.steps[index].commonErrors=dedupeConcat(working.steps[index].commonErrors,op&&op.commonErrors);
      working.steps[index].troubleshooting=dedupeConcat(working.steps[index].troubleshooting,op&&op.troubleshooting);
      working.steps[index].origin={type:'customer',customerId,overlayNumber};
      continue;
    }
    if(action){conflicts.push(conflict('UNSUPPORTED_DESTRUCTIVE_ACTION',`Nicht unterstützte Overlay-Aktion: ${action}`,{action}));break;}
  }
  return conflicts.length?{ok:false,document:baseSnapshot,conflicts}:{ok:true,document:working,conflicts:[]};
}

function resolve(input){
  const source=input&&typeof input==='object'?input:{};
  const documents=Array.isArray(source.documents)?source.documents:[];
  const baseSopNumber=text(source.baseSopNumber);
  const customerId=text(source.customerId);
  const rights=rightsOf(source.rights);
  const rawBase=documents.find(doc=>text(doc&&doc.number)===baseSopNumber&&text(doc&&doc.type)!=='customer');
  if(!rawBase)return {ok:false,document:null,overlay:null,conflicts:[conflict('BASE_NOT_FOUND',`Basis-SOP nicht gefunden: ${baseSopNumber}`)],preview:false};
  const base=normalize(rawBase);
  const candidates=documents.filter(doc=>text(doc&&doc.type)==='customer'&&text(doc&&doc.customerId)===customerId&&text(doc&&doc.baseProcessSop)===baseSopNumber);
  const released=candidates.filter(doc=>statusOf(doc)==='Freigegeben');
  if(released.length>1)return {ok:false,document:base,overlay:null,conflicts:[conflict('AMBIGUOUS_OVERLAY','Mehrere freigegebene Kunden-Overlays gefunden',{numbers:released.map(doc=>text(doc.number))})],preview:false};
  let selected=released[0]||null;
  let preview=false;
  if(!selected&&rights.edit){
    const drafts=candidates.filter(doc=>statusOf(doc)!=='Freigegeben');
    if(drafts.length>1)return {ok:false,document:base,overlay:null,conflicts:[conflict('AMBIGUOUS_DRAFT_OVERLAY','Mehrere nicht freigegebene Kunden-Overlays gefunden',{numbers:drafts.map(doc=>text(doc.number))})],preview:true};
    selected=drafts[0]||null;
    preview=!!selected;
  }
  if(!selected)return {ok:true,document:base,overlay:null,conflicts:[],preview:false};
  const applied=applyOverlay(base,selected);
  return {ok:applied.ok,document:applied.document,overlay:selected,conflicts:applied.conflicts,preview};
}

root.ExportHubSopOverlay=Object.freeze({resolve});
})(typeof globalThis!=='undefined'?globalThis:this);
