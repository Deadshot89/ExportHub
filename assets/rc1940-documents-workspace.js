/* RC1940: independent invoice / delivery-note workspace in the existing application. */
(function(w,d){
 'use strict';
 if(!w||!d||w.ExportHUBDocuments1940)return;
 var labels={
  de:{menu:'Dokumente erstellen',title:'Dokumente erstellen',help:'Rechnung / Proforma oder Lieferschein unabhängig von einer ABD-Anfrage erstellen.'},
  en:{menu:'Create documents',title:'Create documents',help:'Create an invoice, proforma or delivery note without starting an export declaration.'},
  pl:{menu:'Utwórz dokumenty',title:'Utwórz dokumenty',help:'Utwórz fakturę, proformę lub dokument dostawy niezależnie od zgłoszenia eksportowego.'},
  es:{menu:'Crear documentos',title:'Crear documentos',help:'Crea una factura, proforma o albarán sin iniciar una declaración de exportación.'},
  fr:{menu:'Créer des documents',title:'Créer des documents',help:'Créez une facture, proforma ou bon de livraison sans demande de déclaration en douane.'},
  it:{menu:'Crea documenti',title:'Crea documenti',help:'Crea fattura, proforma o bolla di consegna senza avviare una dichiarazione doganale.'}
 };
 var lastMode='invoice',scheduled=false,observer=null,installed=false;
 function lang(){try{var l=w.ExportHUBI18n&&w.ExportHUBI18n.language&&w.ExportHUBI18n.language();return labels[l]?l:'de'}catch(_){return'de'}}
 function t(k){return labels[lang()][k]}
 function nav(){return d.getElementById('nav')}
 function source(){
  var n=nav();return n&&n.querySelector(':scope > button[data-index321-view="abd"], :scope > button[data-view="abd"]')
 }
 function permitted(){
  var b=source();return !!b&&!b.hidden&&b.getAttribute('aria-hidden')!=='true'&&b.style.display!=='none'&&!b.disabled
 }
 function item(){var n=nav();return n&&n.querySelector(':scope > [data-exporthub-documents-nav]')}
 function ensureNav(){
  var n=nav(),abd=source(),b=item();if(!n||!abd){if(b)b.remove();return false}
  if(!b){
   b=d.createElement('button');b.type='button';b.className='rc1940-documents-nav';
   b.setAttribute('data-exporthub-documents-nav','1');
   b.setAttribute('data-rc1579-proxy','documents');
   b.setAttribute('data-rc626-view','documents');
   var icon=d.createElement('span');icon.className='index308-nav-icon';icon.setAttribute('aria-hidden','true');
   icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 3h8l4 4v14H4V3z"/><path d="M16 3v5h4M8 13h8M8 17h8"/></svg>';
   var label=d.createElement('span');label.className='index308-nav-label';
   b.appendChild(icon);b.appendChild(label);abd.insertAdjacentElement('afterend',b)
  }
  var can=permitted();b.hidden=!can;b.setAttribute('aria-hidden',can?'false':'true');
  b.setAttribute('aria-label',t('menu'));b.setAttribute('title',t('menu'));
  var title=b.querySelector('.index308-nav-label');if(title&&title.textContent!==t('menu'))title.textContent=t('menu');
  return can
 }
 function active(){return !!d.body&&d.body.getAttribute('data-exporthub-view')==='documents'}
 function select(mode){
  var tab=d.querySelector('#rc1790DocTabs [data-rc1790-tab="'+mode+'"]');
  if(tab)tab.click();
 }
 function render(){
  if(!permitted())return false;
  var host=d.getElementById('content');if(!host)return false;
  var page=d.createElement('main');page.id='rc1940Documents';page.setAttribute('data-rc1940-documents','1');
  var head=d.createElement('header');head.className='rc1940-head';
  var heading=d.createElement('h2');heading.textContent=t('title');
  var intro=d.createElement('p');intro.textContent=t('help');
  head.appendChild(heading);head.appendChild(intro);page.appendChild(head);
  var editor=d.createElement('div');editor.setAttribute('data-rc1940-document-editor','1');page.appendChild(editor);
  host.replaceChildren(page);
  d.body.setAttribute('data-exporthub-view','documents');
  if(w.ExportHUBRC1549Proforma&&typeof w.ExportHUBRC1549Proforma.mount==='function')w.ExportHUBRC1549Proforma.mount();
  if(w.ExportHUBRC1790DeliveryNote&&typeof w.ExportHUBRC1790DeliveryNote.mount==='function')w.ExportHUBRC1790DeliveryNote.mount();
  select(lastMode);setActive(true);
  return true
 }
 function setActive(on){
  var b=item();if(!b)return;
  b.classList.toggle('active',!!on);
  if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')
 }
 function open(mode){
  if(mode==='invoice'||mode==='delivery')lastMode=mode;
  if(!ensureNav())return false;
  return render()
 }
 function sync(){
  scheduled=false;ensureNav();
  if(active()){
   if(!d.getElementById('rc1940Documents'))render();
   else{
    var h=d.querySelector('#rc1940Documents .rc1940-head');
    if(h){h.querySelector('h2').textContent=t('title');h.querySelector('p').textContent=t('help')}
    if(w.ExportHUBRC1549Proforma)w.ExportHUBRC1549Proforma.mount();
    if(w.ExportHUBRC1790DeliveryNote)w.ExportHUBRC1790DeliveryNote.mount();
    setActive(true)
   }
  }else setActive(false)
 }
 function schedule(){if(scheduled)return;scheduled=true;(w.requestAnimationFrame||w.setTimeout)(sync)}
 function install(){
  if(installed)return;installed=true;
  var css=d.createElement('style');css.id='rc1940DocumentsStyle';
  css.textContent='#rc1940Documents{width:100%;min-width:0;padding:4px 0 28px}#rc1940Documents .rc1940-head{margin-bottom:20px}#rc1940Documents .rc1940-head h2{margin:0 0 6px;font-size:clamp(22px,2vw,30px)}#rc1940Documents .rc1940-head p{margin:0;color:var(--muted,#475569)}#rc1940Documents [data-rc1940-document-editor]{min-width:0}#rc1940Documents #rc1549AbdManual,#rc1940Documents #rc1790DeliveryNote{margin-top:12px}#rc1940Documents #rc1790DocTabs button{min-height:44px;min-width:150px}@media(max-width:600px){#rc1940Documents #rc1790DocTabs{display:grid;grid-template-columns:1fr 1fr}#rc1940Documents #rc1790DocTabs button{min-width:0}}';
  d.head.appendChild(css);
  d.addEventListener('click',function(e){
   var target=e.target&&e.target.closest&&e.target.closest('[data-exporthub-documents-nav]');
   if(target){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();open();return}
   var tab=e.target&&e.target.closest&&e.target.closest('#rc1940Documents [data-rc1790-tab]');
   if(tab)lastMode=tab.getAttribute('data-rc1790-tab')
  },true);
  if(w.MutationObserver){var n=nav();if(n){observer=new w.MutationObserver(schedule);observer.observe(n,{childList:true,subtree:false,attributes:false})}}
  ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(function(name){w.addEventListener(name,schedule)});
  schedule()
 }
 w.documents=function(){return open()};
 w.ExportHUBDocuments1940=Object.freeze({version:'RC1940',open:open,refresh:sync,permitted:permitted});
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install()
})(window,document);
