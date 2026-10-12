(function(root){
'use strict';
if(root.ExportHubSopEditor)return;

function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function text(value){return String(value==null?'':value).trim();}
function nowIso(){return new Date().toISOString();}
function model(){return root.ExportHubIsoSopModel;}
function contract(){return root.ExportHubSopStepContract;}
function visualApi(){return root.ExportHubSopVisuals;}
function versionsOf(doc){return Array.isArray(doc&&doc.versions)?doc.versions:[];}
function versionById(doc,version){const wanted=text(version);return versionsOf(doc).find(item=>text(item&&item.version)===wanted)||null;}
function draftOf(doc,version){
  const wanted=text(version||doc&&doc.draftVersion);
  if(!wanted)throw new Error('Entwurfsfassung fehlt');
  const draft=versionById(doc,wanted);
  if(!draft)throw new Error(`Entwurfsfassung nicht gefunden: ${wanted}`);
  if(text(draft.status)!=='Entwurf')throw new Error(`Nur Entwürfe dürfen bearbeitet werden: ${wanted}`);
  return draft;
}
function normalizeSteps(steps){
  const api=contract();
  return api&&typeof api.normalizeSteps==='function'?api.normalizeSteps(Array.isArray(steps)?steps:[]):clone(Array.isArray(steps)?steps:[]);
}
function stepsOfDraft(draft){
  if(!draft.content||typeof draft.content!=='object')draft.content={};
  draft.content.steps=normalizeSteps(Array.isArray(draft.content.steps)?draft.content.steps:[]);
  return draft.content.steps;
}
function renumber(steps){steps.forEach((step,index)=>{step.order=index+1;});return steps;}
function indexById(steps,stepId){const wanted=text(stepId);return steps.findIndex(step=>text(step&&step.id)===wanted);}
function touch(doc,draft){doc.updatedAt=nowIso();draft.updatedAt=doc.updatedAt;return doc;}
function mutation(document,version,fn){
  const next=clone(document&&typeof document==='object'?document:{});
  const draft=draftOf(next,version);
  fn(next,draft);
  touch(next,draft);
  return next;
}

function createDraft(document,options={}){
  const api=model();
  if(!api||typeof api.createDraftVersion!=='function')throw new Error('SOP-Modell nicht verfügbar');
  const next=api.createDraftVersion(document,options);
  const draft=draftOf(next,options.version||next.draftVersion);
  stepsOfDraft(draft);
  return next;
}

function addStep(document,options={}){
  return mutation(document,options.version,(next,draft)=>{
    const steps=stepsOfDraft(draft);
    const api=contract();
    const raw=options.step&&typeof options.step==='object'?options.step:{};
    const step=api&&typeof api.normalizeStep==='function'?api.normalizeStep(raw,steps.length):clone(raw);
    const id=text(step&&step.id);
    if(!id)throw new Error('Schritt-ID fehlt');
    if(indexById(steps,id)>=0)throw new Error(`Schritt-ID existiert bereits/doppelt: ${id}`);
    const after=text(options.afterStepId);
    let insertAt=steps.length;
    if(after){const anchor=indexById(steps,after);if(anchor<0)throw new Error(`Schritt nicht gefunden: ${after}`);insertAt=anchor+1;}
    steps.splice(insertAt,0,step);
    renumber(steps);
  });
}

function updateStep(document,options={}){
  return mutation(document,options.version,(next,draft)=>{
    const steps=stepsOfDraft(draft);
    const stepId=text(options.stepId);
    const index=indexById(steps,stepId);
    if(index<0)throw new Error(`Schritt nicht gefunden: ${stepId}`);
    const patch=options.patch&&typeof options.patch==='object'?clone(options.patch):{};
    if(patch.id!==undefined&&text(patch.id)!==stepId)throw new Error('Stabile Schritt-ID darf nicht geändert werden');
    const api=contract();
    const merged=Object.assign({},steps[index],patch,{id:stepId,order:index+1});
    steps[index]=api&&typeof api.normalizeStep==='function'?api.normalizeStep(merged,index):merged;
    steps[index].id=stepId;
    renumber(steps);
  });
}

function moveStep(document,options={}){
  return mutation(document,options.version,(next,draft)=>{
    const steps=stepsOfDraft(draft);
    const stepId=text(options.stepId);
    const from=indexById(steps,stepId);
    if(from<0)throw new Error(`Schritt nicht gefunden: ${stepId}`);
    const raw=Number(options.toIndex);
    if(!Number.isInteger(raw))throw new Error('Zielposition fehlt');
    const target=Math.max(0,Math.min(raw,steps.length-1));
    const [step]=steps.splice(from,1);
    steps.splice(target,0,step);
    renumber(steps);
  });
}

function removeStep(document,options={}){
  return mutation(document,options.version,(next,draft)=>{
    const steps=stepsOfDraft(draft);
    const stepId=text(options.stepId);
    const index=indexById(steps,stepId);
    if(index<0)throw new Error(`Schritt nicht gefunden: ${stepId}`);
    steps.splice(index,1);
    renumber(steps);
  });
}

function copyDocument(document,options={}){
  const source=clone(document&&typeof document==='object'?document:{});
  const number=text(options.number);
  const version=text(options.version)||'1.0';
  if(!number)throw new Error('Neue SOP-Nummer fehlt');
  const api=model();
  const current=api&&typeof api.currentVersionRecord==='function'?api.currentVersionRecord(source):versionsOf(source).slice().reverse()[0];
  if(!current)throw new Error('Ausgangsversion fehlt');
  const createdAt=nowIso();
  const draft=clone(current);
  draft.version=version;
  draft.status='Entwurf';
  draft.title=text(options.title)||text(source.title);
  draft.createdBy=text(options.actor);
  draft.createdAt=createdAt;
  draft.changeReason=text(options.reason)||'SOP kopiert';
  draft.reviewedBy='';draft.reviewedAt='';draft.approvedBy='';draft.approvedAt='';draft.archivedBy='';draft.archivedAt='';
  if(!draft.content||typeof draft.content!=='object')draft.content={};
  draft.content.steps=normalizeSteps(Array.isArray(draft.content.steps)?draft.content.steps:[]);
  return Object.assign({},source,{
    id:number,number,title:draft.title,version,currentVersion:version,draftVersion:version,status:'Entwurf',validFrom:'',reviewedBy:'',approvedBy:'',createdBy:text(options.actor),createdAt,updatedAt:createdAt,changeReason:draft.changeReason,
    versions:[draft],
    auditTrail:[{action:'Erstellt',version,actor:text(options.actor),at:createdAt,reason:draft.changeReason}]
  });
}

function createCustomerOverlay(baseDocument,options={}){
  const base=baseDocument&&typeof baseDocument==='object'?baseDocument:{};
  const number=text(options.number),customerId=text(options.customerId),version=text(options.version)||'1.0';
  if(!number)throw new Error('Overlay-SOP-Nummer fehlt');
  if(!customerId)throw new Error('Kunde fehlt');
  if(!text(base.number))throw new Error('Basis-SOP fehlt');
  const at=nowIso();
  const title=text(options.title)||`${text(base.title)||text(base.number)} – Kunde ${customerId}`;
  const reason=text(options.reason)||'Kunden-Overlay erstellt';
  const draft={version,status:'Entwurf',title,content:{overlays:[]},visuals:[],createdBy:text(options.actor),createdAt:at,changeReason:reason,reviewedBy:'',reviewedAt:'',approvedBy:'',approvedAt:''};
  return {
    id:number,number,title,type:'customer',area:text(base.area),customerId,baseProcessSop:text(base.number),version,currentVersion:version,draftVersion:version,status:'Entwurf',createdBy:text(options.actor),createdAt:at,updatedAt:at,changeReason:reason,
    versions:[draft],auditTrail:[{action:'Erstellt',version,actor:text(options.actor),at,reason}]
  };
}

function assignVisual(document,options={}){
  return mutation(document,options.version,(next,draft)=>{
    const steps=stepsOfDraft(draft);
    const stepId=text(options.stepId);
    if(indexById(steps,stepId)<0)throw new Error(`Schritt nicht gefunden: ${stepId}`);
    const api=visualApi();
    const raw=Object.assign({},options.visual&&typeof options.visual==='object'?clone(options.visual):{},{stepId});
    const visual=api&&typeof api.normalize==='function'?api.normalize(raw):raw;
    if(visual.type==='screenshot'&&!text(visual.src))throw new Error('Screenshot-Quelle fehlt');
    draft.visuals=Array.isArray(draft.visuals)?draft.visuals.map(clone):[];
    draft.visuals.push(visual);
  });
}

function validateDraft(document,options={}){
  const next=clone(document&&typeof document==='object'?document:{});
  const draft=draftOf(next,options.version);
  const version=text(draft.version);
  const errors=[];const warnings=[];
  const steps=stepsOfDraft(draft);
  const stepApi=contract();
  if(stepApi&&typeof stepApi.validateSteps==='function'){
    const result=stepApi.validateSteps(steps);
    if(!result.ok)errors.push(...result.errors);
  }
  if(text(next.type)!=='customer'){
    const visualDoc=clone(next);visualDoc.currentVersion=version;visualDoc.version=version;
    const api=visualApi();
    if(api&&typeof api.validateForDocument==='function'){
      const visualResult=api.validateForDocument(visualDoc);
      for(const item of visualResult.errors||[])errors.push(item);
      for(const item of visualResult.warnings||[])warnings.push(item);
    }
  }
  return {ok:errors.length===0,version,errors,warnings};
}

root.ExportHubSopEditor=Object.freeze({createDraft,copyDocument,addStep,moveStep,removeStep,updateStep,createCustomerOverlay,assignVisual,validateDraft});
})(typeof globalThis!=='undefined'?globalThis:this);
