(function(){
'use strict';
if(window.__EXPORTHUB_RC1113_STOWPLAN_PERSIST__)return;
window.__EXPORTHUB_RC1113_STOWPLAN_PERSIST__=true;

var VERSION='RC1113',saveTimer=0,lastRenderedSignature='';

function q(v){return String(v==null?'':v).trim()}
function num(v){var n=Number(v);return Number.isFinite(n)?n:0}
function arr(v){return Array.isArray(v)?v:[]}
function round(v,d){var p=Math.pow(10,d||0);return Math.round(num(v)*p)/p}
function activeShipment(){
 try{if(typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'){var x=window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__();if(x&&typeof x==='object')return x}}catch(_){}
 try{var r=window.ExportHUBClean&&window.ExportHUBClean.runtime;return r&&r.shipment&&typeof r.shipment==='object'?r.shipment:null}catch(_){return null}
}
function savedShipment(){
 try{if(typeof window.currentSaved==='function'){var x=window.currentSaved();if(x&&typeof x==='object')return x}}catch(_){}
 return null
}
function locked(sh){
 if(!sh||typeof sh!=='object')return true;
 var status=q(sh.status||sh.state||sh.shipmentStatus).toLowerCase();
 if(/abgeholt|picked|pod|abgeschlossen|completed|archiviert|archived/.test(status))return true;
 if(sh.podAvailable===true||sh.hasPod===true||arr(sh.pods).length||arr(sh.podFiles).length)return true;
 return false
}
function orientation(p){return p&&p.rotated?'quer':'längs'}
function dimension(p){
 var a=Math.round(num(p&&p.lengthAlong)),b=Math.round(num(p&&p.crossWidth));
 return a&&b?a+'×'+b+' cm':'Maße nicht vollständig'
}
function planSignature(plan){
 return JSON.stringify({
  vehicleId:q(plan&&plan.vehicleId),
  vehicleLength:num(plan&&plan.vehicleLength),
  vehicleWidth:num(plan&&plan.vehicleWidth),
  totalUnits:num(plan&&plan.totalUnits),
  totalFloorUnits:num(plan&&plan.totalFloorUnits),
  usedCm:round(plan&&plan.usedCm,2),
  overflowCm:round(plan&&plan.overflowCm,2),
  placements:arr(plan&&plan.placements).map(function(p){return[
   num(p.step),num(p.rowNo),q(p.position),q(p.type),num(p.sourceRow),num(p.physicalCount),
   orientation(p),num(p.lengthAlong),num(p.crossWidth),num(p.height),num(p.stackFactor)
  ]})
 })
}
function snapshotFromPlan(plan){
 var signature=planSignature(plan);
 return{
  version:VERSION,
  signature:signature,
  generatedAt:new Date().toISOString(),
  vehicle:{
   id:q(plan&&plan.vehicleId),
   label:q(plan&&plan.vehicleLabel),
   kind:q(plan&&plan.vehicleKind),
   lengthCm:num(plan&&plan.vehicleLength),
   widthCm:num(plan&&plan.vehicleWidth)
  },
  capacity:{
   totalUnits:num(plan&&plan.totalUnits),
   floorUnits:num(plan&&plan.totalFloorUnits),
   totalWeight:round(plan&&plan.totalWeight,3),
   usedCm:round(plan&&plan.usedCm,2),
   freeCm:round(plan&&plan.freeCm,2),
   overflowCm:round(plan&&plan.overflowCm,2)
  },
  rows:arr(plan&&plan.rows).map(function(row){return{
   no:num(row.no),startCm:num(row.startCm),endCm:num(row.endCm),depthCm:num(row.depth),
   fillPct:round(row.fillPct,1),gapCm:round(row.gapWidth,1),
   placements:arr(row.placements).map(function(p){return{
    step:num(p.step),sourceRow:num(p.sourceRow),position:q(p.position),type:q(p.type),
    physicalCount:num(p.physicalCount),stackFactor:num(p.stackFactor),orientation:orientation(p),
    lengthCm:num(p.lengthAlong),widthCm:num(p.crossWidth),heightCm:num(p.height)
   }})
  }})
 }
}
function instructionLines(plan){
 return arr(plan&&plan.placements).slice().sort(function(a,b){return num(a.step)-num(b.step)}).map(function(p){
  var stack=num(p.physicalCount)>1?' · '+num(p.physicalCount)+' gestapelt':'';
  return{
   step:num(p.step),
   row:num(p.rowNo),
   text:'R'+num(p.rowNo)+' · '+q(p.position)+' · '+q(p.type)+' · '+orientation(p)+' · '+dimension(p)+stack
  }
 })
}
function persist(plan){
 var sh=activeShipment(),saved=savedShipment();if(!sh||locked(sh))return false;
 var next=snapshotFromPlan(plan),previous=sh.stowPlanSnapshot&&sh.stowPlanSnapshot.signature;
 if(previous===next.signature)return false;
 sh.stowPlanSnapshot=next;
 if(saved&&saved!==sh&&!locked(saved))saved.stowPlanSnapshot=next;
 clearTimeout(saveTimer);
 saveTimer=setTimeout(function(){
  try{if(typeof window.scheduleEditSave==='function')window.scheduleEditSave('Stauplan automatisch erstellt und gespeichert',0)}catch(_){}
 },180);
 try{window.dispatchEvent(new CustomEvent('exporthub:stowplan-snapshot-updated',{detail:{signature:next.signature,version:VERSION}}))}catch(_){}
 return true
}
function renderInstructions(plan){
 var card=document.getElementById('rc380StowPlan');if(!card)return false;
 var old=card.querySelector('#rc1113-stow-instructions');if(old)old.remove();
 var lines=instructionLines(plan);if(!lines.length)return false;
 var section=document.createElement('section');section.id='rc1113-stow-instructions';section.setAttribute('data-rc1113-stow-instructions','1');
 section.style.cssText='margin-top:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;padding:10px;break-inside:avoid';
 section.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><b style="font-size:13px;color:#08245d">Ladeanweisung</b><div style="font-size:10px;color:#64748b;margin-top:2px">Reihenfolge von der Stirnwand Richtung Türen. Quer/Längs ist je Ladeeinheit angegeben.</div></div><span style="font-size:9px;font-weight:800;border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:999px;padding:3px 7px">automatisch erstellt &amp; mit Sendung gespeichert</span></div><ol style="margin:8px 0 0 20px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:5px 18px">'+lines.map(function(x){return'<li style="font-size:10px;line-height:1.3;color:#334155;padding-left:2px"><b>Schritt '+x.step+':</b> '+escapeHtml(x.text)+'</li>'}).join('')+'</ol>';
 var actions=card.querySelector('.rc396-actions');if(actions)card.insertBefore(section,actions);else card.appendChild(section);
 return true
}
function escapeHtml(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function currentPlan(){
 try{
  if(typeof window.stowRows!=='function'||typeof window.currentStowVehicle!=='function'||typeof window.buildStowPlan!=='function')return null;
  var rows=window.stowRows(),vehicle=window.currentStowVehicle();
  if(!arr(rows).length)return null;
  return window.buildStowPlan(rows,vehicle)
 }catch(_){return null}
}
function decorate(){
 var plan=currentPlan();if(!plan)return false;
 var sig=planSignature(plan);
 if(sig!==lastRenderedSignature){lastRenderedSignature=sig;persist(plan)}
 renderInstructions(plan);
 return true
}
function install(){
 if(typeof window.renderStowPlan!=='function')return false;
 if(window.renderStowPlan.__rc1113===true){decorate();return true}
 var original=window.renderStowPlan;
 function wrapped(){var out=original.apply(this,arguments);try{decorate()}catch(e){console.error('RC1113 Stauplan',e)}return out}
 wrapped.__rc1113=true;wrapped.__base1113=original;window.renderStowPlan=wrapped;
 try{decorate()}catch(_){}
 return true
}
function schedule(){
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(function(){if(!install())setTimeout(schedule,120);else decorate()});
 else setTimeout(function(){if(!install())schedule();else decorate()},0)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved'].forEach(function(name){window.addEventListener(name,schedule)});
document.addEventListener('change',function(e){if(e.target&&e.target.id==='rc713VehicleType')setTimeout(decorate,40)},true);

window.ExportHUBRC1113StowPlan=Object.freeze({version:VERSION,planSignature:planSignature,snapshotFromPlan:snapshotFromPlan,instructionLines:instructionLines,decorate:decorate});
})();