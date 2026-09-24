(function(){
'use strict';
if(window.__EXPORTHUB_RC1113_STOWPLAN_PERSIST__)return;
window.__EXPORTHUB_RC1113_STOWPLAN_PERSIST__=true;

var VERSION='RC1113',saveTimer=0,lastRenderedSignature='';

function q(v){return String(v==null?'':v).trim()}
function tr(key,vars){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function')return window.ExportHUBI18n.t(key,vars)}catch(_){}return key}
function fmtNumber(v){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.formatNumber==='function')return window.ExportHUBI18n.formatNumber(v,{minimumFractionDigits:2,maximumFractionDigits:2})}catch(_){}return Number(v).toFixed(2)}
function num(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:0}
function arr(v){return Array.isArray(v)?v:[]}
function round(v,d){var p=Math.pow(10,d||0);return Math.round(num(v)*p)/p}
function low(v){return q(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}
function rowCount(r){return Math.max(0,Math.round(num(r&&(r.count||r.qty||r.anzahl||r.quantity||r.menge||r.colliCount))))}
function rowType(r){return q(r&&(r.type||r.packaging||r.verpackung||r.name))}
function stackFactor(r){var name=low(rowType(r));return /gestapelt|stacked/.test(name)&&/palette|paletten|pallet/.test(name)?2:1}
function knownDimensions(r){
 var l=num(r&&(r.l||r.length||r.lengthCm)),w=num(r&&(r.w||r.width||r.widthCm));
 if(l>0&&w>0)return{l:l,w:w,source:'row'};
 var name=low(rowType(r)),m=name.match(/^e([0-6])$/),dims=null;
 if(m){var e={0:[30,20],1:[39,20],2:[46,33],3:[43,31],4:[66,45],5:[66,45],6:[25,15]};dims=e[m[1]]}
 else if(/umschlag|envelope/.test(name))dims=[15,5];
 else if(/dusseldorfer.*palette|dusseldorf.*pallet/.test(name))dims=[80,60];
 else if(/plastic.*palette|plastic.*pallet|kunststoff.*palette/.test(name))dims=[122,116];
 else if(/industrie.*palette|industrial.*pallet/.test(name))dims=[120,100];
 else if(/paletten\s*gestell|palettengestell|pallet\s*rack/.test(name))dims=[120,90];
 else if(/euro.*palette|euro.*pallet|einweg.*palette|one.?way.*pallet/.test(name))dims=[120,80];
 return dims?{l:dims[0],w:dims[1],source:'packaging'}:null
}
function actualRowLdm(r,index){
 var count=rowCount(r),type=rowType(r),factor=stackFactor(r),dim=knownDimensions(r);
 if(count<=0)return{index:index,type:type,count:count,floorUnits:0,ldm:0,perPhysical:0,complete:true};
 if(!dim)return{index:index,type:type,count:count,floorUnits:Math.ceil(count/factor),ldm:null,perPhysical:null,complete:false,reason:'Länge/Breite fehlen'};
 var floorUnits=Math.ceil(count/factor),ldm=(floorUnits*dim.l*dim.w)/24000;
 return{index:index,type:type,count:count,floorUnits:floorUnits,stackFactor:factor,lengthCm:dim.l,widthCm:dim.w,dimensionSource:dim.source,ldm:ldm,perPhysical:count?ldm/count:0,complete:true}
}
function actualLdmSummary(rows){
 var source=arr(rows),parts=[],missing=[],total=0;
 source.forEach(function(r,i){var part=actualRowLdm(r,i);parts.push(part);if(part.complete)total+=num(part.ldm);else missing.push({index:i,type:part.type,reason:part.reason})});
 return{complete:missing.length===0,ldm:missing.length?null:total,rows:parts,missingRows:missing,widthCm:240}
}
function shipmentRows(sh){if(!sh||typeof sh!=='object')return[];return [sh.rows,sh.colli,sh.collis,sh.packages,sh.packagingRows].find(Array.isArray)||[]}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function syncActualLdm(sh){
 if(!sh||typeof sh!=='object')return false;
 var rows=shipmentRows(sh),summary=actualLdmSummary(rows),changed=false;
 if(!summary.complete){
  if(sh.actualLdmComplete!==false){sh.actualLdmComplete=false;changed=true}
  if(sh.actualLdm!==null){sh.actualLdm=null;changed=true}
  if(!same(sh.actualLdmMissingRows||[],summary.missingRows)){sh.actualLdmMissingRows=summary.missingRows;changed=true}
  return changed
 }
 summary.rows.forEach(function(part){var row=rows[part.index];if(!row||part.count<=0)return;var effective=round(part.perPhysical,6);if(Math.abs(num(row.ldm)-effective)>0.0000005){row.ldm=effective;changed=true}if(Math.abs(num(row.actualLdm)-num(part.ldm))>0.0000005){row.actualLdm=round(part.ldm,6);changed=true}if(row.actualFloorUnits!==part.floorUnits){row.actualFloorUnits=part.floorUnits;changed=true}});
 var total=round(summary.ldm,6);
 if(Math.abs(num(sh.totalLdm)-total)>0.0000005){sh.totalLdm=total;changed=true}
 if(Math.abs(num(sh.actualLdm)-total)>0.0000005){sh.actualLdm=total;changed=true}
 if(sh.actualLdmComplete!==true){sh.actualLdmComplete=true;changed=true}
 if((sh.actualLdmMissingRows||[]).length){sh.actualLdmMissingRows=[];changed=true}
 return changed
}
function renderActualLdm(sh){
 if(!sh||typeof sh!=='object')return false;
 var el=document.getElementById('rc344Sum_ldm');if(!el)return false;
 var summary=actualLdmSummary(shipmentRows(sh)),label=el.previousElementSibling;
 if(label&&label.textContent!==tr('stowplan.actualLdm'))label.textContent=tr('stowplan.actualLdm');
 var text=summary.complete?fmtNumber(num(summary.ldm)):tr('stowplan.dimensionsMissing');
 if(el.textContent!==text)el.textContent=text;
 el.setAttribute('data-actual-ldm',summary.complete?'1':'0');
 if(!summary.complete)el.setAttribute('title',tr('stowplan.actualLdmHelp'));else el.removeAttribute('title');
 return summary.complete
}
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
function orientation(p){return p&&p.rotated?'crosswise':'lengthwise'}
function orientationDisplay(p){return p&&p.rotated?tr('stowplan.orientationCrosswise'):tr('stowplan.orientationLengthwise')}
function dimension(p){
 var a=Math.round(num(p&&p.lengthAlong)),b=Math.round(num(p&&p.crossWidth));
 return a&&b?a+'×'+b+' cm':tr('stowplan.dimensionsIncomplete')
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
   actualLdm:round(plan&&plan.actualLdm,3),
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
  var stack=num(p.physicalCount)>1?' · '+tr('stowplan.stacked',{count:num(p.physicalCount)}):'';
  return{
   step:num(p.step),
   row:num(p.rowNo),
   text:'R'+num(p.rowNo)+' · '+q(p.position)+' · '+q(p.type)+' · '+orientationDisplay(p)+' · '+dimension(p)+stack
  }
 })
}
function persist(plan){
 var sh=activeShipment(),saved=savedShipment();if(!sh||locked(sh))return false;
 var ldmChanged=syncActualLdm(sh);if(saved&&saved!==sh&&!locked(saved))syncActualLdm(saved);
 var next=snapshotFromPlan(plan),previous=sh.stowPlanSnapshot&&sh.stowPlanSnapshot.signature;
 if(previous===next.signature&&!ldmChanged)return false;
 sh.stowPlanSnapshot=next;
 if(saved&&saved!==sh&&!locked(saved))saved.stowPlanSnapshot=next;
 clearTimeout(saveTimer);
 saveTimer=setTimeout(function(){
  try{if(typeof window.scheduleEditSave==='function')window.scheduleEditSave('Stauplan automatisch erstellt und gespeichert',0)}catch(_){}
 },180);
 try{window.dispatchEvent(new CustomEvent('exporthub:stowplan-snapshot-updated',{detail:{signature:next.signature,version:VERSION,actualLdm:sh.actualLdm}}))}catch(_){}
 return true
}
function renderInstructions(plan){
 var card=document.getElementById('rc380StowPlan');if(!card)return false;
 var old=card.querySelector('#rc1113-stow-instructions');if(old)old.remove();
 var lines=instructionLines(plan);if(!lines.length)return false;
 var section=document.createElement('section');section.id='rc1113-stow-instructions';section.setAttribute('data-rc1113-stow-instructions','1');
 section.style.cssText='margin-top:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;padding:10px;break-inside:avoid';
 section.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><b style="font-size:13px;color:#08245d">'+escapeHtml(tr('stowplan.instructionTitle'))+'</b><div style="font-size:10px;color:#64748b;margin-top:2px">'+escapeHtml(tr('stowplan.instructionHelp'))+'</div></div><span style="font-size:9px;font-weight:800;border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:999px;padding:3px 7px">'+escapeHtml(tr('stowplan.savedBadge'))+'</span></div><ol style="margin:8px 0 0 20px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:5px 18px">'+lines.map(function(x){return'<li style="font-size:10px;line-height:1.3;color:#334155;padding-left:2px"><b>'+escapeHtml(tr('stowplan.step',{step:x.step}))+'</b> '+escapeHtml(x.text)+'</li>'}).join('')+'</ol>';
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
function syncCurrent(){var sh=activeShipment();if(!sh)return false;var changed=syncActualLdm(sh),saved=savedShipment();if(saved&&saved!==sh&&!locked(saved))syncActualLdm(saved);renderActualLdm(sh);return changed}
function decorate(){
 var sh=activeShipment();if(sh)syncCurrent();
 var plan=currentPlan();if(!plan)return false;
 var sig=planSignature(plan);
 if(sig!==lastRenderedSignature){lastRenderedSignature=sig;persist(plan)}
 renderInstructions(plan);
 if(sh)renderActualLdm(sh);
 return true
}
function install(){
 if(typeof window.renderStowPlan!=='function')return false;
 if(window.renderStowPlan.__rc1113===true){decorate();return true}
 var original=window.renderStowPlan;
 function wrapped(){try{syncCurrent()}catch(e){console.error('RC1149 tatsächliche LDM',e)}var out=original.apply(this,arguments);try{decorate()}catch(e){console.error('RC1113 Stauplan',e)}return out}
 wrapped.__rc1113=true;wrapped.__base1113=original;window.renderStowPlan=wrapped;
 try{decorate()}catch(_){}
 return true
}
function schedule(){
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(function(){if(!install())setTimeout(schedule,120);else decorate()});
 else setTimeout(function(){if(!install())schedule();else decorate()},0)
}
function missingActualLdm(){var sh=activeShipment();return sh&&actualLdmSummary(shipmentRows(sh)).complete===false}
function documentActionTarget(target){var el=target&&target.closest&&target.closest('button,a,[role="button"]');if(!el)return null;var text=[q(el.textContent),q(el.getAttribute&&el.getAttribute('title')),q(el.getAttribute&&el.getAttribute('data-action'))].join(' ').toLowerCase();return /gesamtdruck|gesamt.*pdf|ladeliste|cmr/.test(text)?el:null}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved','exporthub:language-changed'].forEach(function(name){window.addEventListener(name,schedule)});
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('#rc573ColliCard'))setTimeout(function(){try{syncCurrent()}catch(_){}},0)},true);
document.addEventListener('change',function(e){if(e.target&&e.target.id==='rc713VehicleType')setTimeout(decorate,40);if(e.target&&e.target.closest&&e.target.closest('#rc573ColliCard'))setTimeout(function(){try{syncCurrent();decorate()}catch(_){}},0)},true);
document.addEventListener('click',function(e){var el=documentActionTarget(e.target);if(!el||!missingActualLdm())return;e.preventDefault();e.stopImmediatePropagation();alert(tr('stowplan.ldmBlocked'))},true);

window.ExportHUBRC1113StowPlan=Object.freeze({version:VERSION,planSignature:planSignature,snapshotFromPlan:snapshotFromPlan,instructionLines:instructionLines,actualLdmSummary:actualLdmSummary,syncActualLdm:syncActualLdm,decorate:decorate});
})();