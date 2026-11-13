(function(root){
'use strict';
// SOP2 Phase 1: DOM-only reader. Untrusted SOP content is always rendered as text.
if (root.Sop2Reader) return;

var WORDS={
  de:{
    eyebrow:'Gelenkte Arbeitsanweisung',version:'Version',status:'Status',author:'Autor',
    purpose:'Zweck',scope:'Geltungsbereich',responsibilities:'Verantwortlichkeiten',
    prerequisites:'Voraussetzungen',checks:'Prüfpunkte',deviations:'Abweichungen',
    records:'Aufzeichnungen',steps:'Arbeitsschritte',screenshot:'Bildreferenz',tourTarget:'Tour-Ziel',
    empty:'Noch kein Inhalt vorhanden',missing:'Keine SOP ausgewählt',
    draft:'Entwurf',review:'In Prüfung',approved:'Freigegeben',archived:'Archiviert',
    valid:'Gültige freigegebene Version',notValid:'Nicht freigegeben – nicht als Arbeitsanweisung gültig',
    historic:'Historische Version – nicht mehr gültig',
    broken:'Integritätsprüfung fehlgeschlagen. Inhalt nicht als gültig verwenden.',
    unverified:'Integritätsprüfung nicht bestätigt. Inhalt nicht als gültig verwenden.',
    languages:'Dokumentsprache',german:'Deutsch',english:'Englisch'
  },
  en:{
    eyebrow:'Controlled work instruction',version:'Version',status:'Status',author:'Author',
    purpose:'Purpose',scope:'Scope',responsibilities:'Responsibilities',
    prerequisites:'Prerequisites',checks:'Checks',deviations:'Deviations',
    records:'Records',steps:'Work steps',screenshot:'Image reference',tourTarget:'Tour target',
    empty:'No content available yet',missing:'No SOP selected',
    draft:'Draft',review:'In review',approved:'Approved',archived:'Archived',
    valid:'Current approved version',notValid:'Not approved – not a valid work instruction',
    historic:'Historic version – no longer valid',
    broken:'Document integrity check failed. Do not treat this as approved.',
    unverified:'Document integrity not confirmed. Do not treat this as approved.',
    languages:'Document language',german:'German',english:'English'
  }
};
var FIELDS=['purpose','scope','responsibilities','prerequisites','checks','deviations','records'];
var LIST_FIELDS=new Set(['responsibilities','prerequisites','checks','deviations','records']);
function pickLanguage(value) {
  return /^de(?:$|[-_])/i.test(typeof value==='string'?value.trim():'')?'de':'en';
}
function element(doc,tag,className,text) {
  var node=doc.createElement(tag);
  if (className) node.className=className;
  if (text!==undefined&&text!==null) node.textContent=String(text);
  return node;
}
function attach(parent,child) {parent.appendChild(child);return child;}
function attribute(node,key,value) {
  if (typeof node.setAttribute==='function') node.setAttribute(key,String(value));
}
function empty(host) {
  if (typeof host.replaceChildren==='function') host.replaceChildren();
  else while (host.firstChild) host.removeChild(host.firstChild);
}
function chooseVersion(doc,version) {
  var all=Array.isArray(doc&&doc.versions)?doc.versions.filter(v=>v&&typeof v==='object'):[];
  if (version&&typeof version==='object') return all.find(v=>v.version===version.version)||null;
  if (typeof version==='string') return all.find(v=>v.version===version)||null;
  return all.find(v=>v.status==='approved')||all.find(v=>v.status==='review')||
    all.find(v=>v.status==='draft')||all[0]||null;
}
function integrityOf(doc) {
  return !!(doc&&doc.historyIntegrity&&doc.historyIntegrity.ok===true&&doc.historyIntegrity.brokenAt===0);
}
function section(panel,dom,dict,key,value) {
  var block=attach(panel,element(dom,'section','sop2-reader-section'));
  attach(block,element(dom,'h3','sop2-reader-section-title',dict[key]));
  if (LIST_FIELDS.has(key)) {
    var values=Array.isArray(value)?value:[];
    if (!values.length){attach(block,element(dom,'p','sop2-reader-empty',dict.empty));return;}
    var ul=attach(block,element(dom,'ul','sop2-reader-list'));
    values.forEach(function(item) {
      // Never accept arbitrary markup or element descriptors from stored content.
      attach(ul,element(dom,'li','',typeof item==='string'?item:dict.empty));
    });
  } else {
    attach(block,element(dom,'p','sop2-reader-body',typeof value==='string'&&value.trim()?value:dict.empty));
  }
}
function render(host,options) {
  if (!host||typeof host.appendChild!=='function') throw new TypeError('SOP2_READER_HOST_REQUIRED');
  var config=options&&typeof options==='object'?options:{};
  var language=pickLanguage(config.lang);
  var dict=WORDS[language];
  var dom=host.ownerDocument||root.document;
  if (!dom||typeof dom.createElement!=='function') throw new TypeError('SOP2_READER_DOCUMENT_REQUIRED');
  var sop=config.doc,version=chooseVersion(sop,config.version);
  empty(host);
  var frame=attach(host,element(dom,'article','sop2-reader'));
  attribute(frame,'lang',language);
  if (!sop||!version) {
    attach(frame,element(dom,'p','sop2-reader-empty',dict.missing));
    return frame;
  }
  var verified=integrityOf(sop);
  var current=verified&&version.status==='approved'&&
    sop.versions.filter(v=>v&&v.status==='approved').length===1;
  var header=attach(frame,element(dom,'header','sop2-reader-header'));
  attach(header,element(dom,'p','sop2-reader-eyebrow',dict.eyebrow));
  attach(header,element(dom,'h2','sop2-reader-title',sop.title||dict.missing));
  var meta=attach(header,element(dom,'div','sop2-reader-meta'));
  attach(meta,element(dom,'span','sop2-reader-number',sop.id||''));
  attach(meta,element(dom,'span','sop2-reader-version',dict.version+' '+(version.version||'—')));
  attach(meta,element(dom,'span','sop2-reader-status',dict.status+': '+(dict[version.status]||dict.draft)));

  var controls=attach(header,element(dom,'div','sop2-reader-language'));
  attribute(controls,'role','group');attribute(controls,'aria-label',dict.languages);
  ['de','en'].forEach(function(code) {
    var btn=attach(controls,element(dom,'button','sop2-reader-language-button',code==='de'?dict.german:dict.english));
    btn.type='button';
    attribute(btn,'lang',code);
    attribute(btn,'aria-pressed',code===language?'true':'false');
    if (typeof btn.addEventListener==='function')btn.addEventListener('click',function(){
      render(host,{doc:sop,version:version,lang:code});
    });
  });

  var notice=attach(frame,element(dom,'p',
    current?'sop2-reader-notice sop2-reader-notice-approved':'sop2-reader-notice sop2-reader-notice-warning',
    current?dict.valid:version.status==='archived'?dict.historic:dict.notValid));
  attribute(notice,'role','status');
  if (!verified) {
    var hasKnownFailure=!!(sop.historyIntegrity&&sop.historyIntegrity.ok===false);
    var warning=attach(frame,element(dom,'p','sop2-reader-integrity-warning',
      hasKnownFailure?dict.broken:dict.unverified));
    attribute(warning,'role','alert');
  }
  var details=attach(frame,element(dom,'div','sop2-reader-details'));
  if (sop.area)attach(details,element(dom,'span','sop2-reader-area',sop.area));
  if (version.author)attach(details,element(dom,'span','sop2-reader-author',dict.author+': '+version.author));

  var body=attach(frame,element(dom,'div','sop2-reader-content'));
  var content=version.content&&typeof version.content==='object'?version.content:{};
  var languageSection=content[language]&&typeof content[language]==='object'?content[language]:{};
  FIELDS.forEach(function(field){section(body,dom,dict,field,languageSection[field]);});
  var steps=attach(body,element(dom,'section','sop2-reader-section sop2-reader-steps'));
  attach(steps,element(dom,'h3','sop2-reader-section-title',dict.steps));
  if (!Array.isArray(content.steps)||!content.steps.length) {
    attach(steps,element(dom,'p','sop2-reader-empty',dict.empty));
  } else {
    var ol=attach(steps,element(dom,'ol','sop2-reader-step-list'));
    content.steps.forEach(function(item) {
      var step=item&&typeof item==='object'?item:{};
      var li=attach(ol,element(dom,'li','sop2-reader-step'));
      attach(li,element(dom,'p','sop2-reader-step-text',
        typeof step[language]==='string'&&step[language].trim()?step[language]:dict.empty));
      // Screenshot and tour target are metadata, never executable or loaded URLs.
      if (typeof step.screenshot==='string'&&step.screenshot.trim()) {
        attach(li,element(dom,'small','sop2-reader-reference',dict.screenshot+': '+step.screenshot));
      }
      if (typeof step.tourTarget==='string'&&step.tourTarget.trim()) {
        attach(li,element(dom,'small','sop2-reader-reference',dict.tourTarget+': '+step.tourTarget));
      }
    });
  }
  return frame;
}
root.Sop2Reader=Object.freeze({pickLanguage:pickLanguage,render:render});
})(typeof window!=='undefined'?window:globalThis);
