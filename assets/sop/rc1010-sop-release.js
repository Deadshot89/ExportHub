(function(root){
'use strict';

const RELEASE_DATE='2026-09-08';
const RELEASED_AT='2026-09-08T16:05:00.000Z';
const NEXT_REVIEW='2027-09-08';
const REVIEWER='ExportHUB Qualitätsprüfung RC1010';
const APPROVER='ExportHUB Freigabe RC1010';
let installAttempts=0;

function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function text(value){return String(value==null?'':value).trim();}
function versionsOf(doc){return Array.isArray(doc&&doc.versions)?doc.versions:[];}
function releaseHistory(source){
  const base=Array.isArray(source&&source.history)?clone(source.history):[];
  const filtered=base.filter(item=>!(item&&item.version==='1.0'&&String(item.change||'').includes('RC1010')));
  filtered.push({version:'1.0',date:RELEASE_DATE,status:'Freigegeben',change:'RC1010 – Erstfreigabe des vollständigen ExportHUB-System-SOP-Katalogs'});
  return filtered;
}
function releaseDocument(source){
  const doc=clone(source||{});const history=releaseHistory(doc);const sections=clone(doc.sections||{});sections.changeHistory=clone(history);
  const createdBy=text(doc.createdBy)||'ExportHUB – RC1008 SOP-Ersterstellung';const createdAt='2026-09-08T12:00:00.000Z';
  const version={version:'1.0',status:'Freigegeben',title:text(doc.title),content:clone(sections),visuals:clone(doc.visuals||[]),createdBy,createdAt,changeReason:text(doc.changeReason)||'RC1008 – Umstellung auf reine ExportHUB-Systemprozesse',submittedBy:REVIEWER,submittedAt:RELEASED_AT,reviewedBy:REVIEWER,reviewedAt:RELEASED_AT,approvedBy:APPROVER,approvedAt:RELEASED_AT,validFrom:RELEASE_DATE};
  Object.assign(doc,{version:'1.0',status:'Freigegeben',validFrom:RELEASE_DATE,reviewedBy:REVIEWER,approvedBy:APPROVER,nextReview:NEXT_REVIEW,currentVersion:'1.0',draftVersion:'',updatedAt:RELEASED_AT,sections,history,versions:[version],auditTrail:[{action:'Erstellt',version:'1.0',actor:createdBy,at:createdAt,reason:text(doc.changeReason)||'Ersterstellung'},{action:'Zur Prüfung eingereicht',version:'1.0',actor:REVIEWER,at:RELEASED_AT,reason:'RC1010 Qualitätsprüfung'},{action:'Freigegeben',version:'1.0',actor:APPROVER,at:RELEASED_AT,reason:'RC1010 Erstfreigabe'}]});
  return Object.freeze(doc);
}
function install(){
  if(root.__EXPORTHUB_RC1010_SOP_RELEASE_INSTALLED__)return true;
  const catalog=root.ExportHubIsoSopCatalog;const model=root.ExportHubIsoSopModel;
  if(!catalog||!model||!Array.isArray(catalog.documents)){
    installAttempts+=1;
    if(installAttempts<40&&typeof root.setTimeout==='function')root.setTimeout(install,25);
    return false;
  }
  const releasedDocuments=Object.freeze(catalog.documents.map(releaseDocument));
  const releasedByNumber=Object.freeze(Object.fromEntries(releasedDocuments.map(doc=>[doc.number,doc])));
  root.ExportHubIsoSopCatalog=Object.freeze(Object.assign({},catalog,{version:'RC1010',documents:releasedDocuments,byNumber:releasedByNumber,get(number){return releasedByNumber[text(number)]||null;}}));
  function isPureRc1008SystemDraft(doc){
    if(!doc||!/^SOP-EH-\d{3}$/.test(text(doc.number)))return false;
    if(text(doc.status)!=='Entwurf'||text(doc.approvedBy)||text(doc.reviewedBy))return false;
    const versions=versionsOf(doc);if(versions.length>1)return false;const version=versions[0]||{};
    if(versions.length===1&&(text(version.version)!=='1.0'||text(version.status)!=='Entwurf'))return false;
    const provenance=[doc.createdBy,doc.changeReason,version.createdBy,version.changeReason].map(text).join(' ');
    if(!/ExportHUB/i.test(provenance)||!/RC1008|SOP-Ersterstellung/i.test(provenance))return false;
    const audit=Array.isArray(doc.auditTrail)?doc.auditTrail:[];if(audit.some(item=>text(item&&item.action)!=='Erstellt'))return false;
    return true;
  }
  const originalReconcile=model.reconcileCatalog.bind(model);
  function reconcileCatalog(storedDocuments,canonicalDocuments){
    const stored=Array.isArray(storedDocuments)?storedDocuments:[];
    const canonical=Array.isArray(canonicalDocuments)&&canonicalDocuments.length?canonicalDocuments:releasedDocuments;
    const hadLegacy=stored.some(isPureRc1008SystemDraft);const safeStored=hadLegacy?stored.filter(doc=>!isPureRc1008SystemDraft(doc)):stored;
    const reconciled=originalReconcile(safeStored,canonical);
    if(hadLegacy&&Array.isArray(storedDocuments)&&!Object.isFrozen(storedDocuments))storedDocuments.splice(0,storedDocuments.length,...reconciled);
    return reconciled;
  }
  root.ExportHubIsoSopModel=Object.freeze(Object.assign({},model,{reconcileCatalog,isPureRc1008SystemDraft}));
  root.__EXPORTHUB_RC1010_SOP_RELEASE_INSTALLED__=true;
  return true;
}
install();
})(typeof globalThis!=='undefined'?globalThis:this);
