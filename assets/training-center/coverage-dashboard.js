(function(g){
'use strict';

function text(value){return String(value==null?'':value).trim();}
function list(value){return Array.isArray(value)?value:[];}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function coverage(){const api=g.ExportHubTrainingCoverage;if(!api||typeof api.scan!=='function')throw new Error('TRAINING_COVERAGE_MISSING');return api;}
function registry(){const api=g.ExportHubTrainingCoverageRegistry;if(!api||!Array.isArray(api.entries))throw new Error('TRAINING_COVERAGE_REGISTRY_MISSING');return api;}
function unique(values){return Array.from(new Set(values.map(text).filter(Boolean)));}
function customersOf(center){
  const seen=new Set();const out=[];
  for(const item of list(center&&center.customerSops)){
    const id=text(item&&item.customerId);if(!id||seen.has(id))continue;seen.add(id);
    out.push({id,name:text(item.customerName)||id});
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
function buildModel(center,options={}){
  const result=coverage().scan(center,{entries:registry().entries,customerId:options.customerId||''});
  return {
    center,
    items:result.items,
    summary:{...result.counts,percentage:result.percentage},
    areas:unique(result.items.map(item=>item.area)).sort((a,b)=>a.localeCompare(b,'de')),
    customers:customersOf(center),
    selectedCustomerId:text(options.customerId)
  };
}
function filterItems(items,filters={}){
  const area=text(filters.area),status=text(filters.status),customer=text(filters.customer),capability=text(filters.capability);
  return list(items).filter(item=>{
    if(area&&text(item.area)!==area)return false;
    if(status&&text(item.status)!==status)return false;
    if(customer&&(!item.customerOverlay||item.customerOverlay.present!==true))return false;
    if(capability&&(!item.capabilities||item.capabilities[capability]!==true))return false;
    return true;
  });
}
function option(value,label,selected){return `<option value="${esc(value)}"${text(value)===text(selected)?' selected':''}>${esc(label)}</option>`;}
function card(kind,label,value,symbol,suffix=''){
  return `<article class="training-coverage-kpi training-coverage-kpi-${esc(kind)}" data-kpi="${esc(kind)}"><span class="training-coverage-kpi-symbol" aria-hidden="true">${symbol}</span><div><span>${esc(label)}</span><strong>${esc(value)}${esc(suffix)}</strong></div></article>`;
}
function statusLabel(status){
  if(status==='missing')return '🔴 SOP fehlt';
  if(status==='incomplete')return '🟡 SOP unvollständig';
  if(status==='complete')return '🟢 SOP vollständig';
  return esc(status);
}
function reasons(row){
  const labels={SOP_MISSING:'SOP fehlt',SOP_NOT_RELEASED:'SOP ist nicht freigegeben',STEP_INCOMPLETE:'Pflichtschritt fehlt oder ist unvollständig',IMAGE_MISSING:'Bildanleitung fehlt',TOUR_MISSING:'Interaktive Tour fehlt'};
  const source=list(row&&row.reasons);
  return source.length?`<ul class="training-coverage-reasons">${source.map(code=>`<li>${esc(labels[code]||code)}</li>`).join('')}</ul>`:'<span class="training-coverage-muted">Keine offenen Punkte</span>';
}
function capabilityBadges(row){
  const caps=[];
  if(row&&row.capabilities&&row.capabilities.tour)caps.push('<span class="training-coverage-capability">🔵 Tour vorhanden</span>');
  if(row&&row.capabilities&&row.capabilities.image)caps.push('<span class="training-coverage-capability">🟣 Bildanleitung vorhanden</span>');
  return caps.length?caps.join(''):'<span class="training-coverage-muted">Keine Zusatzfähigkeit</span>';
}
function rowHtml(row){
  const overlay=row&&row.customerOverlay&&row.customerOverlay.present?`<span class="training-coverage-overlay">${esc(row.customerOverlay.id)}</span>`:'<span class="training-coverage-muted">—</span>';
  return `<tr data-coverage-row="${esc(row.id)}" data-status="${esc(row.status)}"><td>${esc(row.area)}</td><td><strong>${esc(row.title)}</strong><small>${esc(row.id)}</small></td><td><span class="training-coverage-status training-coverage-status-${esc(row.status)}">${statusLabel(row.status)}</span>${reasons(row)}</td><td><div class="training-coverage-capabilities">${capabilityBadges(row)}</div></td><td>${overlay}</td></tr>`;
}
function render(model,filters={}){
  const filtered=filterItems(model.items,filters);
  const s=model.summary;
  const areaOptions=['<option value="">Alle Bereiche</option>',...model.areas.map(value=>option(value,value,filters.area))].join('');
  const statusOptions=['<option value="">Alle Status</option>',option('missing','🔴 SOP fehlt',filters.status),option('incomplete','🟡 SOP unvollständig',filters.status),option('complete','🟢 SOP vollständig',filters.status)].join('');
  const customerOptions=['<option value="">Alle Kunden / Basiskontext</option>',...model.customers.map(customer=>option(customer.id,customer.name,filters.customer))].join('');
  const capabilityOptions=['<option value="">Alle Fähigkeiten</option>',option('tour','🔵 Tour vorhanden',filters.capability),option('image','🟣 Bildanleitung vorhanden',filters.capability)].join('');
  return `<section class="training-coverage" data-training-coverage>
    <header class="training-coverage-header"><div><h1>SOP &amp; Training Center Coverage</h1><p>Abdeckung, Vollständigkeit und Zusatzfähigkeiten der registrierten ExportHUB-Prozesse.</p></div><span class="training-coverage-readonly">Nur Lesen</span></header>
    <div class="training-coverage-kpis">
      ${card('rate','Abdeckungsquote',s.percentage,'◉','%')}
      ${card('missing','SOP fehlt',s.missing,'🔴')}
      ${card('incomplete','SOP unvollständig',s.incomplete,'🟡')}
      ${card('complete','SOP vollständig',s.complete,'🟢')}
      ${card('tour','Tour vorhanden',s.tour,'🔵')}
      ${card('image','Bildanleitung vorhanden',s.image,'🟣')}
    </div>
    <form class="training-coverage-filters" data-coverage-filters aria-label="Coverage filtern">
      <label>Bereich<select data-coverage-filter="area">${areaOptions}</select></label>
      <label>Status<select data-coverage-filter="status">${statusOptions}</select></label>
      <label>Kunde<select data-coverage-filter="customer">${customerOptions}</select></label>
      <label>Fähigkeit<select data-coverage-filter="capability">${capabilityOptions}</select></label>
      <button type="button" data-coverage-reset>Filter zurücksetzen</button>
    </form>
    <div class="training-coverage-meta">${filtered.length} von ${model.items.length} registrierten Prozessbereichen sichtbar</div>
    <div class="training-coverage-table-wrap"><table class="training-coverage-table"><caption>SOP-Abdeckung nach Prozessbereich</caption><thead><tr><th>Bereich</th><th>Funktion / SOP</th><th>Hauptstatus</th><th>Fähigkeiten</th><th>Kunde / Overlay</th></tr></thead><tbody>${filtered.map(rowHtml).join('')}</tbody></table></div>
  </section>`;
}
function mount(target,options={}){
  const root=typeof target==='string'?(g.document&&g.document.querySelector(target)):target;
  if(!root)throw new Error('TRAINING_COVERAGE_ROOT_MISSING');
  let center=options.center||{};
  let filters={area:'',status:'',customer:text(options.customerId),capability:''};
  let model=buildModel(center,{customerId:filters.customer});
  let destroyed=false;
  function paint(){if(destroyed)return;root.innerHTML=render(model,filters);bind();}
  function refreshCustomer(){model=buildModel(center,{customerId:filters.customer});}
  function bind(){
    for(const node of root.querySelectorAll('[data-coverage-filter]'))node.addEventListener('change',event=>{
      const key=event.currentTarget.getAttribute('data-coverage-filter');
      filters={...filters,[key]:event.currentTarget.value||''};
      if(key==='customer')refreshCustomer();
      paint();
    });
    const reset=root.querySelector('[data-coverage-reset]');
    if(reset)reset.addEventListener('click',()=>{filters={area:'',status:'',customer:'',capability:''};refreshCustomer();paint();});
  }
  function update(next={}){if(next.center)center=next.center;filters={...filters,...(next.filters||{})};refreshCustomer();paint();}
  function destroy(){destroyed=true;root.replaceChildren();}
  paint();
  return Object.freeze({update,destroy,state:()=>({...filters})});
}

g.ExportHubTrainingCoverageDashboard=Object.freeze({buildModel,filterItems,render,mount});
})(globalThis);
