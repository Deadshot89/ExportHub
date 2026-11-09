(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1294_ABD_SELF_SERVICE__)return;
w.__EXPORTHUB_RC1294_ABD_SELF_SERVICE__=true;

var busy=false,reviewBusy={},lastPositions=[],lastResults=[],lastGroups=[],lastUnassigned=[],mountTimer=0,hostObserver=null,hostObserverRoot=null,bootstrapObserver=null,bootstrapObserverRoot=null;
// RC1561: survive a re-render of the ABD view (#rc626Abd) – the chosen mode and files must not be lost
var currentMode='manual',pendingFiles=[],pendingUploads=new WeakMap();
function hasPendingUploads(){return pendingFiles.some(function(file){return pendingUploads.has(file)})}
function q(v){return String(v==null?'':v).trim()}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function lang(){try{return w.ExportHUBI18n&&w.ExportHUBI18n.language?w.ExportHUBI18n.language():'de'}catch(_){return'de'}}
function tr(key,vars,fallback){try{var i=w.ExportHUBI18n;if(i&&typeof i.t==='function'){var value=i.t(key,vars,lang());if(value&&value!==key)return value}}catch(_){}return fallback||key}
// RC1786: The invoice file picker must work even when its optional translation asset fails to load.
var languageFallback={
 de:{
  workspaceTitle:'ABD & Rechnungen',
  tabIntro:'Arbeitsbereich auswählen – nur die passenden Felder werden angezeigt.',
  savedMode:'Gespeicherte Anfragen',
  entryAria:'ABD-Einstieg auswählen',
  manualMode:'Manuell',
  shipmentMode:'Aus Sendung',
  invoiceMode:'Rechnung analysieren',
  invoiceHelp:'Rechnung hochladen, prüfen und nach HS-Code plus Ursprungsland gruppieren.',
  previewOnly:'Erkannte Zollangaben immer prüfen. Es werden keine HS-Codes oder Ursprungsländer erfunden.',
  chooseFiles:'Dateien auswählen',
  start:'Analyse starten',
  resumeScan:'Scanprüfung fortsetzen',
  scanPendingNote:'Datei hochgeladen. Microsoft Defender prüft noch. Später „Scanprüfung fortsetzen“ wählen.',
  scanDelayedNote:'Upload erfolgreich, aber Microsoft Defender liefert seit mehr als 2 Minuten kein Scanergebnis. IT: Scan-Ergebnis-Tags am Azure-Speicher prüfen. Datei bleibt gesperrt; Prüfung später fortsetzen.',
  groups:'HS/Ursprung-Gruppen',
  documentSingle:'Dokument',
  documentPlural:'Dokumente',
  openShort:'offen'
 },
 en:{
  workspaceTitle:'Export declarations & invoices',
  tabIntro:'Choose a workspace – only the relevant fields are shown.',
  savedMode:'Saved requests',
  entryAria:'Select export declaration entry point',
  manualMode:'Manual',
  shipmentMode:'From shipment',
  invoiceMode:'Analyze invoice',
  invoiceHelp:'Upload and review an invoice, then group it by HS code and country of origin.',
  previewOnly:'Always verify detected customs data. HS codes and countries of origin are never invented.',
  chooseFiles:'Select files',
  start:'Start analysis',
  resumeScan:'Resume scan check',
  scanPendingNote:'File uploaded. Microsoft Defender is still scanning. Choose “Resume scan check” later.',
  scanDelayedNote:'Upload succeeded, but Microsoft Defender has not returned a scan result for over 2 minutes. IT: check scan-result tags on Azure Storage. File remains blocked; resume checking later.',
  groups:'HS/origin groups',
  documentSingle:'Document',
  documentPlural:'Documents',
  openShort:'open'
 },
 pl:{
  workspaceTitle:'Zgłoszenia eksportowe i faktury',
  tabIntro:'Wybierz obszar pracy – wyświetlane są tylko odpowiednie pola.',
  savedMode:'Zapisane wnioski',
  entryAria:'Wybierz sposób rozpoczęcia ABD',
  manualMode:'Ręcznie',
  shipmentMode:'Z wysyłki',
  invoiceMode:'Analizuj fakturę',
  invoiceHelp:'Prześlij i sprawdź fakturę, a następnie pogrupuj dane według kodu HS i kraju pochodzenia.',
  previewOnly:'Zawsze sprawdzaj rozpoznane dane celne. Kody HS ani kraje pochodzenia nie są wymyślane.',
  chooseFiles:'Wybierz pliki',
  start:'Rozpocznij analizę',
  resumeScan:'Wznów sprawdzanie skanu',
  scanPendingNote:'Plik przesłany. Microsoft Defender nadal skanuje. Później wybierz „Wznów sprawdzanie skanu”.',
  scanDelayedNote:'Przesyłanie zakończone, ale Microsoft Defender od ponad 2 minut nie zwrócił wyniku skanowania. IT: sprawdź tagi wyniku skanu w usłudze Azure Storage. Plik pozostaje zablokowany; wznów sprawdzanie później.',
  groups:'Grupy HS/pochodzenie',
  documentSingle:'Dokument',
  documentPlural:'Dokumenty',
  openShort:'otwarte'
 },
 es:{
  workspaceTitle:'Declaraciones de exportación y facturas',
  tabIntro:'Selecciona una sección – solo se muestran los campos necesarios.',
  savedMode:'Solicitudes guardadas',
  entryAria:'Seleccionar entrada de ABD',
  manualMode:'Manual',
  shipmentMode:'Desde envío',
  invoiceMode:'Analizar factura',
  invoiceHelp:'Carga y revisa una factura y agrupa los datos por código HS y país de origen.',
  previewOnly:'Verifica siempre los datos aduaneros detectados. Nunca se inventan códigos HS ni países de origen.',
  chooseFiles:'Seleccionar archivos',
  start:'Iniciar análisis',
  resumeScan:'Reanudar comprobación',
  scanPendingNote:'Archivo cargado. Microsoft Defender sigue analizando. Selecciona «Reanudar comprobación» más tarde.',
  scanDelayedNote:'Archivo cargado, pero Microsoft Defender no ha devuelto el resultado del análisis en más de 2 minutos. TI: compruebe las etiquetas del análisis en Azure Storage. El archivo sigue bloqueado; reanude la comprobación más tarde.',
  groups:'Grupos HS/origen',
  documentSingle:'Documento',
  documentPlural:'Documentos',
  openShort:'abiertas'
 },
 fr:{
  workspaceTitle:'Déclarations d\'exportation et factures',
  tabIntro:'Choisissez une section – seuls les champs utiles sont affichés.',
  savedMode:'Demandes enregistrées',
  entryAria:'Sélectionner le point d’entrée ABD',
  manualMode:'Manuel',
  shipmentMode:'Depuis l’expédition',
  invoiceMode:'Analyser la facture',
  invoiceHelp:'Téléversez et contrôlez une facture, puis regroupez les données par code SH et pays d’origine.',
  previewOnly:'Vérifiez toujours les données douanières détectées. Aucun code SH ni pays d’origine n’est inventé.',
  chooseFiles:'Sélectionner des fichiers',
  start:'Démarrer l’analyse',
  resumeScan:'Reprendre la vérification',
  scanPendingNote:'Fichier téléversé. Microsoft Defender analyse encore. Sélectionnez « Reprendre la vérification » plus tard.',
  scanDelayedNote:'Fichier téléversé, mais Microsoft Defender n’a pas fourni de résultat d’analyse après plus de 2 minutes. Informatique : vérifiez les balises de résultat sur Azure Storage. Le fichier reste bloqué ; reprenez la vérification plus tard.',
  groups:'Groupes SH/origine',
  documentSingle:'Document',
  documentPlural:'Documents',
  openShort:'ouvertes'
 },
 it:{
  workspaceTitle:'Dichiarazioni di esportazione e fatture',
  tabIntro:'Scegli una sezione – vengono mostrati solo i campi pertinenti.',
  savedMode:'Richieste salvate',
  entryAria:'Seleziona il punto di ingresso ABD',
  manualMode:'Manuale',
  shipmentMode:'Da spedizione',
  invoiceMode:'Analizza fattura',
  invoiceHelp:'Carica e verifica una fattura, quindi raggruppa i dati per codice HS e paese di origine.',
  previewOnly:'Verifica sempre i dati doganali rilevati. I codici HS e i paesi di origine non vengono mai inventati.',
  chooseFiles:'Seleziona file',
  start:'Avvia analisi',
  resumeScan:'Riprendi verifica',
  scanPendingNote:'File caricato. Microsoft Defender sta ancora eseguendo la scansione. Seleziona «Riprendi verifica» più tardi.',
  scanDelayedNote:'File caricato, ma Microsoft Defender non ha fornito un risultato dopo oltre 2 minuti. IT: verificare i tag del risultato della scansione in Azure Storage. Il file resta bloccato; riprendere la verifica più tardi.',
  groups:'Gruppi HS/origine',
  documentSingle:'Documento',
  documentPlural:'Documenti',
  openShort:'aperte'
 }
};
function xtr(key,vars){
 try{var i=w.ExportHUBRC1499I18n;if(i&&typeof i.t==='function'){var value=i.t(key,lang(),vars);if(value&&value!==key)return value}}catch(_){}
 var pack=languageFallback[String(lang()).toLowerCase().slice(0,2)]||languageFallback.de;
 return pack[key]||key
}
function refreshLabelsAfterI18n(){
 // RC1786: never remove an already mounted panel; RC1549's manual editor lives inside it.
 // Remounting here would destroy the editor and the selected native FileList.
 var p=panel();if(!p){schedule();return}
 var intro=p.querySelector('.rc1294-intro');
 if(intro)intro.textContent=xtr('tabIntro');
 var tabs=p.querySelectorAll('[data-rc1294-mode]');
 for(var i=0;i<tabs.length;i++)tabs[i].textContent=xtr(tabs[i].getAttribute('data-rc1294-mode')+'Mode');
 var invoice=p.querySelector('[data-rc1294-invoice-panel]');
 if(invoice){
  var title=invoice.querySelector('h4'),help=invoice.querySelector('p'),note=invoice.querySelector('.rc1294-note'),label=invoice.querySelector('.rc1294-file span'),start=invoice.querySelector('[data-rc1294-start]');
  if(title)title.textContent=xtr('invoiceMode');
  if(help)help.textContent=xtr('invoiceHelp');
  if(note)note.textContent=xtr('previewOnly');
  if(label)label.textContent=xtr('chooseFiles');
  if(start)start.textContent=hasPendingUploads()?xtr('resumeScan'):xtr('start')
 }
 var host=d.getElementById('rc626Abd'),heading=host&&host.querySelector('.rc626-head h2');
 if(heading)heading.textContent=xtr('workspaceTitle')
}
function ensureFeatureI18n(){
 try{if(w.ExportHUBRC1499I18n&&typeof w.ExportHUBRC1499I18n.t==='function')return true}catch(_){}
 var existing=d.getElementById('exporthub-rc1499-i18n');
 if(existing){
  if(!existing.__rc1786LoadObserved){
   existing.__rc1786LoadObserved=true;
   existing.addEventListener('load',refreshLabelsAfterI18n,{once:true})
  }
  return true
 }
 try{
  var s=d.createElement('script');s.id='exporthub-rc1499-i18n';s.src='/assets/i18n/rc1499-exportexperte.js?v=1786';s.defer=true;
  s.addEventListener('load',refreshLabelsAfterI18n,{once:true});
  s.addEventListener('error',function(){try{s.remove()}catch(_){}},{once:true});
  (d.head||d.documentElement).appendChild(s)
 }catch(_){}
 // Translation errors must not prevent the invoice file picker from mounting.
 return true
}
function authToken(){
 // RC1787: use the same active ExportHUB tab session as the shipment/ABD APIs.
 // Never pick an unrelated token from an arbitrary JSON value in sessionStorage.
 try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},t=q(rt.authToken||rt.token||rt.sessionToken);if(t)return t}catch(_){}
 try{
  var raw=w.sessionStorage&&w.sessionStorage.getItem('exporthub_rc301_tab_session');
  if(!raw)return'';
  var session=JSON.parse(raw),token=q(session&&session.token);
  if(!token||!session.user)return'';
  var source=q(session.environment||session.dataEnvironment).toLowerCase();
  return !source||source===environment()?token:''
 }catch(_){return''}
}
function environment(){try{return /-testservice\./i.test(String(w.location&&w.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
function headers(){
 var token=authToken();if(!token)throw new Error(tr('errors.unauthorized',null,'Keine Berechtigung für diese Aktion.'));
 return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':environment(),'X-ExportHUB-Language':lang()}
}
async function post(payload){
 var res=await w.fetch('/api/abd-analysis',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify(payload)}),raw=await res.text(),data={};
 var parsed=true;try{data=raw?JSON.parse(raw):{}}catch(_){parsed=false;data={message:raw}}
 // RC1626: a 2xx without a JSON body is a platform error, not a missing upload id.
 if(res.ok&&(!parsed||!raw)){var bad=new Error('HTTP '+res.status+' ohne gültige API-Antwort ('+q(res.headers&&res.headers.get&&res.headers.get('content-type'))+'): '+q(raw).slice(0,120));bad.code='ABD_ANALYSIS_INVALID_RESPONSE';throw bad}
 if(!res.ok&&(res.status===404||res.status===405)){
  var missing=new Error('Der Datei-Upload-Dienst ist auf diesem ExportHUB-Server nicht verfügbar (HTTP '+res.status+'). Die veröffentlichte Version muss geprüft werden.');
  missing.code='ABD_UPLOAD_ROUTE_UNAVAILABLE';throw missing
 }
 if(!res.ok&&res.status!==202){var e=new Error(q(data.message)||('HTTP '+res.status));e.code=q(data.code);throw e}
 return{status:res.status,data:data}
}
async function base64(file){
 var bytes=new Uint8Array(await file.arrayBuffer()),parts=[],size=0x8000;
 for(var i=0;i<bytes.length;i+=size)parts.push(String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+size,bytes.length))));
 return btoa(parts.join(''))
}
function delay(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function panel(){return d.getElementById('rc1294AbdAnalysis')}
function statusBox(){var p=panel();return p&&p.querySelector('[data-rc1294-status]')}
function resultBox(){var p=panel();return p&&p.querySelector('[data-rc1294-results]')}
function setStatus(message,kind){
 var box=statusBox();if(!box)return;box.hidden=false;box.textContent=q(message);box.setAttribute('data-kind',kind||'info')
}
function fileLine(name,message,kind){
 var box=statusBox();if(!box)return;
 // one row per file: later steps (scanning, result) update the existing row instead of adding another
 var row=Array.prototype.find.call(box.querySelectorAll('.rc1294-file-status'),function(r){return r.getAttribute('data-file')===String(name)});
 var strong=row&&row.querySelector('strong'),span=row&&row.querySelector('span');
 if(!row){
  row=d.createElement('div');row.className='rc1294-file-status';row.setAttribute('data-file',String(name));
  strong=d.createElement('strong');span=d.createElement('span');row.appendChild(strong);row.appendChild(span);box.appendChild(row)
 }
 row.setAttribute('data-kind',kind||'info');
 if(strong)strong.textContent=name;if(span)span.textContent=message
}
function clearStatus(){var box=statusBox();if(box){box.innerHTML='';box.hidden=true}}
function formatNumber(value,digits){
 if(value==null||value==='')return'';
 try{return new Intl.NumberFormat(lang()==='de'?'de-DE':undefined,{maximumFractionDigits:digits==null?3:digits}).format(Number(value))}catch(_){return q(value)}
}
function fieldLabel(key){
 var map={
  description:tr('common.description'),
  commodityCode:tr('abd.analysis.hs'),
  originCountry:tr('abd.analysis.origin'),
  weight:tr('shipment.weight'),
  value:tr('abd.analysis.value')
 };return map[key]||key
}
function rowsHtml(positions){
 return positions.map(function(p){
  var missing=(p.missing||[]).map(fieldLabel),reviewRequired=missing.length>0||p.confirmed===false,state=reviewRequired?tr('abd.analysis.review'):tr('abd.analysis.complete');
  return '<tr data-rc1294-position="'+esc(p.position)+'">'+
   '<td>'+esc(p.position)+'</td><td>'+esc(p.itemNumber)+'</td><td class="rc1294-desc">'+esc(p.description)+'</td>'+
   '<td><b>'+esc(p.commodityCode)+'</b></td><td>'+esc(p.originCountry)+'</td><td>'+esc(formatNumber(p.quantity,3))+'</td>'+
   '<td>'+esc(formatNumber(p.netMassKg,3))+'</td><td>'+esc(formatNumber(p.grossMassKg,3))+'</td>'+
   '<td>'+esc(formatNumber(p.value,2))+'</td><td>'+esc(p.currency)+'</td><td>'+esc((p.supplementaryCodes||[]).join(', '))+'</td>'+
   '<td>'+esc(p.source)+'</td><td><span class="rc1294-state '+(reviewRequired?'review':'ok')+'">'+esc(state)+'</span>'+(missing.length?'<small>'+esc(tr('abd.analysis.missing',{fields:missing.join(', ')}))+'</small>':'')+'</td></tr>'
 }).join('')
}
function copyFieldButtons(group){
 var hs=q(group&&group.commodityCode),origin=q(group&&group.originCountry),value=group&&group.value!=null?formatNumber(group.value,2):'',currency=q(group&&group.currency)||'VAL';
 return '<div class="rc1294-copy-actions">'+
  (hs?'<button type="button" class="ghost" data-rc1294-copy-value="'+esc(hs)+'" title="'+esc(xtr('copyHs'))+'">HS</button>':'')+
  (origin?'<button type="button" class="ghost" data-rc1294-copy-value="'+esc(origin)+'" title="'+esc(xtr('copyOrigin'))+'">COO</button>':'')+
  (value?'<button type="button" class="ghost" data-rc1294-copy-value="'+esc(value)+'" title="'+esc(xtr('copyValue'))+'">'+esc(currency)+'</button>':'')+
  '</div>'
}
function groupRowsHtml(groups){
 return (groups||[]).map(function(group){
  var state=group.status==='complete'?xtr('statusDetected'):xtr('statusReview'),warnings=(group.warnings||[]).join(', ');
  return '<tr data-rc1294-group="'+esc(group.key)+'"><td><b>'+esc(group.commodityCode)+'</b></td><td>'+esc(group.originCountry)+'</td><td>'+esc(formatNumber(group.value,2))+'</td><td>'+esc(group.currency)+'</td><td>'+esc(group.positionCount)+'</td><td><span class="rc1294-state '+(group.status==='complete'?'ok':'review')+'">'+esc(state)+'</span>'+(warnings?'<small>'+esc(warnings)+'</small>':'')+'</td><td>'+copyFieldButtons(group)+'</td></tr>'
 }).join('')
}
function positionIdentity(position){return[q(position&&position.source),q(position&&position.sourceRow),q(position&&position.position)].join('|')}
function positionIndexFor(allPositions,position){
 var list=Array.isArray(allPositions)?allPositions:[],key=positionIdentity(position);
 for(var i=0;i<list.length;i++)if(positionIdentity(list[i])===key)return i;
 return-1
}
function reviewInput(attribute,label,value,resultIndex,positionIndex,inputMode){
 if(positionIndex<0)return esc(value);
 return '<input class="rc1499-review-input" '+attribute+' data-result-index="'+resultIndex+'" data-position-index="'+positionIndex+'" value="'+esc(value)+'" aria-label="'+esc(label)+'"'+(inputMode?' inputmode="'+esc(inputMode)+'"':'')+'>'
}
function unassignedRowsHtml(positions,resultIndex,allPositions){
 return (positions||[]).map(function(p){
  var missing=(p.missing||[]).map(fieldLabel),status=missing.length?xtr('statusMissing'):xtr('statusReview'),positionIndex=positionIndexFor(allPositions,p),confirm=p.confirmed===false&&positionIndex>=0?'<button type="button" class="ghost" data-rc1499-confirm data-result-index="'+resultIndex+'" data-position-index="'+positionIndex+'">'+esc(tr('common.confirm'))+'</button>':'';
  return '<tr><td>'+esc(p.position)+'</td><td class="rc1294-desc">'+esc(p.description)+'</td><td>'+reviewInput('data-rc1499-edit-hs',tr('abd.analysis.hs'),p.commodityCode,resultIndex,positionIndex,'numeric')+'</td><td>'+reviewInput('data-rc1499-edit-origin',tr('abd.analysis.origin'),p.originCountry,resultIndex,positionIndex,'text')+'</td><td>'+reviewInput('data-rc1499-edit-value',tr('abd.analysis.value'),p.value==null?'':p.value,resultIndex,positionIndex,'decimal')+'</td><td>'+esc(p.currency)+'</td><td><span class="rc1294-state review">'+esc(status)+'</span>'+(missing.length?'<small>'+esc(missing.join(', '))+'</small>':'')+confirm+'</td></tr>'
 }).join('')
}
function metaItem(label,value){return q(value)?'<div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>':''}
function headerHtml(header){
 header=header&&typeof header==='object'?header:{};
 var html=metaItem(xtr('invoiceNumber'),header.invoiceNumber)+metaItem(xtr('invoiceDate'),header.invoiceDate)+metaItem(xtr('customer'),header.customer)+metaItem(xtr('recipient'),header.recipient)+metaItem(xtr('destinationCountry'),header.destinationCountry)+metaItem(xtr('invoiceTotal'),header.invoiceTotal==null?'':formatNumber(header.invoiceTotal,2)+' '+q(header.currency));
 return html?'<div class="rc1294-meta">'+html+'</div>':'<div class="rc1294-empty">'+esc(xtr('headerMissing'))+'</div>'
}
function metric(label,value,currency,kind){
 var display=value==null?'—':formatNumber(value,2)+(currency?' '+currency:'');
 return '<div class="rc1294-metric'+(kind?' '+kind:'')+'"><span>'+esc(label)+'</span><strong>'+esc(display)+'</strong></div>'
}
function documentHtml(result,index){
 var analysis=result&&result.analysis||{},groups=Array.isArray(analysis.groups)?analysis.groups:[],unassigned=Array.isArray(analysis.unassigned)?analysis.unassigned:[],positions=Array.isArray(analysis.positions)?analysis.positions:[],totals=analysis.totals||{},review=analysis.review||{},header=analysis.header||{},currency=q(totals.currency||header.currency),fileName=q(analysis.fileName)||(tr('document.title')+' '+(index+1));
 var grouped=groups.length?'<div class="rc1294-table-wrap"><table class="rc1294-table rc1294-group-table"><thead><tr><th>'+esc(tr('abd.analysis.hs'))+'</th><th>'+esc(tr('abd.analysis.origin'))+'</th><th>'+esc(tr('abd.analysis.value'))+'</th><th>'+esc(tr('abd.analysis.currency'))+'</th><th>'+esc(xtr('positions'))+'</th><th>'+esc(tr('common.status'))+'</th><th>'+esc(tr('common.actions'))+'</th></tr></thead><tbody>'+groupRowsHtml(groups)+'</tbody></table></div>':'<div class="rc1294-empty">'+esc(xtr('noGroups'))+'</div>';
 var pending=unassigned.length?'<div class="rc1294-unassigned"><h5>'+esc(xtr('unassigned'))+' · '+unassigned.length+'</h5><div class="rc1294-table-wrap"><table class="rc1294-table rc1294-unassigned-table"><thead><tr><th>'+esc(tr('abd.analysis.position'))+'</th><th>'+esc(tr('common.description'))+'</th><th>'+esc(tr('abd.analysis.hs'))+'</th><th>'+esc(tr('abd.analysis.origin'))+'</th><th>'+esc(tr('abd.analysis.value'))+'</th><th>'+esc(tr('abd.analysis.currency'))+'</th><th>'+esc(tr('common.status'))+'</th></tr></thead><tbody>'+unassignedRowsHtml(unassigned,index,positions)+'</tbody></table></div></div>':'';
 var details=positions.length?'<details class="rc1294-details"><summary>'+esc(xtr('originalPositions'))+' · '+positions.length+'</summary><div class="rc1294-table-wrap"><table class="rc1294-table"><thead><tr><th>'+esc(tr('abd.analysis.position'))+'</th><th>'+esc(tr('abd.analysis.item'))+'</th><th>'+esc(tr('common.description'))+'</th><th>'+esc(tr('abd.analysis.hs'))+'</th><th>'+esc(tr('abd.analysis.origin'))+'</th><th>'+esc(tr('abd.analysis.quantity'))+'</th><th>'+esc(tr('abd.analysis.net'))+'</th><th>'+esc(tr('abd.analysis.gross'))+'</th><th>'+esc(tr('abd.analysis.value'))+'</th><th>'+esc(tr('abd.analysis.currency'))+'</th><th>'+esc(tr('abd.analysis.codes'))+'</th><th>'+esc(tr('abd.analysis.source'))+'</th><th>'+esc(tr('common.status'))+'</th></tr></thead><tbody>'+rowsHtml(positions)+'</tbody></table></div></details>':'';
 var state=review.complete?'<span class="rc1294-state ok">'+esc(tr('abd.analysis.complete'))+'</span>':'<span class="rc1294-state review">'+esc(tr('abd.analysis.review'))+'</span>';
 return '<section class="rc1294-document"><div class="rc1294-document-head"><div><small>'+esc(xtr('sourceFile'))+'</small><h4>'+esc(fileName)+'</h4></div>'+state+'</div>'+headerHtml(header)+'<div class="rc1294-metrics">'+metric(xtr('groups'),review.groupCount==null?groups.length:review.groupCount,'','')+metric(xtr('unassigned'),review.unassignedCount==null?unassigned.length:review.unassignedCount,'',unassigned.length?'warn':'')+metric(xtr('invoiceTotal'),totals.invoiceTotal,currency,'')+metric(xtr('accountedTotal'),totals.accountedTotal,currency,'')+metric(xtr('difference'),totals.difference,currency,totals.difference===0?'ok':(totals.difference==null?'':'warn'))+'</div><h5>'+esc(xtr('groupedTitle'))+'</h5>'+grouped+pending+details+'</section>'
}
function renderResults(results){
 lastResults=results||[];lastPositions=[];lastGroups=[];lastUnassigned=[];
 lastResults.forEach(function(r){
  var analysis=r&&r.analysis||{};
  (analysis.positions||[]).forEach(function(p){lastPositions.push(Object.assign({},p,{sourceFile:analysis.fileName||p.source||''}))});
  (analysis.groups||[]).forEach(function(group){lastGroups.push(Object.assign({},group,{sourceFile:analysis.fileName||''}))});
  (analysis.unassigned||[]).forEach(function(p){lastUnassigned.push(Object.assign({},p,{sourceFile:analysis.fileName||p.source||''}))})
 });
 var box=resultBox();if(!box)return;
 var summary=lastResults.length+' '+(lastResults.length===1?xtr('documentSingle'):xtr('documentPlural'))+' · '+lastGroups.length+' '+xtr('groups')+' · '+lastUnassigned.length+' '+xtr('openShort');
 box.innerHTML='<div class="rc1294-result-head"><strong>'+esc(summary)+'</strong>'+(lastGroups.length?'<button type="button" class="ghost" data-rc1294-copy>'+esc(xtr('customsPortalData'))+'</button>':'')+'</div>'+lastResults.map(documentHtml).join('');
 box.hidden=false
}
async function poll(upload,fileName){
 var delayed=false;
 for(var i=0;i<45;i++){
  var result=await post({action:'status',uploadId:upload.id});
  if(result.data&&result.data.status==='ready')return result.data;
  if(result.data&&result.data.status==='blocked'){var blocked=new Error(q(result.data.message)||'Datei blockiert');blocked.code=q(result.data.code);throw blocked}
  if(result.data&&result.data.diagnosticCode==='ABD_DEFENDER_RESULT_DELAYED'){
   delayed=true;
   fileLine(fileName,xtr('scanDelayedNote'),'scan')
  }else if(i===0)fileLine(fileName,tr('abd.analysis.scanning'),'scan');
  await delay(1800)
 }
 var e=new Error(delayed?xtr('scanDelayedNote'):tr('abd.analysis.waiting'));e.code='ABD_SCAN_PENDING';e.scanDelayed=delayed;throw e
}
async function analyzeFile(file){
 // RC1792: a pending Defender scan is not an upload failure; preserve its
 // upload ID for the same File object instead of triggering a new BlobCreated.
 var upload=pendingUploads.get(file);
 if(!upload){
  var uploaded=await post({action:'upload',file:{name:file.name,type:file.type||'',base64:await base64(file)}});
  upload=uploaded.data&&uploaded.data.upload;
  if(!upload||!upload.id)throw new Error('Upload-ID fehlt');
  pendingUploads.set(file,upload)
 }
 try{
  var result=await poll(upload,file.name);
  pendingUploads.delete(file);
  return result
 }catch(e){
  // Terminal scan results/expired blobs cannot be resumed; keep all other
  // states resumable, including Defender delays and transient network errors.
  if(e&&['ABD_MALWARE_DETECTED','ABD_SCAN_FAILED','ABD_UPLOAD_EXPIRED','ABD_UPLOAD_ID_INVALID'].indexOf(e.code)>=0)pendingUploads.delete(file);
  throw e
 }
}
async function start(){
 if(busy)return false;var p=panel(),input=p&&p.querySelector('[data-rc1294-files]'),button=p&&p.querySelector('[data-rc1294-start]'),files=Array.from(input&&input.files||[]);
 if(!files.length&&pendingFiles.length)files=pendingFiles.slice();
 clearStatus();var out=resultBox();if(out){out.hidden=true;out.innerHTML=''}
 if(!files.length){setStatus(tr('abd.analysis.fileRequired'),'bad');return false}
 if(files.length>5){setStatus(tr('abd.analysis.fileLimit'),'bad');return false}
 pendingFiles=files.slice();
 busy=true;if(button)button.disabled=true;lastPositions=[];lastResults=[];lastGroups=[];lastUnassigned=[];
 try{
  var results=[];
  for(var i=0;i<files.length;i++){
   fileLine(files[i].name,tr('abd.analysis.waiting'),'info');
   try{
    var result=await analyzeFile(files[i]),analysis=result&&result.analysis||{},documents=Array.isArray(analysis.deliveryDocuments)?analysis.deliveryDocuments:[];
    if(documents.length){documents.forEach(function(doc){results.push({ok:true,status:'ready',analysis:doc})});fileLine(files[i].name,documents.length+' getrennte Lieferscheine / '+(analysis.positions||[]).length+' Positionen','ok')}
    else{results.push(result);fileLine(files[i].name,(analysis.positions||[]).length+' Position(en)','ok')}
   }catch(e){
    if(e&&e.code==='ABD_SCAN_PENDING')fileLine(files[i].name,xtr(e.scanDelayed?'scanDelayedNote':'scanPendingNote'),'scan');
    else fileLine(files[i].name,q(e&&e.message)||tr('errors.generic'),'bad')
   }
  }
  renderResults(results);
  return results.length>0
 }catch(e){setStatus(tr('abd.analysis.error',{message:q(e&&e.message)}),'bad');return false}
 finally{busy=false;if(button){button.disabled=false;button.textContent=hasPendingUploads()?xtr('resumeScan'):xtr('start')}}
}
async function reanalyzeDocument(resultIndex,positions){
 resultIndex=Number(resultIndex);if(!Number.isInteger(resultIndex)||resultIndex<0||resultIndex>=lastResults.length||reviewBusy[resultIndex])return false;
 var current=lastResults[resultIndex],old=current&&current.analysis||{};reviewBusy[resultIndex]=true;setStatus(tr('abd.analysis.waiting'),'info');
 try{
  var response=await post({action:'reanalyze',header:old.header||{},positions:positions}),next=response.data&&response.data.analysis;
  if(!next)throw new Error('ABD_REANALYZE_EMPTY');
  next=Object.assign({},old,next,{fileName:old.fileName,fileType:old.fileType,documentCodes:old.documentCodes,extraction:old.extraction,ocr:old.ocr,requiresReview:!next.review||!next.review.complete});
  lastResults[resultIndex]=Object.assign({},current,{analysis:next});renderResults(lastResults);clearStatus();return true
 }catch(e){setStatus(q(e&&e.message)||tr('errors.generic'),'bad');return false}
 finally{delete reviewBusy[resultIndex]}
}
function correctedPositions(resultIndex,positionIndex,field,value,confirm){
 var result=lastResults[resultIndex],analysis=result&&result.analysis||{},source=Array.isArray(analysis.positions)?analysis.positions:[];
 if(positionIndex<0||positionIndex>=source.length)return null;
 var positions=source.map(function(position){return Object.assign({},position)}),target=positions[positionIndex];
 if(field)target[field]=value;
 if(confirm===true)target.confirmed=true;
 return positions
}
function applyReviewEdit(control){
 var resultIndex=Number(control&&control.getAttribute('data-result-index')),positionIndex=Number(control&&control.getAttribute('data-position-index')),field='';
 if(control&&control.hasAttribute('data-rc1499-edit-hs'))field='commodityCode';
 else if(control&&control.hasAttribute('data-rc1499-edit-origin'))field='originCountry';
 else if(control&&control.hasAttribute('data-rc1499-edit-value'))field='value';
 if(!field)return false;
 var positions=correctedPositions(resultIndex,positionIndex,field,control.value,false);return positions?reanalyzeDocument(resultIndex,positions):false
}
function confirmReviewPosition(button){
 var resultIndex=Number(button&&button.getAttribute('data-result-index')),positionIndex=Number(button&&button.getAttribute('data-position-index')),positions=correctedPositions(resultIndex,positionIndex,'','',true);
 return positions?reanalyzeDocument(resultIndex,positions):false
}
function writeClipboard(raw,message){
 if(w.navigator&&w.navigator.clipboard&&w.navigator.clipboard.writeText)w.navigator.clipboard.writeText(raw).then(function(){setStatus(message,'ok')}).catch(function(){fallbackCopy(raw,message)});
 else fallbackCopy(raw,message)
}
function copyGroupedResults(){
 if(!lastGroups.length)return false;
 var header=[tr('abd.analysis.hs'),tr('abd.analysis.origin'),tr('abd.analysis.value'),tr('abd.analysis.currency'),xtr('positions'),tr('abd.analysis.source')];
 var lines=[header.join('\t')].concat(lastGroups.map(function(group){return[group.commodityCode,group.originCountry,group.value==null?'':group.value,group.currency,group.positionCount,group.sourceFile].map(function(v){return q(v).replace(/[\t\r\n]+/g,' ')}).join('\t')})),raw=lines.join('\n');
 writeClipboard(raw,xtr('copiedGrouped'));return false
}
function copyField(value){value=q(value);if(!value)return false;writeClipboard(value,xtr('copiedField'));return false}
function copyResults(){return copyGroupedResults()}
function snapshot(index){
 index=Number(index);if(!Number.isInteger(index)||index<0||index>=lastResults.length)return null;
 var analysis=lastResults[index]&&lastResults[index].analysis||{};
 try{return JSON.parse(JSON.stringify({header:analysis.header||{},positions:Array.isArray(analysis.positions)?analysis.positions:[],groups:Array.isArray(analysis.groups)?analysis.groups:[],unassigned:Array.isArray(analysis.unassigned)?analysis.unassigned:[],totals:analysis.totals||{},review:analysis.review||{}}))}catch(_){return null}
}
function fallbackCopy(raw,message){
 var ta=d.createElement('textarea');ta.value=raw;ta.style.position='fixed';ta.style.left='-9999px';d.body.appendChild(ta);ta.select();try{d.execCommand('copy');setStatus(message||xtr('copiedGrouped'),'ok')}catch(_){}ta.remove()
}
/* RC1761: one focused workspace per tab. Existing RC626 controls stay mounted,
   preserving draft state, uploads and event handlers. */
function setMode(mode,skipShipmentPrefill){
 mode=q(mode)||'manual';
 if(['manual','shipment','invoice','saved'].indexOf(mode)<0)mode='manual';
 currentMode=mode;
 var host=d.getElementById('rc626Abd'),p=panel();
 if(host){
  host.setAttribute('data-rc1294-mode',mode);
  var header=host.querySelector('.rc626-head h2');
  if(header)header.textContent=xtr('workspaceTitle');
  // New ABD belongs to the creation workspace, not invoice analysis or history.
  var createButton=host.querySelector('.rc626-head > button[onclick*="newAbd"]');
  if(createButton)createButton.hidden=mode==='invoice'||mode==='saved';
  var form=host.querySelector(':scope > .rc626-grid2');
  if(form){form.id='rc1294AbdForm';form.setAttribute('role','tabpanel');form.hidden=mode==='invoice'||mode==='saved'}
  var history=host.querySelector('.rc1760-abd-history');
  if(history){history.id='rc1294SavedRequests';history.setAttribute('role','tabpanel');history.hidden=mode!=='saved'}
 }
 if(p){
  var invoice=p.querySelector('[data-rc1294-invoice-panel]'),buttons=p.querySelectorAll('[data-rc1294-mode]');
  if(invoice){invoice.setAttribute('role','tabpanel');invoice.hidden=mode!=='invoice'}
  for(var i=0;i<buttons.length;i++){
   var active=buttons[i].getAttribute('data-rc1294-mode')===mode;
   buttons[i].setAttribute('aria-pressed',active?'true':'false');
   buttons[i].setAttribute('aria-selected',active?'true':'false');
   buttons[i].setAttribute('tabindex',active?'0':'-1');
   buttons[i].classList.toggle('active',active)
  }
 }
 if(mode==='shipment'){
  // Only a user-initiated switch calls the existing shipment prefill.
  if(!skipShipmentPrefill){
   try{
    if(w.ExportHUBRC626&&typeof w.ExportHUBRC626.openAbd==='function')w.ExportHUBRC626.openAbd(true);
    else setStatus(xtr('shipmentUnavailable'),'bad')
   }catch(e){setStatus(q(e&&e.message)||tr('errors.generic'),'bad')}
  }
 }
 return false
}
function ensureStyle(){
 if(d.getElementById('rc1294AbdStyle'))return;
 var s=d.createElement('style');s.id='rc1294AbdStyle';s.textContent=
 '.rc1294-abd{margin:14px 0 18px;border:1px solid #bfdbfe;border-left:5px solid #2563eb;background:#eff6ff;border-radius:14px;padding:16px;color:#0f172a}.rc1294-abd h3{margin:0 0 6px}.rc1294-router{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.rc1294-router button{min-height:40px;padding:9px 13px;border-radius:10px;border:1px solid #93c5fd;background:#fff;color:#1e3a8a;font-weight:800;cursor:pointer}.rc1294-router button.active,.rc1294-router button[aria-pressed="true"]{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.rc1294-invoice-panel{margin-top:14px;padding-top:14px;border-top:1px solid #bfdbfe}.rc1294-note{margin:10px 0;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;font-weight:650}.rc1294-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.rc1294-file{display:inline-flex;align-items:center;min-height:40px;padding:8px 12px;border:1px dashed #60a5fa;border-radius:10px;background:#fff;font-weight:750;cursor:pointer}.rc1294-file input{max-width:360px}.rc1294-status{display:grid;gap:6px;margin-top:12px}.rc1294-file-status{display:flex;gap:10px;justify-content:space-between;padding:8px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:9px;font-size:13px}.rc1294-file-status[data-kind="ok"]{border-color:#86efac;background:#f0fdf4}.rc1294-file-status[data-kind="bad"]{border-color:#fca5a5;background:#fef2f2;color:#991b1b}.rc1294-file-status[data-kind="scan"]{border-color:#93c5fd;background:#eff6ff}.rc1294-results{margin-top:14px;padding-top:12px;border-top:1px solid #bfdbfe}.rc1294-result-head,.rc1294-document-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.rc1294-document{margin-top:14px;padding:14px;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff}.rc1294-document h4,.rc1294-document h5{margin:0}.rc1294-document h5{margin-top:14px}.rc1294-document-head small{display:block;color:#64748b}.rc1294-meta,.rc1294-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px}.rc1294-meta>div,.rc1294-metric{display:grid;gap:3px;padding:9px 10px;border:1px solid #dbeafe;border-radius:9px;background:#fff}.rc1294-meta span,.rc1294-metric span{font-size:11px;color:#64748b}.rc1294-metric.ok{border-color:#86efac;background:#f0fdf4}.rc1294-metric.warn{border-color:#fdba74;background:#fff7ed}.rc1294-table-wrap{overflow:auto;margin-top:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.rc1294-table{border-collapse:collapse;width:100%;min-width:1280px;font-size:12px}.rc1294-group-table{min-width:880px}.rc1294-unassigned-table{min-width:980px}.rc1294-table th,.rc1294-table td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.rc1294-table th{position:sticky;top:0;background:#f8fafc;z-index:1}.rc1294-desc{min-width:220px}.rc1294-state{display:inline-block;padding:3px 7px;border-radius:999px;font-weight:800}.rc1294-state.ok{background:#dcfce7;color:#166534}.rc1294-state.review{background:#ffedd5;color:#9a3412}.rc1294-table small{display:block;margin-top:4px;color:#9a3412}.rc1294-codes,.rc1294-empty{margin-top:10px;padding:9px 11px;background:#fff;border:1px solid #cbd5e1;border-radius:9px}.rc1294-unassigned{margin-top:14px}.rc1294-details{margin-top:14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:10px}.rc1294-details>summary{cursor:pointer;font-weight:800}.rc1294-copy-actions{display:flex;gap:4px;flex-wrap:wrap}.rc1294-copy-actions button{min-width:40px;padding:5px 7px}.rc1499-review-input{box-sizing:border-box;width:100%;min-width:100px;padding:7px 8px;border:1px solid #94a3b8;border-radius:7px;background:#fff;color:#0f172a}@media(max-width:700px){.rc1294-abd{padding:12px}.rc1294-router button,.rc1294-controls>*{width:100%}.rc1294-file{box-sizing:border-box}.rc1294-file input{width:100%;max-width:none}.rc1294-meta,.rc1294-metrics{grid-template-columns:1fr 1fr}}@media(max-width:460px){.rc1294-meta,.rc1294-metrics{grid-template-columns:1fr}}';
 s.textContent+='.rc1294-intro{margin:0 0 10px;color:#475569;font-size:13px}.rc1294-router{margin-top:0}.rc1294-router button[role="tab"]{font-size:13px!important}.rc1294-router button[role="tab"]:focus-visible{outline:3px solid #2563eb;outline-offset:2px}.rc1294-abd{padding:12px 16px}.rc1294-invoice-panel[hidden]{display:none!important}';
 (d.head||d.documentElement).appendChild(s)
}
function mount(){
 var host=d.getElementById('rc626Abd');if(!host)return false;
 var old=d.getElementById('rc1294AbdAnalysis');if(old)return true;
 ensureFeatureI18n();
 ensureStyle();
 var p=d.createElement('section');p.id='rc1294AbdAnalysis';p.className='rc1294-abd';p.setAttribute('data-rc1294-abd-analysis','1');
 p.innerHTML='<p class="rc1294-intro">'+esc(xtr('tabIntro'))+'</p>'+
  '<div class="rc1294-router" role="tablist" aria-label="'+esc(xtr('entryAria'))+'">'+
   '<button type="button" role="tab" data-rc1294-mode="manual" aria-selected="true" aria-pressed="true" aria-controls="rc1294AbdForm">'+esc(xtr('manualMode'))+'</button>'+
   '<button type="button" role="tab" data-rc1294-mode="shipment" aria-selected="false" aria-pressed="false" aria-controls="rc1294AbdForm">'+esc(xtr('shipmentMode'))+'</button>'+
   '<button type="button" role="tab" data-rc1294-mode="invoice" aria-selected="false" aria-pressed="false" aria-controls="rc1294InvoicePanel">'+esc(xtr('invoiceMode'))+'</button>'+
   '<button type="button" role="tab" data-rc1294-mode="saved" aria-selected="false" aria-pressed="false" aria-controls="rc1294SavedRequests">'+esc(xtr('savedMode'))+'</button></div>'+
  '<div id="rc1294InvoicePanel" class="rc1294-invoice-panel" data-rc1294-invoice-panel hidden><h4>'+esc(xtr('invoiceMode'))+'</h4>'+
   '<p>'+esc(xtr('invoiceHelp'))+'</p>'+
   '<div class="rc1294-note">'+esc(xtr('previewOnly'))+'</div>'+
   '<div class="rc1294-controls"><label class="rc1294-file"><span>'+esc(xtr('chooseFiles'))+'</span><input type="file" multiple data-rc1294-files accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.txt,.tsv,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,text/tab-separated-values"></label>'+
   '<button type="button" class="btn" data-rc1294-start>'+esc(xtr('start'))+'</button></div>'+
   '<div class="rc1294-status" data-rc1294-status hidden></div><div class="rc1294-results" data-rc1294-results hidden></div></div>';
 var head=host.querySelector('.rc626-head');if(head&&head.parentNode)head.parentNode.insertBefore(p,head.nextSibling);else host.insertBefore(p,host.firstChild);
 p.querySelector('[data-rc1294-start]').addEventListener('click',start);
 // The ABD form re-renders #rc626Abd on change/input events from its own fields; the file picker must not trigger that.
 function keepFileEventLocal(e){var f=e.target&&e.target.closest&&e.target.closest('[data-rc1294-files]');if(!f)return false;e.stopPropagation();if(e.type==='change'){pendingFiles=Array.from(f.files||[]);var start=p.querySelector('[data-rc1294-start]');if(start)start.textContent=hasPendingUploads()?xtr('resumeScan'):xtr('start')}return true}
 p.addEventListener('input',keepFileEventLocal);
 p.addEventListener('change',function(e){if(keepFileEventLocal(e))return;var input=e.target&&e.target.closest&&e.target.closest('[data-rc1499-edit-hs],[data-rc1499-edit-origin],[data-rc1499-edit-value]');if(input)applyReviewEdit(input)});
 // Arrow keys move tab focus without unexpectedly importing shipment data.
 // Enter/Space (native button activation) applies the focused workspace.
 p.addEventListener('keydown',function(e){
  var key=e.key;
  if(key!=='ArrowRight'&&key!=='ArrowLeft'&&key!=='Home'&&key!=='End')return;
  var active=e.target&&e.target.closest&&e.target.closest('[data-rc1294-mode]');
  if(!active)return;
  var tabs=Array.prototype.slice.call(p.querySelectorAll('[data-rc1294-mode]'));
  var index=tabs.indexOf(active);if(index<0||!tabs.length)return;
  var next=key==='Home'?0:key==='End'?tabs.length-1:(index+(key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  e.preventDefault();
  active.setAttribute('tabindex','-1');
  tabs[next].setAttribute('tabindex','0');
  tabs[next].focus()
 });
 p.addEventListener('click',function(e){
  var mode=e.target&&e.target.closest&&e.target.closest('[data-rc1294-mode]');if(mode){e.preventDefault();setMode(mode.getAttribute('data-rc1294-mode'));return}
  var confirm=e.target&&e.target.closest&&e.target.closest('[data-rc1499-confirm]');if(confirm){e.preventDefault();confirmReviewPosition(confirm);return}
  var field=e.target&&e.target.closest&&e.target.closest('[data-rc1294-copy-value]');if(field){e.preventDefault();copyField(field.getAttribute('data-rc1294-copy-value'));return}
  var b=e.target&&e.target.closest&&e.target.closest('[data-rc1294-copy]');if(b){e.preventDefault();copyGroupedResults()}
 });
 // Mode is reapplied after RC626 replaces #rc626Abd, without re-running the shipment prefill.
 setMode(currentMode,true);
 if(currentMode==='invoice'&&pendingFiles.length){
  // The native file input is empty after a re-render; keep the selected documents in memory.
  setStatus(pendingFiles.map(function(f){return q(f&&f.name)}).filter(Boolean).join(', '),'scan');
 }
 // New/edit actions are still handled by RC626. Switch to the manual tab before its re-render.
 host.addEventListener('click',function(e){
  var control=e.target&&e.target.closest&&e.target.closest('[onclick]');
  var action=control&&q(control.getAttribute('onclick'));
  if(/ExportHUBRC626\.(?:newAbd|editAbd)\s*\(/.test(action))setMode('manual',true)
 },true);
 return true
}
function disconnectHostObserver(){if(hostObserver){try{hostObserver.disconnect()}catch(_){}hostObserver=null}hostObserverRoot=null}
function disconnectBootstrapObserver(){if(bootstrapObserver){try{bootstrapObserver.disconnect()}catch(_){}bootstrapObserver=null}bootstrapObserverRoot=null}
function bootstrapRoot(){return d.getElementById('content')||d.body||d.documentElement||null}
function ensureBootstrapObserver(){
 var root=bootstrapRoot();if(!root||!w.MutationObserver)return false;
 if(bootstrapObserver&&bootstrapObserverRoot===root)return true;
 disconnectBootstrapObserver();
 try{
  bootstrapObserver=new w.MutationObserver(function(){if(d.getElementById('rc626Abd')){disconnectBootstrapObserver();schedule()}});
  bootstrapObserver.observe(root,{childList:true,subtree:true});bootstrapObserverRoot=root;return true
 }catch(_){bootstrapObserver=null;bootstrapObserverRoot=null;return false}
}
function syncObserver(){
 var host=d.getElementById('rc626Abd');
 if(!host){disconnectHostObserver();ensureBootstrapObserver();return false}
 disconnectBootstrapObserver();
 if(hostObserver&&hostObserverRoot===host)return true;
 disconnectHostObserver();
 if(!w.MutationObserver)return true;
 try{
  hostObserver=new w.MutationObserver(function(){
   if(!d.getElementById('rc626Abd')){disconnectHostObserver();ensureBootstrapObserver();return}
   if(!panel())schedule()
  });
  hostObserver.observe(host,{childList:true,subtree:true});hostObserverRoot=host
 }catch(_){hostObserver=null;hostObserverRoot=null}
 return true
}
function schedule(){
 if(mountTimer)return true;
 mountTimer=w.setTimeout(function(){mountTimer=0;syncObserver();mount()},0);return true
}
function activate(){if(syncObserver())schedule()}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',activate,{once:true});else activate();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(name){w.addEventListener(name,activate)});
w.addEventListener('exporthub:language-changed',function(){var old=panel();if(old)old.remove();activate()});
w.ExportHUBRC1294ABDAnalysis=Object.freeze({version:'RC1294',mount:mount,start:start,setMode:setMode,copyResults:copyResults,copyGroupedResults:copyGroupedResults,snapshot:snapshot,analyzeFile:analyzeFile});
})(window,document);
