import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Die Fehlerdiagnose meldete "Großer Render-Vorgang" und Browser-Hänger, weil drei Module bei jeder
// DOM-Änderung unverändert neu schrieben und damit ihren eigenen MutationObserver erneut auslösten.
// Diese Tests simulieren Observer und Timer und prüfen, dass jedes Modul nach dem ersten Render ruht.

function harness(){
  const timers=[],observers=[],pending=[];
  let writes=0;
  function record(target){writes++;pending.push({type:'childList',target,addedNodes:[],removedNodes:[]})}
  class FakeNode{
    constructor(tag='div'){this.tagName=String(tag).toUpperCase();this.nodeType=1;this.children=[];this.parentNode=null;this.id='';this.className='';this._text='';this._html='';this.style={};this.dataset={};this.attrs={};this.hidden=false;this.listeners={};
      const classes=new Set();this.classList={contains:c=>classes.has(c),toggle:(c,on)=>{if(on===undefined?!classes.has(c):on)classes.add(c);else classes.delete(c)},add:c=>classes.add(c),remove:c=>classes.delete(c)};}
    get textContent(){return this._text}
    set textContent(v){this._text=String(v);this.children=[];record(this)}
    get innerHTML(){return this._html}
    set innerHTML(v){this._html=String(v);this.children=[];record(this)}
    get firstChild(){return this.children[0]||(this._html||this._text?{}:null)}
    get parentElement(){return this.parentNode}
    appendChild(child){child.parentNode=this;this.children.push(child);record(this);return child}
    insertBefore(child){return this.appendChild(child)}
    removeChild(child){this.children=this.children.filter(c=>c!==child);child.parentNode=null;record(this);return child}
    remove(){if(this.parentNode)this.parentNode.removeChild(this)}
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=String(v)}
    getAttribute(k){return k in this.attrs?this.attrs[k]:null}
    hasAttribute(k){return k in this.attrs}
    addEventListener(name,fn){(this.listeners[name]||(this.listeners[name]=[])).push(fn)}
    closest(){return null}
    querySelector(){return null}
    querySelectorAll(){return []}
    focus(){}
  }
  class MutationObserver{constructor(fn){this.fn=fn;observers.push(this)}observe(){this.active=true}disconnect(){this.active=false}}
  function setTimeout(fn){timers.push(fn);return timers.length}
  function clearTimeout(){}
  function settle(maxRounds=60){
    let rounds=0;
    while((timers.length||pending.length)&&rounds<maxRounds){
      rounds++;
      while(timers.length)timers.shift()();
      if(pending.length){const batch=pending.splice(0);for(const o of observers)if(o.active)o.fn(batch)}
    }
    return rounds;
  }
  return{FakeNode,MutationObserver,setTimeout,clearTimeout,settle,writes:()=>writes,resetWrites(){writes=0}};
}

test('Diagnose: KI-Zollexperte im ABD-Bereich rendert nicht endlos',()=>{
  const h=harness();
  const host=new h.FakeNode('section'),router=new h.FakeNode('div'),button=new h.FakeNode('button'),ai=new h.FakeNode('section'),context=new h.FakeNode('strong');
  host.id='rc1294AbdAnalysis';router.className='rc1294-router';
  host.querySelector=sel=>sel==='.rc1294-router'?router:sel==='[data-rc1532-ai-tab]'?button:sel==='[data-rc1532-ai-panel]'?ai:null;
  host.querySelectorAll=()=>[button];
  const document={
    getElementById:id=>id==='rc1294AbdAnalysis'?host:null,
    querySelector:sel=>sel==='[data-rc1532-context]'?context:sel==='[data-rc1532-ai-panel]'?ai:null,
    createElement:tag=>new h.FakeNode(tag),body:host,head:new h.FakeNode('head')
  };
  const window={document,MutationObserver:h.MutationObserver,setTimeout:h.setTimeout,clearTimeout:h.clearTimeout,addEventListener(){},
    ExportHUBRC1532I18n:{t:key=>'Text '+key,language:()=>'de'}};
  window.window=window;
  vm.runInNewContext(fs.readFileSync('assets/rc1532-customs-ai.js','utf8'),{window,globalThis:window,console});
  h.settle();
  assert.ok(window.ExportHUBRC1532CustomsAI,'Modul muss geladen sein');
  assert.equal(button.textContent,'Text tab');
  assert.equal(context.textContent,'Text noContext');
  h.resetWrites();
  window.ExportHUBRC1532CustomsAI.mount();
  const rounds=h.settle();
  assert.equal(h.writes(),0,'Unveränderter Inhalt darf nicht erneut geschrieben werden');
  assert.ok(rounds<5,'Observer-Schleife darf nicht weiterlaufen');
});

