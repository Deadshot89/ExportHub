/* ExportHUB360 RC1371 – dashboard personalization state/runtime. */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1371_DASHBOARD__)return;
w.__EXPORTHUB_RC1371_DASHBOARD__=true;

var VERSION='RC1371';
var SCHEMA='v1';
var STORAGE_PREFIX='exporthub.dashboard.layout.v1.';
var SIZES=['S','M','L','XL'];
var TEMPLATES=['standard','management','operativ','kompakt','analyse'];

function q(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
function currentLang(){
  try{
    if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.current==='function')return q(w.ExportHUBI18n.current()).toLowerCase()
  }catch(_){}
  try{return q(w.document&&w.document.documentElement&&w.document.documentElement.lang||'de').toLowerCase()}catch(_){return 'de'}
}
function tr(key,fallback){
  try{
    if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){
      var value=w.ExportHUBI18n.t(key);if(value&&value!==key)return value
    }
  }catch(_){}
  try{
    if(w.ExportHUBDashboard1371I18n&&typeof w.ExportHUBDashboard1371I18n.t==='function'){
      var own=w.ExportHUBDashboard1371I18n.t(key,null,currentLang());if(own&&own!==key)return own
    }
  }catch(_){}
  return fallback||key
}
function normalizedUserId(value){return q(value).toLowerCase()}
function allowedTemplate(value){value=q(value).toLowerCase();return TEMPLATES.indexOf(value)>=0?value:'standard'}
function defs(registry){return Array.isArray(registry)?registry.filter(function(row){return row&&q(row.id)}):[]}
function allowedSizes(def){
  var list=Array.isArray(def&&def.allowedSizes)?def.allowedSizes.map(function(v){return q(v).toUpperCase()}).filter(function(v){return SIZES.indexOf(v)>=0}):[];
  return list.length?list:[q(def&&def.defaultSize).toUpperCase()||'M']
}
function defaultSize(def){
  var allowed=allowedSizes(def),value=q(def&&def.defaultSize).toUpperCase();
  return allowed.indexOf(value)>=0?value:allowed[0]||'M'
}
function defaultVisible(def){return !(def&&def.defaultVisible===false)}

function templateLayout(name,registry){
  var template=allowedTemplate(name);
  return {
    schema:SCHEMA,
    template:template,
    widgets:defs(registry).map(function(def,index){
      return {id:q(def.id),visible:defaultVisible(def),size:defaultSize(def),order:index}
    })
  }
}

function normalizeLayout(raw,registry){
  var list=defs(registry),byId=new Map();
  list.forEach(function(def){byId.set(q(def.id),def)});
  var source=raw&&typeof raw==='object'?raw:{};
  var stored=Array.isArray(source.widgets)?source.widgets:[];
  var selected=new Map();
  stored.forEach(function(row,index){
    if(!row||typeof row!=='object')return;
    var id=q(row.id),def=byId.get(id);
    if(!def||selected.has(id))return;
    var allowed=allowedSizes(def),size=q(row.size).toUpperCase();
    if(allowed.indexOf(size)<0)size=defaultSize(def);
    var order=Number(row.order);
    if(!Number.isFinite(order))order=index;
    selected.set(id,{id:id,visible:row.visible!==false,size:size,order:order})
  });
  var nextOrder=selected.size;
  list.forEach(function(def){
    var id=q(def.id);
    if(!selected.has(id))selected.set(id,{id:id,visible:defaultVisible(def),size:defaultSize(def),order:nextOrder++})
  });
  var widgets=Array.from(selected.values()).sort(function(a,b){return a.order-b.order}).map(function(row,index){
    return {id:row.id,visible:row.visible!==false,size:row.size,order:index}
  });
  return {schema:SCHEMA,template:allowedTemplate(source.template),widgets:widgets}
}

function layoutStorageKey(userId){
  var id=normalizedUserId(userId);
  return id?STORAGE_PREFIX+encodeURIComponent(id):''
}

function currentUserRecord(){
  try{
    if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){
      var direct=w.__EXPORTHUB_GET_CURRENT_USER__();
      if(direct)return direct
    }
  }catch(_){}
  try{
    if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user)return w.ExportHUBClean.runtime.user
  }catch(_){}
  if(w.currentUser)return w.currentUser;
  try{
    if(typeof w.__EXPORTHUB_GET_STATE__==='function'){
      var state=w.__EXPORTHUB_GET_STATE__();
      if(state&&(state.currentUser||state.user))return state.currentUser||state.user
    }
  }catch(_){}
  return null
}

