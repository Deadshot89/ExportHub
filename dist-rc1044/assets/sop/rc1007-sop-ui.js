(function(root){
'use strict';
const RC1523_DE=Object.freeze({
  "common.close":"Schließen",
  "sop.imageHint":"Bildhinweis",
  "sop.zoomImage":"Bild vergrößern",
  "sop.expectedResult":"Erwartetes Ergebnis",
  "sop.editor.validationError":"Fehler",
  "sop.editor.validationWarning":"Hinweis",
  "sop.editor.noStructuralErrors":"Keine strukturellen Fehler erkannt.",
  "sop.editor.field.title":"Titel",
  "sop.editor.field.targetPage":"Ziel/Seite",
  "sop.editor.field.instruction":"Anweisung",
  "sop.editor.moveUp":"Hoch",
  "sop.editor.moveDown":"Runter",
  "sop.editor.typeCustomer":"Kunden-SOP / Overlay",
  "sop.editor.typeProcess":"Prozess-SOP",
  "sop.editor.validationFailed":"Validierung fehlgeschlagen",
  "sop.editor.type":"Typ",
  "sop.editor.draft":"Entwurf",
  "sop.editor.noDraft":"Kein Entwurf",
  "sop.editor.changeReason":"Änderungsgrund",
  "sop.editor.customerContext":"Kundenbezug",
  "sop.editor.customer":"Kunde",
  "sop.editor.baseSop":"Basis-SOP",
  "sop.editor.customerOverlayNote":"Kundenabweichungen ergänzen die Basis-SOP; die freigegebene Prozess-SOP wird nicht überschrieben.",
  "sop.editor.newDraft":"Neue Entwurfsfassung",
  "sop.editor.version":"Version",
  "sop.editor.changePlaceholder":"Was wird geändert?",
  "sop.editor.createDraft":"Entwurf anlegen",
  "sop.editor.createCustomerSop":"Kunden-SOP anlegen",
  "sop.editor.customerNumber":"Kundennummer",
  "sop.editor.sopNumber":"SOP-Nummer",
  "sop.editor.customerDeviationPlaceholder":"Kundenspezifische Abweichung",
  "sop.editor.createCustomerButton":"Kunden-SOP erstellen",
  "sop.editor.workSteps":"Arbeitsschritte",
  "sop.editor.noDraftSteps":"Noch keine Schritte im Entwurf.",
  "sop.editor.addStep":"Schritt hinzufügen",
  "sop.editor.stepId":"Schritt-ID",
  "sop.editor.validation":"Validierung",
  "sop.editor.assignStepImage":"Schrittbild zuordnen",
  "sop.editor.step":"Schritt",
  "sop.editor.imageSource":"Bildquelle",
  "sop.editor.assignImage":"Bild zuordnen",
  "sop.editor.customerDeviations":"Kundenabweichungen",
  "sop.editor.overlaySeparateNote":"Dieses Overlay bleibt getrennt von der freigegebenen Basis-SOP und wird beim Aufruf anhand des Kundenkontexts aufgelöst.",
  "sop.editor.title":"SOP-Editor",
  "sop.editor.intro":"Änderungen werden nur in Entwürfen gespeichert. Freigegebene Fassungen bleiben unverändert.",
  "sop.editor.draftValid":"Entwurf gültig",
  "sop.editor.checkDraft":"Entwurf prüfen",
  "sop.editor.reasonEdited":"SOP überarbeitet",
  "sop.editor.reasonCustomerCreated":"RC1502 Kunden-SOP angelegt"
});

function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function arr(value){return Array.isArray(value)?value:[];}
function text(value){return String(value==null?'':value).trim();}
function tr(key,vars){try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function')return root.ExportHUBI18n.t(key,vars);}catch(_){}return key;}
function th(key,vars){return esc(tr(key,vars));}
function interpolate(value,vars){return String(value==null?'':value).replace(/\{\{\s*([\w.-]+)\s*\}\}/g,(_,key)=>vars&&Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):'');}
function tl(key,fallback,vars){const translated=tr(key,vars);return translated===key?interpolate(fallback,vars):translated;}
function tlh(key,fallback,vars){return esc(tl(key,fallback,vars));}
const SOP_STATUSES=Object.freeze({draft:'Entwurf',review:'In Prüfung',released:'Freigegeben',archived:'Archiviert'});
function statusDisplay(value){const raw=text(value);const key=raw===SOP_STATUSES.draft?'sop.status.draft':raw===SOP_STATUSES.review?'sop.status.review':raw===SOP_STATUSES.released?'sop.status.released':raw===SOP_STATUSES.archived?'sop.status.archived':'';return key?tr(key):raw;}
function rightsOf(value){const r=value&&typeof value==='object'?value:{};const admin=r.admin===true||r.functionAdmin===true||r.level==='admin';const edit=admin||r.edit===true||r.level==='edit';const read=edit||r.read===true||r.visible===true||r.level==='view';return {read,edit,admin,functionAdmin:admin};}
function current(doc){const model=root.ExportHubIsoSopModel;return model&&typeof model.currentVersionRecord==='function'?model.currentVersionRecord(doc):null;}
function value(doc,key){const version=current(doc);if(version&&version[key]!==undefined&&version[key]!==null&&text(version[key]))return version[key];return doc&&doc[key];}
function statusOf(doc){return text(value(doc,'status'))||SOP_STATUSES.draft;}
function versionOf(doc){return text(value(doc,'version'))||text(doc&&doc.currentVersion)||'1.0';}
function sectionsOf(doc){const version=current(doc);if(version&&version.content&&typeof version.content==='object')return version.content;return doc&&doc.sections&&typeof doc.sections==='object'?doc.sections:{};}
function visualsOf(doc){const version=current(doc);if(version&&Array.isArray(version.visuals))return version.visuals;return arr(doc&&doc.visuals);}
function visibleDocuments(documents,rights){const r=rightsOf(rights);if(!r.read)return[];if(r.edit||r.admin)return arr(documents);return arr(documents).filter(doc=>statusOf(doc)===SOP_STATUSES.released);}
function canonicalDocuments(documents){const catalog=root.ExportHubIsoSopCatalog;const model=root.ExportHubIsoSopModel;const source=arr(documents);if(model&&typeof model.reconcileCatalog==='function'&&catalog&&Array.isArray(catalog.documents))return model.reconcileCatalog(source,catalog.documents);return source.length?source:arr(catalog&&catalog.documents);}
function sameCatalog(a,b){const left=arr(a).map(doc=>text(doc&&doc.number));const right=arr(b).map(doc=>text(doc&&doc.number));return left.length===right.length&&left.every((number,index)=>number===right[index]);}

function renderProcessGraphic(doc){
  const steps=arr(doc&&doc.processFlow);if(!steps.length)return'';const cell=190;const width=Math.max(320,steps.length*cell);
  const nodes=steps.map((label,index)=>{const x=index*cell+15;const rect=`<rect x="${x}" y="24" width="155" height="64" rx="10" class="rc1007-sop-flow-node"></rect>`;const title=`<text x="${x+77.5}" y="52" text-anchor="middle" class="rc1007-sop-flow-number">${index+1}</text>`;const body=`<text x="${x+77.5}" y="72" text-anchor="middle" class="rc1007-sop-flow-label">${esc(label)}</text>`;const arrow=index<steps.length-1?`<line x1="${x+155}" y1="56" x2="${x+185}" y2="56" class="rc1007-sop-flow-line"></line><path d="M ${x+180} 50 L ${x+188} 56 L ${x+180} 62" class="rc1007-sop-flow-arrow"></path>`:'';return rect+title+body+arrow;}).join('');
  return `<div class="rc1007-sop-process" role="img" aria-label="${th('sop.processOverview')} ${esc(doc&&doc.number)}"><svg viewBox="0 0 ${width} 112" xmlns="http://www.w3.org/2000/svg">${nodes}</svg></div>`;
}
function handleImageError(event){const img=event&&event.target;if(!img||!img.matches||!img.matches('.rc1007-sop-visual img'))return;const figure=img.closest?img.closest('.rc1007-sop-visual'):null;const captionNode=figure&&figure.querySelector?figure.querySelector('figcaption'):null;const caption=text(captionNode&&captionNode.textContent)||text(img.alt)||tr('sop.imageFallback');if(!root.document||typeof root.document.createElement!=='function')return;const box=root.document.createElement('div');box.className='rc1007-sop-placeholder-box rc1007-sop-image-error';box.setAttribute('role','status');box.innerHTML='<strong>'+th('sop.imageLoadFailed')+'</strong><span>'+esc(caption)+'</span>';if(typeof img.replaceWith==='function')img.replaceWith(box);else if(img.parentNode)img.parentNode.replaceChild(box,img);}
function visualApi(){return root.ExportHubSopVisuals&&typeof root.ExportHubSopVisuals.normalize==='function'?root.ExportHubSopVisuals:null;}
function normalizedVisual(visual){const api=visualApi();return api?api.normalize(visual):visual;}
function pct(value,fallback=0){const number=Number(value);return Math.max(0,Math.min(100,Number.isFinite(number)?number:fallback));}
function annotationText(annotation){return text(annotation&&((annotation.text!==undefined?annotation.text:undefined)??annotation.label??annotation.caption));}
function annotationHtml(annotation,index){
  const item=annotation&&typeof annotation==='object'?annotation:{};const type=text(item.type);if(!type||type==='expectedResult')return'';
  const x=pct(item.x),y=pct(item.y);const label=esc(annotationText(item));
  if(type==='focus'||type==='crop'){
    const width=Math.max(1,pct(item.width,24)),height=Math.max(1,pct(item.height,18));
    return `<span class="rc1502-sop-annotation rc1502-sop-annotation-${esc(type)}" data-annotation-type="${esc(type)}" data-annotation-index="${index}" style="left:${x}%;top:${y}%;width:${width}%;height:${height}%"></span>`;
  }
  if(type==='marker')return `<span class="rc1502-sop-annotation rc1502-sop-annotation-marker" data-annotation-type="marker" data-annotation-index="${index}" style="left:${x}%;top:${y}%">${label||String(index+1)}</span>`;
  if(type==='caption')return `<span class="rc1502-sop-annotation rc1502-sop-annotation-caption" data-annotation-type="caption" data-annotation-index="${index}" style="left:${x}%;top:${y}%">${label}</span>`;
  if(type==='arrow'){
    const toX=pct(item.toX,x),toY=pct(item.toY,y);const dx=toX-x,dy=toY-y;const length=Math.sqrt(dx*dx+dy*dy);const angle=Math.atan2(dy,dx)*180/Math.PI;
    return `<span class="rc1502-sop-annotation rc1502-sop-annotation-arrow" data-annotation-type="arrow" data-annotation-index="${index}" style="left:${x}%;top:${y}%;width:${Math.max(2,length)}%;transform:rotate(${angle}deg)"></span>`;
  }
  return'';
}
function annotationLayer(visual){const annotations=arr(visual&&visual.annotations);const html=annotations.map(annotationHtml).join('');return html?`<span class="rc1502-sop-annotation-layer" aria-hidden="true">${html}</span>`:'';}
function expectedResultHtml(visual){const item=arr(visual&&visual.annotations).find(annotation=>text(annotation&&annotation.type)==='expectedResult');const result=annotationText(item);return result?`<p class="rc1502-sop-expected-result"><strong>${esc(tl('sop.expectedResult',RC1523_DE['sop.expectedResult']))}:</strong> ${esc(result)}</p>`:'';}
function visualStage(visual,caption,zoom=false){return `<div class="rc1502-sop-visual-stage${zoom?' is-zoom':''}"><img src="${esc(visual.src)}" alt="${esc(caption)}" loading="${zoom?'eager':'lazy'}">${annotationLayer(visual)}</div>`;}
function renderVisual(visual,index){
  if(!visual||visual.type==='process')return'';
  const item=normalizedVisual(visual)||visual;const caption=text(item.caption)||tl('sop.imageHint',RC1523_DE['sop.imageHint']);const safeCaption=esc(caption);
  if(item.type==='screenshot'&&item.src){
    const zoomId=`rc1502-sop-zoom-${index}`;const titleId=`${zoomId}-title`;const zoomLabel=tl('sop.zoomImage',RC1523_DE['sop.zoomImage']);const closeLabel=tl('common.close',RC1523_DE['common.close']);
    return `<figure class="rc1007-sop-visual" data-visual-index="${index}">${visualStage(item,caption,false)}<div class="rc1502-sop-visual-actions"><button type="button" class="rc1502-sop-zoom-button" data-sop-visual-zoom="${zoomId}" aria-controls="${zoomId}" aria-label="${esc(zoomLabel)}: ${safeCaption}">⤢ ${esc(zoomLabel)}</button></div>${expectedResultHtml(item)}<figcaption>${th('sop.image')} ${index} – ${safeCaption}</figcaption><dialog id="${zoomId}" class="rc1502-sop-zoom" aria-modal="true" aria-labelledby="${titleId}"><div class="rc1502-sop-zoom-shell"><div class="rc1502-sop-zoom-head"><h3 id="${titleId}">${safeCaption}</h3><button type="button" class="rc1502-sop-zoom-close" data-sop-visual-close aria-label="${esc(closeLabel)}">×</button></div>${visualStage(item,caption,true)}${expectedResultHtml(item)}</div></dialog></figure>`;
  }
  return `<figure class="rc1007-sop-visual rc1007-sop-placeholder" data-visual-index="${index}"><div class="rc1007-sop-placeholder-box" aria-label="${th('sop.imagePlaceholder')}"><span aria-hidden="true">▧</span><strong>${safeCaption}</strong></div><figcaption>${th('sop.image')} ${index} – ${safeCaption}</figcaption></figure>`;
}
function openVisualDialog(trigger){
  const id=trigger&&trigger.getAttribute?text(trigger.getAttribute('data-sop-visual-zoom')):'';if(!id||!root.document||typeof root.document.getElementById!=='function')return false;const dialog=root.document.getElementById(id);if(!dialog)return false;dialog.__rc1502ReturnFocus=trigger;try{if(typeof dialog.showModal==='function')dialog.showModal();else if(typeof dialog.setAttribute==='function')dialog.setAttribute('open','');}catch(_){if(typeof dialog.setAttribute==='function')dialog.setAttribute('open','');}return true;
}
function closeVisualDialog(dialog){
  if(!dialog)return false;const trigger=dialog.__rc1502ReturnFocus;try{if(typeof dialog.close==='function')dialog.close();else if(typeof dialog.removeAttribute==='function')dialog.removeAttribute('open');}catch(_){if(typeof dialog.removeAttribute==='function')dialog.removeAttribute('open');}if(trigger&&typeof trigger.focus==='function'){try{trigger.focus();}catch(_){}}return true;
}
function handleZoomKeydown(event){if(!event||event.key!=='Escape')return false;const target=event.target;const dialog=target&&target.closest?target.closest('.rc1502-sop-zoom'):null;if(!dialog)return false;if(typeof event.preventDefault==='function')event.preventDefault();closeVisualDialog(dialog);return true;}
function listHtml(items,empty){const values=arr(items).filter(item=>text(item));const emptyText=text(empty)||tr('sop.noInformationRequired');if(!values.length)return `<p class="rc1007-sop-muted">${esc(emptyText)}</p>`;return `<ul>${values.map(item=>`<li>${esc(typeof item==='string'?item:(item.text||item.label||''))}</li>`).join('')}</ul>`;}
function metaCell(label,val){return `<div class="rc1007-sop-meta-cell"><span>${esc(label)}</span><strong>${esc(text(val)||'—')}</strong></div>`;}
function section(title,body,id=''){return `<section class="rc1007-sop-section"${id?` id="${esc(id)}"`:''}><h2>${esc(title)}</h2>${body}</section>`;}
function detail(title,body,open=false){return `<details class="rc1009-sop-detail"${open?' open':''}><summary>${esc(title)}</summary><div class="rc1009-sop-detail-body">${body}</div></details>`;}
function renderSteps(doc,steps,visuals){
  const list=arr(steps);if(!list.length)return '<p class="rc1007-sop-muted">'+th('sop.noProcess')+'</p>';let imageNo=0;const api=visualApi();
  return `<ol class="rc1007-sop-steps">${list.map((step,index)=>{const stepId=text(step&&step.id)||`step-${index+1}`;const attached=api&&typeof api.visualsForStep==='function'?api.visualsForStep(doc,stepId):arr(visuals).filter(v=>v&&v.type!=='process'&&text(v.stepId)===stepId);const visualHtml=attached.map(v=>renderVisual(v,++imageNo)).join('');return `<li id="${esc(stepId)}"><div class="rc1007-sop-step-number">${index+1}</div><div class="rc1007-sop-step-content"><div class="rc1007-sop-step-text"><strong>${th('sop.step',{number:index+1})}</strong><p>${esc(step&&step.text!==undefined?step.text:step)}</p></div>${visualHtml}</div></li>`;}).join('')}</ol>`;
}
function renderReferences(references){const refs=arr(references).filter(Boolean);if(!refs.length)return '<p class="rc1007-sop-muted">'+th('sop.noReferences')+'</p>';return `<div class="rc1007-sop-reference-list">${refs.map(ref=>{const v=typeof ref==='string'?ref:(ref.number||ref.label||'');return /^SOP-EH-\d{3}$/.test(v)?`<button type="button" class="rc1007-sop-link" data-sop-ref="${esc(v)}">${esc(v)}</button>`:`<span>${esc(v)}</span>`;}).join('')}</div>`;}
function renderHistory(doc,sections){const history=arr(doc&&doc.history).length?arr(doc.history):arr(sections&&sections.changeHistory);if(!history.length)return '<p class="rc1007-sop-muted">'+th('sop.noHistory')+'</p>';return `<div class="rc1007-sop-history"><table><thead><tr><th>${th('sop.history.version')}</th><th>${th('sop.history.date')}</th><th>${th('sop.history.status')}</th><th>${th('sop.history.change')}</th></tr></thead><tbody>${history.map(item=>`<tr><td>${esc(item.version)}</td><td>${esc(item.date||item.at||'—')}</td><td>${esc(item.status||item.action||'—')}</td><td>${esc(item.change||item.reason||'—')}</td></tr>`).join('')}</tbody></table></div>`;}

function sopEditorApi(){return root.ExportHubSopEditor&&typeof root.ExportHubSopEditor.validateDraft==='function'?root.ExportHubSopEditor:null;}
function draftRecord(doc){const version=text(doc&&doc.draftVersion);return version?arr(doc&&doc.versions).find(item=>text(item&&item.version)===version&&text(item&&item.status)===SOP_STATUSES.draft)||null:null;}
function suggestedDraftVersion(doc){const raw=text(doc&&doc.currentVersion)||versionOf(doc);const parts=raw.split('.');const major=Number(parts[0])||1;const minor=Number(parts[1]);return `${major}.${Number.isFinite(minor)?minor+1:1}`;}
function validationLines(result){
  const errors=arr(result&&result.errors),warnings=arr(result&&result.warnings);
  const errorFallback=tl('sop.editor.validationError',RC1523_DE['sop.editor.validationError']),warningFallback=tl('sop.editor.validationWarning',RC1523_DE['sop.editor.validationWarning']);
  const items=[...errors.map(item=>`<li>${esc(typeof item==='string'?item:(item.message||item.code||errorFallback))}</li>`),...warnings.map(item=>`<li>${esc(typeof item==='string'?item:(item.message||item.code||warningFallback))}</li>`)];
  return items.length?`<ul class="rc1502-sop-editor-validation">${items.join('')}</ul>`:`<p class="rc1502-sop-editor-note">${tlh('sop.editor.noStructuralErrors',RC1523_DE['sop.editor.noStructuralErrors'])}</p>`;
}
function renderEditorStep(step,index,total){
  const id=text(step&&step.id)||`step-${index+1}`;
  return `<article class="rc1502-sop-editor-step" data-sop-editor-step="${esc(id)}"><div class="rc1502-sop-editor-step-head"><strong>${th('sop.step',{number:index+1})}</strong><small>${esc(id)}</small></div><div class="rc1502-sop-editor-fields"><label>${tlh('sop.editor.field.title',RC1523_DE['sop.editor.field.title'])}<input data-sop-editor-step-field="title" value="${esc(step&&step.title)}"></label><label>${tlh('sop.editor.field.targetPage',RC1523_DE['sop.editor.field.targetPage'])}<input data-sop-editor-step-field="page" value="${esc(step&&step.page)}"></label></div><label>${tlh('sop.editor.field.instruction',RC1523_DE['sop.editor.field.instruction'])}<textarea data-sop-editor-step-field="instruction">${esc(step&&step.instruction||step&&step.text)}</textarea></label><label>${tlh('sop.expectedResult',RC1523_DE['sop.expectedResult'])}<textarea data-sop-editor-step-field="expectedResult">${esc(step&&step.expectedResult)}</textarea></label><div class="rc1502-sop-editor-step-actions"><button type="button" data-sop-editor-action="update-step">${th('common.save')}</button><button type="button" data-sop-editor-action="move-up"${index===0?' disabled':''}>↑ ${tlh('sop.editor.moveUp',RC1523_DE['sop.editor.moveUp'])}</button><button type="button" data-sop-editor-action="move-down"${index===total-1?' disabled':''}>↓ ${tlh('sop.editor.moveDown',RC1523_DE['sop.editor.moveDown'])}</button><button type="button" data-sop-editor-action="remove-step" data-danger="true">${th('common.remove')}</button></div></article>`;
}
function renderEditorPanel(doc,rights){
  const r=rightsOf(rights);if(!r.edit&&!r.admin)return'';const api=sopEditorApi();const type=text(doc&&doc.type)||'process';const draft=draftRecord(doc);const typeLabel=type==='customer'?tl('sop.editor.typeCustomer',RC1523_DE['sop.editor.typeCustomer']):tl('sop.editor.typeProcess',RC1523_DE['sop.editor.typeProcess']);
  const version=draft?text(draft.version):'';let validation={ok:true,errors:[],warnings:[]};if(draft&&api){try{validation=api.validateDraft(doc,{version});}catch(error){validation={ok:false,errors:[text(error&&error.message)||tl('sop.editor.validationFailed',RC1523_DE['sop.editor.validationFailed'])],warnings:[]};}}
  const validationState=draft?(validation.ok?'valid':'invalid'):'none';
  const summary=`<div class="rc1502-sop-editor-summary"><div><span>${tlh('sop.editor.type',RC1523_DE['sop.editor.type'])}</span><strong>${esc(typeLabel)}</strong></div><div><span>${tlh('sop.editor.draft',RC1523_DE['sop.editor.draft'])}</span><strong>${esc(version||tl('sop.editor.noDraft',RC1523_DE['sop.editor.noDraft']))}</strong></div><div><span>${tlh('sop.editor.changeReason',RC1523_DE['sop.editor.changeReason'])}</span><strong>${esc(draft&&draft.changeReason||doc&&doc.changeReason||'—')}</strong></div></div>`;
  const customerInfo=type==='customer'?`<div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.customerContext',RC1523_DE['sop.editor.customerContext'])}</h3><div class="rc1502-sop-editor-customer"><div><span>${tlh('sop.editor.customer',RC1523_DE['sop.editor.customer'])}</span><strong>${esc(doc.customerId||'—')}</strong></div><div><span>${tlh('sop.editor.baseSop',RC1523_DE['sop.editor.baseSop'])}</span><strong>${esc(doc.baseProcessSop||'—')}</strong></div></div><p class="rc1502-sop-editor-note">${tlh('sop.editor.customerOverlayNote',RC1523_DE['sop.editor.customerOverlayNote'])}</p></div>`:'';
  const createDraft=`<div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.newDraft',RC1523_DE['sop.editor.newDraft'])}</h3><div class="rc1502-sop-editor-fields"><label>${tlh('sop.editor.version',RC1523_DE['sop.editor.version'])}<input data-sop-editor-field="draft-version" value="${esc(suggestedDraftVersion(doc))}"></label><label>${tlh('sop.editor.changeReason',RC1523_DE['sop.editor.changeReason'])}<input data-sop-editor-field="draft-reason" placeholder="${tlh('sop.editor.changePlaceholder',RC1523_DE['sop.editor.changePlaceholder'])}"></label></div><div class="rc1502-sop-editor-inline-actions"><button type="button" data-sop-editor-action="create-draft" data-primary="true">${tlh('sop.editor.createDraft',RC1523_DE['sop.editor.createDraft'])}</button></div></div>`;
  const overlayCreate=type==='process'?`<div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.createCustomerSop',RC1523_DE['sop.editor.createCustomerSop'])}</h3><div class="rc1502-sop-editor-fields"><label>${tlh('sop.editor.customerNumber',RC1523_DE['sop.editor.customerNumber'])}<input data-sop-editor-field="overlay-customer" placeholder="z. B. 9000003019"></label><label>${tlh('sop.editor.sopNumber',RC1523_DE['sop.editor.sopNumber'])}<input data-sop-editor-field="overlay-number" placeholder="SOP-CUST-..."></label></div><label>${tlh('sop.editor.changeReason',RC1523_DE['sop.editor.changeReason'])}<input data-sop-editor-field="overlay-reason" placeholder="${tlh('sop.editor.customerDeviationPlaceholder',RC1523_DE['sop.editor.customerDeviationPlaceholder'])}"></label><div class="rc1502-sop-editor-inline-actions"><button type="button" data-sop-editor-action="create-overlay" data-sop-editor-create-overlay data-primary="true">${tlh('sop.editor.createCustomerButton',RC1523_DE['sop.editor.createCustomerButton'])}</button></div></div>`:'';
  let draftBody=createDraft;
  if(draft&&type==='process'){
    const steps=arr(draft.content&&draft.content.steps);const stepRows=steps.map((step,index)=>renderEditorStep(step,index,steps.length)).join('');const stepOptions=steps.map(step=>`<option value="${esc(step.id)}">${esc(step.id)} – ${esc(step.title||step.instruction||step.text)}</option>`).join('');
    draftBody=`<div class="rc1502-sop-editor-grid"><div class="rc1502-sop-editor-main"><div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.workSteps',RC1523_DE['sop.editor.workSteps'])}</h3><div class="rc1502-sop-editor-step-list">${stepRows||`<p class="rc1502-sop-editor-note">${tlh('sop.editor.noDraftSteps',RC1523_DE['sop.editor.noDraftSteps'])}</p>`}</div></div><div class="rc1502-sop-editor-card" data-sop-editor-add-step><h3>${tlh('sop.editor.addStep',RC1523_DE['sop.editor.addStep'])}</h3><div class="rc1502-sop-editor-fields"><label>${tlh('sop.editor.stepId',RC1523_DE['sop.editor.stepId'])}<input data-sop-editor-field="new-step-id" placeholder="step-neu"></label><label>${tlh('sop.editor.field.title',RC1523_DE['sop.editor.field.title'])}<input data-sop-editor-field="new-step-title"></label></div><label>${tlh('sop.editor.field.instruction',RC1523_DE['sop.editor.field.instruction'])}<textarea data-sop-editor-field="new-step-instruction"></textarea></label><div class="rc1502-sop-editor-inline-actions"><button type="button" data-sop-editor-action="add-step" data-primary="true">${tlh('sop.editor.addStep',RC1523_DE['sop.editor.addStep'])}</button></div></div></div><aside class="rc1502-sop-editor-side"><div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.validation',RC1523_DE['sop.editor.validation'])}</h3>${validationLines(validation)}</div><div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.assignStepImage',RC1523_DE['sop.editor.assignStepImage'])}</h3><label>${tlh('sop.editor.step',RC1523_DE['sop.editor.step'])}<select data-sop-editor-field="visual-step">${stepOptions}</select></label><label>${tlh('sop.editor.imageSource',RC1523_DE['sop.editor.imageSource'])}<input data-sop-editor-visual-src data-sop-editor-field="visual-src" placeholder="/assets/sop/screenshots/..."></label><label>${th('sop.imageHint')}<input data-sop-editor-field="visual-caption"></label><div class="rc1502-sop-editor-inline-actions"><button type="button" data-sop-editor-action="assign-visual">${tlh('sop.editor.assignImage',RC1523_DE['sop.editor.assignImage'])}</button></div></div>${overlayCreate}</aside></div>`;
  }else if(draft&&type==='customer')draftBody=`<div class="rc1502-sop-editor-grid"><div class="rc1502-sop-editor-main">${customerInfo}<div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.customerDeviations',RC1523_DE['sop.editor.customerDeviations'])}</h3><p class="rc1502-sop-editor-note">${tlh('sop.editor.overlaySeparateNote',RC1523_DE['sop.editor.overlaySeparateNote'])}</p></div></div><aside class="rc1502-sop-editor-side"><div class="rc1502-sop-editor-card"><h3>${tlh('sop.editor.validation',RC1523_DE['sop.editor.validation'])}</h3>${validationLines(validation)}</div></aside></div>`;
  const draftBadge=draft?(validation.ok?tl('sop.editor.draftValid',RC1523_DE['sop.editor.draftValid']):tl('sop.editor.checkDraft',RC1523_DE['sop.editor.checkDraft'])):tl('sop.editor.noDraft',RC1523_DE['sop.editor.noDraft']);
  return `<section class="rc1502-sop-editor" data-sop-editor data-sop-editor-type="${esc(type)}"${version?` data-sop-editor-version="${esc(version)}"`:''} data-sop-editor-validation="${validationState}" aria-label="${tlh('sop.editor.title',RC1523_DE['sop.editor.title'])}"><div class="rc1502-sop-editor-head"><div><h2>${tlh('sop.editor.title',RC1523_DE['sop.editor.title'])}</h2><p>${tlh('sop.editor.intro',RC1523_DE['sop.editor.intro'])}</p></div><div class="rc1502-sop-editor-badges"><span class="rc1502-sop-editor-badge">${esc(typeLabel)}</span><span class="rc1502-sop-editor-badge" data-kind="${validationState}">${esc(draftBadge)}</span></div></div><div class="rc1502-sop-editor-body">${summary}${draftBody}${!draft?overlayCreate:''}</div></section>`;
}

function renderDocument(doc,options={}){
  if(!doc)return '<div class="rc1007-sop-empty">'+th('sop.notFound')+'</div>';const r=rightsOf(options.rights);if(!r.read)return '<div class="rc1007-sop-empty">'+th('sop.noReadPermission')+'</div>';if(!r.edit&&!r.admin&&statusOf(doc)!==SOP_STATUSES.released)return '<div class="rc1007-sop-empty">'+th('sop.notReleased')+'</div>';
  const s=sectionsOf(doc);const visuals=visualsOf(doc);const processVisual=visuals.find(v=>v&&v.type==='process');const processCaption=processVisual?`<p class="rc1007-sop-caption">${esc(processVisual.caption)}</p>`:'';
  const back=options.embedded?'':'<button type="button" data-sop-back>'+th('sop.backHandbook')+'</button>';
  const controls=`<div class="rc1007-sop-doc-actions">${back}<button type="button" data-sop-print>${th('common.print')}</button>${r.edit?'<button type="button" data-sop-new-version>'+th('sop.newVersion')+'</button>':''}${r.admin?'<button type="button" data-sop-review>'+th('sop.submitReview')+'</button><button type="button" data-sop-approve>'+th('sop.approve')+'</button>':''}</div>`;
  const basics=`<div class="rc1009-sop-info-grid"><div><h3>${th('sop.purposeGoal')}</h3><p>${esc(s.purpose||'')}</p></div><div><h3>${th('sop.scope')}</h3><p>${esc(s.scope||'')}</p></div><div><h3>${th('sop.responsibilities')}</h3>${listHtml(s.responsibilities)}</div><div><h3>${th('sop.prerequisites')}</h3>${listHtml(s.prerequisites)}</div></div>`;
  const checks=`<div class="rc1009-sop-info-grid"><div><h3>${th('sop.checksRelease')}</h3>${listHtml(s.checks)}</div><div><h3>${th('sop.deviations')}</h3>${listHtml(s.deviations)}</div><div><h3>${th('sop.records')}</h3>${listHtml(s.records)}</div><div><h3>${th('sop.metrics')}</h3>${listHtml(s.metrics,tr('sop.noOwnMetric'))}</div></div>`;
  const refs=`<div class="rc1009-sop-info-grid"><div><h3>${th('sop.resources')}</h3>${listHtml(s.resources)}</div><div><h3>${th('sop.relatedDocuments')}</h3>${listHtml(s.relatedDocuments,tr('sop.noRelatedDocuments'))}</div><div><h3>${th('sop.crossReferences')}</h3>${renderReferences(s.references||doc.references)}</div><div><h3>${th('sop.definitions')}</h3>${listHtml(s.definitions)}</div></div>`;
  const editor=renderEditorPanel(doc,r);
  return `<article class="rc1007-sop-document rc1009-sop-document" data-sop-number="${esc(doc.number)}">${controls}<header class="rc1007-sop-document-head"><div><p class="rc1007-sop-eyebrow">${th('sop.controlledDocument')}</p><h1>${esc(doc.number)} – ${esc(doc.title)}</h1><p class="rc1009-sop-subtitle">${esc(doc.area||tr('sop.defaultArea'))}</p></div><span class="rc1007-sop-status" data-status="${esc(statusOf(doc))}">${esc(statusDisplay(statusOf(doc)))}</span></header><div class="rc1007-sop-meta">${metaCell(tr('sop.number'),doc.number)}${metaCell(tr('sop.version'),versionOf(doc))}${metaCell(tr('sop.status'),statusDisplay(statusOf(doc)))}${metaCell(tr('sop.validFrom'),value(doc,'validFrom'))}${metaCell(tr('sop.processOwner'),doc.processOwner)}${metaCell(tr('sop.nextReview'),doc.nextReview)}</div>${editor}${detail(tr('sop.detail.basics'),basics,true)}${section(tr('sop.section.processOverview'),renderProcessGraphic(doc)+processCaption,'process-flow')}${section(tr('sop.section.steps'),renderSteps(doc,s.steps,visuals),'work-steps')}${detail(tr('sop.detail.checks'),checks,true)}${detail(tr('sop.detail.resources'),refs,false)}${detail(tr('sop.detail.history'),renderHistory(doc,s),false)}</article>`;
}

function filterParts(filters,areas){const f=filters||{};const areaOptions=areas.map(area=>`<option value="${esc(area)}"${text(f.area)===area?' selected':''}>${esc(area)}</option>`).join('');const statusOptions=Object.values(SOP_STATUSES).map(status=>`<option value="${status}"${text(f.status)===status?' selected':''}>${esc(statusDisplay(status))}</option>`).join('');return `<div class="rc1007-sop-filters"><label>${th('sop.search')}<input type="search" data-sop-filter="query" value="${esc(f.query||f.q||'')}" placeholder="${th('sop.searchPlaceholder')}"></label><label>${th('sop.area')}<select data-sop-filter="area"><option value="">${th('sop.allAreas')}</option>${areaOptions}</select></label><label>${th('sop.status')}<select data-sop-filter="status"><option value="">${th('sop.allStatuses')}</option>${statusOptions}</select></label></div>`;}
function prepared(options={}){const catalog=root.ExportHubIsoSopCatalog;const model=root.ExportHubIsoSopModel;const r=rightsOf(options.rights);const reconciled=canonicalDocuments(options.documents||(catalog&&catalog.documents)||[]);const all=visibleDocuments(reconciled,r);const filters=options.filters||{};const docs=model&&typeof model.filterDocuments==='function'?model.filterDocuments(all,filters):all;const areas=(catalog&&catalog.areas)||[];return {catalog,model,r,reconciled,all,filters,docs,areas};}

function renderOverview(options={}){
  const data=prepared(options);const {r,filters,docs,areas}=data;
  const groups=areas.map(area=>{const items=docs.filter(doc=>doc.area===area);if(!items.length)return'';return `<section class="rc1007-sop-group"><div class="rc1007-sop-group-head"><h2>${esc(area)}</h2><span>${items.length} SOP${items.length===1?'':'s'}</span></div><div class="rc1007-sop-grid">${items.map(doc=>`<article class="rc1007-sop-card"><div class="rc1007-sop-card-top"><span class="rc1007-sop-number">${esc(doc.number)}</span><span class="rc1007-sop-status" data-status="${esc(statusOf(doc))}">${esc(statusDisplay(statusOf(doc)))}</span></div><h3>${esc(doc.title)}</h3><dl><div><dt>${th('sop.version')}</dt><dd>${esc(versionOf(doc))}</dd></div><div><dt>${th('sop.validFrom')}</dt><dd>${esc(text(value(doc,'validFrom'))||'—')}</dd></div><div><dt>${th('sop.nextReview')}</dt><dd>${esc(text(doc.nextReview)||'—')}</dd></div></dl><button type="button" data-sop-open="${esc(doc.number)}">${th('sop.open')}</button></article>`).join('')}</div></section>`;}).join('');
  const empty=!docs.length?`<div class="rc1007-sop-empty">${th(r.edit||r.admin?'sop.noFilterResults':'sop.noReleased')}</div>`:'';
  return `<div class="rc1007-sop-overview"><header class="rc1007-sop-hero"><div><p class="rc1007-sop-eyebrow">${th('sop.controlledDocument')}</p><h1>${th('sop.handbook')}</h1><p>${th('sop.heroText')}</p></div><div class="rc1007-sop-count"><strong>${docs.length}</strong><span>${th('sop.displayedCount')}</span></div></header>${filterParts(filters,areas)}${empty}${groups}</div>`;
}

function renderWorkspace(options={}){
  const data=prepared(options);const {r,filters,docs,areas}=data;const requested=text(options.activeNumber);const active=docs.find(doc=>doc.number===requested)||docs[0]||null;
  const list=areas.map(area=>{const items=docs.filter(doc=>doc.area===area);if(!items.length)return'';return `<section class="rc1009-sop-list-group"><h3>${esc(area)} <span>${items.length}</span></h3>${items.map(doc=>`<button type="button" class="rc1009-sop-list-item${active&&active.number===doc.number?' active':''}" data-sop-open="${esc(doc.number)}"><span class="rc1009-sop-list-number">${esc(doc.number)}</span><strong>${esc(doc.title)}</strong><small>${th('sop.version')} ${esc(versionOf(doc))} · ${esc(statusDisplay(statusOf(doc)))}</small></button>`).join('')}</section>`;}).join('');
  const empty=!docs.length?`<div class="rc1007-sop-empty">${th(r.edit||r.admin?'sop.noFilterResults':'sop.noReleased')}</div>`:'';
  const pane=active?renderDocument(active,{rights:r,embedded:true}):empty;
  return `<div class="rc1007-sop-overview rc1009-sop-shell"><header class="rc1007-sop-hero"><div><p class="rc1007-sop-eyebrow">${th('sop.controlledDocument')}</p><h1>${th('sop.handbook')}</h1><p>${th('sop.workspaceText')}</p></div><div class="rc1007-sop-count"><strong>${docs.length}</strong><span>${th('sop.selectableCount')}</span></div></header>${filterParts(filters,areas)}<div class="rc1009-sop-workspace"><aside class="rc1009-sop-sidebar" aria-label="${th('sop.selectionAria')}">${list||empty}</aside><main class="rc1009-sop-document-pane">${pane}</main></div></div>`;
}

function applyWorkflowAction(document,action,options={}){const model=root.ExportHubIsoSopModel;if(!model)throw new Error(tr('sop.modelNotLoaded'));switch(String(action||'').toLowerCase()){case'draft':case'new-version':return model.createDraftVersion(document,options);case'review':return model.submitForReview(document,options);case'approve':return model.approveVersion(document,options);case'archive':return model.archiveVersion(document,options);default:throw new Error(tr('sop.unknownWorkflowAction'));}}
function printDocument(){if(root&&typeof root.print==='function')root.print();}

function mount(target,options={}){
  const host=typeof target==='string'&&root.document?root.document.querySelector(target):target;if(!host)return null;
  const original=Array.isArray(options.documents)?options.documents:null;const reconciled=canonicalDocuments(original||[]);const changed=original&&!sameCatalog(original,reconciled);
  if(changed&&!Object.isFrozen(original)){original.splice(0,original.length,...reconciled);if(typeof root.save==='function'){try{root.save('RC1009 SOP-Katalog auf aktuellen Systemstand abgeglichen');}catch(error){if(root.console&&root.console.warn)root.console.warn('RC1009 SOP-Abgleich konnte nicht sofort gespeichert werden',error);}}}
  const state={documents:original||reconciled,rights:options.rights||{},filters:{...(options.filters||{})},activeNumber:text(options.activeNumber)};
  function find(number){return state.documents.find(doc=>doc.number===number)||null;}
  function replaceDocument(next){if(!next)return false;const number=text(next.number);const index=state.documents.findIndex(doc=>text(doc&&doc.number)===number);if(index>=0)state.documents.splice(index,1,next);else state.documents.push(next);return true;}
  function persist(reason){if(typeof root.save==='function'){try{root.save(reason||'RC1502 SOP-Entwurf aktualisiert');}catch(error){if(root.console&&root.console.warn)root.console.warn('RC1502 SOP-Editor konnte nicht sofort speichern',error);}}}
  function field(panel,name){const node=panel&&panel.querySelector?panel.querySelector(`[data-sop-editor-field="${name}"]`):null;return text(node&&node.value);}
  function handleEditorAction(button){
    const api=sopEditorApi();if(!api)return false;const panel=button&&button.closest?button.closest('[data-sop-editor]'):null;if(!panel)return false;const action=text(button.getAttribute('data-sop-editor-action'));let doc=find(state.activeNumber);if(!doc)return false;
    try{
      let next=null;
      if(action==='create-draft'){next=api.createDraft(doc,{version:field(panel,'draft-version')||suggestedDraftVersion(doc),actor:text(options.actor)||'SOP-Editor',reason:field(panel,'draft-reason')||tl('sop.editor.reasonEdited',RC1523_DE['sop.editor.reasonEdited'])});}
      else if(action==='create-overlay'){const overlay=api.createCustomerOverlay(doc,{number:field(panel,'overlay-number'),customerId:field(panel,'overlay-customer'),version:'1.0',actor:text(options.actor)||'SOP-Editor',reason:field(panel,'overlay-reason')||'Kundenabweichung'});state.documents.push(overlay);state.activeNumber=overlay.number;persist('RC1502 Kunden-SOP angelegt');paint();return true;}
      else if(action==='add-step'){next=api.addStep(doc,{version:doc.draftVersion,step:{id:field(panel,'new-step-id'),title:field(panel,'new-step-title'),instruction:field(panel,'new-step-instruction')}});}
      else if(action==='assign-visual'){next=api.assignVisual(doc,{version:doc.draftVersion,stepId:field(panel,'visual-step'),visual:{type:'screenshot',src:field(panel,'visual-src'),caption:field(panel,'visual-caption')}});}
      else{
        const row=button.closest?button.closest('[data-sop-editor-step]'):null;const stepId=text(row&&row.getAttribute('data-sop-editor-step'));if(!stepId)return false;const draft=draftRecord(doc);const steps=arr(draft&&draft.content&&draft.content.steps);const index=steps.findIndex(step=>text(step&&step.id)===stepId);
        if(action==='update-step'){const read=name=>{const node=row.querySelector(`[data-sop-editor-step-field="${name}"]`);return text(node&&node.value);};next=api.updateStep(doc,{version:doc.draftVersion,stepId,patch:{title:read('title'),page:read('page'),instruction:read('instruction'),expectedResult:read('expectedResult')}});}
        else if(action==='move-up')next=api.moveStep(doc,{version:doc.draftVersion,stepId,toIndex:Math.max(0,index-1)});
        else if(action==='move-down')next=api.moveStep(doc,{version:doc.draftVersion,stepId,toIndex:Math.min(steps.length-1,index+1)});
        else if(action==='remove-step'){if(typeof root.confirm==='function'&&!root.confirm(`Schritt ${stepId} wirklich entfernen?`))return true;next=api.removeStep(doc,{version:doc.draftVersion,stepId});}
      }
      if(next){replaceDocument(next);persist('RC1502 SOP-Entwurf aktualisiert');if(typeof options.onEditorChange==='function')options.onEditorChange({action,document:next,state});paint();return true;}
    }catch(error){if(root.console&&root.console.error)root.console.error('RC1502 SOP-Editor',error);if(typeof options.onEditorError==='function')options.onEditorError(error);}
    return false;
  }
  function paint(){host.innerHTML=renderWorkspace({documents:state.documents,rights:state.rights,filters:state.filters,activeNumber:state.activeNumber});const data=prepared({documents:state.documents,rights:state.rights,filters:state.filters});if(!data.docs.some(doc=>doc.number===state.activeNumber))state.activeNumber=(data.docs[0]&&data.docs[0].number)||'';}
  function onClick(event){
    const editorAction=event.target&&event.target.closest?event.target.closest('[data-sop-editor-action]'):null;if(editorAction){handleEditorAction(editorAction);return;}
    const zoom=event.target&&event.target.closest?event.target.closest('[data-sop-visual-zoom]'):null;if(zoom){openVisualDialog(zoom);return;}
    const close=event.target&&event.target.closest?event.target.closest('[data-sop-visual-close]'):null;if(close){closeVisualDialog(close.closest?close.closest('.rc1502-sop-zoom'):null);return;}
    const open=event.target&&event.target.closest?event.target.closest('[data-sop-open]'):null;if(open){state.activeNumber=open.getAttribute('data-sop-open')||'';paint();return;}
    const ref=event.target&&event.target.closest?event.target.closest('[data-sop-ref]'):null;if(ref){state.activeNumber=ref.getAttribute('data-sop-ref')||'';paint();return;}
    if(event.target&&event.target.closest&&event.target.closest('[data-sop-back]')){state.activeNumber='';paint();return;}
    if(event.target&&event.target.closest&&event.target.closest('[data-sop-print]')){printDocument();return;}
    if(typeof options.onAction==='function'){const action=event.target&&event.target.closest?event.target.closest('[data-sop-new-version],[data-sop-review],[data-sop-approve]'):null;if(action)options.onAction({element:action,document:find(state.activeNumber),state});}
  }
  function onFilter(event){const el=event.target;const key=el&&el.getAttribute?el.getAttribute('data-sop-filter'):'';if(!key)return;state.filters[key]=el.value;paint();}
  host.addEventListener('click',onClick);host.addEventListener('keydown',handleZoomKeydown);host.addEventListener('error',handleImageError,true);host.addEventListener('input',onFilter);host.addEventListener('change',onFilter);paint();
  return {state,refresh(next={}){if(next.documents){const synced=canonicalDocuments(next.documents);state.documents=synced;}if(next.rights)state.rights=next.rights;paint();},open(number){state.activeNumber=text(number);paint();},destroy(){host.removeEventListener('click',onClick);host.removeEventListener('keydown',handleZoomKeydown);host.removeEventListener('error',handleImageError,true);host.removeEventListener('input',onFilter);host.removeEventListener('change',onFilter);}};
}

root.ExportHubIsoSopUi=Object.freeze({mount,renderOverview,renderWorkspace,renderDocument,renderProcessGraphic,renderVisual,renderEditorPanel,printDocument,applyWorkflowAction,openVisualDialog,closeVisualDialog,handleZoomKeydown});
})(typeof globalThis!=='undefined'?globalThis:this);