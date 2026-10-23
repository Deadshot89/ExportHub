(function(root){
'use strict';
if(root.ExportHubSopContext)return;

function text(value){return String(value==null?'':value).trim();}
function rightsOf(value){const r=value&&typeof value==='object'?value:{};const admin=r.admin===true||r.functionAdmin===true||r.level==='admin';const edit=admin||r.edit===true||r.level==='edit';const read=edit||r.read===true||r.visible===true||r.level==='view';return {read,edit,admin};}
function model(){return root.ExportHubIsoSopModel;}
function current(doc){const m=model();return m&&typeof m.currentVersionRecord==='function'?m.currentVersionRecord(doc):null;}
function statusOf(doc){const version=current(doc);return text(version&&version.status)||text(doc&&doc.status);}
function normalize(doc){const m=model();return m&&typeof m.normalizeDocument==='function'?m.normalizeDocument(doc):doc;}
function rulesOf(doc){if(Array.isArray(doc&&doc.contexts))return doc.contexts;if(doc&&doc.context&&typeof doc.context==='object')return [doc.context];return [];}
function list(value){if(Array.isArray(value))return value.map(text).filter(Boolean);const one=text(value);return one?[one]:[];}
function ruleMatches(rule,context){
  const r=rule&&typeof rule==='object'?rule:{};
  const c=context&&typeof context==='object'?context:{};
  if(text(r.view)&&text(r.view)!==text(c.view))return false;
  if(text(r.action)&&text(r.action)!==text(c.action))return false;
  const roles=list(r.roles&&r.roles.length?r.roles:r.role);
  if(roles.length&&!roles.includes(text(c.role)))return false;
  const customerIds=list(r.customerIds&&r.customerIds.length?r.customerIds:r.customerId);
  if(customerIds.length&&!customerIds.includes(text(c.customerId)))return false;
  return !!(text(r.view)||text(r.action)||roles.length||customerIds.length);
}
function scoreRule(rule){
  const r=rule||{};
  let score=0;
  if(text(r.view))score+=20;
  if(text(r.action))score+=40;
  if(list(r.roles&&r.roles.length?r.roles:r.role).length)score+=10;
  if(list(r.customerIds&&r.customerIds.length?r.customerIds:r.customerId).length)score+=5;
  return score;
}

function resolve(context,options){
  const c=context&&typeof context==='object'?context:{};
  const opts=options&&typeof options==='object'?options:{};
  const documents=Array.isArray(opts.documents)?opts.documents:[];
  const rights=rightsOf(opts.rights);
  if(!rights.read)return {matches:[],primary:null,effective:null};
  const scored=[];
  for(const doc of documents){
    if(text(doc&&doc.type)==='customer')continue;
    if(!rights.edit&&statusOf(doc)!=='Freigegeben')continue;
    const matches=rulesOf(doc).filter(rule=>ruleMatches(rule,c));
    if(!matches.length)continue;
    const score=Math.max(...matches.map(scoreRule));
    scored.push({doc,score});
  }
  scored.sort((a,b)=>b.score-a.score||text(a.doc&&a.doc.number).localeCompare(text(b.doc&&b.doc.number)));
  const matches=scored.map(item=>normalize(item.doc));
  const primary=matches[0]||null;
  if(!primary)return {matches,primary:null,effective:null};
  const overlay=root.ExportHubSopOverlay;
  const effective=overlay&&typeof overlay.resolve==='function'
    ?overlay.resolve({documents,baseSopNumber:primary.number,customerId:text(c.customerId),rights:opts.rights})
    :{ok:true,document:primary,overlay:null,conflicts:[],preview:false};
  return {matches,primary,effective};
}

root.ExportHubSopContext=Object.freeze({resolve});
})(typeof globalThis!=='undefined'?globalThis:this);
