(function(g){
'use strict';

const DEMO_CUSTOMER=Object.freeze({id:'DEMO-CUST-001',name:'Demo Kunde GmbH',demo:true});
const DEMO_LOCATION=Object.freeze({id:'DEMO-LOC-001',customerId:'DEMO-CUST-001',name:'Demo Empfänger',city:'Berlin',country:'DE',demo:true});
const DEMO_COLLI=Object.freeze({id:'DEMO-COLLI-001',type:'Paket',quantity:1,demo:true});
const DEMO_WEIGHT=Object.freeze({value:12.5,unit:'kg',demo:true});
const DEMO_CUSTOMS=Object.freeze({demo:true,destinationCountry:'CH',goodsValue:1250,currency:'EUR',hsCode:'39269097',originCountry:'DE'});

function snapshot(){
  const state=g.ExportHubTrainingState;
  return state&&typeof state.snapshot==='function'?state.snapshot():null;
}
function number(value){const parsed=Number(String(value??'').replace(',','.'));return Number.isFinite(parsed)?parsed:NaN;}

const validators=Object.freeze({
  'shipment-new-opened':({descriptor})=>descriptor?.eventType==='click'||descriptor?.valid===true,
  'demo-customer-selected':({descriptor})=>String(descriptor?.value||'')===DEMO_CUSTOMER.id,
  'demo-location-selected':({descriptor})=>String(descriptor?.value||'')===DEMO_LOCATION.id,
  'shipment-details-valid':({descriptor})=>String(descriptor?.value||'').trim().length>=3,
  'colli-valid':({descriptor})=>number(descriptor?.value)>0,
  'weight-valid':({descriptor})=>number(descriptor?.value)>0,
  'documents-reviewed':()=>{const state=snapshot();return Array.isArray(state?.documents)&&state.documents.length>=2;},
  'missing-document-detected':()=>{const state=snapshot();return Array.isArray(state?.documents)&&state.documents.filter(doc=>doc?.status==='missing').length===1;},
  'shipment-review-complete':()=>{const state=snapshot();return state?.documentReview?.reviewed===true&&state.documentReview?.missingDetected===true;},
  'abd-decision-correct':({descriptor})=>String(descriptor?.value||'')==='required'&&DEMO_CUSTOMS.destinationCountry==='CH'&&DEMO_CUSTOMS.goodsValue>1000,
  'customs-info-reviewed':()=>Boolean(DEMO_CUSTOMS.demo&&DEMO_CUSTOMS.hsCode&&DEMO_CUSTOMS.originCountry&&DEMO_CUSTOMS.goodsValue>0),
  'shipment-demo-saved':()=>{const state=snapshot();return state?.shipmentReview?.complete===true&&state?.customsReview?.checked===true;},
  'result-reviewed':()=>snapshot()?.shipment?.saved===true
});

function step(stepId,title,targetElement,expectedAction,validation,helpText,successText,demoOperation,demoPayload){
  return {stepId,title,targetElement,expectedAction,validation:[validation],helpText,successText,demoOperation:demoOperation||null,demoPayload:demoPayload===undefined?null:demoPayload};
}

const steps=[
  step('first-shipment-new','Neue Sendung öffnen','shipment.new','click','shipment-new-opened','Öffne die Funktion „Neue Sendung“. Die Tour arbeitet ausschließlich mit Beispieldaten.','Die neue Demo-Sendung ist geöffnet.'),
  step('first-shipment-customer','Demo-Kunden auswählen','shipment.customer-search','select','demo-customer-selected','Wähle „Demo Kunde GmbH“. Echte Kunden werden in dieser Schulung nicht verwendet.','Der Demo-Kunde ist ausgewählt.','customer.select',DEMO_CUSTOMER),
  step('first-shipment-location','Empfänger prüfen','shipment.location','select','demo-location-selected','Wähle den vorgegebenen Demo-Empfänger und kontrolliere die Zuordnung zum Demo-Kunden.','Der Demo-Empfänger ist geprüft.','location.select',DEMO_LOCATION),
  step('first-shipment-details','Sendungsdaten erfassen','shipment.details','input','shipment-details-valid','Trage eine kurze Bezeichnung für die Demo-Sendung ein.','Die Sendungsdaten sind erfasst.','shipment.details',{id:'DEMO-SHIP-001',description:'Demo Expresssendung',status:'Entwurf',saved:false,demo:true}),
  step('first-shipment-colli','Colli erfassen','shipment.colli','input','colli-valid','Erfasse mindestens ein Colli. Für das Training ist ein Demo-Paket vorgesehen.','Das Colli ist erfasst.','colli.update',DEMO_COLLI),
  step('first-shipment-weight','Gewicht erfassen','shipment.weight','input','weight-valid','Erfasse ein positives Gesamtgewicht für die Demo-Sendung.','Das Gewicht ist erfasst.','weight.update',DEMO_WEIGHT),
  step('first-shipment-documents','Dokumente kontrollieren','shipment.documents','confirm','documents-reviewed','Prüfe die vorhandenen Demo-Dokumente vollständig. Eines davon ist absichtlich als fehlend markiert.','Die Dokumentenprüfung ist durchgeführt.','document.review',{reviewed:true,missingDetected:false}),
  step('first-shipment-missing-document','Fehlendes Dokument erkennen','shipment.documents','confirm','missing-document-detected','Erkenne das absichtlich fehlende Rechnungsdokument. Die Sendung darf im Training trotzdem weiter analysiert werden.','Das fehlende Dokument wurde erkannt.','document.review',{reviewed:true,missingDetected:true,missingDocumentId:'DEMO-DOC-003'}),
  step('first-shipment-review','Sendungsprüfung durchführen','shipment.review','confirm','shipment-review-complete','Führe die Gesamtprüfung durch und beachte den dokumentierten Demo-Hinweis.','Die Sendungsprüfung ist abgeschlossen.','shipment.review',{complete:true,blockingIssue:'DEMO-DOC-003',demo:true}),
  step('first-shipment-abd','Zoll-/ABD-Pflicht beurteilen','shipment.abd-decision','decision','abd-decision-correct','Beurteile die Demo-Sendung: Ziel Schweiz und Warenwert 1.250 EUR. Wähle „ABD erforderlich“.','Die ABD-Entscheidung ist korrekt.','abd.decision',{required:true,reason:'Demo: Nicht-EU-Ziel und Warenwert über 1.000 EUR',demo:true}),
  step('first-shipment-customs','Beispiel-Zollinformationen prüfen','shipment.customs','confirm','customs-info-reviewed','Prüfe die vorgegebenen Demo-Zollinformationen: Ziel, Warenwert, HS-Code und Herkunftsland.','Die Demo-Zollinformationen sind geprüft.','customs.review',{checked:true,demo:true}),
  step('first-shipment-save','Sendung fertigstellen','shipment.save','save-demo','shipment-demo-saved','Speichere die Sendung im Trainingsmodus. Der Schreibschutz verhindert jeden produktiven Speichervorgang.','Die Demo-Sendung ist ausschließlich im Arbeitsspeicher gespeichert.','shipment.save',{id:'DEMO-SHIP-001',saved:true,status:'Erstellt',demo:true}),
  step('first-shipment-result','Ergebnis kontrollieren','shipment.status','confirm','result-reviewed','Kontrolliere den Trainingsstatus „Erstellt“ und schließe die Übung ab.','Die erste Demo-Sendung wurde erfolgreich abgeschlossen.','shipment.complete',{reviewed:true,status:'Erstellt',demo:true})
].map((item,index,array)=>Object.freeze({...item,order:index+1,nextStep:index<array.length-1?array[index+1].stepId:null}));

const demoSeed=Object.freeze({
  __trainingDemo:true,
  scenarioId:'first-shipment',
  customer:{...DEMO_CUSTOMER},
  location:{...DEMO_LOCATION},
  shipment:{id:'DEMO-SHIP-001',reference:'DEMO01',status:'Entwurf',description:'',saved:false,demo:true},
  colli:[{...DEMO_COLLI}],
  weight:{...DEMO_WEIGHT},
  documents:[
    {id:'DEMO-DOC-001',type:'Lieferschein',name:'DEMO-LS-001.pdf',status:'available',demo:true},
    {id:'DEMO-DOC-002',type:'Packliste',name:'DEMO-PACK-001.pdf',status:'available',demo:true},
    {id:'DEMO-DOC-003',type:'Rechnung',name:'DEMO-INVOICE-001.pdf',status:'missing',demo:true}
  ],
  customs:{...DEMO_CUSTOMS},
  abdDecision:{required:true,reason:'Demo: Nicht-EU-Ziel und Warenwert über 1.000 EUR',demo:true},
  documentReview:{reviewed:false,missingDetected:false},
  shipmentReview:{complete:false},
  customsReview:{checked:false,demo:true}
});

g.ExportHubTrainingScenarioFirstShipment=Object.freeze({
  id:'first-shipment',
  title:'Meine erste Sendung',
  processId:'shipment-registration',
  version:'1.0',
  categoryId:'training',
  demoOnly:true,
  completionPolicy:'all-steps',
  demoSeed,
  validators,
  steps:Object.freeze(steps)
});
})(globalThis);
