import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1018');
const OUT=path.join(ROOT,'dist-rc1044');
const VERSION='RC1044';
const NUMBER='1044';

function replaceOne(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`RC1044 POD-Hotfix ${label}: Anker ${count}x gefunden`);
  return source.replace(before,after);
}

function patchPodUploadPersistence(html,file){
  const oldFlush="async function flushDocumentUpload(reason){var clean=window.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function')return false;await Promise.resolve(clean.queueSave(reason));var target=clean.runtime?Number(clean.runtime.changeGeneration||0):0,deadline=Date.now()+35000,ok=false;while(Date.now()<deadline&&!ok){while(clean.runtime&&clean.runtime.saving&&Date.now()<deadline)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,100)});if(clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target){ok=true;break}if(typeof clean.flushSave==='function')ok=await Promise.resolve(clean.flushSave(reason,{force:true}));if(!ok)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,250)})}if(!ok&&clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target)ok=true;return ok}";
  const newFlush="async function flushDocumentUpload(reason){var clean=window.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function')return false;await Promise.resolve(clean.queueSave(reason));var target=clean.runtime?Number(clean.runtime.changeGeneration||0):0,deadline=Date.now()+80000,ok=false;while(Date.now()<deadline&&!ok){while(clean.runtime&&clean.runtime.saving&&Date.now()<deadline)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,100)});if(clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target){ok=true;break}if(typeof clean.flushSave==='function')ok=await Promise.resolve(clean.flushSave(reason,{force:true,userInitiated:true}));if(!ok)await new Promise(function(resolve){(clean.native&&clean.native.setTimeout||window.setTimeout)(resolve,250)})}if(!ok&&clean.runtime&&target>0&&Number(clean.runtime.lastSavedGeneration||0)>=target)ok=true;return ok}";
  let out=replaceOne(html,oldFlush,newFlush,file+' Speicherbestätigung');

  const oldReason="var reason=(kind==='pod'?'POD':'ABD')+' als PDF dauerhaft gespeichert',ok=await flushDocumentUpload(reason);";
  const newReason="var reason=kind==='pod'?'POD-Sicherung nach manuellem Upload synchronisiert':'ABD als PDF dauerhaft gespeichert',ok=await flushDocumentUpload(reason);";
  out=replaceOne(out,oldReason,newReason,file+' POD-Sperrausnahme');

  if(!out.includes("deadline=Date.now()+80000"))throw new Error(file+': verlängerte POD-Azure-Bestätigung fehlt');
  if(!out.includes("flushSave(reason,{force:true,userInitiated:true})"))throw new Error(file+': benutzerinitiierte POD-Speicherung fehlt');
  if(!out.includes("POD-Sicherung nach manuellem Upload synchronisiert"))throw new Error(file+': POD-Sperrausnahme fehlt');
  return out;
}

