(function(root){
'use strict';
if(root.__EXPORTHUB_RC1018_SOP_SYSTEM_IMAGES__)return;
const catalog=root.ExportHubIsoSopCatalog;
if(!catalog||!Array.isArray(catalog.documents))return;
root.__EXPORTHUB_RC1018_SOP_SYSTEM_IMAGES__=true;

const imageByNumber=Object.freeze({
  'SOP-EH-031':{file:'rc1018-shipment-create.png',caption:'ExportHUB Demo – Sendung anlegen: Kunde, Sendungsdaten und Colli'},
  'SOP-EH-034':{file:'rc1018-stowplan.png',caption:'ExportHUB Demo – Stauplan in der Sendung'},
  'SOP-EH-052':{file:'rc1018-documents-cmr.png',caption:'ExportHUB Demo – Dokumente, CMR und Ausgabe'},
  'SOP-EH-060':{file:'rc1018-abd.png',caption:'ExportHUB Demo – ABD-Bereich und Exportprüfung'},
  'SOP-EH-070':{file:'rc1018-qr-pickup.png',caption:'ExportHUB Demo – QR-Abholung in der Sendung'},
  'SOP-EH-076':{file:'rc1018-lieferavis.png',caption:'ExportHUB Demo – Lieferavis in der Sendung'},
  'SOP-EH-080':{file:'rc1018-pallet-account.png',caption:'ExportHUB Demo – Palettenkonto'},
  'SOP-EH-112':{file:'rc1018-diagnostics.png',caption:'ExportHUB Demo – Fehlerdiagnose'},
  'SOP-EH-114':{file:'rc1018-release-center.png',caption:'ExportHUB Demo – Release Center'}
});
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const documents=Object.freeze(catalog.documents.map(doc=>{
  const image=imageByNumber[doc.number];
  if(!image)return doc;
  const visuals=Array.isArray(doc.visuals)?doc.visuals.map(clone):[];
  const src=`/assets/sop/screenshots/${image.file}`;
  if(!visuals.some(v=>v&&v.type==='screenshot'&&v.src===src))visuals.push({type:'screenshot',stepId:'step-1',caption:image.caption,required:true,src});
  return Object.freeze(Object.assign({},doc,{visuals:Object.freeze(visuals)}));
}));
const byNumber={};
for(const doc of documents){
  byNumber[doc.number]=doc;
  for(const code of Array.isArray(doc.combinedFrom)?doc.combinedFrom:[])byNumber[code]=doc;
}
root.ExportHubIsoSopCatalog=Object.freeze(Object.assign({},catalog,{
  documents,
  byNumber:Object.freeze(byNumber),
  sopImageRelease:'RC1018',
  get(number){return byNumber[String(number==null?'':number).trim()]||null;}
}));
})(typeof globalThis!=='undefined'?globalThis:this);
