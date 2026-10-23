/* ExportHUB360 RC1660 – "SOP öffnen" in "Sendung erstellen" and a click simulation for every SOP.
   Shipment mask: when the selected customer has a SOP or a customer portal, a button appears below the
   customer context cards (rc628). It opens a movable, resizable popup in the same mask (no navigation):
   portal links, the customer SOP as a step checklist (progress per shipment) and "Simulation üben".
   Simulation: a practice screen built from the SOP steps; the user reads each task and clicks the matching
   field themselves, wrong clicks and hints are counted. It never touches shipment data, saves or sends anything.
   SOP handbook: every .rc1007-sop-document gets the same simulation button.
   Texts live in assets/i18n/rc1660-shipment-sop-popup.js. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBShipmentSop)return;
var VERSION='RC1660',POPUP_ID='rc1660SopPopup',BAR_ID='rc1660SopBar',POS_KEY='exporthub.rc1660.popup',DONE_KEY='exporthub.rc1660.sopProgress';
var BUTTON_WORDS=/(speicher|sende|absend|öffne|oeffne|klick|bestätig|bestaetig|anmeld|login|hochlad|upload|druck|herunterlad|download|buch|freigeb|abschließ|abschliess|ablegen|save|send|submit|open|click|confirm|print)/i;
var SELECT_WORDS=/(auswähl|auswaehl|wähle|waehle|select|choose)/i;
var CHECK_WORDS=/(prüf|pruef|kontroll|vergleich|check|verify)/i;
var view={context:'shipment',customer:null,label:'',sops:[],portals:[],selected:'',mode:'sop',minimized:false,sim:null,sig:''};
var pending=0,observed=0,lastGridSig=null,drag=null,resizeObs=null;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function norm(v){return low(v).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function multiline(v){return esc(String(v==null?'':v).replace(/\r\n?/g,'\n').trim()).replace(/\n/g,'<br>')}
function uiPacks(){var p=w.ExportHUBShipmentSop1660I18n;return p&&p.packs||{de:{}}}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(uiPacks()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=uiPacks(),pack=all[lang()]||all.de||{},s=pack[key]||(all.de||{})[key]||key;if(vars)Object.keys(vars).forEach(function(k){s=s.split('{'+k+'}').join(String(vars[k]))});return s}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function'){var s=w.__EXPORTHUB_GET_STATE__();if(s)return s}}catch(_){}return w.state||{}}
function readStore(key){try{var v=w.localStorage.getItem(key);return v?JSON.parse(v):null}catch(_){return null}}
function writeStore(key,value){try{w.localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
function validUrl(v){var value=q(v);return /^https?:\/\/[^\s]+$/i.test(value)?value:''}
function hostOf(url){try{return new URL(url).host.toLowerCase()}catch(_){return''}}
function hash(v){var h=2166136261,s=String(v||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function native(){return w.ExportHUBClean&&w.ExportHUBClean.native||w}

/* ---------- customer, portals and SOPs ---------- */
function portalApi(){return w.ExportHUBRC628CustomerPortal||null}
function currentCustomer(){var api=portalApi();try{return api&&typeof api.currentCustomer==='function'?api.currentCustomer():null}catch(_){return null}}
function customerKeys(c){return c?[c.id,c.customerId,c.account,c.customerNumber,c.number,c.customerNo].map(q).filter(Boolean):[]}
function customerName(c){return q(c&&(c.name||c.customerName||c.company||c.label))}
function customerPortals(c){var api=portalApi();try{return c&&api&&typeof api.portalInfo==='function'?arr(api.portalInfo(c)):[]}catch(_){return[]}}
function legacySops(){
  var out=[],seen={};
  function add(list){arr(list).forEach(function(s){var id=q(s&&s.id);if(!s||typeof s!=='object'||(id&&seen[id]))return;if(id)seen[id]=1;out.push(s)})}
  try{if(typeof w.rc46AllSops==='function')add(w.rc46AllSops())}catch(_){}
  var s=state();add(s.customSops);add(s.userSops);add(s.ownSops);
  return out;
}
function shortTitle(txt){
  var first=q(String(txt||'').split(/\n/)[0]);var m=first.match(/^(.{8,}?[.!?])(\s|$)/);if(m)first=m[1];
  first=first.replace(/[.:]$/,'');
  if(first.length>64)first=first.slice(0,60).replace(/\s+\S*$/,'')+' …';
  return first;
}
function versionContent(sop){
  try{var api=w.ExportHubIsoSopModel;if(api&&typeof api.currentVersionRecord==='function'){var r=api.currentVersionRecord(sop);if(r&&r.content&&typeof r.content==='object')return r.content}}catch(_){}
  return null;
}
function rawSteps(sop){
  if(!sop)return[];
  if(arr(sop.steps).length)return sop.steps;
  var content=versionContent(sop);if(content&&arr(content.steps).length)return content.steps;
  return sop.sections&&arr(sop.sections.steps).length?sop.sections.steps:[];
}
function stepsOf(sop){
  return rawSteps(sop).map(function(s){
    if(typeof s==='string'){var line=String(s).trim();return line?{title:shortTitle(line),text:line}:null}
    if(!s||typeof s!=='object'||s.notRelevant===true)return null;
    var title=q(s.title||s.name||s.label||s.heading),body=String(s.instruction||s.text||s.description||s.body||s.details||'').trim();
    if(!title&&!body)return null;
    // SOP handbook steps read "Teilprozess: Handlung." – the part before the colon is the group, not the step.
    var group='',m=!title&&body.match(/^([^:\n]{4,90}):\s+([\s\S]+)$/);
    if(m){group=q(m[1]);body=m[2].trim()}
    if(!title)title=shortTitle(body);
    return{title:title,text:q(body)===title?'':body,group:group};
  }).filter(Boolean).map(function(step,i,all){
    var same=all.filter(function(o){return o.title===step.title});
    return same.length>1?Object.assign({},step,{title:step.title+' ('+(same.indexOf(step)+1)+')'}):step;
  });
}
function sopEntry(sop,source){
  var portalUrl=validUrl(sop.portalUrl||sop.url||sop.link||(arr(sop.portals)[0]&&(sop.portals[0].url||sop.portals[0].link)));
  return{id:q(sop.id||sop.number||sop.title),title:q(sop.number&&sop.title&&source==='process'?sop.number+' – '+sop.title:sop.title||sop.name||sop.customerName||sop.number)||'SOP',source:source,steps:stepsOf(sop),portal:q(sop.portal||sop.portalName),portalUrl:portalUrl};
}
function sopMatches(sop,c,portals){
  var keys=customerKeys(c);
  if([sop.account,sop.customerNumber,sop.customerId,sop.customerAccount].concat(arr(sop.accounts)).map(q).filter(Boolean).some(function(k){return keys.indexOf(k)>=0}))return true;
  var link=[c.sopId,c.sop,c.sopTitle,c.sopName].map(norm).filter(Boolean);
  if(link.length&&(link.indexOf(norm(sop.id))>=0||link.indexOf(norm(sop.title))>=0))return true;
  var name=norm(customerName(c)),sopName=norm(sop.customerName||sop.customer);
  if(name&&sopName.length>=4&&(name===sopName||name.indexOf(sopName+' ')===0||sopName.indexOf(name+' ')===0))return true;
  var portalNames=portals.map(function(p){return norm(p.name)}),portalHosts=portals.map(function(p){return hostOf(p.url)}).filter(Boolean);
  var sp=norm(sop.portal||sop.portalName);if(sp&&portalNames.indexOf(sp)>=0)return true;
  var sh=hostOf(validUrl(sop.portalUrl));return !!(sh&&portalHosts.indexOf(sh)>=0);
}
function collect(c){
  var portals=customerPortals(c).map(function(p){return{name:q(p.name)||t('portals'),url:validUrl(p.url)}}).filter(function(p){return p.url});
  var sops=[];
  if(c)legacySops().forEach(function(s){
    if(!sopMatches(s,c,portals))return;
    var type=low(s.type),portalOnly=type==='portal'||(!q(s.account)&&!q(s.customerNumber)&&!q(s.customerId)&&!!q(s.portal));
    sops.push(sopEntry(s,portalOnly?'portal':'customer'));
  });
  var seen={};portals.forEach(function(p){seen[p.url.toLowerCase()]=1});
  sops.forEach(function(s){if(s.portalUrl&&!seen[s.portalUrl.toLowerCase()]){seen[s.portalUrl.toLowerCase()]=1;portals.push({name:s.portal||s.title,url:s.portalUrl})}});
  return{customer:c,label:c?(customerName(c)||customerKeys(c)[0]||''):'',portals:portals,sops:sops};
}
function selectedSop(){var list=view.sops;for(var i=0;i<list.length;i++)if(list[i].id===view.selected)return list[i];return list[0]||null}

