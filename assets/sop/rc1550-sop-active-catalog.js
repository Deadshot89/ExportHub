(function(root){
'use strict';
if(root.ExportHubSopActiveCatalog)return;

const RELEASED_AT='2026-10-16T12:00:00.000Z';
const PORTAL='https://vendor.bsh-partner.com/su_launch/index.html#Shell-home';

function text(value){return String(value==null?'':value).trim();}
function freezeList(items){return Object.freeze(items.map(item=>item&&typeof item==='object'?Object.freeze(item):item));}

const bshSteps=freezeList([
  {id:'bsh-01-portal',title:'Portal öffnen',instruction:'BSH ONE Communication Platform öffnen. Ausschließlich die Funktion „Transportanmeldungen und Lieferavise“ verwenden.',required:true},
  {id:'bsh-02-start',title:'Transportanmeldung starten',instruction:'Kunden anhand der Stadt auswählen, auf „Start“ und anschließend „Hinzufügen“ klicken. Werknummer merken.',required:true},
  {id:'bsh-03-werk-termin',title:'Werk und Termin erfassen',instruction:'Auf der nächsten Seite den Kunden bzw. die passende Werknummer erneut auswählen. Datum und Uhrzeit eintragen.',required:true},
  {id:'bsh-04-verpackung',title:'Verpackung auswählen',instruction:'Verpackung anhand der Packtischdaten auswählen. WPA bedeutet Einwegpalette und ist immer als nicht stapelbar zu erfassen.',warnings:['WPA bedeutet Einwegpalette und ist immer als nicht stapelbar zu erfassen.'],required:true},
  {id:'bsh-05-referenz',title:'ExportHUB-Referenz hinterlegen',instruction:'Die REF aus ExportHUB360 in das vorgesehene Feld eintragen.',required:true},
  {id:'bsh-06-lieferavis',title:'Lieferavis anlegen',instruction:'„Lieferavise anlegen“ wählen. Alle Lieferscheine mit den zugehörigen Mengen vollständig erfassen.',required:true},
  {id:'bsh-07-sendungsnummer',title:'Sendungsnummer erzeugen',instruction:'Angaben prüfen, sichern und „Erstellen der Sendungsnummer“ wählen. Erfolgsmeldung und Nummer kontrollieren.',expectedResult:'Erfolgsmeldung und Sendungsnummer sind sichtbar und geprüft.',required:true},
  {id:'bsh-08-exporthub-mail',title:'ExportHUB und Kundenmail aktualisieren',instruction:'Die erzeugte Sendungsnummer in der Info der ExportHUB360-Sendung eintragen und in die E-Mail an den Kunden übernehmen. Alle Lieferscheine an den Kunden senden.',required:true}
]);

const bshVisuals=freezeList([
  {type:'screenshot',stepId:'bsh-01-portal',src:'/assets/sop/screenshots/bsh/01-portal-login.png',caption:'01 Portalübersicht'},
  {type:'screenshot',stepId:'bsh-01-portal',src:'/assets/sop/screenshots/bsh/02-kunde-werk.png',caption:'02 Funktion auswählen'},
  {type:'screenshot',stepId:'bsh-02-start',src:'/assets/sop/screenshots/bsh/03-werknummer.png',caption:'03 Kunde / Werk'},
  {type:'screenshot',stepId:'bsh-02-start',src:'/assets/sop/screenshots/bsh/04-datum-uhrzeit.png',caption:'04 Hinzufügen'},
  {type:'screenshot',stepId:'bsh-03-werk-termin',src:'/assets/sop/screenshots/bsh/05-verpackung.png',caption:'05 Werk und Termin'},
  {type:'screenshot',stepId:'bsh-04-verpackung',src:'/assets/sop/screenshots/bsh/06-referenz.png',caption:'06 Verpackungsdaten'},
  {type:'screenshot',stepId:'bsh-05-referenz',src:'/assets/sop/screenshots/bsh/07-lieferavis.png',caption:'07 ExportHUB-Referenz'},
  {type:'screenshot',stepId:'bsh-06-lieferavis',src:'/assets/sop/screenshots/bsh/08-lieferscheine.png',caption:'08 Lieferavis anlegen'},
  {type:'screenshot',stepId:'bsh-06-lieferavis',src:'/assets/sop/screenshots/bsh/09-sendungsnummer.png',caption:'09 Lieferscheine / Mengen'},
  {type:'screenshot',stepId:'bsh-07-sendungsnummer',src:'/assets/sop/screenshots/bsh/10-exporthub-ruecktrag.png',caption:'10 Sendungsnummer erstellen'},
  {type:'screenshot',stepId:'bsh-07-sendungsnummer',src:'/assets/sop/screenshots/bsh/11-kundenmail.png',caption:'11 Erfolgsbestätigung'}
]);

const bshSections=Object.freeze({
  scope:'Transportanmeldung und Lieferavis für die BSH-Gruppe korrekt erfassen.',
  prerequisites:freezeList([
    'Lieferscheine mit vollständigen Angaben kommen direkt vom Packtisch.',
    'Anmeldung möglichst bis 13:00 Uhr, spätestens 13:30 Uhr durchführen.'
  ]),
  steps:bshSteps,
  checksTitle:'Abschlusskontrolle',
  checks:freezeList([
    'Richtige BSH-Werknummer und Anmeldedatum geprüft',
    'Alle Lieferscheine und Mengen vollständig erfasst',
    'WPA bei Verwendung als nicht stapelbar eingetragen',
    'Sendungsnummer erzeugt und in ExportHUB360 dokumentiert',
    'Sendungsnummer und alle Lieferscheine an Kunden übermittelt'
  ]),
  deviations:freezeList([
    'Screenshots zeigen den dokumentierten Stand des BSH-Portals; bei geänderter Oberfläche sind die Eingaben anhand der aktuellen Felder zu prüfen.'
  ]),
  resources:freezeList([PORTAL]),
  portal:'BSH ONE Communication Platform',
  portalUrl:PORTAL
});

const bshVersion=Object.freeze({
  version:'1.0',status:'Freigegeben',title:'Transportanmeldung BSH-Gruppe',content:bshSections,visuals:bshVisuals,
  createdBy:'ExportHUB360',createdAt:RELEASED_AT,changeReason:'Neuerstellung der BSH-Arbeitsanweisung',
  reviewedBy:'ExportHUB360',reviewedAt:RELEASED_AT,approvedBy:'ExportHUB360',approvedAt:RELEASED_AT,validFrom:'2026-10-16'
});

const bsh=Object.freeze({
  id:'SOP-CUST-BSH-001',number:'SOP-CUST-BSH-001',type:'customer',category:'customer',area:'Kunden-SOPs',group:'BSH-Gruppe',
  customerIds:Object.freeze(['BSH','NEFF','GAGGENAU']),keywords:Object.freeze(['BSH','Neff','Gaggenau','Transportanmeldung','Lieferavis','Werknummer','WPA']),
  title:'Transportanmeldung BSH-Gruppe',status:'Freigegeben',version:'1.0',currentVersion:'1.0',draftVersion:'',validFrom:'2026-10-16',
  portal:'BSH ONE Communication Platform',portalUrl:PORTAL,sections:bshSections,visuals:bshVisuals,versions:Object.freeze([bshVersion]),
  auditTrail:Object.freeze([{action:'Freigegeben',version:'1.0',actor:'ExportHUB360',at:RELEASED_AT,reason:'Neuerstellung der BSH-Arbeitsanweisung'}])
});

const documents=Object.freeze([bsh]);
const byNumber=Object.freeze(Object.fromEntries(documents.map(doc=>[doc.number,doc])));
const categories=Object.freeze([
  Object.freeze({id:'customer',label:'Kunden-SOPs',groups:Object.freeze([Object.freeze({id:'bsh',label:'BSH-Gruppe',documents:Object.freeze(['SOP-CUST-BSH-001'])})])}),
  Object.freeze({id:'carrier',label:'Versanddienstleister',groups:Object.freeze([Object.freeze({id:'dhl',label:'DHL',documents:Object.freeze([])})])}),
  Object.freeze({id:'process',label:'Prozess-SOPs',groups:Object.freeze([])})
]);

function search(query){
  const q=text(query).toLowerCase();if(!q)return documents.slice();
  return documents.filter(doc=>{
    const hay=[doc.number,doc.title,doc.category,doc.area,doc.group,doc.carrier].concat(doc.customerIds||[],doc.keywords||[]).map(text).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

const catalog=Object.freeze({version:'RC1550',documents,categories,areas:Object.freeze(categories.map(item=>item.label)),byNumber,get(number){return byNumber[text(number)]||null;},search});
root.ExportHubSopActiveCatalog=catalog;
})(typeof globalThis!=='undefined'?globalThis:this);
