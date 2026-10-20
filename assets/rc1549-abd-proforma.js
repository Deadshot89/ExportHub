(function(root){
'use strict';
if(!root||root.ExportHUBRC1549Proforma)return;

var rows=[emptyRow()],manualSnapshot=null,busy=false,timer=0,observer=null,observerRoot=null;
var packs={
 de:{title:'Positionen manuell erfassen',help:'Alternativ zum Dokument- oder Excel-Upload kannst du die Warenpositionen hier direkt erfassen. Alle Wege verwenden dieselbe ABD-Prüflogik.',number:'Proforma-Nr.',date:'Datum',recipient:'Empfänger',country:'Empfängerland',currency:'Währung',add:'Position hinzufügen',create:'Positionen auswerten',proforma:'Proforma-Rechnung erstellen',item:'Artikel',description:'Warenbeschreibung',qty:'Menge',unit:'Einheit',unitPrice:'Einzelpreis',value:'Warenwert',net:'Netto kg',gross:'Brutto kg',volume:'Volumen m³',hs:'HS-Code',origin:'Herkunftsland',actions:'Aktionen',remove:'Entfernen',duplicate:'Duplizieren',summary:'Manuelle Auswertung',total:'Warenwert gesamt',groups:'Zollzusammenfassung',required:'Bitte mindestens eine vollständige Warenposition erfassen.',recipientRequired:'Bitte Empfänger eintragen.',ready:'Auswertung vollständig. Proforma kann erstellt werden.',review:'Bitte markierte Pflichtangaben ergänzen.',error:'Aktion fehlgeschlagen.'},
 en:{title:'Enter items manually',help:'As an alternative to document or Excel upload, enter goods items here. All routes use the same export-declaration validation.',number:'Proforma no.',date:'Date',recipient:'Recipient',country:'Destination country',currency:'Currency',add:'Add item',create:'Validate items',proforma:'Create proforma invoice',item:'Item',description:'Goods description',qty:'Quantity',unit:'Unit',unitPrice:'Unit price',value:'Goods value',net:'Net kg',gross:'Gross kg',volume:'Volume m³',hs:'HS code',origin:'Country of origin',actions:'Actions',remove:'Remove',duplicate:'Duplicate',summary:'Manual analysis',total:'Total goods value',groups:'Customs summary',required:'Enter at least one complete goods item.',recipientRequired:'Enter a recipient.',ready:'Analysis complete. Proforma can be created.',review:'Complete the marked required data.',error:'Action failed.'},
 pl:{title:'Ręczne pozycje',help:'Zamiast przesyłania dokumentu lub Excela możesz wpisać pozycje ręcznie. Wszystkie ścieżki używają tej samej walidacji ABD.',number:'Nr proforma',date:'Data',recipient:'Odbiorca',country:'Kraj odbiorcy',currency:'Waluta',add:'Dodaj pozycję',create:'Sprawdź pozycje',proforma:'Utwórz fakturę proforma',item:'Artykuł',description:'Opis towaru',qty:'Ilość',unit:'Jednostka',unitPrice:'Cena jednostkowa',value:'Wartość towaru',net:'Netto kg',gross:'Brutto kg',volume:'Objętość m³',hs:'Kod HS',origin:'Kraj pochodzenia',actions:'Akcje',remove:'Usuń',duplicate:'Duplikuj',summary:'Analiza ręczna',total:'Łączna wartość',groups:'Podsumowanie celne',required:'Wprowadź co najmniej jedną kompletną pozycję.',recipientRequired:'Wprowadź odbiorcę.',ready:'Analiza kompletna. Można utworzyć proformę.',review:'Uzupełnij wymagane dane.',error:'Operacja nie powiodła się.'},
 es:{title:'Introducir partidas manualmente',help:'Como alternativa a cargar documentos o Excel, puedes introducir aquí las partidas. Todas las vías usan la misma validación ABD.',number:'N.º proforma',date:'Fecha',recipient:'Destinatario',country:'País de destino',currency:'Moneda',add:'Añadir partida',create:'Validar partidas',proforma:'Crear factura proforma',item:'Artículo',description:'Descripción',qty:'Cantidad',unit:'Unidad',unitPrice:'Precio unitario',value:'Valor',net:'Neto kg',gross:'Bruto kg',volume:'Volumen m³',hs:'Código HS',origin:'País de origen',actions:'Acciones',remove:'Eliminar',duplicate:'Duplicar',summary:'Análisis manual',total:'Valor total',groups:'Resumen aduanero',required:'Introduce al menos una partida completa.',recipientRequired:'Introduce un destinatario.',ready:'Análisis completo. Se puede crear la proforma.',review:'Completa los datos obligatorios.',error:'La acción ha fallado.'},
 fr:{title:'Saisir les positions manuellement',help:'Au lieu de téléverser un document ou Excel, vous pouvez saisir les marchandises ici. Toutes les voies utilisent la même validation ABD.',number:'N° proforma',date:'Date',recipient:'Destinataire',country:'Pays de destination',currency:'Devise',add:'Ajouter une position',create:'Contrôler les positions',proforma:'Créer la facture proforma',item:'Article',description:'Description',qty:'Quantité',unit:'Unité',unitPrice:'Prix unitaire',value:'Valeur',net:'Net kg',gross:'Brut kg',volume:'Volume m³',hs:'Code SH',origin:'Pays d’origine',actions:'Actions',remove:'Supprimer',duplicate:'Dupliquer',summary:'Analyse manuelle',total:'Valeur totale',groups:'Résumé douanier',required:'Saisissez au moins une position complète.',recipientRequired:'Saisissez un destinataire.',ready:'Analyse complète. La proforma peut être créée.',review:'Complétez les données obligatoires.',error:'Échec de l’action.'},
 it:{title:'Inserisci posizioni manualmente',help:'In alternativa al caricamento di documenti o Excel puoi inserire qui le posizioni. Tutti i percorsi usano la stessa verifica ABD.',number:'N. proforma',date:'Data',recipient:'Destinatario',country:'Paese di destinazione',currency:'Valuta',add:'Aggiungi posizione',create:'Verifica posizioni',proforma:'Crea fattura proforma',item:'Articolo',description:'Descrizione',qty:'Quantità',unit:'Unità',unitPrice:'Prezzo unitario',value:'Valore merce',net:'Netto kg',gross:'Lordo kg',volume:'Volume m³',hs:'Codice HS',origin:'Paese di origine',actions:'Azioni',remove:'Rimuovi',duplicate:'Duplica',summary:'Analisi manuale',total:'Valore totale',groups:'Riepilogo doganale',required:'Inserisci almeno una posizione completa.',recipientRequired:'Inserisci un destinatario.',ready:'Analisi completa. È possibile creare la proforma.',review:'Completa i dati obbligatori.',error:'Operazione non riuscita.'}
};
function q(value){return String(value==null?'':value).trim()}
function esc(value){return q(value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function language(){
 try{var value=root.ExportHUBI18n&&typeof root.ExportHUBI18n.language==='function'?root.ExportHUBI18n.language():root.navigator&&root.navigator.language;value=q(value).toLowerCase().slice(0,2);return packs[value]?value:'de'}catch(_){return'de'}
}
function t(key){return packs[language()][key]||packs.de[key]||key}
function emptyRow(){return{itemNumber:'',description:'',quantity:'',unit:'pcs',unitPrice:'',value:'',netMassKg:'',grossMassKg:'',volumeM3:'',commodityCode:'',originCountry:''}}
function number(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 var raw=q(value).replace(/\s+/g,'').replace(/[^0-9,.-]/g,'');if(!raw)return null;
 var comma=raw.lastIndexOf(','),dot=raw.lastIndexOf('.');
 if(comma>=0&&dot>=0)raw=comma>dot?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');
 else if(comma>=0)raw=raw.replace(',','.');
 var out=Number(raw);return Number.isFinite(out)?out:null
}
function money(value){var n=number(value);return n==null?'':n.toFixed(2)}
function metric(value){var n=number(value);return n==null?'':n.toFixed(3)}
function authToken(){
 try{var rt=root.ExportHUBClean&&root.ExportHUBClean.runtime||{},token=q(rt.authToken||rt.sessionToken);if(token)return token}catch(_){}
 try{for(var i=0;root.sessionStorage&&i<root.sessionStorage.length;i++){var raw=root.sessionStorage.getItem(root.sessionStorage.key(i));if(!raw||raw.charAt(0)!=='{')continue;var parsed=JSON.parse(raw);if(parsed&&parsed.token)return q(parsed.token)}}catch(_){}
 return''
}
function environment(){try{return /-testservice\./i.test(String(root.location&&root.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
function headers(){
 var token=authToken();if(!token)throw new Error('Unauthorized');
 return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':environment(),'X-ExportHUB-Language':language()}
}
async function post(url,payload){
 var response=await root.fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify(payload)}),raw=await response.text(),body={};
 try{body=raw?JSON.parse(raw):{}}catch(_){body={message:raw}}
 if(!response.ok){var error=new Error(q(body.message)||('HTTP '+response.status));error.code=q(body.code);throw error}
 return body
}
function decodeBase64(raw){var binary=root.atob(q(raw)),bytes=new Uint8Array(binary.length);for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function download(file){
 if(!file||!file.base64)throw new Error('ABD_EXPORT_EMPTY');
 var blob=new root.Blob([decodeBase64(file.base64)],{type:q(file.mimeType)||'application/pdf'}),url=root.URL.createObjectURL(blob),link=root.document.createElement('a');
 link.href=url;link.download=q(file.name)||'Proforma.pdf';link.style.display='none';root.document.body.appendChild(link);link.click();link.remove();root.setTimeout(function(){try{root.URL.revokeObjectURL(url)}catch(_){}},1000)
}
function ready(snapshot){
 snapshot=snapshot&&typeof snapshot==='object'?snapshot:{};var review=snapshot.review||{},totals=snapshot.totals||{},groups=Array.isArray(snapshot.groups)?snapshot.groups:[],unassigned=Array.isArray(snapshot.unassigned)?snapshot.unassigned:[];
 return review.complete===true&&number(totals.difference)===0&&groups.length>0&&unassigned.length===0
}
async function exportProforma(snapshot,button){
 if(!ready(snapshot)||busy)return false;busy=true;if(button)button.disabled=true;
 try{var result=await post('/api/abd-analysis/export',{action:'export',format:'proforma',snapshot:snapshot});download(result.file);return true}
 catch(error){setStatus(q(error&&error.message)||t('error'),'bad');return false}
 finally{busy=false;if(button)button.disabled=false;schedule()}
}
function host(){return root.document&&root.document.getElementById('rc1294AbdAnalysis')}
function invoicePanel(){var h=host();return h&&h.querySelector('[data-rc1294-invoice-panel]')}
function manualPanel(){return root.document&&root.document.getElementById('rc1549AbdManual')}
function setStatus(message,kind){var box=manualPanel()&&manualPanel().querySelector('[data-rc1549-status]');if(!box)return;box.hidden=!q(message);box.textContent=q(message);box.setAttribute('data-kind',kind||'info')}
function input(name,type,placeholder){return'<input '+(type?'type="'+type+'" ':'')+'data-field="'+name+'" placeholder="'+esc(placeholder||'')+'" autocomplete="off">'}
function rowHtml(row,index){
 return'<tr data-index="'+index+'"><td>'+input('itemNumber','text',t('item'))+'</td><td class="rc1549-wide">'+input('description','text',t('description'))+'</td><td>'+input('quantity','text','0')+'</td><td>'+input('unit','text','pcs')+'</td><td>'+input('unitPrice','text','0,00')+'</td><td>'+input('value','text','0,00')+'</td><td>'+input('netMassKg','text','0,000')+'</td><td>'+input('grossMassKg','text','0,000')+'</td><td>'+input('volumeM3','text','0,000')+'</td><td>'+input('commodityCode','text','39269097')+'</td><td>'+input('originCountry','text','DE')+'</td><td><div class="rc1549-row-actions"><button type="button" class="ghost" data-rc1549-duplicate="'+index+'" title="'+esc(t('duplicate'))+'">⧉</button><button type="button" class="ghost" data-rc1549-remove="'+index+'" title="'+esc(t('remove'))+'">×</button></div></td></tr>'
}
function renderRows(){
 var body=manualPanel()&&manualPanel().querySelector('[data-rc1549-manual-list]');if(!body)return;
 body.innerHTML=rows.map(rowHtml).join('');
 for(var i=0;i<rows.length;i++){
  var tr=body.querySelector('tr[data-index="'+i+'"]');if(!tr)continue;
  Object.keys(rows[i]).forEach(function(key){var field=tr.querySelector('[data-field="'+key+'"]');if(field)field.value=rows[i][key]})
 }
}
function updateRow(control){
 var tr=control&&control.closest&&control.closest('tr[data-index]'),index=Number(tr&&tr.getAttribute('data-index')),field=control&&control.getAttribute('data-field');
 if(!Number.isInteger(index)||index<0||index>=rows.length||!field)return;
 rows[index][field]=control.value;
 if((field==='quantity'||field==='unitPrice')&&!q(rows[index].value)){
  var qty=number(rows[index].quantity),price=number(rows[index].unitPrice);if(qty!=null&&price!=null){rows[index].value=money(qty*price);var valueInput=tr.querySelector('[data-field="value"]');if(valueInput)valueInput.value=rows[index].value}
 }
}
function headerValues(){
 var p=manualPanel(),get=function(name){var el=p&&p.querySelector('[data-rc1549-header="'+name+'"]');return q(el&&el.value)};
 return{invoiceNumber:get('invoiceNumber'),invoiceDate:get('invoiceDate'),customer:'Essentra Components GmbH',recipient:get('recipient'),destinationCountry:get('destinationCountry'),currency:(get('currency')||'EUR').toUpperCase().slice(0,3)}
}
function normalizeRows(){
 return rows.map(function(row,index){
  var quantity=number(row.quantity),unitPrice=number(row.unitPrice),value=number(row.value);if(value==null&&quantity!=null&&unitPrice!=null)value=Math.round(quantity*unitPrice*100)/100;
  return{position:String(index+1),itemNumber:q(row.itemNumber),description:q(row.description),quantity:quantity,unit:q(row.unit),unitPrice:unitPrice,value:value,netMassKg:number(row.netMassKg),grossMassKg:number(row.grossMassKg),volumeM3:number(row.volumeM3),commodityCode:q(row.commodityCode),originCountry:q(row.originCountry).toUpperCase(),currency:headerValues().currency,source:'manual',confirmed:true}
 }).filter(function(row){return row.description||row.itemNumber||row.commodityCode||row.value!=null})
}
function renderManualResult(snapshot){
 var box=manualPanel()&&manualPanel().querySelector('[data-rc1549-result]');if(!box)return;
 if(!snapshot){box.hidden=true;box.innerHTML='';return}
 var totals=snapshot.totals||{},groups=Array.isArray(snapshot.groups)?snapshot.groups:[],review=snapshot.review||{},currency=q(totals.currency||snapshot.header&&snapshot.header.currency);
 var table=groups.map(function(g){return'<tr><td><b>'+esc(g.commodityCode)+'</b></td><td>'+esc(g.originCountry)+'</td><td>'+esc(money(g.value))+' '+esc(g.currency)+'</td><td>'+esc(metric(g.netMassKg))+'</td><td>'+esc(metric(g.grossMassKg))+'</td><td>'+esc(metric(g.volumeM3))+'</td></tr>'}).join('');
 box.hidden=false;box.innerHTML='<div class="rc1549-result-head"><div><small>'+esc(t('summary'))+'</small><strong>'+esc(review.complete?t('ready'):t('review'))+'</strong></div><button type="button" class="btn" data-rc1549-proforma '+(ready(snapshot)?'':'disabled')+'>'+esc(t('proforma'))+'</button></div><div class="rc1549-metrics"><div><span>'+esc(t('total'))+'</span><strong>'+esc(money(totals.invoiceTotal))+' '+esc(currency)+'</strong></div><div><span>'+esc(t('net'))+'</span><strong>'+esc(metric(totals.netMassKg))+' kg</strong></div><div><span>'+esc(t('gross'))+'</span><strong>'+esc(metric(totals.grossMassKg))+' kg</strong></div><div><span>'+esc(t('volume'))+'</span><strong>'+esc(metric(totals.volumeM3))+' m³</strong></div></div><h5>'+esc(t('groups'))+'</h5><div class="rc1549-scroll"><table><thead><tr><th>'+esc(t('hs'))+'</th><th>'+esc(t('origin'))+'</th><th>'+esc(t('value'))+'</th><th>'+esc(t('net'))+'</th><th>'+esc(t('gross'))+'</th><th>'+esc(t('volume'))+'</th></tr></thead><tbody>'+table+'</tbody></table></div>';
 setStatus(review.complete?t('ready'):t('review'),review.complete?'ok':'warn')
}
async function analyzeManual(button){
 if(busy)return false;var header=headerValues(),positions=normalizeRows();
 if(!header.recipient){setStatus(t('recipientRequired'),'bad');return false}
 if(!positions.length){setStatus(t('required'),'bad');return false}
 var total=positions.reduce(function(sum,row){return sum+Number(row.value||0)},0);header.invoiceTotal=Math.round(total*100)/100;
 busy=true;if(button)button.disabled=true;setStatus('…','info');
 try{var result=await post('/api/abd-analysis',{action:'reanalyze',header:header,positions:positions});manualSnapshot=result.analysis||null;renderManualResult(manualSnapshot);return !!manualSnapshot}
 catch(error){manualSnapshot=null;renderManualResult(null);setStatus(q(error&&error.message)||t('error'),'bad');return false}
 finally{busy=false;if(button)button.disabled=false}
}
function enhanceUploaded(){
 var box=root.document&&root.document.querySelector('[data-rc1294-results]');if(!box)return false;
 var docs=box.querySelectorAll('.rc1294-document'),api=root.ExportHUBRC1294ABDAnalysis;
 for(var i=0;i<docs.length;i++){
  var head=docs[i].querySelector('.rc1294-document-head');if(!head)continue;
  var button=head.querySelector('[data-rc1549-proforma]');
  if(!button){button=root.document.createElement('button');button.type='button';button.className='ghost';button.setAttribute('data-rc1549-proforma','');button.textContent=t('proforma');head.appendChild(button)}
  var snapshot=api&&typeof api.snapshot==='function'?api.snapshot(i):null;button.disabled=!ready(snapshot);button.setAttribute('data-result-index',String(i));
  button.onclick=(function(index,target){return function(){var current=api&&typeof api.snapshot==='function'?api.snapshot(index):null;exportProforma(current,target)}})(i,button)
 }
 return true
}
function ensureStyle(){
 var d=root.document;if(!d||!d.createElement||d.getElementById('rc1549AbdProformaStyle'))return;
 var style=d.createElement('style');style.id='rc1549AbdProformaStyle';style.textContent='.rc1549-manual{margin-top:16px;padding:14px;border:1px solid #a7f3d0;border-left:4px solid #0f766e;border-radius:12px;background:rgba(240,253,250,.82);color:var(--text,#0f172a)}.rc1549-manual h4{margin:0 0 4px}.rc1549-manual>p{margin:0;color:var(--muted,#475569);font-size:13px}.rc1549-head{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px;margin:12px 0}.rc1549-head label{display:grid;gap:4px;font-size:11px;font-weight:700;color:var(--muted,#475569)}.rc1549-head input{box-sizing:border-box;width:100%;min-height:38px;padding:7px 8px;border:1px solid #94a3b8;border-radius:8px;background:var(--card,#fff);color:var(--text,#0f172a)}.rc1549-scroll{overflow:auto;border:1px solid #cbd5e1;border-radius:10px;background:var(--card,#fff)}.rc1549-scroll table{border-collapse:collapse;width:100%;min-width:1510px;font-size:11px}.rc1549-scroll th,.rc1549-scroll td{padding:6px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.rc1549-scroll th{background:rgba(248,250,252,.96);color:#334155;position:sticky;top:0;z-index:1}.rc1549-scroll input{box-sizing:border-box;width:100%;min-width:76px;padding:6px;border:1px solid #cbd5e1;border-radius:6px;background:var(--card,#fff);color:var(--text,#0f172a)}.rc1549-scroll td.rc1549-wide input{min-width:230px}.rc1549-row-actions{display:flex;gap:4px}.rc1549-row-actions button{min-width:34px;padding:5px 7px}.rc1549-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rc1549-status{margin-top:10px;padding:8px 10px;border-radius:8px;background:#eff6ff;font-size:12px;font-weight:700}.rc1549-status[data-kind="ok"]{background:#ecfdf5;color:#065f46}.rc1549-status[data-kind="warn"]{background:#fff7ed;color:#9a3412}.rc1549-status[data-kind="bad"]{background:#fef2f2;color:#991b1b}.rc1549-result{margin-top:12px;padding:12px;border:1px solid #99f6e4;border-radius:10px;background:var(--card,#fff)}.rc1549-result-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.rc1549-result-head small{display:block;color:#64748b}.rc1549-result-head strong{display:block}.rc1549-metrics{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin:10px 0}.rc1549-metrics>div{display:grid;gap:3px;padding:8px;border:1px solid #dbeafe;border-radius:8px}.rc1549-metrics span{font-size:11px;color:#64748b}@media(max-width:1000px){.rc1549-head{grid-template-columns:1fr 1fr}.rc1549-metrics{grid-template-columns:1fr 1fr}}@media(max-width:560px){.rc1549-head,.rc1549-metrics{grid-template-columns:1fr}.rc1549-actions>*{width:100%}}';
 (d.head||d.documentElement).appendChild(style)
}
function mountManual(){
 var parent=invoicePanel();if(!parent)return false;ensureStyle();
 var panel=manualPanel();if(panel)return true;
 panel=root.document.createElement('section');panel.id='rc1549AbdManual';panel.className='rc1549-manual';panel.setAttribute('data-rc1549-manual','');
 var today='';try{today=new Date().toISOString().slice(0,10)}catch(_){}
 panel.innerHTML='<h4>'+esc(t('title'))+'</h4><p>'+esc(t('help'))+'</p><div class="rc1549-head"><label>'+esc(t('number'))+'<input data-rc1549-header="invoiceNumber" placeholder="PF-…"></label><label>'+esc(t('date'))+'<input type="date" data-rc1549-header="invoiceDate" value="'+esc(today)+'"></label><label>'+esc(t('recipient'))+'<input data-rc1549-header="recipient"></label><label>'+esc(t('country'))+'<input data-rc1549-header="destinationCountry" maxlength="80"></label><label>'+esc(t('currency'))+'<input data-rc1549-header="currency" value="EUR" maxlength="3"></label></div><div class="rc1549-scroll"><table><thead><tr><th>'+esc(t('item'))+'</th><th>'+esc(t('description'))+'</th><th>'+esc(t('qty'))+'</th><th>'+esc(t('unit'))+'</th><th>'+esc(t('unitPrice'))+'</th><th>'+esc(t('value'))+'</th><th>'+esc(t('net'))+'</th><th>'+esc(t('gross'))+'</th><th>'+esc(t('volume'))+'</th><th>'+esc(t('hs'))+'</th><th>'+esc(t('origin'))+'</th><th>'+esc(t('actions'))+'</th></tr></thead><tbody data-rc1549-manual-list></tbody></table></div><div class="rc1549-actions"><button type="button" class="ghost" data-rc1549-manual-add>+ '+esc(t('add'))+'</button><button type="button" class="btn" data-rc1549-manual-create>'+esc(t('create'))+'</button></div><div class="rc1549-status" data-rc1549-status hidden></div><div class="rc1549-result" data-rc1549-result hidden></div>';
 parent.appendChild(panel);renderRows();
 panel.addEventListener('input',function(event){var control=event.target&&event.target.closest&&event.target.closest('tbody [data-field]');if(control)updateRow(control)});
 panel.addEventListener('click',function(event){
  var add=event.target&&event.target.closest&&event.target.closest('[data-rc1549-manual-add]');if(add){rows.push(emptyRow());renderRows();return}
  var remove=event.target&&event.target.closest&&event.target.closest('[data-rc1549-remove]');if(remove){var ri=Number(remove.getAttribute('data-rc1549-remove'));if(rows.length>1&&Number.isInteger(ri)){rows.splice(ri,1);renderRows()}return}
  var duplicate=event.target&&event.target.closest&&event.target.closest('[data-rc1549-duplicate]');if(duplicate){var di=Number(duplicate.getAttribute('data-rc1549-duplicate'));if(Number.isInteger(di)&&rows[di]){rows.splice(di+1,0,Object.assign({},rows[di]));renderRows()}return}
  var create=event.target&&event.target.closest&&event.target.closest('[data-rc1549-manual-create]');if(create){analyzeManual(create);return}
  var proforma=event.target&&event.target.closest&&event.target.closest('[data-rc1549-proforma]');if(proforma&&proforma.closest('#rc1549AbdManual'))exportProforma(manualSnapshot,proforma)
 });
 return true
}
function observerHost(){return root.document&&root.document.getElementById('rc1294AbdAnalysis')}
function bindObserver(){
 var target=observerHost();if(!target||typeof root.MutationObserver!=='function')return false;if(observer&&observerRoot===target)return true;
 if(observer)try{observer.disconnect()}catch(_){};observer=null;observerRoot=null;
 try{observer=new root.MutationObserver(schedule);observer.observe(target,{childList:true,subtree:true});observerRoot=target;return true}catch(_){return false}
}
function enhance(){mountManual();enhanceUploaded();bindObserver();return true}
function schedule(){if(timer)return;timer=root.setTimeout?root.setTimeout(function(){timer=0;enhance()},0):0;if(!root.setTimeout)enhance()}
function activate(){schedule()}
root.ExportHUBRC1549Proforma=Object.freeze({version:'RC1549',mount:enhance,ready:ready,manualSnapshot:function(){return manualSnapshot?JSON.parse(JSON.stringify(manualSnapshot)):null}});
if(root.document&&root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',activate,{once:true});else activate();
if(typeof root.addEventListener==='function')['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:language-changed'].forEach(function(name){root.addEventListener(name,activate)});
})(typeof window!=='undefined'?window:globalThis);