/* ---------- per-shipment checklist progress ---------- */
function shipmentKey(){
  var sh=state().shipment||{},input=d.getElementById('rc408Shipment_ref_1');
  return q(sh.id||sh.ref||sh.reference||(input&&input.value))||'draft';
}
function progressKey(sop){return shipmentKey()+'|'+(sop&&sop.id||'')}
function doneSteps(sop){var all=readStore(DONE_KEY)||{};return arr(all[progressKey(sop)])}
function toggleDone(sop,index){
  var all=readStore(DONE_KEY)||{},key=progressKey(sop),list=arr(all[key]).slice(),at=list.indexOf(index);
  if(at>=0)list.splice(at,1);else list.push(index);
  if(list.length)all[key]=list;else delete all[key];
  var keys=Object.keys(all);if(keys.length>200)keys.slice(0,keys.length-200).forEach(function(k){delete all[k]});
  writeStore(DONE_KEY,all);
}

/* ---------- button in the shipment mask ---------- */
function customerGrid(){return d.getElementById('rc628CustomerContext')}
function ensureBar(){
  var grid=customerGrid(),bar=d.getElementById(BAR_ID);
  lastGridSig=grid?(grid.dataset.contextSig||''):null;
  var info=collect(currentCustomer());
  if(view.context==='shipment'&&d.getElementById(POPUP_ID))applyInfo(info,false);
  if(!grid||(!info.sops.length&&!info.portals.length)){if(bar)bar.remove();return false}
  if(!bar){bar=d.createElement('div');bar.id=BAR_ID;bar.className='rc1660-sop-bar'}
  if(grid.nextElementSibling!==bar)grid.insertAdjacentElement('afterend',bar);
  var html='<button type="button" class="btn rc1660-sop-open" data-rc1660-open="1" data-rc739-no-loading="1" aria-haspopup="dialog">📘 '+esc(t('open'))+'</button><span class="rc1660-sop-hint">'+esc(t('openHint',{sops:info.sops.length,portals:info.portals.length}))+'</span>';
  if(bar.dataset.html!==html){bar.innerHTML=html;bar.dataset.html=html}
  return true;
}
function applyInfo(info,force){
  var sig=JSON.stringify([info.label,info.portals,info.sops.map(function(s){return[s.id,s.steps.length]})]);
  if(!force&&sig===view.sig)return;
  view.sig=sig;view.customer=info.customer;view.label=info.label;view.portals=info.portals;view.sops=info.sops;
  if(!selectedSop()||selectedSop().id!==view.selected)view.selected=view.sops[0]?view.sops[0].id:'';
  if(view.mode==='sim'&&(!view.sim||view.sim.sopId!==view.selected)){view.mode='sop';view.sim=null}
  render();
}

