(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1203_DECKBLATT__)return;
w.__EXPORTHUB_RC1203_DECKBLATT__=true;

var pendingMode='',originalOpen=null,installed=false;
function q(v){return String(v==null?'':v).trim()}
function tr(key,vars){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars)}catch(_){}return key}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function state(){try{return typeof w.__EXPORTHUB_GET_STATE__==='function'?(w.__EXPORTHUB_GET_STATE__()||{}):{}}catch(_){return{}}}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)).toUpperCase()}
function allShipments(){
  var s=state(),out=[];
  [s.shipment,s.currentShipment,s.selectedShipment].forEach(function(x){if(obj(x)&&out.indexOf(x)<0)out.push(x)});
  try{var active=typeof w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'?w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__():null;if(obj(active)&&out.indexOf(active)<0)out.unshift(active)}catch(_){}
  arr(s.shipments).forEach(function(x){if(obj(x)&&out.indexOf(x)<0)out.push(x)});
  return out
}
function shipmentForDocument(doc){
  var ref='';
  try{
    var node=doc&&doc.querySelector&&doc.querySelector('[data-shipment-ref]');
    ref=q(node&&node.getAttribute&&node.getAttribute('data-shipment-ref')).toUpperCase()
  }catch(_){}
  var list=allShipments();
  if(ref){for(var i=0;i<list.length;i++)if(refOf(list[i])===ref)return list[i]}
  return list[0]||null
}
function remarkValue(sh){
  var values=sh?[sh.remark,sh.remarks,sh.bemerkung,sh.comments,sh.comment,sh.note,sh.notes,sh.shipmentRemark]:[];
  for(var i=0;i<values.length;i++){var v=q(values[i]);if(v)return v}
  try{
    var field=d.querySelector('[data-rc896-field="remark"] textarea,[data-rc896-field="remark"] input,textarea[name="remark"],textarea[name="comments"]');
    var fallback=q(field&&field.value);if(fallback)return fallback
  }catch(_){}
  return ''
}
function customerNameValue(sh){
  var values=sh?[sh.customerName,sh.customerDisplayName,sh.customerCompany,sh.companyName,typeof sh.customer==='string'?sh.customer:'',sh.customer&&sh.customer.name,sh.customer&&sh.customer.customerName,sh.customer&&sh.customer.companyName]:[];
  for(var i=0;i<values.length;i++){var v=q(values[i]);if(v)return v}
  try{
    var s=state(),id=q(sh&&(sh.customerId||sh.customerNumber||sh.customerAccount||sh.account)).toUpperCase(),list=arr(s.customers);
    for(var j=0;j<list.length;j++){
      var item=list[j]||{},keys=[item.id,item.customerId,item.customerNumber,item.account,item.kundennummer].map(function(x){return q(x).toUpperCase()});
      if(id&&keys.indexOf(id)>=0)return q(item.name||item.customerName||item.companyName)
    }
  }catch(_){}
  return ''
}
function isEssentraShipment(sh){return /\bessentra\b/i.test(customerNameValue(sh))}
function coverTheme(sh){
  return isEssentraShipment(sh)?
    {key:'essentra',refBg:'#facc15',refBorder:'#ca8a04',refText:'#111827',recipientBg:'#fef9c3',recipientBorder:'#eab308',recipientText:'#713f12'}:
    {key:'customer',refBg:'#2563eb',refBorder:'#1d4ed8',refText:'#ffffff',recipientBg:'#dbeafe',recipientBorder:'#60a5fa',recipientText:'#1e3a8a'}
}
function createdValue(sh){
  var values=sh?[sh.createdAt,sh.createdDateTime,sh.createdOn,sh.createdDate,sh.created]:[];
  for(var i=0;i<values.length;i++){var v=q(values[i]);if(v)return v}
  return ''
}
function formatCreatedDate(value){
  var raw=q(value),m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return m[3]+'.'+m[2]+'.'+m[1];
  var dt=new Date(raw);if(!raw||!Number.isFinite(dt.getTime()))return raw;
  try{return dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}catch(_){return raw}
}
function ensureCreatedDate(cover,sh){
  if(!cover||!cover.ownerDocument)return false;
  var value=formatCreatedDate(createdValue(sh))||'—',node=cover.querySelector('[data-rc1281-created-date]');
  if(node){
    var current=q(node.textContent),stored=q(node.getAttribute('data-rc1281-created-value'));
    if(stored===value)return true;
    if(/Sendungsdaten/i.test(current)&&/(Erstellt am|Sendung erstellt)/i.test(current))return true;
    if(current.indexOf(value)>=0&&/(Erstellt am|Sendung erstellt)/i.test(current))return true
  }
  if(!node){
    node=cover.ownerDocument.createElement('div');
    node.setAttribute('data-rc1281-created-date','1');
    var ref=cover.querySelector('.rc390-cover-ref,[data-rc1203-reference-highlight]');
    if(ref&&ref.parentNode)ref.parentNode.insertBefore(node,ref.nextSibling);else cover.appendChild(node)
  }
  node.setAttribute('data-rc1281-created-value',value);
  node.innerHTML='';
  var label=cover.ownerDocument.createElement('span'),date=cover.ownerDocument.createElement('strong');
  label.textContent='Sendung erstellt';date.textContent=value;
  label.style.fontSize='9pt';label.style.fontWeight='800';label.style.textTransform='uppercase';label.style.letterSpacing='.2mm';
  date.style.fontSize='12pt';date.style.fontWeight='900';
  node.appendChild(label);node.appendChild(date);
  node.style.display='flex';node.style.justifyContent='space-between';node.style.alignItems='center';node.style.gap='6mm';
  node.style.margin='3mm 0';node.style.padding='2.5mm 4mm';node.style.border='0.6mm solid #cbd5e1';node.style.background='#fff';node.style.color='#334155';
  return true
}
function findPrintAll(){
  return d.querySelector('[data-index352-action="print-all"]')||
    Array.from(d.querySelectorAll('button,a,[role="button"]')).find(function(el){return /Gesamtausgabe\s*drucken|Gesamtdruck/i.test(q(el.textContent))})||null
}
function shipmentCreateVisible(){
  var s=state(),view=q(s&&(s.view||s.currentView)).toLowerCase();
  if(view==='shipment'||view==='shipmentview')return true;
  if(view&&view!=='shipment'&&view!=='shipmentview')return false;
  return !!d.querySelector('#rc573ShipmentShell,#rc363FixedShipmentLayout,[data-exporthub-rendered-view="shipment"]')
}
function actionHost(){
  return d.querySelector('#rc363BlockActions')
}
function ensureActionStyle(){
  if(d.getElementById('rc1205-cover-action-style'))return;
  var style=d.createElement('style');style.id='rc1205-cover-action-style';
  style.textContent='#rc363BlockActions [data-rc1203-print-cover-only]{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;min-height:42px!important;padding:10px 16px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;background:#fff!important;color:#0f172a!important;font:700 14px/1.2 inherit!important;box-shadow:0 1px 2px rgba(15,23,42,.06)!important;cursor:pointer!important;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease!important}#rc363BlockActions [data-rc1203-print-cover-only]:hover{background:#f8fafc!important;border-color:#94a3b8!important;box-shadow:0 2px 5px rgba(15,23,42,.08)!important}#rc363BlockActions [data-rc1203-print-cover-only]:focus-visible{outline:3px solid rgba(37,99,235,.22)!important;outline-offset:2px!important}';
  (d.head||d.documentElement).appendChild(style)
}
function removeLegacyExtraButtons(){
  Array.from(d.querySelectorAll('[data-rc1203-print-cmr-only]')).forEach(function(node){node.remove()})
}
function renderCoverButton(){
  var all=d.querySelectorAll('[data-rc1203-print-cover-only]');
  for(var i=1;i<all.length;i++)all[i].remove();
  if(!shipmentCreateVisible())return false;
  var existing=d.querySelector('[data-rc1203-print-cover-only]');if(existing){existing.innerHTML='<span aria-hidden="true">▣</span><span>'+tr('coverPrint.only')+'</span>';existing.title=tr('coverPrint.title');return true;}
  var host=actionHost();if(!host)return false;
  ensureActionStyle();
  var btn=d.createElement('button');
  btn.type='button';btn.className='rc1205-cover-only-btn';
  btn.setAttribute('data-rc1203-print-cover-only','1');
  btn.innerHTML='<span aria-hidden="true">▣</span><span>'+tr('coverPrint.only')+'</span>';
  btn.title=tr('coverPrint.title');
  host.appendChild(btn);return true
}
function markRecipient(cover,theme){
  if(!cover||!cover.querySelectorAll)return false;
  theme=theme||coverTheme(null);
  var nodes=Array.from(cover.querySelectorAll('div,section,article,td,li,p,address'));
  var target=nodes.filter(function(node){
    var txt=q(node.textContent);
    return txt.length>0&&txt.length<900&&/(Empfänger(?:adresse)?|Lieferadresse|Recipient|Delivery address)/i.test(txt)
  }).sort(function(a,b){return q(a.textContent).length-q(b.textContent).length})[0];
  if(!target)return false;
  target.setAttribute('data-rc1203-recipient-highlight','1');
  target.style.fontSize='16pt';
  target.style.lineHeight='1.24';
  target.style.fontWeight='800';
  target.style.padding='4mm';
  target.style.border='1mm solid '+theme.recipientBorder;
  target.style.background=theme.recipientBg;
  target.style.color=theme.recipientText;
  var strong=target.querySelectorAll('strong,b');
  for(var i=0;i<strong.length;i++){strong[i].style.fontSize='19pt';strong[i].style.fontWeight='800';strong[i].style.color=theme.recipientText}
  return true
}
function ensureRemark(cover,remark){
  if(!cover||!cover.ownerDocument)return false;
  var value=q(remark)||'—';
  var old=cover.querySelector('[data-rc1203-cover-remark]');
  if(old&&q(old.getAttribute('data-rc1203-remark-value'))===value)return true;
  if(!old){
    old=cover.ownerDocument.createElement('section');
    old.setAttribute('data-rc1203-cover-remark','1');
    cover.appendChild(old)
  }
  old.setAttribute('data-rc1203-remark-value',value);
  old.innerHTML='';
  var title=cover.ownerDocument.createElement('div');
  title.textContent=tr('coverPrint.remark');
  title.style.fontSize='11pt';title.style.fontWeight='800';title.style.textTransform='uppercase';title.style.letterSpacing='.25mm';
  var body=cover.ownerDocument.createElement('div');
  body.textContent=value;
  body.style.fontSize='12pt';body.style.fontWeight='700';body.style.lineHeight='1.25';body.style.marginTop='1.5mm';body.style.whiteSpace='pre-wrap';
  old.appendChild(title);old.appendChild(body);
  old.style.display='block';old.style.marginTop='4mm';old.style.padding='3.5mm 4mm';old.style.minHeight='18mm';old.style.maxHeight='28mm';old.style.overflow='hidden';
  old.style.border='1mm solid #cbd5e1';old.style.borderLeft='3mm solid #e5b51d';
  old.style.background='#fffdf5';old.style.color='#1f2937';
  old.style.breakInside='avoid';old.style.pageBreakInside='avoid';
  return true
}
function emphasizeReference(cover,theme){
  if(!cover||!cover.querySelectorAll)return false;
  theme=theme||coverTheme(null);
  var nodes=Array.from(cover.querySelectorAll('div,section,article,td,p'));
  var target=nodes.filter(function(node){
    var txt=q(node.textContent);
    return txt.length>0&&txt.length<260&&/(Referenz|Reference)/i.test(txt)
  }).sort(function(a,b){return q(a.textContent).length-q(b.textContent).length})[0];
  if(!target)return false;
  target.setAttribute('data-rc1203-reference-highlight','1');
  target.style.background=theme.refBg;target.style.color=theme.refText;
  target.style.border='1.2mm solid '+theme.refBorder;target.style.padding='4mm';
  target.style.fontWeight='900';
  Array.from(target.querySelectorAll('span,strong,b')).forEach(function(node){node.style.color=theme.refText});
  return true
}
function decorateCover(doc){
  try{
    if(!doc||!doc.querySelectorAll)return false;
    var covers=Array.from(doc.querySelectorAll('.rc390-cover,.rc352-cover'));
    if(!covers.length)return false;
    var sh=shipmentForDocument(doc),remark=remarkValue(sh),theme=coverTheme(sh);
    covers.forEach(function(cover){
      cover.setAttribute('data-rc1203-cover-enhanced','1');
      cover.setAttribute('data-rc1281-customer-theme',theme.key);
      cover.style.boxSizing='border-box';
      cover.style.border='3mm solid #334155';
      cover.style.borderTopWidth='5mm';
      cover.style.outline='0';
      cover.style.outlineOffset='0';
      cover.style.background='#ffffff';
      cover.style.backgroundImage='none';
      cover.style.color='#1f2937';
      cover.style.boxShadow='inset 0 0 0 1mm #dbe4ee';
      cover.style.webkitPrintColorAdjust='exact';
      cover.style.printColorAdjust='exact';
      cover.style.padding='8mm';
      markRecipient(cover,theme);
      emphasizeReference(cover,theme);
      ensureCreatedDate(cover,sh);
      ensureRemark(cover,remark)
    });
    var style=doc.getElementById&&doc.getElementById('rc1203DeckblattPrintStyle');
    if(!style&&doc.head){
      style=doc.createElement('style');style.id='rc1203DeckblattPrintStyle';
      style.textContent='@media print{.rc390-cover,.rc352-cover{border:3mm solid #334155!important;border-top-width:5mm!important;outline:0!important;background:#fff!important;background-image:none!important;box-shadow:inset 0 0 0 1mm #dbe4ee!important;padding:8mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}[data-rc1281-customer-theme="essentra"] .rc390-cover-ref,[data-rc1281-customer-theme="essentra"] [data-rc1203-reference-highlight]{background:#facc15!important;border-color:#ca8a04!important;color:#111827!important}[data-rc1281-customer-theme="essentra"] .rc390-cover-ref span,[data-rc1281-customer-theme="essentra"] .rc390-cover-ref b,[data-rc1281-customer-theme="essentra"] [data-rc1203-reference-highlight] span,[data-rc1281-customer-theme="essentra"] [data-rc1203-reference-highlight] b{color:#111827!important}[data-rc1281-customer-theme="customer"] .rc390-cover-ref,[data-rc1281-customer-theme="customer"] [data-rc1203-reference-highlight]{background:#2563eb!important;border-color:#1d4ed8!important;color:#fff!important}[data-rc1281-customer-theme="customer"] .rc390-cover-ref span,[data-rc1281-customer-theme="customer"] .rc390-cover-ref b,[data-rc1281-customer-theme="customer"] [data-rc1203-reference-highlight] span,[data-rc1281-customer-theme="customer"] [data-rc1203-reference-highlight] b{color:#fff!important}[data-rc1281-customer-theme="essentra"] [data-rc1203-recipient-highlight]{background:#fef9c3!important;border-color:#eab308!important;color:#713f12!important}[data-rc1281-customer-theme="customer"] [data-rc1203-recipient-highlight]{background:#dbeafe!important;border-color:#60a5fa!important;color:#1e3a8a!important}[data-rc1281-created-date]{background:#fff!important;color:#334155!important}[data-rc1203-cover-remark]{display:block!important;border:1mm solid #cbd5e1!important;border-left:3mm solid #e5b51d!important;background:#fffdf5!important;color:#1f2937!important;min-height:18mm!important;max-height:28mm!important;overflow:hidden!important;margin-bottom:5mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.rc390-cover-qr{margin-top:5mm!important;position:relative!important;clear:both!important}}';
      doc.head.appendChild(style)
    }
    return true
  }catch(_){return false}
}
function replacePrintBody(doc,nodes){
  if(!doc||!nodes||!nodes.length)return false;
  var clones=nodes.map(function(node){return node.cloneNode(true)});
  doc.body.innerHTML='';clones.forEach(function(node){doc.body.appendChild(node)});
  return true
}
function isolateCover(child){
  try{var doc=child&&child.document,cover=doc&&doc.querySelector&&doc.querySelector('.rc390-cover,.rc352-cover');if(!cover)return false;return replacePrintBody(doc,[cover])}catch(_){return false}
}
function cmrPages(doc){
  if(!doc)return[];
  var direct=Array.from(doc.querySelectorAll('.rc390-cmr,.rc352-cmr,[data-document-type="cmr"],[data-print-document="cmr"]'));
  if(direct.length)return direct;
  var pages=Array.from(doc.querySelectorAll('.rc390-page,.rc352-page,.print-page,.page,section'));
  var exact=pages.filter(function(node){var txt=q(node.textContent);return /\bCMR\b/i.test(txt)&&!/Deckblatt|Ladeliste/i.test(txt)});
  return exact.length?exact:pages.filter(function(node){return /\bCMR\b/i.test(q(node.textContent))})
}
function isolateCmr(child){
  try{var doc=child&&child.document,pages=cmrPages(doc);if(!pages.length)return false;return replacePrintBody(doc,pages)}catch(_){return false}
}
function wrapChildPrint(child){
  if(!child||child.__rc1203PrintWrapped)return child;
  try{
    var nativePrint=child.print&&child.print.bind(child);if(typeof nativePrint!=='function')return child;
    child.__rc1203PrintWrapped=true;
    child.print=function(){
      decorateCover(child.document);
      if(pendingMode==='cover')isolateCover(child);
      if(pendingMode==='cmr')isolateCmr(child);
      pendingMode='';
      return nativePrint()
    }
  }catch(_){}
  return child
}
function installOpenGuard(){
  if(installed)return;installed=true;
  try{
    originalOpen=w.open&&w.open.bind(w);
    if(typeof originalOpen==='function'){
      w.open=function(){var child=originalOpen.apply(w,arguments);wrapChildPrint(child);return child}
    }
  }catch(_){}
}
function triggerMode(mode){
  var printAll=findPrintAll();
  if(!printAll){try{w.alert(tr('coverPrint.documentsNotLoaded'))}catch(_){}return false}
  pendingMode=mode;installOpenGuard();
  try{printAll.click();(w.setTimeout||setTimeout)(function(){if(pendingMode===mode)pendingMode=''},15000);return true}catch(_){pendingMode='';return false}
}
function onClick(e){
  var cover=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1203-print-cover-only]');
  if(cover){e.preventDefault();triggerMode('cover');return}
}
function deckblattObserverRelevant(){
  if(pendingMode||shipmentCreateVisible())return true;
  return !!d.querySelector('.rc390-cover,.rc352-cover,[data-rc1203-print-cover-only],[data-rc1203-print-cmr-only]')
}
function schedule(){(w.setTimeout||setTimeout)(function(){if(!deckblattObserverRelevant())return;removeLegacyExtraButtons();renderCoverButton();decorateCover(d)},0)}
installOpenGuard();
d.addEventListener('click',onClick,true);
try{w.addEventListener('beforeprint',function(){decorateCover(d)})}catch(_){}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved','exporthub:language-changed'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
if(typeof MutationObserver!=='undefined'){try{new MutationObserver(function(){if(!deckblattObserverRelevant())return;removeLegacyExtraButtons();renderCoverButton();decorateCover(d)}).observe(d.documentElement||d.body,{childList:true,subtree:true})}catch(_){}}
w.ExportHUBRC1203Deckblatt=Object.freeze({version:'RC1281',decorateCover:decorateCover,remarkValue:remarkValue,isEssentraShipment:isEssentraShipment,formatCreatedDate:formatCreatedDate,renderCoverButton:renderCoverButton,triggerCoverOnly:function(){return triggerMode('cover')}});
})(window,document);
