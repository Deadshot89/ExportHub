(function(root){
'use strict';
// SOP2 Phase 1: isolated editor. The server remains authoritative for session,
// permissions, revision, four-eyes approval and every workflow transition.
if (root.Sop2Editor) return;
var FIELD_NAMES=['purpose','scope','responsibilities','prerequisites','checks','deviations','records'];
var LIST_FIELDS={responsibilities:true,prerequisites:true,checks:true,deviations:true,records:true};
var UI={
  de:{
    title:'SOP bearbeiten',version:'Version',revision:'Revision',draft:'Entwurf',
    review:'In Prüfung',approved:'Freigegeben',archived:'Archiviert',
    de:'Deutsch',en:'Englisch',purpose:'Zweck',scope:'Geltungsbereich',
    responsibilities:'Verantwortlichkeiten',prerequisites:'Voraussetzungen',
    checks:'Prüfpunkte',deviations:'Abweichungen',records:'Aufzeichnungen',
    steps:'Arbeitsschritte',step:'Schritt',screenshot:'Bildreferenz',tourTarget:'Tour-Ziel',
    addStep:'Schritt hinzufügen',removeStep:'Schritt entfernen',
    save:'Speichern',submit:'Zur Prüfung einreichen',approve:'Freigeben',
    reject:'Zurückweisen',reason:'Begründung der Zurückweisung (mind. 8 Zeichen)',
    lines:'Ein Eintrag pro Zeile',saved:'Entwurf gespeichert.',
    submitted:'Zur Prüfung eingereicht.',approvedNotice:'Freigabe abgeschlossen.',
    rejected:'Zur Bearbeitung zurückgegeben.',dirty:'Ungespeicherte Änderungen',
    pristine:'Keine ungespeicherten Änderungen',missing:'Keine SOP ausgewählt',
    readonly:'Nur lesen. Für diesen Status oder Benutzer ist Bearbeiten nicht erlaubt.',
    broken:'Dokumentintegrität nicht bestätigt – Bearbeitung gesperrt.',
    conflict:'Die SOP wurde zwischenzeitlich geändert. Der neue Serverstand wurde abgefragt. Deine Eingaben bleiben erhalten. Vergleiche beide Fassungen vor einer Entscheidung.',
    conflictFetch:'Die SOP wurde geändert. Neuladen fehlgeschlagen; deine Eingaben bleiben erhalten. Bitte Verbindung prüfen.',
    useServer:'Serverstand laden (meine Eingaben verwerfen)',
    useLocal:'Meine Eingaben nach Prüfung übernehmen',serverRevision:'Aktuelle Serverrevision',
    localConfirm:'Deine Eingaben können Änderungen einer anderen Person überschreiben. Nach Prüfung wirklich mit neuer Revision weiterarbeiten?',
    discardConfirm:'Ungespeicherte Eingaben wirklich verwerfen und den Serverstand übernehmen?',
    leaveConfirm:'Es gibt ungespeicherte SOP-Änderungen. Trotzdem verlassen?',
    missingReason:'Bitte eine nachvollziehbare Begründung mit mindestens 8 Zeichen eingeben.',
    submitDirty:'Bitte zuerst speichern, bevor du die SOP einreichst.',
    network:'Die Aktion konnte nicht gespeichert werden. Eingaben bleiben erhalten.',
    failed:'Vorgang fehlgeschlagen',errors:'Bitte folgende Angaben ergänzen:',
    noEdit:'Für diese Aktion fehlt das SOP-Bearbeitungsrecht.',
    protected:'Freigabe nur durch eine andere berechtigte Person (Vier-Augen-Prinzip).',
    limit:'Maximal 200 Schritte möglich.'
  },
  en:{
    title:'Edit SOP',version:'Version',revision:'Revision',draft:'Draft',
    review:'In review',approved:'Approved',archived:'Archived',
    de:'German',en:'English',purpose:'Purpose',scope:'Scope',
    responsibilities:'Responsibilities',prerequisites:'Prerequisites',
    checks:'Checks',deviations:'Deviations',records:'Records',
    steps:'Work steps',step:'Step',screenshot:'Image reference',tourTarget:'Tour target',
    addStep:'Add step',removeStep:'Remove step',
    save:'Save',submit:'Submit for review',approve:'Approve',
    reject:'Reject',reason:'Reason for rejection (at least 8 characters)',
    lines:'One item per line',saved:'Draft saved.',
    submitted:'Submitted for review.',approvedNotice:'Approval completed.',
    rejected:'Returned for editing.',dirty:'Unsaved changes',
    pristine:'No unsaved changes',missing:'No SOP selected',
    readonly:'Read only. Editing is not allowed for this status or user.',
    broken:'Document integrity not verified – editing blocked.',
    conflict:'This SOP has changed. The new server version was retrieved. Your edits are preserved. Compare both versions before proceeding.',
    conflictFetch:'This SOP has changed. Refresh failed; your edits are preserved. Check your connection.',
    useServer:'Load server version (discard my changes)',
    useLocal:'Keep my edits after comparison',serverRevision:'Current server revision',
    localConfirm:'Your edits could overwrite another user’s changes. After reviewing both, continue with the latest revision?',
    discardConfirm:'Discard your unsaved edits and load the server version?',
    leaveConfirm:'You have unsaved SOP changes. Leave anyway?',
    missingReason:'Please provide a meaningful reason of at least 8 characters.',
    submitDirty:'Save your draft before submitting it for review.',
    network:'The action could not be saved. Your edits are preserved.',
    failed:'Action failed',errors:'Please complete these fields:',
    noEdit:'SOP editing permission is required.',
    protected:'Approval requires a different authorized reviewer (four-eyes rule).',
    limit:'Maximum 200 steps.'
  }
};
function language(value){return /^de(?:$|[-_])/i.test(String(value||''))?'de':'en';}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function clone(value){return JSON.parse(JSON.stringify(value));}
function normalize(value){return typeof value==='string'?value.normalize('NFKC').trim().toLowerCase():'';}
function userKey(user){if(!object(user))return '';return ['user','login','username','name','id','userId'].map(k=>normalize(user[k])).find(Boolean)||'';}
function identities(user){
  if(typeof user==='string')return normalize(user)?[normalize(user)]:[];
  if(!object(user))return [];
  return ['user','login','username','name','id','userId'].map(k=>normalize(user[k])).filter(Boolean);
}
function canEdit(user){
  if(!object(user)||user.active===false||user.disabled===true||user.locked===true||!userKey(user))return false;
  var role=normalize(user.role||user.rolle);
  if(user.globalAdmin===true||user.isGlobalAdmin===true||
    ['global admin','global administrator','globaler administrator','globaler admin','administrator','admin','vollzugriff'].includes(role)||
    (Array.isArray(user.permissions)&&user.permissions.includes('*')))return true;
  var rights=user.rights&&user.rights.sop;
  if(!object(rights))return false;
  var level=normalize(rights.level||rights.access);
  return rights.edit===true||rights.admin===true||rights.functionAdmin===true||level==='edit'||level==='admin';
}
function canApprove(user,version){
  if(!canEdit(user)||!object(version))return false;
  var own=identities(user),author=identities(version.author),last=identities(version.lastEditor);
  if(!own.length||!author.length||!last.length)return false;
  return !own.some(k=>author.includes(k)||last.includes(k));
}
function el(dom,tag,className,text){
  var n=dom.createElement(tag);
  if(className)n.className=className;
  if(text!==undefined)n.textContent=String(text);
  return n;
}
function append(parent,child){parent.appendChild(child);return child;}
function attr(node,name,value){if(typeof node.setAttribute==='function')node.setAttribute(name,String(value));}
function clear(node){
  if(typeof node.replaceChildren==='function')node.replaceChildren();
  else while(node.firstChild)node.removeChild(node.firstChild);
}
function versionOf(doc,preferred){
  var all=Array.isArray(doc&&doc.versions)?doc.versions:[];
  var v=typeof preferred==='string'?preferred:(object(preferred)?preferred.version:null);
  if(v)return all.find(x=>x&&x.version===v)||null;
  return all.find(x=>x&&x.status==='draft')||all.find(x=>x&&x.status==='review')||
    all.find(x=>x&&x.status==='approved')||all[0]||null;
}
function integrityOk(doc){return !!(doc&&doc.historyIntegrity&&doc.historyIntegrity.ok===true&&doc.historyIntegrity.brokenAt===0);}
function mount(host,options){
  if(!host||typeof host.appendChild!=='function')throw new TypeError('SOP2_EDITOR_HOST_REQUIRED');
  var opts=object(options)?options:{}, client=opts.client||root.Sop2Client;
  if(!client||typeof client.act!=='function'||typeof client.get!=='function')throw new TypeError('SOP2_EDITOR_CLIENT_REQUIRED');
  var dom=host.ownerDocument||root.document;
  if(!dom||typeof dom.createElement!=='function')throw new TypeError('SOP2_EDITOR_DOCUMENT_REQUIRED');
  var dict=UI[language(opts.lang)],doc=opts.doc,version=versionOf(doc,opts.version);
  var sectionInputs={},stepRows=[],titleInput,statusNode,errorNode,conflictNode,conflictMeta,reasonInput,reasonLabel,buttons={};
  var baseline='',busy=false,conflicted=false,serverDoc=null,destroyed=false,pendingNotice='';
  var report={};
  function status(message,alert){
    if(!statusNode)return;
    statusNode.textContent=message||'';
    attr(statusNode,'role',alert?'alert':'status');
    statusNode.className=alert?'sop2-editor-notice sop2-editor-notice-error':'sop2-editor-notice';
  }
  function showErrors(errors){
    clear(errorNode);
    if(!Array.isArray(errors)||!errors.length)return;
    append(errorNode,el(dom,'p','',dict.errors));
    var list=append(errorNode,el(dom,'ul','sop2-editor-errors'));
    errors.forEach(function(err){
      if(!object(err))return;
      var part=dict[err.part]||err.part||err.code||dict.failed;
      var loc=err.lang==='de'?dict.de:err.lang==='en'?dict.en:'';
      var item=loc?loc+' · '+part:part;
      if(Number.isInteger(err.index))item+=' ('+(err.index+1)+')';
      append(list,el(dom,'li','',item));
    });
    attr(errorNode,'role','alert');
  }
  function buildStep(step){
    var entry=object(step)?clone(step):{id:'step-1',de:'',en:''};
    var row=append(stepPanel,el(dom,'div','sop2-editor-step'));
    attr(row,'data-step-id',entry.id);
    var head=append(row,el(dom,'div','sop2-editor-step-head'));
    append(head,el(dom,'strong','sop2-editor-step-label',dict.step+' '+(stepRows.length+1)));
    var remove=append(head,el(dom,'button','sop2-editor-remove-step',dict.removeStep));
    remove.type='button';
    var pair=append(row,el(dom,'div','sop2-editor-step-pair'));
    var values={};
    ['de','en'].forEach(function(lang){
      var wrap=append(pair,el(dom,'label','sop2-editor-step-lang'));
      append(wrap,el(dom,'span','',dict[lang]));
      var ta=append(wrap,el(dom,'textarea','sop2-editor-field'));
      ta.value=typeof entry[lang]==='string'?entry[lang]:'';
      ta.rows=3;ta.maxLength=10000;
      values[lang]=ta;
      if(typeof ta.addEventListener==='function')ta.addEventListener('input',refreshControls);
    });
    var references=append(row,el(dom,'div','sop2-editor-step-meta'));
    ['screenshot','tourTarget'].forEach(function(key){
      var label=append(references,el(dom,'label','sop2-editor-reference-label'));
      append(label,el(dom,'span','',dict[key]));
      var input=append(label,el(dom,'input','sop2-editor-reference'));
      input.type='text';input.value=typeof entry[key]==='string'?entry[key]:'';
      input.maxLength=1024;values[key]=input;
      if(typeof input.addEventListener==='function')input.addEventListener('input',refreshControls);
    });
    var record={node:row,entry:entry,values:values,remove:remove};
    stepRows.push(record);
    if(typeof remove.addEventListener==='function')remove.addEventListener('click',function(){
      if(!editable()||busy||conflicted)return;
      stepRows=stepRows.filter(x=>x!==record);
      if(typeof row.remove==='function')row.remove();
      else if(row.parentNode)row.parentNode.removeChild(row);
      renumber();refreshControls();
    });
    return record;
  }
  function renumber(){stepRows.forEach(function(r,i){
    var n=r.node.children[0]&&r.node.children[0].children[0];
    if(n)n.textContent=dict.step+' '+(i+1);
  });}
  function editable(){return integrityOk(doc)&&!!version&&version.status==='draft'&&canEdit(opts.user);}
  function approvable(){return integrityOk(doc)&&!!version&&version.status==='review'&&canApprove(opts.user,version);}
  function authorSubmit(){return editable()&&userKey(opts.user)===normalize(version.author);}
  function snapshot(){
    var content=clone(object(version&&version.content)?version.content:{});
    ['de','en'].forEach(function(lang){
      var section=clone(object(content[lang])?content[lang]:{});
      FIELD_NAMES.forEach(function(field){
        var input=sectionInputs[lang]&&sectionInputs[lang][field];
        var raw=input?String(input.value||''):'';
        section[field]=LIST_FIELDS[field]?raw.split(/\r?\n/).map(v=>v.trim()).filter(Boolean):raw;
      });
      content[lang]=section;
    });
    content.steps=stepRows.map(function(row){
      var step=clone(row.entry);
      ['de','en','screenshot','tourTarget'].forEach(function(field){
        step[field]=String(row.values[field].value||'');
      });
      return step;
    });
    return {title:titleInput?String(titleInput.value||''):'',content:content};
  }
  function dirty(){return !destroyed&&!!version&&JSON.stringify(snapshot())!==baseline;}
  function nextStepId(){
    var seen=new Set(stepRows.map(r=>r.entry.id));
    for(var index=1;index<=1000;index++){
      var id='step-'+index;
      if(!seen.has(id))return id;
    }
    return null;
  }
  function refreshControls(){
    var canWrite=editable()&&!busy&&!conflicted;
    var canReview=approvable()&&!busy&&!conflicted;
    var isDirty=dirty();
    titleInput.disabled=!canWrite;
    Object.keys(sectionInputs).forEach(lang=>FIELD_NAMES.forEach(field=>{
      sectionInputs[lang][field].disabled=!canWrite;
    }));
    stepRows.forEach(function(row){
      Object.keys(row.values).forEach(key=>row.values[key].disabled=!canWrite);
      row.remove.disabled=!canWrite;
    });
    buttons.add.disabled=!canWrite||stepRows.length>=200;
    buttons.save.disabled=!canWrite||!isDirty;
    buttons.submit.disabled=!canWrite||!authorSubmit()||isDirty;
    buttons.approve.disabled=!canReview;
    buttons.reject.disabled=!canReview;
    reasonInput.disabled=!canReview;
    buttons.save.hidden=!editable();
    buttons.submit.hidden=!authorSubmit();
    buttons.add.hidden=!editable();
    buttons.approve.hidden=!approvable();
    buttons.reject.hidden=!approvable();
    reasonLabel.hidden=!approvable();
    buttons.server.hidden=!conflicted||!serverDoc;
    buttons.local.hidden=!conflicted||!serverDoc;
    buttons.local.disabled=!serverDoc||!canEdit(opts.user)||!integrityOk(serverDoc)||
      !serverDoc.versions.some(v=>v&&v.version===version.version&&v.status==='draft');
    if(!pendingNotice)status(isDirty?dict.dirty:dict.pristine,false);
  }
  function updateDocument(next,message){
    if(!object(next)||!Number.isSafeInteger(next.revision)||!integrityOk(next))throw new TypeError('INVALID_API_DOCUMENT');
    var newVersion=versionOf(next,version&&version.version);
    if(!newVersion)throw new TypeError('INVALID_API_VERSION');
    doc=next;version=newVersion;serverDoc=null;conflicted=false;
    draw();pendingNotice=message||'';status(pendingNotice,false);
  }
  function conflictWarning(){
    conflicted=true;serverDoc=null;pendingNotice=dict.conflictFetch;
    status(pendingNotice,true);refreshControls();
    // A refresh must never replace the locally edited form or silently change
    // the revision used for writes. User resolves conflicts explicitly.
    return Promise.resolve().then(function(){return client.get(doc.id);}).then(function(fresh){
      if(!object(fresh)||!Number.isSafeInteger(fresh.revision)||!integrityOk(fresh))throw Error('INVALID_FRESH_DOCUMENT');
      serverDoc=fresh;pendingNotice=dict.conflict;status(pendingNotice,true);
      conflictMeta.textContent=dict.serverRevision+': '+fresh.revision;
      conflictNode.hidden=false;refreshControls();
    }).catch(function(){
      serverDoc=null;pendingNotice=dict.conflictFetch;status(pendingNotice,true);
      conflictNode.hidden=true;refreshControls();
    });
  }
  async function action(name,payload,success){
    if(busy||conflicted||destroyed)return false;
    if(name==='update'&&!editable())return false;
    if(name==='submit'&&!authorSubmit())return false;
    if((name==='approve'||name==='reject')&&!approvable())return false;
    if(name==='submit'&&dirty()){status(dict.submitDirty,true);return false;}
    if(name==='reject'&&(!reasonInput.value||reasonInput.value.trim().length<8)){
      status(dict.missingReason,true);return false;
    }
    busy=true;refreshControls();showErrors([]);
    try{
      var input=Object.assign({id:doc.id,version:version.version,revision:doc.revision},payload||{});
      var response=await client.act(name,input);
      if(!response||!object(response.item))throw new TypeError('INVALID_API_RESPONSE');
      updateDocument(response.item,success);
      return true;
    }catch(err){
      if(err&&((err.status===409)||err.code==='REVISION_CONFLICT')){
        await conflictWarning();
      } else {
        pendingNotice=(err&&typeof err.code==='string'?err.code+': ':'')+dict.network;
        status(pendingNotice,true);
        showErrors(err&&err.errors);
      }
      return false;
    }finally{busy=false;refreshControls();}
  }
  function createButton(parent,key,label,onClick){
    var btn=append(parent,el(dom,'button','sop2-editor-button sop2-editor-'+key,label));
    btn.type='button';buttons[key]=btn;
    if(typeof btn.addEventListener==='function')btn.addEventListener('click',onClick);
    return btn;
  }
  function draw(){
    clear(host);sectionInputs={de:{},en:{}};stepRows=[];buttons={};
    var frame=append(host,el(dom,'section','sop2-editor'));
    attr(frame,'aria-label',dict.title);
    if(!doc||!version){append(frame,el(dom,'p','sop2-editor-empty',dict.missing));return;}
    var header=append(frame,el(dom,'header','sop2-editor-header'));
    append(header,el(dom,'h2','',dict.title));
    append(header,el(dom,'p','sop2-editor-meta',doc.id+' · '+dict.version+' '+version.version+
      ' · '+dict.revision+' '+doc.revision+' · '+(dict[version.status]||version.status)));
    statusNode=append(frame,el(dom,'p','sop2-editor-notice',''));
    attr(statusNode,'role','status');
    errorNode=append(frame,el(dom,'div','sop2-editor-error-box'));
    if(!integrityOk(doc)){
      var warning=append(frame,el(dom,'p','sop2-editor-integrity',dict.broken));
      attr(warning,'role','alert');
    }
    if(!canEdit(opts.user)){
      append(frame,el(dom,'p','sop2-editor-permission',dict.readonly));
    }else if(version.status!=='draft'&&version.status!=='review'){
      append(frame,el(dom,'p','sop2-editor-permission',dict.readonly));
    }
    var titleLabel=append(frame,el(dom,'label','sop2-editor-title-label'));
    append(titleLabel,el(dom,'span','',dict.title));
    titleInput=append(titleLabel,el(dom,'input','sop2-editor-title'));
    titleInput.type='text';titleInput.value=typeof doc.title==='string'?doc.title:'';
    titleInput.maxLength=180;
    if(typeof titleInput.addEventListener==='function')titleInput.addEventListener('input',refreshControls);
    var languages=append(frame,el(dom,'div','sop2-editor-language-columns'));
    ['de','en'].forEach(function(lang){
      var col=append(languages,el(dom,'div','sop2-editor-language-column'));
      attr(col,'lang',lang);
      append(col,el(dom,'h3','sop2-editor-language-title',dict[lang]));
      var section=object(version.content&&version.content[lang])?version.content[lang]:{};
      FIELD_NAMES.forEach(function(field){
        var label=append(col,el(dom,'label','sop2-editor-section-label'));
        append(label,el(dom,'span','',dict[field]));
        if(LIST_FIELDS[field])append(label,el(dom,'small','sop2-editor-helper',dict.lines));
        var input=append(label,el(dom,'textarea','sop2-editor-field'));
        input.rows=LIST_FIELDS[field]?3:4;input.maxLength=10000;
        input.value=LIST_FIELDS[field]?(Array.isArray(section[field])?section[field].join('\n'):''):
          (typeof section[field]==='string'?section[field]:'');
        sectionInputs[lang][field]=input;
        if(typeof input.addEventListener==='function')input.addEventListener('input',refreshControls);
      });
    });
    var stepArea=append(frame,el(dom,'section','sop2-editor-steps'));
    append(stepArea,el(dom,'h3','',dict.steps));
    stepPanel=append(stepArea,el(dom,'div','sop2-editor-step-list'));
    var steps=Array.isArray(version.content&&version.content.steps)?version.content.steps:[];
    steps.forEach(function(step){buildStep(step);});
    createButton(stepArea,'add',dict.addStep,function(){
      if(!editable()||busy||conflicted)return;
      if(stepRows.length>=200){pendingNotice=dict.limit;status(pendingNotice,true);return;}
      var id=nextStepId();
      if(!id){pendingNotice=dict.limit;status(pendingNotice,true);return;}
      buildStep({id:id,de:'',en:''});renumber();pendingNotice='';refreshControls();
    });
    reasonLabel=append(frame,el(dom,'label','sop2-editor-reason-label'));
    append(reasonLabel,el(dom,'span','',dict.reason));
    reasonInput=append(reasonLabel,el(dom,'textarea','sop2-editor-reason'));
    reasonInput.rows=2;reasonInput.maxLength=1000;
    var actions=append(frame,el(dom,'div','sop2-editor-actions'));
    createButton(actions,'save',dict.save,function(){
      if(!editable()||!dirty()||conflicted)return;
      var local=snapshot();action('update',{title:local.title,content:local.content},dict.saved);
    });
    createButton(actions,'submit',dict.submit,function(){action('submit',{},dict.submitted);});
    createButton(actions,'approve',dict.approve,function(){action('approve',{},dict.approvedNotice);});
    createButton(actions,'reject',dict.reject,function(){
      action('reject',{reason:String(reasonInput.value||'').trim()},dict.rejected);
    });
    conflictNode=append(frame,el(dom,'section','sop2-editor-conflict'));
    conflictNode.hidden=true;attr(conflictNode,'role','group');
    conflictMeta=append(conflictNode,el(dom,'p','sop2-editor-conflict-meta',''));
    createButton(conflictNode,'server',dict.useServer,function(){
      if(!serverDoc||busy||!canLeave(true))return;
      var next=serverDoc;pendingNotice='';updateDocument(next,'');
    });
    createButton(conflictNode,'local',dict.useLocal,function(){
      if(!serverDoc||busy||!conflicted||!integrityOk(serverDoc))return;
      var newer=versionOf(serverDoc,version.version);
      if(!newer||newer.status!=='draft'||!canEdit(opts.user))return;
      if(typeof root.confirm!=='function'||!root.confirm(dict.localConfirm))return;
      // Preserve field DOM, but explicitly adopt the current server revision.
      doc=serverDoc;version=newer;serverDoc=null;conflicted=false;pendingNotice=dict.dirty;
      conflictNode.hidden=true;
      status(dict.dirty,true);refreshControls();
    });
    baseline=JSON.stringify(snapshot());pendingNotice='';refreshControls();
  }

  function canLeave(forceDiscard){
    if(!dirty())return true;
    if(typeof root.confirm!=='function')return false;
    return !!root.confirm(forceDiscard?dict.discardConfirm:dict.leaveConfirm);
  }
  function beforeUnload(event){
    if(dirty()){
      if(event&&typeof event.preventDefault==='function')event.preventDefault();
      if(event)event.returnValue='';
    }
  }
  function unmount(){
    if(!canLeave(false))return false;
    if(typeof root.removeEventListener==='function')root.removeEventListener('beforeunload',beforeUnload);
    destroyed=true;clear(host);return true;
  }
  // The step list is always scoped to the editor's host.
  var stepPanel=null;
  draw();
  if(typeof root.addEventListener==='function')root.addEventListener('beforeunload',beforeUnload);
  report={isDirty:dirty,canLeave:canLeave,unmount:unmount,
    snapshot:snapshot,
    save:function(){if(!editable()||!dirty()||conflicted)return Promise.resolve(false);
      var local=snapshot();return action('update',{title:local.title,content:local.content},dict.saved);},
    submit:function(){return action('submit',{},dict.submitted);},
    approve:function(){return action('approve',{},dict.approvedNotice);},
    reject:function(reason){reasonInput.value=String(reason||'');return action('reject',{reason:reasonInput.value.trim()},dict.rejected);},
    resolveServer:function(){if(serverDoc&&canLeave(true)){updateDocument(serverDoc,'');return true;}return false;},
    getDocument:function(){return doc;},
    hasConflict:function(){return conflicted;}
  };
  return Object.freeze(report);
}
root.Sop2Editor=Object.freeze({mount:mount,canEdit:canEdit,canApprove:canApprove});
})(typeof window!=='undefined'?window:globalThis);
