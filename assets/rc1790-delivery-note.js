(function(root){
 'use strict';
 if(!root||root.ExportHUBRC1790DeliveryNote)return;
 var items=[{itemNumber:'',description:'',quantity:'',unit:'Stk',orderPosition:''}],mode='invoice',timer=0,observer=null,busy=false;
 var today=new Date(),todayStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
 var defaults={documentNumber:'',issuedAt:todayStr,deliveryDate:'',senderName:'Essentra Components GmbH',
  senderAddress:'Montel-Allee 3\nD-41334 Nettetal\nGermany',recipient:'',recipientAddress:'',
  customerNumber:'',customerOrder:'',shipmentReference:'',packageCount:'',packageType:'',
  netWeight:'',grossWeight:'',notes:''};
 var headerDraft=Object.assign({},defaults);
 function t(key){var i=root.ExportHUBRC1790I18n;return i&&typeof i.t==='function'?i.t(key):key}
 function fmt(key,values){return t(key).replace(/\{([a-z]+)\}/g,function(_,field){return String(values[field]||'')})}
 function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]})}
 function q(s){return String(s==null?'':s).trim()}
 function host(){return root.document&&root.document.querySelector('#rc1940Documents [data-rc1940-document-editor]')}
 function manual(){return root.document&&root.document.getElementById('rc1549AbdManual')}
 function panel(){return root.document&&root.document.getElementById('rc1790DeliveryNote')}
 function stateMessage(s,kind){var target=panel()&&panel().querySelector('[data-rc1790-status]');if(target){target.hidden=!s;target.textContent=s;target.setAttribute('data-kind',kind||'info')}}
 function rowHtml(p,i){
  var fields=[['itemNumber','itemNumber'],['description','description'],['quantity','quantity'],['unit','unit'],['orderPosition','orderPosition']];
  var limits={itemNumber:100,description:500,quantity:32,unit:24,orderPosition:50};
  return '<tr data-row="'+i+'"><td>'+(i+1)+'</td>'+fields.map(function(f){return '<td><input aria-label="'+esc(t(f[1])+' '+t('position')+' '+(i+1))+'" data-field="'+f[0]+'" value="'+esc(p[f[0]]||'')+'" maxlength="'+limits[f[0]]+'" '+(f[0]==='quantity'?'inputmode="decimal"':'')+'></td>'}).join('')+
  '<td class="rc1790-row-actions"><button type="button" class="ghost" data-rc1790-copy="'+i+'" '+(items.length>=250?'disabled':'')+' aria-label="'+esc(t('duplicate'))+'">+</button><button type="button" class="ghost" data-rc1790-remove="'+i+'" '+(items.length===1?'disabled':'')+' aria-label="'+esc(t('remove'))+'">−</button></td></tr>'
 }
 function renderRows(){
  var tbody=panel()&&panel().querySelector('[data-rc1790-items]');if(!tbody)return;
  tbody.innerHTML=items.map(rowHtml).join('');
  var add=panel()&&panel().querySelector('[data-rc1790-add]');if(add)add.disabled=items.length>=250;
 }
 function snapshot(){
  var data=Object.assign({},headerDraft),p=panel();
  if(p)p.querySelectorAll('[data-rc1790-header]').forEach(function(field){data[field.getAttribute('data-rc1790-header')]=field.value});
  return{header:data,items:items.map(function(item){return Object.assign({},item)})}
 }
 function documentDate(value){
  var v=q(value),match=v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(match)v=match[3]+'-'+match[2]+'-'+match[1];
  return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:''
 }
 function importAnalysis(source){
  var positions=source&&source.positions,header=source&&source.header||{};
  if(!Array.isArray(positions)||!positions.length||positions.length>250){stateMessage(t('validationItems'),'bad');return false}
  var next=positions.map(function(p){return{
   itemNumber:q(p.itemNumber||p.articleNumber).slice(0,100),
   description:q(p.description||p.itemDescription).slice(0,500),
   quantity:p.quantity==null?'':String(p.quantity).slice(0,32),
   unit:q(p.unit||'Stk').slice(0,24),
   orderPosition:q(p.orderPosition||p.salesLine||p.position).slice(0,50)
  }});
  if(next.some(function(p){return !p.description||!(Number(p.quantity.replace(',','.'))>0)})){stateMessage(t('validationItems'),'bad');return false}
  var map={
   documentNumber:header.documentNumber||header.deliveryNoteNumber||header.invoiceNumber,
   senderName:header.senderName||header.customer,
   senderAddress:header.senderAddress,
   recipient:header.recipient,
   recipientAddress:header.recipientAddress,
   customerNumber:header.customerNumber,
   customerOrder:header.customerOrder||header.orderNumber||header.salesOrder,
   shipmentReference:header.shipmentReference,
   packageCount:header.packageCount,
   packageType:header.packageType,
   netWeight:header.netWeight||header.netMassKg,
   grossWeight:header.grossWeight||header.grossMassKg,
   notes:header.notes
  };
  Object.keys(map).forEach(function(key){if(map[key]!=null&&q(map[key]))headerDraft[key]=q(map[key])});
  var date=documentDate(header.issuedAt||header.invoiceDate);if(date)headerDraft.issuedAt=date;
  var deliveryDate=documentDate(header.deliveryDate);if(deliveryDate)headerDraft.deliveryDate=deliveryDate;
  items=next;
  mode='delivery';mount();
  var p=panel();if(!p)return false;
  p.querySelectorAll('[data-rc1790-header]').forEach(function(field){field.value=headerDraft[field.getAttribute('data-rc1790-header')]||''});
  renderRows();applyMode();
  stateMessage('Daten übernommen. Bitte Lieferadresse, Dokumentnummer, Datum und Positionen prüfen.','ok');
  if(typeof p.scrollIntoView==='function')p.scrollIntoView({behavior:'smooth',block:'start'});
  return true
 }
 function valid(s){
  var h=s.header;
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,39}$/.test(q(h.documentNumber)))return t('validationNumber');
  if(!h.issuedAt||!q(h.senderName)||!q(h.senderAddress)||!q(h.recipient)||!q(h.recipientAddress))return t('validationAddresses');
  if(!s.items.length||s.items.some(function(p){return!q(p.description)||!(Number(q(p.quantity).replace(',','.'))>0)}))return t('validationItems');
  var net=h.netWeight===''?null:Number(q(h.netWeight).replace(',','.')),gross=h.grossWeight===''?null:Number(q(h.grossWeight).replace(',','.'));
  if((net!==null&&!Number.isFinite(net))||(gross!==null&&!Number.isFinite(gross))||(net!==null&&gross!==null&&gross<net))return t('validationWeight');
  return''
 }
 async function save(){
  if(busy)return;
  var data=snapshot(),message=valid(data);
  if(message){stateMessage(message,'bad');return}
  var api=root.ExportHUBRC1549Proforma;
  if(!api||typeof api.createDeliveryNote!=='function'){stateMessage(t('errorUnavailable'),'bad');return}
  busy=true;
  var btn=panel().querySelector('[data-rc1790-export]');if(btn)btn.disabled=true;
  stateMessage(t('creating'),'info');
  try{
   var name=await api.createDeliveryNote(data);
   stateMessage(fmt('downloaded',{name:name}),'ok');
  }catch(error){
   stateMessage(fmt('error',{message:error&&error.message||t('unknown')}),'bad');
  }finally{busy=false;if(btn)btn.disabled=false}
 }
 function applyMode(){
  var a=manual(),b=panel(),nav=root.document&&root.document.getElementById('rc1790DocTabs');
  if(!a||!b||!nav)return;
  a.hidden=mode==='delivery';
  b.hidden=mode!=='delivery';
  nav.querySelectorAll('button').forEach(function(btn){
   var selected=btn.getAttribute('data-rc1790-tab')===mode;
   btn.setAttribute('aria-selected',selected?'true':'false');
   btn.classList.toggle('is-active',selected);
  })
 }
 function style(){
  if(root.document.getElementById('rc1790DeliveryStyle'))return;
  var tag=root.document.createElement('style');tag.id='rc1790DeliveryStyle';
  tag.textContent='#rc1790DocTabs{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0 6px}#rc1790DocTabs button{background:var(--card,#fff);color:var(--text,#0f172a);border:1px solid #94a3b8;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:700}#rc1790DocTabs button.is-active{background:#0a5f93;color:#fff;border-color:#0a5f93}#rc1790DeliveryNote{margin:12px 0;padding:18px;border:1px solid #b3c8d8;border-left:4px solid #0a5f93;border-radius:13px;background:var(--card,#fff);color:var(--text,#0f172a)}#rc1790DeliveryNote[hidden],#rc1549AbdManual[hidden]{display:none!important}#rc1790DeliveryNote h4{margin:0 0 5px;font-size:18px}#rc1790DeliveryNote p{margin:0 0 14px;color:var(--muted,#475569);font-size:13px}#rc1790DeliveryNote .rc1790-head{display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:13px}#rc1790DeliveryNote label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:650}#rc1790DeliveryNote .rc1790-span2{grid-column:span 2}#rc1790DeliveryNote .rc1790-break{grid-column:1/-1;margin:8px 0 0;padding:7px 0;border-bottom:1px solid #cbd5e1;font-size:13px;color:var(--text,#0f172a)}#rc1790DeliveryNote input,#rc1790DeliveryNote textarea{box-sizing:border-box;min-height:41px;width:100%;padding:8px;border:1px solid #94a3b8;border-radius:8px;background:var(--card,#fff);color:var(--text,#0f172a);font:inherit}#rc1790DeliveryNote textarea{resize:vertical;min-height:76px}#rc1790DeliveryNote input:focus-visible,#rc1790DeliveryNote button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}#rc1790DeliveryNote .rc1790-table{overflow-x:auto;margin:15px 0;border:1px solid #cbd5e1;border-radius:8px}#rc1790DeliveryNote table{border-collapse:collapse;width:100%;min-width:750px;font-size:12px}#rc1790DeliveryNote td,#rc1790DeliveryNote th{border-bottom:1px solid #e2e8f0;padding:7px;text-align:left}#rc1790DeliveryNote th{background:#e8f2f8;color:#1b3448}#rc1790DeliveryNote .rc1790-row-actions{white-space:nowrap}#rc1790DeliveryNote .rc1790-row-actions button{min-width:30px;padding:7px}#rc1790DeliveryNote .rc1790-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}#rc1790DeliveryNote .rc1790-actions button{padding:10px 15px;border-radius:9px;cursor:pointer}#rc1790DeliveryNote [data-rc1790-status]{margin-top:13px;padding:10px;border-radius:8px;background:#eff6ff;color:#1e3a8a}#rc1790DeliveryNote [data-kind="bad"]{background:#fef2f2;color:#991b1b}#rc1790DeliveryNote [data-kind="ok"]{background:#ecfdf5;color:#065f46}#rc1790DeliveryNote .rc1790-logo{max-width:176px;max-height:50px;object-fit:contain;margin:4px 0}@media(max-width:850px){#rc1790DeliveryNote .rc1790-head{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:540px){#rc1790DeliveryNote{padding:12px}#rc1790DeliveryNote .rc1790-head{grid-template-columns:1fr}#rc1790DeliveryNote .rc1790-span2{grid-column:auto}#rc1790DeliveryNote .rc1790-actions button{width:100%}}';
  root.document.head.appendChild(tag)
 }
 function label(title,key,kind,span,attributes){
  var limits={documentNumber:40,senderName:160,senderAddress:500,recipient:160,recipientAddress:500,
   customerNumber:60,customerOrder:80,shipmentReference:80,packageType:100,notes:800};
  var max=limits[key]||100;
  var input=kind==='textarea'?'<textarea rows="3" data-rc1790-header="'+key+'" maxlength="'+max+'"></textarea>':'<input data-rc1790-header="'+key+'" type="'+(kind||'text')+'" '+(attributes||'')+' maxlength="'+max+'">';
  return '<label'+(span?' class="rc1790-span2"':'')+'>'+title+input+'</label>';
 }
 function mount(){
  var parent=host(),invoice=manual();if(!parent||!invoice)return false;
  style();
  if(!root.document.getElementById('rc1790DocTabs')){
   var nav=root.document.createElement('nav');nav.id='rc1790DocTabs';nav.setAttribute('aria-label',t('docTabs'));
   nav.innerHTML='<button type="button" data-rc1790-tab="invoice">'+esc(t('invoiceTab'))+'</button><button type="button" data-rc1790-tab="delivery">'+esc(t('deliveryTab'))+'</button>';
   parent.insertBefore(nav,invoice);
   nav.addEventListener('click',function(e){var button=e.target&&e.target.closest('[data-rc1790-tab]');if(!button)return;mode=button.getAttribute('data-rc1790-tab');applyMode()});
  }
  if(!panel()){
   var section=root.document.createElement('section');section.id='rc1790DeliveryNote';section.hidden=true;
   section.innerHTML='<img class="rc1790-logo" alt="Essentra Components" src="/assets/essentra-company-logo.png"><h4>'+esc(t('pageTitle'))+'</h4>'+
    '<p>'+esc(t('pageHelp'))+'</p>'+
    '<div class="rc1790-head"><h5 class="rc1790-break">'+esc(t('sectionDocument'))+'</h5>'+
    label(t('documentNumber'),'documentNumber','text',false,'placeholder="DNC3019223442"')+
    label(t('date'),'issuedAt','date')+
    label(t('deliveryDate'),'deliveryDate','date')+
    '<h5 class="rc1790-break">'+esc(t('sectionCustomer'))+'</h5>'+
    label(t('sender'),'senderName')+
    label(t('senderAddress'),'senderAddress','textarea',true)+
    label(t('customerNumber'),'customerNumber')+
    label(t('recipient'),'recipient')+
    label(t('recipientAddress'),'recipientAddress','textarea',true)+
    '<h5 class="rc1790-break">'+esc(t('sectionShipping'))+'</h5>'+
    label(t('order'),'customerOrder')+
    label(t('reference'),'shipmentReference')+
    label(t('packageCount'),'packageCount','number',false,'min="0" step="1"')+
    label(t('packageType'),'packageType')+
    label(t('netWeight'),'netWeight','number',false,'min="0" step="0.001"')+
    label(t('grossWeight'),'grossWeight','number',false,'min="0" step="0.001"')+
    '</div><h5 class="rc1790-break">'+esc(t('sectionItems'))+'</h5>'+
    '<div class="rc1790-table"><table><thead><tr><th>'+esc(t('position'))+'</th><th>'+esc(t('article'))+'</th><th>'+esc(t('description'))+'</th><th>'+esc(t('quantity'))+'</th><th>'+esc(t('unit'))+'</th><th>'+esc(t('orderPosition'))+'</th><th>'+esc(t('actions'))+'</th></tr></thead><tbody data-rc1790-items></tbody></table></div>'+
    label(t('remarks'),'notes','textarea')+
    '<div class="rc1790-actions"><button type="button" class="ghost" data-rc1790-add>'+esc(t('add'))+'</button><button type="button" class="btn" data-rc1790-export>'+esc(t('export'))+'</button></div>'+
    '<div role="status" aria-live="polite" data-rc1790-status hidden></div>';
   parent.appendChild(section);
   section.querySelectorAll('[data-rc1790-header]').forEach(function(input){input.value=headerDraft[input.getAttribute('data-rc1790-header')]||''});
   renderRows();
   section.addEventListener('input',function(e){
    var header=e.target&&e.target.closest('[data-rc1790-header]');
    if(header)headerDraft[header.getAttribute('data-rc1790-header')]=header.value;
    var control=e.target&&e.target.closest('tr[data-row] [data-field]');
    if(control){var i=Number(control.closest('[data-row]').getAttribute('data-row'));if(items[i])items[i][control.getAttribute('data-field')]=control.value}
   });
   section.addEventListener('click',function(e){
    var button=e.target&&e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-rc1790-add')){if(items.length>=250)return;items.push({itemNumber:'',description:'',quantity:'',unit:'Stk',orderPosition:''});renderRows();return}
    if(button.hasAttribute('data-rc1790-remove')){var ri=Number(button.getAttribute('data-rc1790-remove'));if(items.length>1&&items[ri]){items.splice(ri,1);renderRows()}return}
    if(button.hasAttribute('data-rc1790-copy')){var ci=Number(button.getAttribute('data-rc1790-copy'));if(items.length<250&&items[ci]){items.splice(ci+1,0,Object.assign({},items[ci]));renderRows()}return}
    if(button.hasAttribute('data-rc1790-export'))save();
   })
  }
  applyMode();return true
 }
 function localizeWithoutLosingDraft(){
  var current=panel(),nav=root.document&&root.document.getElementById('rc1790DocTabs');
  if(current){current.querySelectorAll('[data-rc1790-header]').forEach(function(input){headerDraft[input.getAttribute('data-rc1790-header')]=input.value});current.remove()}
  if(nav)nav.remove();
  schedule()
 }
 function schedule(){if(timer)return;timer=root.setTimeout(function(){timer=0;mount()},20)}
 function start(){schedule();if(!observer&&root.MutationObserver&&root.document.body){observer=new root.MutationObserver(function(){if(host()&&!panel())schedule()});observer.observe(root.document.body,{childList:true,subtree:true})}}
 root.ExportHUBRC1790DeliveryNote=Object.freeze({version:'RC1790',mount:mount,snapshot:snapshot,importAnalysis:importAnalysis});
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 if(root.addEventListener){['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(function(event){root.addEventListener(event,schedule)});root.addEventListener('exporthub:language-changed',localizeWithoutLosingDraft)};
})(typeof window!=='undefined'?window:globalThis);
