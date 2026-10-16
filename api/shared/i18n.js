'use strict';
const packs={
 de:require('./i18n/de.json'),
 en:require('./i18n/en.json'),
 pl:require('./i18n/pl.json'),
 es:require('./i18n/es.json'),
 fr:require('./i18n/fr.json'),
 it:require('./i18n/it.json')
};
const customsAiPacks=require('./i18n/customs-ai.json');
const overrides=Object.freeze({
 de:Object.freeze({
  'api.avis.downloadAll':'Alle Anhänge herunterladen',
  'api.avis.downloadAllCategory':'ZIP · Alle Dokumente',
  'api.avis.zipNoDocuments':'Für diese Sendung sind keine Anhänge verfügbar.',
  'api.avis.zipTooManyDocuments':'Zu viele Anhänge für einen Sammeldownload.',
  'api.avis.zipDocumentFailed':'Der Sammeldownload wurde abgebrochen, weil „{{name}}“ nicht vollständig geladen werden konnte.',
  'api.avis.zipTooLarge':'Die Anhänge sind zusammen zu groß für einen Sammeldownload.',
  'api.pickup.manualConfirmed':'Abholung manuell bestätigt',
  'api.pickup.manualDateChanged':'Abholdatum manuell geändert',
  'api.pickup.manualFailed':'Manuelle Abholung konnte nicht gespeichert werden.',
  'api.pickup.environmentMismatchTest':'Ein Testservice-Aufruf darf keine Produktionsdaten ändern.',
  'api.pickup.environmentMismatchProduction':'Die Produktionsseite darf keine Testservice-Daten ändern.'
 }),
 en:Object.freeze({
  'api.avis.downloadAll':'Download all attachments',
  'api.avis.downloadAllCategory':'ZIP · All documents',
  'api.avis.zipNoDocuments':'No attachments are available for this shipment.',
  'api.avis.zipTooManyDocuments':'There are too many attachments for a bulk download.',
  'api.avis.zipDocumentFailed':'The bulk download was cancelled because “{{name}}” could not be loaded completely.',
  'api.avis.zipTooLarge':'The attachments are too large in total for a bulk download.',
  'api.pickup.manualConfirmed':'Pickup confirmed manually',
  'api.pickup.manualDateChanged':'Pickup date changed manually',
  'api.pickup.manualFailed':'The manual pickup could not be saved.',
  'api.pickup.environmentMismatchTest':'A test-service request may not modify production data.',
  'api.pickup.environmentMismatchProduction':'The production site may not modify test-service data.'
 }),
 pl:Object.freeze({
  'api.avis.downloadAll':'Pobierz wszystkie załączniki',
  'api.avis.downloadAllCategory':'ZIP · Wszystkie dokumenty',
  'api.avis.zipNoDocuments':'Dla tej przesyłki nie są dostępne żadne załączniki.',
  'api.avis.zipTooManyDocuments':'Za dużo załączników do pobrania zbiorczego.',
  'api.avis.zipDocumentFailed':'Pobieranie zbiorcze zostało przerwane, ponieważ nie udało się w pełni wczytać pliku „{{name}}”.',
  'api.avis.zipTooLarge':'Łączny rozmiar załączników jest zbyt duży do pobrania zbiorczego.',
  'api.pickup.manualConfirmed':'Odbiór potwierdzono ręcznie',
  'api.pickup.manualDateChanged':'Datę odbioru zmieniono ręcznie',
  'api.pickup.manualFailed':'Nie udało się zapisać ręcznego odbioru.',
  'api.pickup.environmentMismatchTest':'Żądanie usługi testowej nie może zmieniać danych produkcyjnych.',
  'api.pickup.environmentMismatchProduction':'Strona produkcyjna nie może zmieniać danych usługi testowej.'
 }),
 es:Object.freeze({
  'api.avis.downloadAll':'Descargar todos los archivos adjuntos',
  'api.avis.downloadAllCategory':'ZIP · Todos los documentos',
  'api.avis.zipNoDocuments':'No hay archivos adjuntos disponibles para este envío.',
  'api.avis.zipTooManyDocuments':'Hay demasiados archivos adjuntos para una descarga conjunta.',
  'api.avis.zipDocumentFailed':'La descarga conjunta se canceló porque no se pudo cargar completamente «{{name}}».',
  'api.avis.zipTooLarge':'El tamaño total de los archivos adjuntos es demasiado grande para una descarga conjunta.',
  'api.pickup.manualConfirmed':'Recogida confirmada manualmente',
  'api.pickup.manualDateChanged':'Fecha de recogida modificada manualmente',
  'api.pickup.manualFailed':'No se pudo guardar la recogida manual.',
  'api.pickup.environmentMismatchTest':'Una solicitud del servicio de prueba no puede modificar datos de producción.',
  'api.pickup.environmentMismatchProduction':'El sitio de producción no puede modificar datos del servicio de prueba.'
 }),
 fr:Object.freeze({
  'api.avis.downloadAll':'Télécharger toutes les pièces jointes',
  'api.avis.downloadAllCategory':'ZIP · Tous les documents',
  'api.avis.zipNoDocuments':'Aucune pièce jointe n’est disponible pour cet envoi.',
  'api.avis.zipTooManyDocuments':'Il y a trop de pièces jointes pour un téléchargement groupé.',
  'api.avis.zipDocumentFailed':'Le téléchargement groupé a été annulé car « {{name}} » n’a pas pu être chargé complètement.',
  'api.avis.zipTooLarge':'La taille totale des pièces jointes est trop importante pour un téléchargement groupé.',
  'api.pickup.manualConfirmed':'Enlèvement confirmé manuellement',
  'api.pickup.manualDateChanged':'Date d’enlèvement modifiée manuellement',
  'api.pickup.manualFailed':'L’enlèvement manuel n’a pas pu être enregistré.',
  'api.pickup.environmentMismatchTest':'Une requête du service de test ne peut pas modifier les données de production.',
  'api.pickup.environmentMismatchProduction':'Le site de production ne peut pas modifier les données du service de test.'
 }),
 it:Object.freeze({
  'api.avis.downloadAll':'Scarica tutti gli allegati',
  'api.avis.downloadAllCategory':'ZIP · Tutti i documenti',
  'api.avis.zipNoDocuments':'Non sono disponibili allegati per questa spedizione.',
  'api.avis.zipTooManyDocuments':'Ci sono troppi allegati per un download cumulativo.',
  'api.avis.zipDocumentFailed':'Il download cumulativo è stato annullato perché non è stato possibile caricare completamente “{{name}}”.',
  'api.avis.zipTooLarge':'La dimensione totale degli allegati è troppo grande per un download cumulativo.',
  'api.pickup.manualConfirmed':'Ritiro confermato manualmente',
  'api.pickup.manualDateChanged':'Data di ritiro modificata manualmente',
  'api.pickup.manualFailed':'Non è stato possibile salvare il ritiro manuale.',
  'api.pickup.environmentMismatchTest':'Una richiesta del servizio di test non può modificare i dati di produzione.',
  'api.pickup.environmentMismatchProduction':'Il sito di produzione non può modificare i dati del servizio di test.'
 })
});
const supported=Object.freeze(Object.keys(packs));
function text(v){return String(v==null?'':v).trim()}
function normalize(v){
 const m=text(v).toLowerCase().replace('_','-').match(/^(de|en|pl|es|fr|it)(?:-|$)/);
 return m?m[1]:'';
}
function language(req,payload){
 const h=req&&req.headers||{},q=req&&req.query||{},b=payload&&typeof payload==='object'?payload:(req&&req.body&&typeof req.body==='object'?req.body:{});
 return normalize(h['x-exporthub-language']||h['X-ExportHUB-Language']||q.lang||q.language||b.language||b.lang||h['accept-language']||h['Accept-Language'])||'de';
}
function interpolate(value,vars){
 return String(value==null?'':value).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,function(_,key){return vars&&Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]==null?'':vars[key]):''});
}
function featureValue(code,key){
 const pack=customsAiPacks[code]||{},fallback=customsAiPacks.de||{};
 return pack[key]!=null?pack[key]:fallback[key];
}
function valueFor(lang,key){
 const code=normalize(lang)||'de',feature=featureValue(code,key),override=overrides[code]&&overrides[code][key],pack=packs[code]||packs.de;
 if(feature!=null)return feature;
 if(override!=null)return override;
 return pack[key]!=null?pack[key]:packs.de[key];
}
function t(req,key,vars,payload){
 const value=valueFor(language(req,payload),key);
 return interpolate(value!=null?value:key,vars||{});
}
function tLang(lang,key,vars){
 const value=valueFor(lang,key);
 return interpolate(value!=null?value:key,vars||{});
}
module.exports=Object.freeze({supported,normalize,language,t,tLang});
