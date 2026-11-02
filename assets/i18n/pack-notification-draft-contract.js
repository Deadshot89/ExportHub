(function(root){
  'use strict';
  const core=root&&root.ExportHUBPackI18n;
  if(!core||!core.packs)return;
  const values={
    de:{'pack.draft.deliveryNotesHelp':'Optional: Lieferscheine als PDF, JPG oder PNG hinzufügen. Die Packmeldung kann ohne Lieferschein gesendet werden.','pack.draft.deliveryRequirement':'Lieferscheine sind optional. Auch ohne Datei kann die Packmeldung gesendet werden.','pack.api.PACK_DOCUMENT_REQUIRED':'Mindestens ein Lieferschein ist erforderlich.'},
    en:{'pack.draft.deliveryNotesHelp':'Optional: Add delivery notes as PDF, JPG or PNG. The packing notification can be sent without a delivery note.','pack.draft.deliveryRequirement':'Delivery notes are optional. You can submit without a file.','pack.api.PACK_DOCUMENT_REQUIRED':'At least one delivery note is required.'},
    pl:{'pack.draft.deliveryNotesHelp':'Opcjonalnie: dodaj dokumenty dostawy PDF, JPG lub PNG. Zgłoszenie można wysłać bez dokumentów.','pack.draft.deliveryRequirement':'Dokumenty dostawy są opcjonalne. Można wysłać bez pliku.','pack.api.PACK_DOCUMENT_REQUIRED':'Wymagany jest co najmniej jeden dokument dostawy.'},
    es:{'pack.draft.deliveryNotesHelp':'Opcional: añade albaranes en PDF, JPG o PNG. El aviso puede enviarse sin albaranes.','pack.draft.deliveryRequirement':'Los albaranes son opcionales. Puedes enviar sin archivos.','pack.api.PACK_DOCUMENT_REQUIRED':'Se requiere al menos un albarán.'},
    fr:{'pack.draft.deliveryNotesHelp':'Facultatif : ajoutez des bons de livraison PDF, JPG ou PNG. La notification peut être envoyée sans fichier.','pack.draft.deliveryRequirement':'Les bons de livraison sont facultatifs. Vous pouvez envoyer sans fichier.','pack.api.PACK_DOCUMENT_REQUIRED':'Au moins un bon de livraison est requis.'},
    it:{'pack.draft.deliveryNotesHelp':'Facoltativo: aggiungi documenti PDF, JPG o PNG. La segnalazione può essere inviata senza documenti.','pack.draft.deliveryRequirement':'I documenti di consegna sono facoltativi. Puoi inviare senza file.','pack.api.PACK_DOCUMENT_REQUIRED':'È richiesta almeno una bolla di consegna.'}
  };
  for(const lang of Object.keys(values))Object.assign(core.packs[lang],values[lang]);
  // the drafts script already wrote the old help text into the page before these values were applied
  try{const help=root.document&&root.document.getElementById('packDeliveryNotesHelp');if(help)help.textContent=core.t('pack.draft.deliveryNotesHelp');}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
