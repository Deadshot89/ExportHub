(function(root){
'use strict';
if(!root||root.ExportHUBRC1499Handoff)return;

var pending=null,observer=null,timer=0;
function q(v){return String(v==null?'':v).trim()}
function tr(key){
  try{var i=root.ExportHUBRC1499I18n;if(i&&typeof i.t==='function')return i.t(key,typeof i.language==='function'?i.language():undefined)}catch(_){}
  return key
}
function number(v){
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  var raw=q(v).replace(/\s+/g,'').replace(/[^0-9,.-]/g,'');if(!raw)return null;
  var comma=raw.lastIndexOf(','),dot=raw.lastIndexOf('.');
  if(comma>=0&&dot>=0)raw=comma>dot?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');
  else if(comma>=0)raw=raw.replace(',','.');
  var n=Number(raw);return Number.isFinite(n)?n:null
}
function cleanGroup(group){
  group=group&&typeof group==='object'?group:{};
  return{
    commodityCode:q(group.commodityCode),
    originCountry:q(group.originCountry).toUpperCase(),
    value:number(group.value),
    currency:q(group.currency).toUpperCase(),
    positionCount:Math.max(0,Math.trunc(number(group.positionCount)||0))
  }
}
function validate(input){
  input=input&&typeof input==='object'?input:{};
  var review=input.review||{},totals=input.totals||{},groups=Array.isArray(input.groups)?input.groups:[];
  if(review.complete!==true||number(totals.difference)!==0)throw new Error('ABD_HANDOFF_NOT_READY');
  if(!groups.length)throw new Error('ABD_HANDOFF_EMPTY');
  var cleaned=groups.map(cleanGroup);
  for(var i=0;i<cleaned.length;i++){
    var g=cleaned[i];
    if(!g.commodityCode||!g.originCountry||g.value==null||!g.currency||g.positionCount<1)throw new Error('ABD_HANDOFF_NOT_READY')
  }
  return cleaned
}
function clone(value){return JSON.parse(JSON.stringify(value))}
function prepare(input){
  input=input&&typeof input==='object'?input:{};
  var groups=validate(input),header=input.header&&typeof input.header==='object'?input.header:{},totals=input.totals||{};
  pending={
    version:1,
    source:'rc1499-invoice-analysis',
    header:{invoiceNumber:q(header.invoiceNumber),reference:q(header.reference)},
    totals:{invoiceTotal:number(totals.invoiceTotal),accountedTotal:number(totals.accountedTotal),difference:0,currency:q(totals.currency).toUpperCase()},
    groups:groups
  };
  var legacy=root.ExportHUBRC626;
  if(!legacy||typeof legacy.openAbd!=='function'){pending=null;throw new Error('ABD_HANDOFF_LEGACY_UNAVAILABLE')}
  legacy.openAbd(true);
  try{
    if(typeof root.CustomEvent==='function'&&root.document&&typeof root.document.dispatchEvent==='function')root.document.dispatchEvent(new root.CustomEvent('exporthub:abd-analysis-prepared',{detail:clone(pending)}));
  }catch(_){}
  schedule();
  return clone(pending)
}
function peek(){return pending?clone(pending):null}
function clear(){pending=null;var d=root.document,old=d&&d.querySelector&&d.querySelector('[data-rc1499-abd-prepared]');if(old&&old.remove)old.remove()}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function collect(){
  var d=root.document,box=d&&d.querySelector&&d.querySelector('[data-rc1294-results]');if(!box)return null;
  var docs=box.querySelectorAll('.rc1294-document'),rows=box.querySelectorAll('.rc1294-group-table tbody tr');if(!docs.length||!rows.length)return null;
  if(box.querySelector('.rc1294-state.review'))return null;
  var metrics=docs[0].querySelectorAll('.rc1294-metric'),difference=metrics.length?number(metrics[metrics.length-1].querySelector('strong')&&metrics[metrics.length-1].querySelector('strong').textContent):null;
  if(difference!==0)return null;
  var groups=[];
  for(var i=0;i<rows.length;i++){
    var cells=rows[i].querySelectorAll('td');if(cells.length<5)continue;
    groups.push({commodityCode:q(cells[0].textContent),originCountry:q(cells[1].textContent),value:number(cells[2].textContent),currency:q(cells[3].textContent),positionCount:number(cells[4].textContent)})
  }
  if(!groups.length)return null;
  var firstMeta=docs[0].querySelector('.rc1294-meta > div strong');
  return{review:{complete:true},totals:{difference:0},header:{invoiceNumber:firstMeta?q(firstMeta.textContent):''},groups:groups}
}
function ensureStyle(){
  var d=root.document;if(!d||!d.createElement||d.getElementById('rc1499HandoffStyle'))return;
  var s=d.createElement('style');s.id='rc1499HandoffStyle';s.textContent='.rc1499-abd-prepared{margin:0 0 14px;padding:12px;border:1px solid #93c5fd;border-left:4px solid #2563eb;border-radius:10px;background:#eff6ff;color:#0f172a}.rc1499-abd-prepared-head{display:grid;gap:3px;margin-bottom:9px}.rc1499-abd-prepared-head small{color:#475569}.rc1499-abd-prepared-scroll{overflow:auto;border:1px solid #bfdbfe;border-radius:8px;background:#fff}.rc1499-abd-prepared table{width:100%;min-width:560px;border-collapse:collapse;font-size:12px}.rc1499-abd-prepared th,.rc1499-abd-prepared td{padding:7px 9px;text-align:left;border-bottom:1px solid #e2e8f0}.rc1499-abd-prepared th{background:#f8fafc}';
  (d.head||d.documentElement).appendChild(s)
}
function renderPending(){
  if(!pending)return;
  var d=root.document,host=d&&d.getElementById&&d.getElementById('rc626Abd');if(!host)return;
  ensureStyle();
  var old=host.querySelector&&host.querySelector('[data-rc1499-abd-prepared]');if(old&&old.remove)old.remove();
  var section=d.createElement('section');section.setAttribute('data-rc1499-abd-prepared','');section.className='rc1499-abd-prepared';
  var rows=pending.groups.map(function(g){return'<tr><td><b>'+esc(g.commodityCode)+'</b></td><td>'+esc(g.originCountry)+'</td><td>'+esc(g.value)+'</td><td>'+esc(g.currency)+'</td><td>'+esc(g.positionCount)+'</td></tr>'}).join('');
  section.innerHTML='<div class="rc1499-abd-prepared-head"><strong>'+esc(tr('groupedTitle'))+'</strong><small>'+esc(tr('previewOnly'))+'</small></div><div class="rc1499-abd-prepared-scroll"><table><thead><tr><th>HS</th><th>COO</th><th>'+esc(tr('invoiceTotal'))+'</th><th>CUR</th><th>'+esc(tr('positions'))+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  host.insertBefore(section,host.firstChild||null)
}
function enhance(){
  var d=root.document,box=d&&d.querySelector&&d.querySelector('[data-rc1294-results]');if(!box)return;
  var head=box.querySelector('.rc1294-result-head');if(!head)return;
  var button=head.querySelector('[data-rc1499-prepare-abd]');
  if(!button){button=d.createElement('button');button.type='button';button.className='ghost';button.setAttribute('data-rc1499-prepare-abd','');button.addEventListener('click',function(){var data=collect();if(!data)return;try{prepare(data)}catch(_){}});head.appendChild(button)}
  var data=collect();button.textContent=tr('prepareAbd');button.disabled=!data;button.setAttribute('aria-disabled',data?'false':'true');button.title=data?tr('prepareAbdHint'):tr('prepareAbdBlocked');
  renderPending()
}
function schedule(){if(timer)return;timer=root.setTimeout?root.setTimeout(function(){timer=0;enhance()},0):0;if(!root.setTimeout)enhance()}
function mount(){
  var d=root.document;if(!d||!d.documentElement)return false;ensureStyle();schedule();
  if(typeof root.MutationObserver==='function'&&!observer){observer=new root.MutationObserver(schedule);observer.observe(d.documentElement,{childList:true,subtree:true})}
  return true
}

root.ExportHUBRC1499Handoff=Object.freeze({prepare:prepare,peek:peek,clear:clear,validate:validate,mount:mount});
mount();
})(typeof window!=='undefined'?window:globalThis);
