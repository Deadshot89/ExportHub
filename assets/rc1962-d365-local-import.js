/* RC1962: D365-only local XLSX import for Proforma positions. No file upload. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBRC1962D365LocalImport)return;
var worker=null,busy=false,docs=[],currentMode='invoice',timeoutId=null;
var L={
 de:{title:'D365-Excel lokal einlesen',help:'Die Excel-Datei bleibt auf diesem Gerät. Nur Artikelpositionen werden übernommen; alle anderen Rechnungsangaben füllst du selbst aus. Bei der späteren PDF-Erstellung werden die strukturierten Rechnungsdaten an ExportHUB übertragen.',choose:'D365-Datei auswählen (.xlsx)',start:'Artikel lokal auslesen',import:'Nur Artikelpositionen übernehmen',working:'Excel-Datei wird ausschließlich auf diesem Gerät geprüft …',ready:'Artikel erkannt. Lieferschein auswählen und Positionen übernehmen.',done:'Artikelpositionen übernommen. Weitere Rechnungsdaten bitte manuell ausfüllen.',empty:'Bitte eine D365-XLSX-Datei auswählen.',invalid:'Die Datei ist kein unterstützter D365-Export oder enthält nicht zulässige Inhalte. Sie wurde nicht hochgeladen.',unsupported:'Der Browser unterstützt die lokale Excel-Analyse nicht. Bitte einen aktuellen Chrome- oder Edge-Browser verwenden.',timeout:'Die lokale Analyse hat zu lange gedauert. Datei wurde nicht hochgeladen.',positions:'Artikel',value:'Positionswert',review:'Artikelmengen, Zolltarifnummern, Ursprung und Preise bitte prüfen.',select:'Lieferschein',replace:'Bereits erfasste Artikelzeilen ersetzen?',error:'Lokaler Import fehlgeschlagen; keine Daten wurden übernommen.'},
 en:{title:'Read D365 Excel locally',help:'The Excel file stays on this device. Only item rows are imported; fill all other invoice details manually. Structured invoice data is sent to ExportHUB when generating the PDF.',choose:'Choose D365 file (.xlsx)',start:'Read items locally',import:'Import item rows only',working:'Reading the Excel file on this device only …',ready:'Items recognized. Select a delivery note to import.',done:'Items imported. Fill in other invoice details manually.',empty:'Choose a D365 XLSX file.',invalid:'Unsupported D365 export or unsafe content. The file was not uploaded.',unsupported:'Local Excel reading is not available. Use an up-to-date Chrome or Edge browser.',timeout:'Local analysis took too long. No file was uploaded.',positions:'Items',value:'Line value',review:'Check quantities, customs codes, origins and prices.',select:'Packing slip',replace:'Replace existing item rows?',error:'Local import failed; no items were transferred.'},
 pl:{title:'Lokalny import Excel D365',help:'Plik Excel pozostaje na urządzeniu. Importowane są wyłącznie pozycje; pozostałe dane faktury należy wpisać ręcznie. Dane faktury trafią do ExportHUB przy tworzeniu PDF.',choose:'Wybierz plik D365 (.xlsx)',start:'Odczytaj pozycje lokalnie',import:'Importuj tylko pozycje',working:'Odczyt na tym urządzeniu …',ready:'Wybierz dokument dostawy i importuj pozycje.',done:'Pozycje zaimportowane. Uzupełnij dane faktury ręcznie.',empty:'Wybierz plik XLSX D365.',invalid:'Nieobsługiwany eksport D365 lub niebezpieczna zawartość. Pliku nie przesłano.',unsupported:'Przeglądarka nie obsługuje lokalnej analizy XLSX.',timeout:'Analiza trwała zbyt długo; pliku nie przesłano.',positions:'Pozycje',value:'Wartość',review:'Sprawdź ilości, kody celne, kraj pochodzenia i ceny.',select:'WZ',replace:'Zastąpić istniejące pozycje?',error:'Import nieudany; nie przeniesiono danych.'},
 es:{title:'Leer Excel D365 localmente',help:'El Excel permanece en este dispositivo. Solo se importan artículos; rellena el resto de la factura manualmente. Los datos estructurados se envían a ExportHUB al crear el PDF.',choose:'Seleccionar D365 (.xlsx)',start:'Leer artículos localmente',import:'Importar solo artículos',working:'Leyendo el Excel en este dispositivo …',ready:'Selecciona un albarán para importar.',done:'Artículos importados. Completa los demás datos manualmente.',empty:'Selecciona un XLSX D365.',invalid:'Exportación D365 no compatible o contenido inseguro. No se ha subido el archivo.',unsupported:'El navegador no admite lectura XLSX local.',timeout:'La lectura ha tardado demasiado. Archivo no subido.',positions:'Artículos',value:'Valor',review:'Revisa cantidades, códigos aduaneros, orígenes y precios.',select:'Albarán',replace:'¿Sustituir artículos existentes?',error:'Error de importación local; no se han transferido datos.'},
 fr:{title:'Lire Excel D365 localement',help:'Le fichier Excel reste sur cet appareil. Seules les lignes articles sont importées ; complétez manuellement les autres données. Les données structurées seront envoyées à ExportHUB lors du PDF.',choose:'Choisir D365 (.xlsx)',start:'Lire les articles localement',import:'Importer seulement les articles',working:'Lecture du fichier sur cet appareil …',ready:'Sélectionnez le bon de livraison à importer.',done:'Articles importés. Complétez les autres données manuellement.',empty:'Choisissez un fichier XLSX D365.',invalid:'Export D365 non reconnu ou contenu dangereux. Aucun fichier envoyé.',unsupported:'Lecture locale XLSX non prise en charge.',timeout:'Lecture trop longue. Aucun fichier envoyé.',positions:'Articles',value:'Valeur',review:'Vérifiez les quantités, codes douaniers, origines et prix.',select:'Bon de livraison',replace:'Remplacer les lignes existantes ?',error:'Import local impossible ; aucune donnée transférée.'},
 it:{title:'Leggi Excel D365 localmente',help:'Il file Excel rimane su questo dispositivo. Vengono importati solo gli articoli; compila manualmente gli altri dati. I dati strutturati saranno inviati a ExportHUB per creare il PDF.',choose:'Seleziona D365 (.xlsx)',start:'Leggi articoli localmente',import:'Importa solo gli articoli',working:'Lettura Excel su questo dispositivo …',ready:'Seleziona un documento di trasporto.',done:'Articoli importati. Completa manualmente gli altri dati.',empty:'Seleziona un file XLSX D365.',invalid:'Esportazione D365 non valida o contenuti non sicuri. File non caricato.',unsupported:'Lettura locale XLSX non supportata dal browser.',timeout:'Lettura troppo lunga. File non caricato.',positions:'Articoli',value:'Valore',review:'Verifica quantità, codici doganali, origine e prezzi.',select:'DDT',replace:'Sostituire gli articoli esistenti?',error:'Import locale non riuscito; nessun dato trasferito.'}
};
function lang(){try{var x=w.ExportHUBI18n&&w.ExportHUBI18n.language&&w.ExportHUBI18n.language();return L[x]?x:'de'}catch(_){return'de'}}
function t(key){return L[lang()][key]}
function host(){return d.getElementById('rc1962D365LocalImport')}
function state(message,kind){var h=host(),o=h&&h.querySelector('[data-rc1962-status]');if(o){o.textContent=message||'';o.hidden=!message;o.setAttribute('data-kind',kind||'info')}}
function clearWorker(){if(timeoutId){w.clearTimeout(timeoutId);timeoutId=null}if(worker){try{worker.terminate()}catch(_){}}worker=null}
function reset(){docs=[];clearWorker();busy=false;var h=host(),r=h&&h.querySelector('[data-rc1962-results]');if(r)r.replaceChildren()}
function preview(){
 var h=host(),out=h&&h.querySelector('[data-rc1962-results]');if(!out)return;
 out.replaceChildren();
 docs.forEach(function(doc,i){
  var box=d.createElement('article');box.className='rc1962-preview';
  var title=d.createElement('strong');title.textContent=t('select')+': '+(doc.reference||'–');box.appendChild(title);
  var details=d.createElement('p');details.textContent=(doc.recipient||'–')+' · '+doc.positions.length+' '+t('positions');box.appendChild(details);
  var value=0,valid=true;doc.positions.forEach(function(p){if(p.value===null||p.value===undefined)valid=false;else value+=Number(p.value)});
  var total=d.createElement('p');total.textContent=t('value')+': '+(valid?value.toFixed(2):'–');box.appendChild(total);
  var sample=d.createElement('p');sample.className='rc1962-sample';sample.textContent=doc.positions.slice(0,5).map(function(p){return [p.itemNumber,p.description,p.quantity].filter(function(x){return x!==null&&x!==undefined&&x!==''}).join(' / ')}).join(' · ');box.appendChild(sample);
  var note=d.createElement('p');note.textContent=t('review');box.appendChild(note);
  var use=d.createElement('button');use.type='button';use.className='btn';use.setAttribute('data-rc1962-use',String(i));use.textContent=t('import');box.appendChild(use);
  out.appendChild(box)
 })
}
function render(){
 var h=host();if(!h)return;
 h.hidden=currentMode!=='invoice';
 var els={title:'[data-rc1962-title]',help:'[data-rc1962-help]',choose:'[data-rc1962-choose]',start:'[data-rc1962-start]'};
 Object.keys(els).forEach(function(key){var el=h.querySelector(els[key]);if(el)el.textContent=t(key)});
 var b=h.querySelector('[data-rc1962-start]'),f=h.querySelector('[data-rc1962-file]');
 if(b)b.disabled=busy||!f||!f.files||!f.files.length;
 preview()
}
function importOnly(index){
 if(currentMode!=='invoice'||busy||!docs[index])return false;
 var api=w.ExportHUBRC1549Proforma;
 if(!api||typeof api.importPositionsOnly!=='function'){state(t('error'),'bad');return false}
 var source=docs[index];
 // Only the position array crosses into the editor; document-level reference,
 // recipient and address remain on this device for selecting a batch only.
 var items=source.positions.map(function(p){
  var o={};['itemNumber','description','quantity','unit','unitPrice','value','netMassKg','grossMassKg','volumeM3','commodityCode','originCountry'].forEach(function(k){if(p[k]!==undefined&&p[k]!==null)o[k]=p[k]});return o
 });
 if(api.importPositionsOnly(items)){state(t('done'),'ok');return true}
 state(t('error'),'bad');return false
}
async function read(){
 if(busy||currentMode!=='invoice')return false;
 var h=host(),field=h&&h.querySelector('[data-rc1962-file]'),file=field&&field.files&&field.files[0];
 if(!file){state(t('empty'),'bad');return false}
 if(!/\.xlsx$/i.test(file.name)||!file.size||file.size>12*1024*1024){state(t('invalid'),'bad');return false}
 reset();busy=true;render();state(t('working'),'info');
 try{
  if(typeof w.Worker!=='function')throw Error('D365_BROWSER_DECOMPRESSION_UNAVAILABLE');
  var data=await new Promise(function(resolve,reject){
   worker=new w.Worker('/assets/rc1962-d365-xlsx-worker.js?v=1962');
   timeoutId=w.setTimeout(function(){reject(Error('D365_TIMEOUT'))},15000);
   worker.onmessage=function(ev){var value=ev.data||{};if(value.ok===true)resolve(value.docs);else reject(Error(value.code||'D365_READ_FAILED'))};
   worker.onerror=function(){reject(Error('D365_READ_FAILED'))};
   worker.postMessage({file:file})
  });
  if(!Array.isArray(data)||!data.length||data.some(function(doc){return !doc||!Array.isArray(doc.positions)||!doc.positions.length}))throw Error('D365_READ_FAILED');
  docs=data;state(t('ready'),'ok');return true
 }catch(e){docs=[];state(e&&e.message==='D365_TIMEOUT'?t('timeout'):e&&e.message==='D365_BROWSER_DECOMPRESSION_UNAVAILABLE'?t('unsupported'):t('invalid'),'bad');return false}
 finally{clearWorker();busy=false;render()}
}
function mount(mode){
 currentMode=mode==='delivery'?'delivery':'invoice';
 var parent=d.querySelector('#rc1940Documents [data-rc1940-document-editor]'),existing=host();
 if(!parent){reset();return false}
 if(!existing){
  var section=d.createElement('section');section.id='rc1962D365LocalImport';
  section.innerHTML='<h3 data-rc1962-title></h3><p data-rc1962-help></p><div class="rc1962-controls"><label><span data-rc1962-choose></span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-rc1962-file></label><button type="button" class="btn" data-rc1962-start></button></div><div role="status" aria-live="polite" data-rc1962-status hidden></div><div data-rc1962-results></div>';
  var before=parent.querySelector('#rc1940DocumentUpload')||parent.firstChild||null;parent.insertBefore(section,before);
  section.addEventListener('change',function(e){if(e.target&&e.target.matches('[data-rc1962-file]')){reset();state('', 'info');render()}});
  section.addEventListener('click',function(e){var target=e.target&&e.target.closest&&e.target.closest('[data-rc1962-start],[data-rc1962-use]');if(!target)return;e.preventDefault();if(target.hasAttribute('data-rc1962-start'))read();else importOnly(Number(target.getAttribute('data-rc1962-use')))});
  if(!d.getElementById('rc1962D365LocalStyle')){
   var css=d.createElement('style');css.id='rc1962D365LocalStyle';
   css.textContent='#rc1962D365LocalImport{padding:16px;margin:12px 0;border:1px solid var(--border,#cbd5e1);border-left:4px solid #0f766e;border-radius:12px;background:var(--card,#fff);color:var(--text,#0f172a)}#rc1962D365LocalImport h3{margin:0 0 6px;font-size:18px}#rc1962D365LocalImport p{margin:6px 0 10px;font-size:13px}#rc1962D365LocalImport .rc1962-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end}#rc1962D365LocalImport label{display:grid;gap:7px}#rc1962D365LocalImport input[type=file]{max-width:100%;min-height:44px}#rc1962D365LocalImport button{min-height:44px}#rc1962D365LocalImport [data-rc1962-status]:not([hidden]){margin:10px 0;font-weight:650}#rc1962D365LocalImport .rc1962-preview{border-top:1px solid var(--border,#cbd5e1);padding:12px 0}#rc1962D365LocalImport .rc1962-sample{overflow-wrap:anywhere}#rc1962D365LocalImport [data-kind=bad]{color:#b91c1c}@media(max-width:600px){#rc1962D365LocalImport .rc1962-controls{display:grid}#rc1962D365LocalImport button{width:100%}}';
   d.head.appendChild(css)
  }
 }
 render();return true
}
w.ExportHUBRC1962D365LocalImport=Object.freeze({version:'RC1962',mount:mount});
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
