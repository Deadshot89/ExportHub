(function(g){
'use strict';

function esc(value){return String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function tr(options,key,fallback){
  try{if(options&&typeof options.t==='function'){const value=options.t(key);if(value&&value!==key)return String(value);}}catch(_){}
  try{if(g.ExportHUBI18n&&typeof g.ExportHUBI18n.t==='function'){const value=g.ExportHUBI18n.t(key);if(value&&value!==key)return String(value);}}catch(_){}
  return fallback||key;
}
function q(value){return String(value??'').trim().toLocaleLowerCase();}
function allEntries(center){return [...(center.standardProcesses||[]),...(center.customerSops||[]),...(center.trainings||[])];}
function filterEntries(entries,{query='',categoryId=''}={}){
  const needle=q(query),category=String(categoryId||'');
  return (entries||[]).filter((entry)=>{
    if(category&&String(entry.categoryId||'')!==category)return false;
    if(!needle)return true;
    return q([entry.id,entry.title,entry.summary,entry.customerId,entry.baseProcessId].filter(Boolean).join(' ')).includes(needle);
  });
}
function byIds(center,ids){
  const map=new Map(allEntries(center).map((entry)=>[String(entry.id),entry]));
  return (ids||[]).map((id)=>map.get(String(id))).filter(Boolean);
}
function entryCard(entry,options){
  const version=entry.version||'—',owner=entry.ownerUserId||entry.owner||'—',changed=entry.changedAt||'—';
  return `<article class="training-center-card" data-training-center-entry="${esc(entry.id)}" tabindex="0">
    <div class="training-center-card__body"><h3>${esc(entry.title||entry.id||'')}</h3>${entry.summary?`<p>${esc(entry.summary)}</p>`:''}</div>
    <dl class="training-center-card__meta">
      <div><dt>${esc(tr(options,'trainingCenter.metadata.version','Version'))}</dt><dd>${esc(version)}</dd></div>
      <div><dt>${esc(tr(options,'trainingCenter.metadata.owner','Verantwortlicher'))}</dt><dd>${esc(owner)}</dd></div>
      <div><dt>${esc(tr(options,'trainingCenter.metadata.changed','Geändert'))}</dt><dd>${esc(changed)}</dd></div>
    </dl>
  </article>`;
}
function miniList(title,entries,attr,options){
  const content=entries.length?entries.map((entry)=>`<button type="button" class="training-center-mini-item" data-training-center-entry-link="${esc(entry.id)}">${esc(entry.title||entry.id)}</button>`).join(''):`<p class="training-center-empty">${esc(tr(options,'trainingCenter.empty','Keine Einträge'))}</p>`;
  return `<section class="training-center-side-card" ${attr}><h2>${esc(title)}</h2><div class="training-center-mini-list">${content}</div></section>`;
}
function render(centerValue,options={}){
  const model=g.ExportHubTrainingCenterModel;
  const center=model&&typeof model.normalizeCenter==='function'?model.normalizeCenter(centerValue):centerValue||{};
  const section=['standard','customer','training'].includes(options.section)?options.section:'standard';
  const source=section==='customer'?(center.customerSops||[]):section==='training'?(center.trainings||[]):(center.standardProcesses||[]);
  const visible=filterEntries(source,{query:options.query,categoryId:options.categoryId});
  const sectionLabels={
    standard:tr(options,'trainingCenter.section.standard','Standardprozesse'),
    customer:tr(options,'trainingCenter.section.customer','Kundenspezifische SOPs'),
    training:tr(options,'trainingCenter.section.training','Interaktive Touren / Trainings')
  };
  const categories=(center.categories||[]);
  const categoryButtons=[`<button type="button" class="training-center-category${!options.categoryId?' is-active':''}" data-training-center-category="" aria-pressed="${!options.categoryId?'true':'false'}">${esc(tr(options,'trainingCenter.allCategories','Alle Kategorien'))}</button>`,...categories.map((cat)=>`<button type="button" class="training-center-category${String(options.categoryId||'')===String(cat.id)?' is-active':''}" data-training-center-category="${esc(cat.id)}" aria-pressed="${String(options.categoryId||'')===String(cat.id)?'true':'false'}">${esc(cat.title||cat.id)}</button>`)].join('');
  const cards=visible.length?visible.map((entry)=>entryCard(entry,options)).join(''):`<div class="training-center-empty-state">${esc(tr(options,'trainingCenter.empty','Keine Einträge'))}</div>`;
  return `<section class="training-center-shell" data-training-center-shell data-section="${section}">
    <header class="training-center-header">
      <div><span class="training-center-eyebrow">ExportHUB360</span><h1>${esc(tr(options,'trainingCenter.title','SOP & Training Center'))}</h1></div>
      <label class="training-center-search"><span>${esc(tr(options,'trainingCenter.search','SOP suchen'))}</span><input type="search" data-training-center-search value="${esc(options.query||'')}" placeholder="${esc(tr(options,'trainingCenter.searchPlaceholder','Prozess, Kunde oder Training suchen'))}"></label>
    </header>
    <nav class="training-center-tabs" role="tablist" aria-label="${esc(tr(options,'trainingCenter.mobile.navigation','Navigation'))}">
      ${Object.entries(sectionLabels).map(([key,label])=>`<button type="button" role="tab" aria-selected="${section===key?'true':'false'}" tabindex="${section===key?'0':'-1'}" class="training-center-tab${section===key?' is-active':''}" data-training-center-section="${key}">${esc(label)}</button>`).join('')}
    </nav>
    <aside class="training-center-left">
      <section class="training-center-side-card" data-training-center-categories><h2>${esc(tr(options,'trainingCenter.categories','Kategorien'))}</h2><div class="training-center-category-list">${categoryButtons}</div></section>
      ${miniList(tr(options,'trainingCenter.favorites','Favoriten'),byIds(center,center.favorites),'data-training-center-favorites',options)}
    </aside>
    <main class="training-center-main" role="tabpanel" aria-label="${esc(sectionLabels[section])}"><div class="training-center-grid">${cards}</div></main>
    <aside class="training-center-right">
      ${miniList(tr(options,'trainingCenter.recents','Zuletzt verwendet'),byIds(center,center.recents),'data-training-center-recents',options)}
      <section class="training-center-side-card" data-training-center-metadata><h2>${esc(tr(options,'trainingCenter.title','SOP & Training Center'))}</h2><dl><div><dt>${esc(tr(options,'trainingCenter.metadata.version','Version'))}</dt><dd>${esc(center.version||1)}</dd></div><div><dt>${esc(tr(options,'trainingCenter.metadata.owner','Verantwortlicher'))}</dt><dd>—</dd></div><div><dt>${esc(tr(options,'trainingCenter.metadata.changed','Geändert'))}</dt><dd>—</dd></div></dl></section>
    </aside>
  </section>`;
}

g.ExportHubTrainingCenterUi=Object.freeze({render,filterEntries});
})(globalThis);
