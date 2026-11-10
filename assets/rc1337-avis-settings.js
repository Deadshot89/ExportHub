/* RC1337 – central admin settings for existing Lieferavis and customer portal. */
(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1337_AVIS_SETTINGS__)return;
w.__EXPORTHUB_RC1337_AVIS_SETTINGS__=true;
var loading=false,card=null;
var FIELDS=[['from','from'],['until','until'],['lastPickup','lastPickup'],['closedFrom','closedFrom'],['closedUntil','closedUntil'],['firstPickup','firstPickup']];
function tr(key){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key)}catch(_){}return key}
function el(tag,cls,txt){var x=d.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x}
function putCss(){
 if(d.getElementById('rc1337AdminCss'))return;
 var s=el('style');s.id='rc1337AdminCss';
 s.textContent='.rc1337-admin{margin-top:16px;padding:20px;border:1px solid #cbd5e1;border-radius:15px;background:var(--surface,#fff);box-shadow:0 5px 18px rgba(15,23,42,.04)}.rc1337-admin h3{margin:0 0 6px;font-size:20px}.rc1337-admin p{margin:4px 0 15px;line-height:1.5;color:var(--muted,#64748b)}.rc1337-admin .rc1337-section{padding:15px 0;border-top:1px solid #e2e8f0}.rc1337-admin .rc1337-section h4{font-size:15px;margin:0 0 10px}.rc1337-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.rc1337-admin label{display:flex;flex-direction:column;gap:6px;font-weight:650;font-size:13px}.rc1337-admin input[type=datetime-local]{width:100%;min-height:41px;border:1px solid #bdcbd9;border-radius:8px;padding:8px;color:#1e293b;background:#fff}.rc1337-switches{display:flex;gap:14px;flex-wrap:wrap;margin:11px 0}.rc1337-switches label{flex-direction:row;align-items:center;gap:8px}.rc1337-switches input{width:18px;height:18px;accent-color:#155eef}.rc1337-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.rc1337-actions button{background:#155eef;border:0;border-radius:9px;color:#fff;min-height:42px;padding:10px 17px;font-weight:700;cursor:pointer}.rc1337-actions button:disabled{opacity:.55;cursor:wait}.rc1337-notice-preview{border:1px solid #b9d9e1;border-left:4px solid #397da2;background:#f0f7f9;border-radius:11px;padding:13px;color:#174a67;margin:10px 0;font-size:13px;white-space:pre-line;line-height:1.6}.rc1337-state{font-size:13px}.rc1337-state[data-error="true"]{color:#b91c1c}.rc1337-state[data-error="false"]{color:#176b50}.rc1337-admin .rc1337-where{font-size:13px;line-height:1.6;color:var(--text,#334155)}@media(max-width:680px){.rc1337-grid{grid-template-columns:1fr}.rc1337-admin{padding:13px}}';
 d.head.appendChild(s);
}
function render(cfg){
 var existing=d.getElementById('rc1337AvisAdmin');if(existing)existing.remove();
 var anchor=d.getElementById('rc1065RegistrationCcSettings');
 if(!anchor||!anchor.parentNode)return;
 putCss();card=el('section','card rc1337-admin');card.id='rc1337AvisAdmin';
 var h=el('h3','', tr('avisNotice.title'));card.appendChild(h);
 card.appendChild(el('p','', tr('avisNotice.intro')));
 var sect=el('div','rc1337-section');sect.appendChild(el('h4','',tr('avisNotice.heading')));
 var toggles=el('div','rc1337-switches');
 [['enabledMail','enabledMail'],['enabledPage','enabledPage'],['animate','animate']].forEach(function(row){
  var label=el('label'),input=el('input');input.type='checkbox';input.name=row[0];input.checked=cfg[row[0]]===true;label.appendChild(input);label.appendChild(el('span','',tr('avisNotice.'+row[1])));toggles.appendChild(label);
 });
 sect.appendChild(toggles);
 var grid=el('div','rc1337-grid');
 FIELDS.forEach(function(pair){
  var label=el('label');label.textContent=tr('avisNotice.'+pair[1])+' (Europe/Berlin)';
  var input=el('input');input.type='datetime-local';input.name=pair[0];input.value=cfg[pair[0]]||'';label.appendChild(input);grid.appendChild(label);
 });
 sect.appendChild(grid);
 var preview=el('div','rc1337-notice-preview');preview.setAttribute('role','note');sect.appendChild(preview);
 var actions=el('div','rc1337-actions'),save=el('button','',tr('avisNotice.save')),status=el('span','rc1337-state','');
 save.type='button';save.addEventListener('click',function(){persist(save,status)});
 actions.appendChild(save);actions.appendChild(status);sect.appendChild(actions);
 card.appendChild(sect);
 var where=el('div','rc1337-section rc1337-where');
 where.appendChild(el('h4','',tr('avisNotice.existingTitle')));
 ['whereCustomer','whereShipment','whereOverview','whereSlots'].forEach(function(key){where.appendChild(el('p','',tr('avisNotice.'+key)))});
 card.appendChild(where);anchor.parentNode.insertBefore(card,anchor.nextSibling);
 function updatePreview(){
  var values=readForm();
  preview.textContent=[tr('avisNotice.previewTitle'),tr('avisNotice.previewIntro'),tr('avisNotice.previewLast')+': '+display(values.lastPickup),tr('avisNotice.previewClosed')+': '+display(values.closedFrom)+' – '+display(values.closedUntil),tr('avisNotice.previewFirst')+': '+display(values.firstPickup),tr('avisNotice.previewGreeting')].join('\n');
 }
 function display(v){if(!v)return '—';var parts=v.split('T');var date=parts[0].split('-');return date[2]+'.'+date[1]+'.'+date[0]+' · '+parts[1]}
 Array.from(card.querySelectorAll('input')).forEach(function(inp){inp.addEventListener('change',updatePreview);inp.addEventListener('input',updatePreview)});
 updatePreview();
}
function readForm(){
 var out={};if(!card)return out;
 [['enabledMail','checkbox'],['enabledPage','checkbox'],['animate','checkbox']].forEach(function(row){out[row[0]]=card.querySelector('[name="'+row[0]+'"]').checked});
 FIELDS.forEach(function(pair){out[pair[0]]=card.querySelector('[name="'+pair[0]+'"]').value});
 return out;
}
function persist(button,status){
 button.disabled=true;status.textContent=tr('avisNotice.saving');status.dataset.error='false';
 w.fetch('/api/avis-notice',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json','X-ExportHUB-Avis-Settings':'1'},body:JSON.stringify(readForm())})
  .then(function(r){return r.json().then(function(data){if(!r.ok||!data.ok)throw new Error(data.message||'HTTP '+r.status);return data})})
  .then(function(data){render(data.config);var state=card.querySelector('.rc1337-state');state.dataset.error='false';state.textContent=tr('avisNotice.saved')})
  .catch(function(e){button.disabled=false;status.dataset.error='true';status.textContent=e.message||tr('avisNotice.saveFailed')});
}
function install(){
 if(loading)return;
 var anchor=d.getElementById('rc1065RegistrationCcSettings');
 if(!anchor){var old=d.getElementById('rc1337AvisAdmin');if(old)old.remove();card=null;return}
 if(d.getElementById('rc1337AvisAdmin'))return;
 loading=true;
 w.fetch('/api/avis-notice?admin=1',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}})
  .then(function(r){if(!r.ok)throw new Error(tr('avisNotice.notAuthorized'));return r.json()})
  .then(function(data){if(data&&data.ok&&d.getElementById('rc1065RegistrationCcSettings'))render(data.config||{})})
  .catch(function(){})
  .finally(function(){loading=false});
}
function schedule(){w.setTimeout(install,35)}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(n){w.addEventListener(n,schedule)});
w.addEventListener('exporthub:language-changed',function(){if(card&&card.isConnected)render(readForm());else schedule()});
w.addEventListener('click',schedule,true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})(window,document);