function resolveUserIdentity(){
  var user=currentUserRecord();
  if(!user)return '';
  if(typeof user==='string')return normalizedUserId(user);
  var keys=['id','userId','uid','username','user','login','email'];
  for(var i=0;i<keys.length;i++){
    var value=normalizedUserId(user[keys[i]]);
    if(value)return value
  }
  return ''
}

function readLayout(userId,registry){
  var key=layoutStorageKey(userId);
  if(!key)return templateLayout('standard',registry);
  var raw=null;
  try{raw=w.localStorage&&w.localStorage.getItem(key)}catch(_){}
  if(!raw)return templateLayout('standard',registry);
  try{return normalizeLayout(JSON.parse(raw),registry)}catch(_){return templateLayout('standard',registry)}
}

function writeLayout(userId,state){
  var key=layoutStorageKey(userId);
  if(!key)return false;
  try{
    if(!w.localStorage||typeof w.localStorage.setItem!=='function')return false;
    w.localStorage.setItem(key,JSON.stringify(state));
    return true
  }catch(_){return false}
}

var registryStore=new Map();

function cleanId(value){
  return q(value).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')
}

function normalizeDefinition(definition){
  if(!definition||typeof definition!=='object')return null;
  var id=cleanId(definition.id);
  if(!id)return null;
  var allowed=allowedSizes(definition);
  return {
    id:id,
    titleKey:q(definition.titleKey||('dashboard.personalize.widget.'+id)),
    category:q(definition.category||'analyses').toLowerCase(),
    defaultSize:(allowed.indexOf(q(definition.defaultSize).toUpperCase())>=0?q(definition.defaultSize).toUpperCase():allowed[0]||'M'),
    allowedSizes:allowed.slice(),
    requiredModule:q(definition.requiredModule),
    detailModule:q(definition.detailModule),
    selector:q(definition.selector),
    defaultVisible:definition.defaultVisible!==false
  }
}

function registerWidget(definition){
  var def=normalizeDefinition(definition);
  if(!def)return false;
  registryStore.set(def.id,def);
  return def
}

function registry(){return Array.from(registryStore.values()).map(function(row){return Object.assign({},row,{allowedSizes:row.allowedSizes.slice()})})}

function resolveStableWidgetId(node){
  if(!node)return '';
  var fromData='';
  try{fromData=q(node.getAttribute&&(
    node.getAttribute('data-dashboard-widget-id')||
    node.getAttribute('data-widget-id')||
    node.getAttribute('data-dashboard-id')
  ))}catch(_){}
  return cleanId(fromData||node.id||'')
}

function discoverDashboardRoot(){
  var d=w.document;
  if(!d||typeof d.querySelector!=='function')return null;
  var selectors=['[data-exporthub-dashboard]','#dashboardView','#dashboard','.dashboard-view','[data-view="dashboard"]','#content'];
  for(var i=0;i<selectors.length;i++){
    var node=d.querySelector(selectors[i]);
    if(node)return node
  }
  return null
}

function childCandidates(root){
  if(!root)return [];
  var selectors='[data-dashboard-widget],[data-widget-id],.dashboard-card,.kpi-card,.metric,.card';
  try{
    var found=Array.prototype.slice.call(root.querySelectorAll(selectors));
    if(found.length)return found.filter(function(node,index,list){return list.indexOf(node)===index})
  }catch(_){}
  return Array.prototype.slice.call(root.children||[])
}

function discoverWidgets(root){
  root=root||discoverDashboardRoot();
  return childCandidates(root).map(function(node){
    var id=resolveStableWidgetId(node);
    if(!id){
      try{node.setAttribute('data-rc1371-fixed-system','1')}catch(_){}
      return {node:node,definition:null,fixed:true}
    }
    var existing=registryStore.get(id);
    if(!existing){
      existing=registerWidget({id:id,titleKey:'dashboard.personalize.widget.'+id,category:'analyses',defaultSize:'M',allowedSizes:['S','M','L','XL'],selector:node.id?'#'+node.id:''})
    }
    try{node.setAttribute('data-rc1371-widget-id',id)}catch(_){}
    return {node:node,definition:existing,fixed:false}
  })
}

