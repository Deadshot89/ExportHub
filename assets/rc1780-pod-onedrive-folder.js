/* RC1780: POD-Zweitkopie in einen OneDrive-synchronisierten PC-Ordner.
 *
 * Hintergrund (#999): Die Microsoft-Graph-Serverkopie nach SharePoint ist ohne App im
 * Essentra-Mandanten nicht möglich. ExportHUB schreibt deshalb im Browser jede gesicherte
 * POD-PDF direkt in einen vom Nutzer gewählten Ordner (z. B. den OneDrive-Ordner
 * "003 Export/ExportHub/Abliefernachweise"). Der OneDrive-Client lädt ihn nach SharePoint hoch.
 *
 * Regeln:
 * - Ordnerauswahl und erneute Freigabe nur per Nutzerklick (File System Access API).
 * - Ohne erteilte Schreibfreigabe wird nichts geschrieben und nichts als gesichert gemeldet.
 * - Vorhandene Dateien werden nie überschrieben; nur fehlende PODs werden ergänzt.
 * - Jede geschriebene Datei wird zurückgelesen (Größe + PDF-Signatur) bevor sie zählt.
 * - Das Azure-POD-Archiv auf dem Server bleibt unverändert die führende Sicherung.
 */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1780_POD_ONEDRIVE__)return;
w.__EXPORTHUB_RC1780_POD_ONEDRIVE__=true;

