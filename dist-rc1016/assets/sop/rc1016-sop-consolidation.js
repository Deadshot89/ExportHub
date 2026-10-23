(function(root){
'use strict';
if(root.__EXPORTHUB_RC1016_SOP_CONSOLIDATION__)return;
const catalog=root.ExportHubIsoSopCatalog;
if(!catalog||!Array.isArray(catalog.documents))return;
root.__EXPORTHUB_RC1016_SOP_CONSOLIDATION__=true;

const RELEASE_DATE='2026-09-09';
const RELEASED_AT='2026-09-09T12:35:00.000Z';
const NEXT_REVIEW='2027-09-09';
const REVIEWER='ExportHUB Qualitätsprüfung RC1016';
const APPROVER='ExportHUB Freigabe RC1016';
const legacyDocuments=catalog.documents.slice();
const legacyByNumber=Object.fromEntries(legacyDocuments.map(doc=>[doc.number,doc]));
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const text=value=>String(value==null?'':value).trim();
const arr=value=>Array.isArray(value)?value:[];
const unique=values=>[...new Set(arr(values).flat().filter(v=>text(typeof v==='string'?v:(v&&v.text))).map(v=>typeof v==='string'?v:clone(v)))];

const groups=[
  ['SOP-EH-001','Anmeldung, Firmenkontext, Sitzung und App-Direktaufruf',['SOP-EH-001','SOP-EH-005','SOP-EH-006','SOP-EH-007']],
  ['SOP-EH-002','Navigation, Suche, Dashboard und Meldungen',['SOP-EH-002','SOP-EH-003','SOP-EH-004']],
  ['SOP-EH-010','Benutzer finden, anlegen, bearbeiten und löschen',['SOP-EH-010','SOP-EH-011','SOP-EH-013']],
  ['SOP-EH-012','Rollen, Rechte und tatsächlichen Zugriff prüfen',['SOP-EH-012','SOP-EH-014']],
  ['SOP-EH-020','Kunden, Standorte, Kontakte und Kundendokumente verwalten',['SOP-EH-020','SOP-EH-021','SOP-EH-022','SOP-EH-023']],
  ['SOP-EH-030','Sendungen suchen, bearbeiten, Status verwalten und abschließen',['SOP-EH-030','SOP-EH-036','SOP-EH-037','SOP-EH-038']],
  ['SOP-EH-031','Sendung vollständig anlegen – Kunde, Daten, Colli und Entwurf',['SOP-EH-031','SOP-EH-032','SOP-EH-033','SOP-EH-035']],
  ['SOP-EH-034','Stauplan erstellen, prüfen und speichern',['SOP-EH-034']],
  ['SOP-EH-040','Versandkosten, Route und Transportübergabe bearbeiten',['SOP-EH-040','SOP-EH-041','SOP-EH-042']],
  ['SOP-EH-050','Dokumente hochladen, Pflichtstatus prüfen und Dateien öffnen',['SOP-EH-050','SOP-EH-051','SOP-EH-056']],
  ['SOP-EH-052','Versanddokumente, CMR, Gesamtdruck und Lieferschein ausgeben',['SOP-EH-052','SOP-EH-053','SOP-EH-054','SOP-EH-055']],
  ['SOP-EH-060','ABD-Prozess vollständig durchführen – Bedarf, Sperre, Anmeldung und Upload',['SOP-EH-060','SOP-EH-061','SOP-EH-062','SOP-EH-065']],
  ['SOP-EH-063','ABD- und Versandmail vorbereiten, prüfen und extern versenden',['SOP-EH-063','SOP-EH-064']],
  ['SOP-EH-070','QR-Abholung vollständig durchführen und Linkfehler behandeln',['SOP-EH-070','SOP-EH-071','SOP-EH-072','SOP-EH-073','SOP-EH-074']],
  ['SOP-EH-075','POD hochladen, prüfen und Status fortführen',['SOP-EH-075']],
  ['SOP-EH-076','Kunden-Lieferavis aktivieren, prüfen, versenden und deaktivieren',['SOP-EH-076','SOP-EH-077','SOP-EH-078']],
  ['SOP-EH-080','Palettenkonto vollständig führen – Bestand, Buchung, QR, Tausch und Korrektur',['SOP-EH-080','SOP-EH-081','SOP-EH-082','SOP-EH-083']],
  ['SOP-EH-090','Aufgaben vollständig verwalten – Priorität, Erinnerung, Wiederholung, Vertretung und Planung',['SOP-EH-090','SOP-EH-091','SOP-EH-092','SOP-EH-093','SOP-EH-094','SOP-EH-096']],
  ['SOP-EH-095','Abholkalender und fixe Abholungen verwenden',['SOP-EH-095']],
  ['SOP-EH-100','SOP-Handbuch und gelenkte Fassungen verwalten',['SOP-EH-100','SOP-EH-101','SOP-EH-102','SOP-EH-103','SOP-EH-104']],
  ['SOP-EH-105','Academy-Prüfungen durchführen, auswerten und verwalten',['SOP-EH-105','SOP-EH-106']],
  ['SOP-EH-110','Archiv, Historie, Protokolle und Audit-Nachweise prüfen',['SOP-EH-110','SOP-EH-111']],
  ['SOP-EH-112','Fehlerdiagnose vollständig bearbeiten – Website und Mobilbenachrichtigung',['SOP-EH-112','SOP-EH-113']],
  ['SOP-EH-114','Release Center, gemeinsamen Versionsstand und App-Umgebung verwalten',['SOP-EH-114','SOP-EH-115','SOP-EH-116']]
];

function mergeList(sources,key){
  const out=[];const seen=new Set();
  for(const source of sources){for(const value of arr(source.sections&&source.sections[key])){
    const label=text(typeof value==='string'?value:(value&&value.text));if(!label||seen.has(label))continue;seen.add(label);out.push(clone(value));
  }}
  return out;
}
function mergedSteps(sources){
  const out=[];let n=0;
  for(const source of sources){
    const steps=arr(source.sections&&source.sections.steps);
    for(const step of steps){
      n+=1;
      const raw=text(step&&step.text!==undefined?step.text:step);
      out.push({id:`step-${n}`,number:n,text:`${source.title}: ${raw}`});
    }
  }
  return out;
}
function screenshots(number){
  if(number==='SOP-EH-030')return [
    {type:'screenshot',stepId:'step-1',caption:'ExportHUB Sendungsübersicht – echte Demo-Systemansicht',required:true,src:'/assets/sop/screenshots/rc1016-shipmentoverview.png'}
  ];
  if(number==='SOP-EH-090')return [
    {type:'screenshot',stepId:'step-1',caption:'ExportHUB Aufgaben – echte Demo-Systemansicht',required:true,src:'/assets/sop/screenshots/rc1016-tasks.png'}
  ];
  if(number==='SOP-EH-095')return [
    {type:'screenshot',stepId:'step-1',caption:'ExportHUB Abholkalender – echte Demo-Systemansicht',required:true,src:'/assets/sop/screenshots/rc1016-pickupcalendar.png'}
  ];
  return [];
}
function buildActive(def){
  const [number,title,combinedFrom]=def;
  const sources=combinedFrom.map(code=>legacyByNumber[code]).filter(Boolean);
  if(sources.length!==combinedFrom.length)throw new Error(`${number}: historische SOP-Zuordnung unvollständig`);
  const representative=clone(sources[0]);
  const steps=mergedSteps(sources);
  const sourceTitles=sources.map(source=>source.title);
  const references=[];const refSeen=new Set();
  for(const source of sources){for(const ref of arr(source.references||source.sections&&source.sections.references)){
    const value=text(typeof ref==='string'?ref:(ref&&ref.number));
    if(!value||combinedFrom.includes(value)||refSeen.has(value))continue;refSeen.add(value);references.push(value);
  }}
  const history=arr(representative.history||representative.sections&&representative.sections.changeHistory).map(clone);
  history.push({version:'2.0',date:RELEASE_DATE,status:'Freigegeben',change:`RC1016 – zusammengeführter End-to-End-Arbeitsablauf aus ${combinedFrom.join(', ')}`});
  const sections={
    purpose:`Diese gelenkte SOP beschreibt den vollständigen ExportHUB-Arbeitsablauf „${title}“ in einer zusammenhängenden Arbeitsanweisung. Die bisher getrennten Einzelschritte werden ohne fachlichen Informationsverlust in einem End-to-End-Ablauf geführt.`,
    scope:`ExportHUB · ${representative.area}. Gültig für alle berechtigten Benutzer im jeweils aktiven Firmen- und Systemumgebungskontext.`,
    definitions:mergeList(sources,'definitions'),
    responsibilities:mergeList(sources,'responsibilities'),
    prerequisites:mergeList(sources,'prerequisites'),
    resources:mergeList(sources,'resources'),
    steps,
    checks:mergeList(sources,'checks'),
    deviations:mergeList(sources,'deviations'),
    records:mergeList(sources,'records'),
    metrics:mergeList(sources,'metrics'),
    relatedDocuments:mergeList(sources,'relatedDocuments'),
    references,
    changeHistory:history
  };
  const visuals=[{type:'process',stepId:'process-flow',caption:`Prozessübersicht – ${number}: ${title}`,required:true},...screenshots(number)];
  const version={
    version:'2.0',status:'Freigegeben',title,content:clone(sections),visuals:clone(visuals),createdBy:'ExportHUB – RC1016 SOP-Konsolidierung',createdAt:RELEASED_AT,changeReason:'RC1016 – Zusammenführung zusammengehöriger Einzelschritte',submittedBy:REVIEWER,submittedAt:RELEASED_AT,reviewedBy:REVIEWER,reviewedAt:RELEASED_AT,approvedBy:APPROVER,approvedAt:RELEASED_AT,validFrom:RELEASE_DATE
  };
  const priorVersions=arr(representative.versions).map(clone).filter(v=>text(v&&v.version)!=='2.0');
  const audit=arr(representative.auditTrail).map(clone);
  audit.push({action:'Neue Fassung erstellt',version:'2.0',actor:'ExportHUB – RC1016 SOP-Konsolidierung',at:RELEASED_AT,reason:'Zusammenführung zusammengehöriger Einzelschritte'});
  audit.push({action:'Zur Prüfung eingereicht',version:'2.0',actor:REVIEWER,at:RELEASED_AT,reason:'RC1016 Qualitätsprüfung'});
  audit.push({action:'Freigegeben',version:'2.0',actor:APPROVER,at:RELEASED_AT,reason:'RC1016 Freigabe des konsolidierten End-to-End-Ablaufs'});
  return Object.freeze(Object.assign({},representative,{
    id:number,number,title,version:'2.0',currentVersion:'2.0',draftVersion:'',status:'Freigegeben',validFrom:RELEASE_DATE,reviewedBy:REVIEWER,approvedBy:APPROVER,nextReview:NEXT_REVIEW,updatedAt:RELEASED_AT,createdBy:'ExportHUB – RC1016 SOP-Konsolidierung',changeReason:'RC1016 – Zusammenführung zusammengehöriger Einzelschritte',combinedFrom:Object.freeze(combinedFrom.slice()),keywords:Object.freeze([...new Set(arr(representative.keywords).concat(sourceTitles).concat(combinedFrom))]),processFlow:Object.freeze(sourceTitles.slice()),sections:Object.freeze(sections),visuals:Object.freeze(visuals),references:Object.freeze(references),history:Object.freeze(history),versions:Object.freeze([...priorVersions,version]),auditTrail:Object.freeze(audit)
  }));
}

const documents=Object.freeze(groups.map(buildActive));
const aliasByNumber={};
for(const doc of documents){for(const code of doc.combinedFrom)aliasByNumber[code]=doc;aliasByNumber[doc.number]=doc;}
const areas=Object.freeze([...new Set(documents.map(doc=>doc.area))]);
root.ExportHubIsoSopCatalog=Object.freeze(Object.assign({},catalog,{
  version:'RC1016',
  systemOnly:true,
  documents,
  legacyDocuments:Object.freeze(legacyDocuments.slice()),
  areas,
  byNumber:Object.freeze(aliasByNumber),
  get(number){return aliasByNumber[text(number)]||null;}
}));
})(typeof globalThis!=='undefined'?globalThis:this);
