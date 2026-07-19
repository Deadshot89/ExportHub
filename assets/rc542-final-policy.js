(function(){
'use strict';
if(window.__EXPORTHUB_RC544_FINAL_POLICY__) return;
window.__EXPORTHUB_RC544_FINAL_POLICY__=true;
var P={
 version:'RC546', dateFormat:'TT.MM.JJJJ', locale:'de-DE',
 shipment:{reference:{length:6,pattern:'^[A-Z0-9]{6}$',auto:true,editableUntilMailSent:true,syncLinkedAbd:true},draft:{autosave:true,expiresHours:48,recoverDays:30},pickupDate:{required:true,weekends:false},countryFromLocation:true,cmrOutsideGermany:true,statusSkipping:false},
 abd:{decisionAtShipmentEnd:true,createdFromShipment:true,mailBlockedUntilComplete:true,recipient:'mail@gp-zollabfertigung.de',cc:false,outlookManualAttachments:['Rechnungen','Lieferschein'],subject:'Kundenname | Referenznummer | ABD-Anfrage'},
 mail:{requirements:['Kundenmail','Speditionsmail','Kundenmail und Speditionsmail','Eigene Mail','Keine Mail erforderlich'],oneOfCustomerOrCarrierSatisfies:true,cancelAlternativeTask:true,ccFromCustomerFolder:true,subject:'Kundenname | Referenznummer | Avisierung erforderlich',automaticAttachments:false},
 documents:{requiredEvery:['Lieferschein','Ladeliste Seite 1 mit QR-Code','Ladeliste Seite 2 ohne QR-Code','Deckblatt'],requiredAbroad:['CMR'],requiredAbd:['ABD'],requiredAfterPickup:['POD'],allDeliveryNotesActive:true,allPodsActive:true,imagesStoredAsPdfOnly:true,zipDownloadTrial:true},
 pickup:{qrPin:'2578',manualAllowedForEditors:true,driverNameOptional:true,podPhotoAtScan:true,palletReturnRequiredWhenEuroPallets:true},
 pallets:{euroOnly:true,routeByStoredCarrier:true,noNegativeDisplay:true,correctionByCounterBooking:true,settlementCancelThenNew:true,cancelReasonRequired:false},
 rights:{levels:['none','view','edit','admin'],assignmentGlobalAdminOnly:true,functionAdminsPerArea:true},
 users:{localUsernamePassword:true,password:{minLength:6,upper:true,lower:true,number:true,special:false,history:true},lock:{firstAttempts:5,firstMinutes:30,secondAttempts:2,secondAdminOnly:true},noIdleLogout:true,multiSession:true},
 tasks:{statuses:['Offen','In Bearbeitung','Erledigt','Storniert'],priorities:['Dringend','Normal','Niedrig'],reminders:['09:00','12:00','15:00'],commentsEditable:true,commentsDeletable:false,oneAssignee:true},
 retention:{activeMonths:12,dailyBackupsDays:30,monthlyBackupsMonths:12,yearlyBackupsYears:3},
 mobile:{fullApp:true,abdCreation:false,burgerMenu:true,offlineQueue:true},
 removedModules:['quiz','Prüfungszentrum']
};
window.ExportHUBFinalPolicy=P;
function state(){try{return window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():(window.state||{})}catch(e){return window.state||{}}}
function save(){try{if(window.ExportHUBClean&&window.ExportHUBClean.queueSave)window.ExportHUBClean.queueSave('RC546 Prozessregeln');}catch(e){}}
function installPolicy(){var s=state();s.settings=s.settings||{};s.settings.finalProcessVersion='RC546';s.settings.dateFormat='TT.MM.JJJJ';s.settings.qrPin=s.settings.qrPin||'2578';s.settings.processPolicy=P;save();}
function hideRemoved(){
 document.querySelectorAll('[data-view="quiz"],button[onclick*="quiz"],a[onclick*="quiz"]').forEach(function(n){n.style.display='none';n.setAttribute('aria-hidden','true')});
 document.querySelectorAll('button,a,li').forEach(function(n){if(/Prüfungszentrum/i.test(n.textContent||''))n.style.display='none'});
}
function enhanceLocks(){document.querySelectorAll('button:disabled').forEach(function(b){if(b.dataset.rc542ReasonDone)return;b.dataset.rc542ReasonDone='1';if(!b.title)b.title='Diese Funktion ist noch gesperrt. Das Fragezeichen zeigt den Grund an.';var q=document.createElement('span');q.textContent=' ?';q.className='rc542-lock-help';q.title=b.title;b.insertAdjacentElement('afterend',q)})}
function enforceDateHints(){document.querySelectorAll('input[type="date"],input[data-date-format]').forEach(function(i){i.lang='de-DE';i.placeholder='TT.MM.JJJJ';i.setAttribute('data-date-format','TT.MM.JJJJ')})}
function markVersion(){document.documentElement.setAttribute('data-exporthub-version','RC546');document.querySelectorAll('[data-exporthub-version-label]').forEach(function(n){n.textContent='RC546'})}
function post(){installPolicy();hideRemoved();enhanceLocks();enforceDateHints();markVersion()}
window.addEventListener('exporthub:ready',post,{once:true});
document.addEventListener('DOMContentLoaded',function(){setTimeout(post,1200)},{once:true});
document.addEventListener('click',function(){setTimeout(function(){hideRemoved();enhanceLocks();enforceDateHints()},0)},true);
window.ExportHUBRC544Final={policy:P,postProcess:post};
})();