test('Diagnose: Sendungshistorie rendert bei unveränderten Daten nicht endlos',()=>{
  const h=harness();
  const shipment={id:'S1',reference:'REF-1',history:[{type:'created',label:'Sendung erstellt',at:'2026-10-19T08:00:00.000Z',actor:{id:'U1',name:'Tobias'}}]};
  const state={view:'shipment',currentShipment:shipment,shipments:[shipment],savedShipments:[shipment],currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}};
  const content=new h.FakeNode('div');content.id='content';
  const byId={content};
  const origAppend=content.appendChild.bind(content);
  content.appendChild=child=>{if(child.id)byId[child.id]=child;return origAppend(child)};
  const document={
    readyState:'complete',body:content,documentElement:content,head:content,
    getElementById:id=>byId[id]||null,
    querySelector:()=>null,querySelectorAll:()=>[],
    createElement:tag=>new h.FakeNode(tag),
    addEventListener(){}
  };
  const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
  const window={
    document,console,addEventListener(){},
    ExportHUBI18n:{language:()=>'de',t:(key,vars)=>{let v=de[key]||key;if(vars)for(const [n,x] of Object.entries(vars))v=v.replaceAll('{{'+n+'}}',String(x));return v},formatDate:(value,options)=>new Intl.DateTimeFormat('de-DE',options||{}).format(value)},
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{state,queueSave:()=>true,flushSave:()=>Promise.resolve(true)}
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,JSON,RegExp,
    setTimeout:h.setTimeout,clearTimeout:h.clearTimeout,setInterval(){return 1},MutationObserver:h.MutationObserver};
  vm.runInNewContext(fs.readFileSync('assets/rc1071-shipment-history.js','utf8'),context,{filename:'rc1071-shipment-history.js'});
  h.settle();
  const section=byId.rc1071ShipmentHistory;
  assert.ok(section,'Historie muss gerendert sein');
  assert.match(section.innerHTML,/rc1071-history-table/);
  h.resetWrites();
  window.ExportHUBShipmentHistory1071.render();
  const rounds=h.settle();
  assert.equal(h.writes(),0,'Unveränderte Historie darf nicht erneut geschrieben werden');
  assert.ok(rounds<5,'Observer-Schleife darf nicht weiterlaufen');
});

test('Diagnose: UPS-Hinweis in Versandkosten rendert nicht endlos',()=>{
  const h=harness();
  const card=new h.FakeNode('div'),ups=new h.FakeNode('section');
  ups.querySelector=sel=>/result-card|rc626-result/.test(sel)?card:null;
  const byId={};
  const origAppend=card.appendChild.bind(card);
  card.appendChild=child=>{if(child.id)byId[child.id]=child;return origAppend(child)};
  const document={
    readyState:'complete',documentElement:new h.FakeNode('html'),body:new h.FakeNode('body'),
    getElementById:id=>byId[id]||null,
    querySelector:sel=>/data-section="ups"/.test(sel)?ups:null,
    querySelectorAll:()=>[],
    createElement:tag=>new h.FakeNode(tag),
    addEventListener(){}
  };
  const window={document,addEventListener(){},MutationObserver:h.MutationObserver,__EXPORTHUB_GET_STATE__:()=>({})};
  const ctx={window,document,console,Event:function(){},MutationObserver:h.MutationObserver,setTimeout:h.setTimeout,clearTimeout:h.clearTimeout};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/rc1206-shipping-rules.js','utf8'),ctx);
  h.settle();
  assert.ok(byId.rc1207UpsWarning,'Hinweis für fehlendes Ziel muss angezeigt werden');
  h.resetWrites();
  window.ExportHUBRC1206ShippingRules.apply();
  const rounds=h.settle();
  assert.equal(h.writes(),0,'Unveränderter Hinweis darf nicht erneut geschrieben werden');
  assert.ok(rounds<5,'Observer-Schleife darf nicht weiterlaufen');
});