/* ---------- popup ---------- */
function savedBox(){var p=readStore(POS_KEY);return p&&typeof p==='object'?p:{}}
function clampBox(box){
  var vw=w.innerWidth||1200,vh=w.innerHeight||800;
  var width=Math.min(Math.max(320,Number(box.w)||440),vw-16),height=Math.min(Math.max(260,Number(box.h)||Math.round(vh*0.72)),vh-16);
  var x=Number.isFinite(Number(box.x))?Number(box.x):vw-width-24,y=Number.isFinite(Number(box.y))?Number(box.y):88;
  x=Math.min(Math.max(8,x),vw-Math.min(width,160));y=Math.min(Math.max(8,y),vh-48);
  return{x:Math.round(x),y:Math.round(y),w:Math.round(width),h:Math.round(height)};
}
function mobile(){try{return w.matchMedia('(max-width: 720px)').matches}catch(_){return false}}
function placePopup(el){
  if(mobile()){el.style.left=el.style.top=el.style.width=el.style.height='';return}
  var box=clampBox(savedBox());
  if(view.mode==='sim'&&box.w<620)box.w=Math.min(620,(w.innerWidth||1200)-16),box.x=Math.min(box.x,(w.innerWidth||1200)-box.w-8);
  el.style.left=box.x+'px';el.style.top=box.y+'px';el.style.width=box.w+'px';el.style.height=view.minimized?'':box.h+'px';
}
function rememberBox(el){
  if(!el||mobile())return;
  var old=savedBox(),box={x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:view.minimized?(old.h||el.offsetHeight):el.offsetHeight};
  writeStore(POS_KEY,box);
}
function ensurePopup(){
  var el=d.getElementById(POPUP_ID);
  if(el)return el;
  el=d.createElement('section');el.id=POPUP_ID;el.className='rc1660-popup';el.setAttribute('role','dialog');el.setAttribute('aria-modal','false');el.setAttribute('aria-labelledby','rc1660PopupTitle');
  d.body.appendChild(el);
  if(typeof w.ResizeObserver==='function'){resizeObs=new w.ResizeObserver(function(){if(!drag&&!view.minimized&&el.isConnected)rememberSoon(el)});resizeObs.observe(el)}
  return el;
}
var rememberTimer=0;
function rememberSoon(el){var nt=native();if(rememberTimer)nt.clearTimeout(rememberTimer);rememberTimer=nt.setTimeout(function(){rememberTimer=0;rememberBox(el)},250)}
function headHtml(){
  var sub=view.context==='shipment'?(view.label||t('noCustomer')):(selectedSop()?selectedSop().title:'');
  return'<header class="rc1660-popup-head" data-rc1660-drag="1" title="'+esc(t('dragHint'))+'"><span class="rc1660-grip" aria-hidden="true">⠿</span><div class="rc1660-popup-titles"><b id="rc1660PopupTitle">'+esc(view.mode==='sim'?t('simTitle'):t('title'))+'</b><small>'+esc(sub)+'</small></div>'
    +'<button type="button" class="rc1660-icon" data-rc1660-min="1" aria-label="'+esc(view.minimized?t('restore'):t('minimize'))+'" title="'+esc(view.minimized?t('restore'):t('minimize'))+'">'+(view.minimized?'▢':'–')+'</button>'
    +'<button type="button" class="rc1660-icon" data-rc1660-close="1" aria-label="'+esc(t('close'))+'" title="'+esc(t('close'))+'">×</button></header>';
}
function sourceLabel(source){return t(source==='portal'?'sourcePortal':source==='process'?'sourceProcess':'sourceCustomer')}
function sopBodyHtml(){
  var html='';
  if(view.portals.length)html+='<div class="rc1660-section"><h4>🌐 '+esc(t('portals'))+'</h4><div class="rc1660-portals">'+view.portals.map(function(p){return'<a class="rc1660-portal" href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer"><span>'+esc(p.name)+'</span><span>'+esc(t('openPortal'))+'</span></a>'}).join('')+'</div></div>';
  var sop=selectedSop();
  if(!sop)return html+'<p class="rc1660-empty">'+esc(view.customer?t('noSop'):t('noCustomer'))+'</p>';
  html+='<div class="rc1660-section"><h4>📘 '+esc(t('sops'))+'</h4>';
  if(view.sops.length>1)html+='<label class="rc1660-select"><span>'+esc(t('selectSop'))+'</span><select data-rc1660-select="1">'+view.sops.map(function(s){return'<option value="'+esc(s.id)+'"'+(s.id===sop.id?' selected':'')+'>'+esc(s.title)+'</option>'}).join('')+'</select></label>';
  else html+='<p class="rc1660-sop-title"><b>'+esc(sop.title)+'</b></p>';
  html+='<span class="rc1660-badge">'+esc(sourceLabel(sop.source))+'</span>';
  if(!sop.steps.length)return html+'<p class="rc1660-empty">'+esc(t('noSteps'))+'</p></div>';
  var done=view.context==='shipment'?doneSteps(sop):[];
  if(view.context==='shipment')html+='<div class="rc1660-progress" aria-live="polite"><span style="width:'+Math.round(done.length/sop.steps.length*100)+'%"></span><em>'+esc(t('progress',{done:done.length,total:sop.steps.length}))+'</em></div>';
  html+='<ol class="rc1660-steps">'+sop.steps.map(function(step,i){
    var isDone=done.indexOf(i)>=0;
    return'<li class="'+(isDone?'is-done':'')+'"><div><b>'+esc(step.title)+'</b>'+(step.text?'<p>'+multiline(step.text)+'</p>':'')+'</div>'
      +(view.context==='shipment'?'<button type="button" class="rc1660-done" data-rc1660-done="'+i+'" aria-pressed="'+isDone+'">'+(isDone?'✓ ':'')+esc(isDone?t('undo'):t('markDone'))+'</button>':'')+'</li>';
  }).join('')+'</ol></div>';
  return html+'<div class="rc1660-foot"><button type="button" class="btn rc1660-sim-start" data-rc1660-sim="1">'+esc(t('startSim'))+'</button></div>';
}

