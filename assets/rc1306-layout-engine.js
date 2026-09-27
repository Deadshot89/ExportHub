/*
 * ExportHUB RC1306 – true multi-layout engine.
 * Moves existing functional DOM nodes (never clones them), preserving listeners,
 * values and business logic. Classic restores the original DOM arrangement.
 */
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1306_LAYOUT_ENGINE__)return;
w.__EXPORTHUB_RC1306_LAYOUT_ENGINE__=true;

var VERSION='RC1306';
var timer=0;
var observer=null;
var designObserver=null;
var originals=new WeakMap();
var managed=[];
var SHIPMENT_IDS=[
  'rc363BlockCustomer',
  'rc363BlockShipment',
  'rc573ColliCard',
  'rc363BlockDocuments',
  'rc363BlockStow',
  'rc363BlockAbdDecision',
  'rc363BlockMail',
  'rc363BlockActions'
];

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function design(){return q(d.documentElement.getAttribute('data-eh-design')||'classic').toLowerCase()}
function currentView(){
  try{
    var s=typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__():null;
    var v=q(s&&(s.view||s.currentView||s.activeView));
    if(v)return v.toLowerCase()
  }catch(_){}
  return q(d.body&&(d.body.getAttribute('data-exporthub-view')||d.body.getAttribute('data-current-view'))).toLowerCase()
}
function remember(node){
  if(!node)return;
  if(!originals.has(node))originals.set(node,{parent:node.parentNode,next:node.nextSibling});
  if(managed.indexOf(node)<0)managed.push(node)
}
function move(node,parent){
  if(!node||!parent)return false;
  remember(node);
  parent.appendChild(node);
  return true
}
function restoreNode(node){
  var o=originals.get(node);
  if(!node||!o||!o.parent)return false;
  if(o.next&&o.next.parentNode===o.parent)o.parent.insertBefore(node,o.next);
  else o.parent.appendChild(node);
  return true
}
function restoreAll(){
  for(var i=managed.length-1;i>=0;i--){
    restoreNode(managed[i]);
    originals.delete(managed[i])
  }
  managed=[];
  removeGenerated();
  d.documentElement.removeAttribute('data-eh-layout-mode');
  if(d.body)d.body.removeAttribute('data-eh-layout-mode')
}
function removeGenerated(){
  Array.prototype.slice.call(d.querySelectorAll('[data-rc1306-generated="1"]')).forEach(function(n){n.remove()});
}
function el(tag,cls,id){
  var n=d.createElement(tag);
  if(cls)n.className=cls;
  if(id)n.id=id;
  n.setAttribute('data-rc1306-generated','1');
  return n
}
function tr(key){
  try{
    if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){
      var value=w.ExportHUBI18n.t(key);
      if(value&&value!==key)return value
    }
  }catch(_){}
  return key
}
function labelFor(id){
  var key=({
    rc363BlockCustomer:'layout.customerRecipient',
    rc363BlockShipment:'layout.shipmentData',
    rc573ColliCard:'layout.colliLdm',
    rc363BlockDocuments:'layout.documentsAbd',
    rc363BlockStow:'layout.stowPlan',
    rc363BlockAbdDecision:'layout.abd',
    rc363BlockMail:'layout.mail',
    rc363BlockActions:'layout.saveOutput'
  })[id];
  return key?tr(key):id
}
function blocks(){
  var out={};
  SHIPMENT_IDS.forEach(function(id){var n=d.getElementById(id);if(n)out[id]=n});
  return out
}
function shipmentShell(){
  return d.getElementById('rc573ShipmentShell')||d.getElementById('rc363FixedShipmentLayout')
}
function isShipmentCreate(){
  var hasCreateBlocks=!!(
    d.getElementById('rc363BlockCustomer')&&
    d.getElementById('rc363BlockShipment')&&
    (d.getElementById('rc573ColliCard')||d.getElementById('rc363BlockColli'))
  );
  if(hasCreateBlocks)return true;
  var v=currentView();
  if(v==='shipment'||/shipmentcreate|newshipment/.test(v))return true;
  var s=shipmentShell();
  return !!(s&&/shipment|sendung/i.test(q(s.textContent).slice(0,500)))
}
function topLevelContent(){
  return d.getElementById('content')
}
function createNavigator(mode,b){
  var nav=el('nav','rc1306-process-nav rc1306-process-nav--'+mode,'rc1306ProcessNav');
  nav.setAttribute('aria-label',tr('layout.shipmentProcess'));
  SHIPMENT_IDS.forEach(function(id,index){
    if(!b[id])return;
    var btn=d.createElement('button');
    btn.type='button';
    btn.className='rc1306-process-step';
    btn.setAttribute('data-target',id);
    btn.innerHTML='<span class="rc1306-process-number">'+(index+1)+'</span><span>'+labelFor(id)+'</span>';
    btn.addEventListener('click',function(){
      var target=d.getElementById(id);
      if(target)target.scrollIntoView({behavior:'smooth',block:'start'})
    });
    nav.appendChild(btn)
  });
  return nav
}
function setMode(mode){
  d.documentElement.setAttribute('data-eh-layout-mode',mode);
  if(d.body)d.body.setAttribute('data-eh-layout-mode',mode)
}

