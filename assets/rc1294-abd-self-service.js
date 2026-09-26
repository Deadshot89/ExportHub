(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1294_ABD_SELF_SERVICE__)return;
w.__EXPORTHUB_RC1294_ABD_SELF_SERVICE__=true;

var busy=false,lastPositions=[],lastResults=[];
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
function renderResults(results){
 lastResults=results||[];lastPositions=[];
 lastResults.forEach(function(r){var a=r&&r.analysis||{};(a.positions||[]).forEach(function(p){lastPositions.push(Object.assign({},p,{sourceFile:a.fileName||p.source||''}))})});
 var box=resultBox();if(!box)return;
 var ready=lastPositions.filter(function(p){return !(p.missing||[]).length}).length,review=lastPositions.length-ready;
 var codes=[];lastResults.forEach(function(r){(r&&r.analysis&&r.analysis.documentCodes||[]).forEach(function(c){if(codes.indexOf(c)<0)codes.push(c)})});
 var summary=tr('abd.analysis.summary',{count:lastPositions.length,ready:ready,review:review},lastPositions.length+' Position(en) erkannt');
 var table=lastPositions.length?'<div class="rc1294-table-wrap"><table class="rc1294-table"><thead><tr>'+
  '<th>'+esc(tr('abd.analysis.position',null,'Pos.'))+'</th><th>'+esc(tr('abd.analysis.item',null,'Artikel'))+'</th><th>'+esc(tr('common.description',null,'Beschreibung'))+'</th>'+
  '<th>'+esc(tr('abd.analysis.hs',null,'HS-/Warennummer'))+'</th><th>'+esc(tr('abd.analysis.origin',null,'Ursprungsland'))+'</th><th>'+esc(tr('abd.analysis.quantity',null,'Menge'))+'</th>'+
  '<th>'+esc(tr('abd.analysis.net',null,'Eigenmasse kg'))+'</th><th>'+esc(tr('abd.analysis.gross',null,'Rohmasse kg'))+'</th><th>'+esc(tr('abd.analysis.value',null,'Warenwert'))+'</th>'+
  '<th>'+esc(tr('abd.analysis.currency'))+'</th><th>'+esc(tr('abd.analysis.codes'))+'</th><th>'+esc(tr('abd.analysis.source'))+'</th><th>'+esc(tr('common.status'))+'</th>'+
  '</tr></thead><tbody>'+rowsHtml(lastPositions)+'</tbody></table></div>':'<div class="rc1294-empty">'+esc(tr('abd.analysis.noPositions'))+'</div>';
 box.innerHTML='<div class="rc1294-result-head"><strong>'+esc(summary)+'</strong>'+(lastPositions.length?'<button type="button" class="ghost" data-rc1294-copy>'+esc(tr('abd.analysis.copy',null,'Positionsdaten kopieren'))+'</button>':'')+'</div>'+
  (codes.length?'<div class="rc1294-codes">'+esc(tr('abd.analysis.codes'))+': <b>'+esc(codes.join(', '))+'</b></div>':'')+table;
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
 busy=true;if(button)button.disabled=true;lastPositions=[];lastResults=[];
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
function copyResults(){
 if(!lastPositions.length)return false;
 var header=['Position','Artikel','Warenbeschreibung','HS-Code','Ursprungsland','Menge','Eigenmasse kg','Rohmasse kg','Warenwert','Währung','Y-/Unterlagencodes','Quelle','Fehlende Felder'];
 var lines=[header.join('\t')].concat(lastPositions.map(function(p){return[p.position,p.itemNumber,p.description,p.commodityCode,p.originCountry,p.quantity==null?'':p.quantity,p.netMassKg==null?'':p.netMassKg,p.grossMassKg==null?'':p.grossMassKg,p.value==null?'':p.value,p.currency,(p.supplementaryCodes||[]).join(','),p.sourceFile||p.source,(p.missing||[]).join(',')].map(function(v){return q(v).replace(/[\t\r\n]+/g,' ')}).join('\t')}));
 var raw=lines.join('\n');
 if(w.navigator&&w.navigator.clipboard&&w.navigator.clipboard.writeText)w.navigator.clipboard.writeText(raw).then(function(){setStatus(tr('abd.analysis.copied',null,'Positionsdaten wurden als Tabelle kopiert.'),'ok')}).catch(function(){fallbackCopy(raw)});
 else fallbackCopy(raw);
 return false
}
function fallbackCopy(raw){
 var ta=d.createElement('textarea');ta.value=raw;ta.style.position='fixed';ta.style.left='-9999px';d.body.appendChild(ta);ta.select();try{d.execCommand('copy');setStatus(tr('abd.analysis.copied',null,'Positionsdaten wurden als Tabelle kopiert.'),'ok')}catch(_){}ta.remove()
}
function ensureStyle(){
 if(d.getElementById('rc1294AbdStyle'))return;
 var s=d.createElement('style');s.id='rc1294AbdStyle';s.textContent=
 '.rc1294-abd{margin:14px 0 18px;border:1px solid #bfdbfe;border-left:5px solid #2563eb;background:#eff6ff;border-radius:14px;padding:16px;color:#0f172a}.rc1294-abd h3{margin:0 0 6px}.rc1294-note{margin:10px 0;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;font-weight:650}.rc1294-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.rc1294-file{display:inline-flex;align-items:center;min-height:40px;padding:8px 12px;border:1px dashed #60a5fa;border-radius:10px;background:#fff;font-weight:750;cursor:pointer}.rc1294-file input{max-width:360px}.rc1294-status{display:grid;gap:6px;margin-top:12px}.rc1294-file-status{display:flex;gap:10px;justify-content:space-between;padding:8px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:9px;font-size:13px}.rc1294-file-status[data-kind="ok"]{border-color:#86efac;background:#f0fdf4}.rc1294-file-status[data-kind="bad"]{border-color:#fca5a5;background:#fef2f2;color:#991b1b}.rc1294-file-status[data-kind="scan"]{border-color:#93c5fd;background:#eff6ff}.rc1294-results{margin-top:14px;padding-top:12px;border-top:1px solid #bfdbfe}.rc1294-result-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.rc1294-table-wrap{overflow:auto;margin-top:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.rc1294-table{border-collapse:collapse;width:100%;min-width:1280px;font-size:12px}.rc1294-table th,.rc1294-table td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.rc1294-table th{position:sticky;top:0;background:#f8fafc;z-index:1}.rc1294-desc{min-width:220px}.rc1294-state{display:inline-block;padding:3px 7px;border-radius:999px;font-weight:800}.rc1294-state.ok{background:#dcfce7;color:#166534}.rc1294-state.review{background:#ffedd5;color:#9a3412}.rc1294-table small{display:block;margin-top:4px;color:#9a3412}.rc1294-codes,.rc1294-empty{margin-top:10px;padding:9px 11px;background:#fff;border:1px solid #cbd5e1;border-radius:9px}@media(max-width:700px){.rc1294-abd{padding:12px}.rc1294-controls>*{width:100%}.rc1294-file{box-sizing:border-box}.rc1294-file input{width:100%;max-width:none}}';
 (d.head||d.documentElement).appendChild(s)
}
function mount(){
 var host=d.getElementById('rc626Abd');if(!host)return false;
 var old=d.getElementById('rc1294AbdAnalysis');if(old)return true;
 ensureStyle();
 var p=d.createElement('section');p.id='rc1294AbdAnalysis';p.className='rc1294-abd';p.setAttribute('data-rc1294-abd-analysis','1');
 p.innerHTML='<h3>'+esc(tr('abd.analysis.title'))+'</h3>'+
  '<p>'+esc(tr('abd.analysis.help'))+'</p>'+
  '<div class="rc1294-note">'+esc(tr('abd.analysis.previewOnly'))+'</div>'+
  '<div class="rc1294-controls"><label class="rc1294-file"><span>'+esc(tr('abd.analysis.chooseFiles'))+'</span><input type="file" multiple accept=".pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"></label>'+
  '<button type="button" class="btn" data-rc1294-start>'+esc(tr('abd.analysis.start'))+'</button></div>'+
  '<div class="rc1294-status" data-rc1294-status hidden></div><div class="rc1294-results" data-rc1294-results hidden></div>';
 var head=host.querySelector('.rc626-head');if(head&&head.parentNode)head.parentNode.insertBefore(p,head.nextSibling);else host.insertBefore(p,host.firstChild);
 p.querySelector('[data-rc1294-start]').addEventListener('click',start);
 p.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-rc1294-copy]');if(b){e.preventDefault();copyResults()}});
 return true
}
function schedule(){setTimeout(function(){mount()},0)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(name){w.addEventListener(name,schedule)});
w.addEventListener('exporthub:language-changed',function(){var old=panel();if(old)old.remove();schedule()});
if(typeof MutationObserver!=='undefined'){try{new MutationObserver(function(){if(d.getElementById('rc626Abd')&&!panel())schedule()}).observe(d.documentElement||d.body,{childList:true,subtree:true})}catch(_){}}
w.ExportHUBRC1294ABDAnalysis=Object.freeze({version:'RC1294',mount:mount,start:start,copyResults:copyResults});
})(window,document);
