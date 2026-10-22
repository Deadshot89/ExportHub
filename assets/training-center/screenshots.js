(function(g){
'use strict';

const PROCESS_ID='shipment-registration';
const UPDATED_AT='2026-10-15';
const defs=[
  ['shipment-open','shipment-open','Sendungsfunktion öffnen','Navigation zur Sendungsfunktion in ExportHUB360'],
  ['shipment-new','shipment-new','Neue Sendung beginnen','Schaltfläche Neue Sendung'],
  ['shipment-customer','shipment-customer','Kunde auswählen','Kundensuche der neuen Sendung'],
  ['shipment-location','shipment-location','Empfänger / Standort prüfen','Standortauswahl und Empfängerprüfung'],
  ['shipment-reference','shipment-reference','Referenz prüfen','Automatisch erzeugte schreibgeschützte Sendungsreferenz'],
  ['shipment-details','shipment-details','Sendungsdaten erfassen','Grunddaten der Sendung'],
  ['shipment-colli','shipment-colli','Colli erfassen','Colli- und Verpackungsbereich'],
  ['shipment-weight','shipment-weight','Gewicht erfassen','Gewichtsverteilung der Colli'],
  ['shipment-documents','shipment-documents','Dokumente prüfen','Dokumentenbereich der Sendung'],
  ['shipment-delivery-notes','shipment-delivery-notes','Lieferscheine prüfen','Lieferscheinprüfung der Sendung'],
  ['shipment-review','shipment-review','Gesamtprüfung','Gesamtprüfung vor dem Speichern'],
  ['shipment-abd','shipment-abd','ABD-Pflicht prüfen','Entscheidungsbereich zur ABD-Pflicht'],
  ['shipment-customs','shipment-customs','Zollprozess bei Bedarf','Zoll- und ABD-Informationen'],
  ['shipment-save','shipment-save','Sendung speichern','Speichern der geprüften Sendung'],
  ['shipment-status','shipment-status','Status kontrollieren','Statusanzeige nach dem Speichern'],
  ['shipment-pickup-qr','shipment-pickup-qr','QR-/Abholprozess','QR- und Abholbereich der Sendung'],
  ['shipment-completion','shipment-completion','Abschlusskontrolle','Abschlussprüfung der erstellten Sendung']
];
const records=defs.map(([id,stepId,caption,alt])=>Object.freeze({
  id,
  processId:PROCESS_ID,
  stepId,
  src:`/assets/training-center/screenshots/${id}.png`,
  alt,
  caption,
  updatedAt:UPDATED_AT
}));
function clone(value){return JSON.parse(JSON.stringify(value));}
function list(){return clone(records);}
function get(id){const record=records.find(item=>item.id===String(id||''));return record?clone(record):null;}

g.ExportHubTrainingScreenshots=Object.freeze({list,get});
})(globalThis);
