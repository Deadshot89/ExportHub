(()=>{
'use strict';
if(window.__EXPORTHUB_RC1013_GATE41_UI__)return;window.__EXPORTHUB_RC1013_GATE41_UI__=true;
function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
function tr(key,vars){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function')return window.ExportHUBI18n.t(key,vars)}catch(_){}return key;}
function num(v){var n=Number(String(v==null?'':v).replace(',','.').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;}
function germanCountry(v){var s=q(v).toLowerCase();return s==='de'||s==='deutsch'||s==='deutschland'||s==='germany';}
function diagnosticMessage(data){
  var d=data||{},country=q(d.country),pallets=num(d.pallets),weight=num(d.weight),kgPer=num(d.kgPer),base=num(d.base),origin=q(d.origin),destination=q(d.destination),total=q(d.total),message='',ok=false,national=germanCountry(country);
  if(!origin||!destination)message=tr('gate41.missingLocations');
  else if(!country)message=tr('gate41.missingCountry');
  else if(!national)message=tr('gate41.international',{country:country});
  else if(!(pallets>0))message=tr('gate41.palletsMissing');
  else if(!(weight>0))message=tr('gate41.weightMissing');
  else if(kgPer>800)message=tr('gate41.overweight');
  else if(base>0){message=tr('gate41.calculated',{total:total?' · '+total:'',pallets:pallets,kg:kgPer.toFixed(2)});ok=true;}
  else message=tr('gate41.noRate');
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
  if(total&&q(total.textContent)!==tr('gate41.unavailable'))total.textContent=tr('gate41.unavailable');
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
window.addEventListener('click',schedule,true);window.addEventListener('input',schedule,true);window.addEventListener('change',schedule,true);['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(n=>window.addEventListener(n,schedule));
if(window.MutationObserver){var mo=new MutationObserver(()=>{if(document.getElementById('rc626Shipping'))schedule();});mo.observe(document.documentElement,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
