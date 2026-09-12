(function(){
'use strict';
if(window.__EXPORTHUB_RC1061_DOCUMENT_MIGRATION_ADMIN__)return;
window.__EXPORTHUB_RC1061_DOCUMENT_MIGRATION_ADMIN__=true;

var BATCH_SIZE=5;
function q(v){return String(v==null?'':v).trim()}
function lower(v){return q(v).toLowerCase()}
function isAdmin(user){
  var role=lower(user&&(user.role||user.rolle));
  return !!(user&&(user.globalAdmin===true||role==='admin'||/global.?admin|administrator|vollzugriff/i.test(role)||(Array.isArray(user.permissions)&&user.permissions.indexOf('*')>=0)));
}
function environmentName(){return typeof location!=='undefined'&&/-testservice\./i.test(String(location.hostname||''))?'testservice':'production'}
function state(){try{if(typeof window.__EXPORTHUB_GET_STATE__==='function')return window.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return window.ExportHUBClean&&window.ExportHUBClean.state||window.appState||{}}
function currentUser(){var s=state();try{if(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=window.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}return window.currentUser||s.currentUser||s.activeUser||null}
function authToken(){var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{};return q(rt.authToken||rt.sessionToken||'')}
function headers(){var token=authToken();if(!token)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':environmentName()}}
async function runBatch(){var r=await fetch('/api/exporthub-document-migrate',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify({environment:environmentName(),limit:BATCH_SIZE})}),data=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(q(data&&data.message)||('HTTP '+r.status));return data}
async function health(){var r=await fetch('/api/exporthub-state?mode=health',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json','Cache-Control':'no-cache'}}),data=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(q(data&&data.message)||('HTTP '+r.status));return data}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
async function runAll(options){
  options=options||{};
  var onProgress=typeof options.onProgress==='function'?options.onProgress:function(){};
  var shouldStop=typeof options.shouldStop==='function'?options.shouldStop:function(){return false};
  var waitMs=Number.isFinite(Number(options.waitMs))?Math.max(0,Number(options.waitMs)):150;
  var totals={found:0,migrated:0,failed:0,remaining:0,bytesMoved:0,batches:0,done:false,stopped:false};
  var previousRemaining=null;
  for(var guard=0;guard<1000;guard++){
    if(shouldStop()){totals.stopped=true;return totals}
    var r=await runBatch(),migrated=Number(r&&r.migrated||0),failed=Number(r&&r.failed||0),remaining=Number(r&&r.remaining||0);
    totals.batches++;
    if(totals.batches===1)totals.found=Number(r&&r.found||remaining+migrated);
    else totals.found=Math.max(totals.found,totals.migrated+migrated+remaining);
    totals.migrated+=migrated;
    totals.failed+=failed;
    totals.remaining=remaining;
    totals.bytesMoved+=Number(r&&r.bytesMoved||0);
    totals.done=r&&r.done===true||remaining===0;
    onProgress(r,Object.assign({},totals));
    if(failed>0){
      var failedError=new Error('Mindestens ein Dokument konnte nicht migriert werden.');
      failedError.code='DOCUMENT_MIGRATION_BATCH_FAILED';failedError.result=Object.assign({},totals);throw failedError
    }
    if(totals.done)return totals;
    if(migrated<=0||(previousRemaining!==null&&remaining>=previousRemaining)){
      var stalled=new Error('Die Dokumentmigration macht keinen Fortschritt und wurde sicher angehalten.');
      stalled.code='DOCUMENT_MIGRATION_STALLED';stalled.result=Object.assign({},totals);throw stalled
    }
    previousRemaining=remaining;
    if(shouldStop()){totals.stopped=true;return totals}
    if(waitMs>0)await sleep(waitMs)
  }
  var guardError=new Error('Die automatische Dokumentmigration wurde nach zu vielen Batches sicher angehalten.');
  guardError.code='DOCUMENT_MIGRATION_GUARD';guardError.result=Object.assign({},totals);throw guardError
}
function bytes(v){var n=Number(v||0);if(!Number.isFinite(n)||n<=0)return'0 B';var units=['B','KB','MB','GB'],i=Math.min(units.length-1,Math.floor(Math.log(n)/Math.log(1024)));return(n/Math.pow(1024,i)).toFixed(i===0?0:1)+' '+units[i]}
function adminView(){var s=state(),view=lower(s.view||s.currentView||'');if(/rights|settings|user|admin|benutzer|rechte|einstellung/.test(view))return true;if(typeof document==='undefined')return false;var content=document.getElementById('content');return !!(content&&/benutzer|rechte|einstellungen|administration/i.test(q(content.textContent).slice(0,2500)))}
function metric(label,value){return'<div style="padding:10px 12px;border:1px solid #d9e1ea;border-radius:10px;background:#fff"><div style="font-size:12px;color:#667085">'+label+'</div><div style="font-size:20px;font-weight:700;margin-top:4px">'+value+'</div></div>'}
function ensureCard(){
  if(typeof document!=='undefined'){
    var old=document.getElementById('rc1061DocumentMigrationAdmin');
    if(old&&old.parentNode)old.parentNode.removeChild(old);
  }
  return false
}
// RC1069: Die einmalige Migration bleibt als API/Recovery-Funktion erhalten,
// wird nach Abschluss aber nicht mehr als dauerhafte Admin-Karte in ExportHUB gerendert.
window.ExportHUBRC1061DocumentMigrationAdmin={isAdmin:isAdmin,runBatch:runBatch,runAll:runAll,ensureCard:ensureCard,health:health,environmentName:environmentName,batchSize:BATCH_SIZE};
})();
