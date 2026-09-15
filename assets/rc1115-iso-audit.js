(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1115_ISO_AUDIT__)return;
w.__EXPORTHUB_RC1115_ISO_AUDIT__=true;

var VERSION='RC1115',loading=false,last=null;

function q(v){return String(v==null?'':v).trim()}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function env(){return /-testservice\./i.test(location.hostname)?'testservice':'production'}
function fmt(v){var x=new Date(v||'');if(!Number.isFinite(x.getTime()))return q(v)||'—';return new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short'}).format(x)}
function status(v){return q(v)==='ok'?'<span class="rc1115-ok">OK</span>':'<span class="rc1115-warn">Prüfen</span>'}
function num(v){var n=Number(v);return Number.isFinite(n)?n:0}
function root(){return d.getElementById('rc1081AuditHistory')}
function currentToken(){
 try{
  if(w.ExportHUBAuth&&typeof w.ExportHUBAuth.getToken==='function')return q(w.ExportHUBAuth.getToken())
  return q(sessionStorage.getItem('exporthub-session-token')||localStorage.getItem('exporthub-session-token')||'')
 }catch(_){return''}
}
function headers(json){
 var h={Accept:'application/json','Cache-Control':'no-cache','X-ExportHUB-Environment':env()},t=currentToken();
 if(json)h['Content-Type']='application/json';
 if(t)h['X-ExportHUB-Token']=t;
 return h
}
async function request(mode,method){
 var opts={method:method||'GET',credentials:'same-origin',cache:'no-store',headers:headers((method||'GET')!=='GET')};
 if((method||'GET')!=='GET')opts.body=JSON.stringify({action:mode,environment:env()});
 var r=await fetch('/api/exporthub-state?mode='+encodeURIComponent(mode),opts),j=await r.json().catch(function(){return{}});
 if(!r.ok){var e=new Error(q(j.message)||('HTTP '+r.status));e.status=r.status;e.code=j.code;throw e}
 return j
}
function ensureStyle(){
 if(d.getElementById('rc1115IsoAuditStyle'))return;
 var s=d.createElement('style');s.id='rc1115IsoAuditStyle';s.textContent=
 '.rc1115-iso{margin:0 0 14px;padding:14px;border:1px solid #cbd5e1;border-radius:14px;background:var(--surface,#fff)}'+
 '.rc1115-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.rc1115-head h4{margin:2px 0 4px;font-size:18px}.rc1115-actions{display:flex;gap:7px;flex-wrap:wrap}'+
 '.rc1115-kpis{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:8px;margin:12px 0}.rc1115-kpi{padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc}.rc1115-kpi b{display:block;font-size:18px}.rc1115-kpi span{font-size:11px;color:#64748b}'+
 '.rc1115-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rc1115-box{padding:11px;border:1px solid #e2e8f0;border-radius:11px}.rc1115-box h5{margin:0 0 8px;font-size:13px}.rc1115-row{display:flex;justify-content:space-between;gap:14px;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px}.rc1115-row:last-child{border-bottom:0}.rc1115-row span{color:#64748b}.rc1115-row b{text-align:right}.rc1115-ok,.rc1115-warn{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:800}.rc1115-ok{background:#dcfce7;color:#166534}.rc1115-warn{background:#fef3c7;color:#92400e}.rc1115-note{margin-top:8px;font-size:11px;color:#64748b}.rc1115-error{padding:10px;border-radius:10px;background:#fef2f2;color:#991b1b;font-size:12px}.rc1115-loading{padding:12px;color:#64748b;font-size:12px}'+
 '@media(max-width:800px){.rc1115-kpis,.rc1115-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.rc1115-kpis,.rc1115-grid{grid-template-columns:1fr}.rc1115-actions{width:100%}.rc1115-actions button{flex:1}}';
 (d.head||d.documentElement).appendChild(s)
}
function row(label,value){return'<div class="rc1115-row"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>'}
function content(x){
 var restore=x.backup&&x.backup.lastRestoreTest||null;
 return '<div class="rc1115-head"><div><span class="pill blue">ISO / AUDIT</span><h4>Technischer Kontrollstatus</h4><div class="muted">Zugriffe, Sitzungen, Backups, Fehler, Audit-Historie und POD-Sicherung.</div></div><div class="rc1115-actions"><button type="button" class="btn ghost" data-rc1115-refresh>Aktualisieren</button><button type="button" class="btn" data-rc1115-restore>Backup/Restore testen</button></div></div>'+
 '<div class="rc1115-kpis">'+
 '<div class="rc1115-kpi"><b>'+status(x.summary&&x.summary.security)+'</b><span>Security</span></div>'+
 '<div class="rc1115-kpi"><b>'+status(x.summary&&x.summary.backup)+'</b><span>Backup / Restore</span></div>'+
 '<div class="rc1115-kpi"><b>'+status(x.summary&&x.summary.audit)+'</b><span>Audit Trail</span></div>'+
 '<div class="rc1115-kpi"><b>'+status(x.summary&&x.summary.pod)+'</b><span>POD-Sicherung</span></div></div>'+
 '<div class="rc1115-grid">'+
 '<div class="rc1115-box"><h5>Benutzer & Sitzungen</h5>'+
 row('Aktive Benutzer',num(x.identity&&x.identity.activeUsers)+' / '+num(x.identity&&x.identity.users))+
 row('Globale Administratoren',num(x.identity&&x.identity.globalAdmins))+
 row('Aktive Sitzungen',num(x.identity&&x.identity.activeSessions))+
 row('Inaktivitätslimit',num(x.identity&&x.identity.sessionPolicy&&x.identity.sessionPolicy.idleMinutes)+' Min.')+
 row('Maximale Sitzung',num(x.identity&&x.identity.sessionPolicy&&x.identity.sessionPolicy.maxHours)+' Std.')+
 row('Passwort-Mindestlänge',num(x.identity&&x.identity.passwordPolicy&&x.identity.passwordPolicy.minimumLength)+' Zeichen')+'</div>'+
 '<div class="rc1115-box"><h5>Backup & Restore</h5>'+
 row('Recovery-Quellen',num(x.backup&&x.backup.sources))+
 row('Azure-Versionen',num(x.backup&&x.backup.azureVersionSources))+
 row('Sicherheitskopien',num(x.backup&&x.backup.recoveryBackups))+
 row('Restore bereit',(x.backup&&x.backup.restoreReady)?'Ja':'Nein')+
 row('Letzter Selbsttest',restore&&restore.ok?'Bestanden · '+fmt(restore.testedAt):'Noch nicht ausgeführt')+'</div>'+
 '<div class="rc1115-box"><h5>Fehler & Audit</h5>'+
 row('Offene Fehler',num(x.diagnostics&&x.diagnostics.openErrors))+
 row('Offene Warnungen',num(x.diagnostics&&x.diagnostics.openWarnings))+
 row('Diagnose-Aufbewahrung',num(x.diagnostics&&x.diagnostics.retentionDays)+' Tage')+
 row('Audit-Einträge',num(x.audit&&x.audit.entries))+
 row('Audit-Aufbewahrung',num(x.audit&&x.audit.retentionDays)+' Tage')+'</div>'+
 '<div class="rc1115-box"><h5>POD & Release</h5>'+
 row('Abgeholte Sendungen',num(x.pod&&x.pod.confirmedShipments))+
 row('POD primär in Azure',num(x.pod&&x.pod.azureSaved))+
 row('POD zusätzlich in M365',num(x.pod&&x.pod.driveSaved))+
 row('Primäre POD-Sicherung offen',num(x.pod&&x.pod.primaryBackupOpen))+
 row('API / Datenrevision',q(x.release&&x.release.apiVersion)+' / '+num(x.release&&x.release.revision))+'</div></div>'+
 '<div class="rc1115-note">API-Rechtevertrag: '+esc(x.accessControl&&x.accessControl.apiFunctionsClassified)+' Funktionen klassifiziert · Status erzeugt '+esc(fmt(x.generatedAt))+' · Umgebung '+esc(x.environment||env())+'.</div>'
}
function shell(){
 var host=root();if(!host)return null;
 ensureStyle();
 var box=d.getElementById('rc1115IsoAudit');
 if(!box){box=d.createElement('section');box.id='rc1115IsoAudit';box.className='rc1115-iso';host.insertBefore(box,host.firstChild)}
 return box
}
async function load(){
 if(loading)return;var box=shell();if(!box)return;loading=true;box.innerHTML='<div class="rc1115-loading">ISO-/Auditstatus wird geprüft …</div>';
 try{last=await request('iso-audit','GET');box.innerHTML=content(last);bind(box)}
 catch(e){
  if(Number(e.status)===403){box.innerHTML='<div class="rc1115-error">Die ISO-/Auditübersicht ist ausschließlich für globale Administratoren sichtbar.</div>'}
  else box.innerHTML='<div class="rc1115-error">ISO-/Auditstatus konnte nicht geladen werden: '+esc(e.message)+'</div>'
 }finally{loading=false}
}
function bind(box){
 var refresh=box.querySelector('[data-rc1115-refresh]'),restore=box.querySelector('[data-rc1115-restore]');
 if(refresh)refresh.addEventListener('click',load);
 if(restore)restore.addEventListener('click',async function(){
  if(loading)return;loading=true;restore.disabled=true;restore.textContent='Test läuft …';
  try{await request('iso-backup-restore-test','POST');loading=false;await load()}
  catch(e){loading=false;restore.disabled=false;restore.textContent='Backup/Restore testen';w.alert('Backup-/Restore-Test fehlgeschlagen: '+q(e.message))}
 })
}
function active(){
 try{var s=typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__():(w.ExportHUBClean&&w.ExportHUBClean.state)||w.appState||{};return /^(history|historie)$/i.test(q(s.view||s.currentView||s.activeView||s.page))}catch(_){return false}
}
function schedule(){w.setTimeout(function(){if(active()&&root())load();else{var x=d.getElementById('rc1115IsoAudit');if(x&&!root())x.remove()}},40)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:user-profile-updated'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
w.ExportHUBRC1115IsoAudit=Object.freeze({version:VERSION,load:load});
})(window,document);
