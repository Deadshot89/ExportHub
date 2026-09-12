(()=>{
'use strict';
if(window.__EXPORTHUB_RC1013_GATE41_UI__)return;window.__EXPORTHUB_RC1013_GATE41_UI__=true;
function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
function num(v){var n=Number(String(v==null?'':v).replace(',','.').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;}
function germanCountry(v){var s=q(v).toLowerCase();return s==='de'||s==='deutsch'||s==='deutschland'||s==='germany';}
function diagnosticMessage(data){
  var d=data||{},country=q(d.country),pallets=num(d.pallets),weight=num(d.weight),kgPer=num(d.kgPer),base=num(d.base),origin=q(d.origin),destination=q(d.destination),total=q(d.total),message='',ok=false,national=germanCountry(country);
  if(!origin||!destination)message='Gate41: Start- und Zielort müssen vollständig angegeben sein, bevor ein belastbarer Preis angezeigt werden kann.';
  else if(!country)message='Gate41: Zielland fehlt. Die automatische Gate41-Berechnung ist derzeit nur für nationalen Versand innerhalb Deutschlands freigegeben.';
  else if(!national)message='Gate41: Die automatische Versandkostenberechnung ist derzeit nur für nationalen Versand innerhalb Deutschlands freigegeben. Für '+country+' wird aktuell kein Gate41-Preis berechnet.';
  else if(!(pallets>0))message='Gate41: Palettenanzahl fehlt oder ist 0.';
  else if(!(weight>0))message='Gate41: Gesamtgewicht fehlt oder ist 0 kg.';
  else if(kgPer>800)message='Gate41: Kein automatischer Grundtarif für mehr als 800 kg je Palette hinterlegt. Für diese nationale Sendung ist aktuell keine automatische Gate41-Berechnung möglich.';
  else if(base>0){message='Gate41-Preis Deutschland berechnet'+(total?' · Gesamt: '+total:'')+'. Grundlage: '+pallets+' Palette(n), '+kgPer.toFixed(2)+' kg je Palette.';ok=true;}
  else message='Gate41: Für Deutschland konnte trotz gültiger Paletten- und Gewichtsdaten kein Grundtarif berechnet werden. Berechnung aktualisieren; bleibt der Wert 0 €, bitte die Fehlerdiagnose öffnen.';
  return{message:message,ok:ok,national:national};
}
function field(name){return document.querySelector('#rc626Shipping [data-section="gate"][data-rc501-field="'+name+'"]');}
function route(side){return document.querySelector('#rc626Shipping [data-section="gate"][data-rc501-route="'+side+'"]');}
function ensure(){
  var shipping=document.getElementById('rc626Shipping');if(!shipping)return null;
  var host=document.getElementById('rc1013GateStatus');if(host)return host;
  host=document.createElement('div');host.id='rc1013GateStatus';host.setAttribute('role','status');host.style.cssText='margin:12px 0;padding:12px 14px;border-radius:12px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:750;line-height:1.45';
  var result=document.querySelector('#rc626Shipping .rc501-result-card');if(result&&result.parentElement)result.parentElement.insertBefore(host,result);else shipping.prepend(host);
  return host;
}
function applyNationalScope(national){
  var base=document.getElementById('rc501GateBase'),save=document.querySelector('#rc626Shipping [data-rc501-action="save"][data-kind="gate"]');
  if(base){base.disabled=!national;if(!national)base.value='';}
  if(save)save.disabled=!national;
}
function markUnavailable(result){
  if(result&&result.ok)return false;
  var total=document.getElementById('rc501GateTotal');
  if(total&&q(total.textContent)!=='nicht berechenbar')total.textContent='nicht berechenbar';
  var base=document.getElementById('rc501GateBase');
  if(base&&!(num(base.value)>0)&&base.value!=='')base.value='';
  return true;
}
function update(){
  var host=ensure();if(!host)return false;
  var data={
    country:q(field('country')&&field('country').value),
    pallets:num(field('pallets')&&field('pallets').value),
    weight:num(field('totalWeight')&&field('totalWeight').value),
    kgPer:num(document.getElementById('rc501GateKgPerPallet')&&document.getElementById('rc501GateKgPerPallet').value),
    base:num(document.getElementById('rc501GateBase')&&document.getElementById('rc501GateBase').value),
    origin:q(route('origin')&&route('origin').value),
    destination:q(route('destination')&&route('destination').value),
    total:q(document.getElementById('rc501GateTotal')&&document.getElementById('rc501GateTotal').textContent)
  };
  var result=diagnosticMessage(data);
  applyNationalScope(result.national);
  markUnavailable(result);
  host.textContent=result.message;
  host.style.background=result.ok?'#f0fdf4':'#fff7ed';host.style.borderColor=result.ok?'#86efac':'#fdba74';host.style.color=result.ok?'#166534':'#9a3412';return result.ok;
}
window.ExportHUBRC1041Gate41Diagnostics=Object.freeze({diagnosticMessage:diagnosticMessage,nationalOnly:true});
var timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(update,80);}
window.addEventListener('click',schedule,true);window.addEventListener('input',schedule,true);window.addEventListener('change',schedule,true);['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(n=>window.addEventListener(n,schedule));
if(window.MutationObserver){var mo=new MutationObserver(()=>{if(document.getElementById('rc626Shipping'))schedule();});mo.observe(document.documentElement,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
