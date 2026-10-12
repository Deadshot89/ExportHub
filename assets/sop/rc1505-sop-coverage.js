(function(root){
'use strict';
if(root.ExportHubSopCoverage)return;

const STATUS=Object.freeze({
  MISSING:'MISSING',
  INCOMPLETE:'INCOMPLETE',
  COVERED:'COVERED',
  CUSTOMER_OVERLAY:'CUSTOMER_OVERLAY',
  NO_SOP_NEEDED:'NO_SOP_NEEDED'
});
const SYMBOL=Object.freeze({
  [STATUS.MISSING]:'🔴',
  [STATUS.INCOMPLETE]:'🟡',
  [STATUS.COVERED]:'🟢',
  [STATUS.CUSTOMER_OVERLAY]:'🔵',
  [STATUS.NO_SOP_NEEDED]:'🟣'
});

function text(value){return String(value==null?'':value).trim();}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function list(value){return Array.isArray(value)?value:[];}
function unique(values){return Array.from(new Set(list(values).filter(Boolean)));}
function model(){return root.ExportHubIsoSopModel;}
function visuals(){return root.ExportHubSopVisuals;}
function targets(){return root.ExportHubSopTourTargets;}
function overlays(){return root.ExportHubSopOverlay;}

function defaultEntries(){
  const registry=root.ExportHubSopFunctionRegistry;
  if(registry&&typeof registry.all==='function')return registry.all();
  return list(registry&&registry.entries).map(clone);
}
function stateDocuments(){
  try{
    const state=typeof root.__EXPORTHUB_GET_STATE__==='function'?(root.__EXPORTHUB_GET_STATE__()||{}):{};
    if(Array.isArray(state.isoSops)&&state.isoSops.length)return state.isoSops;
  }catch(_){}
  const catalog=root.ExportHubIsoSopCatalog;
  return list(catalog&&catalog.documents);
}
function currentVersionRecord(document){
  const api=model();
  if(api&&typeof api.currentVersionRecord==='function')return api.currentVersionRecord(document);
  const versions=list(document&&document.versions);
  const wanted=text(document&&document.currentVersion||document&&document.version);
  return versions.find(item=>text(item&&item.version)===wanted)||versions.slice().reverse().find(Boolean)||null;
}
function releasedSnapshot(document){
  if(!document||typeof document!=='object')return null;
  const current=currentVersionRecord(document);
  const status=text(current&&current.status||document.status);
  if(status!=='Freigegeben')return null;
  const version=text(current&&current.version||document.currentVersion||document.version);
  const snapshot=clone(document)||{};
  if(version)snapshot.currentVersion=version;
  if(current){
    snapshot.version=version;
    snapshot.status='Freigegeben';
  }
  return {document:snapshot,version,record:clone(current)};
}
function processDocument(documents,sopNumber){
  const wanted=text(sopNumber);
  return list(documents).find(doc=>text(doc&&doc.number)===wanted&&text(doc&&doc.type)!=='customer')||null;
}
function normalizedDocument(document){
  const api=model();
  if(api&&typeof api.normalizeDocument==='function'){
    try{return api.normalizeDocument(document);}catch(_){}
  }
  return clone(document)||{};
}
function stepOf(document,stepId){
  const wanted=text(stepId);
  const normalized=normalizedDocument(document);
  return list(normalized&&normalized.steps).find(step=>text(step&&step.id)===wanted)||null;
}
function hasValidImage(document,stepId){
  const api=visuals();
  if(!api||typeof api.visualsForStep!=='function')return false;
  let items=[];
  try{items=api.visualsForStep(document,stepId);}catch(_){return false;}
  return list(items).some(item=>text(item&&item.type)==='screenshot'&&!!text(item&&item.src));
}
function tourValid(step){
  if(!step||typeof step!=='object')return false;
  return !!(step.tour&&step.tour.enabled===true&&text(step.expectedAction)&&text(step.target&&step.target.stableKey));
}
function examValid(step){
  return !!(step&&step.exam&&step.exam.relevant===true);
}
function targetStatus(key,scope){
  const stableKey=text(key);
  if(!stableKey)return {ok:false,reason:'TARGET_MISSING'};
  const api=targets();
  if(!api||typeof api.find!=='function')return {ok:false,reason:'TARGET_UNAVAILABLE'};
  let found;
  try{found=api.find(stableKey,scope||(root&&root.document));}catch(_){return {ok:false,reason:'TARGET_UNAVAILABLE'};}
  if(found&&found.ok===true)return {ok:true,reason:''};
  const error=text(found&&found.error);
  if(error==='TARGET_AMBIGUOUS')return {ok:false,reason:'TARGET_DUPLICATE'};
  if(error==='TARGET_NOT_FOUND'||error==='KEY_REQUIRED')return {ok:false,reason:'TARGET_MISSING'};
  return {ok:false,reason:'TARGET_UNAVAILABLE'};
}
function overlayCandidate(documents,entry,customerId){
  const customer=text(customerId),base=text(entry&&entry.sopNumber);
  if(!customer||entry&&entry.customerScoped!==true)return [];
  return list(documents).filter(doc=>text(doc&&doc.type)==='customer'&&text(doc&&doc.customerId)===customer&&text(doc&&doc.baseProcessSop)===base);
}
function overlayResult(documents,entry,customerId){
  const candidates=overlayCandidate(documents,entry,customerId);
  if(!candidates.length)return {active:false,invalid:false,overlay:null};
  const api=overlays();
  if(!api||typeof api.resolve!=='function')return {active:false,invalid:true,overlay:null};
  let result;
  try{
    result=api.resolve({documents,baseSopNumber:text(entry.sopNumber),customerId:text(customerId),rights:{read:true}});
  }catch(_){return {active:false,invalid:true,overlay:null};}
  if(!result||result.ok===false)return {active:false,invalid:true,overlay:null};
  return {active:!!result.overlay,invalid:false,overlay:result.overlay||null};
}
function rowBase(entry){
  const source=clone(entry&&typeof entry==='object'?entry:{})||{};
  return {
    id:text(source.id),
    view:text(source.view),
    action:text(source.action),
    sopNumber:text(source.sopNumber),
    stepId:text(source.stepId),
    targetKey:text(source.targetKey),
    required:source.required===true,
    requiredImage:source.requiredImage===true,
    requiredTour:source.requiredTour===true,
    requiredExam:source.requiredExam===true,
    customerScoped:source.customerScoped===true,
    coveragePolicy:text(source.coveragePolicy),
    statusCode:'',
    symbol:'',
    reasons:[],
    version:'',
    customerId:'',
    overlayNumber:''
  };
}
function finish(row,status,reasons){
  row.statusCode=status;
  row.symbol=SYMBOL[status]||'';
  row.reasons=unique(reasons);
  return row;
}

function evaluateEntry(entry,options={}){
  const row=rowBase(entry);
  const documents=list(options.documents);
  const customerId=text(options.customerId);
  row.customerId=customerId;

  if(row.coveragePolicy==='no-sop-needed')return finish(row,STATUS.NO_SOP_NEEDED,['NO_SOP_NEEDED']);
  if(!row.sopNumber)return finish(row,STATUS.MISSING,['SOP_NUMBER_REQUIRED']);

  const raw=processDocument(documents,row.sopNumber);
  if(!raw)return finish(row,STATUS.MISSING,['SOP_MISSING']);
  const released=releasedSnapshot(raw);
  if(!released)return finish(row,STATUS.MISSING,['SOP_NOT_RELEASED']);
  row.version=released.version;

  const reasons=[];
  const step=row.stepId?stepOf(released.document,row.stepId):null;
  if(row.stepId&&!step)reasons.push('STEP_MISSING');

  if(row.requiredImage&&(!step||!hasValidImage(released.document,row.stepId)))reasons.push('IMAGE_MISSING');
  if(row.requiredTour&&(!step||!tourValid(step)))reasons.push('TOUR_MISSING');
  if(row.requiredExam&&(!step||!examValid(step)))reasons.push('EXAM_MISSING');

  const expectedTarget=row.targetKey||text(step&&step.target&&step.target.stableKey);
  if((row.targetKey||row.requiredTour)&&step){
    if(row.targetKey&&text(step&&step.target&&step.target.stableKey)!==row.targetKey)reasons.push('TARGET_MISMATCH');
    const status=targetStatus(expectedTarget,options.scope);
    if(!status.ok)reasons.push(status.reason);
  }

  const customerOverlay=overlayResult(documents,entry,customerId);
  if(customerOverlay.invalid)reasons.push('CUSTOMER_OVERLAY_INVALID');
  if(reasons.length)return finish(row,STATUS.INCOMPLETE,reasons);
  if(customerOverlay.active){
    row.overlayNumber=text(customerOverlay.overlay&&customerOverlay.overlay.number);
    return finish(row,STATUS.CUSTOMER_OVERLAY,['CUSTOMER_OVERLAY_ACTIVE']);
  }
  return finish(row,STATUS.COVERED,[]);
}

function scan(options={}){
  const entries=Array.isArray(options.entries)?options.entries:defaultEntries();
  const documents=Array.isArray(options.documents)?options.documents:stateDocuments();
  return entries.map(entry=>evaluateEntry(entry,{documents,scope:options.scope,customerId:options.customerId}));
}

root.ExportHubSopCoverage=Object.freeze({STATUS,SYMBOL,evaluateEntry,scan});
})(typeof globalThis!=='undefined'?globalThis:this);
