(function(root){
'use strict';
var packs=Object.freeze({
  de:Object.freeze({
    available:'Neue ExportHUB360-Version verfügbar. Deine aktuellen Änderungen bleiben geschützt.',
    saveFirst:'Neue ExportHUB360-Version verfügbar. Bitte zuerst speichern; deine Änderungen bleiben geschützt.',
    reloadLocked:'Neue ExportHUB360-Version verfügbar. Automatisches Neuladen wurde zum Schutz vor einer Reload-Schleife angehalten.',
    updateNow:'Jetzt aktualisieren'
  }),
  en:Object.freeze({
    available:'A new ExportHUB360 version is available. Your current changes remain protected.',
    saveFirst:'A new ExportHUB360 version is available. Please save first; your current changes remain protected.',
    reloadLocked:'A new ExportHUB360 version is available. Automatic reload was paused to prevent a reload loop.',
    updateNow:'Update now'
  }),
  pl:Object.freeze({
    available:'Dostępna jest nowa wersja ExportHUB360. Twoje bieżące zmiany są chronione.',
    saveFirst:'Dostępna jest nowa wersja ExportHUB360. Najpierw zapisz zmiany; Twoje bieżące zmiany są chronione.',
    reloadLocked:'Dostępna jest nowa wersja ExportHUB360. Automatyczne ponowne wczytanie zostało wstrzymane, aby zapobiec pętli przeładowań.',
    updateNow:'Aktualizuj teraz'
  }),
  es:Object.freeze({
    available:'Hay una nueva versión de ExportHUB360 disponible. Tus cambios actuales permanecen protegidos.',
    saveFirst:'Hay una nueva versión de ExportHUB360 disponible. Guarda primero; tus cambios actuales permanecen protegidos.',
    reloadLocked:'Hay una nueva versión de ExportHUB360 disponible. La recarga automática se ha detenido para evitar un bucle de recarga.',
    updateNow:'Actualizar ahora'
  }),
  fr:Object.freeze({
    available:'Une nouvelle version d’ExportHUB360 est disponible. Vos modifications actuelles restent protégées.',
    saveFirst:'Une nouvelle version d’ExportHUB360 est disponible. Enregistrez d’abord ; vos modifications actuelles restent protégées.',
    reloadLocked:'Une nouvelle version d’ExportHUB360 est disponible. Le rechargement automatique a été suspendu pour éviter une boucle de rechargement.',
    updateNow:'Mettre à jour maintenant'
  }),
  it:Object.freeze({
    available:'È disponibile una nuova versione di ExportHUB360. Le modifiche correnti restano protette.',
    saveFirst:'È disponibile una nuova versione di ExportHUB360. Salva prima; le modifiche correnti restano protette.',
    reloadLocked:'È disponibile una nuova versione di ExportHUB360. Il ricaricamento automatico è stato sospeso per evitare un ciclo di ricaricamento.',
    updateNow:'Aggiorna ora'
  })
});
function normalize(value){
  var lang=String(value==null?'':value).trim().toLowerCase().replace('_','-').slice(0,2);
  return Object.prototype.hasOwnProperty.call(packs,lang)?lang:'de';
}
function language(){
  try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.language==='function')return normalize(root.ExportHUBI18n.language())}catch(_){}
  try{return normalize(root.navigator&&(root.navigator.language||(root.navigator.languages&&root.navigator.languages[0])))}catch(_){return'de'}
}
function t(key,lang){
  var selected=normalize(lang||language()),pack=packs[selected]||packs.de;
  return pack[key]||packs.de[key]||String(key||'');
}
root.ExportHUBAutoUpdateI18n=Object.freeze({packs:packs,language:language,t:t});
})(typeof window!=='undefined'?window:globalThis);
