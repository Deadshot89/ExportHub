(function(){
'use strict';
if(window.__EXPORTHUB_RC1037_LIEFERAVIS_TIMING__)return;
window.__EXPORTHUB_RC1037_LIEFERAVIS_TIMING__=true;

var STORAGE_KEY='exporthub:lieferavis-timing';
var EVENT_NAME='exporthub:lieferavis-timing';
var nativeFetch=window.fetch;

function num(v){var n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n):0}
function normalize(data){
 var t=data&&data.timing;
 if(!t||typeof t!=='object')return null;
 return{
  authMs:num(t.authMs),
  teamBlobMs:num(t.teamBlobMs),
  teamReadMs:num(t.teamReadMs),
  flagWriteMs:num(t.flagWriteMs),
  tokenIssueMs:num(t.tokenIssueMs),
  totalMs:num(t.totalMs),
  reference:String(data.reference||'').trim().toUpperCase(),
  shipmentId:String(data.shipmentId||'').trim(),
  version:String(data.version||'RC1036').trim(),
  capturedAt:new Date().toISOString()
 }
}
function save(timing){
 if(!timing)return false;
 try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(timing))}catch(_){}
 try{window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:timing}))}catch(_){}
 scheduleRender();
 return true
}
function load(){
 try{var raw=sessionStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):null}catch(_){return null}
}
function isIssueResponse(data){return !!(data&&data.ok===true&&data.issued===true&&data.timing&&typeof data.timing==='object')}
function inspectResponse(response){
 try{
  if(!response||typeof response.clone!=='function')return;
  var clone=response.clone();
  clone.json().then(function(data){if(isIssueResponse(data))save(normalize(data))}).catch(function(){});
 }catch(_){}
}
if(typeof nativeFetch==='function'){
 window.fetch=function(){
  var result=nativeFetch.apply(this,arguments);
  try{return Promise.resolve(result).then(function(response){
   try{var url=String(response&&response.url||'');if(/\/api\/customer-avis(?:\?|$)/i.test(url))inspectResponse(response)}catch(_){}
   return response
  })}catch(_){return result}
 };
}

function diagnosticsVisible(){
 try{var cloud=window.ExportHUBDiagnosticsCloud864;if(!cloud||typeof cloud.isGlobalAdmin!=='function'||!cloud.isGlobalAdmin())return false}catch(_){return false}
 try{var s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():{};if(String(s&&s.view||'').toLowerCase()==='diagnostics')return true}catch(_){}
 try{return Array.prototype.some.call(document.querySelectorAll('h1,h2,h3'),function(h){return /fehlerdiagnose/i.test(String(h.textContent||''))})}catch(_){return false}
}
function tr(key,vars,fallback){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){var v=window.ExportHUBI18n.t(key,vars);if(v&&v!==key)return v}}catch(_){}return fallback||key}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function bottleneck(t){
 var rows=[[tr('avisTiming.auth',null,'Authentication'),num(t.authMs)],[tr('avisTiming.prepareStorage',null,'Prepare team storage'),num(t.teamBlobMs)],[tr('avisTiming.readState',null,'Read team state'),num(t.teamReadMs)],[tr('avisTiming.writeState',null,'Save team state'),num(t.flagWriteMs)],[tr('avisTiming.createToken',null,'Create token'),num(t.tokenIssueMs)]];
 rows.sort(function(a,b){return b[1]-a[1]});
 return rows[0]
}
function root(){return document.getElementById('rc1013-diagnostics-enhanced')||document.getElementById('content')||document.body}
function render(){
 if(!diagnosticsVisible())return false;
 var t=load();if(!t)return false;
 var host=document.getElementById('rc1037-lieferavis-timing');
 if(!host){host=document.createElement('section');host.id='rc1037-lieferavis-timing';root().appendChild(host)}
 var slow=bottleneck(t),ref=t.reference||'—';
 host.innerHTML='<div style="margin-top:10px;padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#fff"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>'+esc(tr('avisTiming.title',null,'Collection notice server timing'))+'</strong><span>'+esc(tr('avisTiming.reference',{reference:ref},'Reference '+ref))+'</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:10px"><div><b>'+esc(tr('avisTiming.auth',null,'Authentication'))+'</b><br>'+num(t.authMs)+' ms</div><div><b>'+esc(tr('avisTiming.prepareStorage',null,'Prepare team storage'))+'</b><br>'+num(t.teamBlobMs)+' ms</div><div><b>'+esc(tr('avisTiming.readState',null,'Read team state'))+'</b><br>'+num(t.teamReadMs)+' ms</div><div><b>'+esc(tr('avisTiming.writeState',null,'Save team state'))+'</b><br>'+num(t.flagWriteMs)+' ms</div><div><b>'+esc(tr('avisTiming.createToken',null,'Create token'))+'</b><br>'+num(t.tokenIssueMs)+' ms</div><div><b>'+esc(tr('avisTiming.total',null,'Total time'))+'</b><br>'+num(t.totalMs)+' ms</div></div><div style="margin-top:10px"><b>'+esc(tr('avisTiming.slowest',null,'Slowest measured step:'))+'</b> '+esc(slow[0])+' ('+slow[1]+' ms)</div><div style="margin-top:4px;font-size:12px;color:#64748b">'+esc(tr('avisTiming.measurement',{time:t.capturedAt||'',version:t.version||'RC1036'},'Measurement '+(t.capturedAt||'')+' · '+(t.version||'RC1036')))+'</div></div>';
 return true
}
var timer=0;
function scheduleRender(){clearTimeout(timer);timer=setTimeout(render,120)}
window.addEventListener(EVENT_NAME,scheduleRender);
window.addEventListener('exporthub:view-changed',scheduleRender);
window.addEventListener('hashchange',scheduleRender);
document.addEventListener('click',function(){setTimeout(render,180)},true);
setTimeout(render,300);

window.ExportHUBRC1037LieferavisTiming={load:load,render:render,normalize:normalize,version:'RC1037'};
})();
