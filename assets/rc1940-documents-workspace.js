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
 var uploadLabels={
  de:{title:'Dateien hochladen und analysieren',hint:'PDF, Excel, CSV oder Bild hochladen. Nach der Sicherheitsprüfung erkannte Daten prüfen und in den Editor übernehmen.',select:'Dateien auswählen',start:'Dateien analysieren',resume:'Prüfung erneut abfragen',empty:'Bitte zuerst eine Datei auswählen.',checking:'Datei wird auf Viren geprüft und analysiert:',ready:'Analyse abgeschlossen. Daten prüfen und übernehmen.',failed:'Analyse fehlgeschlagen:',useInvoice:'In Rechnung übernehmen',useDelivery:'In Lieferschein übernehmen',positions:'Positionen',preview:'Erkannte Daten',review:'Angaben aus Dateien immer kontrollieren. Es erfolgt keine automatische Freigabe.',limits:'Maximal 5 Dateien, je höchstens 12 MB.',invalid:'Zulässig sind PDF, XLSX, CSV, TSV, TXT, JPG und PNG.',unavailable:'Die abgesicherte Dateianalyse ist nicht verfügbar.',pending:'Sicherheitsprüfung noch offen. Mit derselben Datei erneut prüfen.',selected:'Ausgewählte Dateien'},
  en:{title:'Upload and analyze files',hint:'Upload PDF, Excel, CSV or an image. Review extracted data after security scanning, then import into the editor.',select:'Choose files',start:'Analyze files',resume:'Check scan again',empty:'Choose a file first.',checking:'Scanning and analyzing:',ready:'Analysis complete. Review and import the data.',failed:'Analysis failed:',useInvoice:'Import into invoice',useDelivery:'Import into delivery note',positions:'Items',preview:'Extracted data',review:'Always verify extracted details. No automatic approval.',limits:'Up to 5 files, max 12 MB each.',invalid:'Allowed: PDF, XLSX, CSV, TSV, TXT, JPG and PNG.',unavailable:'Secure file analysis is unavailable.',pending:'Security scan still pending. Check again with the same file.',selected:'Selected files'},
  pl:{title:'Prześlij i przeanalizuj pliki',hint:'Prześlij PDF, Excel, CSV lub obraz. Sprawdź dane po kontroli bezpieczeństwa.',select:'Wybierz pliki',start:'Analizuj pliki',resume:'Sprawdź ponownie',empty:'Najpierw wybierz plik.',checking:'Kontrola i analiza:',ready:'Analiza zakończona. Sprawdź i przenieś dane.',failed:'Błąd analizy:',useInvoice:'Do faktury',useDelivery:'Do dokumentu dostawy',positions:'Pozycje',preview:'Rozpoznane dane',review:'Zawsze sprawdź rozpoznane informacje.',limits:'Maks. 5 plików, do 12 MB każdy.',invalid:'PDF, XLSX, CSV, TSV, TXT, JPG, PNG.',unavailable:'Analiza plików niedostępna.',pending:'Trwa kontrola bezpieczeństwa. Sprawdź ponownie.',selected:'Wybrane pliki'},
  es:{title:'Subir y analizar archivos',hint:'Sube PDF, Excel, CSV o imágenes. Revisa los datos antes de importarlos.',select:'Elegir archivos',start:'Analizar archivos',resume:'Comprobar otra vez',empty:'Selecciona un archivo.',checking:'Analizando:',ready:'Análisis terminado. Revisa e importa.',failed:'Error de análisis:',useInvoice:'Importar a factura',useDelivery:'Importar a albarán',positions:'Artículos',preview:'Datos detectados',review:'Comprueba siempre los datos detectados.',limits:'Hasta 5 archivos de 12 MB.',invalid:'PDF, XLSX, CSV, TSV, TXT, JPG, PNG.',unavailable:'Análisis seguro no disponible.',pending:'El análisis de seguridad sigue pendiente.',selected:'Archivos seleccionados'},
  fr:{title:'Importer et analyser des fichiers',hint:'Importez PDF, Excel, CSV ou image. Vérifiez les données avant de les reprendre.',select:'Choisir des fichiers',start:'Analyser',resume:'Vérifier à nouveau',empty:'Choisissez un fichier.',checking:'Analyse en cours :',ready:'Analyse terminée. Vérifiez puis reprenez.',failed:'Échec :',useInvoice:'Vers la facture',useDelivery:'Vers le bon de livraison',positions:'Lignes',preview:'Données extraites',review:'Vérifiez toutes les données extraites.',limits:'5 fichiers max., 12 Mo chacun.',invalid:'PDF, XLSX, CSV, TSV, TXT, JPG, PNG.',unavailable:'Analyse sécurisée indisponible.',pending:'Analyse de sécurité en attente.',selected:'Fichiers sélectionnés'},
  it:{title:'Carica e analizza file',hint:'Carica PDF, Excel, CSV o immagini. Verifica i dati prima di importarli.',select:'Scegli file',start:'Analizza file',resume:'Controlla di nuovo',empty:'Seleziona un file.',checking:'Analisi:',ready:'Analisi completata. Verifica e importa.',failed:'Errore:',useInvoice:'Nella fattura',useDelivery:'Nella bolla di consegna',positions:'Articoli',preview:'Dati estratti',review:'Verifica sempre i dati estratti.',limits:'Fino a 5 file da 12 MB.',invalid:'PDF, XLSX, CSV, TSV, TXT, JPG, PNG.',unavailable:'Analisi sicura non disponibile.',pending:'Scansione di sicurezza in attesa.',selected:'File selezionati'}
 };
 var chosenFiles=[],scanResults=[],scanBusy=false,scanPending=false;
 function ut(key){return uploadLabels[lang()][key]}
 function uploadHost(){return d.getElementById('rc1940DocumentUpload')}
 function uploadStatus(message,kind){
  var p=uploadHost(),out=p&&p.querySelector('[data-rc1940-upload-status]');
  if(out){out.hidden=!message;out.textContent=message||'';out.setAttribute('data-kind',kind||'info')}
 }
 function refreshUpload(){
  var p=uploadHost();if(!p)return;
  var h=p.querySelector('[data-rc1940-upload-heading]'),hint=p.querySelector('[data-rc1940-upload-hint]'),limits=p.querySelector('[data-rc1940-upload-limits]'),chooser=p.querySelector('[data-rc1940-choose]'),button=p.querySelector('[data-rc1940-analyze]'),selection=p.querySelector('[data-rc1940-selection]');
  if(h)h.textContent=ut('title');if(hint)hint.textContent=ut('hint');if(limits)limits.textContent=ut('limits')+' '+ut('review');
  if(chooser)chooser.textContent=ut('select');if(button){button.textContent=scanPending?ut('resume'):ut('start');button.disabled=scanBusy||!chosenFiles.length}
  if(selection)selection.textContent=chosenFiles.length?ut('selected')+': '+chosenFiles.map(function(f){return f.name}).join(', '):'';
  renderScanResults()
 }
 function renderScanResults(){
  var p=uploadHost(),out=p&&p.querySelector('[data-rc1940-upload-results]');if(!out)return;
  out.replaceChildren();
  scanResults.forEach(function(item,index){
   var analysis=item.analysis||{},header=analysis.header||{},positions=Array.isArray(analysis.positions)?analysis.positions:[];
   var box=d.createElement('article');box.className='rc1940-preview';
   var title=d.createElement('strong');title.textContent=item.fileName||ut('preview');box.appendChild(title);
   var summary=d.createElement('p');summary.textContent=[header.invoiceNumber||header.documentNumber||'',header.recipient||'',ut('positions')+': '+positions.length].filter(Boolean).join(' · ');box.appendChild(summary);
   var table=d.createElement('div');table.className='rc1940-preview-lines';
   var head=d.createElement('p');head.textContent=ut('preview')+': '+positions.slice(0,5).map(function(r){return [r.itemNumber||'',r.description||'',r.quantity==null?'':r.quantity].filter(Boolean).join(' / ')}).join('  |  ');table.appendChild(head);box.appendChild(table);
   var groups=Array.isArray(analysis.groups)?analysis.groups:[];
   if(groups.length){
    var groupTable=d.createElement('table');groupTable.className='rc1940-group-table';
    var groupBody=d.createElement('tbody');
    groups.forEach(function(group){
     var row=d.createElement('tr');
     [group.commodityCode,group.originCountry,group.value,group.currency,group.status||''].forEach(function(value){
      var cell=d.createElement('td');cell.textContent=value==null?'':String(value);row.appendChild(cell)
     });
     groupBody.appendChild(row)
    });
    groupTable.appendChild(groupBody);box.appendChild(groupTable)
   }
   if((analysis.unassigned||[]).length||analysis.requiresReview||analysis.review&&analysis.review.complete===false){
    var note=d.createElement('p');note.className='rc1940-review-note';note.textContent=ut('review');
    box.appendChild(note)
   }
   var button=d.createElement('button');button.type='button';button.className='btn';button.setAttribute('data-rc1940-use',String(index));button.textContent=lastMode==='delivery'?ut('useDelivery'):ut('useInvoice');
   box.appendChild(button);out.appendChild(box)
  })
 }
 function ensureUpload(){
  var parent=d.querySelector('#rc1940Documents [data-rc1940-document-editor]'),invoice=parent&&parent.querySelector('#rc1549AbdManual');if(!parent||!invoice)return false;
  var p=uploadHost();
  if(!p){
   p=d.createElement('section');p.id='rc1940DocumentUpload';p.className='rc1940-upload';
   p.innerHTML='<h3 data-rc1940-upload-heading></h3><p data-rc1940-upload-hint></p><div class="rc1940-upload-controls"><label><span data-rc1940-choose></span><input type="file" multiple data-rc1940-files accept=".pdf,.xlsx,.csv,.tsv,.txt,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,text/csv,text/plain"></label><button type="button" class="btn" data-rc1940-analyze></button></div><p class="rc1940-small" data-rc1940-upload-limits></p><p class="rc1940-small" data-rc1940-selection></p><div role="status" aria-live="polite" data-rc1940-upload-status hidden></div><div data-rc1940-upload-results></div>';
   parent.insertBefore(p,invoice);
   p.addEventListener('change',function(e){
    if(!e.target||!e.target.matches('[data-rc1940-files]'))return;
    e.stopPropagation();chosenFiles=Array.from(e.target.files||[]);scanResults=[];scanPending=false;uploadStatus('', 'info');refreshUpload()
   });
   p.addEventListener('click',function(e){
    var run=e.target&&e.target.closest('[data-rc1940-analyze]');
    if(run){e.preventDefault();runScan();return}
    var use=e.target&&e.target.closest('[data-rc1940-use]');if(use){e.preventDefault();applyScanResult(Number(use.getAttribute('data-rc1940-use')))}
   })
  }
  refreshUpload();return true
 }
 function applyScanResult(index){
  var result=scanResults[index];if(!result)return false;
  var editor=lastMode==='delivery'?w.ExportHUBRC1790DeliveryNote:w.ExportHUBRC1549Proforma;
  if(!editor||typeof editor.importAnalysis!=='function'){uploadStatus(ut('unavailable'),'bad');return false}
  var applied=editor.importAnalysis(result.analysis);
  if(applied)uploadStatus(ut('review'),'ok');else uploadStatus(ut('failed')+' '+ut('review'),'bad');
  return !!applied
 }
 async function runScan(){
  if(scanBusy)return false;
  if(!chosenFiles.length){uploadStatus(ut('empty'),'bad');return false}
  if(chosenFiles.length>5||chosenFiles.some(function(f){return !/\.(pdf|xlsx|csv|tsv|txt|jpe?g|png)$/i.test(f.name)||!f.size||f.size>12*1024*1024})){uploadStatus(ut('invalid')+' '+ut('limits'),'bad');return false}
  var scanner=w.ExportHUBRC1294ABDAnalysis;
  if(!scanner||typeof scanner.analyzeFile!=='function'){uploadStatus(ut('unavailable'),'bad');return false}
  scanBusy=true;scanPending=false;scanResults=[];refreshUpload();
  var errors=[];
  try{
   for(var i=0;i<chosenFiles.length;i++){
    var file=chosenFiles[i];uploadStatus(ut('checking')+' '+file.name,'info');
    try{
     var response=await scanner.analyzeFile(file),analysis=response&&response.analysis;
     if(!analysis)throw new Error('ANALYSIS_EMPTY');
     var docs=Array.isArray(analysis.deliveryDocuments)&&analysis.deliveryDocuments.length?analysis.deliveryDocuments:[analysis];
     docs.forEach(function(doc,n){if(doc&&Array.isArray(doc.positions)&&doc.positions.length)scanResults.push({fileName:file.name+(docs.length>1?' #'+(n+1):''),analysis:doc});else errors.push(file.name+': 0 '+ut('positions'))})
    }catch(error){
     if(error&&error.code==='ABD_SCAN_PENDING')scanPending=true;
     errors.push(file.name+': '+(error&&error.code==='ABD_SCAN_PENDING'?ut('pending'):(error&&error.message||error&&error.code||ut('failed'))))
    }
   }
   refreshUpload();uploadStatus((scanResults.length?ut('ready'):'')+(errors.length?' '+ut('failed')+' '+errors.join('; '):''),errors.length?'warn':'ok');
   return !!scanResults.length
  }finally{scanBusy=false;refreshUpload()}
 }

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
   // Reuse the canonical menu's responsive, light/dark and accessibility styling.
   b.setAttribute('data-index321-view','documents');
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
  ensureUpload();
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
    ensureUpload();
    setActive(true)
   }
  }else setActive(false)
 }
 function schedule(){if(scheduled)return;scheduled=true;(w.requestAnimationFrame||w.setTimeout)(sync)}
 function install(){
  if(installed)return;installed=true;
  var css=d.createElement('style');css.id='rc1940DocumentsStyle';
  css.textContent='#rc1940Documents{width:100%;min-width:0;padding:4px 0 28px}#rc1940Documents .rc1940-head{margin-bottom:20px}#rc1940Documents .rc1940-head h2{margin:0 0 6px;font-size:clamp(22px,2vw,30px)}#rc1940Documents .rc1940-head p{margin:0;color:var(--muted,#475569)}#rc1940Documents [data-rc1940-document-editor]{min-width:0}#rc1940Documents #rc1549AbdManual,#rc1940Documents #rc1790DeliveryNote{margin-top:12px}#rc1940Documents #rc1790DocTabs button{min-height:44px;min-width:150px}@media(max-width:600px){#rc1940Documents #rc1790DocTabs{display:grid;grid-template-columns:1fr 1fr}#rc1940Documents #rc1790DocTabs button{min-width:0}}';
  css.textContent+='#rc1940DocumentUpload{margin:12px 0 20px;padding:16px;border:1px solid var(--border,#cbd5e1);border-radius:12px;background:var(--card,#fff);color:var(--text,#0f172a)}#rc1940DocumentUpload h3{font-size:18px;margin:0 0 8px}#rc1940DocumentUpload p{margin:5px 0 10px}#rc1940DocumentUpload .rc1940-upload-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap}#rc1940DocumentUpload label{display:grid;gap:7px;min-width:200px}#rc1940DocumentUpload input[type=file]{max-width:100%;min-height:44px}#rc1940DocumentUpload [data-rc1940-analyze]{min-height:44px}#rc1940DocumentUpload .rc1940-small{font-size:13px;color:var(--muted,#64748b)}#rc1940DocumentUpload [data-rc1940-upload-status]:not([hidden]){padding:8px 0;font-weight:600}#rc1940DocumentUpload .rc1940-preview{padding:12px 0;border-top:1px solid var(--border,#cbd5e1)}#rc1940DocumentUpload .rc1940-preview p{overflow-wrap:anywhere}#rc1940DocumentUpload .rc1940-preview-lines{max-height:140px;overflow:auto;font-size:13px}#rc1940DocumentUpload .rc1940-preview button{min-height:44px}@media(max-width:600px){#rc1940DocumentUpload .rc1940-upload-controls{display:grid}#rc1940DocumentUpload .rc1940-upload-controls button{width:100%}}';
  css.textContent+='#rc1940DocumentUpload .rc1940-group-table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:13px}#rc1940DocumentUpload .rc1940-group-table td{padding:8px 7px;border-bottom:1px solid var(--border,#cbd5e1);overflow-wrap:anywhere}#rc1940DocumentUpload .rc1940-review-note{font-weight:650;color:var(--muted,#475569)}';
  d.head.appendChild(css);
  d.addEventListener('click',function(e){
   var target=e.target&&e.target.closest&&e.target.closest('[data-exporthub-documents-nav]');
   if(target){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();open();return}
   var tab=e.target&&e.target.closest&&e.target.closest('#rc1940Documents [data-rc1790-tab]');
   if(tab){lastMode=tab.getAttribute('data-rc1790-tab');refreshUpload()}
  },true);
  if(w.MutationObserver){var n=nav();if(n){observer=new w.MutationObserver(schedule);observer.observe(n,{childList:true,subtree:false,attributes:false})}}
  ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(function(name){w.addEventListener(name,schedule)});
  schedule()
 }
 w.documents=function(){return open()};
 w.ExportHUBDocuments1940=Object.freeze({version:'RC1940',open:open,refresh:sync,permitted:permitted});
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install()
})(window,document);
