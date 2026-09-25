(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1283_LOADING_LIST_SEARCH__)return;
w.__EXPORTHUB_RC1283_LOADING_LIST_SEARCH__=true;
var timer=0,lastQuery='',lastSelected='',lastSelectedRef='',selectedSnapshot=null;
function q(v){return String(v==null?'':v).trim()}
function arr(v){return Array.isArray(v)?v:[]}
function low(v){var s=q(v).toLowerCase();try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(_){return s}}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){ }try{return w.ExportHUBClean&&w.ExportHUBClean.state||w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state||w.appState||w.state||{}}catch(_){return{}}}
function idOf(sh){return q(sh&&(sh.id||sh.shipmentId||sh.ref||sh.reference||sh.shipmentRef))}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId))}
function customerOf(sh){return q(sh&&(sh.customerName||sh.customer&&sh.customer.name||sh.customer||sh.recipientName||sh.recipient))}
function textValue(v){if(Array.isArray(v))return v.map(textValue).filter(Boolean).join(' ');if(v&&typeof v==='object')return q(v.text||v.value||v.note||v.comment||v.description);return q(v)}
function remarkOf(sh){if(!sh)return'';return ['remark','remarks','comment','comments','note','notes','bemerkung','description','shipmentRemark','pickupRemark','internalRemark'].map(function(k){return textValue(sh[k])}).filter(Boolean).join(' ')}
var DOC_FIELDS=['deliveryFiles','deliveryNotes','deliveryNotesFiles','documents','generatedDocuments','files','attachments','lieferscheine','podFiles','abdFiles','invoiceFiles','mailAttachments'];
function fileNameOf(v){if(!v)return'';if(typeof v==='string')return q(v);return q(v.name||v.fileName||v.filename||v.originalName||v.title||v.file&&v.file.name)}
function documentNames(sh){var out=[];if(!sh)return'';DOC_FIELDS.forEach(function(field){arr(sh[field]).forEach(function(item){var name=fileNameOf(item);if(name)out.push(name);if(item&&typeof item==='object'){arr(item.files).forEach(function(f){var nested=fileNameOf(f);if(nested)out.push(nested)})}})});return out.join(' ')}
function allShipments(s){var out=[],seen={};[s&&s.shipments,s&&s.savedShipments,s&&s.archive].forEach(function(list){arr(list).forEach(function(sh){if(!sh||typeof sh!=='object')return;var key=low(idOf(sh)+'|'+refOf(sh));if(key&&seen[key])return;if(key)seen[key]=1;out.push(sh)})});[s&&s.shipment,s&&s.currentShipment,s&&s.selectedShipment,s&&s.documentShipment].forEach(function(sh){if(!sh||typeof sh!=='object')return;var key=low(idOf(sh)+'|'+refOf(sh));if(key&&seen[key])return;if(key)seen[key]=1;out.push(sh)});return out}
function shipmentIndex(s){var map=new Map();allShipments(s).forEach(function(sh){[idOf(sh),refOf(sh)].forEach(function(k){k=low(k);if(k&&!map.has(k))map.set(k,sh)})});return map}
function shipmentForOption(index,opt){var value=low(opt&&opt.value),label=q(opt&&opt.textContent),hit=value&&index.get(value);if(hit)return hit;var m=label.match(/\b[A-Z0-9]{6}\b/i);if(m&&index.has(low(m[0])))return index.get(low(m[0]));var rows=Array.from(index.values());return rows.find(function(sh){var ref=refOf(sh);return ref&&low(label).indexOf(low(ref))>=0})||null}
function searchText(sh,label){return low([label,refOf(sh),idOf(sh),customerOf(sh),documentNames(sh),remarkOf(sh)].filter(Boolean).join(' '))}
function candidates(select,s){var index=shipmentIndex(s);return Array.from(select&&select.options||[]).filter(function(opt){return q(opt.value)}).map(function(opt,position){var sh=shipmentForOption(index,opt)||{},label=q(opt.textContent);return{value:q(opt.value),label:label,shipment:sh,reference:refOf(sh)||label,customer:customerOf(sh),documents:documentNames(sh),remark:remarkOf(sh),search:searchText(sh,label),position:position}})}
function filterRows(rows,query){var tokens=low(query).split(/\s+/).filter(Boolean);if(!tokens.length)return[];return arr(rows).filter(function(row){return tokens.every(function(token){return q(row&&row.search).indexOf(token)>=0})}).slice(0,60)}
function selectText(select){var label=select&&select.closest&&select.closest('label');return q([select&&select.getAttribute&&select.getAttribute('aria-label'),select&&select.name,select&&select.id,label&&label.textContent].join(' '))}
function findSelect(){return Array.from(d.querySelectorAll('select')).find(function(sel){return /sendung\s*ausw[aä]hlen|shipment\s*(?:select|choose)/i.test(selectText(sel))})||null}
function buttonByText(re){return Array.from(d.querySelectorAll('button,a,[role="button"]')).find(function(el){return re.test(q(el.textContent))&&!el.disabled})||null}
function setNativeHidden(select){select.setAttribute('data-rc1283-native-select','1');select.style.setProperty('display','none','important');var label=select.closest&&select.closest('label');if(label&&label.querySelectorAll('select,input,button').length===1){label.setAttribute('data-rc1283-native-label','1');label.style.setProperty('display','none','important')}return label}
function dispatchSelection(select,value){if(!select)return false;var options=Array.from(select.options||[]),index=options.findIndex(function(opt){return q(opt.value)===q(value)});if(index>=0)select.selectedIndex=index;else select.value=value;lastSelected=value;try{select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){try{var ev=d.createEvent('Event');ev.initEvent('change',true,true);select.dispatchEvent(ev)}catch(__){}}return true}
function currentRow(select){var rows=candidates(select,state()),value=lastSelected,ref=low(lastSelectedRef),hit=rows.find(function(row){return value&&row.value===value})||rows.find(function(row){return ref&&(low(row.reference)===ref||low(refOf(row.shipment))===ref||low(idOf(row.shipment))===ref)});if(hit)return hit;if(selectedSnapshot&&selectedSnapshot.shipment)return selectedSnapshot;var sh=allShipments(state()).find(function(item){return ref&&(low(refOf(item))===ref||low(idOf(item))===ref)});return sh?{value:value,label:lastSelectedRef,shipment:sh,reference:refOf(sh)||lastSelectedRef,customer:customerOf(sh),documents:documentNames(sh),remark:remarkOf(sh),search:searchText(sh,lastSelectedRef)}:null}
function resultMeta(row){var parts=[];if(row.customer)parts.push(row.customer);if(row.documents)parts.push(row.documents);if(row.remark)parts.push(row.remark);return parts.join(' · ')}
function style(){
 if(d.getElementById('rc1283-loading-list-style'))return;
 var st=d.createElement('style');st.id='rc1283-loading-list-style';st.textContent=
 '#rc1283LoadListSearch{margin:0 0 16px;padding:16px;border:1px solid #cbd5e1;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.08)}'+
 '#rc1283LoadListSearch .rc1283-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap}'+
 '#rc1283LoadListSearch h3{margin:0;color:#0f172a;font-size:1.05rem}#rc1283LoadListSearch p{margin:4px 0 0;color:#64748b;font-size:.9rem}'+
 '#rc1283LoadListSearch input[type=search]{width:100%;min-height:44px;margin-top:12px;padding:10px 12px;border:1px solid #94a3b8;border-radius:10px;background:#fff;color:#0f172a;font-size:16px}'+
 '#rc1283LoadListSearch .rc1283-results{display:grid;gap:8px;margin-top:10px;max-height:360px;overflow:auto}'+
 '#rc1283LoadListSearch .rc1283-result{width:100%;padding:10px 12px;text-align:left;border:1px solid #dbe3ee;border-radius:10px;background:#f8fafc;color:#0f172a;cursor:pointer}'+
 '#rc1283LoadListSearch .rc1283-result:hover,#rc1283LoadListSearch .rc1283-result:focus{border-color:#2563eb;background:#eff6ff;outline:none}'+
 '#rc1283LoadListSearch .rc1283-result strong{display:block}#rc1283LoadListSearch .rc1283-result span{display:block;margin-top:3px;color:#64748b;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
 '#rc1283LoadListSearch .rc1283-selected{margin-top:12px;padding:10px 12px;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-weight:700}'+
 '#rc1283LoadListSearch .rc1283-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#rc1283LoadListSearch .rc1283-actions button{min-height:40px;padding:8px 14px;border-radius:9px;border:1px solid #2563eb;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}'+
 '#rc1283LoadListSearch .rc1283-actions button:disabled{opacity:.45;cursor:not-allowed}#rc1283LoadListSearch .rc1283-empty{padding:10px 2px;color:#64748b}'+
 '@media(max-width:640px){#rc1283LoadListSearch{padding:12px}#rc1283LoadListSearch .rc1283-actions button{flex:1 1 100%}}';
 (d.head||d.documentElement).appendChild(st)
}
function rc1285CaptureSelection(event){
 var raw=event&&event.target,target=raw&&raw.closest&&raw.closest('[data-rc1283-result]');
 if(!target)return false;
 var panel=target.closest&&target.closest('#rc1283LoadListSearch')||d.getElementById('rc1283LoadListSearch'),select=panel&&panel.__rc1283Select||findSelect();
 if(!panel||!select)return false;
 var value=q(target.getAttribute&&target.getAttribute('data-rc1283-result')),row=candidates(select,state()).find(function(item){return item.value===value})||(selectedSnapshot&&selectedSnapshot.value===value?selectedSnapshot:null);
 if(!row)return false;
 var input=panel.querySelector&&panel.querySelector('[data-rc1283-search]'),selected=panel.querySelector&&panel.querySelector('[data-rc1283-selected]'),actions=Array.from(panel.querySelectorAll&&panel.querySelectorAll('[data-rc1283-action]')||[]);
 lastSelected=row.value;lastSelectedRef=refOf(row.shipment)||row.reference||row.value;selectedSnapshot={value:row.value,label:row.label,shipment:row.shipment,reference:row.reference,customer:row.customer,documents:row.documents,remark:row.remark,search:row.search};lastQuery=q(input&&input.value);
 if(selected)selected.textContent='Ausgewählt: '+(row.reference||row.label)+(row.customer?' · '+row.customer:'');
 actions.forEach(function(btn){btn.disabled=false});
 if(typeof w.setTimeout==='function')w.setTimeout(function(){var current=findSelect();if(current)dispatchSelection(current,row.value)},0);
 return true
}
function render(panel,select){
 var input=panel.querySelector('[data-rc1283-search]'),results=panel.querySelector('[data-rc1283-results]'),selected=panel.querySelector('[data-rc1283-selected]'),actions=Array.from(panel.querySelectorAll('[data-rc1283-action]')),rows=candidates(select,state()),query=q(input&&input.value),found=filterRows(rows,query),chosen=currentRow(select);
 if(input&&input.value!==lastQuery)lastQuery=input.value;
 results.innerHTML='';
 if(!query){var hint=d.createElement('div');hint.className='rc1283-empty';hint.textContent='Referenz, Kunde, Anhang/Dateiname oder Bemerkung eingeben.';results.appendChild(hint)}
 else if(!found.length){var empty=d.createElement('div');empty.className='rc1283-empty';empty.textContent='Keine passende Ladeliste gefunden.';results.appendChild(empty)}
 else found.forEach(function(row){var b=d.createElement('button');b.type='button';b.className='rc1283-result';b.setAttribute('data-rc1283-result',row.value);var strong=d.createElement('strong');strong.textContent=(row.reference||row.label)+(row.customer?' · '+row.customer:'');var meta=d.createElement('span');meta.textContent=resultMeta(row)||row.label;b.appendChild(strong);b.appendChild(meta);b.addEventListener('click',function(){lastSelected=row.value;lastSelectedRef=refOf(row.shipment)||row.reference||row.value;selectedSnapshot={value:row.value,label:row.label,shipment:row.shipment,reference:row.reference,customer:row.customer,documents:row.documents,remark:row.remark,search:row.search};lastQuery=query;selected.textContent='Ausgewählt: '+(row.reference||row.label)+(row.customer?' · '+row.customer:'');actions.forEach(function(btn){btn.disabled=false})});results.appendChild(b)});
 selected.textContent=chosen?'Ausgewählt: '+(chosen.reference||chosen.label)+(chosen.customer?' · '+chosen.customer:''):'Noch keine Ladeliste ausgewählt.';
 actions.forEach(function(btn){btn.disabled=!chosen})
}
function act(kind,panel,select){
 var row=currentRow(select);if(!row)return false;
 if(kind==='open'||kind==='print'){
  if(typeof w.__EXPORTHUB_RC1283_OPEN_LOAD1__==='function')return w.__EXPORTHUB_RC1283_OPEN_LOAD1__(row.shipment,kind==='print');
  if(kind==='open'){var tab=d.querySelector('[data-index352-doc="load1"]')||buttonByText(/(?:Ladeliste\s*1|\bL1\b)/i);if(tab){tab.click();return true}}
  return false
 }
 if(kind==='download'){if(typeof w.__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__==='function')return w.__EXPORTHUB_RC1283_DOWNLOAD_LOAD1__(row.shipment);var dl=d.querySelector('[data-index352-action="download-load1"]')||buttonByText(/Ladeliste\s*1.*PDF|Ladeliste.*herunterladen/i);if(dl){dl.click();return true}}
 return false
}
function makePanel(select){
 style();var old=d.getElementById('rc1283LoadListSearch');if(old&&old.__rc1283Select===select){render(old,select);return old}if(old)old.remove();
 var label=setNativeHidden(select),host=label&&label.parentNode||select.parentNode;if(!host)return null;
 var panel=d.createElement('section');panel.id='rc1283LoadListSearch';panel.setAttribute('role','search');panel.__rc1283Select=select;
 var head=d.createElement('div');head.className='rc1283-head';var title=d.createElement('div'),h=d.createElement('h3'),p=d.createElement('p');h.textContent='Ladeliste suchen';p.textContent='Suche nach Referenznummer, Kunde, Anhang/Dateiname oder Bemerkung.';title.appendChild(h);title.appendChild(p);head.appendChild(title);panel.appendChild(head);
 var input=d.createElement('input');input.type='search';input.setAttribute('aria-label','Ladeliste suchen');input.setAttribute('data-rc1283-search','1');input.placeholder='Referenz, Kunde, Anhang oder Bemerkung';input.autocomplete='off';input.value=lastQuery;panel.appendChild(input);
 var results=d.createElement('div');results.className='rc1283-results';results.setAttribute('data-rc1283-results','1');panel.appendChild(results);
 var selected=d.createElement('div');selected.className='rc1283-selected';selected.setAttribute('data-rc1283-selected','1');panel.appendChild(selected);
 var actions=d.createElement('div');actions.className='rc1283-actions';[['open','Öffnen'],['print','Drucken'],['download','Herunterladen']].forEach(function(def){var b=d.createElement('button');b.type='button';b.setAttribute('data-rc1283-action',def[0]);b.textContent=def[1];b.addEventListener('click',function(){act(def[0],panel,select)});actions.appendChild(b)});panel.appendChild(actions);
 host.insertBefore(panel,label||select);input.addEventListener('input',function(){lastQuery=input.value;render(panel,select)});render(panel,select);return panel
}
function install(){var select=findSelect(),panel=d.getElementById('rc1283LoadListSearch');if(!select){if(panel)panel.remove();return false}setNativeHidden(select);makePanel(select);return true}
function schedule(){if(timer)w.clearTimeout(timer);timer=w.setTimeout(function(){timer=0;install()},30)}
w.ExportHUBRC1283LoadingListSearch=Object.freeze({version:'RC1285',searchText:searchText,filterRows:filterRows,documentNames:documentNames,remarkOf:remarkOf,candidates:candidates,install:install,action:act,captureSelection:rc1285CaptureSelection});
if(typeof d.addEventListener==='function')d.addEventListener('pointerdown',rc1285CaptureSelection,true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:shipment-saved'].forEach(function(name){w.addEventListener(name,schedule)});
function rc1283MutationRelevant(records){
 var panel=d.getElementById('rc1283LoadListSearch'),current=panel&&panel.__rc1283Select;
 if(current&&d.documentElement&&typeof d.documentElement.contains==='function'&&!d.documentElement.contains(current))return true;
 if(panel&&current){
  for(var c=0;c<(records||[]).length;c++){var target=records[c]&&records[c].target;if(target&&(target===current||current.contains&&current.contains(target)))return true}
  return false
 }
 for(var i=0;i<(records||[]).length;i++){
  var added=records[i]&&records[i].addedNodes||[];
  for(var j=0;j<added.length;j++){
   var node=added[j];if(!node||node.nodeType!==1)continue;
   if(node.id==='rc1283LoadListSearch'||node.closest&&node.closest('#rc1283LoadListSearch'))continue;
   if(node.matches&&node.matches('select')&&/sendung\s*ausw[aä]hlen|shipment\s*(?:select|choose)/i.test(selectText(node)))return true;
   if(node.querySelectorAll){var selects=Array.from(node.querySelectorAll('select'));if(selects.some(function(sel){return /sendung\s*ausw[aä]hlen|shipment\s*(?:select|choose)/i.test(selectText(sel))}))return true}
  }
 }
 return false
}
if(w.MutationObserver&&d.documentElement){
 w.__EXPORTHUB_RC1283_DOCUMENT_OBSERVER__=new MutationObserver(function(records){if(rc1283MutationRelevant(records))schedule()});
 w.__EXPORTHUB_RC1283_DOCUMENT_OBSERVER__.observe(d.documentElement,{subtree:true,childList:true})
}
})(window,document);
