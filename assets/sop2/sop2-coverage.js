(function(root){
'use strict';
// SOP2 Phase 1, Task 9. Isolated adapter: NOT wired to the old SOP view.
// Real authenticated SOP2 documents are the only process-document source.
// Never convert a draft or incomplete provenance into an approved SOP.
// Tour/image/exam completion cannot be inferred from a text reference.
if(root.Sop2Coverage)return;

var SOP_ID=/^SOP-EH-\d{3}$/;
var ERRORS={
  de:{loading:'SOP2-Abdeckung wird geladen…',
    unavailable:'SOP2-Abdeckung nicht verfügbar. Keine bestätigten aktuellen Dokumentdaten.',
    disabled:'SOP2 ist noch nicht aktiviert. Keine Abdeckungszahlen anzeigen.',
    denied:'Keine Berechtigung oder gültige Sitzung für die SOP2-Abdeckung.',
    missing:'SOP2-Dashboard ist nicht geladen.'},
  en:{loading:'Loading SOP2 coverage…',
    unavailable:'SOP2 coverage unavailable. No verified current documents.',
    disabled:'SOP2 is not enabled. Coverage figures are not available.',
    denied:'SOP2 coverage requires a valid authorized session.',
    missing:'SOP2 dashboard has not been loaded.'}
};
function text(value){return typeof value==='string'?value.trim():'';}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function array(value){return Array.isArray(value)?value:[];}
function language(value){return /^de(?:$|[-_])/i.test(String(value||''))?'de':'en';}
function registryEntries(override) {
  if(Array.isArray(override))return override;
  return array(root.ExportHubSopFunctionRegistry&&root.ExportHubSopFunctionRegistry.entries);
}
function validApprovedVersion(doc){
  if(!object(doc)||doc.schemaVersion!==1||!SOP_ID.test(doc.id)||
     !Number.isSafeInteger(doc.revision)||doc.revision<1||
     !object(doc.historyIntegrity)||doc.historyIntegrity.ok!==true||
     doc.historyIntegrity.brokenAt!==0)return null;
  var versions=array(doc.versions).filter(object);
  var approved=versions.filter(v=>v.status==='approved');
  if(approved.length!==1)return null;
  var chosen=approved[0];
  // Server-side approval stamps must actually exist. Legacy fake stamps are
  // never pulled into this adapter, and no browser-side stamp is generated.
  if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(text(chosen.version))||
     !text(chosen.approvedBy)||!text(chosen.approvedAt)||
     !object(chosen.content))return null;
  return chosen;
}
function toCoverageDocuments(documents,registry) {
  var entries=registryEntries(registry);
  var allowed=new Set(entries.filter(object).map(e=>text(e.sopNumber)).filter(s=>SOP_ID.test(s)));
  var seen=new Set(),out=[];
  array(documents).forEach(function(doc){
    if(!object(doc)||!allowed.has(doc.id)||seen.has(doc.id))return;
    seen.add(doc.id);
    var version=validApprovedVersion(doc);
    if(!version)return;
    var steps=array(version.content.steps).filter(object).map(function(step,index){
      return {
        id:text(step.id)||'step-'+(index+1),
        order:index+1,title:text(step.de)||text(step.en),
        instruction:text(step.de)||text(step.en),
        // Do not infer a valid installed RC1501 tour from a tourTarget string.
        // Nor infer an RC1503 exam from existing content or old catalogue data.
        expectedAction:'',target:{stableKey:''},tour:{enabled:false},
        exam:{relevant:false},checks:[]
      };
    });
    var selected={
      id:'SOP2-'+doc.id,type:'process',number:doc.id,
      title:text(doc.title),area:text(doc.area),
      status:'Freigegeben',version:version.version,currentVersion:version.version,
      approvedBy:version.approvedBy,
      versions:[{
        version:version.version,status:'Freigegeben',
        approvedBy:version.approvedBy,
        content:{steps:steps},
        // A screenshot text/path is not proof that a valid asset exists.
        visuals:[]
      }]
    };
    out.push(selected);
  });
  return out;
}
function mount(host,options) {
  if(!host||typeof host.appendChild!=='function')throw new TypeError('SOP2_COVERAGE_HOST_REQUIRED');
  var opts=object(options)?options:{};
  var client=opts.client||root.Sop2Client;
  if(!client||typeof client.list!=='function')throw new TypeError('SOP2_COVERAGE_CLIENT_REQUIRED');
  if(typeof opts.onOpen!=='function')throw new TypeError('SOP2_COVERAGE_OPEN_HANDLER_REQUIRED');
  var doc=host.ownerDocument||root.document;
  if(!doc||typeof doc.createElement!=='function')throw new TypeError('SOP2_COVERAGE_DOCUMENT_REQUIRED');
  var dict=ERRORS[language(opts.lang===undefined?'de':opts.lang)];
  var dashboard=root.ExportHubSopCoverageDashboard;
  var entries=registryEntries(opts.entries);
  var controller=null,destroyed=false,generation=0,state='loading';
  function clear(){
    if(controller&&typeof controller.destroy==='function'){controller.destroy();controller=null;}
    if(typeof host.replaceChildren==='function')host.replaceChildren();
    else while(host.firstChild)host.removeChild(host.firstChild);
  }
  function notice(message,alert){
    clear();
    var el=doc.createElement('p');
    el.className=alert?'sop2-coverage-error':'sop2-coverage-loading';
    el.textContent=message;
    if(typeof el.setAttribute==='function')el.setAttribute('role',alert?'alert':'status');
    host.appendChild(el);
  }
  function onNavigate(target){
    if(!object(target)||!SOP_ID.test(text(target.sopNumber)))return;
    if(target.kind!=='sop'&&target.kind!=='step')return;
    // Never open legacy handbooks, dispatch browser events, or setView().
    opts.onOpen({number:target.sopNumber,stepId:target.kind==='step'?text(target.stepId):''});
  }
  async function refresh() {
    if(destroyed)return null;
    var run=++generation;
    try {
      if(!dashboard||typeof dashboard.mount!=='function')throw Object.assign(new Error('MISSING_DASHBOARD'),{code:'MISSING_DASHBOARD'});
      if(!entries.length)throw Object.assign(new Error('MISSING_REGISTRY'),{code:'MISSING_DASHBOARD'});
      var docs=await client.list();
      if(destroyed||run!==generation)return null;
      if(!Array.isArray(docs))throw new TypeError('INVALID_SOP2_LIST');
      var items=toCoverageDocuments(docs,entries);
      var parameters={
        documents:items,entries:entries,
        customers:array(opts.customers),onNavigate:onNavigate,
        // No old team-state or legacy catalog as an implicit fallback.
        // A screenshot reference without a verified file never counts.
        assetExists:function(){return false;}
      };
      if(!controller){
        clear();
        controller=dashboard.mount(host,parameters);
        if(!controller||typeof controller.refresh!=='function')throw new TypeError('INVALID_DASHBOARD');
      }else controller.refresh(parameters);
      state='ready';
      return controller.getModel();
    } catch(err){
      if(destroyed||run!==generation)return null;
      state='error';
      var key=err&&err.code==='SOP2_DISABLED'?'disabled':
        (err&&['AUTH_REQUIRED','SOP_READ_FORBIDDEN','SOP_EDIT_FORBIDDEN'].includes(err.code))?'denied':
        (err&&err.code==='MISSING_DASHBOARD')?'missing':'unavailable';
      notice(dict[key],true);
      return null;
    }
  }
  notice(dict.loading,false);
  var ready=refresh();
  return Object.freeze({
    ready:ready,refresh:refresh,
    getModel:function(){return controller&&typeof controller.getModel==='function'?controller.getModel():null;},
    getStatus:function(){return state;},
    destroy:function(){if(destroyed)return;destroyed=true;generation++;clear();}
  });
}
root.Sop2Coverage=Object.freeze({toCoverageDocuments:toCoverageDocuments,mount:mount});
})(typeof window!=='undefined'?window:globalThis);
