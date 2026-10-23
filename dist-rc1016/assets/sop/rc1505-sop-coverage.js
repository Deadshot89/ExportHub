(function(root){
'use strict';
if(root.ExportHubSopCoverage)return;

const STATUS=Object.freeze({MISSING:'red',INCOMPLETE:'yellow',COMPLETE:'green'});
const SYMBOL=Object.freeze({red:'🔴',yellow:'🟡',green:'🟢'});
const CAPABILITY_SYMBOL=Object.freeze({tour:'🔵',image:'🟣'});

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
  if(version){snapshot.currentVersion=version;snapshot.version=version;}
  snapshot.status='Freigegeben';
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
function screenshotsForStep(document,stepId){
  const api=visuals();
  if(!api||typeof api.visualsForStep!=='function')return [];
  try{return list(api.visualsForStep(document,stepId)).filter(item=>text(item&&item.type)==='screenshot'&&!!text(item&&item.src));}
  catch(_){return [];}
}
function tourStructureValid(step){
  return !!(step&&step.tour&&step.tour.enabled===true&&text(step.expectedAction)&&text(step.target&&step.target.stableKey));
}
function examValid(step){return !!(step&&step.exam&&step.exam.relevant===true);}
function targetStatus(key,options){
  const stableKey=text(key);
  if(!stableKey)return {ok:false,reason:'TARGET_MISSING'};
  if(typeof options.targetResolver==='function'){
    try{
      const custom=options.targetResolver(stableKey);
      if(custom===true||custom&&custom.ok===true)return {ok:true,reason:''};
      const code=text(custom&&custom.error||custom&&custom.reason);
      if(code==='TARGET_AMBIGUOUS'||code==='TARGET_DUPLICATE')return {ok:false,reason:'TARGET_DUPLICATE'};
      if(code==='TARGET_NOT_FOUND'||code==='TARGET_MISSING')return {ok:false,reason:'TARGET_MISSING'};
      return {ok:false,reason:'TARGET_UNAVAILABLE'};
    }catch(_){return {ok:false,reason:'TARGET_UNAVAILABLE'};}
  }
  if(options.scope===undefined||options.scope===null)return {ok:true,reason:'STATIC_METADATA_ONLY'};
  const api=targets();
  if(!api||typeof api.find!=='function')return {ok:false,reason:'TARGET_UNAVAILABLE'};
  let found;
  try{found=api.find(stableKey,options.scope);}catch(_){return {ok:false,reason:'TARGET_UNAVAILABLE'};}
  if(found&&found.ok===true)return {ok:true,reason:''};
  const error=text(found&&found.error);
  if(error==='TARGET_AMBIGUOUS')return {ok:false,reason:'TARGET_DUPLICATE'};
  if(error==='TARGET_NOT_FOUND'||error==='KEY_REQUIRED')return {ok:false,reason:'TARGET_MISSING'};
  return {ok:false,reason:'TARGET_UNAVAILABLE'};
}
function overlayCandidates(documents,entry,customerId){
  const customer=text(customerId),base=text(entry&&entry.sopNumber);
  if(!customer||entry&&entry.customerScoped!==true)return [];
  return list(documents).filter(doc=>text(doc&&doc.type)==='customer'&&text(doc&&doc.customerId)===customer&&text(doc&&doc.baseProcessSop)===base);
}
function overlayInfo(documents,entry,customerId){
  const candidates=overlayCandidates(documents,entry,customerId);
  if(!text(customerId)||entry&&entry.customerScoped!==true)return {present:false,number:'',released:false,invalid:false,candidates:0};
  if(!candidates.length)return {present:false,number:'',released:false,invalid:false,candidates:0};
  const released=candidates.filter(doc=>!!releasedSnapshot(doc));
  if(!released.length)return {present:false,number:'',released:false,invalid:false,candidates:candidates.length};
  const api=overlays();
  if(!api||typeof api.resolve!=='function')return {present:false,number:'',released:true,invalid:true,candidates:candidates.length};
  let result;
  try{result=api.resolve({documents,baseSopNumber:text(entry.sopNumber),customerId:text(customerId),rights:{read:true}});}
  catch(_){return {present:false,number:'',released:true,invalid:true,candidates:candidates.length};}
  if(!result||result.ok===false)return {present:false,number:'',released:true,invalid:true,candidates:candidates.length};
  return {present:!!result.overlay,number:text(result.overlay&&result.overlay.number),released:true,invalid:false,candidates:candidates.length};
}
function rowBase(entry){
  const source=clone(entry&&typeof entry==='object'?entry:{})||{};
  return {
    id:text(source.id),view:text(source.view),action:text(source.action),sopNumber:text(source.sopNumber),stepId:text(source.stepId),targetKey:text(source.targetKey),area:text(source.area),
    required:source.required===true,requiredImage:source.requiredImage===true,requiredTour:source.requiredTour===true,requiredExam:source.requiredExam===true,
    customerScoped:source.customerScoped===true,customerOverlayRequired:source.customerOverlayRequired===true,
    status:'',symbol:'',reasons:[],version:'',
    capabilities:{tour:{present:false,symbol:''},image:{present:false,symbol:''},exam:{present:false}},
    customerOverlay:{present:false,number:'',required:source.customerOverlayRequired===true}
  };
}
function finish(row,status,reasons){row.status=status;row.symbol=SYMBOL[status]||'';row.reasons=unique(reasons);return row;}

function evaluateEntry(entry,options={}){
  const row=rowBase(entry);
  const documents=list(options.documents);
  if(!row.sopNumber)return finish(row,STATUS.MISSING,['SOP_NUMBER_REQUIRED']);
  const raw=processDocument(documents,row.sopNumber);
  if(!raw)return finish(row,STATUS.MISSING,['SOP_MISSING']);
  const released=releasedSnapshot(raw);
  if(!released)return finish(row,STATUS.MISSING,['SOP_NOT_RELEASED']);
  row.version=released.version;
  row.area=text(released.document&&released.document.area||raw&&raw.area||row.area);

  const reasons=[];
  const step=row.stepId?stepOf(released.document,row.stepId):null;
  if(row.stepId&&!step)reasons.push('STEP_MISSING');

  const screenshots=step?screenshotsForStep(released.document,row.stepId):[];
  let imagePresent=screenshots.length>0;
  if(imagePresent&&typeof options.assetExists==='function'){
    imagePresent=screenshots.some(item=>{
      try{return options.assetExists(text(item&&item.src),row)!==false;}catch(_){return false;}
    });
  }
  row.capabilities.image={present:imagePresent,symbol:imagePresent?CAPABILITY_SYMBOL.image:''};
  if(row.requiredImage&&!imagePresent){
    if(screenshots.length&&typeof options.assetExists==='function')reasons.push('IMAGE_FILE_MISSING');
    else reasons.push('IMAGE_MISSING');
  }

  const structureOk=!!step&&tourStructureValid(step);
  let targetOk=false;
  if(structureOk){
    const stepTarget=text(step&&step.target&&step.target.stableKey);
    if(row.targetKey&&stepTarget!==row.targetKey)reasons.push('TARGET_MISMATCH');
    const checked=targetStatus(row.targetKey||stepTarget,options);
    targetOk=checked.ok;
    if(row.requiredTour&&!checked.ok)reasons.push(checked.reason);
  }
  const tourPresent=structureOk&&targetOk&&(!row.targetKey||text(step&&step.target&&step.target.stableKey)===row.targetKey);
  row.capabilities.tour={present:tourPresent,symbol:tourPresent?CAPABILITY_SYMBOL.tour:''};
  if(row.requiredTour&&!structureOk)reasons.push('TOUR_MISSING');

  const examPresent=!!step&&examValid(step);
  row.capabilities.exam={present:examPresent};
  if(row.requiredExam&&!examPresent)reasons.push('EXAM_MISSING');

  const customerId=text(options.customerId);
  const overlay=overlayInfo(documents,entry,customerId);
  row.customerOverlay={present:overlay.present,number:overlay.number,required:row.customerOverlayRequired};
  if(overlay.invalid)reasons.push('CUSTOMER_OVERLAY_INVALID');
  if(row.customerOverlayRequired&&customerId){
    if(!overlay.candidates)reasons.push('CUSTOMER_OVERLAY_MISSING');
    else if(!overlay.released)reasons.push('CUSTOMER_OVERLAY_NOT_RELEASED');
    else if(!overlay.present&&!overlay.invalid)reasons.push('CUSTOMER_OVERLAY_MISSING');
  }

  return finish(row,reasons.length?STATUS.INCOMPLETE:STATUS.COMPLETE,reasons);
}

function scan(options={}){
  const sourceEntries=Array.isArray(options.entries)?options.entries:defaultEntries();
  const documents=Array.isArray(options.documents)?options.documents:stateDocuments();
  const entries=sourceEntries.filter(entry=>entry&&entry.required===true);
  const items=entries.map(entry=>evaluateEntry(entry,{documents,scope:options.scope,targetResolver:options.targetResolver,assetExists:options.assetExists,customerId:options.customerId}));
  const counts={
    total:items.length,
    red:items.filter(item=>item.status===STATUS.MISSING).length,
    yellow:items.filter(item=>item.status===STATUS.INCOMPLETE).length,
    green:items.filter(item=>item.status===STATUS.COMPLETE).length,
    tour:items.filter(item=>item.capabilities.tour.present).length,
    image:items.filter(item=>item.capabilities.image.present).length,
    exam:items.filter(item=>item.capabilities.exam.present).length
  };
  const percentage=counts.total?Math.round((counts.green/counts.total)*100):100;
  return {items,counts,percentage};
}

root.ExportHubSopCoverage=Object.freeze({STATUS,SYMBOL,CAPABILITY_SYMBOL,evaluateEntry,scan});
})(typeof globalThis!=='undefined'?globalThis:this);
