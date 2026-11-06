'use strict';

const LINK_LABELS=Object.freeze({
 de:'Hier zur Avisierung klicken',
 en:'Click here to arrange pickup',
 pl:'Kliknij tutaj, aby zgłosić odbiór',
 es:'Haga clic aquí para gestionar la recogida',
 fr:'Cliquez ici pour organiser l’enlèvement',
 it:'Clicca qui per organizzare il ritiro'
});

function languageOf(value){
 const matched=String(value||'').trim().toLowerCase().replace('_','-').match(/^(de|en|pl|es|fr|it)(?:-|$)/);
 return matched?matched[1]:'de';
}
function escapeHtml(value){
 return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderAvisMailHtml(plainText,avisUrl,language){
 const lang=languageOf(language),url=new URL(String(avisUrl||''));
 if(url.protocol!=='https:')throw new Error('AVIS_HTML_URL_INVALID');
 url.searchParams.set('lang',lang);
 const fullUrl=url.toString(),source=String(plainText==null?'':plainText);
 const parts=source.split(fullUrl);
 if(parts.length!==2)throw new Error('AVIS_HTML_LINK_MISMATCH');
 const format=part=>escapeHtml(part).replace(/\r\n|\r|\n/g,'<br>');
 const button='<a href="'+escapeHtml(fullUrl)+'" style="display:inline-block;background:#155eef;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:22px;padding:12px 18px;border-radius:8px;">'+escapeHtml(LINK_LABELS[lang])+'</a>';
 return '<!doctype html><html lang="'+lang+'"><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:14px;line-height:1.65"><div style="max-width:680px;margin:0 auto">'+format(parts[0])+button+format(parts[1])+'</div></body></html>';
}
module.exports={LINK_LABELS,languageOf,renderAvisMailHtml};
