'use strict';
const packs={
 de:require('./i18n/de.json'),
 en:require('./i18n/en.json'),
 pl:require('./i18n/pl.json'),
 es:require('./i18n/es.json'),
 fr:require('./i18n/fr.json'),
 it:require('./i18n/it.json')
};
// RC1432: RC1379 hatte diesen Schlüssel fachlich auf eine Checkbox-Bestätigung
// umgedeutet. Für ABD-Sendungen ist wieder die zweite Fahrerunterschrift
// "Zolldokumente erhalten" verbindlich; nur dieser Schlüssel wird übersteuert.
const overrides=Object.freeze({
 de:Object.freeze({'api.pickup.customsSignatureRequired':'Bitte die zweite Fahrerunterschrift „Zolldokumente erhalten“ erfassen.'}),
 en:Object.freeze({'api.pickup.customsSignatureRequired':'Please capture the driver’s second signature confirming receipt of the customs documents.'}),
 pl:Object.freeze({'api.pickup.customsSignatureRequired':'Proszę złożyć drugi podpis kierowcy potwierdzający odbiór dokumentów celnych.'}),
 es:Object.freeze({'api.pickup.customsSignatureRequired':'Registre la segunda firma del conductor que confirma la recepción de los documentos aduaneros.'}),
 fr:Object.freeze({'api.pickup.customsSignatureRequired':'Veuillez saisir la deuxième signature du chauffeur confirmant la réception des documents douaniers.'}),
 it:Object.freeze({'api.pickup.customsSignatureRequired':'Inserire la seconda firma dell’autista che conferma la ricezione dei documenti doganali.'})
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