/* Business: left process navigator, central work canvas, right shipment summary rail. */
function businessShipment(shell,b){
  setMode('business');
  var root=el('section','rc1306-workspace rc1306-business-workspace','rc1306Workspace');
  var nav=createNavigator('business',b);
  var center=el('main','rc1306-business-center');
  var rail=el('aside','rc1306-business-rail');

  var identity=el('section','rc1306-zone rc1306-zone--identity');
  var cargo=el('section','rc1306-zone rc1306-zone--cargo');
  var execution=el('section','rc1306-zone rc1306-zone--execution');
  var output=el('section','rc1306-zone rc1306-zone--output');

  [b.rc363BlockCustomer,b.rc363BlockShipment].forEach(function(n){if(n)move(n,identity)});
  [b.rc363BlockDocuments,b.rc363BlockStow,b.rc363BlockMail,b.rc363BlockActions].forEach(function(n){if(n)move(n,execution)});
  [b.rc573ColliCard,b.rc363BlockAbdDecision].forEach(function(n){if(n)move(n,rail)});

  center.appendChild(identity);
  center.appendChild(execution);
  if(output.children.length)center.appendChild(output);
  root.appendChild(nav);
  root.appendChild(center);
  root.appendChild(rail);
  shell.appendChild(root)
}

/* Glass: modular 12-column studio; blocks become a visual mosaic. */
function glassShipment(shell,b){
  setMode('glass');
  var root=el('section','rc1306-workspace rc1306-glass-workspace','rc1306Workspace');
  var hero=el('div','rc1306-glass-command');
  hero.appendChild(createNavigator('glass',b));
  var mosaic=el('div','rc1306-glass-mosaic');

  var slots=[
    ['rc363BlockCustomer','rc1306-glass-card rc1306-span-5'],
    ['rc363BlockShipment','rc1306-glass-card rc1306-span-4'],
    ['rc573ColliCard','rc1306-glass-card rc1306-span-3'],
    ['rc363BlockDocuments','rc1306-glass-card rc1306-span-8'],
    ['rc363BlockAbdDecision','rc1306-glass-card rc1306-span-4'],
    ['rc363BlockStow','rc1306-glass-card rc1306-span-6'],
    ['rc363BlockMail','rc1306-glass-card rc1306-span-6'],
    ['rc363BlockActions','rc1306-glass-card rc1306-span-12']
  ];
  slots.forEach(function(pair){
    var n=b[pair[0]];
    if(!n)return;
    var slot=el('section',pair[1]);
    move(n,slot);
    mosaic.appendChild(slot)
  });
  root.appendChild(hero);
  root.appendChild(mosaic);
  shell.appendChild(root)
}

/* Neon: compact operations center with command rail + two live work columns. */
function neonShipment(shell,b){
  setMode('neon');
  var root=el('section','rc1306-workspace rc1306-neon-workspace','rc1306Workspace');
  var command=el('aside','rc1306-neon-command');
  var core=el('main','rc1306-neon-core');
  var telemetry=el('aside','rc1306-neon-telemetry');

  command.appendChild(createNavigator('neon',b));

  var coreTop=el('section','rc1306-neon-core-top');
  var coreBottom=el('section','rc1306-neon-core-bottom');
  [b.rc363BlockCustomer,b.rc363BlockShipment].forEach(function(n){if(n)move(n,coreTop)});
  [b.rc363BlockDocuments,b.rc363BlockStow,b.rc363BlockMail,b.rc363BlockActions].forEach(function(n){if(n)move(n,coreBottom)});
  [b.rc573ColliCard,b.rc363BlockAbdDecision].forEach(function(n){if(n)move(n,telemetry)});

  core.appendChild(coreTop);
  core.appendChild(coreBottom);
  root.appendChild(command);
  root.appendChild(core);
  root.appendChild(telemetry);
  shell.appendChild(root)
}

