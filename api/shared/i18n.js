'use strict';
const packs={
 de:require('./i18n/de.json'),
 en:require('./i18n/en.json'),
 pl:require('./i18n/pl.json'),
 es:require('./i18n/es.json'),
 fr:require('./i18n/fr.json'),
 it:require('./i18n/it.json')
};
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
function t(req,key,vars,payload){
 const lang=language(req,payload),pack=packs[lang]||packs.de,value=pack[key]!=null?pack[key]:packs.de[key];
 return interpolate(value!=null?value:key,vars||{});
}
function tLang(lang,key,vars){
 const code=normalize(lang)||'de',pack=packs[code]||packs.de,value=pack[key]!=null?pack[key]:packs.de[key];
 return interpolate(value!=null?value:key,vars||{});
}
module.exports=Object.freeze({supported,normalize,language,t,tLang});
