(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1294_ABD_SELF_SERVICE__)return;
w.__EXPORTHUB_RC1294_ABD_SELF_SERVICE__=true;

var busy=false,lastPositions=[],lastResults=[],lastGroups=[],lastUnassigned=[],mountTimer=0,hostObserver=null,hostObserverRoot=null,bootstrapObserver=null,bootstrapObserverRoot=null;
function q(v){return String(v==null?'':v).trim()}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function lang(){try{return w.ExportHUBI18n&&w.ExportHUBI18n.language?w.ExportHUBI18n.language():'de'}catch(_){return'de'}}
function tr(key,vars,fallback){try{var i=w.ExportHUBI18n;if(i&&typeof i.t==='function'){var value=i.t(key,vars,lang());if(value&&value!==key)return value}}catch(_){}return fallback||key}
function authToken(){
 try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},t=q(rt.authToken||rt.sessionToken);if(t)return t}catch(_){}
 try{for(var i=0;w.sessionStorage&&i<w.sessionStorage.length;i++){var raw=w.sessionStorage.getItem(w.sessionStorage.key(i));if(!raw||raw.charAt(0)!=='{')continue;var x=JSON.parse(raw);if(x&&x.token)return q(x.token)}}catch(_){}
 return''
}
function environment(){try{return /-testservice\./i.test(String(w.location&&w.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
function headers(){
 var token=authToken();if(!token)throw new Error(tr('errors.unauthorized',null,'Keine Berechtigung für diese Aktion.'));
 return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':environment(),'X-ExportHUB-Language':lang()}
}
async function post(payload){
 var res=await w.fetch('/api/abd-analysis',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify(payload)}),raw=await res.text(),data={};
 try{data=raw?JSON.parse(raw):{}}catch(_){data={message:raw}}
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
 var row=d.createElement('div');row.className='rc1294-file-status';row.setAttribute('data-kind',kind||'info');
 var strong=d.createElement('strong');strong.textContent=name;var span=d.createElement('span');span.textContent=message;
 row.appendChild(strong);row.appendChild(span);box.appendChild(row)
}
function clearStatus(){var box=statusBox();if(box){box.innerHTML='';box.hidden=true}}
function formatNumber(value,digits){
 if(value==null||value==='')return'';
 try{return new Intl.NumberFormat(lang()==='de'?'de-DE':undefined,{maximumFractionDigits:digits==null?3:digits}).format(Number(value))}catch(_){return q(value)}
}
function fieldLabel(key){
 var map={
  description:tr('common.description',null,'Beschreibung'),
  commodityCode:tr('abd.analysis.hs',null,'HS-/Warennummer'),
  originCountry:tr('abd.analysis.origin',null,'Ursprungsland'),
  weight:tr('shipment.weight',null,'Gewicht'),
  value:tr('abd.analysis.value',null,'Warenwert')
 };return map[key]||key
}
function rowsHtml(positions){
 return positions.map(function(p){
  var missing=(p.missing||[]).map(fieldLabel),state=missing.length?tr('abd.analysis.review',null,'Prüfen'):tr('abd.analysis.complete',null,'Vollständig');
  return '<tr data-rc1294-position="'+esc(p.position)+'">'+
   '<td>'+esc(p.position)+'</td><td>'+esc(p.itemNumber)+'</td><td class="rc1294-desc">'+esc(p.description)+'</td>'+
   '<td><b>'+esc(p.commodityCode)+'</b></td><td>'+esc(p.originCountry)+'</td><td>'+esc(formatNumber(p.quantity,3))+'</td>'+
   '<td>'+esc(formatNumber(p.netMassKg,3))+'</td><td>'+esc(formatNumber(p.grossMassKg,3))+'</td>'+
   '<td>'+esc(formatNumber(p.value,2))+'</td><td>'+esc(p.currency)+'</td><td>'+esc((p.supplementaryCodes||[]).join(', '))+'</td>'+
   '<td>'+esc(p.source)+'</td><td><span class="rc1294-state '+(missing.length?'review':'ok')+'">'+esc(state)+'</span>'+(missing.length?'<small>'+esc(tr('abd.analysis.missing',{fields:missing.join(', ')},'Fehlt: '+missing.join(', ')))+'</small>':'')+'</td></tr>'
 }).join('')
}
function groupRowsHtml(groups){
 return (groups||[]).map(function(group){
  var state=group.status==='complete'?tr('abd.analysis.complete',null,'Vollständig'):tr('abd.analysis.review',null,'Prüfen'),warnings=(group.warnings||[]).join(', ');
  return '<tr data-rc1294-group="'+esc(group.key)+'"><td><b>'+esc(group.commodityCode)+'</b></td><td>'+esc(group.originCountry)+'</td><td>'+esc(formatNumber(group.value,2))+'</td><td>'+esc(group.currency)+'</td><td>'+esc(group.positionCount)+'</td><td><span class="rc1294-state '+(group.status==='complete'?'ok':'review')+'">'+esc(state)+'</span>'+(warnings?'<small>'+esc(warnings)+'</small>':'')+'</td></tr>'
 }).join('')
}
function unassignedRowsHtml(positions){
 return (positions||[]).map(function(p){
  var missing=(p.missing||[]).map(fieldLabel);
  return '<tr><td>'+esc(p.position)+'</td><td class="rc1294-desc">'+esc(p.description)+'</td><td>'+esc(p.commodityCode)+'</td><td>'+esc(p.originCountry)+'</td><td>'+esc(formatNumber(p.value,2))+'</td><td>'+esc(p.currency)+'</td><td>'+esc(missing.join(', ')||tr('abd.analysis.review',null,'Prüfen'))+'</td></tr>'
 }).join('')
}
function metaItem(label,value){return q(value)?'<div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>':''}
function headerHtml(header){
 header=header&&typeof header==='object'?header:{};
 var html=metaItem(tr('abd.analysis.invoiceNumber',null,'Rechnung'),header.invoiceNumber)+metaItem(tr('abd.analysis.invoiceDate',null,'Rechnungsdatum'),header.invoiceDate)+metaItem(tr('abd.analysis.customer',null,'Kunde'),header.customer)+metaItem(tr('abd.analysis.recipient',null,'Empfänger'),header.recipient)+metaItem(tr('abd.analysis.destinationCountry',null,'Empfängerland'),header.destinationCountry)+metaItem(tr('abd.analysis.invoiceTotal',null,'Rechnungswert'),header.invoiceTotal==null?'':formatNumber(header.invoiceTotal,2)+' '+q(header.currency));
 return html?'<div class="rc1294-meta">'+html+'</div>':'<div class="rc1294-empty">'+esc(tr('abd.analysis.headerMissing',null,'Rechnungskopfdaten konnten nicht vollständig erkannt werden.'))+'</div>'
}
function metric(label,value,currency,kind){
 var display=value==null?'—':formatNumber(value,2)+(currency?' '+currency:'');
 return '<div class="rc1294-metric'+(kind?' '+kind:'')+'"><span>'+esc(label)+'</span><strong>'+esc(display)+'</strong></div>'
}
function documentHtml(result,index){
 var analysis=result&&result.analysis||{},groups=Array.isArray(analysis.groups)?analysis.groups:[],unassigned=Array.isArray(analysis.unassigned)?analysis.unassigned:[],positions=Array.isArray(analysis.positions)?analysis.positions:[],totals=analysis.totals||{},review=analysis.review||{},header=analysis.header||{},currency=q(totals.currency||header.currency),fileName=q(analysis.fileName)||('Dokument '+(index+1));
 var grouped=groups.length?'<div class="rc1294-table-wrap"><table class="rc1294-table rc1294-group-table"><thead><tr><th>'+esc(tr('abd.analysis.hs',null,'HS-/Warennummer'))+'</th><th>'+esc(tr('abd.analysis.origin',null,'Ursprungsland'))+'</th><th>'+esc(tr('abd.analysis.value',null,'Warenwert'))+'</th><th>'+esc(tr('abd.analysis.currency',null,'Währung'))+'</th><th>'+esc(tr('abd.analysis.positions',null,'Positionen'))+'</th><th>'+esc(tr('common.status',null,'Status'))+'</th></tr></thead><tbody>'+groupRowsHtml(groups)+'</tbody></table></div>':'<div class="rc1294-empty">'+esc(tr('abd.analysis.noGroups',null,'Noch keine vollständige HS-/Ursprungsgruppe vorhanden.'))+'</div>';
 var pending=unassigned.length?'<div class="rc1294-unassigned"><h5>'+esc(tr('abd.analysis.unassigned',null,'Noch zu prüfen'))+' · '+unassigned.length+'</h5><div class="rc1294-table-wrap"><table class="rc1294-table rc1294-unassigned-table"><thead><tr><th>'+esc(tr('abd.analysis.position',null,'Pos.'))+'</th><th>'+esc(tr('common.description',null,'Beschreibung'))+'</th><th>'+esc(tr('abd.analysis.hs',null,'HS-/Warennummer'))+'</th><th>'+esc(tr('abd.analysis.origin',null,'Ursprungsland'))+'</th><th>'+esc(tr('abd.analysis.value',null,'Warenwert'))+'</th><th>'+esc(tr('abd.analysis.currency',null,'Währung'))+'</th><th>'+esc(tr('common.status',null,'Status'))+'</th></tr></thead><tbody>'+unassignedRowsHtml(unassigned)+'</tbody></table></div></div>':'';
 var details=positions.length?'<details class="rc1294-details"><summary>'+esc(tr('abd.analysis.originalPositions',null,'Originalpositionen anzeigen'))+' · '+positions.length+'</summary><div class="rc1294-table-wrap"><table class="rc1294-table"><thead><tr><th>Pos.</th><th>Artikel</th><th>Beschreibung</th><th>HS</th><th>Ursprung</th><th>Menge</th><th>Eigenmasse kg</th><th>Rohmasse kg</th><th>Warenwert</th><th>Währung</th><th>Codes</th><th>Quelle</th><th>Status</th></tr></thead><tbody>'+rowsHtml(positions)+'</tbody></table></div></details>':'';
 var state=review.complete?'<span class="rc1294-state ok">'+esc(tr('abd.analysis.complete',null,'Vollständig'))+'</span>':'<span class="rc1294-state review">'+esc(tr('abd.analysis.review',null,'Prüfen'))+'</span>';
 return '<section class="rc1294-document"><div class="rc1294-document-head"><div><small>'+esc(tr('abd.analysis.sourceFile',null,'Quelldatei'))+'</small><h4>'+esc(fileName)+'</h4></div>'+state+'</div>'+headerHtml(header)+'<div class="rc1294-metrics">'+metric(tr('abd.analysis.groups',null,'HS/Ursprung-Gruppen'),review.groupCount==null?groups.length:review.groupCount,'','')+metric(tr('abd.analysis.unassigned',null,'Offene Positionen'),review.unassignedCount==null?unassigned.length:review.unassignedCount,'',unassigned.length?'warn':'')+metric(tr('abd.analysis.invoiceTotal',null,'Rechnungswert'),totals.invoiceTotal,currency,'')+metric(tr('abd.analysis.accountedTotal',null,'Kontrollierter Wert'),totals.accountedTotal,currency,'')+metric(tr('abd.analysis.difference',null,'Differenz'),totals.difference,currency,totals.difference===0?'ok':(totals.difference==null?'':'warn'))+'</div><h5>'+esc(tr('abd.analysis.groupedTitle',null,'Gruppierte Daten für die Zollanmeldung'))+'</h5>'+grouped+pending+details+'</section>'
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
 var summary=lastResults.length+' '+(lastResults.length===1?'Dokument':'Dokumente')+' · '+lastGroups.length+' '+tr('abd.analysis.groups',null,'HS/Ursprung-Gruppen')+' · '+lastUnassigned.length+' '+tr('abd.analysis.unassigned',null,'offen');
 box.innerHTML='<div class="rc1294-result-head"><strong>'+esc(summary)+'</strong>'+(lastGroups.length?'<button type="button" class="ghost" data-rc1294-copy>'+esc(tr('abd.analysis.customsPortalData',null,'Daten für Zollportal'))+'</button>':'')+'</div>'+lastResults.map(documentHtml).join('');
 box.hidden=false
}
async function poll(upload,fileName){
 for(var i=0;i<45;i++){
  var result=await post({action:'status',uploadId:upload.id});
  if(result.data&&result.data.status==='ready')return result.data;
  if(result.data&&result.data.status==='blocked'){var blocked=new Error(q(result.data.message)||'Datei blockiert');blocked.code=q(result.data.code);throw blocked}
  if(i===0)fileLine(fileName,tr('abd.analysis.scanning',null,'Microsoft Defender prüft die Datei auf Schadsoftware …'),'scan');
  await delay(1800)
 }
 var e=new Error(tr('abd.analysis.waiting',null,'Auswertung wird vorbereitet …'));e.code='ABD_SCAN_PENDING';throw e
}
async function analyzeFile(file){
 var uploaded=await post({action:'upload',file:{name:file.name,type:file.type||'',base64:await base64(file)}}),upload=uploaded.data&&uploaded.data.upload;
 if(!upload||!upload.id)throw new Error('Upload-ID fehlt');
 return poll(upload,file.name)
}
async function start(){
 if(busy)return false;var p=panel(),input=p&&p.querySelector('[data-rc1294-files]'),button=p&&p.querySelector('[data-rc1294-start]'),files=Array.from(input&&input.files||[]);
 clearStatus();var out=resultBox();if(out){out.hidden=true;out.innerHTML=''}
 if(!files.length){setStatus(tr('abd.analysis.fileRequired',null,'Bitte mindestens eine Datei auswählen.'),'bad');return false}
 if(files.length>5){setStatus(tr('abd.analysis.fileLimit',null,'Maximal 5 Dateien pro Auswertung.'),'bad');return false}
 busy=true;if(button)button.disabled=true;lastPositions=[];lastResults=[];lastGroups=[];lastUnassigned=[];
 try{
  var results=[];
  for(var i=0;i<files.length;i++){
   fileLine(files[i].name,tr('abd.analysis.waiting',null,'Auswertung wird vorbereitet …'),'info');
   try{
    var result=await analyzeFile(files[i]);results.push(result);fileLine(files[i].name,(result.analysis&&result.analysis.positions||[]).length+' Position(en)','ok')
   }catch(e){fileLine(files[i].name,q(e&&e.message)||tr('errors.generic',null,'Es ist ein Fehler aufgetreten.'),'bad')}
  }
  renderResults(results);
  return results.length>0
 }catch(e){setStatus(tr('abd.analysis.error',{message:q(e&&e.message)},'Auswertung fehlgeschlagen: {{message}}').replace('{{message}}',q(e&&e.message)),'bad');return false}
 finally{busy=false;if(button)button.disabled=false}
}
function copyGroupedResults(){
 if(!lastGroups.length)return false;
 var header=['HS-Code','Ursprungsland','Warenwert','Währung','Positionen','Quelle'];
 var lines=[header.join('\t')].concat(lastGroups.map(function(group){return[group.commodityCode,group.originCountry,group.value==null?'':group.value,group.currency,group.positionCount,group.sourceFile].map(function(v){return q(v).replace(/[\t\r\n]+/g,' ')}).join('\t')})),raw=lines.join('\n');
 if(w.navigator&&w.navigator.clipboard&&w.navigator.clipboard.writeText)w.navigator.clipboard.writeText(raw).then(function(){setStatus(tr('abd.analysis.copied',null,'Gruppierte Daten für das Zollportal wurden kopiert.'),'ok')}).catch(function(){fallbackCopy(raw)});
 else fallbackCopy(raw);
 return false
}
function copyResults(){return copyGroupedResults()}
function fallbackCopy(raw){
 var ta=d.createElement('textarea');ta.value=raw;ta.style.position='fixed';ta.style.left='-9999px';d.body.appendChild(ta);ta.select();try{d.execCommand('copy');setStatus(tr('abd.analysis.copied',null,'Gruppierte Daten für das Zollportal wurden kopiert.'),'ok')}catch(_){}ta.remove()
}
function setMode(mode){
 var p=panel();if(!p)return false;mode=q(mode)||'manual';
 var invoice=p.querySelector('[data-rc1294-invoice-panel]'),buttons=p.querySelectorAll('[data-rc1294-mode]');
 for(var i=0;i<buttons.length;i++){var active=buttons[i].getAttribute('data-rc1294-mode')===mode;buttons[i].setAttribute('aria-pressed',active?'true':'false');buttons[i].classList.toggle('active',active)}
 if(invoice)invoice.hidden=mode!=='invoice';
 if(mode==='shipment'){
  try{
   if(w.ExportHUBRC626&&typeof w.ExportHUBRC626.openAbd==='function')w.ExportHUBRC626.openAbd(true);
   else setStatus(tr('abd.analysis.shipmentUnavailable',null,'Der bestehende Sendungs-ABD-Ablauf ist derzeit nicht verfügbar.'),'bad')
  }catch(e){setStatus(q(e&&e.message)||tr('errors.generic',null,'Es ist ein Fehler aufgetreten.'),'bad')}
 }
 return false
}
function ensureStyle(){
 if(d.getElementById('rc1294AbdStyle'))return;
 var s=d.createElement('style');s.id='rc1294AbdStyle';s.textContent=
 '.rc1294-abd{margin:14px 0 18px;border:1px solid #bfdbfe;border-left:5px solid #2563eb;background:#eff6ff;border-radius:14px;padding:16px;color:#0f172a}.rc1294-abd h3{margin:0 0 6px}.rc1294-router{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.rc1294-router button{min-height:40px;padding:9px 13px;border-radius:10px;border:1px solid #93c5fd;background:#fff;color:#1e3a8a;font-weight:800;cursor:pointer}.rc1294-router button.active,.rc1294-router button[aria-pressed="true"]{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.rc1294-invoice-panel{margin-top:14px;padding-top:14px;border-top:1px solid #bfdbfe}.rc1294-note{margin:10px 0;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;font-weight:650}.rc1294-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.rc1294-file{display:inline-flex;align-items:center;min-height:40px;padding:8px 12px;border:1px dashed #60a5fa;border-radius:10px;background:#fff;font-weight:750;cursor:pointer}.rc1294-file input{max-width:360px}.rc1294-status{display:grid;gap:6px;margin-top:12px}.rc1294-file-status{display:flex;gap:10px;justify-content:space-between;padding:8px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:9px;font-size:13px}.rc1294-file-status[data-kind="ok"]{border-color:#86efac;background:#f0fdf4}.rc1294-file-status[data-kind="bad"]{border-color:#fca5a5;background:#fef2f2;color:#991b1b}.rc1294-file-status[data-kind="scan"]{border-color:#93c5fd;background:#eff6ff}.rc1294-results{margin-top:14px;padding-top:12px;border-top:1px solid #bfdbfe}.rc1294-result-head,.rc1294-document-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.rc1294-document{margin-top:14px;padding:14px;border:1px solid #bfdbfe;border-radius:12px;background:#f8fbff}.rc1294-document h4,.rc1294-document h5{margin:0}.rc1294-document h5{margin-top:14px}.rc1294-document-head small{display:block;color:#64748b}.rc1294-meta,.rc1294-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px}.rc1294-meta>div,.rc1294-metric{display:grid;gap:3px;padding:9px 10px;border:1px solid #dbeafe;border-radius:9px;background:#fff}.rc1294-meta span,.rc1294-metric span{font-size:11px;color:#64748b}.rc1294-metric.ok{border-color:#86efac;background:#f0fdf4}.rc1294-metric.warn{border-color:#fdba74;background:#fff7ed}.rc1294-table-wrap{overflow:auto;margin-top:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.rc1294-table{border-collapse:collapse;width:100%;min-width:1280px;font-size:12px}.rc1294-group-table{min-width:720px}.rc1294-unassigned-table{min-width:900px}.rc1294-table th,.rc1294-table td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.rc1294-table th{position:sticky;top:0;background:#f8fafc;z-index:1}.rc1294-desc{min-width:220px}.rc1294-state{display:inline-block;padding:3px 7px;border-radius:999px;font-weight:800}.rc1294-state.ok{background:#dcfce7;color:#166534}.rc1294-state.review{background:#ffedd5;color:#9a3412}.rc1294-table small{display:block;margin-top:4px;color:#9a3412}.rc1294-codes,.rc1294-empty{margin-top:10px;padding:9px 11px;background:#fff;border:1px solid #cbd5e1;border-radius:9px}.rc1294-unassigned{margin-top:14px}.rc1294-details{margin-top:14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:10px}.rc1294-details>summary{cursor:pointer;font-weight:800}@media(max-width:700px){.rc1294-abd{padding:12px}.rc1294-router button,.rc1294-controls>*{width:100%}.rc1294-file{box-sizing:border-box}.rc1294-file input{width:100%;max-width:none}.rc1294-meta,.rc1294-metrics{grid-template-columns:1fr 1fr}}@media(max-width:460px){.rc1294-meta,.rc1294-metrics{grid-template-columns:1fr}}';
 (d.head||d.documentElement).appendChild(s)
}
function mount(){
 var host=d.getElementById('rc626Abd');if(!host)return false;
 var old=d.getElementById('rc1294AbdAnalysis');if(old)return true;
 ensureStyle();
 var p=d.createElement('section');p.id='rc1294AbdAnalysis';p.className='rc1294-abd';p.setAttribute('data-rc1294-abd-analysis','1');
 p.innerHTML='<h3>'+esc(tr('abd.analysis.entryTitle',null,'Exportexperte · ABD erstellen'))+'</h3>'+
  '<p>'+esc(tr('abd.analysis.entryHelp',null,'Wähle den passenden Einstieg. Der bestehende manuelle und sendungsbezogene ABD-Ablauf bleibt unverändert.'))+'</p>'+
  '<div class="rc1294-router" role="group" aria-label="ABD-Einstieg">'+
   '<button type="button" data-rc1294-mode="manual" aria-pressed="true">'+esc(tr('abd.analysis.manualMode',null,'Manuell'))+'</button>'+
   '<button type="button" data-rc1294-mode="shipment" aria-pressed="false">'+esc(tr('abd.analysis.shipmentMode',null,'Aus Sendung'))+'</button>'+
   '<button type="button" data-rc1294-mode="invoice" aria-pressed="false">'+esc(tr('abd.analysis.invoiceMode',null,'Rechnung analysieren'))+'</button></div>'+
  '<div class="rc1294-invoice-panel" data-rc1294-invoice-panel hidden><h4>'+esc(tr('abd.analysis.title',null,'Rechnung analysieren'))+'</h4>'+
   '<p>'+esc(tr('abd.analysis.help',null,'Rechnung hochladen, prüfen und nach HS-Code plus Ursprungsland gruppieren.'))+'</p>'+
   '<div class="rc1294-note">'+esc(tr('abd.analysis.previewOnly',null,'Erkannte Zollangaben immer prüfen. Es werden keine HS-Codes oder Ursprungsländer erfunden.'))+'</div>'+
   '<div class="rc1294-controls"><label class="rc1294-file"><span>'+esc(tr('abd.analysis.chooseFiles',null,'Dateien auswählen'))+'</span><input type="file" multiple data-rc1294-files accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"></label>'+
   '<button type="button" class="btn" data-rc1294-start>'+esc(tr('abd.analysis.start',null,'Analyse starten'))+'</button></div>'+
   '<div class="rc1294-status" data-rc1294-status hidden></div><div class="rc1294-results" data-rc1294-results hidden></div></div>';
 var head=host.querySelector('.rc626-head');if(head&&head.parentNode)head.parentNode.insertBefore(p,head.nextSibling);else host.insertBefore(p,host.firstChild);
 p.querySelector('[data-rc1294-start]').addEventListener('click',start);
 p.addEventListener('click',function(e){
  var mode=e.target&&e.target.closest&&e.target.closest('[data-rc1294-mode]');if(mode){e.preventDefault();setMode(mode.getAttribute('data-rc1294-mode'));return}
  var b=e.target&&e.target.closest&&e.target.closest('[data-rc1294-copy]');if(b){e.preventDefault();copyGroupedResults()}
 });
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
function activate(){syncObserver();schedule()}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',activate,{once:true});else activate();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(name){w.addEventListener(name,activate)});
w.addEventListener('exporthub:language-changed',function(){var old=panel();if(old)old.remove();activate()});
w.ExportHUBRC1294ABDAnalysis=Object.freeze({version:'RC1294',mount:mount,start:start,setMode:setMode,copyResults:copyResults,copyGroupedResults:copyGroupedResults});
})(window,document);