function canUseWidget(definition){
  var def=definition&&definition.id?definition:registryStore.get(cleanId(definition&&definition.id));
  if(!def)return false;
  if(!q(def.requiredModule))return true;
  if(typeof w.canView==='function'){
    try{return w.canView(def.requiredModule)!==false}catch(_){return false}
  }
  return true
}

function libraryWidgets(){return registry().filter(canUseWidget)}

function visibleLayout(state){
  var normalized=normalizeLayout(state,registry());
  normalized.widgets=normalized.widgets.filter(function(row){var def=registryStore.get(row.id);return !!def&&canUseWidget(def)&&row.visible!==false}).map(function(row,index){return Object.assign({},row,{order:index})});
  return normalized
}

var mountedDashboardRoot=null;
var currentLayoutState=null;
var currentLayoutUser='';
var editMode=false;
var widgetNodes=new Map();
var libraryPanel=null;
var draggedWidgetId='';

function cloneLayout(state){
  var source=state&&typeof state==='object'?state:templateLayout('standard',registry());
  return {schema:SCHEMA,template:allowedTemplate(source.template),widgets:(source.widgets||[]).map(function(row){return {id:row.id,visible:row.visible!==false,size:row.size,order:row.order}})}
}
function currentLayout(){
  if(!currentLayoutState)currentLayoutState=readLayout(resolveUserIdentity(),registry());
  return cloneLayout(currentLayoutState)
}
function emitLayoutChange(reason){
  try{
    if(typeof w.dispatchEvent==='function'&&typeof w.CustomEvent==='function')w.dispatchEvent(new w.CustomEvent('exporthub:dashboard-layoutchange',{detail:{reason:q(reason),layout:currentLayout()}}))
  }catch(_){}
}
function applyStateToDom(){
  if(!mountedDashboardRoot||!currentLayoutState)return false;
  var ordered=(currentLayoutState.widgets||[]).slice().sort(function(a,b){return a.order-b.order});
  ordered.forEach(function(row){
    var node=widgetNodes.get(row.id);
    if(!node)return;
    try{
      node.hidden=row.visible===false;
      node.setAttribute('data-rc1371-size',row.size||'M');
      node.setAttribute('data-rc1371-visible',row.visible===false?'0':'1');
    }catch(_){}
  });
  return true
}
function persistCurrent(reason){
  if(!currentLayoutState)return false;
  var ok=writeLayout(currentLayoutUser,currentLayoutState);
  applyStateToDom();
  emitLayoutChange(reason);
  return ok||!currentLayoutUser
}
function doc(){return (mountedDashboardRoot&&mountedDashboardRoot.ownerDocument)||w.document||null}
function makeButton(action,key,text){
  var d=doc();if(!d||typeof d.createElement!=='function')return null;
  var btn=d.createElement('button');btn.type='button';btn.setAttribute('data-rc1371-action',action);btn.setAttribute('data-i18n-key',key);btn.textContent=tr(key,text||key);btn.setAttribute('aria-label',tr(key,text||key));return btn
}
function removeGenerated(){
  if(!mountedDashboardRoot||typeof mountedDashboardRoot.querySelectorAll!=='function')return;
  try{Array.prototype.slice.call(mountedDashboardRoot.querySelectorAll('[data-rc1371-generated="1"]')).forEach(function(node){if(node&&node.parentNode)node.parentNode.removeChild(node)})}catch(_){}
}
function ensureToolbar(){
  if(!mountedDashboardRoot)return null;
  try{
    var existing=mountedDashboardRoot.querySelector&&mountedDashboardRoot.querySelector('[data-rc1371-toolbar="1"]');
    if(existing)return existing
  }catch(_){}
  var d=doc();if(!d||typeof d.createElement!=='function'||typeof mountedDashboardRoot.appendChild!=='function')return null;
  var bar=d.createElement('div');bar.className='rc1371-dashboard-toolbar';bar.setAttribute('data-rc1371-generated','1');bar.setAttribute('data-rc1371-toolbar','1');
  var edit=makeButton('toggleEdit','dashboard.personalize.edit');
  var add=makeButton('addWidget','dashboard.personalize.addWidget');
  var reset=makeButton('restoreStandard','dashboard.personalize.restoreStandard');
  if(edit)bar.appendChild(edit);if(add)bar.appendChild(add);if(reset)bar.appendChild(reset);
  mountedDashboardRoot.insertBefore?mountedDashboardRoot.insertBefore(bar,mountedDashboardRoot.firstChild||null):mountedDashboardRoot.appendChild(bar);
  return bar
}
function removeWidgetControls(){
  if(!mountedDashboardRoot||typeof mountedDashboardRoot.querySelectorAll!=='function')return;
  try{Array.prototype.slice.call(mountedDashboardRoot.querySelectorAll('[data-rc1371-widget-controls="1"]')).forEach(function(node){if(node&&node.parentNode)node.parentNode.removeChild(node)})}catch(_){}
}
function ensureWidgetControls(){
  if(!editMode)return;
  var d=doc();if(!d||typeof d.createElement!=='function')return;
  widgetNodes.forEach(function(node,id){
    if(!node||typeof node.appendChild!=='function')return;
    try{if(node.querySelector&&node.querySelector('[data-rc1371-widget-controls="1"]'))return}catch(_){}
    var controls=d.createElement('div');controls.className='rc1371-widget-controls';controls.setAttribute('data-rc1371-generated','1');controls.setAttribute('data-rc1371-widget-controls','1');controls.setAttribute('data-widget-id',id);
    var up=makeButton('moveUp','dashboard.personalize.moveUp','↑');var down=makeButton('moveDown','dashboard.personalize.moveDown','↓');var hide=makeButton('hideWidget','dashboard.personalize.hideWidget','×');
    if(up)controls.appendChild(up);if(down)controls.appendChild(down);if(hide)controls.appendChild(hide);
    node.appendChild(controls);
    try{node.setAttribute('draggable','true')}catch(_){}
  })
}
function bindRootEvents(){
  if(!mountedDashboardRoot||mountedDashboardRoot.__rc1371Bound||typeof mountedDashboardRoot.addEventListener!=='function')return;
  mountedDashboardRoot.__rc1371Bound=true;
  mountedDashboardRoot.addEventListener('click',function(event){
    var target=event&&event.target&&event.target.closest?event.target.closest('[data-rc1371-action]'):null;if(!target)return;
    var action=target.getAttribute('data-rc1371-action'),owner=target.closest&&target.closest('[data-widget-id],[data-rc1371-widget-id]'),id=owner&&q(owner.getAttribute('data-widget-id')||owner.getAttribute('data-rc1371-widget-id'));
    if(action==='toggleEdit'){if(editMode)exitEditMode();else enterEditMode()}
    else if(action==='addWidget')openLibrary();
    else if(action==='restoreStandard')restoreStandard();
    else if(action==='moveUp'&&id)moveWidgetBy(id,-1);
    else if(action==='moveDown'&&id)moveWidgetBy(id,1);
    else if(action==='hideWidget'&&id)hideWidget(id)
  });
  mountedDashboardRoot.addEventListener('dragstart',function(event){var node=event&&event.target&&event.target.closest?event.target.closest('[data-rc1371-widget-id]'):null;draggedWidgetId=node?q(node.getAttribute('data-rc1371-widget-id')):''});
  mountedDashboardRoot.addEventListener('dragover',function(event){if(editMode&&event&&typeof event.preventDefault==='function')event.preventDefault()});
  mountedDashboardRoot.addEventListener('drop',function(event){
    if(!editMode||!draggedWidgetId)return;
    if(event&&typeof event.preventDefault==='function')event.preventDefault();
    var node=event&&event.target&&event.target.closest?event.target.closest('[data-rc1371-widget-id]'):null,before=node?q(node.getAttribute('data-rc1371-widget-id')):'';
    if(before&&before!==draggedWidgetId)moveWidget(draggedWidgetId,before);draggedWidgetId=''
  })
}
function mount(root){
  root=root||discoverDashboardRoot();if(!root)return false;
  if(mountedDashboardRoot&&mountedDashboardRoot!==root)unmount();
  mountedDashboardRoot=root;
  try{root.setAttribute('data-eh-dashboard-personalized','1')}catch(_){}
  widgetNodes.clear();
  discoverWidgets(root).forEach(function(item){if(item&&!item.fixed&&item.definition)widgetNodes.set(item.definition.id,item.node)});
  currentLayoutUser=resolveUserIdentity();
  currentLayoutState=readLayout(currentLayoutUser,registry());
  ensureToolbar();bindRootEvents();applyStateToDom();if(editMode)ensureWidgetControls();
  return true
}
function unmount(){
  if(!mountedDashboardRoot)return true;
  removeWidgetControls();closeLibrary();removeGenerated();
  try{mountedDashboardRoot.removeAttribute('data-eh-dashboard-personalized');mountedDashboardRoot.removeAttribute('data-rc1371-editing')}catch(_){}
  mountedDashboardRoot=null;widgetNodes.clear();currentLayoutState=null;currentLayoutUser='';editMode=false;return true
}
function mountedRoot(){return mountedDashboardRoot}
function isEditing(){return editMode}
function enterEditMode(){editMode=true;if(mountedDashboardRoot)try{mountedDashboardRoot.setAttribute('data-rc1371-editing','1')}catch(_){}ensureWidgetControls();return true}
function exitEditMode(){editMode=false;if(mountedDashboardRoot)try{mountedDashboardRoot.removeAttribute('data-rc1371-editing')}catch(_){}removeWidgetControls();return true}
function rowFor(id){if(!currentLayoutState)currentLayoutState=readLayout(currentLayoutUser||resolveUserIdentity(),registry());return (currentLayoutState.widgets||[]).find(function(row){return row.id===cleanId(id)})||null}
function addWidget(id){var key=cleanId(id),def=registryStore.get(key),row=rowFor(key);if(!def||!canUseWidget(def)||!row)return false;row.visible=true;return persistCurrent('add')}
function hideWidget(id){var row=rowFor(id);if(!row)return false;row.visible=false;return persistCurrent('hide')}
function resizeWidget(id,size){var key=cleanId(id),def=registryStore.get(key),row=rowFor(key),next=q(size).toUpperCase();if(!def||!row||allowedSizes(def).indexOf(next)<0)return false;row.size=next;return persistCurrent('resize')}
function normalizeOrders(){(currentLayoutState.widgets||[]).forEach(function(row,index){row.order=index})}
function moveWidget(id,beforeId){
  var key=cleanId(id),before=cleanId(beforeId),rows=currentLayoutState?(currentLayoutState.widgets||[]):[];var from=rows.findIndex(function(row){return row.id===key}),to=rows.findIndex(function(row){return row.id===before});if(from<0||to<0||from===to)return false;
  var moved=rows.splice(from,1)[0];if(from<to)to--;rows.splice(to,0,moved);normalizeOrders();return persistCurrent('move')
}
function moveWidgetBy(id,delta){
  var key=cleanId(id),rows=currentLayoutState?(currentLayoutState.widgets||[]):[];var from=rows.findIndex(function(row){return row.id===key});if(from<0)return false;var to=Math.max(0,Math.min(rows.length-1,from+Number(delta||0)));if(to===from)return false;var moved=rows.splice(from,1)[0];rows.splice(to,0,moved);normalizeOrders();return persistCurrent('move')
}
function applyTemplate(name){var next=allowedTemplate(name);if(TEMPLATES.indexOf(next)<0)return false;currentLayoutState=templateLayout(next,registry());return persistCurrent('template')}
function restoreStandard(){var user=currentLayoutUser||resolveUserIdentity();resetLayout(user);currentLayoutState=templateLayout('standard',registry());applyStateToDom();emitLayoutChange('restoreStandard');return true}
function openLibrary(){
  if(libraryPanel)return true;var d=doc();if(!d||typeof d.createElement!=='function'||!mountedDashboardRoot)return true;
  var panel=d.createElement('aside');panel.className='rc1371-widget-library';panel.setAttribute('data-rc1371-generated','1');panel.setAttribute('data-rc1371-library','1');
  var input=d.createElement('input');input.type='search';input.setAttribute('data-rc1371-library-search','1');input.placeholder=tr('dashboard.personalize.searchWidgets');input.setAttribute('aria-label',tr('dashboard.personalize.searchWidgets'));panel.appendChild(input);
  var list=d.createElement('div');list.className='rc1371-widget-library-list';libraryWidgets().forEach(function(def){var btn=makeButton('libraryAdd','dashboard.personalize.addWidget',tr(def.titleKey,def.titleKey));if(btn){btn.setAttribute('data-widget-id',def.id);list.appendChild(btn)}});panel.appendChild(list);
  var close=makeButton('libraryClose','common.close','×');if(close)panel.appendChild(close);mountedDashboardRoot.appendChild(panel);libraryPanel=panel;return true
}
function closeLibrary(){if(libraryPanel&&libraryPanel.parentNode)libraryPanel.parentNode.removeChild(libraryPanel);libraryPanel=null;return true}