/* ---------- simulation ---------- */
function fieldKind(step){var s=step.title+' '+step.text;if(BUTTON_WORDS.test(step.title))return'button';if(SELECT_WORDS.test(s))return'select';if(CHECK_WORDS.test(s))return'check';if(BUTTON_WORDS.test(s))return'button';return'input'}
function buildSim(sop){
  var fields=sop.steps.map(function(step,i){return{id:'s'+i,step:i,label:step.title,kind:fieldKind(step)}});
  [['x1','simDistractHelp'],['x2','simDistractCancel'],['x3','simDistractDelete']].forEach(function(x){fields.push({id:x[0],step:-1,labelKey:x[1],kind:'button'})});
  var seed=hash(sop.id);
  fields.sort(function(a,b){return(hash(seed+a.id)%997)-(hash(seed+b.id)%997)});
  return{sopId:sop.id,index:0,errors:0,hints:0,feedback:'',feedbackType:'',hint:false,wrong:'',done:false,fields:fields};
}
function fieldHtml(f,sim){
  var label=f.labelKey?t(f.labelKey):f.label,done=f.step>=0&&f.step<sim.index,hint=sim.hint&&f.step===sim.index;
  var cls='rc1660-sim-field kind-'+f.kind+(done?' is-done':'')+(hint?' is-hint':'')+(sim.wrong===f.id?' is-wrong':'');
  var box=f.kind==='button'?'':'<span class="rc1660-sim-box">'+(done?'✓ '+esc(t('simFieldDone')):'')+(f.kind==='select'?'<i aria-hidden="true">▾</i>':'')+'</span>';
  if(f.kind==='check')return'<button type="button" class="'+cls+'" data-rc1660-field="'+esc(f.id)+'"><span class="rc1660-sim-tick" aria-hidden="true">'+(done?'☑':'☐')+'</span><span class="rc1660-sim-label">'+esc(label)+'</span></button>';
  if(f.kind==='button')return'<button type="button" class="'+cls+'" data-rc1660-field="'+esc(f.id)+'">'+(done?'✓ ':'')+esc(label)+'</button>';
  return'<button type="button" class="'+cls+'" data-rc1660-field="'+esc(f.id)+'"><span class="rc1660-sim-label">'+esc(label)+'</span>'+box+'</button>';
}
function simBodyHtml(){
  var sop=selectedSop(),sim=view.sim;if(!sop||!sim)return'';
  var total=sop.steps.length;
  if(sim.done){
    var perfect=!sim.errors&&!sim.hints;
    return'<div class="rc1660-sim-result"><div class="rc1660-sim-medal" aria-hidden="true">'+(perfect?'🏆':'✅')+'</div><h4>'+esc(t('simDone'))+'</h4><p>'+esc(t('simSummary',{steps:total,errors:sim.errors,hints:sim.hints}))+'</p>'+(perfect?'<p class="rc1660-sim-perfect">'+esc(t('simPerfect'))+'</p>':'')
      +'<div class="rc1660-foot"><button type="button" class="btn" data-rc1660-sim="1">'+esc(t('simRestart'))+'</button><button type="button" class="ghost" data-rc1660-back="1">'+esc(t('simBack'))+'</button></div></div>';
  }
  var step=sop.steps[sim.index];
  var task='<div class="rc1660-sim-task"><span class="rc1660-badge">'+esc(t('simTask',{current:sim.index+1,total:total}))+'</span>'+(step.group?'<small class="rc1660-sim-group">'+esc(step.group)+'</small>':'')+'<p>'+multiline(step.text||step.title)+'</p>'
    +(sim.feedback?'<p class="rc1660-sim-feedback is-'+esc(sim.feedbackType)+'" role="status">'+esc(t(sim.feedback))+'</p>':'')+'</div>';
  var bar='<div class="rc1660-progress"><span style="width:'+Math.round(sim.index/total*100)+'%"></span><em>'+esc(t('simSummary',{steps:sim.index+'/'+total,errors:sim.errors,hints:sim.hints}))+'</em></div>';
  var screen='<div class="rc1660-sim-screen" aria-label="'+esc(t('simScreen',{title:sop.title}))+'"><div class="rc1660-sim-chrome"><i></i><i></i><i></i><span>'+esc(t('simScreen',{title:sop.title}))+'</span></div><div class="rc1660-sim-grid">'+sim.fields.map(function(f){return fieldHtml(f,sim)}).join('')+'</div></div>';
  return'<p class="rc1660-sim-intro">'+esc(t('simIntro'))+'</p>'+task+bar+screen
    +'<div class="rc1660-foot"><button type="button" class="ghost" data-rc1660-hint="1">💡 '+esc(t('simHint'))+'</button><button type="button" class="ghost" data-rc1660-back="1">'+esc(t('simCancel'))+'</button></div>';
}
function simClick(id){
  var sim=view.sim,sop=selectedSop();if(!sim||!sop||sim.done)return;
  var field=sim.fields.find(function(f){return f.id===id});if(!field)return;
  if(field.step>=0&&field.step<sim.index)return;
  if(field.step===sim.index){
    sim.index+=1;sim.hint=false;sim.wrong='';sim.feedback='simRight';sim.feedbackType='ok';
    if(sim.index>=sop.steps.length)sim.done=true;
  }else{sim.errors+=1;sim.wrong=id;sim.feedback='simWrong';sim.feedbackType='error'}
  render();
}

