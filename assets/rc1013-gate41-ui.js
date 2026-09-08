(()=>{
'use strict';
if(window.__EXPORTHUB_RC1013_GATE41_UI__)return;window.__EXPORTHUB_RC1013_GATE41_UI__=true;
function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
function num(v){var n=Number(String(v==null?'':v).replace(',','.').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;}
function field(name){return document.querySelector('#rc626Shipping [data-section="gate"][data-rc501-field="'+name+'"]');}
function route(side){return document.querySelector('#rc626Shipping [data-section="gate"][data-rc501-route="'+side+'"]');}
function ensure(){
  var shipping=document.getElementById('rc626Shipping');if(!shipping)return null;
  var host=document.getElementById('rc1013GateStatus');if(host)return host;
  host=document.createElement('div');host.id='rc1013GateStatus';host.setAttribute('role','status');host.style.cssText='margin:12px 0;padding:12px 14px;border-radius:12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:750;line-height:1.45';
  var result=document.querySelector('#rc626Shipping .rc501-result-card');if(result&&result.parentElement)result.parentElement.insertBefore(host,result);else shipping.prepend(host);
  return host;
}
function update(){
  var host=ensure();if(!host)return false;
  var country=q(field('country')&&field('country').value),pallets=num(field('pallets')&&field('pallets').value),weight=num(field('totalWeight')&&field('totalWeight').value),kgPer=num(document.getElementById('rc501GateKgPerPallet')&&document.getElementById('rc501GateKgPerPallet').value),base=num(document.getElementById('rc501GateBase')&&document.getElementById('rc501GateBase').value),origin=q(route('origin')&&route('origin').value),destination=q(route('destination')&&route('destination').value),total=q(document.getElementById('rc501GateTotal')&&document.getElementById('rc501GateTotal').textContent);
  var message='',ok=false;
  if(!origin||!destination)message='Gate41: Start- und Zielort müssen vollständig angegeben sein, bevor ein belastbarer Preis angezeigt werden kann.';
  else if(!country)message='Gate41: Zielland fehlt. Bei einer deutschen Sendung wird Deutschland automatisch verwendet; andernfalls bitte Zielland prüfen.';
  else if(!(pallets>0))message='Gate41: Palettenanzahl fehlt oder ist 0.';
  else if(!(weight>0))message='Gate41: Gesamtgewicht fehlt oder ist 0 kg.';
  else if(kgPer>800)message='Gate41: Kein automatischer Grundtarif für mehr als 800 kg je Palette hinterlegt. Bitte gültige Grundfracht manuell eintragen; ExportHUB erfindet keinen Preis.';
  else if(base>0){message='Gate41-Preis berechnet'+(total?' · Gesamt: '+total:'')+'. Grundlage: '+pallets+' Palette(n), '+kgPer.toFixed(2)+' kg je Palette, '+country+'.';ok=true;}
  else message='Gate41: Für diese Sendungsdaten wurde noch kein passender Grundtarif ermittelt. Zielland, Palettenanzahl und Gewicht prüfen.';
  host.textContent=message;host.style.background=ok?'#f0fdf4':'#fff7ed';host.style.borderColor=ok?'#86efac':'#fdba74';host.style.color=ok?'#166534':'#9a3412';return ok;
}
var timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(update,80);}
window.addEventListener('click',schedule,true);window.addEventListener('input',schedule,true);window.addEventListener('change',schedule,true);['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(n=>window.addEventListener(n,schedule));
if(window.MutationObserver){var mo=new MutationObserver(()=>{if(document.getElementById('rc626Shipping'))schedule();});mo.observe(document.documentElement,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