function activeView(){
  try{
    if(typeof w.__EXPORTHUB_GET_STATE__==='function'){
      var state=w.__EXPORTHUB_GET_STATE__();
      var value=q(state&&(state.view||state.currentView||state.activeView));
      if(value)return value.toLowerCase()
    }
  }catch(_){}
  var d=w.document;
  try{return q(d&&d.body&&(d.body.getAttribute('data-exporthub-view')||d.body.getAttribute('data-current-view'))).toLowerCase()}catch(_){return ''}
}
function isDashboardView(){var view=activeView();return view==='dashboard'||(!view&&!!discoverDashboardRoot())}
function ownsLayout(){return isDashboardView()&&!!(mountedDashboardRoot||discoverDashboardRoot())}
function applyTheme(mode){
  var theme=q(mode||'classic').toLowerCase();
  if(!isDashboardView()){if(mountedDashboardRoot)unmount();return false}
  if(!mountedDashboardRoot)mount(discoverDashboardRoot());
  if(mountedDashboardRoot)try{mountedDashboardRoot.setAttribute('data-rc1371-theme',theme)}catch(_){}
  applyStateToDom();return !!mountedDashboardRoot
}
function remount(){
  if(!isDashboardView()){if(mountedDashboardRoot)unmount();return false}
  return mount(discoverDashboardRoot()||mountedDashboardRoot)
}
function scheduleRemount(){
  if(typeof w.setTimeout==='function')w.setTimeout(remount,0);else remount()
}
function installLifecycle(){
  if(typeof w.addEventListener!=='function')return;
  w.addEventListener('exporthub:viewchange',scheduleRemount);
  w.addEventListener('exporthub:rendered',scheduleRemount);
  w.addEventListener('pageshow',scheduleRemount);
  w.addEventListener('exporthub:designchange',function(event){var mode=event&&event.detail&&event.detail.design;applyTheme(mode||'classic')})
}