/* ---------- render and open ---------- */
function render(){
  var el=d.getElementById(POPUP_ID);if(!el)return;
  var focusKey=d.activeElement&&el.contains(d.activeElement)?(d.activeElement.getAttribute('data-rc1660-field')||''):'';
  el.classList.toggle('is-min',view.minimized);el.classList.toggle('is-sim',view.mode==='sim');
  el.innerHTML=headHtml()+(view.minimized?'':'<div class="rc1660-popup-body">'+(view.mode==='sim'?simBodyHtml():sopBodyHtml())+'</div>');
  // Practice clicks are not commands: keep the global "… wird ausgeführt" loading toast away.
  el.querySelectorAll('button').forEach(function(b){b.setAttribute('data-rc739-no-loading','1')});
  placePopup(el);
  if(focusKey){var again=el.querySelector('[data-rc1660-field="'+focusKey+'"]');if(again)again.focus()}
}
function openShipmentPopup(){
  view.context='shipment';view.mode='sop';view.sim=null;view.minimized=false;
  applyInfo(collect(currentCustomer()),true);
  ensurePopup();render();
  var btn=d.querySelector('#'+POPUP_ID+' [data-rc1660-close]');if(btn)btn.focus();
  return true;
}
function openSimulation(rawSop,source){
  var entry=sopEntry(rawSop||{},source||'process');if(!entry.steps.length)return false;
  view.context='standalone';view.customer=null;view.label='';view.portals=[];view.sops=[entry];view.selected=entry.id;view.sig='';
  view.mode='sim';view.sim=buildSim(entry);view.minimized=false;
  ensurePopup();render();return true;
}
function close(){
  var el=d.getElementById(POPUP_ID);if(!el)return;
  rememberBox(el);if(resizeObs){resizeObs.disconnect();resizeObs=null}
  el.remove();view.mode='sop';view.sim=null;
  var opener=d.querySelector('#'+BAR_ID+' [data-rc1660-open]');if(opener&&view.context==='shipment')opener.focus();
}

