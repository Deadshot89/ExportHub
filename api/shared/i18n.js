'use strict';
const packs={
 de:require('./i18n/de.json'),
 en:require('./i18n/en.json'),
 pl:require('./i18n/pl.json'),
 es:require('./i18n/es.json'),
 fr:require('./i18n/fr.json'),
 it:require('./i18n/it.json')
};
// RC1432/RC1454: Laufzeit-Overrides für bereits produktive Texte, die ohne
// breiten Sprachpaket-Umbau korrigiert bzw. ergänzt werden müssen.
const overrides=Object.freeze({
 de:Object.freeze({
  'api.pickup.customsSignatureRequired':'Bitte die zweite Fahrerunterschrift „Zolldokumente erhalten“ erfassen.',
  'api.avis.downloadAll':'Alle Anhänge herunterladen',
  'api.avis.downloadAllCategory':'ZIP · Alle Dokumente',
  'api.avis.zipNoDocuments':'Für diese Sendung sind keine Anhänge verfügbar.',
  'api.avis.zipTooManyDocuments':'Zu viele Anhänge für einen Sammeldownload.',
  'api.avis.zipDocumentFailed':'Der Sammeldownload wurde abgebrochen, weil „{{name}}“ nicht vollständig geladen werden konnte.',
  'api.avis.zipTooLarge':'Die Anhänge sind zusammen zu groß für einen Sammeldownload.'
 }),
 en:Object.freeze({
  'api.pickup.customsSignatureRequired':'Please capture the driver’s second signature confirming receipt of the customs documents.',
  'api.avis.downloadAll':'Download all attachments',
  'api.avis.downloadAllCategory':'ZIP · All documents',
  'api.avis.zipNoDocuments':'No attachments are available for this shipment.',
  'api.avis.zipTooManyDocuments':'There are too many attachments for a bulk download.',
  'api.avis.zipDocumentFailed':'The bulk download was cancelled because “{{name}}” could not be loaded completely.',
  'api.avis.zipTooLarge':'The attachments are too large in total for a bulk download.'
 }),
 pl:Object.freeze({
  'api.pickup.customsSignatureRequired':'Proszę złożyć drugi podpis kierowcy potwierdzający odbiór dokumentów celnych.',
  'api.avis.downloadAll':'Pobierz wszystkie załączniki',
  'api.avis.downloadAllCategory':'ZIP · Wszystkie dokumenty',
  'api.avis.zipNoDocuments':'Dla tej przesyłki nie są dostępne żadne załączniki.',
  'api.avis.zipTooManyDocuments':'Za dużo załączników do pobrania zbiorczego.',
  'api.avis.zipDocumentFailed':'Pobieranie zbiorcze zostało przerwane, ponieważ nie udało się w pełni wczytać pliku „{{name}}”.',
  'api.avis.zipTooLarge':'Łączny rozmiar załączników jest zbyt duży do pobrania zbiorczego.'
 }),
 es:Object.freeze({
  'api.pickup.customsSignatureRequired':'Registre la segunda firma del conductor que confirma la recepción de los documentos aduaneros.',
  'api.avis.downloadAll':'Descargar todos los archivos adjuntos',
  'api.avis.downloadAllCategory':'ZIP · Todos los documentos',
  'api.avis.zipNoDocuments':'No hay archivos adjuntos disponibles para este envío.',
  'api.avis.zipTooManyDocuments':'Hay demasiados archivos adjuntos para una descarga conjunta.',
  'api.avis.zipDocumentFailed':'La descarga conjunta se canceló porque no se pudo cargar completamente «{{name}}».',
  'api.avis.zipTooLarge':'El tamaño total de los archivos adjuntos es demasiado grande para una descarga conjunta.'
 }),
 fr:Object.freeze({
  'api.pickup.customsSignatureRequired':'Veuillez saisir la deuxième signature du chauffeur confirmant la réception des documents douaniers.',
  'api.avis.downloadAll':'Télécharger toutes les pièces jointes',
  'api.avis.downloadAllCategory':'ZIP · Tous les documents',
  'api.avis.zipNoDocuments':'Aucune pièce jointe n’est disponible pour cet envoi.',
  'api.avis.zipTooManyDocuments':'Il y a trop de pièces jointes pour un téléchargement groupé.',
  'api.avis.zipDocumentFailed':'Le téléchargement groupé a été annulé car « {{name}} » n’a pas pu être chargé complètement.',
  'api.avis.zipTooLarge':'La taille totale des pièces jointes est trop importante pour un téléchargement groupé.'
 }),
 it:Object.freeze({
  'api.pickup.customsSignatureRequired':'Inserire la seconda firma dell’autista che conferma la ricezione dei documenti doganali.',
  'api.avis.downloadAll':'Scarica tutti gli allegati',
  'api.avis.downloadAllCategory':'ZIP · Tutti i documenti',
  'api.avis.zipNoDocuments':'Non sono disponibili allegati per questa spedizione.',
  'api.avis.zipTooManyDocuments':'Ci sono troppi allegati per un download cumulativo.',
  'api.avis.zipDocumentFailed':'Il download cumulativo è stato annullato perché non è stato possibile caricare completamente “{{name}}”.',
  'api.avis.zipTooLarge':'La dimensione totale degli allegati è troppo grande per un download cumulativo.'
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
function valueFor(lang,key){
 const code=normalize(lang)||'de',override=overrides[code]&&overrides[code][key],pack=packs[code]||packs.de;
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
