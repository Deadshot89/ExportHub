(function(root){
'use strict';
if(root.__EXPORTHUB_RC1018_SOP_SYSTEM_IMAGES__)return;
const catalog=root.ExportHubIsoSopCatalog;
if(!catalog||!Array.isArray(catalog.documents))return;
root.__EXPORTHUB_RC1018_SOP_SYSTEM_IMAGES__=true;

const imageByNumber=Object.freeze({
  'SOP-EH-001':{file:'rc1018-start-company-session.png',caption:'ExportHUB Demo – Start, Firmenkontext und Sitzung'},
  'SOP-EH-002':{file:'rc1018-dashboard-navigation.png',caption:'ExportHUB Demo – Dashboard und Navigation'},
  'SOP-EH-010':{file:'rc1018-users.png',caption:'ExportHUB Demo – Benutzerverwaltung'},
  'SOP-EH-012':{file:'rc1018-rights.png',caption:'ExportHUB Demo – Rollen und Rechte'},
  'SOP-EH-020':{file:'rc1018-customers.png',caption:'ExportHUB Demo – Kunden und Standorte'},
  'SOP-EH-031':{file:'rc1018-shipment-create.png',caption:'ExportHUB Demo – Sendung anlegen: Kunde, Sendungsdaten und Colli'},
  'SOP-EH-034':{file:'rc1018-stowplan.png',caption:'ExportHUB Demo – Stauplan in der Sendung'},
  'SOP-EH-040':{file:'rc1018-shipping-route.png',caption:'ExportHUB Demo – Versandkosten, Route und Transport'},
  'SOP-EH-050':{file:'rc1018-document-upload.png',caption:'ExportHUB Demo – Dokumente hochladen und prüfen'},
  'SOP-EH-052':{file:'rc1018-documents-cmr.png',caption:'ExportHUB Demo – Dokumente, CMR und Ausgabe'},
  'SOP-EH-060':{file:'rc1018-abd.png',caption:'ExportHUB Demo – ABD-Bereich und Exportprüfung'},
  'SOP-EH-063':{file:'rc1018-mail.png',caption:'ExportHUB Demo – Mail vorbereiten und versenden'},
  'SOP-EH-070':{file:'rc1018-qr-pickup.png',caption:'ExportHUB Demo – QR-Abholung in der Sendung'},
  'SOP-EH-075':{file:'rc1018-pod.png',caption:'ExportHUB Demo – POD-Aufgabe und Nachweis'},
  'SOP-EH-076':{file:'rc1018-lieferavis.png',caption:'ExportHUB Demo – Lieferavis in der Sendung'},
  'SOP-EH-080':{file:'rc1018-pallet-account.png',caption:'ExportHUB Demo – Palettenkonto'},
  'SOP-EH-100':{file:'rc1018-sop-handbook.png',caption:'ExportHUB Demo – SOP-Handbuch und gelenkte Fassungen'},
  'SOP-EH-105':{file:'rc1018-academy.png',caption:'ExportHUB Demo – Academy und Prüfungen'},
  'SOP-EH-110':{file:'rc1018-archive-audit.png',caption:'ExportHUB Demo – Archiv, Historie und Audit-Nachweise'},
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
