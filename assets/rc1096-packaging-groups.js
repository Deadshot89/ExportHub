(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1096_PACKAGING_GROUPS__)return;
w.__EXPORTHUB_RC1096_PACKAGING_GROUPS__=true;

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function category(text){
  var s=low(text);
  if(/^e\s*\d+\b/i.test(q(text))||/\b(karton|kartons|paket|pakete|box|boxes|carton|cartons)\b/.test(s))return'packages';
  if(/palette|palett|pallet|skid/.test(s))return'pallets';
  return'other'
}
function label(cat){return cat==='packages'?'Pakete':cat==='pallets'?'Paletten':'Sonstiges'}
function optionText(el){return q(el&&((el.getAttribute&&el.getAttribute('data-name'))||(el.getAttribute&&el.getAttribute('data-value'))||(el.textContent)))}
function directOptionNodes(host){
  if(!host||!host.querySelectorAll)return[];
  return Array.prototype.filter.call(host.querySelectorAll('.rc682-packaging-option'),function(el){
    return el.closest('.rc1096-packaging-grid')==null
  })
}
function existingGrid(host){return host&&host.querySelector&&host.querySelector(':scope > .rc1096-packaging-grid')}
function build(host){
  if(!host||host.nodeType!==1)return false;
  var options=directOptionNodes(host);
  if(!options.length)return false;
  var old=existingGrid(host);if(old)return false;
  var grid=d.createElement('div');grid.className='rc1096-packaging-grid';grid.setAttribute('data-rc1096-packaging-groups','1');
  ['packages','pallets','other'].forEach(function(cat){
    var col=d.createElement('section');col.className='rc1096-packaging-col rc1096-'+cat;col.setAttribute('data-group',cat);
    var h=d.createElement('div');h.className='rc1096-packaging-heading';h.textContent=label(cat);col.appendChild(h);
    var list=d.createElement('div');list.className='rc1096-packaging-list';col.appendChild(list);grid.appendChild(col)
  });
  host.insertBefore(grid,options[0]);
  options.forEach(function(el){
    var cat=category(optionText(el)),target=grid.querySelector('[data-group="'+cat+'"] .rc1096-packaging-list');
    if(target)target.appendChild(el)
  });
  var other=grid.querySelector('[data-group="other"] .rc1096-packaging-list');
  if(other&&!Array.prototype.some.call(grid.querySelectorAll('.rc682-packaging-option'),function(el){return low(optionText(el))==='umschlag'})){
    var note=d.createElement('div');note.className='rc1096-packaging-hint';note.textContent='Umschlag wird automatisch ergänzt, sobald die aktuelle Verpackungsliste neu geladen wurde.';other.appendChild(note)
  }
  return true
}
function candidates(){
  var opts=d.querySelectorAll('.rc682-packaging-option'),hosts=[];
  Array.prototype.forEach.call(opts,function(el){
    var p=el.parentElement;
    if(p&&!hosts.includes(p))hosts.push(p)
  });
  return hosts
}
function enhance(){var changed=false;candidates().forEach(function(host){if(build(host))changed=true});ensureStyle();return changed}
function ensureStyle(){
  if(d.getElementById('rc1096PackagingGroupsStyle'))return;
  var s=d.createElement('style');s.id='rc1096PackagingGroupsStyle';
  s.textContent='.rc1096-packaging-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%;padding:8px}.rc1096-packaging-col{min-width:0;border:1px solid #dbe4ec;border-radius:10px;background:var(--surface,#fff);overflow:hidden}.rc1096-packaging-heading{padding:8px 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#475569;background:#f8fafc;border-bottom:1px solid #e2e8f0}.rc1096-packaging-list{display:grid;gap:5px;padding:7px}.rc1096-packaging-list .rc682-packaging-option{width:100%!important;margin:0!important;text-align:left}.rc1096-packaging-hint{font-size:11px;line-height:1.35;color:#64748b;padding:7px}@media(max-width:720px){.rc1096-packaging-grid{grid-template-columns:1fr;gap:7px}.rc1096-packaging-col{overflow:visible}}';
  (d.head||d.documentElement).appendChild(s)
}
function schedule(){w.setTimeout(function(){try{enhance()}catch(e){try{console.warn('RC1096 Verpackungsgruppen',e)}catch(_){}}},0)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(schedule);try{mo.observe(d.documentElement,{childList:true,subtree:true})}catch(_){}}
['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
w.ExportHUBRC1096PackagingGroups=Object.freeze({version:'RC1096',enhance:enhance,category:category});
})(window,document);
