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

const extraImagesByNumber=Object.freeze({
  'SOP-EH-020':Object.freeze([
    {file:'rc1018-customers-masterdata-detail.png',stepId:'step-2',caption:'ExportHUB Demo – Kundenauswahl, Stammdaten und Standortdaten'},
    {file:'rc1018-customers-mailcontacts-detail.png',stepId:'step-3',caption:'ExportHUB Demo – Kundenkontakte, Pflicht-CC und Mailprofile'}
  ]),
  'SOP-EH-040':Object.freeze([
    {file:'rc1018-shipping-route-inputs-detail.png',stepId:'step-2',caption:'ExportHUB Demo – Route und Sendungsdaten für die Versandkostenberechnung'},
    {file:'rc1018-shipping-result-detail.png',stepId:'step-3',caption:'ExportHUB Demo – berechnete Versandkosten und Tarifergebnis'}
  ]),
  'SOP-EH-080':Object.freeze([
    {file:'rc1018-pallet-booking-detail.png',stepId:'step-2',caption:'ExportHUB Demo – manueller Paletteneingang und Palettenausgang'},
    {file:'rc1018-pallet-reconciliation-detail.png',stepId:'step-3',caption:'ExportHUB Demo – Palettenbestand, Buchungen und Ausgleich'}
  ]),
  'SOP-EH-100':Object.freeze([
    {file:'rc1018-sop-controlled-document-detail.png',stepId:'step-2',caption:'ExportHUB Demo – gelenkte SOP-Fassung mit Arbeitsablauf und Freigabestatus'},
    {file:'rc1018-sop-editor-detail.png',stepId:'step-3',caption:'ExportHUB Demo – SOP-Erstellung, Bearbeitung und Dokumentsteuerung'}
  ]),
  'SOP-EH-105':Object.freeze([
    {file:'rc1018-academy-overview-detail.png',stepId:'step-2',caption:'ExportHUB Demo – Academy-Übersicht und verfügbare Prüfungen'},
    {file:'rc1018-academy-test-detail.png',stepId:'step-3',caption:'ExportHUB Demo – Prüfungsfrage und Wissensprüfung'}
  ]),
  'SOP-EH-114':Object.freeze([
    {file:'rc1018-release-status-detail.png',stepId:'step-2',caption:'ExportHUB Demo – Release-Status und gemeinsamer Umgebungsstand'},
    {file:'rc1018-release-checklist-detail.png',stepId:'step-3',caption:'ExportHUB Demo – Release-Prüfung, Checkliste und Freigabekontrolle'}
  ])
});

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const text=value=>String(value==null?'':value).trim();
const screenshotVisual=image=>({
  type:'screenshot',
  stepId:text(image.stepId)||'step-1',
  caption:text(image.caption),
  required:true,
  src:`/assets/sop/screenshots/${image.file}`
});
function appendUniqueVisuals(existing,additions){
  const out=Array.isArray(existing)?existing.map(clone):[];
  const seen=new Set(out.filter(Boolean).map(v=>`${text(v.type)}|${text(v.src)}|${text(v.stepId)}`));
  for(const visual of additions){
    const item=clone(visual);
    const key=`${text(item.type)}|${text(item.src)}|${text(item.stepId)}`;
    if(seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}

const documents=Object.freeze(catalog.documents.map(doc=>{
  const additions=[];
  const primary=imageByNumber[doc.number];
  if(primary)additions.push(screenshotVisual(Object.assign({stepId:'step-1'},primary)));
  for(const image of extraImagesByNumber[doc.number]||[])additions.push(screenshotVisual(image));
  if(!additions.length)return doc;

  const visuals=appendUniqueVisuals(doc.visuals,additions);
  const currentVersion=text(doc.currentVersion||doc.version);
  const versions=Array.isArray(doc.versions)?doc.versions.map(version=>{
    const copy=clone(version);
    if(text(copy&&copy.version)!==currentVersion)return copy;
    copy.visuals=appendUniqueVisuals(copy.visuals,additions);
    return Object.freeze(copy);
  }):[];

  return Object.freeze(Object.assign({},doc,{
    visuals:Object.freeze(visuals),
    versions:Object.freeze(versions)
  }));
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
