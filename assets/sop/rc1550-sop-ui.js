(function(root){
'use strict';
if(root.ExportHubRc1550SopUi)return;

const legacy=root.ExportHubIsoSopUi;
const catalog=root.ExportHubSopActiveCatalog;
const model=root.ExportHubIsoSopModel;
if(!legacy||!catalog)return;

// RC1550 ist im produktiven Pfad der autoritative Katalog. Der historische
// Katalog bleibt als Quelldatei erhalten, wird aber nicht mehr aktiv gerendert.
root.ExportHubIsoSopCatalog=catalog;

function text(value){return String(value==null?'':value).trim();}
function arr(value){return Array.isArray(value)?value:[];}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function tr(key,fallback){try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function'){const value=root.ExportHUBI18n.t(key);if(value&&value!==key)return value;}}catch(_){}return fallback;}
function rightsOf(value){const r=value&&typeof value==='object'?value:{};const admin=r.admin===true||r.functionAdmin===true||r.level==='admin';const edit=admin||r.edit===true||r.level==='edit';const read=edit||r.read===true||r.visible===true||r.level==='view';return {read,edit,admin,functionAdmin:admin};}
function statusOf(doc){const current=model&&typeof model.currentVersionRecord==='function'?model.currentVersionRecord(doc):null;return text(current&&current.status)||text(doc&&doc.status);}
function versionOf(doc){const current=model&&typeof model.currentVersionRecord==='function'?model.currentVersionRecord(doc):null;return text(current&&current.version)||text(doc&&doc.currentVersion)||text(doc&&doc.version)||'1.0';}
function canonical(documents){const source=arr(documents);if(model&&typeof model.reconcileCatalog==='function')return model.reconcileCatalog(source,catalog.documents);return catalog.documents.slice();}
function visible(documents,rights){const r=rightsOf(rights);if(!r.read)return[];const docs=canonical(documents);if(r.edit||r.admin)return docs;return docs.filter(doc=>statusOf(doc)==='Freigegeben');}
function prepared(options={}){const r=rightsOf(options.rights);const all=visible(options.documents||catalog.documents,r);const filters=options.filters||{};const docs=model&&typeof model.filterDocuments==='function'?model.filterDocuments(all,filters):all;return {r,all,docs,filters};}
function docByNumber(documents,number){const wanted=text(number);return arr(documents).find(doc=>text(doc&&doc.number)===wanted)||null;}
function docsForGroup(documents,group){const ids=new Set(arr(group&&group.documents).map(text));return arr(documents).filter(doc=>ids.has(text(doc&&doc.number)));}
function emptyText(){return tr('sop.rc1550.emptyGroup','Noch keine SOP veröffentlicht');}

function filtersHtml(filters){const f=filters||{};return `<div class="rc1550-sop-filters"><label>${esc(tr('sop.search','SOP suchen'))}<input type="search" data-sop-filter="query" value="${esc(f.query||f.q||'')}" placeholder="${esc(tr('sop.searchPlaceholder','Nummer, Kunde, Dienstleister oder Stichwort'))}"></label><label>${esc(tr('sop.status','Status'))}<select data-sop-filter="status"><option value="">${esc(tr('sop.allStatuses','Alle Status'))}</option><option value="Freigegeben"${text(f.status)==='Freigegeben'?' selected':''}>${esc(tr('sop.status.released','Freigegeben'))}</option><option value="Entwurf"${text(f.status)==='Entwurf'?' selected':''}>${esc(tr('sop.status.draft','Entwurf'))}</option><option value="In Prüfung"${text(f.status)==='In Prüfung'?' selected':''}>${esc(tr('sop.status.review','In Prüfung'))}</option><option value="Archiviert"${text(f.status)==='Archiviert'?' selected':''}>${esc(tr('sop.status.archived','Archiviert'))}</option></select></label></div>`;}
function card(doc){return `<article class="rc1550-sop-card"><div class="rc1550-sop-card-top"><span>${esc(doc.number)}</span><span data-status="${esc(statusOf(doc))}">${esc(statusOf(doc)||'—')}</span></div><h4>${esc(doc.title)}</h4><p>${esc(doc.group||doc.area||'')}</p><div class="rc1550-sop-card-meta"><span>${esc(tr('sop.version','Version'))} ${esc(versionOf(doc))}</span><span>${esc(text(doc.validFrom)||'—')}</span></div><button type="button" data-sop-open="${esc(doc.number)}">${esc(tr('sop.open','Öffnen'))}</button></article>`;}
function categoryHtml(category,documents,compact=false,activeNumber=''){
  const groups=arr(category&&category.groups);
  const groupHtml=groups.length?groups.map(group=>{const items=docsForGroup(documents,group);if(compact)return `<div class="rc1550-sop-nav-group"><h4>${esc(group.label)}</h4>${items.length?items.map(doc=>`<button type="button" class="rc1550-sop-nav-item${text(activeNumber)===text(doc.number)?' active':''}" data-sop-open="${esc(doc.number)}"><span>${esc(doc.number)}</span><strong>${esc(doc.title)}</strong><small>${esc(versionOf(doc))} · ${esc(statusOf(doc))}</small></button>`).join(''):`<p class="rc1550-sop-empty-group">${esc(emptyText())}</p>`}</div>`;return `<div class="rc1550-sop-group"><div class="rc1550-sop-group-head"><h3>${esc(group.label)}</h3><span>${items.length}</span></div>${items.length?`<div class="rc1550-sop-grid">${items.map(card).join('')}</div>`:`<p class="rc1550-sop-empty-group">${esc(emptyText())}</p>`}</div>`;}).join(''):`<p class="rc1550-sop-empty-group">${esc(emptyText())}</p>`;
  const count=groups.reduce((sum,group)=>sum+docsForGroup(documents,group).length,0);
  return `<section class="rc1550-sop-category" data-sop-category="${esc(category.id)}"><header><div><h2>${esc(category.label)}</h2><p>${esc(category.id==='customer'?tr('sop.rc1550.customerHint','Kundenspezifische Arbeitsanweisungen'):category.id==='carrier'?tr('sop.rc1550.carrierHint','Arbeitsanweisungen für Versanddienstleister'):tr('sop.rc1550.processHint','Allgemeine interne Prozessanweisungen'))}</p></div><span>${count}</span></header>${groupHtml}</section>`;
}
function hierarchy(documents,compact=false,activeNumber=''){return arr(catalog.categories).map(category=>categoryHtml(category,documents,compact,activeNumber)).join('');}

function renderOverview(options={}){const {r,docs,filters}=prepared(options);const denied=!r.read?`<div class="rc1550-sop-message">${esc(tr('sop.noReadPermission','Keine Leseberechtigung für SOPs.'))}</div>`:'';return `<div class="rc1550-sop-overview"><header class="rc1550-sop-hero"><div><p>${esc(tr('sop.controlledDocument','Gelenkte Arbeitsanweisungen'))}</p><h1>${esc(tr('sop.rc1550.title','SOP / Arbeitsanweisungen'))}</h1><p>${esc(tr('sop.rc1550.hero','Kunden-, Versanddienstleister- und Prozess-SOPs zentral finden und bearbeiten.'))}</p></div><div class="rc1550-sop-count"><strong>${docs.length}</strong><span>${esc(tr('sop.rc1550.activeCount','aktive SOPs'))}</span></div></header>${filtersHtml(filters)}${denied||hierarchy(docs,false,'')}</div>`;}

function renderWorkspace(options={}){const {r,docs,filters}=prepared(options);const requested=text(options.activeNumber);const active=requested?docByNumber(docs,requested):(docs[0]||null);const invalid=!!requested&&!active;const pane=!r.read?`<div class="rc1550-sop-message">${esc(tr('sop.noReadPermission','Keine Leseberechtigung für SOPs.'))}</div>`:invalid?`<div class="rc1550-sop-unavailable"><strong>${esc(tr('sop.rc1550.unavailableTitle','SOP nicht verfügbar'))}</strong><p>${esc(tr('sop.rc1550.unavailableText','Diese SOP gehört nicht mehr zum aktiven SOP-Bestand oder wurde ersetzt.'))}</p><code>${esc(requested)}</code></div>`:active?legacy.renderDocument(active,{rights:r,embedded:true}):`<div class="rc1550-sop-message">${esc(tr('sop.rc1550.noActive','Keine aktive SOP verfügbar.'))}</div>`;return `<div class="rc1550-sop-overview rc1550-sop-shell"><header class="rc1550-sop-hero"><div><p>${esc(tr('sop.controlledDocument','Gelenkte Arbeitsanweisungen'))}</p><h1>${esc(tr('sop.rc1550.title','SOP / Arbeitsanweisungen'))}</h1><p>${esc(tr('sop.rc1550.workspace','SOP auswählen und als geführte Arbeitsanweisung öffnen.'))}</p></div><div class="rc1550-sop-count"><strong>${docs.length}</strong><span>${esc(tr('sop.rc1550.activeCount','aktive SOPs'))}</span></div></header>${filtersHtml(filters)}<div class="rc1550-sop-workspace"><aside class="rc1550-sop-sidebar" aria-label="${esc(tr('sop.selectionAria','SOP-Auswahl'))}">${hierarchy(docs,true,active&&active.number)}</aside><main class="rc1550-sop-document-pane">${pane}</main></div></div>`;}

function mount(target,options={}){
  const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;if(!host)return null;
  const requested=text(options.activeNumber);const bridged=legacy.mount(target,Object.assign({},options,{documents:options.documents||catalog.documents}));if(!bridged||!bridged.state)return bridged;
  if(requested)bridged.state.activeNumber=requested;
  function paint(){host.innerHTML=renderWorkspace({documents:bridged.state.documents,rights:bridged.state.rights,filters:bridged.state.filters,activeNumber:bridged.state.activeNumber});}
  function repaintAfter(event){const target=event&&event.target;if(!target||!target.closest)return;if(target.closest('[data-sop-open],[data-sop-ref],[data-sop-back],[data-sop-editor-action],[data-sop-filter]'))Promise.resolve().then(paint);}
  host.addEventListener('click',repaintAfter);host.addEventListener('input',repaintAfter);host.addEventListener('change',repaintAfter);paint();
  const baseRefresh=typeof bridged.refresh==='function'?bridged.refresh.bind(bridged):null;const baseOpen=typeof bridged.open==='function'?bridged.open.bind(bridged):null;const baseDestroy=typeof bridged.destroy==='function'?bridged.destroy.bind(bridged):null;
  return Object.assign({},bridged,{refresh(next={}){if(baseRefresh)baseRefresh(Object.assign({},next,{documents:next.documents||bridged.state.documents}));if(next.rights)bridged.state.rights=next.rights;if(next.filters)bridged.state.filters=Object.assign({},next.filters);if(next.activeNumber!==undefined)bridged.state.activeNumber=text(next.activeNumber);paint();},open(number){if(baseOpen)baseOpen(number);bridged.state.activeNumber=text(number);paint();},destroy(){host.removeEventListener('click',repaintAfter);host.removeEventListener('input',repaintAfter);host.removeEventListener('change',repaintAfter);if(baseDestroy)baseDestroy();}});
}

const wrapped=Object.freeze(Object.assign({},legacy,{mount,renderOverview,renderWorkspace}));
root.ExportHubIsoSopUi=wrapped;
root.ExportHubRc1550SopUi=Object.freeze({mount,renderOverview,renderWorkspace,catalog});
})(typeof globalThis!=='undefined'?globalThis:this);
