(function(root){
'use strict';
// SOP2 Phase 1 navigation bridge. Additive, OFF by default, production ALWAYS OFF.
// No legacy SOP migration, no API activation, no writes unless a permitted user
// explicitly invokes an editor action after separate environment enablement.
if(root.ExportHubSop2)return;
const ID=/^SOP-EH-\d{3}$/,TEST_HOST=/-testservice\.[a-z0-9.-]*azurestaticapps\.net$/i;
function text(value){return typeof value==='string'?value.trim():'';}
function obj(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function environment(){
  const loc=root.location||{};
  const host=text(loc.hostname).toLowerCase(),path=text(loc.pathname).toLowerCase();
  if(host==='www.exporthub360.de'||host==='exporthub360.de')return 'production';
  if(TEST_HOST.test(host))return path==='/demo.html'?'demo':'testservice';
  if((host==='localhost'||host==='127.0.0.1')&&path==='/demo.html')return 'demo';
  return 'production';
}
function enabled(){
  // The explicit switch is an additional UI opt-in, never authorization.
  // The SOP2 API has its own server-side default-off feature gate.
  return root.__EXPORTHUB_SOP2_PHASE1__===true&&environment()!=='production';
}
function language(){
  try{
    const i18n=root.ExportHUBI18n;
    if(i18n&&typeof i18n.language==='function')return text(i18n.language())||'de';
    if(i18n&&typeof i18n.getLanguage==='function')return text(i18n.getLanguage())||'de';
    const user=currentUser();
    return text(user&&user.language)||'de';
  }catch(_){return 'de';}
}
function words(){
  const api=root.ExportHubSop2I18n;
  return api&&typeof api.get==='function'?api.get(language()):{
    title:'SOP',loading:'Loading SOP…',unavailable:'SOP2 unavailable.',
    disabled:'SOP2 is disabled.',noDocument:'SOP2 document not found.'
  };
}
function currentUser(){
  try{
    const state=typeof root.__EXPORTHUB_GET_STATE__==='function'?root.__EXPORTHUB_GET_STATE__():null;
    if(obj(state)){if(obj(state.currentUser))return state.currentUser;if(obj(state.activeUser))return state.activeUser;}
    if(obj(root.currentUser))return root.currentUser;
    if(root.ExportHUBClean&&root.ExportHUBClean.runtime&&obj(root.ExportHUBClean.runtime.user))
      return root.ExportHUBClean.runtime.user;
  }catch(_){}
  return null;
}
function make(doc,tag,cls,content){
  const n=doc.createElement(tag);if(cls)n.className=cls;
  if(content!==undefined)n.textContent=String(content);
  return n;
}
function append(parent,child){parent.appendChild(child);return child;}
function clear(host){
  if(typeof host.replaceChildren==='function')host.replaceChildren();
  else while(host.firstChild)host.removeChild(host.firstChild);
}
function mark(node,role){
  if(node&&typeof node.setAttribute==='function')node.setAttribute('role',role);
}
function errorMessage(error){
  const w=words(),code=text(error&&error.code);
  if(code==='SOP2_DISABLED')return w.disabled;
  if(code==='SOP_NOT_FOUND')return w.noDocument;
  if(code==='AUTH_REQUIRED'||code==='SOP_READ_FORBIDDEN'||code==='SOP_EDIT_FORBIDDEN')return w.denied;
  if(code==='REVISION_CONFLICT'||code==='CONCURRENT_UPDATE')return w.conflict;
  return w.unavailable;
}
function validIntegration(){
  return root.Sop2Client&&typeof root.Sop2Client.list==='function'&&typeof root.Sop2Client.get==='function'&&
    typeof root.Sop2Client.act==='function'&&root.Sop2Coverage&&typeof root.Sop2Coverage.mount==='function'&&
    root.Sop2Reader&&typeof root.Sop2Reader.render==='function'&&
    root.Sop2Editor&&typeof root.Sop2Editor.mount==='function'&&
    root.ExportHubSopCoverageDashboard&&root.ExportHubSopFunctionRegistry;
}
function mount(view,options){
  if(!enabled())return null;
  const host=typeof view==='string'&&root.document?root.document.querySelector(view):view;
  const opts=obj(options)?options:{};
  const doc=host&&(host.ownerDocument||root.document);
  if(!host||typeof host.appendChild!=='function'||!doc)return null;
  if(!validIntegration())return null; // Leave the old SOP UI untouched on missing prerequisites.
  const client=opts.client||root.Sop2Client;
  if(!client||typeof client.get!=='function'||typeof client.list!=='function'||typeof client.act!=='function')return null;
  const editorApi=root.Sop2Editor,readerApi=root.Sop2Reader;
  let editor=null,coverage=null,disposed=false,seq=0,current=null,selected='',step='',mode='read';
  const owner=typeof opts.user==='function'?opts.user:()=>opts.user||currentUser();
  // Only after every prerequisite has been validated do we replace legacy DOM.
  clear(host);
  const panel=append(host,make(doc,'section','sop2-workspace'));
  mark(panel,'region');
  const header=append(panel,make(doc,'header','sop2-workspace-header'));
  append(header,make(doc,'h2','',words().title));
  append(header,make(doc,'p','sop2-workspace-intro',words().subtitle));
  const nav=append(panel,make(doc,'div','sop2-workspace-nav'));
  const back=append(nav,make(doc,'button','sop2-workspace-back',words().back));back.type='button';
  const refresh=append(nav,make(doc,'button','sop2-workspace-refresh',words().refresh));refresh.type='button';
  const notice=append(panel,make(doc,'p','sop2-workspace-notice',''));mark(notice,'status');
  const coverageHost=append(panel,make(doc,'div','sop2-workspace-coverage'));
  const detail=append(panel,make(doc,'section','sop2-workspace-detail'));detail.hidden=true;
  const actions=append(detail,make(doc,'div','sop2-workspace-actions'));
  const readerButton=append(actions,make(doc,'button','sop2-workspace-reader',words().reader));
  const editorButton=append(actions,make(doc,'button','sop2-workspace-editor',words().editor));
  const versionButton=append(actions,make(doc,'button','sop2-workspace-new-version',words().newVersion));
  readerButton.type=editorButton.type=versionButton.type='button';
  const content=append(detail,make(doc,'div','sop2-workspace-content'));
  const create=append(detail,make(doc,'form','sop2-workspace-create'));create.hidden=true;
  const createInputs={};
  for(const [name,kind] of [['title','createTitle'],['area','createArea'],['functionId','createFunction']]){
    const label=append(create,make(doc,'label','sop2-workspace-create-label'));
    append(label,make(doc,'span','',words()[kind]));
    const input=append(label,make(doc,'input','sop2-workspace-create-input'));
    input.type='text';input.required=true;input.maxLength=name==='title'?180:120;createInputs[name]=input;
  }
  const createButton=append(create,make(doc,'button','sop2-workspace-create-submit',words().create));
  createButton.type='submit';
  back.hidden=true;refresh.hidden=false;
  function message(msg,alert){
    notice.textContent=String(msg||'');
    notice.className=alert?'sop2-workspace-notice sop2-workspace-error':'sop2-workspace-notice';
    mark(notice,alert?'alert':'status');
  }
  function leaveEditor(){
    if(!editor)return true;
    if(typeof editor.unmount==='function'&&editor.unmount()===false)return false;
    editor=null;return true;
  }
  function showOverview(){
    if(disposed||!leaveEditor())return false;
    seq++;current=null;selected='';step='';mode='read';
    detail.hidden=true;coverageHost.hidden=false;back.hidden=true;message('',false);
    // After edits/approvals, coverage must re-read the server; never retain a
    // stale approved count when returning to the dashboard.
    if(coverage&&typeof coverage.refresh==='function')coverage.refresh();
    return true;
  }
  function focusStep(data,stepId){
    if(!stepId||!data||!Array.isArray(data.versions))return;
    const versions=data.versions,approved=versions.filter(v=>v&&v.status==='approved');
    const chosen=approved.length===1?approved[0]:versions.find(v=>v&&v.status==='draft')||versions[0];
    const steps=chosen&&chosen.content&&Array.isArray(chosen.content.steps)?chosen.content.steps:[];
    const index=steps.findIndex(item=>item&&item.id===stepId);
    if(index<0||typeof content.querySelectorAll!=='function')return;
    const nodes=content.querySelectorAll('.sop2-reader-step');
    const node=nodes&&nodes[index];
    if(node){
      if(typeof node.setAttribute==='function')node.setAttribute('tabindex','-1');
      if(typeof node.scrollIntoView==='function')node.scrollIntoView({block:'center'});
      if(typeof node.focus==='function')node.focus({preventScroll:true});
    }
  }
  function draw(){
    if(disposed||!current)return;
    if(!leaveEditor())return;
    clear(content);
    if(mode==='edit'&&editorApi.canEdit(owner())){
      editor=editorApi.mount(content,{doc:current,user:owner(),client,lang:language()});
    }else{
      mode='read';
      readerApi.render(content,{doc:current,lang:language()});
      focusStep(current,step);
    }
    readerButton.hidden=false;
    editorButton.hidden=!editorApi.canEdit(owner())||!current.historyIntegrity||current.historyIntegrity.ok!==true;
    versionButton.hidden=!editorApi.canEdit(owner())||
      !current.historyIntegrity||current.historyIntegrity.ok!==true||
      current.versions.filter(v=>v&&v.status==='approved').length!==1||
      current.versions.some(v=>v&&(v.status==='draft'||v.status==='review'));
    create.hidden=true;
  }
  function showCreate(id){
    clear(content);
    create.hidden=false;
    const matching=(root.ExportHubSopFunctionRegistry.entries||[]).find(e=>e&&e.sopNumber===id);
    createInputs.title.value='';createInputs.area.value=text(matching&&matching.area)||'ExportHUB';
    createInputs.functionId.value=text(matching&&matching.id);
    readerButton.hidden=editorButton.hidden=versionButton.hidden=true;
  }
  async function open(id,stepId){
    if(disposed||!ID.test(text(id))||!leaveEditor())return false;
    const ticket=++seq;
    selected=id;step=text(stepId);current=null;mode='read';
    detail.hidden=false;coverageHost.hidden=true;back.hidden=false;create.hidden=true;
    clear(content);message(words().loading,false);
    try{
      const found=await client.get(id);
      if(disposed||ticket!==seq)return false;
      if(!obj(found)||found.id!==id)throw new Error('INVALID_API_DOCUMENT');
      current=found;message('',false);draw();return true;
    }catch(err){
      if(disposed||ticket!==seq)return false;
      message(errorMessage(err),true);
      if(err&&err.code==='SOP_NOT_FOUND'&&editorApi.canEdit(owner())&&
        (root.ExportHubSopFunctionRegistry.entries||[]).some(e=>e&&e.sopNumber===id))showCreate(id);
      return false;
    }
  }
  async function newVersion(){
    if(disposed||!current||!editorApi.canEdit(owner())||!leaveEditor())return false;
    const id=current.id,revision=current.revision;
    if(!ID.test(id)||!Number.isSafeInteger(revision))return false;
    versionButton.disabled=true;
    try{
      const result=await client.act('new-version',{id,revision});
      if(disposed)return false;
      if(!result||!obj(result.item)||result.item.id!==id)throw new Error('INVALID_API_DOCUMENT');
      current=result.item;mode='edit';step='';
      message(words().versionCreated,false);draw();return true;
    }catch(err){message(errorMessage(err),true);return false;}
    finally{versionButton.disabled=false;}
  }
  async function onCreate(event){
    if(event&&typeof event.preventDefault==='function')event.preventDefault();
    if(disposed||!ID.test(selected)||!editorApi.canEdit(owner()))return false;
    const input={id:selected,
      title:text(createInputs.title.value),area:text(createInputs.area.value),
      functionId:text(createInputs.functionId.value)};
    if(!input.title||!input.area||!input.functionId){message(words().createHint,true);return false;}
    createButton.disabled=true;
    try{
      const result=await client.act('create',input);
      if(disposed)return false;
      if(!result||!obj(result.item)||result.item.id!==selected)throw new Error('INVALID_API_DOCUMENT');
      current=result.item;mode='edit';create.hidden=true;
      message(words().draftCreated,false);draw();return true;
    }catch(err){message(errorMessage(err),true);return false;}
    finally{createButton.disabled=false;}
  }
  function onBack(){showOverview();}
  function onRefresh(){
    if(disposed)return;
    if(selected)open(selected,step);
    else if(coverage&&typeof coverage.refresh==='function')coverage.refresh();
  }
  function onRead(){if(!disposed&&current){
    // Editor actions update the server document and its revision. Re-fetch
    // rather than rendering stale pre-edit content from a cached snapshot.
    open(current.id,step);
  }}
  function onEdit(){if(!disposed&&current&&editorApi.canEdit(owner())){mode='edit';draw();}}
  back.addEventListener('click',onBack);
  refresh.addEventListener('click',onRefresh);
  readerButton.addEventListener('click',onRead);
  editorButton.addEventListener('click',onEdit);
  versionButton.addEventListener('click',newVersion);
  create.addEventListener('submit',onCreate);
  try{
    coverage=root.Sop2Coverage.mount(coverageHost,{client,onOpen:target=>open(target.number,target.stepId),
      lang:language(),customers:Array.isArray(opts.customers)?opts.customers:[]});
    if(!coverage)throw new Error('COVERAGE_MOUNT_FAILED');
  }catch(_){
    back.removeEventListener('click',onBack);
    refresh.removeEventListener('click',onRefresh);
    readerButton.removeEventListener('click',onRead);
    editorButton.removeEventListener('click',onEdit);
    versionButton.removeEventListener('click',newVersion);
    create.removeEventListener('submit',onCreate);
    clear(host);
    return null;
  }
  // The old RC1506 runtime must not add a legacy coverage panel to SOP2.
  if(root.ExportHubSopCoverageRuntime&&typeof root.ExportHubSopCoverageRuntime.stop==='function'){
    try{root.ExportHubSopCoverageRuntime.stop();}catch(_){}
  }
  return Object.freeze({
    open,refresh:onRefresh,back:showOverview,getCoverage:()=>coverage,
    canLeave:()=>!editor||typeof editor.canLeave!=='function'||editor.canLeave(),
    destroy(){
      if(disposed||!leaveEditor())return false;
      disposed=true;seq++;if(coverage&&typeof coverage.destroy==='function')coverage.destroy();
      back.removeEventListener('click',onBack);
      refresh.removeEventListener('click',onRefresh);
      readerButton.removeEventListener('click',onRead);
      editorButton.removeEventListener('click',onEdit);
      versionButton.removeEventListener('click',newVersion);
      create.removeEventListener('submit',onCreate);
      clear(host);return true;
    }
  });
}
function install(){
  const base=root.ExportHubIsoSopUi;
  if(!base||typeof base.mount!=='function')return false;
  if(base.__sop2Wrapped===true)return true;
  const wrapped=Object.freeze(Object.assign({},base,{
    __sop2Wrapped:true,
    mount:function(target,options){
      if(!enabled())return base.mount(target,options);
      const controller=mount(target,options);
      return controller||base.mount(target,options);
    }
  }));
  root.ExportHubIsoSopUi=wrapped;
  return true;
}
root.ExportHubSop2=Object.freeze({enabled,environment,mount,install});
install();
})(typeof window!=='undefined'?window:globalThis);
