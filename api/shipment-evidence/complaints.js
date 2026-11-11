'use strict';
// RC1910 – Complaint case lifecycle. Kept independent of the shipping file archive.
const crypto=require('node:crypto');
const TYPES=['schaden','fehlmenge','falscher_artikel','verspaetung','dokumentenfehler','sonstiges'];
const RESULTS=['offen','wirksam','unwirksam'];
function fail(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;throw e}
function str(x,n=2000){const t=String(x==null?'':x).trim();if(t.length>n)fail('FIELD_TOO_LONG','Eingabe zu lang.',413);return t}
function date(v){const s=str(v,10);if(!s)return'';if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)fail('BAD_DATE','Ungueltiges Datum.');return s}
function created(input,actor){
 const text=str(input.text,2000),reportedDate=date(input.reportedDate)||new Date().toISOString().slice(0,10);
 if(!text)fail('BAD_COMPLAINT','Bitte die Reklamation beschreiben.');
 const category=str(input.category||'sonstiges',30);
 if(!TYPES.includes(category))fail('BAD_CATEGORY','Reklamationsart ungueltig.');
 return{id:crypto.randomUUID(),text,reportedDate,category,state:'offen',createdAt:new Date().toISOString(),createdBy:actor,
  owner:'',dueDate:'',rootCause:'',immediateAction:'',correctiveAction:'',preventiveAction:'',
  checkDate:'',checkMethod:'',checkSample:'',checkCriteria:'',effectivenessEvidence:'',effectivenessResult:'offen',
  verifiedOn:'',verifiedBy:'',analysisText:'',analysisSource:'',customerDraft:'',carrierDraft:''};
}
const EDIT_FIELDS={owner:120,dueDate:10,rootCause:2000,immediateAction:2000,correctiveAction:2000,
 preventiveAction:2000,checkDate:10,checkMethod:1500,checkSample:400,checkCriteria:1000,
 effectivenessEvidence:2000,effectivenessResult:20,analysisText:8000,analysisSource:50,
 customerDraft:2000,carrierDraft:2000,category:30};
function edit(c,input,actor){
 if(c.state==='abgeschlossen')fail('COMPLAINT_CLOSED','Abgeschlossene Reklamation erst wieder oeffnen.',409);
 const changed=[];
 for(const [k,max] of Object.entries(EDIT_FIELDS)){
  if(!Object.prototype.hasOwnProperty.call(input,k))continue;
  const value=k.endsWith('Date')?date(input[k]):str(input[k],max);
  if(k==='effectivenessResult'&&!RESULTS.includes(value))fail('BAD_EFFECTIVENESS','Ergebnis ungueltig.');
  if(k==='category'&&!TYPES.includes(value))fail('BAD_CATEGORY','Reklamationsart ungueltig.');
  if(value!==String(c[k]||'')){c[k]=value;changed.push(k)}
 }
 const revised=['rootCause','correctiveAction','preventiveAction'].some(k=>changed.includes(k));
 if(revised){
  c.effectivenessResult='offen';c.effectivenessEvidence='';c.verifiedOn='';c.verifiedBy='';
  c.state='in_pruefung';
 }
 if(changed.includes('effectivenessResult')){
  if(c.effectivenessResult==='wirksam'){
   if(!c.rootCause||!c.correctiveAction||!c.checkDate||!c.checkCriteria||
       !c.checkMethod||!c.effectivenessEvidence||
       c.checkDate>new Date().toISOString().slice(0,10))
    fail('EFFECTIVENESS_INCOMPLETE','Ursache, Abstellmassnahme, Prueftermin, Methode, Kriterium und Nachweis fehlen oder die Pruefung liegt in der Zukunft.',422);
   c.verifiedOn=new Date().toISOString().slice(0,10);c.verifiedBy=actor;
  }else{c.verifiedOn='';c.verifiedBy='';if(c.effectivenessResult==='unwirksam')c.state='in_pruefung'}
 }
 c.changedAt=new Date().toISOString();c.changedBy=actor;
 return changed;
}
function changeStatus(c,value,actor){
 const state=str(value,30);
 if(!['offen','in_pruefung','abgeschlossen'].includes(state))fail('BAD_STATUS','Status ungueltig.');
 if(state==='abgeschlossen'&&(!c.rootCause||!c.correctiveAction||c.effectivenessResult!=='wirksam'||
     !c.effectivenessEvidence||!c.checkCriteria||!c.verifiedOn))
  fail('EFFECTIVENESS_REQUIRED','Abschluss erst nach dokumentierter, wirksamer Pruefung moeglich.',422);
 if(c.state==='abgeschlossen'&&state!=='in_pruefung')fail('REOPEN_REQUIRED','Bitte abgeschlossene Reklamation zur Pruefung wieder oeffnen.',409);
 const previous=c.state;c.state=state;c.changedAt=new Date().toISOString();c.changedBy=actor;
 if(previous==='abgeschlossen'){c.effectivenessResult='offen';c.verifiedOn='';c.verifiedBy='';c.effectivenessEvidence=''}
 return previous;
}
function proposal(c,fields){
 const shipment=fields||{},cause='Tatsaechliche Ursache noch offen – Ablauf anhand von Fotos, Dokumenten und Buchungen abgleichen.';
 return{
  facts:['Reklamation vom '+(c.reportedDate||'unbekannt'),c.text].filter(Boolean),
  openQuestions:['Welcher Arbeitsschritt hat die Abweichung verursacht?','Was belegen die Fotos, Belege und Scan-/Versanddaten?','Sind andere Sendungen betroffen?'],
  possibleCause:cause,
  immediateAction:'Belege sichern, betroffene Lieferung pruefen und Kunde ueber die laufende Klaerung informieren.',
  correctiveAction:'Nach Ursachenpruefung konkreten Kontrollpunkt vor Versand definieren; Verantwortlichen und Frist festlegen.',
  preventiveAction:'SOP und Einweisung anhand des bestaetigten Fehlers aktualisieren; Wiederholungen auswerten.',
  checkMethod:'Stichprobe vergleichbarer Sendungen nach Umsetzung der Abstellmassnahme kontrollieren.',
  checkCriteria:'Keine Wiederholung derselben nachgewiesenen Ursache in der dokumentierten Stichprobe.',
  customerDraft:'Hallo,\n\ndanke fuer deine Nachricht. Wir pruefen die Reklamation und die vorhandenen Versandunterlagen. Sobald wir den Sachverhalt geklaert haben, melden wir uns mit dem Ergebnis und den naechsten Schritten.\n\nGruss\n[Bearbeiter]',
  carrierDraft:shipment.carrier?'Hallo,\n\nzu einer Sendung liegt uns eine Reklamation vor. Koennt ihr bitte den Transportablauf und die vorhandenen Abliefernachweise pruefen und uns eure Rueckmeldung schicken?\n\nGruss\n[Bearbeiter]':'',
  disclaimer:'Regelvorschlag (ohne KI) – vor Uebernahme fachlich pruefen. Keine Schuld- oder Haftungszusage.'
 };
}
module.exports={created,edit,changeStatus,proposal,TYPES};
