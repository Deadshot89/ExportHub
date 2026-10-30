/* ExportHUB360 RC1650 – Fehlerdiagnose in Klartext (IT area, global admins).
   The RC871 diagnostics list stays the source of truth; this module only adds, on top of it:
   - "Auf einen Blick": one sentence on the overall state plus the message types to look at first,
   - per message type a plain title, an urgency (Wichtig / Beobachten / Harmlos), "Was bedeutet das?" and
     "Was solltest du tun?", with the technical message and JSON folded away under "Technische Details",
   - a bug report form and a send-to-AI button per message: both go straight to the AI autofix
     (/api/diagnostic-autofix request-manual via ExportHUBSelfCorrect.reportBug), plus the list of AI jobs.
   Texts live in assets/i18n/rc1650-diagnostics-plain.js. */
(function(root,factory){
'use strict';
var api=factory(root);
if(typeof module==='object'&&module&&module.exports)module.exports=api;
if(root&&!root.ExportHUBDiagnosticsPlain){root.ExportHUBDiagnosticsPlain=api;if(root.document)api.install()}
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(w){
'use strict';
var VERSION='RC1650',STYLE_ID='rc1650-diagnostics-plain-style',SUMMARY_ID='rc1650DiagSummary',REPORT_ID='rc1650DiagReport';
var report={open:false,busy:false,status:'',statusKind:'',area:'',description:'',expected:'',config:null};
var RANK={high:0,watch:1,low:2};

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
// Same normalisation as the RC871 list, so group keys match its data-rc871-diag-group attribute.
function low(v){return q(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function packs(){var p=w&&w.ExportHUBDiagnosticsPlain1650I18n;return p&&p.packs||{de:{}}}
function lang(){try{if(w&&w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(packs()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=packs(),s=(all[lang()]||{})[key];if(s==null)s=(all.de||{})[key];s=String(s==null?key:s);if(vars)Object.keys(vars).forEach(function(k){s=s.split('{'+k+'}').join(String(vars[k]))});return s}
function signature(x){return [q(x&&x.level)||'info',q(x&&x.category)||'system',low(x&&x.message).replace(/\b[0-9a-f]{8,}\b/g,'#').replace(/\d+/g,'#')].join('|')}

// ---- classification (pure, exported for tests) ----
// Which part of ExportHUB an API path belongs to, in words a user knows.
function thingOf(path){
 var p=String(path||'').toLowerCase().split('#')[0];
 if(/\/api\/exporthub-state/.test(p))return /mode=save|mode=write|mode=patch/.test(p)?'save':/mode=read|mode=load/.test(p)?'read':'sync';
 if(/\/api\/pickup-status/.test(p))return'pickupStatus';
 if(/\/api\/(pickup-pod|pod-|official-pod)/.test(p))return'pod';
 if(/\/api\/(pickup|manual-pickup|fixed-pickups)/.test(p))return'pickup';
 if(/\/api\/exporthub-auth|\/api\/customer-portal-credentials/.test(p))return'auth';
 if(/\/api\/customer-avis|\/api\/avis-|\/api\/av-check/.test(p))return'avis';
 if(/\/api\/(exporthub-document|container-document|pickup-container-document|reference-files)/.test(p))return'document';
 if(/\/api\/exporthub-release|release-assets\.json|release-version\.json|production-version/.test(p))return /version/.test(p)?'version':'release';
 if(/\/api\/(exporthub-health|pickup-health)/.test(p))return'health';
 if(/\/api\/customs-ai/.test(p))return'customs';
 if(/\/api\/packaging/.test(p))return'packaging';
 if(/\/api\/(pack-notification|pack-stations)/.test(p))return'pack';
 if(/\/api\/location-booking/.test(p))return'location';
 if(/\/api\/abd-/.test(p))return'abd';
 if(/\/api\/diagnostic-autofix/.test(p))return'autofix';
 if(/\/api\/self-correct/.test(p))return'selfcorrect';
 if(/\/api\/web-push|\/api\/push/.test(p))return'push';
 if(/^\/?(\?|$)|^\/index\.html|^\/testversion\.html/.test(p))return'home';
 return'server';
}
function httpKind(status){
 if(status===401||status===403)return'auth';
 if(status===404||status===410)return'notfound';
 if(status===409||status===412)return'conflict';
 if(status===429)return'ratelimit';
 if(status===502||status===503||status===504)return'unavailable';
 if(status>=500)return'server';
 return'rejected';
}
function classify(x){
 var message=q(x&&x.message),category=low(x&&x.category),level=low(x&&x.level),m;
 if(category==='manual')return{kind:'manual',thing:''};
 if(/demo_state|\bdemo-(?:speicherung|daten|state)\b|für die demo/i.test(message))return{kind:'demo',thing:''};
 if((m=/Netzwerkfehler bei [A-Z]+ (\S+)/.exec(message)))return{kind:'network',thing:thingOf(m[1])};
 if((m=/HTTP (\d{3}) bei [A-Z]+ (\S+)/.exec(message)))return{kind:httpKind(Number(m[1])),thing:thingOf(m[2]),status:Number(m[1])};
 if((m=/Langsamer API-Aufruf: [A-Z]+ (\S+)/.exec(message)))return{kind:'slow',thing:thingOf(m[1])};
 if(/long task|hänger|haenger/i.test(message))return{kind:'freeze',thing:''};
 if(category==='render'||/render-vorgang|neu-render/i.test(message))return{kind:'render',thing:''};
 if(category==='resource'||/ressource konnte nicht geladen/i.test(message))return{kind:'resource',thing:''};
 if(/azure|nicht dauerhaft|storage|speicherfehler|blob/i.test(message))return{kind:'storage',thing:''};
 if(category==='network'&&/failed to fetch|networkerror|load failed|timeout/i.test(message))return{kind:'network',thing:'server'};
 if(category==='javascript'||category==='promise'||/(Type|Reference|Syntax|Range)Error|is not a function|is not defined|cannot read propert/i.test(message))return{kind:'code',thing:''};
 if(category==='performance')return{kind:'freeze',thing:''};
 if(level==='warning'||level==='info'||category==='console')return{kind:'hint',thing:''};
 return{kind:'unknown',thing:''};
}
// urgency from the kind plus how often / for how many people it happened
function urgencyOf(kind,total,users,level){
 total=Number(total)||1;users=Number(users)||0;
 switch(kind){
  case'code':case'storage':case'server':return'high';
  case'unavailable':return total>=20?'high':'watch';
  case'network':return total>=20||users>=2?'watch':'low';
  case'conflict':return total>=10?'watch':'low';
  case'manual':return'watch';
  case'auth':case'notfound':case'rejected':case'ratelimit':case'resource':return'watch';
  case'unknown':return level==='error'?'watch':'low';
  default:return'low';
 }
}
function explain(g){
 g=g||{};
 var c=classify(g),users=Array.isArray(g.users)?g.users.length:Number(g.users)||0,urgency=urgencyOf(c.kind,g.total,users,low(g.level)),thing=c.thing?t('thing_'+c.thing):'';
 return{kind:c.kind,thing:c.thing,status:c.status||0,urgency:urgency,title:t(c.kind+'_t',{thing:thing}),what:t(c.kind+'_w'),todo:t(c.kind+'_d')};
}
function group(rows){
 var map=Object.create(null),out=[];
 (rows||[]).forEach(function(x){
  if(!x)return;
  var k=signature(x),g=map[k];
  if(!g){g=map[k]={key:k,level:q(x.level)||'info',category:q(x.category),message:q(x.message),total:0,users:[],areas:[],last:''};out.push(g)}
  g.total+=Math.max(1,Number(x.count||1));
  var u=q(x.user),a=q(x.area),at=q(x.lastAt||x.at);
  if(u&&g.users.indexOf(u)<0)g.users.push(u);
  if(a&&g.areas.indexOf(a)<0)g.areas.push(a);
  if(!g.last||at>=g.last){g.last=at;g.message=q(x.message)||g.message}
 });
 return out;
}
function summarize(rows){
 var problems=group((rows||[]).filter(function(x){var l=low(x&&x.level);return l==='error'||l==='warning'}));
 var items=problems.map(function(g){return{group:g,info:explain(g)}});
 items.sort(function(a,b){return RANK[a.info.urgency]-RANK[b.info.urgency]||b.group.total-a.group.total});
 var counts={high:0,watch:0,low:0};items.forEach(function(i){counts[i.info.urgency]++});
 return{counts:counts,items:items,top:items.filter(function(i){return i.info.urgency!=='low'}).slice(0,3)};
}

// ---- page integration ----
function d(){return w.document}
function records(){try{var a=w.ExportHUBDiagnostics871;if(a&&typeof a.records==='function')return a.records()||[]}catch(_){}return[]}
function onDiagnostics(){var c=d().getElementById('content');return !!(c&&c.getAttribute('data-rc871-diagnostics-view')==='1'&&d().getElementById('rc871DiagList'))}
// Menu labels for the view keys stored as "area" (e.g. shipmentoverview → Sendungsübersicht)
function areaName(v){var b=d().querySelector('#nav [data-view="'+String(v).replace(/["\\]/g,'')+'"] .index308-nav-label,#nav [data-index321-view="'+String(v).replace(/["\\]/g,'')+'"] .index308-nav-label');return q(b&&b.textContent)||v}
function list(arr,n){return arr.slice(0,n).join(', ')+(arr.length>n?' +'+(arr.length-n):'')}
function fmt(ts){var dt=new Date(ts);if(isNaN(dt))return q(ts);try{return dt.toLocaleString(lang()==='en'?'en-GB':lang(),{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(_){return dt.toISOString()}}
function chip(u){return '<span class="rc1650-urgency rc1650-u-'+u+'">'+esc(t('urgency_'+u))+'</span>'}

function style(){
 if(d().getElementById(STYLE_ID))return;
 var s=d().createElement('style');s.id=STYLE_ID;
 s.textContent=[
  '#'+SUMMARY_ID+'{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;align-items:start}',
  '#'+SUMMARY_ID+' .rc1650-light{width:14px;height:14px;border-radius:50%;margin-top:5px;background:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,.15)}',
  '#'+SUMMARY_ID+'[data-rc1650-state="watch"] .rc1650-light{background:#d97706;box-shadow:0 0 0 4px rgba(217,119,6,.15)}',
  '#'+SUMMARY_ID+'[data-rc1650-state="high"] .rc1650-light{background:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.15)}',
  '#'+SUMMARY_ID+' h3{margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--pc-muted,#64748b)}',
  '#'+SUMMARY_ID+' .rc1650-state{font-size:17px;font-weight:800;color:var(--pc-title,#0f172a);margin:2px 0 4px}',
  '#'+SUMMARY_ID+' .rc1650-counts{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 6px}',
  '#'+SUMMARY_ID+' .rc1650-legend{font-size:12px;color:var(--pc-muted,#64748b);margin:0}',
  '#'+SUMMARY_ID+' .rc1650-first{grid-column:2;margin-top:8px}',
  '#'+SUMMARY_ID+' .rc1650-first b{display:block;font-size:12px;margin-bottom:4px;color:var(--pc-muted,#64748b)}',
  '#'+SUMMARY_ID+' .rc1650-first ol{margin:0;padding:0;list-style:none;display:grid;gap:6px}',
  '#'+SUMMARY_ID+' .rc1650-first li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--pc-line,#e2e8f0);border-radius:10px;padding:7px 10px}',
  '#'+SUMMARY_ID+' .rc1650-first li span.rc1650-first-title{flex:1 1 240px;font-weight:700;color:var(--pc-title,#0f172a)}',
  '#'+SUMMARY_ID+' .rc1650-first li small{color:var(--pc-muted,#64748b)}',
  '.rc1650-urgency{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap}',
  '.rc1650-u-high{background:#fee2e2;color:#991b1b}.rc1650-u-watch{background:#fef3c7;color:#92400e}.rc1650-u-low{background:#e2e8f0;color:#334155}',
  '.rc871-diag-event summary .rc1650-urgency{margin-top:4px}',
  '.rc871-diag-event .rc1650-title{display:block;font-size:13px;font-weight:800;color:var(--pc-title,#0f172a);overflow-wrap:anywhere}',
  '.rc871-diag-event[data-rc1650] .rc871-diag-message{display:block;font-weight:600;font-size:11px;color:var(--pc-muted,#64748b);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
  '.rc1650-explain{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 18px;margin:0 0 12px}',
  '.rc1650-explain section{border:1px solid var(--pc-line,#e2e8f0);border-radius:10px;background:var(--pc-card-bg,#fff);padding:10px 12px}',
  '.rc1650-explain h4{margin:0 0 4px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--pc-muted,#64748b)}',
  '.rc1650-explain p{margin:0;font-size:13px;line-height:1.45;color:var(--pc-text,#0f172a)}',
  '.rc1650-explain .rc1650-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
  '.rc1650-explain .rc1650-actions small{color:var(--pc-muted,#64748b);flex:1 1 280px}',
  // the RC871 row rules (details summary as grid, themed h3/h4) also hit the nested elements; keep them plain
  '#content .rc871-diag-event .rc1650-tech{margin-top:4px;border:0;background:transparent;box-shadow:none}',
  '#content .rc871-diag-event .rc1650-tech>summary{display:list-item!important;grid-template-columns:none!important;cursor:pointer;font-size:12px;font-weight:800;color:var(--pc-muted,#64748b);padding:4px 0!important;list-style:disclosure-closed inside}',
  '#content .rc871-diag-event .rc1650-tech[open]>summary{list-style:disclosure-open inside}',
  '#content .rc1650-explain h4{font-size:11px!important;line-height:1.3!important}',
  '#content #'+SUMMARY_ID+' h3{font-size:12px!important;line-height:1.3!important}',
  '#'+REPORT_ID+' .rc1650-report-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}',
  '#'+REPORT_ID+' h3{margin:0;font-size:16px!important;line-height:1.3!important;color:var(--pc-title,#0f172a)}',
  '#'+REPORT_ID+' .rc1650-ai-note{margin:4px 0 0;font-size:12px;font-weight:700;color:#15803d}',
  '#'+REPORT_ID+' .rc1650-ai-note[data-kind="off"]{color:#b91c1c}#'+REPORT_ID+' .rc1650-ai-note[data-kind="warn"],#'+REPORT_ID+' .rc1650-ai-note[data-kind="wait"]{color:#b45309}',
  '#'+REPORT_ID+' .rc1650-legend{margin:10px 0 8px;font-size:13px;color:var(--pc-muted,#64748b)}',
  '#'+REPORT_ID+' .rc1650-form{display:grid;gap:8px}',
  '#'+REPORT_ID+' .rc1650-form input,#'+REPORT_ID+' .rc1650-form textarea{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border:1px solid var(--pc-line,#cbd5e1);border-radius:9px;background:var(--pc-input-bg,#fff);color:inherit}',
  '#'+REPORT_ID+' .rc1650-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
  '#'+REPORT_ID+' .rc1650-report-status{font-weight:700}#'+REPORT_ID+' .rc1650-report-status[data-kind="ok"]{color:#15803d!important}#'+REPORT_ID+' .rc1650-report-status[data-kind="bad"]{color:#b91c1c!important}',
  '#'+REPORT_ID+' .rc1650-jobs{margin-top:12px}#'+REPORT_ID+' .rc1650-jobs b{display:block;font-size:12px;color:var(--pc-muted,#64748b);margin-bottom:4px}',
  '#'+REPORT_ID+' .rc1650-jobs ul{list-style:none;margin:0;padding:0;display:grid;gap:5px}',
  '#'+REPORT_ID+' .rc1650-jobs li{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px;border:1px solid var(--pc-line,#e2e8f0);border-radius:9px;padding:6px 9px}',
  '#'+REPORT_ID+' .rc1650-jobs li span:nth-child(2){flex:1 1 260px;color:var(--pc-text,#0f172a)}#'+REPORT_ID+' .rc1650-jobs small{color:var(--pc-muted,#64748b)}',
  '.rc1650-job{border-radius:999px;padding:2px 8px;font-size:10px;font-weight:900;text-transform:uppercase;background:#e2e8f0;color:#334155}',
  '.rc1650-job-running,.rc1650-job-queued{background:#dbeafe;color:#1d4ed8}.rc1650-job-fixed,.rc1650-job-pr{background:#dcfce7;color:#166534}.rc1650-job-failed{background:#fee2e2;color:#991b1b}',
  '#'+REPORT_ID+' .rc1650-jobs .rc1650-pr{padding:4px 10px;font-size:12px;text-decoration:none}#'+REPORT_ID+' .rc1650-job-why{display:block;font-style:normal;color:#991b1b;margin-top:2px}',
  '.rc1650-toast{position:fixed;right:16px;bottom:16px;z-index:2147483000;max-width:min(380px,calc(100vw - 32px));display:grid;gap:6px;padding:12px 14px;border-radius:12px;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-left:5px solid #16a34a;box-shadow:0 12px 32px rgba(15,23,42,.25);font-size:13px}',
  '.rc1650-toast[data-kind="failed"]{border-left-color:#dc2626}.rc1650-toast b{font-size:14px}.rc1650-toast div{display:flex;gap:8px;justify-content:flex-end}.rc1650-toast a.btn{text-decoration:none}',
  '@media(max-width:640px){#'+SUMMARY_ID+'{grid-template-columns:1fr}#'+SUMMARY_ID+' .rc1650-light{display:none}#'+SUMMARY_ID+' .rc1650-first{grid-column:1}}'
 ].join('\n');
 (d().head||d().documentElement).appendChild(s);
}

function stateSentence(s){
 if(s.counts.high)return t(s.counts.high===1?'stateHighOne':'stateHighMany',{count:s.counts.high});
 if(s.counts.watch)return t(s.counts.watch===1?'stateWatchOne':'stateWatchMany',{count:s.counts.watch});
 return t('stateOk');
}
function renderSummary(){
 var head=d().querySelector('#content .rc871-diag-head');if(!head)return;
 var s=summarize(records()),state=s.counts.high?'high':s.counts.watch?'watch':'ok';
 var html='<span class="rc1650-light" aria-hidden="true"></span><div><h3>'+esc(t('summaryTitle'))+'</h3><p class="rc1650-state">'+esc(stateSentence(s))+'</p>'+
  '<div class="rc1650-counts">'+['high','watch','low'].map(function(u){return chip(u).replace('</span>',': '+s.counts[u]+'</span>')}).join('')+'</div>'+
  '<p class="rc1650-legend">'+esc(t('legend'))+'</p></div>'+
  (s.top.length?'<div class="rc1650-first"><b>'+esc(t('firstLook'))+'</b><ol>'+s.top.map(function(i){return '<li>'+chip(i.info.urgency)+'<span class="rc1650-first-title">'+esc(i.info.title)+'</span><small>×'+i.group.total+'</small><button type="button" class="ghost" data-rc1650-show="'+esc(i.group.key)+'" data-rc1650-message="'+esc(i.group.message)+'">'+esc(t('show'))+'</button></li>'}).join('')+'</ol></div>':'');
 var box=d().getElementById(SUMMARY_ID);
 if(!box){box=d().createElement('section');box.id=SUMMARY_ID;box.className='card';box.setAttribute('data-i18n-ignore','1');head.insertAdjacentElement('afterend',box)}
 else if(box.previousElementSibling!==head)head.insertAdjacentElement('afterend',box);
 box.setAttribute('data-rc1650-state',state);
 if(box.__rc1650Html!==html){box.innerHTML=html;box.__rc1650Html=html}
}
// "Fehler melden": own description → KI autofix; below it the jobs of manually reported bugs
function prUrl(af){var u=q(af&&af.runUrl);return /^https:\/\/github\.com\/Deadshot89\/ExportHub\/pull\/\d+$/.test(u)?u:''}
function jobState(x){var af=x&&x.autofix||{},s=low(af.status);if(x&&x.resolvedAt||s==='fixed')return'fixed';if(prUrl(af)&&['testing','deploying'].indexOf(s)>=0)return'pr';if(s==='failed'||s==='reverted')return'failed';if(['claimed','running','testing','deploying'].indexOf(s)>=0)return'running';if(s==='queued')return'queued';return'open'}
function aiNote(){
 var sc=w.ExportHUBSelfCorrect,c=report.config;
 if(!sc||typeof sc.allowed!=='function')return{kind:'off',text:t('reportNoRight')};
 if(!sc.allowed())return{kind:'off',text:/demo/i.test(String(w.location&&w.location.pathname||''))?t('reportDemo'):t('reportNoRight')};
 if(!c)return{kind:'wait',text:t('aiChecking')};
 if(c.enabled===false&&!c.error)return{kind:'off',text:t('aiOff')};
 if(c.error)return{kind:'off',text:t('aiIncomplete',{message:c.error})};
 if(c.configured===false)return{kind:'warn',text:t('aiIncomplete',{message:q(c.preflight&&c.preflight.message)||'GitHub'})};
 return{kind:'ok',text:t('aiReady')};
}
function loadConfig(){var sc=selfCorrect();if(!sc||typeof sc.autofixConfiguration!=='function'||report.config||report.loadingConfig)return;report.loadingConfig=true;sc.autofixConfiguration().then(function(c){report.config=c||{};report.loadingConfig=false;renderReport(true)})}
function renderReport(force){
 var anchor=d().getElementById(SUMMARY_ID);if(!anchor)return;
 var box=d().getElementById(REPORT_ID);
 if(!box){box=d().createElement('section');box.id=REPORT_ID;box.className='card';box.setAttribute('data-i18n-ignore','1');anchor.insertAdjacentElement('afterend',box);force=true}
 else if(box.previousElementSibling!==anchor){anchor.insertAdjacentElement('afterend',box)}
 var jobs=records().filter(function(x){return x&&(low(x.category)==='manual'||x.autofix&&x.autofix.jobId)}).slice(-5).reverse();
 var note=aiNote(),canSend=note.kind==='ok'||note.kind==='warn';
 var html='<div class="rc1650-report-head"><div><h3>'+esc(t('reportTitle'))+'</h3><p class="rc1650-ai-note" data-kind="'+note.kind+'">'+esc(note.text)+'</p></div>'+(report.open?'':'<button type="button" class="btn" data-rc1650-report-open="1">'+esc(t('reportOpen'))+'</button>')+'</div>'+
  (report.open?'<p class="rc1650-legend">'+esc(t('reportIntro'))+'</p><div class="rc1650-form"><input type="text" id="rc1650ReportArea" maxlength="160" placeholder="'+esc(t('reportArea'))+'" aria-label="'+esc(t('reportArea'))+'" value="'+esc(report.area)+'">'+
   '<textarea id="rc1650ReportDesc" maxlength="4000" rows="4" placeholder="'+esc(t('reportDesc'))+'" aria-label="'+esc(t('reportDesc'))+'">'+esc(report.description)+'</textarea>'+
   '<textarea id="rc1650ReportExpected" maxlength="2000" rows="2" placeholder="'+esc(t('reportExpected'))+'" aria-label="'+esc(t('reportExpected'))+'">'+esc(report.expected)+'</textarea>'+
   '<div class="rc1650-actions"><button type="button" class="btn" data-rc1650-report-send="1"'+(report.busy||!canSend?' disabled':'')+'>'+esc(report.busy?t('reportSending'):t('reportSend'))+'</button><small class="rc1650-report-status" data-kind="'+esc(report.statusKind)+'" aria-live="polite">'+esc(report.status)+'</small></div></div>':'')+
  (jobs.length?'<div class="rc1650-jobs"><b>'+esc(t('jobsTitle'))+'</b><ul>'+jobs.map(jobItem).join('')+'</ul></div>':'');
 if(force||box.__rc1650Html!==html){
  var focus=d().activeElement&&d().activeElement.id;
  if(focus&&/^rc1650Report/.test(focus)&&!force)return;
  box.innerHTML=html;box.__rc1650Html=html;
 }
}
// one job row: state, text, PR button when Claude's pull request is ready, reason when it failed
function jobItem(x){
 var st=jobState(x),af=x.autofix||{},pr=prUrl(af),run=!pr&&/^https:\/\/github\.com\//.test(q(af.runUrl))?q(af.runUrl):'',why=st==='failed'?q(af.lastMessage).replace(/^Automatische Behebung fehlgeschlagen\. GitHub-Lauf: \S+( · )?/,'').replace(/&(#39|#x27|quot|lt|gt|amp);/g,function(m,e){return{'#39':"'",'#x27':"'",quot:'"',lt:'<',gt:'>',amp:'&'}[e]}).slice(0,240):'';
 return '<li><span class="rc1650-job rc1650-job-'+st+'">'+esc(t('job_'+st))+'</span><span>'+esc(q(x.message).slice(0,140))+(why?'<em class="rc1650-job-why">'+esc(why)+'</em>':'')+'</span><small>'+esc(fmt(x.lastAt||x.at))+'</small>'+
  (pr?'<a class="btn rc1650-pr" href="'+esc(pr)+'" target="_blank" rel="noopener">'+esc(t('openPr'))+'</a>':run?'<a href="'+esc(run)+'" target="_blank" rel="noopener">'+esc(t('openRun'))+'</a>':'')+'</li>';
}
// Feedback: jobs sent from this browser are watched until Claude is done, then one notice (toast + system
// notification if allowed) with a direct link to the pull request
var MINE_KEY='exporthub-rc1650-my-ai-jobs',FINAL=['pr','fixed','failed'],watchTimer=null;
function mine(){try{var v=JSON.parse(w.localStorage.getItem(MINE_KEY)||'{}');return v&&typeof v==='object'?v:{}}catch(_){return{}}}
function saveMine(v){try{w.localStorage.setItem(MINE_KEY,JSON.stringify(v))}catch(_){}}
function track(jobId){jobId=q(jobId);if(!jobId)return;var m=mine();m[jobId]={at:Date.now(),notified:false};saveMine(m);askNotify();watch()}
function askNotify(){try{if(w.Notification&&w.Notification.permission==='default')w.Notification.requestPermission()}catch(_){}}
function cloudRecords(){try{var c=w.ExportHUBDiagnosticsCloud864;if(c&&typeof c.records==='function')return c.records()||[]}catch(_){}return records()}
function checkMine(){
 var m=mine(),open=Object.keys(m).filter(function(id){return !m[id].notified&&Date.now()-Number(m[id].at||0)<864e5});
 if(!open.length){if(watchTimer){clearInterval(watchTimer);watchTimer=null}return}
 var c=w.ExportHUBDiagnosticsCloud864;Promise.resolve(c&&typeof c.refresh==='function'?c.refresh(true):null).catch(function(){}).then(function(){
  var rows=cloudRecords(),changed=false;
  open.forEach(function(id){var x=rows.find(function(r){return r&&r.autofix&&q(r.autofix.jobId)===id});if(!x)return;var st=jobState(x);if(FINAL.indexOf(st)<0)return;m[id].notified=true;changed=true;notifyDone(x,st)});
  if(changed){saveMine(m);schedule()}
 });
}
function watch(){if(!watchTimer)watchTimer=setInterval(checkMine,45000);setTimeout(checkMine,5000)}
function notifyDone(x,st){
 var af=x.autofix||{},link=prUrl(af)||(/^https:\/\/github\.com\//.test(q(af.runUrl))?q(af.runUrl):''),title=t('done_'+st),body=q(x.message).slice(0,120);
 style();
 var box=d().createElement('div');box.className='rc1650-toast';box.setAttribute('role','status');box.setAttribute('data-i18n-ignore','1');box.setAttribute('data-kind',st);
 box.innerHTML='<b>'+esc(title)+'</b><span>'+esc(body)+'</span><div>'+(link?'<a class="btn" href="'+esc(link)+'" target="_blank" rel="noopener">'+esc(st==='pr'?t('openPr'):t('openRun'))+'</a>':'')+'<button type="button" class="ghost" data-rc1650-toast-close="1">'+esc(t('close'))+'</button></div>';
 d().body.appendChild(box);
 try{if(w.Notification&&w.Notification.permission==='granted'){var n=new w.Notification(title,{body:body,tag:'rc1650-'+q(af.jobId)});n.onclick=function(){try{w.focus();if(link)w.open(link,'_blank','noopener')}catch(_){}n.close()}}}catch(_){}
}
async function sendReport(){
 var sc=selfCorrect();if(!sc||report.busy)return;
 if(q(report.description).length<20){report.status=t('reportShort');report.statusKind='bad';renderReport(true);return}
 report.busy=true;report.status='';renderReport(true);
 try{var r=await sc.reportBug({area:report.area,description:report.description,expected:report.expected});track(r&&r.jobId);report.status=q(t('reportSent',{id:q(r&&(r.jobId||r.diagnosticId))}));report.statusKind='ok';report.description='';report.expected='';report.area='';refreshCloud()}
 catch(e){report.status=t('reportError',{message:q(e&&e.message)});report.statusKind='bad'}
 finally{report.busy=false;renderReport(true)}
}
function groupByKey(){var m=Object.create(null);group(records()).forEach(function(g){m[g.key]=g});return m}
function levelOf(el){return el.classList.contains('rc871-lvl-error')?'error':el.classList.contains('rc871-lvl-warning')?'warning':'info'}
function decorateRows(){
 var listEl=d().getElementById('rc871DiagList');if(!listEl)return;
 var rows=listEl.querySelectorAll('details.rc871-diag-event:not([data-rc1650])');if(!rows.length)return;
 var byKey=groupByKey();
 Array.prototype.forEach.call(rows,function(el){
  var key=el.getAttribute('data-rc871-diag-group'),msgEl=el.querySelector('.rc871-diag-message'),g=key&&byKey[key];
  if(!g){var parts=(key||'').split('|');g={key:key||'',level:levelOf(el),category:parts.length>2?parts[1]:'',message:q(msgEl&&msgEl.textContent),total:1,users:[],areas:[],last:''}}
  var info=explain(g);
  el.setAttribute('data-rc1650',info.urgency);el.setAttribute('data-i18n-ignore','1');
  if(msgEl&&!el.querySelector('.rc1650-title')){var title=d().createElement('span');title.className='rc1650-title';title.textContent=info.title;msgEl.parentNode.insertBefore(title,msgEl)}
  var pill=el.querySelector('summary .rc871-diag-level');
  if(pill&&!el.querySelector('summary .rc1650-urgency')){pill.insertAdjacentHTML('afterend','<br>'+chip(info.urgency))}
  // area keys (shipmentoverview, cmr …) → the menu names the user knows
  var sub=el.querySelector('summary .rc871-diag-sub');
  if(sub)sub.textContent=sub.textContent.replace(/\b[a-z][a-z0-9]{2,}\b/g,function(word){return d().querySelector('#nav [data-view="'+word+'"],#nav [data-index321-view="'+word+'"]')?areaName(word):word});
  el.__rc1650={group:g,info:info};
 });
}
function selfCorrect(){var sc=w.ExportHUBSelfCorrect;return sc&&typeof sc.allowed==='function'&&sc.allowed()&&typeof sc.reportBug==='function'?sc:null}
function explainDetails(el){
 var host=el&&el.querySelector('[data-rc871-diag-details]');if(!host||host.getAttribute('data-loaded')!=='1'||host.querySelector('.rc1650-explain'))return;
 var data=el.__rc1650;if(!data){decorateRows();data=el.__rc1650;if(!data)return}
 var g=data.group,info=data.info,areas=g.areas.map(areaName),often=[t('often',{count:g.total,last:fmt(g.last)})];
 if(g.users.length)often.push(t('oftenUsers',{users:list(g.users,4)}));
 if(areas.length)often.push(t('oftenAreas',{areas:list(areas,4)}));
 var note=aiNote(),off=note.kind==='off',ai=info.kind!=='manual'&&info.urgency!=='low'&&selfCorrect()?'<div class="rc1650-actions"><button type="button" class="btn" data-rc1650-ai="1"'+(off?' disabled':'')+'>'+esc(t('aiFix'))+'</button><small data-rc1650-ai-status>'+esc(off?note.text:t('aiFixHint'))+'</small></div>':'';
 var box=d().createElement('div');box.className='rc1650-explain';box.setAttribute('data-i18n-ignore','1');
 box.innerHTML='<section><h4>'+esc(t('what'))+'</h4><p>'+esc(info.what)+'</p></section><section><h4>'+esc(t('todo'))+'</h4><p>'+esc(info.todo)+'</p></section><section><h4>'+esc(t('howOften'))+'</h4><p>'+often.map(esc).join('<br>')+'</p></section>'+ai;
 // technical facts and JSON of RC871 stay available, folded under "Technische Details"
 var tech=d().createElement('details');tech.className='rc1650-tech';tech.innerHTML='<summary>'+esc(t('technical'))+'</summary>';
 while(host.firstChild)tech.appendChild(host.firstChild);
 host.appendChild(box);host.appendChild(tech);
}
function sampleDetails(g){try{var rows=records().filter(function(x){return signature(x)===g.key});var x=rows[rows.length-1];return x&&x.details?JSON.stringify(x.details).slice(0,1500):''}catch(_){return''}}
// "An KI senden" on a message: straight to the autofix, no extra dialog
function startAi(el,btn){
 var sc=selfCorrect(),data=el&&el.__rc1650;if(!sc||!data||btn.disabled)return;
 if(!w.confirm(t('sendConfirm')))return;
 var g=data.group,areas=g.areas.map(areaName),note=el.querySelector('[data-rc1650-ai-status]'),details=sampleDetails(g);
 var description=t('aiDescription',{title:data.info.title,message:g.message,count:g.total,areas:list(areas,6)||'–'})+(details?'\n\n'+details:'');
 btn.disabled=true;if(note)note.textContent=t('reportSending');
 sc.reportBug({area:list(areas,3)||data.info.title,description:description.slice(0,4000),expected:''}).then(function(r){
  track(r&&r.jobId);if(note)note.textContent=q(t('reportSent',{id:q(r&&(r.jobId||r.diagnosticId))}));refreshCloud();
 },function(e){btn.disabled=false;if(note)note.textContent=t('reportError',{message:q(e&&e.message)})});
}
function refreshCloud(){try{var c=w.ExportHUBDiagnosticsCloud864;if(c&&typeof c.refresh==='function')Promise.resolve(c.refresh(true)).then(function(){var a=w.ExportHUBDiagnostics871;if(a&&typeof a.refresh==='function')a.refresh()})}catch(_){}}
function show(btn){
 var key=btn.getAttribute('data-rc1650-show'),search=d().getElementById('rc871DiagSearch'),filter=d().getElementById('rc871DiagFilter'),mode=d().getElementById('rc871DiagMode');
 function openRow(){var el=Array.prototype.find.call(d().querySelectorAll('#rc871DiagList details[data-rc871-diag-group]'),function(x){return x.getAttribute('data-rc871-diag-group')===key});if(!el)return false;el.open=true;try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch(_){el.scrollIntoView()}return true}
 if(openRow())return;
 if(mode&&mode.value!=='groups'){mode.value='groups';mode.dispatchEvent(new Event('change',{bubbles:true}))}
 if(filter&&filter.value!=='problems'&&filter.value!=='all'){filter.value='problems';filter.dispatchEvent(new Event('change',{bubbles:true}))}
 if(search){search.value=btn.getAttribute('data-rc1650-message')||'';search.dispatchEvent(new Event('input',{bubbles:true}))}
 var tries=0,timer=setInterval(function(){if(openRow()||++tries>12)clearInterval(timer)},150);
}

var scheduled=false,observer=null;
function sync(){scheduled=false;if(!onDiagnostics())return;style();renderSummary();renderReport(false);loadConfig();decorateRows()}
function schedule(){if(scheduled)return;scheduled=true;(w.requestAnimationFrame||setTimeout)(sync)}
function install(){
 var doc=d();if(!doc||w.__EXPORTHUB_RC1650_DIAG_PLAIN__)return;w.__EXPORTHUB_RC1650_DIAG_PLAIN__=true;
 if(w.MutationObserver){
  var start=function(){var c=doc.getElementById('content');if(!c||observer)return;observer=new w.MutationObserver(function(list){for(var i=0;i<list.length;i++){var tg=list[i].target;if(tg&&tg.closest&&tg.closest('#'+SUMMARY_ID+',#'+REPORT_ID+',.rc1650-explain'))continue;schedule();return}});observer.observe(c,{childList:true,subtree:true})};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
  ['exporthub:ready','exporthub:rendered'].forEach(function(n){w.addEventListener(n,start)});
 }
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed','exporthub:diagnostics-cloud-updated'].forEach(function(n){w.addEventListener(n,function(){if(n==='exporthub:language-changed'){[SUMMARY_ID,REPORT_ID].forEach(function(id){var b=doc.getElementById(id);if(b)b.__rc1650Html=''})}schedule()})});
 // after RC871 has filled the details on open (its listener is registered earlier)
 doc.addEventListener('toggle',function(e){var el=e.target;if(el&&el.matches&&el.matches('details.rc871-diag-event')&&el.open)setTimeout(function(){explainDetails(el)},0)},true);
 doc.addEventListener('click',function(e){
  var x=e.target&&e.target.closest&&e.target.closest('[data-rc1650-toast-close]');if(x){var tb=x.closest('.rc1650-toast');if(tb)tb.remove();return}
  var b=e.target&&e.target.closest&&e.target.closest('[data-rc1650-show],[data-rc1650-ai],[data-rc1650-report-open],[data-rc1650-report-send]');if(!b)return;
  e.preventDefault();
  if(b.hasAttribute('data-rc1650-show'))show(b);
  else if(b.hasAttribute('data-rc1650-ai'))startAi(b.closest('details.rc871-diag-event'),b);
  else if(b.hasAttribute('data-rc1650-report-open')){report.open=true;renderReport(true);var f=d().getElementById('rc1650ReportDesc');if(f)f.focus()}
  else sendReport();
 },true);
 var FIELDS={rc1650ReportArea:'area',rc1650ReportDesc:'description',rc1650ReportExpected:'expected'};
 doc.addEventListener('input',function(e){var id=e.target&&e.target.id;if(FIELDS[id])report[FIELDS[id]]=e.target.value},true);
 // jobs sent earlier (also after a reload) keep being watched until their notice was shown
 if(Object.keys(mine()).length)watch();
 schedule();
}

return Object.freeze({version:VERSION,classify:classify,explain:explain,urgencyOf:urgencyOf,thingOf:thingOf,group:group,summarize:summarize,signature:signature,jobState:jobState,prUrl:prUrl,install:install,refresh:function(){schedule()}});
});
