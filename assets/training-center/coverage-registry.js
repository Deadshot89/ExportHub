(function(g){
'use strict';

function entry(id,area,title,standardProcessId,options={}){
  return Object.freeze({
    id,area,title,standardProcessId,
    requiredStepId:options.requiredStepId||'',
    requiredImage:options.requiredImage!==false,
    tourRequired:options.tourRequired===true,
    customerScoped:options.customerScoped===true
  });
}

const entries=Object.freeze([
  entry('system.access','System-Grundlagen','Anmeldung und Zugriff','system-access'),
  entry('system.navigation','System-Grundlagen','Navigation und Suche','system-navigation'),
  entry('admin.users','Benutzer, Firmen und Rechte','Benutzer verwalten','user-management'),
  entry('admin.roles','Benutzer, Firmen und Rechte','Rollen und Rechte verwalten','rights-management'),
  entry('customers.master-data','Kunden und Standorte','Kunden und Standorte verwalten','customer-management',{customerScoped:true}),
  entry('shipments.overview','Sendungen','Sendungsübersicht bearbeiten','shipment-overview',{customerScoped:true}),
  entry('shipments.create','Sendungen','Sendung in ExportHUB360 anmelden','shipment-registration',{customerScoped:true}),
  entry('shipments.stow-plan','Sendungen','Stauplan bearbeiten','stow-plan',{customerScoped:true}),
  entry('shipping.handoff','Versandkosten und Transport','Versand und Transport übergeben','shipping-handoff',{customerScoped:true}),
  entry('documents.manage','Dokumente und Ausgabe','Dokumente verwalten','document-management',{customerScoped:true}),
  entry('documents.output','Dokumente und Ausgabe','Versanddokumente ausgeben','document-output',{customerScoped:true}),
  entry('customs.abd','ABD und Mail','ABD erstellen und bearbeiten','abd-process',{customerScoped:true}),
  entry('customs.mail','ABD und Mail','Export-Mail bearbeiten','export-mail',{customerScoped:true}),
  entry('pickup.qr','QR, POD und Kunden-Avis','QR-Abholung bearbeiten','qr-pickup',{customerScoped:true}),
  entry('pickup.pod','QR, POD und Kunden-Avis','POD bearbeiten','pod-process',{customerScoped:true}),
  entry('pickup.avis','QR, POD und Kunden-Avis','Kunden-Avis bearbeiten','customer-avis',{customerScoped:true}),
  entry('pallets.account','Palettenkonto','Palettenkonto bearbeiten','pallet-account',{customerScoped:true}),
  entry('tasks.manage','Aufgaben, Planer und Abholkalender','Aufgaben verwalten','task-management'),
  entry('pickup.calendar','Aufgaben, Planer und Abholkalender','Abholkalender verwalten','pickup-calendar'),
  entry('sop.manage','SOP und Academy','SOP & Training Center verwalten','training-center-management'),
  entry('academy.exam','SOP und Academy','Training und Lernfortschritt verwalten','training-management'),
  entry('audit.archive','Archiv, Diagnose, Release und App','Archiv und Historie prüfen','archive-history'),
  entry('support.diagnostics','Archiv, Diagnose, Release und App','Diagnose durchführen','diagnostics'),
  entry('release.manage','Archiv, Diagnose, Release und App','Release prüfen','release-management'),
  entry('shipment.abd-decision','ABD und Mail','ABD-Pflicht in der Sendung beurteilen','shipment-registration',{requiredStepId:'shipment-abd',customerScoped:true})
]);

const byId=new Map(entries.map(item=>[item.id,item]));

g.ExportHubTrainingCoverageRegistry=Object.freeze({
  version:'1.0',
  entries,
  get(id){return byId.get(String(id||'').trim())||null;}
});
})(globalThis);
