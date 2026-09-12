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
  if(typeof document==='undefined'||!isAdmin(currentUser())||!adminView())return false;
  var content=document.getElementById('content');if(!content)return false;
  var old=document.getElementById('rc1061DocumentMigrationAdmin');if(old&&old.parentNode!==content)old.remove();if(old)return true;
  var box=document.createElement('section');box.id='rc1061DocumentMigrationAdmin';box.setAttribute('data-exporthub-admin-only','true');box.style.cssText='margin:18px 0;padding:18px;border:1px solid #cfd8e3;border-radius:14px;background:#f8fafc;box-shadow:0 2px 8px rgba(15,23,42,.05)';
  box.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#475467">Admin · Dokumentmigration</div><h3 style="margin:4px 0 6px;font-size:20px">Dokumentmigration</h3><div id="rc1061MigrationEnv" style="font-size:13px;color:#667085">Umgebung: '+environmentName().toUpperCase()+'</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="rc1061MigrationRun" type="button" style="border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer;background:#111827;color:#fff">Alle verbleibenden migrieren</button><button id="rc1061MigrationStop" type="button" style="display:none;border:1px solid #cbd5e1;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#fff;color:#334155">Nach aktuellem Paket stoppen</button></div></div><div id="rc1061MigrationStatus" style="margin-top:12px;font-size:13px;color:#475467">Status wird geladen …</div><div style="height:9px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:12px"><div id="rc1061MigrationProgress" style="height:100%;width:0%;background:#111827;transition:width .2s ease"></div></div><div id="rc1061MigrationProgressText" style="margin-top:5px;font-size:12px;color:#667085">0 %</div><div id="rc1061MigrationMetrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px"></div>';
  content.insertBefore(box,content.firstChild||null);
  var button=box.querySelector('#rc1061MigrationRun'),stop=box.querySelector('#rc1061MigrationStop'),status=box.querySelector('#rc1061MigrationStatus'),metrics=box.querySelector('#rc1061MigrationMetrics'),progress=box.querySelector('#rc1061MigrationProgress'),progressText=box.querySelector('#rc1061MigrationProgressText');
  var totals={found:0,migrated:0,failed:0,remaining:0,bytesMoved:0,batches:0},running=false,stopRequested=false;
  function render(){
    var total=Math.max(0,Number(totals.found||0)),done=Math.max(0,Math.min(total,Number(totals.migrated||0))),pct=total?Math.min(100,Math.round(done/total*100)):(totals.remaining===0?100:0);
    metrics.innerHTML=metric('Gefunden',totals.found)+metric('Migriert',totals.migrated)+metric('Fehlgeschlagen',totals.failed)+metric('Verbleibend',totals.remaining)+metric('Verschoben',bytes(totals.bytesMoved));
    progress.style.width=pct+'%';progressText.textContent=done+' / '+total+' · '+pct+' %';
    button.disabled=running||(totals.remaining===0&&totals.found>0);button.style.opacity=button.disabled?'.55':'1';
    stop.style.display=running?'inline-block':'none';
    button.textContent=totals.remaining===0&&totals.found>0?'Migration abgeschlossen':'Alle verbleibenden migrieren'
  }
  health().then(function(h){var d=h&&h.stateDiagnostics||{},remaining=Number(d.inlinePayloadCount||0);totals.found=remaining;totals.remaining=remaining;status.textContent=remaining?'Bereit. Ein Klick migriert alle verbleibenden Dokumente automatisch in sicheren '+BATCH_SIZE+'er-Paketen.':'Keine Inline-Dokumente mehr gefunden.';render()}).catch(function(e){status.textContent='Status konnte nicht geladen werden: '+q(e&&e.message);render()});
  stop.addEventListener('click',function(){if(!running)return;stopRequested=true;stop.disabled=true;status.textContent='Stop angefordert. Das aktuelle '+BATCH_SIZE+'er-Paket wird noch sicher abgeschlossen …'});
  button.addEventListener('click',async function(){
    if(running)return;running=true;stopRequested=false;stop.disabled=false;button.disabled=true;status.textContent='Migration läuft automatisch …';render();
    var initialFound=Math.max(Number(totals.remaining||0),Number(totals.found||0));
    totals={found:initialFound,migrated:0,failed:0,remaining:Number(totals.remaining||initialFound),bytesMoved:0,batches:0};
    try{
      var result=await runAll({
        shouldStop:function(){return stopRequested},
        onProgress:function(batch,summary){
          totals.found=Math.max(initialFound,Number(summary.found||0));
          totals.migrated=Number(summary.migrated||0);totals.failed=Number(summary.failed||0);totals.remaining=Number(summary.remaining||0);totals.bytesMoved=Number(summary.bytesMoved||0);totals.batches=Number(summary.batches||0);
          status.textContent='Paket '+totals.batches+' abgeschlossen · '+totals.migrated+' von '+totals.found+' migriert · '+totals.remaining+' verbleiben.';render()
        }
      });
      if(result.stopped){status.textContent='Migration angehalten. '+totals.remaining+' Dokumente verbleiben.'}
      else{totals.remaining=0;status.textContent='Migration abgeschlossen. Alle '+totals.migrated+' Dokumente wurden in den Blob-Speicher übertragen.'}
    }catch(e){
      var result=e&&e.result||{};if(Number(result.remaining)>=0)totals.remaining=Number(result.remaining||0);if(Number(result.migrated)>=0)totals.migrated=Number(result.migrated||totals.migrated);if(Number(result.failed)>=0)totals.failed=Number(result.failed||totals.failed);if(Number(result.bytesMoved)>=0)totals.bytesMoved=Number(result.bytesMoved||totals.bytesMoved);
      status.textContent=e&&e.code==='DOCUMENT_MIGRATION_BATCH_FAILED'?'Automatik sicher gestoppt: Mindestens ein Dokument konnte nicht migriert werden. Bereits erfolgreiche Dokumente bleiben gespeichert. Bitte erneut versuchen oder den Fehler prüfen.':'Migration sicher angehalten: '+q(e&&e.message)
    }finally{running=false;stopRequested=false;stop.disabled=false;render()}
  });
  return true;
}
function schedule(){try{ensureCard()}catch(e){try{console.warn('RC1061 Admin-Migration UI',e)}catch(_){}}}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(schedule,0)},{once:true});else setTimeout(schedule,0);
  if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(function(){setTimeout(schedule,0)});try{mo.observe(document.documentElement,{childList:true,subtree:true})}catch(_){}}
  ['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(function(name){try{window.addEventListener(name,function(){setTimeout(schedule,0)})}catch(_){}})
}
window.ExportHUBRC1061DocumentMigrationAdmin={isAdmin:isAdmin,runBatch:runBatch,runAll:runAll,ensureCard:ensureCard,health:health,environmentName:environmentName,batchSize:BATCH_SIZE};
})();
