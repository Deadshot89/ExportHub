import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1063-abd-blob-viewer-compat.js','utf8');

function harness(){
  let panelObserver=null;
  let rowScans=0;

  function node(tag){
    const attrs=new Map();
    return {
      tagName:String(tag||'div').toUpperCase(),nodeType:1,children:[],parentNode:null,parentElement:null,textContent:'',className:'',isConnected:true,
      setAttribute(name,value){attrs.set(name,String(value))},
      getAttribute(name){return attrs.has(name)?attrs.get(name):null},
      appendChild(child){child.parentNode=this;child.parentElement=this;this.children.push(child);notify(this,child);return child},
      querySelector(){return null}
    };
  }

  const actions=node('div');actions.className='rc786-doc-actions';
  actions.querySelector=function(selector){
    if(selector==='[data-rc1063-open-blob]')return this.children.find(child=>child.getAttribute('data-rc1063-open-blob')!=null)||null;
    if(selector==='[data-rc1063-download-blob]')return this.children.find(child=>child.getAttribute('data-rc1063-download-blob')!=null)||null;
    return null;
  };
  const row=node('div');row.className='rc786-doc-row';row.querySelector=selector=>selector==='.rc786-doc-actions'?actions:null;
  actions.parentNode=row;actions.parentElement=row;row.children.push(actions);
  const panel=node('section');panel.id='rc786ReferenceFilesPanel';row.parentNode=panel;row.parentElement=panel;panel.children.push(row);
  panel.querySelectorAll=function(selector){if(selector==='.rc786-doc-row'){rowScans++;return[row]}return[]};

  function isInsidePanel(target){
    let n=target;
    while(n){if(n===panel)return true;n=n.parentNode}
    return false;
  }
  function notify(target,added){
    if(panelObserver&&panelObserver.active&&panelObserver.options.childList&&isInsidePanel(target)){
      panelObserver.pending.push({type:'childList',target,addedNodes:[added],removedNodes:[]});
    }
  }

  class MutationObserver{
    constructor(callback){this.callback=callback;this.pending=[];this.active=false;this.options={};panelObserver=this}
    observe(target,options){this.target=target;this.options=options||{};this.active=true}
    disconnect(){this.active=false}
  }

  const document={
    readyState:'complete',
    getElementById(id){return id==='rc786ReferenceFilesPanel'?panel:null},
    createElement(tag){return node(tag)},
    addEventListener(){},
    createEvent(){return{initCustomEvent(){}}}
  };
  const file={name:'ABD.pdf',blobName:'abd-1'};
  const window={
    document,MutationObserver,
    __EXPORTHUB_RC776_VIEW_DOCS__:[file],
    ExportHUBDocumentBlob1059:{isBlobDocument(){return true},legacyUrl(){return''},open(){return Promise.resolve(true)}},
    __EXPORTHUB_GET_STATE__(){return{}},
    addEventListener(){},dispatchEvent(){},alert(){},
    setTimeout(fn){fn();return 1},clearInterval(){},setInterval(){return 1}
  };

  vm.runInNewContext(source,{window,document,MutationObserver,console,String,Array,Object,JSON,Date,Promise,Map,Set},{filename:'rc1063-abd-blob-viewer-compat.js'});
  assert.ok(panelObserver,'Panel-Observer wurde nicht installiert');

  function deliver(){
    const records=panelObserver.pending.splice(0);
    if(!records.length)return false;
    panelObserver.callback(records);
    return true;
  }
  function externalMutation(){notify(panel,{nodeType:1,parentNode:panel,parentElement:panel})}
  return{panelObserver,deliver,externalMutation,rowScans:()=>rowScans};
}

test('RC1445: eigene Viewer-Button-Inserts lösen keinen redundanten zweiten patchRows-Lauf aus',()=>{
  const h=harness();
  assert.equal(h.rowScans(),1,'Initial-Patch muss genau einmal laufen');
  h.deliver();
  assert.equal(h.rowScans(),1,'eigene DOM-Ergänzungen dürfen keinen zweiten Vollscan des Panels auslösen');
});

test('RC1445: externe Panel-Mutation löst weiterhin genau einen Patch aus und Observer bleibt aktiv',()=>{
  const h=harness();
  h.panelObserver.pending.length=0;
  const before=h.rowScans();
  h.externalMutation();
  assert.equal(h.deliver(),true,'externe Mutation muss beobachtet werden');
  assert.equal(h.rowScans(),before+1,'externe Mutation muss genau einen Patchlauf auslösen');
  assert.equal(h.panelObserver.active,true,'Observer muss nach dem Patch wieder aktiv sein');

  h.externalMutation();
  assert.equal(h.deliver(),true,'Observer muss auch die nächste externe Mutation sehen');
  assert.equal(h.rowScans(),before+2,'zweite externe Mutation muss erneut genau einmal patchen');
});
