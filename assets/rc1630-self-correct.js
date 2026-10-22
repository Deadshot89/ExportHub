/* ExportHUB360 RC1630 – "Selbst korrigieren" in the IT area (global admins only).
   Text korrigieren: search assets/i18n/*.json, edit up to 20 texts/translations, upload them as a job to
   /api/self-correct; GitHub checks, tests and opens a pull request (nothing goes live directly).
   Fehler beschreiben: free bug description → /api/diagnostic-autofix (action request-manual), same tested PR path.
   Verlauf: status of every job, link to the pull request, "Rückgängig machen" for merged text fixes.
   Texts live in assets/i18n/rc1630-self-correct.js; the IT tab itself is rendered by rc1579-menu-redesign.js. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBSelfCorrect)return;
var VERSION='RC1630',ENDPOINT='/api/self-correct',AUTOFIX='/api/diagnostic-autofix',MODAL_ID='rc1630SelfCorrect',MAX=20;
var LANGS=['de','en','pl','es','fr','it'],LOCKED=['legacyUi.','legacyPattern.'];
var packsI18n=null,loading=null,tab='texts',query='',editing='',pending=[],jobs=[],status='',busy=false,poll=0;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uiPacks(){var p=w.ExportHUBSelfCorrect1630I18n;return p&&p.packs||{de:{}}}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(uiPacks()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=uiPacks(),pack=all[lang()]||all.de||{},s=pack[key]||(all.de||{})[key]||key;if(vars)Object.keys(vars).forEach(function(k){s=s.split('{'+k+'}').join(String(vars[k]))});return s}
function germanLocked(key){return LOCKED.some(function(p){return key.indexOf(p)===0})}
function placeholders(v){var out=[];String(v==null?'':v).replace(/\{\{\s*([\w.-]+)\s*\}\}|\{([\w.-]+)\}/g,function(_,a,b){var n=a||b;if(out.indexOf(n)<0)out.push(n);return''});return out.sort()}

function states(){var out=[];function add(x){if(x&&typeof x==='object'&&out.indexOf(x)<0)out.push(x)}try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')add(w.__EXPORTHUB_GET_STATE__())}catch(_){}try{add(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state)}catch(_){}return out}
function currentUser(){try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}var s=states()[0]||{};return s.currentUser||s.activeUser||s.user||null}
// Same roles as api/shared/user-policy.js isAdmin; the server checks again on every call.
function isAdmin(){var u=currentUser();if(!u)return false;var role=low(u.role||u.rolle);return u.globalAdmin===true||u.isGlobalAdmin===true||['global admin','global administrator','globaler administrator','globaler admin','administrator','admin','vollzugriff'].indexOf(role)>=0||arr(u.permissions).indexOf('*')>=0}
function isDemo(){try{return /demo/i.test(String(w.location&&w.location.pathname||''))}catch(_){return false}}
function allowed(){return isAdmin()&&!isDemo()}
function environment(){try{return /-testservice\./i.test(String(w.location&&w.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
function sessionToken(){
 try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},direct=q(rt.authToken||rt.token||rt.sessionToken);if(direct)return direct}catch(_){}
 try{var raw=w.sessionStorage&&w.sessionStorage.getItem('exporthub_rc301_tab_session');if(raw){var x=JSON.parse(raw),tk=q(x&&x.token);if(tk)return tk}}catch(_){}
 return''
}
async function call(url,payload){
 var token=sessionToken(),headers={'Content-Type':'application/json',Accept:'application/json'};
 if(token){headers['X-ExportHUB-Token']=token;headers.Authorization='Bearer '+token}
 var response=await w.fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers,body:JSON.stringify(Object.assign({environment:environment()},payload||{}))});
 var raw=await response.text(),data={};try{data=raw?JSON.parse(raw):{}}catch(_){data={message:raw}}
 if(!response.ok||data.ok===false){var e=new Error(q(data.message)||('HTTP '+response.status));e.code=q(data.code);throw e}
 return data
}
function loadTexts(){
 if(packsI18n)return Promise.resolve(packsI18n);
 if(!loading)loading=Promise.all(LANGS.map(function(l){return w.fetch('/assets/i18n/'+l+'.json?v=1630',{cache:'no-cache',credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status+' '+l);return r.json()})})).then(function(list){var out={};LANGS.forEach(function(l,i){out[l]=list[i]||{}});packsI18n=out;return out}).catch(function(e){loading=null;throw e});
 return loading
}
function search(text){
 var needle=low(text),de=packsI18n&&packsI18n.de||{},hits=[];if(needle.length<2)return{hits:[],more:0};
 Object.keys(de).forEach(function(key){
  var match=low(key).indexOf(needle)>=0?'de':'';
  if(!match)LANGS.some(function(l){var v=packsI18n[l]&&packsI18n[l][key];if(low(v).indexOf(needle)>=0){match=l;return true}return false});
  if(match)hits.push({key:key,lang:match});
 });
 return{hits:hits.slice(0,40),more:Math.max(0,hits.length-40)}
}
function pendingValue(l,key){var p=pending.filter(function(c){return c.lang===l&&c.key===key})[0];return p?p.value:null}

// ---- rendering ----
function style(){
 if(d.getElementById(MODAL_ID+'Style'))return;
 var s=d.createElement('style');s.id=MODAL_ID+'Style';
 s.textContent='#'+MODAL_ID+'{position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}'+
 '#'+MODAL_ID+' .rc1630-card{background:var(--pc-card-bg,#fff);color:var(--pc-text,#0f172a);border-radius:14px;max-width:1000px;width:100%;padding:18px 20px;box-shadow:0 20px 50px rgba(15,23,42,.3)}'+
 '#'+MODAL_ID+' .rc1630-head{display:flex;justify-content:space-between;align-items:center;gap:12px}#'+MODAL_ID+' h2{margin:0;font-size:18px}#'+MODAL_ID+' h3{font-size:14px;margin:14px 0 6px}'+
 '#'+MODAL_ID+' .rc1630-intro{color:var(--pc-muted,#475569);font-size:13px;margin:8px 0 12px}'+
 '#'+MODAL_ID+' .rc1630-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}#'+MODAL_ID+' .rc1630-tabs button[aria-selected="true"]{background:#64748b;color:#fff;border-color:#64748b}'+
 '#'+MODAL_ID+' input[type=text],#'+MODAL_ID+' textarea{width:100%;box-sizing:border-box;font:inherit;padding:7px 9px;border:1px solid var(--pc-line,#cbd5e1);border-radius:8px;background:var(--pc-input-bg,#fff);color:inherit}'+
 '#'+MODAL_ID+' textarea{min-height:58px;resize:vertical}#'+MODAL_ID+' textarea:disabled{opacity:.65}'+
 '#'+MODAL_ID+' .rc1630-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}'+
 '#'+MODAL_ID+' .rc1630-status{min-height:20px;font-weight:600;margin:8px 0}'+
 '#'+MODAL_ID+' .rc1630-hits{list-style:none;margin:6px 0;padding:0;max-height:300px;overflow:auto;border:1px solid var(--pc-line,#e2e8f0);border-radius:8px}'+
 '#'+MODAL_ID+' .rc1630-hits li{display:flex;justify-content:space-between;gap:10px;padding:6px 8px;border-bottom:1px solid var(--pc-line,#e2e8f0);font-size:13px}#'+MODAL_ID+' .rc1630-hits code,#'+MODAL_ID+' td code{font-size:11px;color:var(--pc-muted,#64748b);word-break:break-all}'+
 '#'+MODAL_ID+' .rc1630-editor{display:grid;grid-template-columns:52px 1fr;gap:6px 10px;align-items:start;border:1px solid var(--pc-line,#e2e8f0);border-radius:10px;padding:10px;margin:8px 0}'+
 '#'+MODAL_ID+' .rc1630-editor label{font-weight:700;padding-top:8px;text-transform:uppercase;font-size:12px}#'+MODAL_ID+' .rc1630-note{grid-column:1/-1;font-size:12px;color:#b45309}'+
 '#'+MODAL_ID+' table{width:100%;border-collapse:collapse;font-size:12px}#'+MODAL_ID+' th,#'+MODAL_ID+' td{border-bottom:1px solid var(--pc-line,#e2e8f0);padding:5px 6px;text-align:left;vertical-align:top}'+
 '#'+MODAL_ID+' [data-rc1630-state="failed"],#'+MODAL_ID+' [data-rc1630-state="closed"]{color:#b91c1c}#'+MODAL_ID+' [data-rc1630-state="merged"]{color:#15803d}#'+MODAL_ID+' [data-rc1630-state="pr-open"]{color:#1d4ed8}'+
 '#'+MODAL_ID+' .rc1630-links{margin-top:4px;color:var(--pc-text,#0f172a)}#'+MODAL_ID+' .rc1630-links button{margin-top:4px}'+
 '@media (max-width:640px){#'+MODAL_ID+' .rc1630-history th:nth-child(3),#'+MODAL_ID+' .rc1630-history td:nth-child(3){display:none}#'+MODAL_ID+' .rc1630-card{padding:14px 12px}#'+MODAL_ID+' .rc1630-editor{grid-template-columns:1fr}#'+MODAL_ID+' .rc1630-editor label{padding-top:2px}#'+MODAL_ID+' .rc1630-table{overflow-x:auto}}';
 d.head.appendChild(s)
}
function setStatus(message){status=message||'';var n=d.querySelector('#'+MODAL_ID+' .rc1630-status');if(n)n.textContent=status}
function textsHtml(){
 if(!packsI18n)return '<p>'+esc(t('loading'))+'</p>';
 var html='<div class="rc1630-row"><input type="text" id="rc1630Search" autocomplete="off" placeholder="'+esc(t('search'))+'" aria-label="'+esc(t('search'))+'" value="'+esc(query)+'"></div>';
 if(editing){
  var locked=germanLocked(editing);
  html+='<div class="rc1630-editor" data-rc1630-key="'+esc(editing)+'"><span class="rc1630-note" style="color:inherit"><b>'+esc(t('key'))+':</b> <code>'+esc(editing)+'</code></span>'+
   LANGS.map(function(l){var cur=pendingValue(l,editing),v=cur==null?(packsI18n[l]||{})[editing]:cur;return '<label for="rc1630Edit_'+l+'">'+l+'</label><textarea id="rc1630Edit_'+l+'" data-rc1630-lang="'+l+'"'+(l==='de'&&locked?' disabled':'')+'>'+esc(v==null?'':v)+'</textarea>'}).join('')+
   '<span class="rc1630-note">'+esc(locked?t('germanLocked'):t('germanHint'))+'</span>'+
   '<div class="rc1630-row" style="grid-column:1/-1"><button type="button" class="primary" data-rc1630-add="1">'+esc(t('addChange'))+'</button><button type="button" class="ghost" data-rc1630-cancel-edit="1">'+esc(t('cancel'))+'</button></div></div>';
 }else{
  var r=search(query);
  if(low(query).length<2)html+='<p class="rc1630-intro">'+esc(t('searchHint'))+'</p>';
  else if(!r.hits.length)html+='<p>'+esc(t('noResults'))+'</p>';
  else html+='<ul class="rc1630-hits">'+r.hits.map(function(h){var de=(packsI18n.de||{})[h.key],other=h.lang!=='de'?(packsI18n[h.lang]||{})[h.key]:'';return '<li><span>'+esc(de)+(other?'<br><small>'+h.lang.toUpperCase()+': '+esc(other)+'</small>':'')+'<br><code>'+esc(h.key)+'</code></span><button type="button" class="ghost" data-rc1630-edit="'+esc(h.key)+'">'+esc(t('edit'))+'</button></li>'}).join('')+'</ul>'+(r.more?'<p class="rc1630-intro">'+esc(t('moreResults',{count:r.more}))+'</p>':'');
 }
 html+='<h3>'+esc(t('pending',{count:pending.length,max:MAX}))+'</h3>';
 if(!pending.length)html+='<p class="rc1630-intro">'+esc(t('pendingEmpty'))+'</p>';
 else html+='<div class="rc1630-table"><table><thead><tr><th>'+esc(t('colLang'))+'</th><th>'+esc(t('key'))+'</th><th>'+esc(t('colBefore'))+'</th><th>'+esc(t('colAfter'))+'</th><th></th></tr></thead><tbody>'+pending.map(function(c,i){return '<tr><td>'+c.lang.toUpperCase()+'</td><td><code>'+esc(c.key)+'</code></td><td>'+esc((packsI18n[c.lang]||{})[c.key])+'</td><td>'+esc(c.value)+'</td><td><button type="button" class="ghost" data-rc1630-remove="'+i+'">'+esc(t('remove'))+'</button></td></tr>'}).join('')+'</tbody></table></div>'+
  '<div class="rc1630-row"><input type="text" id="rc1630Reason" maxlength="500" placeholder="'+esc(t('reason'))+'" aria-label="'+esc(t('reason'))+'"></div><div class="rc1630-row"><button type="button" class="primary" data-rc1630-submit="1"'+(busy?' disabled':'')+'>'+esc(busy?t('submitting'):t('submit'))+'</button></div>';
 return html
}
function describeHtml(){
 return '<p class="rc1630-intro">'+esc(t('describeIntro'))+'</p><div class="rc1630-row"><input type="text" id="rc1630Area" maxlength="160" placeholder="'+esc(t('area'))+'" aria-label="'+esc(t('area'))+'"></div>'+
  '<div class="rc1630-row"><textarea id="rc1630Description" maxlength="4000" rows="5" placeholder="'+esc(t('description'))+'" aria-label="'+esc(t('description'))+'"></textarea></div>'+
  '<div class="rc1630-row"><textarea id="rc1630Expected" maxlength="2000" rows="3" placeholder="'+esc(t('expected'))+'" aria-label="'+esc(t('expected'))+'"></textarea></div>'+
  '<div class="rc1630-row"><button type="button" class="primary" data-rc1630-autofix="1"'+(busy?' disabled':'')+'>'+esc(t('startAutofix'))+'</button></div>'
}
function fmt(ts){var dt=new Date(ts);return isNaN(dt)?'':dt.toLocaleString(lang()==='en'?'en-GB':lang())}
function historyHtml(){
 var html='<div class="rc1630-row"><button type="button" class="ghost" data-rc1630-refresh="1">'+esc(t('refresh'))+'</button></div>';
 if(!jobs.length)return html+'<p class="rc1630-intro">'+esc(t('historyEmpty'))+'</p>';
 return html+'<div class="rc1630-table rc1630-history"><table><thead><tr><th>'+esc(t('colTime'))+'</th><th>'+esc(t('colType'))+'</th><th>'+esc(t('colBy'))+'</th><th>'+esc(t('colStatus'))+'</th><th>'+esc(t('colInfo'))+'</th></tr></thead><tbody>'+jobs.map(function(j){
  var st=q(j.status),info=j.type==='texts'?arr(j.changes).map(function(c){return c.lang+': '+c.key}).join(', '):('#'+q(j.targetPr)),links=[];
  if(/^https:\/\/github\.com\//.test(q(j.prUrl)))links.push('<a href="'+esc(j.prUrl)+'" target="_blank" rel="noopener">'+esc(t('openPr'))+'</a>');
  if(/^https:\/\/github\.com\//.test(q(j.runUrl)))links.push('<a href="'+esc(j.runUrl)+'" target="_blank" rel="noopener">'+esc(t('openRun'))+'</a>');
  var action=j.type==='texts'&&st==='merged'?(j.revertJobId?esc(t('reverted')):'<button type="button" class="ghost" data-rc1630-revert="'+esc(j.id)+'">'+esc(t('revert'))+'</button>'):'';
  return '<tr><td>'+esc(fmt(j.requestedAt))+'<br><code>'+esc(j.id)+'</code></td><td>'+esc(j.type==='revert'?t('typeRevert'):t('typeTexts'))+'</td><td>'+esc(j.requestedBy)+'</td><td data-rc1630-state="'+esc(st)+'">'+esc(t('s_'+st.replace(/-/g,'_')))+(st==='failed'&&j.message?'<br><small>'+esc(j.message)+'</small>':'')+(links.length||action?'<div class="rc1630-links">'+links.join(' · ')+(action?' '+action:'')+'</div>':'')+'</td><td>'+esc(info)+'<br><small>'+esc(j.reason)+'</small></td></tr>'
 }).join('')+'</tbody></table></div>'
}
function render(){
 var m=d.getElementById(MODAL_ID);if(!m)return;
 var focusId=d.activeElement&&d.activeElement.id,caret=focusId==='rc1630Search'&&d.activeElement.selectionStart;
 var reason=d.getElementById('rc1630Reason');reason=reason?reason.value:'';
 var tabs=[['texts',t('tabTexts')],['describe',t('tabDescribe')],['history',t('tabHistory')]];
 m.querySelector('.rc1630-body').innerHTML='<div class="rc1630-tabs" role="tablist">'+tabs.map(function(x){return '<button type="button" class="ghost" role="tab" data-rc1630-tab="'+x[0]+'" aria-selected="'+(tab===x[0])+'">'+esc(x[1])+'</button>'}).join('')+'</div>'+
  (tab==='texts'?textsHtml():tab==='describe'?describeHtml():historyHtml())+'<div class="rc1630-status" aria-live="polite">'+esc(status)+'</div>';
 var r=d.getElementById('rc1630Reason');if(r&&reason)r.value=reason;
 if(focusId==='rc1630Search'){var s=d.getElementById('rc1630Search');if(s){s.focus();try{s.setSelectionRange(caret,caret)}catch(_){}}}
}

// ---- actions ----
function addChange(){
 var box=d.querySelector('#'+MODAL_ID+' .rc1630-editor');if(!box)return;var key=box.getAttribute('data-rc1630-key'),added=0,bad=[],chars=[];
 box.querySelectorAll('textarea[data-rc1630-lang]').forEach(function(el){
  var l=el.getAttribute('data-rc1630-lang'),orig=String((packsI18n[l]||{})[key]==null?'':(packsI18n[l]||{})[key]),v=el.value;
  pending=pending.filter(function(c){return !(c.lang===l&&c.key===key)});
  if(el.disabled||v===orig)return;
  if(placeholders(orig).join()!==placeholders(v).join()){bad.push(l.toUpperCase());return}
  if((v.match(/[<>"'`]/g)||[]).some(function(ch){return orig.indexOf(ch)<0})){chars.push(l.toUpperCase());return}
  pending.push({lang:l,key:key,value:v});added++;
 });
 if(bad.length||chars.length){status=bad.length?t('placeholderWarn',{list:bad.join(', ')}):t('charsWarn',{list:chars.join(', ')});render();return}
 if(pending.length>MAX){pending=pending.slice(0,MAX);setStatus(t('tooMany',{max:MAX}))}else setStatus(added?'':t('noChange'));
 editing='';render()
}
async function submit(){
 var reason=q(d.getElementById('rc1630Reason')&&d.getElementById('rc1630Reason').value);
 if(reason.length<3){setStatus(t('reasonRequired'));return}
 busy=true;render();
 try{var r=await call(ENDPOINT,{action:'submit-texts',changes:pending,reason:reason});pending=[];tab='history';status=t('submitted',{id:q(r.job&&r.job.id)});await refresh()}
 catch(e){status=t('error',{message:e.message})}
 finally{busy=false;render()}
}
async function startAutofix(){
 var description=String(d.getElementById('rc1630Description')&&d.getElementById('rc1630Description').value||'').trim();
 if(description.length<20){setStatus(t('describeTooShort'));return}
 var area=q(d.getElementById('rc1630Area')&&d.getElementById('rc1630Area').value),expected=String(d.getElementById('rc1630Expected')&&d.getElementById('rc1630Expected').value||'').trim();
 busy=true;setStatus('');
 try{var r=await call(AUTOFIX,{action:'request-manual',description:description,area:area,expected:expected,clientVersion:VERSION});status=t('autofixStarted',{id:q(r.jobId)});render()}
 catch(e){setStatus(t('error',{message:e.message}))}
 finally{busy=false}
}
async function refresh(){
 try{var r=await call(ENDPOINT,{action:'list'});jobs=arr(r.jobs);if(r.enabled===false||r.configured===false)status=t('disabled')}
 catch(e){status=t('error',{message:e.message})}
 if(tab==='history')render()
}
async function revert(id){
 if(!w.confirm(t('revertConfirm')))return;
 try{var r=await call(ENDPOINT,{action:'revert',jobId:id});status=t('revertStarted',{id:q(r.job&&r.job.id)});await refresh()}
 catch(e){setStatus(t('error',{message:e.message}))}
}
function close(){var m=d.getElementById(MODAL_ID);if(m)m.remove();if(poll){w.clearInterval(poll);poll=0}}
function open(){
 if(!allowed())return false;
 style();close();status='';
 var m=d.createElement('div');m.id=MODAL_ID;m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label',t('title'));m.setAttribute('data-i18n-ignore','1');
 m.innerHTML='<div class="rc1630-card"><div class="rc1630-head"><h2>'+esc(t('title'))+'</h2><button type="button" class="ghost" data-rc1630-close="1">'+esc(t('close'))+'</button></div><p class="rc1630-intro">'+esc(t('intro'))+'</p><div class="rc1630-body"></div></div>';
 d.body.appendChild(m);render();
 loadTexts().then(render,function(e){setStatus(t('loadFailed',{message:e.message}))});
 refresh();
 poll=w.setInterval(function(){if(!d.hidden&&tab==='history'&&jobs.some(function(j){return ['queued','claimed','running','pr-open'].indexOf(j.status)>=0}))refresh()},15000);
 return true
}

d.addEventListener('click',function(e){
 var target=e.target;if(!target||!target.closest)return;
 if(target.closest('[data-rc1630-self-correct]')){e.preventDefault();open();return}
 var m=target.closest('#'+MODAL_ID);if(!m)return;
 if(target===m||target.closest('[data-rc1630-close]')){close();return}
 var b;
 if((b=target.closest('[data-rc1630-tab]'))){tab=b.getAttribute('data-rc1630-tab');status='';render();if(tab==='history')refresh();return}
 if((b=target.closest('[data-rc1630-edit]'))){editing=b.getAttribute('data-rc1630-edit');render();return}
 if(target.closest('[data-rc1630-cancel-edit]')){editing='';render();return}
 if(target.closest('[data-rc1630-add]')){addChange();return}
 if((b=target.closest('[data-rc1630-remove]'))){pending.splice(Number(b.getAttribute('data-rc1630-remove')),1);render();return}
 if(target.closest('[data-rc1630-submit]')){if(!busy)submit();return}
 if(target.closest('[data-rc1630-autofix]')){if(!busy)startAutofix();return}
 if(target.closest('[data-rc1630-refresh]')){refresh();return}
 if((b=target.closest('[data-rc1630-revert]'))){revert(b.getAttribute('data-rc1630-revert'));return}
},true);
d.addEventListener('input',function(e){if(e.target&&e.target.id==='rc1630Search'){query=e.target.value;render()}});
d.addEventListener('keydown',function(e){if(e.key==='Escape'&&d.getElementById(MODAL_ID))close()});

w.ExportHUBSelfCorrect=Object.freeze({version:VERSION,allowed:allowed,label:function(){return t('tab')},open:open,close:close,search:function(text){return search(text).hits}});
// The IT tab bar (rc1579) re-syncs on its own events; this picks up the new tab if it rendered before this script.
try{w.ExportHUBMenu1579&&w.ExportHUBMenu1579.refresh()}catch(_){}
})(typeof window!=='undefined'?window:null,typeof document!=='undefined'?document:null);