function resetLayout(userId){
  var key=layoutStorageKey(userId);
  if(!key)return false;
  try{
    if(!w.localStorage||typeof w.localStorage.removeItem!=='function')return false;
    w.localStorage.removeItem(key);
    return true
  }catch(_){return false}
}

w.ExportHUBDashboard1371=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  sizes:SIZES.slice(),
  templates:TEMPLATES.slice(),
  normalizeLayout:normalizeLayout,
  resolveUserIdentity:resolveUserIdentity,
  layoutStorageKey:layoutStorageKey,
  readLayout:readLayout,
  writeLayout:writeLayout,
  resetLayout:resetLayout,
  templateLayout:templateLayout,
  registerWidget:registerWidget,
  registry:registry,
  discoverDashboardRoot:discoverDashboardRoot,
  discoverWidgets:discoverWidgets,
  canUseWidget:canUseWidget,
  resolveStableWidgetId:resolveStableWidgetId,
  libraryWidgets:libraryWidgets,
  visibleLayout:visibleLayout,
  mount:mount,
  unmount:unmount,
  mountedRoot:mountedRoot,
  currentLayout:currentLayout,
  enterEditMode:enterEditMode,
  exitEditMode:exitEditMode,
  isEditing:isEditing,
  addWidget:addWidget,
  hideWidget:hideWidget,
  moveWidget:moveWidget,
  moveWidgetBy:moveWidgetBy,
  resizeWidget:resizeWidget,
  applyTemplate:applyTemplate,
  restoreStandard:restoreStandard,
  openLibrary:openLibrary,
  closeLibrary:closeLibrary,
  ownsLayout:ownsLayout,
  applyTheme:applyTheme,
  remount:remount
});
installLifecycle();
if(w.document&&w.document.readyState&&w.document.readyState!=='loading')scheduleRemount();
else if(w.document&&typeof w.document.addEventListener==='function')w.document.addEventListener('DOMContentLoaded',scheduleRemount,{once:true});
})(window);
