(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1283_LOADING_LIST_SEARCH__)return;
w.__EXPORTHUB_RC1283_LOADING_LIST_SEARCH__=true;
var timer=0,lastQuery='',lastSelected='',lastSelectedRef='',selectedSnapshot=null;
function q(v){return String(v==null?'':v).trim()}
function tr(key,vars){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars)}catch(_){}return key}
function arr(v){return Array.isArray(v)?v:[]}
function low(v){var s=q(v).toLowerCase();try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(_){return s}}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){ }try{return w.ExportHUBClean&&w.ExportHUBClean.state||w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state||w.appState||w.state||{}}catch(_){return{}}}
function idOf(sh){return q(sh&&(sh.id||sh.shipmentId||sh.ref||sh.reference||sh.shipmentRef))}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId))}
function customerOf(sh){return q(sh&&(sh.customerName||sh.customer&&sh.customer.name||sh.customer||sh.recipientName||sh.recipient))}
function statusOf(sh){return q(sh&&(sh.processStatus||sh.status||sh.pickupStatus||sh.state))}
function textValue(v){if(Array.isArray(v))return v.map(textValue).filter(Boolean).join(' ');if(v&&typeof v==='object')return q(v.text||v.value||v.note||v.comment||v.description);return q(v)}
function remarkOf(sh){if(!sh)return'';return ['remark','remarks','comment','comments','note','notes','bemerkung','description','shipmentRemark','pickupRemark','internalRemark'].map(function(k){return textValue(sh[k])}).filter(Boolean).join(' ')}
var DOC_FIELDS=['deliveryFiles','deliveryNotes','deliveryNotesFiles','documents','generatedDocuments','files','attachments','lieferscheine','podFiles','abdFiles','invoiceFiles','mailAttachments'];
function fileNameOf(v){if(!v)return'';if(typeof v==='string')return q(v);return q(v.name||v.fileName||v.filename||v.originalName||v.title||v.file&&v.file.name)}
function documentList(sh){var out=[],seen={};if(!sh)return out;DOC_FIELDS.forEach(function(field){arr(sh[field]).forEach(function(item){var names=[];var name=fileNameOf(item);if(name)names.push(name);if(item&&typeof item==='object')arr(item.files).forEach(function(f){var nested=fileNameOf(f);if(nested)names.push(nested)});names.forEach(function(n){var key=low(n);if(!key||seen[key])return;seen[key]=1;out.push(n)})})});return out}
function documentNames(sh){return documentList(sh).join(' ')}
function documentLabel(count){return tr('loadingList.documentCount',{count:Number(count)||0})}
function allShipments(s){var out=[],seen={};[s&&s.shipments,s&&s.savedShipments,s&&s.archive].forEach(function(list){arr(list).forEach(function(sh){if(!sh||typeof sh!=='object')return;var key=low(idOf(sh)+'|'+refOf(sh));if(key&&seen[key])return;if(key)seen[key]=1;out.push(sh)})});[s&&s.shipment,s&&s.currentShipment,s&&s.selectedShipment,s&&s.documentShipment].forEach(function(sh){if(!sh||typeof sh!=='object')return;var key=low(idOf(sh)+'|'+refOf(sh));if(key&&seen[key])return;if(key)seen[key]=1;out.push(sh)});return out}
function shipmentIndex(s){var map=new Map();allShipments(s).forEach(function(sh){[idOf(sh),refOf(sh)].forEach(function(k){k=low(k);if(k&&!map.has(k))map.set(k,sh)})});return map}
function shipmentForOption(index,opt){var value=low(opt&&opt.value),label=q(opt&&opt.textContent),hit=value&&index.get(value);if(hit)return hit;var m=label.match(/\b[A-Z0-9]{6}\b/i);if(m&&index.has(low(m[0])))return index.get(low(m[0]));var rows=Array.from(index.values());return rows.find(function(sh){var ref=refOf(sh);return ref&&low(label).indexOf(low(ref))>=0})||null}
function searchText(sh,label){return low([label,refOf(sh),idOf(sh),customerOf(sh),documentNames(sh),remarkOf(sh),statusOf(sh)].filter(Boolean).join(' '))}
function candidates(select,s){var index=shipmentIndex(s);return Array.from(select&&select.options||[]).filter(function(opt){return q(opt.value)}).map(function(opt,position){var sh=shipmentForOption(index,opt)||{},label=q(opt.textContent),files=documentList(sh);return{value:q(opt.value),label:label,shipment:sh,reference:refOf(sh)||label,customer:customerOf(sh),status:statusOf(sh),documents:files.join(' '),documentList:files,documentCount:files.length,remark:remarkOf(sh),search:searchText(sh,label),position:position}})}
function filterRows(rows,query){var tokens=low(query).split(/\s+/).filter(Boolean);if(!tokens.length)return[];return arr(rows).filter(function(row){return tokens.every(function(token){return q(row&&row.search).indexOf(token)>=0})}).slice(0,60)}
function selectText(select){var label=select&&select.closest&&select.closest('label');return q([select&&select.getAttribute&&select.getAttribute('aria-label'),select&&select.name,select&&select.id,label&&label.textContent].join(' '))}
function findSelect(){return Array.from(d.querySelectorAll('select')).find(function(sel){return /sendung\s*ausw[aä]hlen|shipment\s*(?:select|choose)/i.test(selectText(sel))})||null}
function buttonByText(re){return Array.from(d.querySelectorAll('button,a,[role="button"]')).find(function(el){return re.test(q(el.textContent))&&!el.disabled})||null}
function setNativeHidden(select){select.setAttribute('data-rc1283-native-select','1');select.style.setProperty('display','none','important');var label=select.closest&&select.closest('label');if(label&&label.querySelectorAll('select,input,button').length===1){label.setAttribute('data-rc1283-native-label','1');label.style.setProperty('display','none','important')}return label}
function dispatchSelection(select,value){if(!select)return false;var options=Array.from(select.options||[]),index=options.findIndex(function(opt){return q(opt.value)===q(value)});if(index>=0)select.selectedIndex=index;else select.value=value;lastSelected=value;try{select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){try{var ev=d.createEvent('Event');ev.initEvent('change',true,true);select.dispatchEvent(ev)}catch(__){}}return true}
function currentRow(select){var rows=candidates(select,state()),value=lastSelected,ref=low(lastSelectedRef),hit=rows.find(function(row){return value&&row.value===value})||rows.find(function(row){return ref&&(low(row.reference)===ref||low(refOf(row.shipment))===ref||low(idOf(row.shipment))===ref)});if(hit)return hit;if(selectedSnapshot&&selectedSnapshot.shipment)return selectedSnapshot;var sh=allShipments(state()).find(function(item){return ref&&(low(refOf(item))===ref||low(idOf(item))===ref)});if(!sh)return null;var files=documentList(sh);return{value:value,label:lastSelectedRef,shipment:sh,reference:refOf(sh)||lastSelectedRef,customer:customerOf(sh),status:statusOf(sh),documents:files.join(' '),documentList:files,documentCount:files.length,remark:remarkOf(sh),search:searchText(sh,lastSelectedRef)}}
function resultMeta(row){var parts=[];if(row.status)parts.push(row.status);parts.push(documentLabel(Number(row.documentCount)||0));if(row.remark)parts.push(row.remark);return parts.join(' · ')}
function style(){
 if(d.getElementById('rc1283-loading-list-style'))return;
 var st=d.createElement('style');st.id='rc1283-loading-list-style';st.textContent=
 '#rc1283LoadListSearch{box-sizing:border-box;width:100%;min-width:0;margin:0;padding:18px;border:1px solid #cbd5e1;border-radius:18px;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.08)}'+
 '.rc1283-workspace-host{align-items:start!important;min-height:0!important}'+
 '.rc1283-workspace-host>[data-rc1305-loading-list-intro]{grid-column:1/-1!important;min-height:0!important;align-self:start!important;justify-self:stretch!important}'+
 '#rc1283LoadListSearch.rc1283-workspace-panel{grid-column:1/-1!important;min-width:0!important;max-width:none!important;align-self:start!important}'+
 '#rc1283LoadListSearch .rc1283-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}'+
 '#rc1283LoadListSearch h3{margin:0;color:#0f172a;font-size:1.1rem}#rc1283LoadListSearch p{margin:4px 0 0;color:#64748b;font-size:.9rem}'+
 '#rc1283LoadListSearch .rc1283-count{display:inline-flex;align-items:center;min-height:30px;padding:4px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:.8rem;font-weight:800}'+
 '#rc1283LoadListSearch input[type=search]{box-sizing:border-box;width:100%;min-height:48px;margin-top:14px;padding:11px 14px;border:1px solid #94a3b8;border-radius:12px;background:#fff;color:#0f172a;font-size:16px;outline:none}'+
 '#rc1283LoadListSearch input[type=search]:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}'+
 '#rc1283LoadListSearch .rc1283-results{display:grid;gap:8px;margin-top:10px;max-height:390px;overflow:auto;overflow-x:hidden}'+
 '#rc1283LoadListSearch .rc1283-result{box-sizing:border-box;display:grid;grid-template-columns:minmax(180px,.75fr) minmax(240px,1.25fr);gap:14px;align-items:center;width:100%;min-width:0;padding:11px 13px;text-align:left;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc;color:#0f172a;cursor:pointer}'+
 '#rc1283LoadListSearch .rc1283-result:hover,#rc1283LoadListSearch .rc1283-result:focus{border-color:#2563eb;background:#eff6ff;outline:none}'+
 '#rc1283LoadListSearch .rc1283-result-main,#rc1283LoadListSearch .rc1283-result-meta{min-width:0}'+
 '#rc1283LoadListSearch .rc1283-result strong{display:block;font-size:.94rem;overflow-wrap:anywhere}'+
 '#rc1283LoadListSearch .rc1283-result-customer{display:block;margin-top:2px;color:#475569;font-size:.84rem;overflow-wrap:anywhere}'+
 '#rc1283LoadListSearch .rc1283-result-meta{display:block;color:#64748b;font-size:.82rem;white-space:normal;overflow-wrap:anywhere;line-height:1.35}'+
 '#rc1283LoadListSearch .rc1283-selected{margin-top:12px;padding:11px 13px;border-radius:11px;background:#eff6ff;color:#1e3a8a;font-weight:800}'+
 '#rc1283LoadListSearch .rc1305-selected-files{margin-top:8px;padding:11px 13px;border:1px solid #dbe3ee;border-radius:12px;background:#fff}'+
 '#rc1283LoadListSearch .rc1305-selected-files-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px;color:#334155;font-size:.82rem;font-weight:800}'+
 '#rc1283LoadListSearch .rc1305-selected-file-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px;max-height:150px;overflow:auto;overflow-x:hidden}'+
 '#rc1283LoadListSearch .rc1305-selected-file{min-width:0;padding:7px 9px;border-radius:8px;background:#f8fafc;color:#475569;font-size:.78rem;line-height:1.25;overflow-wrap:anywhere;word-break:break-word}'+
 '#rc1283LoadListSearch .rc1283-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#rc1283LoadListSearch .rc1283-actions button{min-height:40px;padding:8px 14px;border-radius:9px;border:1px solid #2563eb;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}'+
 '#rc1283LoadListSearch .rc1283-actions button:disabled{opacity:.45;cursor:not-allowed}#rc1283LoadListSearch .rc1283-empty{padding:10px 2px;color:#64748b}'+
 '@media(max-width:760px){#rc1283LoadListSearch{padding:13px;border-radius:14px}#rc1283LoadListSearch .rc1283-result{grid-template-columns:1fr;gap:5px}#rc1283LoadListSearch .rc1305-selected-file-grid{grid-template-columns:1fr}#rc1283LoadListSearch .rc1283-actions button{flex:1 1 100%}}';
 (d.head||d.documentElement).appendChild(st)
}
function snapshot(row){return{value:row.value,label:row.label,shipment:row.shipment,reference:row.reference,customer:row.customer,status:row.status,documents:row.documents,documentList:arr(row.documentList).slice(),documentCount:Number(row.documentCount)||0,remark:row.remark,search:row.search}}
function updateSelectionUi(panel,row){
 var selected=panel&&panel.querySelector&&panel.querySelector('[data-rc1283-selected]'),detail=panel&&panel.querySelector&&panel.querySelector('[data-rc1305-selected-files]'),actions=Array.from(panel&&panel.querySelectorAll&&panel.querySelectorAll('[data-rc1283-action]')||[]);
 if(!row){
  if(selected)selected.textContent=tr('loadingList.noneSelected');
  if(detail){detail.hidden=true;detail.innerHTML=''}
  actions.forEach(function(btn){btn.disabled=true});
  return
 }
 if(selected)selected.textContent=tr('loadingList.selected')+' '+(row.reference||row.label)+(row.customer?' · '+row.customer:'');
 if(detail){
  var files=arr(row.documentList),label=tr('document.plural');if(!label||label==='document.plural')label='Dokumente';
  detail.hidden=false;detail.innerHTML='';
  var head=d.createElement('div');head.className='rc1305-selected-files-head';
  var left=d.createElement('span');left.textContent=label;var right=d.createElement('span');right.textContent=documentLabel(files.length);head.appendChild(left);head.appendChild(right);detail.appendChild(head);
  var grid=d.createElement('div');grid.className='rc1305-selected-file-grid';
  if(files.length)files.forEach(function(name){var item=d.createElement('div');item.className='rc1305-selected-file';item.textContent=name;grid.appendChild(item)});
  else{var empty=d.createElement('div');empty.className='rc1283-empty';empty.textContent=tr('loadingList.noFileNames');grid.appendChild(empty)}
  detail.appendChild(grid)
 }
 actions.forEach(function(btn){btn.disabled=false})
}
function rc1285CaptureSelection(event){
 var raw=event&&event.target,target=raw&&raw.closest&&raw.closest('[data-rc1283-result]');
 if(!target)return false;
 var panel=target.closest&&target.closest('#rc1283LoadListSearch')||d.getElementById('rc1283LoadListSearch'),select=panel&&panel.__rc1283Select||findSelect();
 if(!panel||!select)return false;
 var value=q(target.getAttribute&&target.getAttribute('data-rc1283-result')),row=candidates(select,state()).find(function(item){return item.value===value})||(selectedSnapshot&&selectedSnapshot.value===value?selectedSnapshot:null);
 if(!row)return false;
 var input=panel.querySelector&&panel.querySelector('[data-rc1283-search]');
 lastSelected=row.value;lastSelectedRef=refOf(row.shipment)||row.reference||row.value;selectedSnapshot={value:row.value,label:row.label,shipment:row.shipment,reference:row.reference,customer:row.customer,status:row.status,documents:row.documents,documentList:arr(row.documentList).slice(),documentCount:Number(row.documentCount)||0,remark:row.remark,search:row.search};lastQuery=q(input&&input.value);
 updateSelectionUi(panel,row);
 if(typeof w.setTimeout==='function')w.setTimeout(function(){var current=findSelect();if(current)dispatchSelection(current,row.value)},0);
 return true
}
function render(panel,select){
 var input=panel.querySelector('[data-rc1283-search]'),results=panel.querySelector('[data-rc1283-results]'),count=panel.querySelector('[data-rc1305-count]'),rows=candidates(select,state()),query=q(input&&input.value),found=filterRows(rows,query),chosen=currentRow(select);
 if(input&&input.value!==lastQuery)lastQuery=input.value;
 if(count)count.textContent=query?tr('loadingList.resultCount',{count:found.length}):tr('loadingList.shipmentCount',{count:rows.length});
 results.innerHTML='';
 if(!query){var hint=d.createElement('div');hint.className='rc1283-empty';hint.textContent=tr('loadingList.hint');results.appendChild(hint)}
 else if(!found.length){var empty=d.createElement('div');empty.className='rc1283-empty';empty.textContent=tr('loadingList.noResults');results.appendChild(empty)}
 else found.forEach(function(row){
  var b=d.createElement('button');b.type='button';b.className='rc1283-result';b.setAttribute('data-rc1283-result',row.value);
  var main=d.createElement('div');main.className='rc1283-result-main';var strong=d.createElement('strong');strong.textContent=row.reference||row.label;var customer=d.createElement('span');customer.className='rc1283-result-customer';customer.textContent=row.customer||'—';main.appendChild(strong);main.appendChild(customer);
  var meta=d.createElement('span');meta.className='rc1283-result-meta';meta.textContent=resultMeta(row)||row.label;b.appendChild(main);b.appendChild(meta);
  b.addEventListener('click',function(){lastSelected=row.value;lastSelectedRef=refOf(row.shipment)||row.reference||row.value;selectedSnapshot=snapshot(row);lastQuery=query;updateSelectionUi(panel,row)});
  results.appendChild(b)
 });
 updateSelectionUi(panel,chosen)
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
function workspaceHost(host,select){
 var node=host,depth=0,fallback=null;
 while(node&&node!==d.body&&depth<7){
  try{
   var cs=w.getComputedStyle&&w.getComputedStyle(node),rect=node.getBoundingClientRect&&node.getBoundingClientRect(),wide=rect&&rect.width>=680;
   if(cs&&cs.display==='grid'&&wide&&node.children&&node.children.length>=2){fallback=node;if(/ladeliste|loading list|liste de chargement|lista de carga|lista di carico/i.test(q(node.textContent)))return node}
  }catch(_){}
  node=node.parentElement;depth++
 }
 return fallback
}
function introChild(host,select){
 return Array.from(host&&host.children||[]).find(function(child){if(child===select||child.contains&&child.contains(select))return false;return /ladeliste\s*&\s*cmr|loading list|liste de chargement|lista de carga|lista di carico/i.test(q(child.textContent))})||null
}
function promotePanel(panel,host,select){
 var wide=workspaceHost(host,select);if(!wide)return false;
 wide.classList.add('rc1283-workspace-host');panel.classList.add('rc1283-workspace-panel');panel.style.gridColumn='1 / -1';
 var intro=introChild(wide,select);
 if(intro){intro.setAttribute('data-rc1305-loading-list-intro','1');intro.style.setProperty('grid-column','1 / -1','important');intro.style.setProperty('min-height','0','important');intro.style.setProperty('align-self','start','important');if(intro.nextSibling)wide.insertBefore(panel,intro.nextSibling);else wide.appendChild(panel)}
 else wide.insertBefore(panel,wide.firstChild);
 return true
}
function makePanel(select){
 style();var old=d.getElementById('rc1283LoadListSearch');if(old&&old.__rc1283Select===select){render(old,select);return old}if(old)old.remove();
 var label=setNativeHidden(select),host=label&&label.parentNode||select.parentNode;if(!host)return null;
 var panel=d.createElement('section');panel.id='rc1283LoadListSearch';panel.setAttribute('role','search');panel.setAttribute('data-rc1305-search-workspace','1');panel.__rc1283Select=select;
 var head=d.createElement('div');head.className='rc1283-head';var title=d.createElement('div'),h=d.createElement('h3'),p=d.createElement('p'),count=d.createElement('span');h.textContent=tr('loadingList.title');p.textContent=tr('loadingList.description');count.className='rc1283-count';count.setAttribute('data-rc1305-count','1');title.appendChild(h);title.appendChild(p);head.appendChild(title);head.appendChild(count);panel.appendChild(head);
 var input=d.createElement('input');input.type='search';input.setAttribute('aria-label',tr('loadingList.title'));input.setAttribute('data-rc1283-search','1');input.placeholder=tr('loadingList.placeholder');input.autocomplete='off';input.value=lastQuery;panel.appendChild(input);
 var results=d.createElement('div');results.className='rc1283-results';results.setAttribute('data-rc1283-results','1');panel.appendChild(results);
 var selected=d.createElement('div');selected.className='rc1283-selected';selected.setAttribute('data-rc1283-selected','1');panel.appendChild(selected);
 var detail=d.createElement('div');detail.className='rc1305-selected-files';detail.setAttribute('data-rc1305-selected-files','1');detail.hidden=true;panel.appendChild(detail);
 var actions=d.createElement('div');actions.className='rc1283-actions';[['open',tr('common.open')],['print',tr('common.print')],['download',tr('common.download')]].forEach(function(def){var b=d.createElement('button');b.type='button';b.setAttribute('data-rc1283-action',def[0]);b.textContent=def[1];b.addEventListener('click',function(){act(def[0],panel,select)});actions.appendChild(b)});panel.appendChild(actions);
 if(!promotePanel(panel,host,select))host.insertBefore(panel,label||select);
 input.addEventListener('input',function(){lastQuery=input.value;render(panel,select)});render(panel,select);return panel
}
function install(){var select=findSelect(),panel=d.getElementById('rc1283LoadListSearch');if(!select){if(panel)panel.remove();return false}setNativeHidden(select);makePanel(select);return true}
function schedule(){if(timer)w.clearTimeout(timer);timer=w.setTimeout(function(){timer=0;install()},30)}
w.ExportHUBRC1283LoadingListSearch=Object.freeze({version:'RC1305',searchText:searchText,filterRows:filterRows,documentNames:documentNames,documentList:documentList,remarkOf:remarkOf,candidates:candidates,install:install,action:act,captureSelection:rc1285CaptureSelection,promotePanel:promotePanel});
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