function patchDashboardOpenShipments(html,file){
  let out=html;

  const oldWorkspaceList="function shipmentOpenList(){\n    return shipments().filter(function(s){return s && !isDone(s)})\n  }";
  const newWorkspaceList="function shipmentOpenList(){\n    return shipments().filter(function(s){return s && !isDone(s)})\n  }\n\n  function workspaceShipmentPickedUp(s){var st=low([s&&s.status,s&&s.state,s&&s.processStatus,s&&s.freigabe,s&&s.pickupStatus,s&&s.podStatus].join(' '));if(/teilabhol|partial/.test(st))return false;return !!(s&&(s.pickedUp===true||s.pickupConfirmed===true||s.pickupCompleted===true||s.collected===true||s.actualPickupDate||s.pickedUpAtDate||s.pickedUpAt||s.pickupAt||s.abgeholtAt))||/abgeholt|picked up|pickedup|collected|pod vorhanden/.test(st)}\n\n  function shipmentDashboardOpenList(){return shipmentOpenList().filter(function(s){return !workspaceShipmentPickedUp(s)})}";
  out=replaceOne(out,oldWorkspaceList,newWorkspaceList,file+' Dashboard-Arbeitsplatz Abholstatus');

  out=replaceOne(out,
    "function shipmentRows(){\n    var list=shipmentOpenList();",
    "function shipmentRows(){\n    var list=shipmentDashboardOpenList();",
    file+' Dashboard-Sendungsliste'
  );
  out=replaceOne(out,
    "var total=isTask?taskOpenList().length:shipmentOpenList().length;",
    "var total=isTask?taskOpenList().length:shipmentDashboardOpenList().length;",
    file+' Dashboard-Sendungszaehler'
  );
  out=replaceOne(out,
    "var openTasks=taskOpenList(),openShipments=shipmentOpenList();",
    "var openTasks=taskOpenList(),openShipments=shipmentDashboardOpenList();",
    file+' Dashboard-Arbeitsfokus'
  );

  const oldDone="function shipmentDone(s){return isDone(s&&(s.status||s.freigabe||s.state))}";
  const newDone="function dashboardShipmentPickedUp(s){var st=low([s&&s.status,s&&s.freigabe,s&&s.state,s&&s.processStatus,s&&s.pickupStatus,s&&s.podStatus].join(' '));if(/teilabhol|partial/.test(st))return false;return !!(s&&(s.pickedUp===true||s.pickupConfirmed===true||s.pickupCompleted===true||s.collected===true||s.actualPickupDate||s.pickedUpAtDate||s.pickedUpAt||s.pickupAt||s.abgeholtAt))||/abgeholt|picked up|pickedup|collected|pod vorhanden/.test(st)}\nfunction shipmentDone(s){return isDone(s&&(s.status||s.freigabe||s.state))||dashboardShipmentPickedUp(s)}";
  out=replaceOne(out,oldDone,newDone,file+' Kern-Dashboard Abholstatus');

  out=replaceOne(out,
    "metric('Offene Sendungen',open.length,'kpi-orange','nicht abgeschlossen')",
    "metric('Offene Sendungen',open.length,'kpi-orange','noch nicht abgeholt')",
    file+' Dashboard-Kacheltext'
  );

  if(!out.includes('function shipmentDashboardOpenList()'))throw new Error(file+': Dashboard-Filter fuer nicht abgeholte Sendungen fehlt');
  if(!out.includes('function dashboardShipmentPickedUp(s)'))throw new Error(file+': Kern-Dashboard erkennt Abholung nicht');
  if(!out.includes("metric('Offene Sendungen',open.length,'kpi-orange','noch nicht abgeholt')"))throw new Error(file+': Dashboard-Kacheltext wurde nicht angepasst');
  return out;
}

