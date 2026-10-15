(function(g){
'use strict';

function text(value){return String(value==null?'':value).trim();}
function list(value){return Array.isArray(value)?value:[];}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function coverage(){const api=g.ExportHubTrainingCoverage;if(!api||typeof api.scan!=='function')throw new Error('TRAINING_COVERAGE_MISSING');return api;}
function registry(){const api=g.ExportHubTrainingCoverageRegistry;if(!api||!Array.isArray(api.entries))throw new Error('TRAINING_COVERAGE_REGISTRY_MISSING');return api;}
function i18n(){const api=g.ExportHubTrainingCenterI18n;if(!api||typeof api.t!=='function')throw new Error('TRAINING_CENTER_I18N_MISSING');return api;}
function tr(key,vars){return i18n().t(key,vars);}
function unique(values){return Array.from(new Set(values.map(text).filter(Boolean)));}
function customersOf(center){
  const seen=new Set();const out=[];
  for(const item of list(center&&center.customerSops)){
    const id=text(item&&item.customerId);if(!id||seen.has(id))continue;seen.add(id);
    out.push({id,name:text(item.customerName)||id});
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}
function buildModel(center,options={}){
  const result=coverage().scan(center,{entries:registry().entries,customerId:options.customerId||''});
  return {
    center,
    items:result.items,
    summary:{...result.counts,percentage:result.percentage},
    areas:unique(result.items.map(item=>item.area)).sort((a,b)=>a.localeCompare(b)),
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
  if(status==='missing')return `🔴 ${esc(tr('coverage.missing'))}`;
  if(status==='incomplete')return `🟡 ${esc(tr('coverage.incomplete'))}`;
  if(status==='complete')return `🟢 ${esc(tr('coverage.complete'))}`;
  return esc(status);
}
function reasons(row){
  const keys={SOP_MISSING:'coverage.reason.sopMissing',SOP_NOT_RELEASED:'coverage.reason.notReleased',STEP_INCOMPLETE:'coverage.reason.stepIncomplete',IMAGE_MISSING:'coverage.reason.imageMissing',TOUR_MISSING:'coverage.reason.tourMissing'};
  const source=list(row&&row.reasons);
  return source.length?`<ul class="training-coverage-reasons">${source.map(code=>`<li>${esc(tr(keys[code]||code))}</li>`).join('')}</ul>`:`<span class="training-coverage-muted">${esc(tr('coverage.noOpenIssues'))}</span>`;
}
function capabilityBadges(row){
  const caps=[];
  if(row&&row.capabilities&&row.capabilities.tour)caps.push(`<span class="training-coverage-capability">🔵 ${esc(tr('coverage.tourPresent'))}</span>`);
  if(row&&row.capabilities&&row.capabilities.image)caps.push(`<span class="training-coverage-capability">🟣 ${esc(tr('coverage.imagePresent'))}</span>`);
  return caps.length?caps.join(''):`<span class="training-coverage-muted">${esc(tr('coverage.noneCapability'))}</span>`;
}
function rowHtml(row){
  const overlay=row&&row.customerOverlay&&row.customerOverlay.present?`<span class="training-coverage-overlay">${esc(row.customerOverlay.id)}</span>`:`<span class="training-coverage-muted">${esc(tr('coverage.noOverlay'))}</span>`;
  return `<tr data-coverage-row="${esc(row.id)}" data-status="${esc(row.status)}"><td>${esc(row.area)}</td><td><strong>${esc(row.title)}</strong><small>${esc(row.id)}</small></td><td><span class="training-coverage-status training-coverage-status-${esc(row.status)}">${statusLabel(row.status)}</span>${reasons(row)}</td><td><div class="training-coverage-capabilities">${capabilityBadges(row)}</div></td><td>${overlay}</td></tr>`;
}
function render(model,filters={}){
  const filtered=filterItems(model.items,filters);
  const s=model.summary;
  const areaOptions=[`<option value="">${esc(tr('coverage.allAreas'))}</option>`,...model.areas.map(value=>option(value,value,filters.area))].join('');
  const statusOptions=[`<option value="">${esc(tr('coverage.allStatuses'))}</option>`,option('missing',`🔴 ${tr('coverage.missing')}`,filters.status),option('incomplete',`🟡 ${tr('coverage.incomplete')}`,filters.status),option('complete',`🟢 ${tr('coverage.complete')}`,filters.status)].join('');
  const customerOptions=[`<option value="">${esc(tr('coverage.allCustomers'))}</option>`,...model.customers.map(customer=>option(customer.id,customer.name,filters.customer))].join('');
  const capabilityOptions=[`<option value="">${esc(tr('coverage.allCapabilities'))}</option>`,option('tour',`🔵 ${tr('coverage.tourPresent')}`,filters.capability),option('image',`🟣 ${tr('coverage.imagePresent')}`,filters.capability)].join('');
  return `<section class="training-coverage" data-training-coverage>
    <header class="training-coverage-header"><div><h1>${esc(tr('coverage.title'))}</h1><p>${esc(tr('coverage.intro'))}</p></div><span class="training-coverage-readonly">${esc(tr('coverage.readOnly'))}</span></header>
    <div class="training-coverage-kpis">
      ${card('rate',tr('coverage.rate'),s.percentage,'◉','%')}
      ${card('missing',tr('coverage.missing'),s.missing,'🔴')}
      ${card('incomplete',tr('coverage.incomplete'),s.incomplete,'🟡')}
      ${card('complete',tr('coverage.complete'),s.complete,'🟢')}
      ${card('tour',tr('coverage.tourPresent'),s.tour,'🔵')}
      ${card('image',tr('coverage.imagePresent'),s.image,'🟣')}
    </div>
    <form class="training-coverage-filters" data-coverage-filters aria-label="${esc(tr('coverage.title'))}">
      <label>${esc(tr('coverage.area'))}<select data-coverage-filter="area">${areaOptions}</select></label>
      <label>${esc(tr('coverage.status'))}<select data-coverage-filter="status">${statusOptions}</select></label>
      <label>${esc(tr('coverage.customer'))}<select data-coverage-filter="customer">${customerOptions}</select></label>
      <label>${esc(tr('coverage.capability'))}<select data-coverage-filter="capability">${capabilityOptions}</select></label>
      <button type="button" data-coverage-reset>${esc(tr('coverage.reset'))}</button>
    </form>
    <div class="training-coverage-meta">${esc(tr('coverage.resultMeta',{shown:filtered.length,total:model.items.length}))}</div>
    <div class="training-coverage-table-wrap"><table class="training-coverage-table"><caption>${esc(tr('coverage.tableCaption'))}</caption><thead><tr><th>${esc(tr('coverage.area'))}</th><th>${esc(tr('coverage.header.function'))}</th><th>${esc(tr('coverage.header.mainStatus'))}</th><th>${esc(tr('coverage.header.capabilities'))}</th><th>${esc(tr('coverage.header.customerOverlay'))}</th></tr></thead><tbody>${filtered.map(rowHtml).join('')}</tbody></table></div>
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
