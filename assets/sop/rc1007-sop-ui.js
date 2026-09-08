(function(root){
'use strict';

function esc(value){
  return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function arr(value){return Array.isArray(value)?value:[];}
function text(value){return String(value==null?'':value).trim();}
function rightsOf(value){
  const r=value&&typeof value==='object'?value:{};
  const admin=r.admin===true||r.functionAdmin===true||r.level==='admin';
  const edit=admin||r.edit===true||r.level==='edit';
  const read=edit||r.read===true||r.visible===true||r.level==='view';
  return {read,edit,admin,functionAdmin:admin};
}
function current(doc){
  const model=root.ExportHubIsoSopModel;
  return model&&typeof model.currentVersionRecord==='function'?model.currentVersionRecord(doc):null;
}
function value(doc,key){
  const version=current(doc);
  if(version&&version[key]!==undefined&&version[key]!==null&&text(version[key])) return version[key];
  return doc&&doc[key];
}
function statusOf(doc){return text(value(doc,'status'))||'Entwurf';}
function versionOf(doc){return text(value(doc,'version'))||text(doc&&doc.currentVersion)||'1.0';}
function sectionsOf(doc){
  const version=current(doc);
  if(version&&version.content&&typeof version.content==='object') return version.content;
  return doc&&doc.sections&&typeof doc.sections==='object'?doc.sections:{};
}
function visualsOf(doc){
  const version=current(doc);
  if(version&&Array.isArray(version.visuals)) return version.visuals;
  return arr(doc&&doc.visuals);
}
function visibleDocuments(documents,rights){
  const r=rightsOf(rights);
  if(!r.read) return [];
  if(r.edit||r.admin) return arr(documents);
  return arr(documents).filter(doc=>statusOf(doc)==='Freigegeben');
}
function renderProcessGraphic(doc){
  const steps=arr(doc&&doc.processFlow);
  if(!steps.length) return '';
  const cell=190;
  const width=Math.max(320,steps.length*cell);
  const nodes=steps.map((label,index)=>{
    const x=index*cell+15;
    const rect=`<rect x="${x}" y="24" width="155" height="64" rx="10" class="rc1007-sop-flow-node"></rect>`;
    const title=`<text x="${x+77.5}" y="52" text-anchor="middle" class="rc1007-sop-flow-number">${index+1}</text>`;
    const words=esc(label);
    const body=`<text x="${x+77.5}" y="72" text-anchor="middle" class="rc1007-sop-flow-label">${words}</text>`;
    const arrow=index<steps.length-1?`<line x1="${x+155}" y1="56" x2="${x+185}" y2="56" class="rc1007-sop-flow-line"></line><path d="M ${x+180} 50 L ${x+188} 56 L ${x+180} 62" class="rc1007-sop-flow-arrow"></path>`:'';
    return rect+title+body+arrow;
  }).join('');
  return `<div class="rc1007-sop-process" role="img" aria-label="Prozessübersicht ${esc(doc&&doc.number)}"><svg viewBox="0 0 ${width} 112" xmlns="http://www.w3.org/2000/svg">${nodes}</svg></div>`;
}
function renderVisual(visual,index){
  if(!visual||visual.type==='process') return '';
  const caption=esc(visual.caption||'Bildhinweis');
  if(visual.type==='screenshot'&&visual.src){
    return `<figure class="rc1007-sop-visual" data-visual-index="${index}"><img src="${esc(visual.src)}" alt="${caption}" loading="lazy"><figcaption>Bild ${index} – ${caption}</figcaption></figure>`;
  }
  return `<figure class="rc1007-sop-visual rc1007-sop-placeholder" data-visual-index="${index}"><div class="rc1007-sop-placeholder-box" aria-label="Bildplatzhalter"><span aria-hidden="true">▧</span><strong>${caption}</strong></div><figcaption>Bild ${index} – ${caption}</figcaption></figure>`;
}
function listHtml(items,empty='Keine Angaben erforderlich.'){
  const values=arr(items).filter(item=>text(item));
  if(!values.length) return `<p class="rc1007-sop-muted">${esc(empty)}</p>`;
  return `<ul>${values.map(item=>`<li>${esc(typeof item==='string'?item:(item.text||item.label||''))}</li>`).join('')}</ul>`;
}
function metaCell(label,val){return `<div class="rc1007-sop-meta-cell"><span>${esc(label)}</span><strong>${esc(text(val)||'—')}</strong></div>`;}
function section(title,body,id=''){return `<section class="rc1007-sop-section"${id?` id="${esc(id)}"`:''}><h2>${esc(title)}</h2>${body}</section>`;}
function renderSteps(doc,steps,visuals){
  const list=arr(steps);
  if(!list.length) return '<p class="rc1007-sop-muted">Kein Ablauf hinterlegt.</p>';
  let imageNo=0;
  return `<ol class="rc1007-sop-steps">${list.map((step,index)=>{
    const stepId=text(step&&step.id)||`step-${index+1}`;
    const attached=arr(visuals).filter(v=>v&&v.type!=='process'&&text(v.stepId)===stepId);
    const visualHtml=attached.map(v=>renderVisual(v,++imageNo)).join('');
    return `<li id="${esc(stepId)}"><div class="rc1007-sop-step-text"><strong>Schritt ${index+1}</strong><p>${esc(step&&step.text!==undefined?step.text:step)}</p></div>${visualHtml}</li>`;
  }).join('')}</ol>`;
}
function renderReferences(references){
  const refs=arr(references).filter(Boolean);
  if(!refs.length) return '<p class="rc1007-sop-muted">Keine internen Querverweise.</p>';
  return `<div class="rc1007-sop-reference-list">${refs.map(ref=>{
    const value=typeof ref==='string'?ref:(ref.number||ref.label||'');
    return /^SOP-(QM|SYS|LOG|WH|ORG)-\d{3}$/.test(value)?`<button type="button" class="rc1007-sop-link" data-sop-ref="${esc(value)}">${esc(value)}</button>`:`<span>${esc(value)}</span>`;
  }).join('')}</div>`;
}
function renderHistory(doc,sections){
  const history=arr(doc&&doc.history).length?arr(doc.history):arr(sections&&sections.changeHistory);
  if(!history.length) return '<p class="rc1007-sop-muted">Noch keine Versionshistorie vorhanden.</p>';
  return `<div class="rc1007-sop-history"><table><thead><tr><th>Version</th><th>Datum</th><th>Status</th><th>Änderung</th></tr></thead><tbody>${history.map(item=>`<tr><td>${esc(item.version)}</td><td>${esc(item.date||item.at||'—')}</td><td>${esc(item.status||item.action||'—')}</td><td>${esc(item.change||item.reason||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderDocument(doc,options={}){
  if(!doc) return '<div class="rc1007-sop-empty">SOP nicht gefunden.</div>';
  const r=rightsOf(options.rights);
  if(!r.read) return '<div class="rc1007-sop-empty">Keine Berechtigung zum Lesen dieser SOP.</div>';
  if(!r.edit&&!r.admin&&statusOf(doc)!=='Freigegeben') return '<div class="rc1007-sop-empty">Diese SOP ist noch nicht freigegeben.</div>';
  const s=sectionsOf(doc);
  const visuals=visualsOf(doc);
  const processVisual=visuals.find(v=>v&&v.type==='process');
  const processCaption=processVisual?`<p class="rc1007-sop-caption">${esc(processVisual.caption)}</p>`:'';
  const controls=`<div class="rc1007-sop-doc-actions"><button type="button" data-sop-back>Zurück zum SOP-Handbuch</button><button type="button" data-sop-print>Drucken</button>${r.edit?'<button type="button" data-sop-new-version>Neue Fassung</button>':''}${r.admin?'<button type="button" data-sop-review>Zur Prüfung</button><button type="button" data-sop-approve>Freigeben</button>':''}</div>`;
  return `<article class="rc1007-sop-document" data-sop-number="${esc(doc.number)}">${controls}<header class="rc1007-sop-document-head"><div><p class="rc1007-sop-eyebrow">Gelenktes Dokument</p><h1>${esc(doc.number)} – ${esc(doc.title)}</h1></div><span class="rc1007-sop-status" data-status="${esc(statusOf(doc))}">${esc(statusOf(doc))}</span></header><div class="rc1007-sop-meta">${metaCell('SOP-Nummer',doc.number)}${metaCell('Version',versionOf(doc))}${metaCell('Status',statusOf(doc))}${metaCell('Gültig ab',value(doc,'validFrom'))}${metaCell('Erstellt durch',value(doc,'createdBy'))}${metaCell('Geprüft durch',value(doc,'reviewedBy'))}${metaCell('Freigegeben durch',value(doc,'approvedBy'))}${metaCell('Prozessverantwortlicher',doc.processOwner)}${metaCell('Betroffene Bereiche',arr(doc.affectedAreas).join(', '))}${metaCell('Nächste Prüfung',doc.nextReview)}</div>${section('Zweck und Ziel',`<p>${esc(s.purpose||'')}</p>`)}${section('Geltungsbereich',`<p>${esc(s.scope||'')}</p>`)}${section('Begriffe / Definitionen',listHtml(s.definitions))}${section('Verantwortlichkeiten',listHtml(s.responsibilities))}${section('Voraussetzungen',listHtml(s.prerequisites))}${section('Benötigte Unterlagen, Systeme oder Hilfsmittel',listHtml(s.resources))}${section('Prozessübersicht',renderProcessGraphic(doc)+processCaption,'process-flow')}${section('Schritt-für-Schritt-Ablauf',renderSteps(doc,s.steps,visuals))}${section('Prüfpunkte und Freigabekriterien',listHtml(s.checks))}${section('Verhalten bei Abweichungen',listHtml(s.deviations))}${section('Nachweise und Aufzeichnungen',listHtml(s.records))}${section('Kennzahlen',listHtml(s.metrics,'Für diesen Prozess ist keine eigene Kennzahl festgelegt.'))}${section('Mitgeltende Dokumente',listHtml(s.relatedDocuments,'Keine weiteren Dokumente festgelegt.'))}${section('Querverweise auf andere SOPs',renderReferences(s.references||doc.references))}${section('Versionshistorie',renderHistory(doc,s))}</article>`;
}
function renderOverview(options={}){
  const catalog=root.ExportHubIsoSopCatalog;
  const model=root.ExportHubIsoSopModel;
  const r=rightsOf(options.rights);
  const all=visibleDocuments(options.documents||(catalog&&catalog.documents)||[],r);
  const filters=options.filters||{};
  const docs=model&&typeof model.filterDocuments==='function'?model.filterDocuments(all,filters):all;
  const areas=(catalog&&catalog.areas)||['Qualitätsmanagement','System / ExportHUB','Versand und Export','Lager','Organisation'];
  const areaOptions=areas.map(area=>`<option value="${esc(area)}"${text(filters.area)===area?' selected':''}>${esc(area)}</option>`).join('');
  const statusOptions=['Entwurf','In Prüfung','Freigegeben','Archiviert'].map(status=>`<option value="${status}"${text(filters.status)===status?' selected':''}>${status}</option>`).join('');
  const groups=areas.map(area=>{
    const items=docs.filter(doc=>doc.area===area);
    if(!items.length) return '';
    return `<section class="rc1007-sop-group"><div class="rc1007-sop-group-head"><h2>${esc(area)}</h2><span>${items.length} SOP${items.length===1?'':'s'}</span></div><div class="rc1007-sop-grid">${items.map(doc=>`<article class="rc1007-sop-card"><div class="rc1007-sop-card-top"><span class="rc1007-sop-number">${esc(doc.number)}</span><span class="rc1007-sop-status" data-status="${esc(statusOf(doc))}">${esc(statusOf(doc))}</span></div><h3>${esc(doc.title)}</h3><dl><div><dt>Version</dt><dd>${esc(versionOf(doc))}</dd></div><div><dt>Gültig ab</dt><dd>${esc(text(value(doc,'validFrom'))||'—')}</dd></div><div><dt>Nächste Prüfung</dt><dd>${esc(text(doc.nextReview)||'—')}</dd></div></dl><button type="button" data-sop-open="${esc(doc.number)}">Öffnen</button></article>`).join('')}</div></section>`;
  }).join('');
  const empty=!docs.length?`<div class="rc1007-sop-empty">${r.edit||r.admin?'Keine SOPs entsprechen den aktuellen Filtern.':'Keine freigegebenen SOPs verfügbar.'}</div>`:'';
  return `<div class="rc1007-sop-overview"><header class="rc1007-sop-hero"><div><p class="rc1007-sop-eyebrow">ISO 9001 · gelenkte Dokumente</p><h1>SOP-Handbuch</h1><p>Aktuelle Arbeitsanweisungen, Prozessverantwortung, Versionen und Nachweise zentral verwalten.</p></div><div class="rc1007-sop-count"><strong>${docs.length}</strong><span>angezeigte SOPs</span></div></header><div class="rc1007-sop-filters"><label>SOP suchen<input type="search" data-sop-filter="query" value="${esc(filters.query||filters.q||'')}" placeholder="Nummer, Titel oder Stichwort"></label><label>Bereich<select data-sop-filter="area"><option value="">Alle Bereiche</option>${areaOptions}</select></label><label>Status<select data-sop-filter="status"><option value="">Alle Status</option>${statusOptions}</select></label></div>${empty}${groups}</div>`;
}
function applyWorkflowAction(document,action,options={}){
  const model=root.ExportHubIsoSopModel;
  if(!model) throw new Error('ISO-SOP-Modell nicht geladen');
  switch(String(action||'').toLowerCase()){
    case 'draft':
    case 'new-version': return model.createDraftVersion(document,options);
    case 'review': return model.submitForReview(document,options);
    case 'approve': return model.approveVersion(document,options);
    case 'archive': return model.archiveVersion(document,options);
    default: throw new Error('Unbekannte SOP-Workflow-Aktion');
  }
}
function printDocument(){
  if(root&&typeof root.print==='function') root.print();
}
function mount(target,options={}){
  const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;
  if(!host) return null;
  const catalog=root.ExportHubIsoSopCatalog;
  const state={documents:options.documents||(catalog&&catalog.documents)||[],rights:options.rights||{},filters:{...(options.filters||{})},activeNumber:text(options.activeNumber)};
  function find(number){return state.documents.find(doc=>doc.number===number)||null;}
  function paint(){host.innerHTML=state.activeNumber?renderDocument(find(state.activeNumber),{rights:state.rights}):renderOverview({documents:state.documents,rights:state.rights,filters:state.filters});}
  function onClick(event){
    const open=event.target&&event.target.closest?event.target.closest('[data-sop-open]'):null;
    if(open){state.activeNumber=open.getAttribute('data-sop-open')||'';paint();return;}
    const ref=event.target&&event.target.closest?event.target.closest('[data-sop-ref]'):null;
    if(ref){state.activeNumber=ref.getAttribute('data-sop-ref')||'';paint();return;}
    if(event.target&&event.target.closest&&event.target.closest('[data-sop-back]')){state.activeNumber='';paint();return;}
    if(event.target&&event.target.closest&&event.target.closest('[data-sop-print]')){printDocument();return;}
    if(typeof options.onAction==='function'){
      const action=event.target&&event.target.closest?event.target.closest('[data-sop-new-version],[data-sop-review],[data-sop-approve]'):null;
      if(action) options.onAction({element:action,document:find(state.activeNumber),state});
    }
  }
  function onFilter(event){
    const el=event.target;
    const key=el&&el.getAttribute?el.getAttribute('data-sop-filter'):'';
    if(!key) return;
    state.filters[key]=el.value;
    paint();
  }
  host.addEventListener('click',onClick);
  host.addEventListener('input',onFilter);
  host.addEventListener('change',onFilter);
  paint();
  return {state,refresh(next={}){if(next.documents)state.documents=next.documents;if(next.rights)state.rights=next.rights;paint();},open(number){state.activeNumber=text(number);paint();},destroy(){host.removeEventListener('click',onClick);host.removeEventListener('input',onFilter);host.removeEventListener('change',onFilter);}};
}

root.ExportHubIsoSopUi=Object.freeze({mount,renderOverview,renderDocument,renderProcessGraphic,printDocument,applyWorkflowAction});
})(typeof globalThis!=='undefined'?globalThis:this);