function patchDashboardDueTasks(html,file){
  let out=html;

  const oldTaskOpenList="function taskOpenList(){\n    var seen=new Map();\n    tasks().filter(function(t){return t && !isDone(t)}).forEach(function(t,index){\n      var key=low([itemTitle(t,''),t.owner||t.assignee||'Alle',t.day||t.originalDay||'',t.area||t.category||t.section||'',customer(t),t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref||'',t.time||''].join('|'));\n      if(!key)key='task:'+q(t.id||t.taskId||index);\n      if(!seen.has(key))seen.set(key,t)\n    });\n    return Array.from(seen.values())\n  }";
  const newTaskOpenList="function workspaceCurrentUser(){try{var s=getState(),r=window.ExportHUBClean&&window.ExportHUBClean.runtime||{};return (typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'&&window.__EXPORTHUB_GET_CURRENT_USER__())||r.user||window.currentUser||s.currentUser||s.user||{}}catch(_){return{}}}\n\n  function workspaceTaskOwner(t){return q(t&&(t.eowner||t.owner||t.assignee||t.responsible||t.zustaendig||''))}\n\n  function workspaceTaskForUser(t){var own=low(workspaceTaskOwner(t)),u=workspaceCurrentUser(),name=low(u.name||u.user||u.login||u.username||''),login=low(u.user||u.login||u.username||'');return !own||own==='alle'||own==='all'||(name&&(own.indexOf(name)>=0||name.indexOf(own)>=0))||(login&&own.indexOf(login)>=0)}\n\n  function workspaceIsoWeek(d){var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);var y=x.getUTCFullYear(),ys=new Date(Date.UTC(y,0,1)),w=Math.ceil((((x-ys)/86400000)+1)/7);return y+'-W'+String(w).padStart(2,'0')}\n\n  function workspaceTaskBacklog(t){return !!(t&&(t.isBacklog||t.backlog||low(t.day)==='rückstand'||low(t.area)==='rückstand'))}\n\n  function workspaceTaskDate(t){var keys=['dueDate','due','date','plannedDate','targetDate','deadline'];for(var i=0;i<keys.length;i++){var v=t&&t[keys[i]];if(!v)continue;var d=new Date(v);if(!isNaN(d.getTime()))return d}return null}\n\n  function workspaceTaskVisible(t){if(!t)return false;if(workspaceTaskBacklog(t))return true;var now=new Date(),current=workspaceIsoWeek(now),explicit=q(t.weekKey||t.createdForWeek||'');if(explicit&&explicit!==current)return false;var source=q(t.sourceWeekStart||'').slice(0,10);if(/^\\d{4}-\\d{2}-\\d{2}$/.test(source)){var sd=new Date(source+'T12:00:00');if(!isNaN(sd)&&workspaceIsoWeek(sd)!==current)return false}var recurring=!!(t.recurring===true||t.repeat===true||t.isRecurring===true||t.recurringSeriesId||t.weeklySeriesId||t.recurringTemplateId||t.masterTaskRC848||t.masterTaskRC846);if(recurring&&!explicit&&!source){var rd=workspaceTaskDate(t);if(rd&&workspaceIsoWeek(rd)!==current)return false}return true}\n\n  function taskOpenList(){\n    var seen=new Map();\n    tasks().filter(function(t){return t && !isDone(t) && workspaceTaskForUser(t) && workspaceTaskVisible(t)}).forEach(function(t,index){\n      var key=low([itemTitle(t,''),t.owner||t.assignee||'Alle',t.day||t.originalDay||'',t.area||t.category||t.section||'',customer(t),t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref||'',t.time||''].join('|'));\n      if(!key)key='task:'+q(t.id||t.taskId||index);\n      if(!seen.has(key))seen.set(key,t)\n    });\n    return Array.from(seen.values())\n  }";
  out=replaceOne(out,oldTaskOpenList,newTaskOpenList,file+' Dashboard Aufgaben Benutzer und Woche');

  const oldDue="function dueTask(t){\n    var d=dateValue(t);\n    if(!d) return false;\n    return dayKey(d)<=todayKey()\n  }";
  const newDue="function dueTask(t){\n    if(workspaceTaskBacklog(t))return true;\n    var d=workspaceTaskDate(t);\n    if(d)return dayKey(d)<=todayKey();\n    var order={montag:1,dienstag:2,mittwoch:3,donnerstag:4,freitag:5,samstag:6,sonntag:7},day=low(t&&(t.day||t.originalDay||'')),today=order[low(['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][new Date().getDay()])]||99,idx=order[day]||99;\n    return idx<=today&&today<=5\n  }";
  out=replaceOne(out,oldDue,newDue,file+' Dashboard echte Faelligkeit');

  const oldDashboardUser="function taskForUser(t){var owner=low(taskOwner(t)),u=low(userName());return !owner||owner==='alle'||owner==='all'||owner.indexOf(u)>=0||u.indexOf(owner)>=0}";
  const newDashboardUser="function taskForUser(t){var owner=low(taskOwner(t)),u=currentUser(),name=low(u.name||u.user||u.login||u.username||''),login=low(u.user||u.login||u.username||'');return !owner||owner==='alle'||owner==='all'||(name&&(owner.indexOf(name)>=0||name.indexOf(owner)>=0))||(login&&owner.indexOf(login)>=0)}";
  out=replaceOne(out,oldDashboardUser,newDashboardUser,file+' Kern-Dashboard Aufgaben Benutzer');

  const oldRender="var r=root();if(!r)return false;var s=state(),p=prefs(),modules=availableModules(),tasks=arr(s.tasks).filter(taskMeaningfulDashboardRC818).filter(function(t){return !dashboardTaskIsTestRC818(t)}),owned=tasks.filter(taskForUser);if(owned.length)tasks=owned;";
  const newRender="var r=root();if(!r)return false;var s=state(),p=prefs(),modules=availableModules(),tasks=arr(s.tasks).filter(taskMeaningfulDashboardRC818).filter(function(t){return !dashboardTaskIsTestRC818(t)}).filter(taskForUser);";
  out=replaceOne(out,oldRender,newRender,file+' Kern-Dashboard kein Fallback auf fremde Aufgaben');

  if(!out.includes("function workspaceTaskDate(t){var keys=['dueDate','due','date','plannedDate','targetDate','deadline']"))throw new Error(file+': Dashboard nutzt kein echtes Aufgabendatum');
  if(out.includes("workspaceTaskDate(t){var keys=['dueDate','due','date','plannedDate','targetDate','deadline','createdAt']"))throw new Error(file+': createdAt darf keine Fälligkeit erzeugen');
  if(!out.includes('workspaceTaskForUser(t) && workspaceTaskVisible(t)'))throw new Error(file+': persönlicher Aufgabenfilter fehlt');
  if(!out.includes('.filter(taskForUser);'))throw new Error(file+': Kern-Dashboard fällt noch auf fremde Aufgaben zurück');
  return out;
}

