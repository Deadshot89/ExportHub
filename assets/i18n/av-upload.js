/* ExportHUB360 – texts of the AV upload in the shipment view in six languages. */
(function(root){
'use strict';
if(!root||root.ExportHUBAvUploadI18n)return;
var I18N={
 de:{idle:'AV hochladen',busy:'AV wird hochgeladen …',done:'AV gespeichert ✓',tooLarge:'Die Datei ist größer als 15 MB.',failed:'AV konnte nicht hochgeladen werden: {message}',taskPending:'AV gespeichert · Der Aufgabenstatus konnte nicht aktualisiert werden.',taskCompleted:'AV gespeichert · Aufgabe erledigt.',taskCompletedMirrorPending:'AV gespeichert · Aufgabe erledigt · OneDrive-Ablage noch offen.',taskOpen:'AV gespeichert · Aufgabe noch offen.'},
 en:{idle:'Upload AV',busy:'Uploading AV …',done:'AV saved ✓',tooLarge:'The file is larger than 15 MB.',failed:'AV could not be uploaded: {message}',taskPending:'AV saved · Task status could not be updated.',taskCompleted:'AV saved · Task completed.',taskCompletedMirrorPending:'AV saved · Task completed · OneDrive filing still pending.',taskOpen:'AV saved · Task still open.'},
 pl:{idle:'Prześlij AV',busy:'Przesyłanie AV …',done:'AV zapisano ✓',tooLarge:'Plik jest większy niż 15 MB.',failed:'Nie udało się przesłać AV: {message}',taskPending:'AV zapisano · Nie można zaktualizować zadania.',taskCompleted:'AV zapisano · Zadanie ukończone.',taskCompletedMirrorPending:'AV zapisano · Zadanie ukończone · Zapis do OneDrive nadal oczekuje.',taskOpen:'AV zapisano · Zadanie nadal otwarte.'},
 es:{idle:'Subir AV',busy:'Subiendo AV …',done:'AV guardado ✓',tooLarge:'El archivo supera los 15 MB.',failed:'No se pudo subir el AV: {message}',taskPending:'AV guardado · No se pudo actualizar la tarea.',taskCompleted:'AV guardado · Tarea completada.',taskCompletedMirrorPending:'AV guardado · Tarea completada · Pendiente de archivo en OneDrive.',taskOpen:'AV guardado · Tarea todavía abierta.'},
 fr:{idle:'Téléverser l’AV',busy:'Téléversement de l’AV …',done:'AV enregistré ✓',tooLarge:'Le fichier dépasse 15 Mo.',failed:'Impossible de téléverser l’AV : {message}',taskPending:'AV enregistré · Mise à jour de la tâche impossible.',taskCompleted:'AV enregistré · Tâche terminée.',taskCompletedMirrorPending:'AV enregistré · Tâche terminée · Archivage OneDrive en attente.',taskOpen:'AV enregistré · Tâche encore ouverte.'},
 it:{idle:'Carica AV',busy:'Caricamento AV …',done:'AV salvato ✓',tooLarge:'Il file supera i 15 MB.',failed:'Impossibile caricare l’AV: {message}',taskPending:'AV salvato · Impossibile aggiornare l\'attività.',taskCompleted:'AV salvato · Attività completata.',taskCompletedMirrorPending:'AV salvato · Attività completata · Archiviazione OneDrive in sospeso.',taskOpen:'AV salvato · Attività ancora aperta.'}
};
root.ExportHUBAvUploadI18n=Object.freeze({packs:I18N});
})(window);
