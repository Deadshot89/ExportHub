const fs=require('node:fs');

const file='assets/rc1166-avis-reminder-overview.js';
let source=fs.readFileSync(file,'utf8');

function replaceOnce(from,to,label){
  const first=source.indexOf(from);
  const second=first<0?-1:source.indexOf(from,first+from.length);
  if(first<0||second>=0)throw new Error(label+': expected exactly one match');
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
`function closed(sh){
 if(!sh)return true;
 if(q(sh.actualPickupAt||sh.pickedUpAt||sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt))return true;
 return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|picked up|pod available|completed|archived)$/i.test(q(sh.status||sh.shipmentStatus||sh.processStatus))
}`,
`function closed(sh){
 if(!sh)return true;
 if(q(sh.actualPickupAt||sh.actualPickupDate||sh.pickedUpAt||sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt))return true;
 return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|storniert|picked up|pod available|completed|archived|cancelled|canceled)$/i.test(q(sh.status||sh.shipmentStatus||sh.processStatus))
}`,
'closed shipment contract'
);

const genericReminder=`function genericReminderEligible(sh){return !!sh&&!closed(sh)}
function genericReminderApi(){
 var api=w.ExportHUBIndex236;
 return api&&typeof api.reminderMail==='function'&&typeof api.recipientState==='function'?api:null
}
function genericReminderRecipient(api,sh,target){
 try{var state=api.recipientState(sh,target)||{};return{available:state.available===true||arr(state.to).length>0}}catch(_){return{available:false}}
}
function ensureGenericReminderActions(card,sh){
 if(!card)return false;
 var existing=card.querySelector&&card.querySelector('.index236-reminder-actions');
 if(!genericReminderEligible(sh)){if(existing&&typeof existing.remove==='function')existing.remove();return false}
 if(existing)return true;
 var api=genericReminderApi();if(!api)return false;
 var id=q(sh&&(sh.id||sh.shipmentId||sh.ref||sh.reference||sh.shipmentRef));if(!id)return false;
 var customer=genericReminderRecipient(api,sh,'customer'),carrier=genericReminderRecipient(api,sh,'carrier');
 var wrap=d.createElement('div');wrap.className='index236-reminder-actions rc1484-generic-reminder-actions';
 var title=d.createElement('span');title.className='rc820-reminder-label';title.textContent='Abholerinnerung öffnen';wrap.appendChild(title);
 function add(target,lang,label,recipient){
  var button=d.createElement('button');button.type='button';button.className='soft';button.textContent=label;
  button.setAttribute('data-rc1484-reminder-target',target);button.setAttribute('data-rc1484-reminder-lang',lang);
  if(!recipient.available){button.disabled=true;button.setAttribute('aria-disabled','true');button.title='Keine E-Mail-Adresse für diesen Empfänger hinterlegt'}
  else button.title=(target==='carrier'?'Erinnerungsmail an Spedition':'Erinnerungsmail an Kunde')+' ('+lang.toUpperCase()+')';
  button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(button.disabled)return false;return api.reminderMail(id,target,lang)});
  wrap.appendChild(button)
 }
 add('customer','de','Kunde DE',customer);add('customer','en','Kunde EN',customer);add('carrier','de','Spedition DE',carrier);add('carrier','en','Spedition EN',carrier);
 var danger=card.querySelector&&card.querySelector('.rc524-dangerbar');
 if(danger&&danger.parentNode&&typeof danger.parentNode.insertBefore==='function')danger.parentNode.insertBefore(wrap,danger);else if(typeof card.appendChild==='function')card.appendChild(wrap);else return false;
 return true
}
`;

replaceOnce('function overviewCards(shipments){',genericReminder+'function overviewCards(shipments){','generic reminder insertion');

replaceOnce(
`function render(){
 if(!inOverview()){d.querySelectorAll('[data-rc1166-avis-reminder]').forEach(function(x){x.remove()});closeDialog();return 0}
 ensureStyle();var shipments=allShipments(),rows=overviewCards(shipments),count=0;
 rows.forEach(function(row){if(row.shipment&&ensureButton(row.card,row.shipment))count++});return count
}`,
`function render(){
 if(!inOverview()){d.querySelectorAll('[data-rc1166-avis-reminder],.rc1484-generic-reminder-actions').forEach(function(x){x.remove()});closeDialog();return 0}
 ensureStyle();var shipments=allShipments(),rows=overviewCards(shipments),count=0;
 rows.forEach(function(row){if(!row.shipment)return;ensureGenericReminderActions(row.card,row.shipment);if(ensureButton(row.card,row.shipment))count++});return count
}`,
'render integration'
);

replaceOnce(
`try{return !!((el.matches&&el.matches('[data-rc1166-avis-reminder],.rc1166-reminder-row,.rc1166-dialog'))||(el.closest&&el.closest('[data-rc1166-avis-reminder],.rc1166-reminder-row,.rc1166-dialog')))}catch(_){return false}`,
`try{return !!((el.matches&&el.matches('[data-rc1166-avis-reminder],.rc1166-reminder-row,.rc1166-dialog,.rc1484-generic-reminder-actions'))||(el.closest&&el.closest('[data-rc1166-avis-reminder],.rc1166-reminder-row,.rc1166-dialog,.rc1484-generic-reminder-actions')))}catch(_){return false}`,
'observer own-node guard'
);

replaceOnce(
`w.ExportHUBRC1166AvisReminder=Object.freeze({version:'RC1358',shipmentContacts:shipmentContacts,avisLink:avisLink,subject:subject,body:body,initialSubject:initialSubject,initialBody:initialBody,reminderGate:reminderGate,sendReminder:sendReminder,recipientExcluded:avisRecipientExcluded,render:render});`,
`w.ExportHUBRC1166AvisReminder=Object.freeze({version:'RC1358',genericReminderAvailability:'RC1484',shipmentContacts:shipmentContacts,avisLink:avisLink,subject:subject,body:body,initialSubject:initialSubject,initialBody:initialBody,reminderGate:reminderGate,genericReminderEligible:genericReminderEligible,ensureGenericReminderActions:ensureGenericReminderActions,sendReminder:sendReminder,recipientExcluded:avisRecipientExcluded,render:render});`,
'public api export'
);

fs.writeFileSync(file,source);
console.log('RC1484 patch applied');