/* ---------- SOP handbook: simulation button on every SOP document ---------- */
function isoSop(number){
  var code=q(number);if(!code)return null;
  try{var rt=w.ExportHubSopTourRuntime;if(rt&&typeof rt.effectiveSop==='function'){var s=rt.effectiveSop(code);if(s)return s}}catch(_){}
  try{var cat=w.ExportHubIsoSopCatalog;if(cat&&typeof cat.get==='function')return cat.get(code)}catch(_){}
  return null;
}
function enhanceDocuments(){
  d.querySelectorAll('.rc1007-sop-document[data-sop-number] .rc1007-sop-doc-actions').forEach(function(actions){
    if(actions.querySelector('[data-rc1660-sim-sop]'))return;
    var number=actions.closest('.rc1007-sop-document').getAttribute('data-sop-number'),sop=isoSop(number);
    if(!sop||!stepsOf(sop).length)return;
    actions.insertAdjacentHTML('beforeend','<button type="button" class="rc1660-doc-sim" data-rc739-no-loading="1" data-rc1660-sim-sop="'+esc(number)+'">🎯 '+esc(t('startSim').replace(/^▶\s*/,''))+'</button>');
  });
}

/* ---------- events ---------- */
function schedule(delay){var nt=native();if(pending)nt.clearTimeout(pending);pending=nt.setTimeout(function(){pending=0;ensureBar();enhanceDocuments()},delay==null?60:delay)}
function onMutations(){
  if(observed)return;
  observed=native().setTimeout(function(){
    observed=0;
    var grid=customerGrid(),bar=d.getElementById(BAR_ID);
    var gridSig=grid?(grid.dataset.contextSig||''):null;
    if(gridSig!==lastGridSig||(grid&&bar&&grid.nextElementSibling!==bar)||(!grid&&bar))ensureBar();
    enhanceDocuments();
  },120);
}
d.addEventListener('click',function(e){
  var target=e.target&&e.target.closest?e.target:null;if(!target)return;
  if(target.closest('[data-rc1660-open]')){e.preventDefault();openShipmentPopup();return}
  var simSop=target.closest('[data-rc1660-sim-sop]');
  if(simSop){e.preventDefault();e.stopPropagation();openSimulation(isoSop(simSop.getAttribute('data-rc1660-sim-sop')),'process');return}
  var popup=target.closest('#'+POPUP_ID);if(!popup)return;
  if(target.closest('[data-rc1660-close]')){close();return}
  if(target.closest('[data-rc1660-min]')){view.minimized=!view.minimized;render();return}
  var done=target.closest('[data-rc1660-done]');if(done){toggleDone(selectedSop(),Number(done.getAttribute('data-rc1660-done')));render();return}
  if(target.closest('[data-rc1660-sim]')){var sop=selectedSop();if(sop&&sop.steps.length){view.mode='sim';view.sim=buildSim(sop);render()}return}
  if(target.closest('[data-rc1660-back]')){if(view.context==='standalone'){close();return}view.mode='sop';view.sim=null;render();return}
  if(target.closest('[data-rc1660-hint]')){if(view.sim&&!view.sim.done&&!view.sim.hint){view.sim.hint=true;view.sim.hints+=1}render();return}
  var field=target.closest('[data-rc1660-field]');if(field){simClick(field.getAttribute('data-rc1660-field'))}
},true);
d.addEventListener('change',function(e){
  var sel=e.target&&e.target.closest&&e.target.closest('#'+POPUP_ID+' [data-rc1660-select]');
  if(sel){view.selected=sel.value;view.mode='sop';view.sim=null;render()}
});
d.addEventListener('keydown',function(e){if(e.key==='Escape'&&e.target&&e.target.closest&&e.target.closest('#'+POPUP_ID))close()});
d.addEventListener('pointerdown',function(e){
  var head=e.target&&e.target.closest&&e.target.closest('#'+POPUP_ID+' [data-rc1660-drag]');
  if(!head||e.button!==0||e.target.closest('button')||mobile())return;
  var el=d.getElementById(POPUP_ID);
  drag={id:e.pointerId,dx:e.clientX-el.offsetLeft,dy:e.clientY-el.offsetTop,el:el};
  el.classList.add('is-dragging');try{head.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault();
});
d.addEventListener('pointermove',function(e){
  if(!drag||e.pointerId!==drag.id)return;
  var el=drag.el,vw=w.innerWidth,vh=w.innerHeight;
  var x=Math.min(Math.max(8-el.offsetWidth+160,e.clientX-drag.dx),vw-160),y=Math.min(Math.max(8,e.clientY-drag.dy),vh-48);
  el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px';
});
function endDrag(e){if(!drag||e.pointerId!==drag.id)return;drag.el.classList.remove('is-dragging');rememberBox(drag.el);drag=null}
d.addEventListener('pointerup',endDrag);d.addEventListener('pointercancel',endDrag);
w.addEventListener('resize',function(){var el=d.getElementById(POPUP_ID);if(el)placePopup(el)});
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(name){w.addEventListener(name,function(){schedule(80)})});
w.addEventListener('exporthub:language-changed',function(){var bar=d.getElementById(BAR_ID);if(bar)bar.dataset.html='';d.querySelectorAll('[data-rc1660-sim-sop]').forEach(function(b){b.remove()});schedule(0);render()});
function start(){
  schedule(60);
  if(typeof w.MutationObserver==='function')new w.MutationObserver(onMutations).observe(d.body,{childList:true,subtree:true});
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();

w.ExportHUBShipmentSop=Object.freeze({version:VERSION,open:openShipmentPopup,openSimulation:openSimulation,close:close,refresh:ensureBar,
  collect:function(){return collect(currentCustomer())},stepsOf:stepsOf,fieldKind:fieldKind,sopMatches:sopMatches});
})(typeof window!=='undefined'?window:null,typeof document!=='undefined'?document:null);