var VERSION='RC1780';
var DB_NAME='ExportHUBPODOneDrive',STORE='kv',DIR_KEY='folder',STATUS_KEY='status';
var AUTO_INTERVAL_MS=10*60*1000,AUTO_MIN_GAP_MS=2*60*1000;
var doc=w.document;
var running=null,lastAuto=0,timer=0,listeners=[];

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'}
function safe(v){return q(v).replace(/[<>:"/\\|?*\x00-\x1f]+/g,'_').replace(/\s+/g,'_').replace(/^_+|_+$/g,'').slice(0,110)||'POD'}
function ref(sh){return q(sh&&[sh.ref,sh.reference,sh.shipmentRef,sh.referenceNumber,sh.id,sh.shipmentId].find(Boolean)).toUpperCase()}
function packs(){var p=w.ExportHUBPodOneDrive1780I18n;return p&&p.packs||{de:{}}}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(packs()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=packs(),pack=all[lang()]||all.de||{},text=pack[key]||(all.de||{})[key]||key;if(vars)Object.keys(vars).forEach(function(k){text=text.split('{'+k+'}').join(String(vars[k]))});return text}
function isPdf(bytes){return !!bytes&&bytes.length>4&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d}

/* ---------- IndexedDB (eigener Speicher, unabhängig vom Notfallordner) ---------- */
function openDb(){
 return new Promise(function(resolve,reject){
  if(!w.indexedDB)return reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'));
  var r=w.indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};
  r.onsuccess=function(){resolve(r.result)};
  r.onerror=function(){reject(r.error||new Error('IndexedDB-Fehler'))};
 });
}
async function kvGet(key){
 var db=await openDb();
 return new Promise(function(resolve,reject){
  var tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);
  tx.oncomplete=function(){db.close();resolve(req.result)};
  tx.onerror=function(){db.close();reject(tx.error)};
 });
}
async function kvSet(key,value){
 var db=await openDb();
 return new Promise(function(resolve,reject){
  var tx=db.transaction(STORE,'readwrite'),st=tx.objectStore(STORE);
  if(value===undefined)st.delete(key);else st.put(value,key);
  tx.oncomplete=function(){db.close();resolve(true)};
  tx.onerror=function(){db.close();reject(tx.error)};
 });
}

/* ---------- Ordner und Berechtigung ---------- */
function supported(){return typeof w.showDirectoryPicker==='function'}
async function getFolder(){try{return await kvGet(DIR_KEY)||null}catch(_){return null}}
async function permission(handle,request){
 if(!handle||typeof handle.queryPermission!=='function')return false;
 try{
  var state=await handle.queryPermission({mode:'readwrite'});
  if(state==='granted')return true;
  if(request&&typeof handle.requestPermission==='function')return(await handle.requestPermission({mode:'readwrite'}))==='granted';
 }catch(_){}
 return false;
}
async function connect(options){
 // Muss aus einem Klick heraus aufgerufen werden (Nutzergeste).
 options=options||{};
 var saved=options.choose?null:await getFolder();
 if(saved&&await permission(saved,true)){notify();runSoon(300,true);return saved}
 if(!supported())throw new Error(t('browserUnsupported'));
 var handle=await w.showDirectoryPicker({id:'exporthub-pod-onedrive',mode:'readwrite',startIn:'documents'});
 if(!await permission(handle,true))throw new Error(t('writeDenied'));
 await kvSet(DIR_KEY,handle);
 await saveStatus({connectedAt:new Date().toISOString(),written:0,skipped:0,failed:[],lastRun:'',lastError:''});
 notify();
 runSoon(300,true);
 return handle;
}
async function disconnect(){await kvSet(DIR_KEY,undefined);await kvSet(STATUS_KEY,undefined);notify();return true}
async function loadStatus(){try{return await kvGet(STATUS_KEY)||{}}catch(_){return{}}}
async function saveStatus(s){try{await kvSet(STATUS_KEY,s)}catch(_){}}
async function info(){
 var handle=await getFolder(),s=await loadStatus();
 return{
  version:VERSION,supported:supported(),connected:!!handle,
  name:handle?q(handle.name)||'Ordner':'',
  writable:handle?await permission(handle,false):false,
  running:!!running,lastRun:q(s.lastRun),written:Number(s.written)||0,
  totalInFolder:Number(s.totalInFolder)||0,failed:arr(s.failed).slice(0,20),lastError:q(s.lastError)
 };
}

/* ---------- POD-Quellen (gleiche Regeln wie der ZIP-Export RC422) ---------- */
function fileUrl(f){return q(f&&(f.url||f.downloadUrl||f.href||f.dataUrl||f.data||f.contentUrl||f.content))}
function realFile(f){
 if(!obj(f))return false;
 var name=low([f.kind,f.source,f.docKind,f.name,f.filename,f.fileName].join(' ')),u=fileUrl(f);
 if(f.placeholder===true||f.fallback===true||f.syntheticFallback===true||/platzhalter|placeholder|ersatz|fallback|unvollstandig|unvollstaendig|scan-confirmation/.test(name))return false;
 return /^data:application\/pdf/i.test(u)||/^blob:/i.test(u)||/^https?:/i.test(u)||/^\/api\//i.test(u)||/\.pdf(?:$|[?#])/i.test(u);
}
function manualSource(sh){
 var files=arr(sh&&sh.podFiles).filter(function(f){
  if(!realFile(f)||/deleted|gelöscht|replaced|ersetzt|storniert/i.test(low(f&&f.status)))return false;
  var marker=low([f&&f.source,f&&f.docKind,f&&f.kind,f&&f.id].join(' '));
  return f.manualUpload===true||/manual-upload|user-upload|^pod/.test(marker);
 }).sort(function(a,b){
  return String([b.uploadedAt,b.createdAt,b.modifiedAt].find(Boolean)||'').localeCompare(String([a.uploadedAt,a.createdAt,a.modifiedAt].find(Boolean)||''));
 });
 if(!files.length)return null;
 var u=fileUrl(files[0]);
 return u?{url:u}:null;
}
function dataUrlBytes(u){
 var m=/^data:[^;,]*(;base64)?,(.*)$/i.exec(u);if(!m)throw new Error('Ungültige Daten-URL');
 if(!m[1]){var t=decodeURIComponent(m[2]),o=new Uint8Array(t.length);for(var j=0;j<t.length;j++)o[j]=t.charCodeAt(j)&255;return o}
 var b=w.atob(m[2]),out=new Uint8Array(b.length);for(var i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out;
}
async function loadUrl(u){
 if(/^data:/i.test(u))return dataUrlBytes(u);
 var r=await w.fetch(u,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/pdf,*/*'}});
 if(!r.ok)throw new Error('HTTP '+r.status);
 return new Uint8Array(await r.arrayBuffer());
}
function jobs(){
 var api=w.ExportHUBPODBackup;
 if(!api||typeof api.filter!=='function')return[];
 var list=[];try{list=arr(api.filter('',''))}catch(_){return[]}
 var seen={},out=[];
 list.forEach(function(sh){
  var r=ref(sh);if(!r)return;
  var manual=manualSource(sh),name=manual?'POD_'+safe(r)+'.pdf':'POD_'+safe(r)+'_Ladeliste_mit_Unterschrift.pdf';
  if(seen[name])return;seen[name]=true;
  out.push({sh:sh,ref:r,name:name,manual:manual});
 });
 return out;
}
async function bytesFor(job){
 var bytes;
 if(job.manual)bytes=await loadUrl(job.manual.url);
 else{
  var api=w.ExportHUBPODBackup;
  if(!api||typeof api.original!=='function')throw new Error('Original-POD-Abruf ist nicht verfügbar.');
  var o=await api.original(job.sh);bytes=o&&o.bytes;
 }
 if(!bytes||!isPdf(bytes)||bytes.length<1000)throw new Error('Keine gültige POD-PDF');
 return bytes;
}

/* ---------- Schreiben ---------- */
async function exists(dir,name){
 try{var fh=await dir.getFileHandle(name,{create:false});var f=await fh.getFile();return f.size>0}catch(_){return false}
}
async function writeVerified(dir,name,bytes){
 var fh=await dir.getFileHandle(name,{create:true});
 var ws=await fh.createWritable({keepExistingData:false});
 try{await ws.write(bytes)}catch(e){try{await ws.abort()}catch(_){}throw e}
 await ws.close();
 var f=await fh.getFile();
 if(f.size!==bytes.length)throw new Error('Kontrolllesen: Dateigröße stimmt nicht');
 var head=new Uint8Array(await f.slice(0,5).arrayBuffer());
 if(!isPdf(head))throw new Error('Kontrolllesen: keine PDF-Datei');
 return true;
}
async function runNow(options){
 options=options||{};
 if(running)return running;
 running=(async function(){
  var result={ok:false,written:0,skipped:0,failed:[],reason:''};
  var handle=await getFolder();
  if(!handle){result.reason='not-connected';return result}
  if(!await permission(handle,false)){result.reason='needs-permission';notify();return result}
  var list=jobs();notify();
  for(var i=0;i<list.length;i++){
   var job=list[i];
   try{
    if(await exists(handle,job.name)){result.skipped++;continue}
    var bytes=await bytesFor(job);
    if(await exists(handle,job.name)){result.skipped++;continue}
    await writeVerified(handle,job.name,bytes);
    result.written++;
   }catch(e){result.failed.push(job.ref+': '+q(e&&e.message||e).slice(0,160))}
  }
  var prev=await loadStatus();
  result.ok=result.failed.length===0;
  await saveStatus({
   connectedAt:prev.connectedAt||'',lastRun:new Date().toISOString(),
   written:(Number(prev.written)||0)+result.written,totalInFolder:result.written+result.skipped,
   failed:result.failed.slice(0,50),lastError:result.failed[0]||''
  });
  try{w.dispatchEvent(new w.CustomEvent('exporthub:pod-onedrive-synced',{detail:{written:result.written,skipped:result.skipped,failed:result.failed.length}}))}catch(_){}
  return result;
 })();
 try{return await running}finally{running=null;notify()}
}
function runSoon(delay,force){
 if(timer)w.clearTimeout(timer);
 timer=w.setTimeout(function(){
  timer=0;
  var now=Date.now();
  if(!force&&now-lastAuto<AUTO_MIN_GAP_MS)return;
  lastAuto=now;
  runNow().catch(function(){});
 },delay||0);
}

/* ---------- Oberfläche im Dialog "POD-Sicherung" ---------- */
function notify(){listeners.forEach(function(fn){try{fn()}catch(_){}});render()}
function fmt(iso){var d=new Date(iso);return isNaN(d)?'':d.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function panel(){
 var modal=doc&&doc.getElementById('rc422PodBackupModal');if(!modal)return null;
 var box=modal.querySelector('#rc1780PodOneDrive');if(box)return box;
 var host=modal.querySelector('.rc422-pod-dialog')||modal;
 box=doc.createElement('section');box.id='rc1780PodOneDrive';box.className='rc1780-pod-onedrive';
 box.setAttribute('aria-labelledby','rc1780PodOneDriveTitle');
 box.style.cssText='margin-top:14px;padding:12px 14px;border:1px solid var(--line,#d0d7de);border-radius:10px';
 box.innerHTML='<h3 id="rc1780PodOneDriveTitle" style="margin:0 0 4px;font-size:15px"></h3><p class="muted" data-rc1780-intro style="margin:0 0 8px"></p>'+
  '<p id="rc1780PodOneDriveStatus" role="status" aria-live="polite" style="margin:0 0 8px"></p>'+
  '<div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" id="rc1780PodOneDriveConnect"></button>'+
  '<button type="button" class="ghost" id="rc1780PodOneDriveRun"></button><button type="button" class="ghost" id="rc1780PodOneDriveDisconnect"></button></div>';
 var anchor=host.querySelector('.rc551-pod-emergency');
 if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(box,anchor);else host.appendChild(box);
 box.querySelector('#rc1780PodOneDriveConnect').addEventListener('click',function(){
  connect({choose:this.dataset.mode==='choose'}).catch(function(e){if(e&&e.name==='AbortError')return;setText(t('error',{message:q(e&&e.message||e)}))});
 });
 box.querySelector('#rc1780PodOneDriveRun').addEventListener('click',function(){
  setText(t('running'));runNow({manual:true}).then(function(r){
   if(r.reason==='needs-permission')setText(t('askPermission'));
  }).catch(function(e){setText(t('error',{message:q(e&&e.message||e)}))});
 });
 box.querySelector('#rc1780PodOneDriveDisconnect').addEventListener('click',function(){disconnect().catch(function(){})});
 return box;
}
function setText(t){var box=panel();if(box)box.querySelector('#rc1780PodOneDriveStatus').textContent=t}
var rendering=false;
function render(){
 if(rendering)return;var box=panel();if(!box)return;rendering=true;
 info().then(function(s){
  var status=box.querySelector('#rc1780PodOneDriveStatus'),c=box.querySelector('#rc1780PodOneDriveConnect'),
   run=box.querySelector('#rc1780PodOneDriveRun'),off=box.querySelector('#rc1780PodOneDriveDisconnect');
  box.querySelector('#rc1780PodOneDriveTitle').textContent=t('title');box.querySelector('[data-rc1780-intro]').textContent=t('intro');
  run.textContent=t('runNow');off.textContent=t('disconnect');
  run.hidden=!s.connected;off.hidden=!s.connected;
  if(!s.supported){status.textContent=t('unsupported');c.hidden=true;return}
  c.hidden=false;c.dataset.mode='';
  if(!s.connected){status.textContent=t('notConnected');c.textContent=t('connect');return}
  if(!s.writable){status.textContent=t('needsPermission',{name:s.name});c.textContent=t('reconnect');return}
  c.textContent=t('choose');c.dataset.mode='choose';
  var parts=[t('connected',{name:s.name})];
  if(s.running)parts.push(t('running'));
  else if(s.lastRun)parts.push(t('lastRun',{time:fmt(s.lastRun),count:s.totalInFolder}));
  if(s.failed.length)parts.push(t('failed',{count:s.failed.length,first:s.failed[0]}));
  status.textContent=parts.join(' ');
 }).catch(function(){}).then(function(){rendering=false});
}

/* ---------- Auslöser ---------- */
function start(){
 w.addEventListener('exporthub:ready',function(){runSoon(8000)});
 w.addEventListener('exporthub:pickup-updated',function(){runSoon(4000,true)});
 w.addEventListener('exporthub:pod-cloud-backup',function(){runSoon(3000,true)});
 if(doc){
  doc.addEventListener('visibilitychange',function(){if(doc.visibilityState==='visible')runSoon(5000)});
  if(typeof w.MutationObserver==='function'&&doc.body){
   new w.MutationObserver(function(){var m=doc.getElementById('rc422PodBackupModal');if(m&&!m.querySelector('#rc1780PodOneDrive'))render()}).observe(doc.body,{childList:true});
  }
 }
 w.setInterval(function(){runSoon(0)},AUTO_INTERVAL_MS);
 runSoon(15000);
}

w.ExportHUBPODOneDrive=Object.freeze({
 version:VERSION,supported:supported,connect:connect,disconnect:disconnect,info:info,run:runNow,
 jobs:function(){return jobs().map(function(j){return{ref:j.ref,name:j.name,manual:!!j.manual}})},
 onChange:function(fn){if(typeof fn==='function')listeners.push(fn)},render:render
});
if(doc&&doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:null);
