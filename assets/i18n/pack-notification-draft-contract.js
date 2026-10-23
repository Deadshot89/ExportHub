(function(root){
  'use strict';
  const core=root&&root.ExportHUBPackI18n;
  if(!core||!core.packs)return;
  const values={
    de:{'pack.draft.deliveryNotesHelp':'Mindestens einen Lieferschein als PDF, JPG oder PNG hochladen. Mehrere Lieferscheine sind möglich.','pack.draft.deliveryRequirement':'Mindestens einen Lieferschein hochladen.','pack.api.PACK_DOCUMENT_REQUIRED':'Mindestens ein Lieferschein ist erforderlich.'},
    en:{'pack.draft.deliveryNotesHelp':'Upload at least one delivery note as PDF, JPG or PNG. Multiple delivery notes are supported.','pack.draft.deliveryRequirement':'Upload at least one delivery note.','pack.api.PACK_DOCUMENT_REQUIRED':'At least one delivery note is required.'},
    pl:{'pack.draft.deliveryNotesHelp':'Prześlij co najmniej jeden dokument dostawy w formacie PDF, JPG lub PNG. Można dodać wiele dokumentów.','pack.draft.deliveryRequirement':'Prześlij co najmniej jeden dokument dostawy.','pack.api.PACK_DOCUMENT_REQUIRED':'Wymagany jest co najmniej jeden dokument dostawy.'},
    es:{'pack.draft.deliveryNotesHelp':'Sube al menos un albarán en PDF, JPG o PNG. Se admiten varios albaranes.','pack.draft.deliveryRequirement':'Sube al menos un albarán.','pack.api.PACK_DOCUMENT_REQUIRED':'Se requiere al menos un albarán.'},
    fr:{'pack.draft.deliveryNotesHelp':'Téléversez au moins un bon de livraison au format PDF, JPG ou PNG. Plusieurs fichiers sont possibles.','pack.draft.deliveryRequirement':'Téléversez au moins un bon de livraison.','pack.api.PACK_DOCUMENT_REQUIRED':'Au moins un bon de livraison est requis.'},
    it:{'pack.draft.deliveryNotesHelp':'Carica almeno una bolla di consegna in formato PDF, JPG o PNG. Sono supportati più file.','pack.draft.deliveryRequirement':'Carica almeno una bolla di consegna.','pack.api.PACK_DOCUMENT_REQUIRED':'È richiesta almeno una bolla di consegna.'}
  };
  for(const lang of Object.keys(values))Object.assign(core.packs[lang],values[lang]);
  // the drafts script already wrote the old help text into the page before these values were applied
  try{const help=root.document&&root.document.getElementById('packDeliveryNotesHelp');if(help)help.textContent=core.t('pack.draft.deliveryNotesHelp');}catch(_){}
})(typeof window!=='undefined'?window:globalThis);
