/* ExportHUB360 – texts of the AV upload in the shipment view in six languages. */
(function(root){
'use strict';
if(!root||root.ExportHUBAvUploadI18n)return;
var I18N={
 de:{idle:'AV hochladen',busy:'AV wird hochgeladen …',done:'AV gespeichert ✓',tooLarge:'Die Datei ist größer als 15 MB.',failed:'AV konnte nicht hochgeladen werden: {message}'},
 en:{idle:'Upload AV',busy:'Uploading AV …',done:'AV saved ✓',tooLarge:'The file is larger than 15 MB.',failed:'AV could not be uploaded: {message}'},
 pl:{idle:'Prześlij AV',busy:'Przesyłanie AV …',done:'AV zapisano ✓',tooLarge:'Plik jest większy niż 15 MB.',failed:'Nie udało się przesłać AV: {message}'},
 es:{idle:'Subir AV',busy:'Subiendo AV …',done:'AV guardado ✓',tooLarge:'El archivo supera los 15 MB.',failed:'No se pudo subir el AV: {message}'},
 fr:{idle:'Téléverser l’AV',busy:'Téléversement de l’AV …',done:'AV enregistré ✓',tooLarge:'Le fichier dépasse 15 Mo.',failed:'Impossible de téléverser l’AV : {message}'},
 it:{idle:'Carica AV',busy:'Caricamento AV …',done:'AV salvato ✓',tooLarge:'Il file supera i 15 MB.',failed:'Impossibile caricare l’AV: {message}'}
};
root.ExportHUBAvUploadI18n=Object.freeze({packs:I18N});
})(window);
