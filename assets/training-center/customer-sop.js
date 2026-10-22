(function(g){
'use strict';

const SECTIONS=Object.freeze(['shipping','packaging','notification','avisLink','contacts','email','documents','deliveryNotes','cmr','abd','customs','labeling','deadlines','pickup','portals','attachments','specialChecks','knownErrors','notes']);
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function normalize(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  if(!source.baseProcessId)throw new Error('CUSTOMER_SOP_BASE_PROCESS_REQUIRED');
  const sections={};
  const incoming=source.sections&&typeof source.sections==='object'?source.sections:{};
  for(const key of SECTIONS)sections[key]=Array.isArray(incoming[key])?clone(incoming[key]):[];
  return {
    id:source.id||'',
    customerId:source.customerId||'',
    title:source.title||'',
    baseProcessId:String(source.baseProcessId),
    version:source.version||'1.0',
    ownerUserId:source.ownerUserId||'',
    changedAt:source.changedAt||'',
    sections
  };
}
function resolve(baseProcess,customerSop){
  if(!baseProcess||typeof baseProcess!=='object')throw new Error('CUSTOMER_SOP_BASE_PROCESS_MISSING');
  const normalized=normalize(customerSop);
  if(String(baseProcess.id||'')!==normalized.baseProcessId)throw new Error('CUSTOMER_SOP_BASE_PROCESS_MISMATCH');
  const deviations=[];
  for(const section of SECTIONS){
    const items=normalized.sections[section];
    if(items.length)deviations.push({section,items:clone(items)});
  }
  return {
    baseProcess,
    customerSop:normalized,
    notice:`Es gilt zusätzlich der Standardprozess „${baseProcess.title||baseProcess.id}“.`,
    deviations
  };
}
function renderResolved(resolved){
  if(!resolved||typeof resolved!=='object')return '';
  const sections=(resolved.deviations||[]).map(({section,items})=>`<section class="training-center-customer-deviation" data-customer-sop-section="${esc(section)}"><h3>${esc(section)}</h3><ul>${(items||[]).map(item=>`<li>${esc(typeof item==='string'?item:JSON.stringify(item))}</li>`).join('')}</ul></section>`).join('');
  return `<article class="training-center-customer-sop" data-customer-sop="${esc(resolved.customerSop?.id||'')}"><p class="training-center-customer-sop__base-notice">${esc(resolved.notice||'')}</p>${sections}</article>`;
}

g.ExportHubTrainingCustomerSop=Object.freeze({SECTIONS,normalize,resolve,renderResolved});
})(globalThis);