function genericLayout(mode){
  setMode(mode);
  var content=topLevelContent();
  if(!content||isShipmentCreate())return;
  var kids=Array.prototype.slice.call(content.children);
  if(kids.length<2)return;

  var root=el('div','rc1306-generic rc1306-generic--'+mode,'rc1306Generic');
  var lead=el('section','rc1306-generic-lead');
  var primary=el('section','rc1306-generic-primary');
  var secondary=el('aside','rc1306-generic-secondary');

  kids.forEach(function(node,index){
    if(node.id==='rc1306Generic'||node.hasAttribute('data-rc1306-generated'))return;
    var text=q(node.textContent).slice(0,160).toLowerCase();
    var className=q(node.className).toLowerCase();
    if(index===0||/page-head|hero|breadcrumb|context/.test(className))move(node,lead);
    else if(mode==='neon'&&(/status|metric|kpi|summary|filter|warn/.test(className+' '+text)))move(node,secondary);
    else if(mode==='business'&&(/filter|summary|status|metric|kpi/.test(className+' '+text)))move(node,secondary);
    else move(node,primary)
  });

  root.appendChild(lead);
  var body=el('div','rc1306-generic-body');
  body.appendChild(primary);
  if(secondary.children.length)body.appendChild(secondary);
  root.appendChild(body);
  content.appendChild(root)
}

function apply(){
  timer=0;
  if(observer)observer.disconnect();
  try{
    restoreAll();
    var mode=design();
    if(mode==='classic')return;

    var shell=shipmentShell(),b=blocks();
    if(shell&&isShipmentCreate()){
      if(mode==='modern')businessShipment(shell,b);
      else if(mode==='glass')glassShipment(shell,b);
      else if(mode==='neon')neonShipment(shell,b)
    }else{
      genericLayout(mode==='modern'?'business':mode)
    }
  }finally{
    if(observer&&d.body)observer.observe(d.body,{childList:true,subtree:true})
  }
}
function schedule(){
  if(timer)w.clearTimeout(timer);
  timer=w.setTimeout(apply,90)
}
function watch(){
  if(!w.MutationObserver||!d.body)return;
  if(!observer){
    observer=new MutationObserver(function(records){
      for(var i=0;i<records.length;i++){
        var r=records[i];
        if(!r.addedNodes||!r.addedNodes.length)continue;
        var external=false;
        for(var j=0;j<r.addedNodes.length;j++){
          var n=r.addedNodes[j];
          if(n.nodeType===1&&!n.hasAttribute('data-rc1306-generated')){external=true;break}
        }
        if(external){schedule();break}
      }
    })
  }
  observer.disconnect();
  observer.observe(d.body,{childList:true,subtree:true});

  if(!designObserver){
    designObserver=new MutationObserver(function(records){
      for(var k=0;k<records.length;k++){
        if(records[k].attributeName==='data-eh-design'){schedule();break}
      }
    });
    designObserver.observe(d.documentElement,{attributes:true,attributeFilter:['data-eh-design']})
  }
}

w.addEventListener('exporthub:designchange',apply);
w.addEventListener('exporthub:viewchange',schedule);
w.addEventListener('exporthub:rendered',schedule);
w.addEventListener('pageshow',schedule);
w.addEventListener('popstate',schedule);

if(d.readyState==='loading'){
  d.addEventListener('DOMContentLoaded',function(){apply();watch()},{once:true})
}else{
  apply();watch()
}

w.ExportHUBLayoutEngine1306=Object.freeze({
  version:VERSION,
  apply:apply,
  restore:restoreAll,
  current:function(){return d.documentElement.getAttribute('data-eh-layout-mode')||'classic'}
});
})(window,document);
