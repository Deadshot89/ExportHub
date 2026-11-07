/* ExportHUB360 – texts of the "Fehler melden" button in the shipment view in six languages. */
(function(root){
'use strict';
if(!root||root.ExportHUBShipmentErrorReportI18n)return;
var I18N={
 de:{button:'Fehler melden',title:'Fehler zu dieser Sendung dokumentieren'},
 en:{button:'Report an error',title:'Document an error for this shipment'},
 pl:{button:'Zgłoś błąd',title:'Udokumentuj błąd dla tej przesyłki'},
 es:{button:'Notificar un error',title:'Documentar un error de este envío'},
 fr:{button:'Signaler une erreur',title:'Documenter une erreur pour cet envoi'},
 it:{button:'Segnala un errore',title:'Documenta un errore per questa spedizione'}
};
root.ExportHUBShipmentErrorReportI18n=Object.freeze({version:'ER1',packs:I18N});
})(typeof window!=='undefined'?window:globalThis);
