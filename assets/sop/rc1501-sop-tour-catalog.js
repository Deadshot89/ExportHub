(function(root){
'use strict';
if(root.__EXPORTHUB_RC1501_SOP_TOUR_CATALOG__)return;
const catalog=root.ExportHubIsoSopCatalog;
if(!catalog||!Array.isArray(catalog.documents))return;

function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function text(value){return String(value==null?'':value).trim();}
function decorateStep(step){
  const copy=clone(step)||{};
  const instruction=text(copy.text||copy.instruction);
  if(!/ABD-\/Dokumentenbereich öffnen/i.test(instruction))return copy;
  copy.title='ABD-Bereich öffnen';
  copy.instruction='Öffne in der Sendung den ABD-Bereich und prüfe, dass die ABD-Entscheidung sichtbar ist.';
  copy.page='Sendung';
  copy.target={type:'element',stableKey:'shipment-abd-decision',selector:''};
  copy.expectedAction='click';
  copy.checks=[{type:'element-visible',stableKey:'shipment-abd-decision'}];
  copy.expectedResult='Der ABD-Entscheidungsbereich der geöffneten Sendung ist sichtbar.';
  copy.warnings=['Arbeite nur in der richtigen Sendung. Die Tour führt keine produktive Aktion automatisch aus.'];
  copy.commonErrors=['Falsche Sendung geöffnet','ABD-Bereich nicht sichtbar'];
  copy.troubleshooting=['Sendungsansicht erneut öffnen und prüfen, ob die Sendung vollständig geladen wurde.'];
  copy.tour={enabled:true,highlight:true,blockWrongNavigation:false};
  copy.training={enabled:true,sideEffectPolicy:'sandbox'};
  copy.exam={relevant:true,weight:1,allowHint:false};
  return copy;
}
function decorateDocument(doc){
  if(!doc||doc.number!=='SOP-EH-060')return doc;
  const copy=clone(doc);
  const sections=copy.sections&&typeof copy.sections==='object'?copy.sections:{};
  sections.steps=(Array.isArray(sections.steps)?sections.steps:[]).map(decorateStep);
  copy.sections=sections;
  if(Array.isArray(copy.versions))copy.versions=copy.versions.map(version=>{
    const next=clone(version);
    if(text(next&&next.version)===text(copy.currentVersion||copy.version)&&next.content&&typeof next.content==='object'){
      next.content.steps=(Array.isArray(next.content.steps)?next.content.steps:[]).map(decorateStep);
    }
    return next;
  });
  return Object.freeze(copy);
}

const documents=Object.freeze(catalog.documents.map(decorateDocument));
const byNumber={};
for(const doc of documents){
  byNumber[doc.number]=doc;
  for(const alias of Array.isArray(doc.combinedFrom)?doc.combinedFrom:[])byNumber[alias]=doc;
}
root.ExportHubIsoSopCatalog=Object.freeze(Object.assign({},catalog,{
  documents,
  byNumber:Object.freeze(byNumber),
  get(number){return byNumber[text(number)]||null;}
}));
root.__EXPORTHUB_RC1501_SOP_TOUR_CATALOG__=true;
})(typeof globalThis!=='undefined'?globalThis:this);
