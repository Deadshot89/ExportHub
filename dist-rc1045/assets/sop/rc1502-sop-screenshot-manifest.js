(function(root){
'use strict';
if(root.ExportHubSopScreenshotManifest)return;

function text(value){return String(value==null?'':value).trim();}
function freezeEntry(entry){return Object.freeze(Object.assign({required:true,targetKey:'',capture:'viewport'},entry));}

const entries=Object.freeze([
  freezeEntry({
    sopNumber:'SOP-EH-060',
    stepId:'step-1',
    view:'shipment',
    targetKey:'shipment-abd-decision',
    file:'/assets/sop/screenshots/rc1018-abd.png',
    caption:'ExportHUB Demo – ABD-Bereich und Exportprüfung',
    capture:'target-context'
  }),
  freezeEntry({
    sopNumber:'SOP-EH-100',
    stepId:'step-3',
    view:'sop',
    targetKey:'',
    file:'/assets/sop/screenshots/rc1018-sop-editor-detail.png',
    caption:'ExportHUB Demo – SOP-Erstellung, Bearbeitung und Dokumentsteuerung',
    capture:'viewport'
  })
]);

function forStep(sopNumber,stepId){
  const number=text(sopNumber),step=text(stepId);
  return entries.filter(entry=>entry.sopNumber===number&&entry.stepId===step);
}
function forSop(sopNumber){const number=text(sopNumber);return entries.filter(entry=>entry.sopNumber===number);}

root.ExportHubSopScreenshotManifest=Object.freeze({version:'RC1502',sourceEnvironment:'demo',entries,forStep,forSop});
})(typeof globalThis!=='undefined'?globalThis:this);