function patchHtml(file){
  const target=path.join(OUT,file);
  let html=fs.readFileSync(target,'utf8');
  html=patchPodUploadPersistence(html,file);
  html=patchDashboardOpenShipments(html,file);
  html=patchDashboardDueTasks(html,file);
  html=html.replace(/ExportHUB RC1018 environment=/g,`ExportHUB ${VERSION} environment=`);
  html=html.replace(
    /var BUILD=Object\.freeze\(\{version:'RC1018',cache:'1018',loginReturn:'([^']*)'\}\);/,
    (_m,ret)=>{
      const next=String(ret||'').replace(/([?&]v=)\d+/,'$1'+NUMBER);
      return `var BUILD=Object.freeze({version:'${VERSION}',cache:'${NUMBER}',loginReturn:'${next}'});`;
    }
  );
  html=html.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1018(['"])/g,`$1${VERSION}$2`);
  if(!html.includes(`version:'${VERSION}'`))throw new Error(`${file}: BUILD ${VERSION} fehlt`);
  if(!html.includes(`ExportHUB ${VERSION} environment=`))throw new Error(`${file}: Environment ${VERSION} fehlt`);
  fs.writeFileSync(target,html);
}

execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});
for(const file of ['index.html','TESTVERSION.html','demo.html'])patchHtml(file);

const probeFile=path.join(OUT,'production-version.js');
let probe=fs.readFileSync(probeFile,'utf8');
probe=probe.replace(/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC\d+'/g,`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`);
if(!probe.includes(`__EXPORTHUB_PRODUCTION_VERSION_PROBE__='${VERSION}'`))throw new Error('RC1044 Produktionsmarker fehlt');
fs.writeFileSync(probeFile,probe);

const baseManifest=JSON.parse(fs.readFileSync(path.join(SRC,'rc1018-manifest.json'),'utf8'));
fs.writeFileSync(path.join(OUT,'rc1044-manifest.json'),JSON.stringify({
  schema:'exporthub-rc1044-three-env-v1',
  version:VERSION,
  sourceRelease:'RC1018',
  sourceManifest:baseManifest,
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
},null,2)+'\n');

console.log('RC1044 build ready: POD, offene Sendungen und fällige Dashboard-Aufgaben fachlich gehärtet, Produktion/TESTSERVICE/Demo synchronisiert.');
