// RC1073 final live-contract marker: bedarfsgesteuerte Migration nur bei echtem Restbestand.
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
function removeCard(){
 if(typeof document==='undefined')return false;
 var old=document.getElementById('rc1061DocumentMigrationAdmin');
 if(old&&old.parentNode)old.parentNode.removeChild(old);
 return true
}
function ensureCard(){
 if(typeof document==='undefined')return Promise.resolve(false);
 if(!isAdmin(currentUser())||!adminView()){removeCard();return Promise.resolve(false)}
 return health().then(function(h){
  var diag=h&&h.stateDiagnostics||{},remaining=Math.max(0,Number(diag.inlinePayloadCount||0)),payloadBytes=Math.max(0,Number(diag.documentPayloadBytes||0));
  if(remaining<=0){removeCard();return false}

  var content=document.getElementById('content');if(!content)return false;
  var old=document.getElementById('rc1061DocumentMigrationAdmin');
  if(old){
    var countNode=old.querySelector('[data-rc1073-count]'),bytesNode=old.querySelector('[data-rc1073-bytes]');
    if(countNode)countNode.textContent=String(remaining);
    if(bytesNode)bytesNode.textContent=bytes(payloadBytes);
    return true
  }

  var box=document.createElement('section');
  box.id='rc1061DocumentMigrationAdmin';
  box.setAttribute('data-exporthub-admin-only','true');
  box.style.cssText='margin:18px 0;padding:18px;border:1px solid #cfd8e3;border-radius:14px;background:#f8fafc;box-shadow:0 2px 8px rgba(15,23,42,.05)';
  box.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><div style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#475467">Admin · Speicheroptimierung</div><h3 style="margin:4px 0 6px;font-size:20px">Dokumentmigration</h3><div style="font-size:13px;color:#667085">Noch <b data-rc1073-count>'+remaining+'</b> alte Dokumente (<span data-rc1073-bytes>'+bytes(payloadBytes)+'</span>) liegen eingebettet im '+environmentName().toUpperCase()+'.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-rc1073-run style="border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer;background:#111827;color:#fff">Alle verbleibenden migrieren</button><button type="button" data-rc1073-stop style="display:none;border:1px solid #cbd5e1;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;background:#fff;color:#334155">Nach aktuellem Paket stoppen</button></div></div><div data-rc1073-status style="margin-top:12px;font-size:13px;color:#475467">Bereit. Intern werden weiterhin sichere 5er-Pakete verwendet.</div><div style="height:9px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:12px"><div data-rc1073-progress style="height:100%;width:0%;background:#111827;transition:width .2s ease"></div></div><div data-rc1073-progress-text style="margin-top:5px;font-size:12px;color:#667085">0 %</div>';
  content.insertBefore(box,content.firstChild||null);

  var run=box.querySelector('[data-rc1073-run]'),stop=box.querySelector('[data-rc1073-stop]'),status=box.querySelector('[data-rc1073-status]'),bar=box.querySelector('[data-rc1073-progress]'),progressText=box.querySelector('[data-rc1073-progress-text]'),countNode=box.querySelector('[data-rc1073-count]'),bytesNode=box.querySelector('[data-rc1073-bytes]');
  var initial=remaining,stopping=false,running=false;

  function progress(total){
    var left=Math.max(0,Number(total&&total.remaining||0)),done=Math.max(0,initial-left),pct=initial?Math.min(100,Math.round(done/initial*100)):100;
    if(countNode)countNode.textContent=String(left);
    if(bar)bar.style.width=pct+'%';
    if(progressText)progressText.textContent=done+' / '+initial+' · '+pct+' %';
  }

  stop.addEventListener('click',function(){
    if(!running)return;stopping=true;stop.disabled=true;status.textContent='Stop angefordert. Das aktuelle 5er-Paket wird noch sicher abgeschlossen …'
  });

  run.addEventListener('click',async function(){
    if(running)return;running=true;stopping=false;run.disabled=true;stop.disabled=false;stop.style.display='inline-block';status.textContent='Migration läuft automatisch …';
    try{
      var result=await runAll({
        shouldStop:function(){return stopping},
        onProgress:function(_batch,total){
          progress(total);
          status.textContent='Paket '+Number(total&&total.batches||0)+' abgeschlossen · '+Number(total&&total.migrated||0)+' neu migriert · '+Number(total&&total.remaining||0)+' verbleiben.'
        }
      });
      if(result.stopped){
        status.textContent='Migration angehalten. '+Number(result.remaining||0)+' Dokumente verbleiben.';
        return
      }
      var fresh=await health(),next=Math.max(0,Number(fresh&&fresh.stateDiagnostics&&fresh.stateDiagnostics.inlinePayloadCount||0));
      if(next===0){
        progress({remaining:0});
        status.textContent='Migration abgeschlossen. Keine eingebetteten Alt-Dokumente mehr vorhanden.';
        bar.style.width='100%';
        setTimeout(removeCard,1800);
      }else{
        initial=next;
        if(countNode)countNode.textContent=String(next);
        if(bytesNode)bytesNode.textContent=bytes(Number(fresh&&fresh.stateDiagnostics&&fresh.stateDiagnostics.documentPayloadBytes||0));
        status.textContent='Migration wurde gespeichert, aber '+next+' Dokumente verbleiben noch. Du kannst den Lauf erneut starten.';
      }
    }catch(e){
      status.textContent='Migration sicher angehalten: '+q(e&&e.message||e)
    }finally{
      running=false;stopping=false;run.disabled=false;stop.disabled=false;stop.style.display='none'
    }
  });
  return true
 }).catch(function(e){
  try{console.warn('RC1073 Dokumentmigration Health',e)}catch(_){}
  return false
 })
}
var rc1073Timer=0;
function scheduleCard(){
 if(rc1073Timer)clearTimeout(rc1073Timer);
 rc1073Timer=setTimeout(function(){Promise.resolve(ensureCard()).catch(function(){})},250)
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleCard,{once:true});else scheduleCard();
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(name){try{window.addEventListener(name,scheduleCard)}catch(_){}});
}
// RC1073: Die Admin-Karte wird nur gerendert, solange der Health-Check
// wirklich migrierbare Inline-Dokumente meldet. Bei 0 bleibt sie unsichtbar.
window.ExportHUBRC1061DocumentMigrationAdmin={isAdmin:isAdmin,runBatch:runBatch,runAll:runAll,ensureCard:ensureCard,health:health,environmentName:environmentName,batchSize:BATCH_SIZE};
})();
