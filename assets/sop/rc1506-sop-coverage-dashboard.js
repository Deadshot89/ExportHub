(function(root){
'use strict';
const RC1523_DE=Object.freeze({
  "sop.area":"Bereich",
  "sop.allAreas":"Alle Bereiche",
  "sop.status":"Status",
  "sop.allStatuses":"Alle Status",
  "sop.editor.customer":"Kunde",
  "sop.coverage.noneCapability":"Keine Zusatzfähigkeit",
  "sop.coverage.noOpenIssues":"Keine offenen Punkte",
  "sop.coverage.overlay":"Kunden-Overlay",
  "sop.coverage.noApprovedOverlay":"Kein freigegebenes Overlay",
  "sop.coverage.noCustomer":"Kein Kunde gewählt",
  "sop.coverage.openSop":"SOP öffnen",
  "sop.coverage.openStep":"Schritt öffnen",
  "sop.coverage.openOverlay":"Overlay öffnen",
  "sop.coverage.noSopNumber":"Keine SOP-Nummer",
  "sop.coverage.filterAria":"Coverage filtern",
  "sop.coverage.allBaseContext":"Alle / Basiskontext",
  "sop.coverage.capability":"Fähigkeit",
  "sop.coverage.allCapabilities":"Alle Fähigkeiten",
  "sop.coverage.resetFilters":"Filter zurücksetzen",
  "sop.coverage.noMatches":"Keine SOPs für die gewählten Filter.",
  "sop.coverage.context":"Coverage-Kontext: {{customer}}. Die Abdeckungsquote bleibt auf dem registrierten Funktionsumfang basiert.",
  "sop.coverage.admin":"SOPMaster Administration",
  "sop.coverage.title":"SOPMaster Coverage",
  "sop.coverage.intro":"Abdeckung, Vollständigkeit und Zusatzfähigkeiten der registrierten ExportHUB-Prozesse.",
  "sop.coverage.readOnly":"Nur Lesen",
  "sop.coverage.rate":"Abdeckungsquote",
  "sop.coverage.missing":"SOP fehlt",
  "sop.coverage.incomplete":"SOP unvollständig",
  "sop.coverage.complete":"SOP vollständig",
  "sop.coverage.tourPresent":"Tour vorhanden",
  "sop.coverage.imagePresent":"Bildanleitung vorhanden",
  "sop.coverage.resultMeta":"{{shown}} von {{total}} registrierten Prozessbereichen sichtbar",
  "sop.coverage.tableCaption":"SOP-Abdeckung nach Prozessbereich",
  "sop.coverage.header.function":"Funktion / SOP",
  "sop.coverage.header.mainStatus":"Hauptstatus",
  "sop.coverage.header.capabilities":"Fähigkeiten",
  "sop.coverage.header.customerOverlay":"Kunde / Overlay",
  "sop.coverage.header.actions":"Aktionen"
});
if(root.ExportHubSopCoverageDashboard)return;

const CAPABILITIES=Object.freeze([
  Object.freeze({id:'tour',symbol:'🔵',label:'Tour vorhanden'}),
  Object.freeze({id:'image',symbol:'🟣',label:'Bildanleitung vorhanden'})
]);
const STATUS_META=Object.freeze({
  red:Object.freeze({symbol:'🔴',label:'SOP fehlt'}),
  yellow:Object.freeze({symbol:'🟡',label:'SOP unvollständig'}),
  green:Object.freeze({symbol:'🟢',label:'SOP vollständig'})
});
const REASON_LABELS=Object.freeze({
  SOP_NUMBER_REQUIRED:'SOP-Nummer fehlt',
  SOP_MISSING:'SOP fehlt',
  SOP_NOT_RELEASED:'SOP ist nicht freigegeben',
  STEP_MISSING:'Pflichtschritt fehlt',
  IMAGE_MISSING:'Bildanleitung fehlt',
  IMAGE_FILE_MISSING:'Bilddatei fehlt',
  TOUR_MISSING:'Interaktive Tour fehlt',
  EXAM_MISSING:'Prüfungsbezug fehlt',
  TARGET_MISMATCH:'Tour-Ziel stimmt nicht überein',
  TARGET_MISSING:'Tour-Ziel fehlt in der Live-Prüfung',
  TARGET_DUPLICATE:'Tour-Ziel ist mehrfach vorhanden',
  TARGET_UNAVAILABLE:'Tour-Ziel kann nicht geprüft werden',
  CUSTOMER_OVERLAY_MISSING:'Kunden-Overlay fehlt',
  CUSTOMER_OVERLAY_NOT_RELEASED:'Kunden-Overlay ist nicht freigegeben',
  CUSTOMER_OVERLAY_INVALID:'Kunden-Overlay ist ungültig'
});

function text(value){return String(value==null?'':value).trim();}
function list(value){return Array.isArray(value)?value:[];}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function own(object,key){return !!object&&Object.prototype.hasOwnProperty.call(object,key);}
function unique(values){return Array.from(new Set(list(values).map(text).filter(Boolean)));}
function coverageApi(){return root.ExportHubSopCoverage;}
function interpolate(value,vars){return String(value==null?'':value).replace(/\{\{\s*([\w.-]+)\s*\}\}/g,(_,key)=>vars&&Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):'');}
function tr(key,fallback,vars){
  try{
    const api=root.ExportHUBI18n;
    if(api&&typeof api.t==='function'){
      const value=api.t(key,vars);
      if(value&&value!==key)return value;
    }
  }catch(_){}
  return interpolate(fallback,vars);
}
function th(key,fallback,vars){return esc(tr(key,fallback,vars));}
function customerIdOf(customer){return text(customer&&((customer.id!==undefined?customer.id:undefined)??customer.customerId??customer.account??customer.value));}
function customerNameOf(customer){return text(customer&&((customer.name!==undefined?customer.name:undefined)??customer.customerName??customer.label??customer.account??customer.id));}
function customersOf(value){
  const seen=new Set();
  return list(value).reduce((out,customer)=>{
    const id=customerIdOf(customer);if(!id||seen.has(id))return out;seen.add(id);
    out.push({id,name:customerNameOf(customer)||id});return out;
  },[]);
}
function statusMeta(status){const code=text(status),base=STATUS_META[code]||{symbol:'',label:code||'Unbekannt'};const keys={red:'sop.coverage.missing',yellow:'sop.coverage.incomplete',green:'sop.coverage.complete'};return {symbol:base.symbol,label:keys[code]?tr(keys[code],base.label):base.label};}
function reasonLabel(reason){const code=text(reason);return REASON_LABELS[code]||code;}
function capabilitiesOf(row){
  const caps=row&&row.capabilities||{};const result=[];
  if(caps.tour&&caps.tour.present)result.push({...CAPABILITIES[0],label:tr('sop.coverage.tourPresent',CAPABILITIES[0].label)});
  if(caps.image&&caps.image.present)result.push({...CAPABILITIES[1],label:tr('sop.coverage.imagePresent',CAPABILITIES[1].label)});
  return result;
}
function summaryFrom(coverage){
  const counts=coverage&&coverage.counts||{};
  return {
    total:Number(counts.total)||0,
    percentage:Number.isFinite(Number(coverage&&coverage.percentage))?Number(coverage.percentage):0,
    red:Number(counts.red)||0,
    yellow:Number(counts.yellow)||0,
    green:Number(counts.green)||0,
    tour:Number(counts.tour)||0,
    image:Number(counts.image)||0
  };
}
function buildModel(options={}){
  const api=coverageApi();
  if(!api||typeof api.scan!=='function')throw new Error('RC1505 SOP Coverage Scanner ist nicht geladen.');
  const customerId=text(options.customerId);
  const customers=customersOf(options.customers);
  const scanOptions={customerId};
  if(Array.isArray(options.entries))scanOptions.entries=options.entries;
  if(Array.isArray(options.documents))scanOptions.documents=options.documents;
  if(typeof options.assetExists==='function')scanOptions.assetExists=options.assetExists;
  if(typeof options.targetResolver==='function')scanOptions.targetResolver=options.targetResolver;
  if(own(options,'scope'))scanOptions.scope=options.scope;
  const coverage=api.scan(scanOptions);
  const items=list(coverage&&coverage.items).map(source=>{
    const row=clone(source)||{};
    row.customerId=customerId;
    return row;
  });
  const customer=customers.find(item=>item.id===customerId)||null;
  return {
    coverage:{...clone(coverage),items},
    items,
    summary:summaryFrom(coverage),
    context:{customerId,customerName:customer?customer.name:''},
    customers,
    options:{
      areas:unique(items.map(item=>item.area)).sort((a,b)=>a.localeCompare(b,'de')),
      statuses:['red','yellow','green'],
      capabilities:CAPABILITIES.map(item=>({id:item.id,label:item.label,symbol:item.symbol}))
    }
  };
}
function filterItems(items,filters={}){
  const area=text(filters.area),status=text(filters.status),capability=text(filters.capability);
  return list(items).filter(row=>{
    if(area&&text(row&&row.area)!==area)return false;
    if(status&&text(row&&row.status)!==status)return false;
    if(capability){
      const cap=row&&row.capabilities&&row.capabilities[capability];
      if(!cap||cap.present!==true)return false;
    }
    return true;
  });
}
function navigationFor(row,kind='sop'){
  const item=row&&typeof row==='object'?row:{};const type=text(kind)||'sop';
  const sopNumber=text(item.sopNumber),stepId=text(item.stepId),customerId=text(item.customerId);
  if(type==='sop')return sopNumber?{kind:'sop',view:'sop',sopNumber}:null;
  if(type==='step')return sopNumber&&stepId?{kind:'step',view:'sop',sopNumber,stepId}:null;
  if(type==='overlay'){
    const overlay=text(item.customerOverlay&&item.customerOverlay.number);
    return item.customerOverlay&&item.customerOverlay.present===true&&overlay?{kind:'overlay',view:'sop',sopNumber:overlay,baseSopNumber:sopNumber,customerId}:null;
  }
  return null;
}
function focusStep(stepId,options={}){
  const id=text(stepId);if(!id)return false;
  const doc=options.document||root.document;if(!doc||typeof doc.getElementById!=='function')return false;
  const node=doc.getElementById(id);if(!node)return false;
  try{if(typeof node.scrollIntoView==='function')node.scrollIntoView({block:'center',behavior:'smooth'});}catch(_){try{node.scrollIntoView();}catch(__){}}
  try{if(typeof node.hasAttribute==='function'&&!node.hasAttribute('tabindex')&&typeof node.setAttribute==='function')node.setAttribute('tabindex','-1');if(typeof node.focus==='function')node.focus({preventScroll:true});}catch(_){}
  return true;
}
function dispatchNavigation(target){
  try{
    if(typeof root.CustomEvent==='function'&&root.dispatchEvent)root.dispatchEvent(new root.CustomEvent('exporthub:sop:navigate',{detail:clone(target)}));
  }catch(_){}
}
function navigate(target,options={}){
  if(!target||!text(target.sopNumber))return false;
  if(typeof options.onNavigate==='function'){
    options.onNavigate(clone(target));
    return true;
  }
  const controller=options.sopController;
  if(controller&&typeof controller.open==='function'){
    try{
      if(typeof root.setView==='function')root.setView('sop');
      controller.open(target.sopNumber);
      if(target.kind==='step'&&target.stepId){
        const schedule=typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame.bind(root):(fn=>{if(typeof root.setTimeout==='function')root.setTimeout(fn,0);else fn();});
        schedule(()=>focusStep(target.stepId,options));
      }
      dispatchNavigation(target);
      return true;
    }catch(_){}
  }
  try{root.__EXPORTHUB_SOP_PENDING_NAV__=clone(target);}catch(_){}
  try{if(typeof root.setView==='function')root.setView('sop');}catch(_){}
  dispatchNavigation(target);
  return true;
}
function option(value,label,selected){return `<option value="${esc(value)}"${text(selected)===text(value)?' selected':''}>${esc(label)}</option>`;}
function kpiCard(kind,symbol,label,value,suffix=''){
  return `<article class="rc1506-kpi rc1506-kpi-${esc(kind)}" data-kpi="${esc(kind)}"><span class="rc1506-kpi-symbol" aria-hidden="true">${symbol}</span><div><span>${esc(label)}</span><strong>${esc(value)}${esc(suffix)}</strong></div></article>`;
}
function capabilityBadges(row){
  const caps=capabilitiesOf(row);
  return caps.length?caps.map(cap=>`<span class="rc1506-capability rc1506-capability-${esc(cap.id)}"><span aria-hidden="true">${cap.symbol}</span>${esc(cap.label)}</span>`).join(''):`<span class="rc1506-muted">${th('sop.coverage.noneCapability',RC1523_DE['sop.coverage.noneCapability'])}</span>`;
}
function reasonList(row){
  const reasons=list(row&&row.reasons);if(!reasons.length)return `<span class="rc1506-muted">${th('sop.coverage.noOpenIssues',RC1523_DE['sop.coverage.noOpenIssues'])}</span>`;
  return `<ul class="rc1506-reasons">${reasons.map(reason=>`<li>${esc(reasonLabel(reason))}</li>`).join('')}</ul>`;
}
function navButton(kind,label,row){const target=navigationFor(row,kind);if(!target)return'';return `<button type="button" class="rc1506-action" data-coverage-nav="${esc(kind)}" data-coverage-row="${esc(row.id)}">${esc(label)}</button>`;}
function rowHtml(row){
  const status=statusMeta(row.status),overlay=row&&row.customerOverlay||{};
  const overlayText=overlay.present?`<span class="rc1506-overlay"><strong>${esc(overlay.number)}</strong><small>${th('sop.coverage.overlay',RC1523_DE['sop.coverage.overlay'])}</small></span>`:(row.customerId?`<span class="rc1506-muted">${th('sop.coverage.noApprovedOverlay',RC1523_DE['sop.coverage.noApprovedOverlay'])}</span>`:`<span class="rc1506-muted">${th('sop.coverage.noCustomer',RC1523_DE['sop.coverage.noCustomer'])}</span>`);
  const actions=[navButton('sop',tr('sop.coverage.openSop',RC1523_DE['sop.coverage.openSop']),row),navButton('step',tr('sop.coverage.openStep',RC1523_DE['sop.coverage.openStep']),row),navButton('overlay',tr('sop.coverage.openOverlay',RC1523_DE['sop.coverage.openOverlay']),row)].filter(Boolean).join('');
  return `<tr data-coverage-row-id="${esc(row.id)}" data-status="${esc(row.status)}"><td data-label="${th('sop.area',RC1523_DE['sop.area'])}">${esc(row.area||'—')}</td><td data-label="${th('sop.coverage.header.function',RC1523_DE['sop.coverage.header.function'])}"><strong>${esc(row.id||'—')}</strong><span class="rc1506-subline">${esc(row.sopNumber||tr('sop.coverage.noSopNumber',RC1523_DE['sop.coverage.noSopNumber']))}</span></td><td data-label="${th('sop.coverage.header.mainStatus',RC1523_DE['sop.coverage.header.mainStatus'])}"><span class="rc1506-status rc1506-status-${esc(row.status)}"><span aria-hidden="true">${status.symbol}</span>${esc(status.label)}</span>${reasonList(row)}</td><td data-label="${th('sop.coverage.header.capabilities',RC1523_DE['sop.coverage.header.capabilities'])}"><div class="rc1506-capabilities">${capabilityBadges(row)}</div></td><td data-label="${th('sop.coverage.header.customerOverlay',RC1523_DE['sop.coverage.header.customerOverlay'])}">${overlayText}</td><td data-label="${th('sop.coverage.header.actions',RC1523_DE['sop.coverage.header.actions'])}"><div class="rc1506-actions">${actions}</div></td></tr>`;
}
function filterHtml(model,filters){
  const areas=list(model&&model.options&&model.options.areas),customers=list(model&&model.customers);const f=filters||{};
  const areaOptions=areas.map(area=>option(area,area,f.area)).join('');
  const statusOptions=['red','yellow','green'].map(status=>{const meta=statusMeta(status);return option(status,`${meta.symbol} ${meta.label}`,f.status);}).join('');
  const customerOptions=customers.map(customer=>option(customer.id,customer.name,f.customerId)).join('');
  const capabilityOptions=capabilitiesOf({capabilities:{tour:{present:true},image:{present:true}}}).map(cap=>option(cap.id,`${cap.symbol} ${cap.label}`,f.capability)).join('');
  return `<section class="rc1506-filters" aria-label="${th('sop.coverage.filterAria',RC1523_DE['sop.coverage.filterAria'])}"><label>${th('sop.area',RC1523_DE['sop.area'])}<select data-coverage-filter="area"><option value="">${th('sop.allAreas',RC1523_DE['sop.allAreas'])}</option>${areaOptions}</select></label><label>${th('sop.status',RC1523_DE['sop.status'])}<select data-coverage-filter="status"><option value="">${th('sop.allStatuses',RC1523_DE['sop.allStatuses'])}</option>${statusOptions}</select></label><label>${th('sop.editor.customer',RC1523_DE['sop.editor.customer'])}<select data-coverage-filter="customerId"><option value="">${th('sop.coverage.allBaseContext',RC1523_DE['sop.coverage.allBaseContext'])}</option>${customerOptions}</select></label><label>${th('sop.coverage.capability',RC1523_DE['sop.coverage.capability'])}<select data-coverage-filter="capability"><option value="">${th('sop.coverage.allCapabilities',RC1523_DE['sop.coverage.allCapabilities'])}</option>${capabilityOptions}</select></label><button type="button" class="rc1506-reset" data-coverage-reset>${th('sop.coverage.resetFilters',RC1523_DE['sop.coverage.resetFilters'])}</button></section>`;
}
function render(model,filters={}){
  const data=model&&typeof model==='object'?model:{items:[],summary:summaryFrom({}),options:{areas:[]},customers:[],context:{}};
  const effectiveFilters={area:text(filters.area),status:text(filters.status),customerId:text(filters.customerId||data.context&&data.context.customerId),capability:text(filters.capability)};
  const rows=filterItems(data.items,effectiveFilters);const s=data.summary||summaryFrom({});
  const body=rows.length?rows.map(rowHtml).join(''):`<tr><td colspan="6"><div class="rc1506-empty" role="status">${th('sop.coverage.noMatches',RC1523_DE['sop.coverage.noMatches'])}</div></td></tr>`;
  const customerContext=data.context&&data.context.customerId?`<p class="rc1506-context">${th('sop.coverage.context',RC1523_DE['sop.coverage.context'],{customer:data.context.customerName||data.context.customerId})}</p>`:'';
  return `<section class="rc1506-dashboard" data-sop-coverage-dashboard><header class="rc1506-header"><div><p class="rc1506-eyebrow">${th('sop.coverage.admin',RC1523_DE['sop.coverage.admin'])}</p><h1>${th('sop.coverage.title',RC1523_DE['sop.coverage.title'])}</h1><p>${th('sop.coverage.intro',RC1523_DE['sop.coverage.intro'])}</p></div><span class="rc1506-readonly">${th('sop.coverage.readOnly',RC1523_DE['sop.coverage.readOnly'])}</span></header><div class="rc1506-kpis">${kpiCard('coverage','◎',tr('sop.coverage.rate',RC1523_DE['sop.coverage.rate']),s.percentage,'%')}${kpiCard('red','🔴',tr('sop.coverage.missing',RC1523_DE['sop.coverage.missing']),s.red)}${kpiCard('yellow','🟡',tr('sop.coverage.incomplete',RC1523_DE['sop.coverage.incomplete']),s.yellow)}${kpiCard('green','🟢',tr('sop.coverage.complete',RC1523_DE['sop.coverage.complete']),s.green)}${kpiCard('tour','🔵',tr('sop.coverage.tourPresent',RC1523_DE['sop.coverage.tourPresent']),s.tour)}${kpiCard('image','🟣',tr('sop.coverage.imagePresent',RC1523_DE['sop.coverage.imagePresent']),s.image)}</div>${filterHtml(data,effectiveFilters)}${customerContext}<div class="rc1506-result-meta" aria-live="polite">${th('sop.coverage.resultMeta',RC1523_DE['sop.coverage.resultMeta'],{shown:rows.length,total:Number(s.total)||0})}</div><div class="rc1506-table-wrap"><table class="rc1506-table"><caption class="rc1506-sr-only">${th('sop.coverage.tableCaption',RC1523_DE['sop.coverage.tableCaption'])}</caption><thead><tr><th>${th('sop.area',RC1523_DE['sop.area'])}</th><th>${th('sop.coverage.header.function',RC1523_DE['sop.coverage.header.function'])}</th><th>${th('sop.coverage.header.mainStatus',RC1523_DE['sop.coverage.header.mainStatus'])}</th><th>${th('sop.coverage.header.capabilities',RC1523_DE['sop.coverage.header.capabilities'])}</th><th>${th('sop.coverage.header.customerOverlay',RC1523_DE['sop.coverage.header.customerOverlay'])}</th><th>${th('sop.coverage.header.actions',RC1523_DE['sop.coverage.header.actions'])}</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

function mount(target,options={}){
  const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;if(!host)return null;
  const state={
    options:{...options},
    filters:{area:'',status:'',customerId:text(options.customerId),capability:''},
    model:null
  };
  function rebuild(){state.model=buildModel({...state.options,customerId:state.filters.customerId});}
  function paint(){if(!state.model)rebuild();host.innerHTML=render(state.model,state.filters);}
  function onChange(event){
    const el=event&&event.target;const key=el&&el.getAttribute?text(el.getAttribute('data-coverage-filter')):'';if(!key)return;
    state.filters[key]=text(el.value);
    if(key==='customerId')rebuild();
    paint();
  }
  function onClick(event){
    const reset=event&&event.target&&event.target.closest?event.target.closest('[data-coverage-reset]'):null;
    if(reset){state.filters={area:'',status:'',customerId:'',capability:''};rebuild();paint();return;}
    const action=event&&event.target&&event.target.closest?event.target.closest('[data-coverage-nav]'):null;if(!action)return;
    const id=text(action.getAttribute('data-coverage-row'));const kind=text(action.getAttribute('data-coverage-nav'));
    const row=list(state.model&&state.model.items).find(item=>text(item&&item.id)===id);const targetInfo=navigationFor(row,kind);
    navigate(targetInfo,{...state.options,document:state.options.document||root.document});
  }
  host.addEventListener('change',onChange);host.addEventListener('click',onClick);rebuild();paint();
  return {
    state,
    refresh(next={}){state.options={...state.options,...next};if(own(next,'customerId'))state.filters.customerId=text(next.customerId);rebuild();paint();return state.model;},
    getModel(){return state.model;},
    destroy(){host.removeEventListener('change',onChange);host.removeEventListener('click',onClick);}
  };
}

root.ExportHubSopCoverageDashboard=Object.freeze({CAPABILITIES,STATUS_META,REASON_LABELS,buildModel,filterItems,render,navigationFor,navigate,mount});
})(typeof globalThis!=='undefined'?globalThis:this);
