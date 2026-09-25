(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module&&module.exports)module.exports=api;
  if(root){root.ExportHUBRC1013Diagnostics=api;api.install(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UI_FILTER={query:'',level:'all',status:'all',area:'all'};
  var AUTOFIX_CONFIG=null;
  function text(v,max){var s=String(v==null?'':v).replace(/\s+/g,' ').trim();return max?s.slice(0,max):s;}
  function tr(key,vars,language){try{var g=typeof globalThis!=='undefined'?globalThis:null;if(g&&g.ExportHUBI18n&&typeof g.ExportHUBI18n.t==='function')return g.ExportHUBI18n.t(key,vars,language)}catch(_){}return key;}
  function low(v){return text(v).toLowerCase();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function detailsOf(rec){return rec&&rec.details&&typeof rec.details==='object'&&!Array.isArray(rec.details)?rec.details:{};}
  function safeDetails(rec){
    var src=detailsOf(rec),out={};
    Object.keys(src).slice(0,24).forEach(function(k){
      if(/token|authorization|password|passwort|session|signature|base64|dataurl|filedata|content|cookie|secret/i.test(k)){out[k]=tr('diagnostics.protected');return;}
      var v=src[k];out[k]=(v==null||typeof v==='number'||typeof v==='boolean')?v:text(v,500);
    });
    return out;
  }
  function statusOf(rec){
    var d=detailsOf(rec),raw=d.httpStatus||d.statusCode||d.status||rec&&rec.httpStatus||rec&&rec.statusCode||'';
    var n=Number(raw);if(n>=100&&n<=599)return n;
    var m=text(rec&&rec.message).match(/\b(401|403|404|409|410|429|500|502|503|504)\b/);return m?Number(m[1]):0;
  }
  function explicitCode(rec){
    var d=detailsOf(rec),raw=text(rec&&(rec.errorCode||rec.code)||d.errorCode||d.code,80).toUpperCase().replace(/[^A-Z0-9_-]/g,'-');
    return raw&&/^EH-/.test(raw)?raw:'';
  }
  function codeOf(rec){
    var explicit=explicitCode(rec);if(explicit)return explicit;
    var category=low(rec&&rec.category),area=low(rec&&rec.area),msg=low(rec&&rec.message),all=[category,area,msg].join(' '),status=statusOf(rec);
    if(/pickup|qr|abhol/.test(all)){
      if(/pin|verlader/.test(all))return'EH-PICKUP-PIN';
      if(/colli|package|paket|menge/.test(all))return'EH-PICKUP-COLLI';
      if(/ungültig|ungueltig|nicht mehr aktiv|abgelaufen|revok|token|link/.test(all))return'EH-PICKUP-'+(status||410);
      return'EH-PICKUP-'+(status||500);
    }
    if(/gate41|gate 41|fracht|versandkosten/.test(all))return'EH-GATE41-'+(/tarif|preis|grundfracht|0,00|0\.00/.test(all)?'TARIF':(status||500));
    if(/auth|login|anmeld|sitzung|session|berechtigung/.test(all))return'EH-AUTH-'+(status||401);
    if(/azure|storage|speicher|blob/.test(all))return'EH-STORAGE-'+(status||503);
    if(/timeout|network|netzwerk|fetch|offline|verbindung/.test(all))return'EH-NETWORK-'+(status||504);
    var tag=(category||'system').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)||'SYSTEM';
    return'EH-'+tag+'-'+(status||500);
  }
  function knowledge(code,rec){
    var msg=low(rec&&rec.message);
    if(code==='EH-PICKUP-410')return{meaning:tr('diagnostics.knowledge.pickup410.meaning'),cause:tr('diagnostics.knowledge.pickup410.cause'),nextStep:tr('diagnostics.knowledge.pickup410.next')};
    if(code==='EH-PICKUP-PIN')return{meaning:tr('diagnostics.knowledge.pickupPin.meaning'),cause:tr('diagnostics.knowledge.pickupPin.cause'),nextStep:tr('diagnostics.knowledge.pickupPin.next')};
    if(code==='EH-PICKUP-COLLI')return{meaning:tr('diagnostics.knowledge.pickupColli.meaning'),cause:tr('diagnostics.knowledge.pickupColli.cause'),nextStep:tr('diagnostics.knowledge.pickupColli.next')};
    if(/^EH-GATE41-/.test(code))return{meaning:tr('diagnostics.knowledge.gate41.meaning'),cause:tr('diagnostics.knowledge.gate41.cause'),nextStep:tr('diagnostics.knowledge.gate41.next')};
    if(/^EH-AUTH-/.test(code))return{meaning:tr('diagnostics.knowledge.auth.meaning'),cause:tr('diagnostics.knowledge.auth.cause'),nextStep:tr('diagnostics.knowledge.auth.next')};
    if(/^EH-STORAGE-/.test(code))return{meaning:tr('diagnostics.knowledge.storage.meaning'),cause:tr('diagnostics.knowledge.storage.cause'),nextStep:tr('diagnostics.knowledge.storage.next')};
    if(/^EH-NETWORK-/.test(code))return{meaning:tr('diagnostics.knowledge.network.meaning'),cause:tr('diagnostics.knowledge.network.cause'),nextStep:tr('diagnostics.knowledge.network.next')};
    return{
      meaning:tr('diagnostics.knowledge.generic.meaning'),
      cause:tr(msg?'diagnostics.knowledge.generic.causeWithMessage':'diagnostics.knowledge.generic.causeNoMessage'),
      nextStep:tr('diagnostics.knowledge.generic.next')
    };
  }

  function companyOf(rec){var d=detailsOf(rec);return text(rec&&(rec.companyName||rec.company)||d.companyName||d.company||d.customerCompany||d.customerName,160)||tr('diagnostics.notProvided');}
  function describe(rec){
    rec=rec&&typeof rec==='object'?rec:{};
    var code=codeOf(rec),k=knowledge(code,rec),safe=safeDetails(rec);
    return{
      id:text(rec.id,240),
      code:code,
      level:text(rec.level,20)||'info',
      category:text(rec.category,60)||'system',
      area:text(rec.area,160)||tr('diagnostics.unknownArea'),
      user:text(rec.user||rec.userName,160)||tr('diagnostics.notProvided'),
      userId:text(rec.userId,120)||'—',
      company:companyOf(rec),
      environment:text(rec.environment,40)||tr('diagnostics.unknownEnvironment'),
      deviceId:text(rec.deviceId,120)||'—',
      clientVersion:text(rec.clientVersion,80)||'—',
      time:text(rec.lastAt||rec.at,60)||'—',
      meaning:k.meaning,
      cause:k.cause,
      nextStep:k.nextStep,
      technicalMessage:text(rec.message,1500)||tr('diagnostics.noTechnicalMessage'),
      details:safe,
      count:Math.max(1,Number(rec.count||1)||1),
      autofix:rec&&rec.autofix&&typeof rec.autofix==='object'?rec.autofix:{},
      resolvedAt:text(rec&&rec.resolvedAt,80),
      resolvedBy:text(rec&&rec.resolvedBy,160),
      resolutionMessage:text(rec&&rec.resolutionMessage,2000)
    };
  }
  function sessionToken(win){
    try{var rt=win.ExportHUBClean&&win.ExportHUBClean.runtime||{},t=text(rt.authToken||rt.token||rt.sessionToken);if(t)return t;}catch(_){}
    try{var raw=win.sessionStorage&&win.sessionStorage.getItem('exporthub_rc301_tab_session');if(raw){var x=JSON.parse(raw);if(x&&x.token)return text(x.token);}}catch(_){}
    try{for(var i=0;win.sessionStorage&&i<win.sessionStorage.length;i++){var k=win.sessionStorage.key(i),r=win.sessionStorage.getItem(k);if(!r||r.charAt(0)!=='{')continue;var x=JSON.parse(r);if(x&&x.token&&x.user)return text(x.token);}}catch(_){}
    return'';
  }
  function apiHeaders(win){var t=sessionToken(win),h={'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache'};if(t){h['X-ExportHUB-Token']=t;h['X-ExportHUB-Session']=t;h.Authorization='Bearer '+t;}return h;}
  function environment(win){try{return /-testservice\./i.test(String(win.location&&win.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
  async function autofixCall(win,payload){
    var response=await win.fetch('/api/diagnostic-autofix',{method:'POST',credentials:'same-origin',cache:'no-store',headers:apiHeaders(win),body:JSON.stringify(Object.assign({environment:environment(win)},payload||{}))});
    var raw=await response.text(),data={};try{data=raw?JSON.parse(raw):{}}catch(_){data={message:raw}}
    if(!response.ok||data.ok===false){var e=new Error(text(data.message)||('HTTP '+response.status));e.code=text(data.code);throw e}
    return data
  }
  async function autofixConfiguration(win){
    if(AUTOFIX_CONFIG&&AUTOFIX_CONFIG.checkedAt&&Date.now()-AUTOFIX_CONFIG.checkedAt<60000)return AUTOFIX_CONFIG;
    try{var d=await autofixCall(win,{action:'configuration'});AUTOFIX_CONFIG=Object.assign({},d,{checkedAt:Date.now()});return AUTOFIX_CONFIG}
    catch(e){AUTOFIX_CONFIG={configured:false,error:text(e&&e.message||e),code:text(e&&e.code),checkedAt:Date.now()};return AUTOFIX_CONFIG}
  }
  async function requestAutofix(win,id,button){
    if(!id)return false;
    if(button)button.disabled=true;
    try{
      var data=await autofixCall(win,{action:'request',diagnosticId:id});
      try{win.dispatchEvent(new CustomEvent('exporthub:diagnostic-autofix',{detail:data}))}catch(_){}
      var cloud=win.ExportHUBDiagnosticsCloud864;if(cloud&&typeof cloud.refresh==='function')await cloud.refresh(true);
      await refresh(win);
      return true
    }catch(e){
      if(button)button.disabled=false;
      try{win.alert(tr('diagnostics.autofixRequestFailed',{error:text(e&&e.message||e)}))}catch(_){}
      return false
    }
  }
  function statusInfo(d){
    var af=d&&d.autofix||{},status=low(af.status||'');
    if(d&&d.resolvedAt||status==='fixed')return{key:'fixed',label:tr('diagnostics.status.fixed'),text:d.resolvedBy?tr('diagnostics.status.fixedBy',{user:d.resolvedBy}):tr('diagnostics.status.fixed')};
    if(['queued','claimed','running','testing','deploying'].indexOf(status)>=0)return{key:'working',label:tr('diagnostics.status.working'),text:text(af.lastMessage,500)||tr('diagnostics.status.workingText')};
    if(status==='failed'||status==='reverted')return{key:'failed',label:tr('diagnostics.status.failed'),text:text(af.lastMessage,800)||tr('diagnostics.status.failedText')};
    return{key:'open',label:tr('diagnostics.status.open'),text:''};
  }

  function filterRows(rows){
    var needle=low(UI_FILTER.query);
    return rows.filter(function(r){
      var d=describe(r),st=statusInfo(d);
      if(UI_FILTER.level!=='all'&&low(d.level)!==UI_FILTER.level)return false;
      if(UI_FILTER.status!=='all'&&st.key!==UI_FILTER.status)return false;
      if(UI_FILTER.area!=='all'&&d.area!==UI_FILTER.area)return false;
      if(!needle)return true;
      return low([d.code,d.area,d.category,d.user,d.company,d.technicalMessage,d.meaning,d.cause,d.nextStep,st.label,st.text].join(' ')).indexOf(needle)>=0
    })
  }
  function currentView(win){try{var s=typeof win.__EXPORTHUB_GET_STATE__==='function'?win.__EXPORTHUB_GET_STATE__():(win.state||{});return low(s&&s.view);}catch(_){return'';}}
  function diagnosticsVisible(win){
    var view=currentView(win);
    if(view)return view==='diagnostics';
    return !!win.document.querySelector('[data-view="diagnostics"].active,[data-view="diagnostics"][aria-current="page"],[data-eh-view="diagnostics"].active');
  }
  function removeDiagnosticsHost(win){
    if(!win||!win.document)return false;
    var host=win.document.getElementById('rc1013-diagnostics-enhanced');
    if(!host)return false;
    if(typeof host.remove==='function')host.remove();
    else if(host.parentElement)host.parentElement.removeChild(host);
    return true;
  }
  function style(win){
    if(win.document.getElementById('rc1013-diagnostics-style'))return;
    var s=win.document.createElement('style');s.id='rc1013-diagnostics-style';s.textContent='\
#rc1013-diagnostics-enhanced{margin:10px 0 14px;padding:12px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;font-size:13px}#rc1013-diagnostics-enhanced .rc1013-head{display:flex;gap:8px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}#rc1013-diagnostics-enhanced .rc1013-head h3{font-size:16px;line-height:1.2;margin:0 0 2px}#rc1013-diagnostics-enhanced .rc1013-list{display:grid;gap:8px;margin-top:10px}.rc1013-diag-card{background:#fff;border:1px solid #dbe4ef;border-left:5px solid #dc2626;border-radius:12px;padding:11px;font-size:13px;line-height:1.35}.rc1013-diag-card.warning{border-left-color:#f59e0b}.rc1013-diag-top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.rc1013-code{font:800 12px ui-monospace,SFMono-Regular,Consolas,monospace;background:#fee2e2;color:#991b1b;border-radius:999px;padding:4px 8px}.rc1013-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0}.rc1013-meta div,.rc1013-block{background:#f8fafc;border-radius:8px;padding:7px}.rc1013-meta b,.rc1013-block b{display:block;font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:3px}.rc1013-tech{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;white-space:pre-wrap;word-break:break-word}.rc1013-details{margin-top:6px;font-size:11px;line-height:1.3;color:#475569;white-space:pre-wrap;word-break:break-word}.rc1083-diag-filters{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(3,minmax(150px,.7fr));gap:8px;margin-top:10px}.rc1083-diag-filters input,.rc1083-diag-filters select{min-height:40px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;background:#fff}.rc1083-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px}.rc1083-status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800}.rc1083-status.open{background:#fee2e2;color:#991b1b}.rc1083-status.working{background:#dbeafe;color:#1d4ed8}.rc1083-status.fixed{background:#dcfce7;color:#166534}.rc1083-status.failed{background:#ffedd5;color:#9a3412}.rc1083-autofix-note{margin-top:8px;padding:9px 10px;border:1px solid #bfdbfe;border-radius:9px;background:#eff6ff;color:#1e3a8a}.rc1083-autofix-note.bad{border-color:#fed7aa;background:#fff7ed;color:#9a3412}.rc1085-off{border-color:#cbd5e1;background:#f8fafc;color:#334155}.rc1083-run{font-size:11px}.rc1013-diag-card.fixed{border-left-color:#16a34a;opacity:.84}.rc1013-diag-card.working{border-left-color:#2563eb}.rc1013-diag-card.failed{border-left-color:#ea580c}@media(max-width:980px){.rc1083-diag-filters{grid-template-columns:1fr 1fr}}@media(max-width:760px){#rc1013-diagnostics-enhanced .rc1013-meta{grid-template-columns:1fr 1fr}}@media(max-width:480px){#rc1013-diagnostics-enhanced{padding:10px}.rc1013-diag-card{padding:9px}#rc1013-diagnostics-enhanced .rc1013-meta{grid-template-columns:1fr}}';win.document.head.appendChild(s);
  }
  function pageRoot(win){
    var h=Array.prototype.find.call(win.document.querySelectorAll('h1,h2,h3'),function(el){return /fehlerdiagnose/i.test(text(el.textContent));});
    if(h){var p=h.closest('.page-head,.rc626-head,.card');if(p&&p.parentElement)return p.parentElement;}
    return win.document.getElementById('content')||win.document.querySelector('.main')||win.document.body;
  }
  function cardHtml(d,autofixReady,autofixEnabled){
    var details=Object.keys(d.details||{}).length?'<div class="rc1013-details"><b>'+esc(tr('diagnostics.technicalDetails'))+'</b> '+esc(JSON.stringify(d.details,null,2))+'</div>':'',st=statusInfo(d),af=d.autofix||{},
        run=af.runUrl?'<a class="rc1083-run" href="'+esc(af.runUrl)+'" target="_blank" rel="noopener">'+esc(tr('diagnostics.openGithubRun'))+'</a>':'',
        action='';
    if(st.key==='open'||st.key==='failed')action=!autofixEnabled?'<button type="button" class="btn ghost" disabled>'+esc(tr('diagnostics.autofixDisabledButton'))+'</button>':'<button type="button" class="btn" data-rc1083-autofix="'+esc(d.id)+'"'+(autofixReady?'':' disabled')+'>'+esc(tr('diagnostics.fixWithChatgpt'))+'</button>';
    else if(st.key==='working')action='<button type="button" class="btn" disabled>'+esc(tr('diagnostics.autofixRunning'))+'</button>';
    var resolution=(st.text||d.resolutionMessage)?'<div class="rc1083-autofix-note '+(st.key==='failed'?'bad':'')+'"><b>'+esc(st.label)+'</b>'+(st.text?'<div>'+esc(st.text)+'</div>':'')+(d.resolutionMessage?'<div>'+esc(d.resolutionMessage)+'</div>':'')+'</div>':'';
    return '<article class="rc1013-diag-card '+esc(d.level)+' '+esc(st.key)+'"><div class="rc1013-diag-top"><div><strong>'+esc(d.area)+'</strong><div>'+esc(d.category)+' · '+esc(d.level.toUpperCase())+'</div></div><div><span class="rc1083-status '+esc(st.key)+'">'+esc(st.label)+'</span> <span class="rc1013-code">'+esc(d.code)+'</span></div></div><div class="rc1013-meta"><div><b>'+esc(tr('diagnostics.user'))+'</b>'+esc(d.user)+' · '+esc(d.userId)+'</div><div><b>'+esc(tr('diagnostics.company'))+'</b>'+esc(d.company)+'</div><div><b>'+esc(tr('diagnostics.environmentVersion'))+'</b>'+esc(d.environment)+' · '+esc(d.clientVersion)+'</div><div><b>'+esc(tr('diagnostics.time'))+'</b>'+esc(d.time)+'</div></div><div class="rc1013-block"><b>'+esc(tr('diagnostics.meaning'))+'</b>'+esc(d.meaning)+'</div><div class="rc1013-block"><b>'+esc(tr('diagnostics.probableCause'))+'</b>'+esc(d.cause)+'</div><div class="rc1013-block"><b>'+esc(tr('diagnostics.nextStep'))+'</b>'+esc(d.nextStep)+'</div><div class="rc1013-block rc1013-tech"><b>'+esc(tr('diagnostics.technicalMessage'))+'</b>'+esc(d.technicalMessage)+'</div>'+details+resolution+'<div class="rc1083-actions">'+action+run+'</div></article>';
  }

  async function refresh(win){
    if(!win||!win.document)return false;
    if(!diagnosticsVisible(win)){removeDiagnosticsHost(win);return false;}
    var cloud=win.ExportHUBDiagnosticsCloud864;if(!cloud||typeof cloud.isGlobalAdmin!=='function'||!cloud.isGlobalAdmin())return false;
    try{if(typeof cloud.refresh==='function')await cloud.refresh(true);}catch(_){ }
    var rows=[];try{rows=typeof cloud.recentRecords==='function'?(cloud.recentRecords(500)||[]):[];}catch(_){rows=[];}
    rows=rows.filter(function(r){var l=low(r&&r.level);return l==='error'||l==='warning';}).slice(-250).reverse();
    var cfg=await autofixConfiguration(win),filtered=filterRows(rows),areas=Array.from(new Set(rows.map(function(r){return describe(r).area}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b)});
    var rootEl=pageRoot(win),host=win.document.getElementById('rc1013-diagnostics-enhanced');
    if(!host){host=win.document.createElement('section');host.id='rc1013-diagnostics-enhanced';rootEl.appendChild(host);}
    else if(host.parentElement!==rootEl||host!==rootEl.lastElementChild){rootEl.appendChild(host);}
    var areaOptions='<option value="all">'+esc(tr('diagnostics.allAreas'))+'</option>'+areas.map(function(a){return'<option value="'+esc(a)+'"'+(UI_FILTER.area===a?' selected':'')+'>'+esc(a)+'</option>'}).join('');
    var preflight=cfg&&cfg.preflight||{},enabled=cfg&&cfg.enabled===true,configProblem=!cfg.github?tr('diagnostics.serverIncomplete'):preflight.conclusion!=='success'?(text(preflight.message)||tr('diagnostics.autofixNotPrepared')):(text(cfg.error)||tr('diagnostics.autofixNotConfigured')),
        preflightLink=enabled&&preflight.runUrl?'<a class="rc1083-run" href="'+esc(preflight.runUrl)+'" target="_blank" rel="noopener">Autofix-Vorflug öffnen</a>':'',
        configNote=!enabled?'<div class="rc1083-autofix-note rc1085-off"><b>'+esc(tr('diagnostics.disabledTitle'))+'</b> '+esc(tr('diagnostics.disabledBody'))+'</div>':cfg.configured?'<div class="rc1083-autofix-note"><b>'+esc(tr('diagnostics.readyTitle'))+'</b> '+esc(tr('diagnostics.readyBody'))+'</div>':'<div class="rc1083-autofix-note bad"><b>'+esc(tr('diagnostics.incompleteTitle'))+'</b> '+esc(configProblem)+(preflightLink?'<div class="rc1083-actions">'+preflightLink+'</div>':'')+'</div>';
    host.innerHTML='<div class="rc1013-head"><div><h3>'+esc(tr('diagnostics.title'))+'</h3><div>'+esc(tr('diagnostics.subtitle'))+'</div></div><strong>'+esc(tr('diagnostics.count',{filtered:filtered.length,total:rows.length}))+'</strong></div>'+configNote+'<div class="rc1083-diag-filters"><input data-rc1083-q placeholder="'+esc(tr('diagnostics.searchPlaceholder'))+'" value="'+esc(UI_FILTER.query)+'"><select data-rc1083-level><option value="all">'+esc(tr('diagnostics.allLevels'))+'</option><option value="error"'+(UI_FILTER.level==='error'?' selected':'')+'>'+esc(tr('diagnostics.error'))+'</option><option value="warning"'+(UI_FILTER.level==='warning'?' selected':'')+'>'+esc(tr('diagnostics.warnings'))+'</option></select><select data-rc1083-status><option value="all">'+esc(tr('diagnostics.allStatus'))+'</option><option value="open"'+(UI_FILTER.status==='open'?' selected':'')+'>'+esc(tr('diagnostics.status.open'))+'</option><option value="working"'+(UI_FILTER.status==='working'?' selected':'')+'>'+esc(tr('diagnostics.status.working'))+'</option><option value="fixed"'+(UI_FILTER.status==='fixed'?' selected':'')+'>'+esc(tr('diagnostics.status.fixed'))+'</option><option value="failed"'+(UI_FILTER.status==='failed'?' selected':'')+'>'+esc(tr('diagnostics.status.failed'))+'</option></select><select data-rc1083-area>'+areaOptions+'</select></div><div class="rc1013-list">'+(filtered.length?filtered.map(function(r){return cardHtml(describe(r),cfg.configured===true,enabled);}).join(''):'<div class="rc1013-block">'+esc(tr('diagnostics.empty'))+'</div>')+'</div>';
    var qf=host.querySelector('[data-rc1083-q]'),lf=host.querySelector('[data-rc1083-level]'),sf=host.querySelector('[data-rc1083-status]'),af=host.querySelector('[data-rc1083-area]');
    if(qf)qf.addEventListener('input',function(){UI_FILTER.query=this.value;refresh(win)});
    if(lf)lf.addEventListener('change',function(){UI_FILTER.level=this.value;refresh(win)});
    if(sf)sf.addEventListener('change',function(){UI_FILTER.status=this.value;refresh(win)});
    if(af)af.addEventListener('change',function(){UI_FILTER.area=this.value;refresh(win)});
    Array.prototype.forEach.call(host.querySelectorAll('[data-rc1083-autofix]'),function(btn){btn.addEventListener('click',function(){requestAutofix(win,text(btn.getAttribute('data-rc1083-autofix')),btn)})});
    return true;
  }
  function install(win){
    if(!win||!win.document||win.__EXPORTHUB_RC1013_DIAGNOSTICS__)return;win.__EXPORTHUB_RC1013_DIAGNOSTICS__=true;win.__EXPORTHUB_RC1125_DIAGNOSTICS_VIEW_ISOLATION__=true;style(win);
    var timer=0,schedule=function(delay){clearTimeout(timer);timer=setTimeout(function(){refresh(win);},delay||120);};
    ['exporthub:ready','exporthub:rendered','exporthub:diagnostic','exporthub:diagnostic-autofix','exporthub:language-changed'].forEach(function(n){win.addEventListener(n,function(){schedule(120);});});
    win.addEventListener('exporthub:viewchange',function(){schedule(0);});
    if(win.MutationObserver){var mo=new win.MutationObserver(function(){if(diagnosticsVisible(win)||win.document.getElementById('rc1013-diagnostics-enhanced'))schedule(180);});mo.observe(win.document.documentElement,{childList:true,subtree:true});}
    win.setInterval(function(){if(!win.document.hidden&&(diagnosticsVisible(win)||win.document.getElementById('rc1013-diagnostics-enhanced')))refresh(win)},10000);
    schedule(300);
  }
  return Object.freeze({version:'RC1085',describe:describe,codeOf:codeOf,refresh:refresh,install:install,requestAutofix:requestAutofix,filterRows:filterRows,statusInfo:statusInfo});
});
