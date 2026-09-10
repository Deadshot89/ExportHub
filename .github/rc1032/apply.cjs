'use strict';
const fs=require('fs');

function read(path){return fs.readFileSync(path,'utf8')}
function write(path,content){fs.writeFileSync(path,content)}
function replaceOnce(source,before,after,label){
 const first=source.indexOf(before);
 if(first<0)throw new Error('RC1032 Patchanker fehlt: '+label);
 if(source.indexOf(before,first+before.length)>=0)throw new Error('RC1032 Patchanker nicht eindeutig: '+label);
 return source.slice(0,first)+after+source.slice(first+before.length);
}

{
 const path='TESTVERSION.html';let s=read(path);
 const start=s.indexOf('function printStow(){');
 const end=s.indexOf('function normalizeActionButtons',start);
 if(start<0||end<=start)throw new Error('RC1032 printStow-Bereich nicht eindeutig gefunden');
 const next="function printStow(){var card=document.getElementById('rc380StowPlan'),graphic=card&&card.querySelector('.rc717-shell');if(!graphic||!q(graphic.textContent)){alert('Es sind noch keine Colli-Daten für den Stauplan vorhanden.');return false}var html='<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Stauplan '+esc(refOf(shipment()))+'</title></head><body><section id=\"rc380StowPlan\">'+graphic.outerHTML+'</section></body></html>',w=window.open('about:blank','_blank','width=1200,height=820');if(!w){alert('Das Druckfenster wurde vom Browser blockiert.');return false}try{w.opener=null;w.document.open();w.document.write(html);w.document.close();Array.prototype.slice.call(document.querySelectorAll('style')).forEach(function(node){var css=String(node.textContent||'');if(css.indexOf('rc717')<0&&css.indexOf('#rc380StowPlan')<0)return;var copy=w.document.createElement('style');copy.textContent=css;w.document.head.appendChild(copy)});var printStyle=w.document.createElement('style');printStyle.textContent='@page{size:A4 landscape;margin:8mm}html,body{margin:0!important;padding:0!important;background:#fff!important;width:100%!important}body{overflow:visible!important}#rc380StowPlan{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:#fff!important}#rc380StowPlan .rc717-shell{display:grid!important;width:100%!important;max-width:none!important;margin:0!important;break-inside:avoid!important;page-break-inside:avoid!important}#rc380StowPlan .rc717-vehicle,#rc380StowPlan .rc717-box,#rc380StowPlan .rc717-floor{width:100%!important;max-width:none!important}';w.document.head.appendChild(printStyle);var run=function(){try{w.focus();w.print()}catch(e){console.error('Stauplan drucken',e)}};if(w.document.readyState==='complete')setTimeout(run,250);else w.addEventListener('load',function(){setTimeout(run,200)},{once:true});return false}catch(e){try{w.close()}catch(_){}alert('Der Stauplan konnte nicht geöffnet werden: '+q(e&&e.message||e));return false}}\n";
 s=s.slice(0,start)+next+s.slice(end);
 write(path,s);
}

{
 const path='assets/rc1015-lieferavis-mail-flow.js';let s=read(path);
 s=replaceOnce(s,"if(on){rc1024ClearDraftDisabled(sh);await rc1015PersistBeforeAvis()}","if(on){rc1024ClearDraftDisabled(sh);if(!rc1021Persisted(sh))await rc1015PersistBeforeAvis()}",'Avis Toggle Full-State-Save');
 s=replaceOnce(s,"  await rc1015PersistBeforeAvis();\n  sh=currentShipmentForAvis()||sh;","  sh=currentShipmentForAvis()||sh;",'Avis Auto-Enable zweiter Save');
 write(path,s);
}

for(const path of ['.github/rc1013/build-three-env.mjs','.github/rc1018/apply-standard-deploy.mjs','.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','test/rc1024-lieferavis-load-order.test.mjs']){
 let s=read(path),count=(s.match(/rc1015-lieferavis-mail-flow\.js\?v=1021/g)||[]).length;
 if(count<1)throw new Error('RC1032 Avis Cache-Key-Anker fehlt in '+path);
 s=s.replaceAll('rc1015-lieferavis-mail-flow.js?v=1021','rc1015-lieferavis-mail-flow.js?v=1032');
 write(path,s);
}

console.log('RC1032 Stauplan-Druck und Avis-Fastpath angewendet.');
