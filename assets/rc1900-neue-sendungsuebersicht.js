/* RC1900: Neue Oberfläche "Sendungsübersicht" (Design "Neu", 2026-11-07).
   Eigener Aufbau statt Umgestaltung: Statusleiste links, kompakte Liste, Detailfenster rechts.
   Daten und Aktionen kommen weiterhin aus der bestehenden Übersicht (#content.rc524-overview-view):
   die alte Ansicht wird nur unsichtbar gehalten, jeder neue Knopf löst den entsprechenden alten aus.
   So bleiben Rechte, Filter, Uploads, Mails und alle Abläufe unverändert. */
(function(){
  'use strict';
  if(window.__rc1900NeueSendungsuebersicht)return;
  window.__rc1900NeueSendungsuebersicht=true;

  var ROOT_ID='rc1900Overview';
  var STATUS_COLORS={entwurf:'#64748b',erstellt:'var(--eh-p3,#6366f1)',inbearbeitung:'#0ea5e9',wartetabd:'#d97706',offen:'#ea580c',nachbearbeitung:'#e11d48',bereit:'#059669',abgeholt:'#0d9488',pod:'#8b5cf6',abgeschlossen:'#16a34a',archiviert:'#94a3b8',storniert:'#dc2626'};
  var ui={status:'all',query:'',selected:'',scheduled:false,lastSig:''};

  function active(){
    var html=document.documentElement;
    if(!html.hasAttribute('data-eh-newui'))return false;
    var content=document.getElementById('content');
    return !!(content&&content.classList.contains('rc524-overview-view')&&content.querySelector('.rc524-page'));
  }
  function txt(el){return el?String(el.textContent||'').replace(/\s+/g,' ').trim():'';}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(key){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){var v=window.ExportHUBI18n.t(key);if(v&&v!==key)return v;}}catch(_){}return key;}
  function color(key){return STATUS_COLORS[key]||'var(--eh-p3,#6366f1)';}
  function cssId(v){return window.CSS&&CSS.escape?CSS.escape(v):String(v).replace(/["\\]/g,'\\$&');}

  /* Daten aus der alten Kachel lesen (sichtbare Texte, damit Sprache und Rechte stimmen) */
  function metaValue(span){
    if(!span)return '';
    var b=span.querySelector('b');var label=txt(b);var all=txt(span);
    return label&&all.indexOf(label)===0?all.slice(label.length).trim():all;
  }
  function readCard(card){
    var head=card.querySelector('.rc524-area-head');
    var metas=[].slice.call(card.querySelectorAll('.rc524-overview-meta>span')).map(function(s){return {label:txt(s.querySelector('b')).replace(/:$/,''),value:metaValue(s),cls:s.className||''};});
    var chips=[].slice.call(card.querySelectorAll('.rc1014-shipment-meta>span')).map(txt).filter(Boolean);
    var links=[].slice.call(card.querySelectorAll('.rc524-link-columns>section')).map(function(s){return {title:txt(s.querySelector('h3')),text:txt(s.querySelector('p'))};});
    var key=card.getAttribute('data-status-key')||'';
    if(!key){var m=/rc210-status-([a-z]+)/.exec(card.className||'');key=m?m[1]:'';}
    var id='';var anyId=card.querySelector('[data-id]');if(anyId)id=anyId.getAttribute('data-id')||'';
    var note=card.querySelector('.rc403-overview-note textarea');
    return {
      card:card,id:id||txt(head&&head.querySelector('h2')),key:key,hidden:card.hidden,
      ref:txt(head&&head.querySelector('h2')),customer:txt(head&&head.querySelector('.rc524-kicker')),
      status:txt(head&&head.querySelector('.pill'))||key,metas:metas,chips:chips,links:links,
      note:note?note.value:'',noteEl:note,pickupDone:card.getAttribute('data-pickup-complete')==='1'
    };
  }
  function findMeta(item,cls,idx){
    for(var i=0;i<item.metas.length;i++)if(item.metas[i].cls.indexOf(cls)>=0)return item.metas[i].value;
    return item.metas[idx]?item.metas[idx].value:'';
  }
  function collect(){
    var content=document.getElementById('content');
    var cards=[].slice.call(content.querySelectorAll('article.rc524-shipment-card'));
    return cards.map(readCard);
  }

  /* ---------- Aufbau ---------- */
  function ensureRoot(){
    var root=document.getElementById(ROOT_ID);
    if(root)return root;
    var content=document.getElementById('content');
    root=document.createElement('section');
    root.id=ROOT_ID;root.className='rc1900';root.setAttribute('data-i18n-ignore','1');root.setAttribute('aria-label',tr('rc1900.title'));
    content.parentNode.insertBefore(root,content);
    root.addEventListener('click',onClick);
    root.addEventListener('input',onInput);
    root.addEventListener('change',onChange);
    root.addEventListener('keydown',onKey);
    return root;
  }
  function removeRoot(){
    var root=document.getElementById(ROOT_ID);if(root)root.remove();
    document.documentElement.removeAttribute('data-rc1900-view');
  }

  function oldPage(){return document.querySelector('#content .rc524-page');}
  function pageTitle(){var p=oldPage();return {kicker:txt(p&&p.querySelector('.rc524-page-head .rc524-kicker')),title:txt(p&&p.querySelector('.rc524-page-head h1'))||tr('rc1900.title'),newBtn:p&&p.querySelector('.rc524-page-head button')};}

  function render(){
    if(!active()){removeRoot();return;}
    document.documentElement.setAttribute('data-rc1900-view','overview');
    var items=collect();
    var root=ensureRoot();
    var head=pageTitle();
    var counts={};items.forEach(function(it){counts[it.key]=(counts[it.key]||0)+1;});
    var order=Object.keys(STATUS_COLORS).filter(function(k){return counts[k];});
    Object.keys(counts).forEach(function(k){if(order.indexOf(k)<0)order.push(k);});
    if(ui.status!=='all'&&!counts[ui.status])ui.status='all';
    var q=ui.query.toLowerCase();
    var shown=items.filter(function(it){
      if(ui.status!=='all'&&it.key!==ui.status)return false;
      if(q&&(it.ref+' '+it.customer+' '+it.metas.map(function(m){return m.value;}).join(' ')).toLowerCase().indexOf(q)<0)return false;
      return true;
    });
    var sel=null;items.forEach(function(it){if(it.id===ui.selected)sel=it;});
    var sig=JSON.stringify([ui.status,ui.query,ui.selected,items.map(function(it){return [it.id,it.key,it.ref,it.customer,it.status,it.metas,it.chips,it.links,it.pickupDone,it.card.querySelectorAll('button,label').length];})]);
    if(sig===ui.lastSig&&root.childElementCount)return;
    ui.lastSig=sig;
    var focusSearch=document.activeElement&&document.activeElement.id==='rc1900Search';

    var statusLabel={};items.forEach(function(it){if(!statusLabel[it.key])statusLabel[it.key]=it.status;});
    var rail='<nav class="rc1900-rail" aria-label="'+esc(tr('rc1900.colStatus'))+'">'+
      '<button type="button" class="rc1900-rail-item'+(ui.status==='all'?' is-active':'')+'" data-rc1900-status="all" data-rc739-no-loading="1"><span class="rc1900-dot" style="--c:var(--eh-p,#4f46e5)"></span><span>'+esc(tr('rc1900.allShipments'))+'</span><b>'+items.length+'</b></button>'+
      order.map(function(k){return '<button type="button" class="rc1900-rail-item'+(ui.status===k?' is-active':'')+'" data-rc1900-status="'+esc(k)+'" data-rc739-no-loading="1" style="--c:'+color(k)+'"><span class="rc1900-dot"></span><span>'+esc(statusLabel[k]||k)+'</span><b>'+counts[k]+'</b></button>';}).join('')+
      '</nav>';

    var rows=shown.length?shown.map(function(it){
      var pickup=findMeta(it,'rc628-meta-abholung',0),carrier=findMeta(it,'rc628-meta-spedition',2),abd=findMeta(it,'rc628-meta-abd',3);
      var colli='';it.chips.forEach(function(c){if(/colli/i.test(c))colli=c.replace(/^[^:]*:\s*/,'');});
      return '<button type="button" class="rc1900-row'+(it.id===ui.selected?' is-selected':'')+'" data-rc1900-open="'+esc(it.id)+'" data-rc739-no-loading="1" style="--c:'+color(it.key)+'">'+
        '<span class="rc1900-row-main"><strong>'+esc(it.ref)+'</strong><small>'+esc(it.customer)+'</small></span>'+
        '<span class="rc1900-cell"><small>'+esc(tr('rc1900.colPickup'))+'</small>'+esc(pickup||'–')+'</span>'+
        '<span class="rc1900-cell"><small>'+esc(tr('rc1900.colCarrier'))+'</small>'+esc(carrier||'–')+'</span>'+
        '<span class="rc1900-cell rc1900-cell-narrow"><small>'+esc(tr('rc1900.colColli'))+'</small>'+esc(colli||'–')+'</span>'+
        '<span class="rc1900-cell"><small>'+esc(tr('rc1900.colAbd'))+'</small>'+esc(abd||'–')+'</span>'+
        '<span class="rc1900-status">'+esc(it.status)+'</span>'+
        '<span class="rc1900-chevron" aria-hidden="true"></span>'+
        '</button>';
    }).join(''):'<div class="rc1900-empty">'+esc(tr('rc1900.empty'))+'</div>';

    root.innerHTML=
      '<header class="rc1900-head">'+
        '<div><span class="rc1900-kicker">'+esc(head.kicker||tr('rc1900.shipment'))+'</span><h1>'+esc(head.title)+'</h1></div>'+
        '<div class="rc1900-head-actions">'+
          '<label class="rc1900-search"><span aria-hidden="true">⌕</span><input id="rc1900Search" type="search" placeholder="'+esc(tr('rc1900.search'))+'" value="'+esc(ui.query)+'"></label>'+
          '<button type="button" class="rc1900-btn rc1900-btn-ghost" data-rc1900-classic="1" title="'+esc(tr('rc1900.advancedTitle'))+'">'+esc(tr('rc1900.advanced'))+'</button>'+
          (head.newBtn?'<button type="button" class="rc1900-btn rc1900-btn-primary" data-rc1900-new="1">+ '+esc(txt(head.newBtn))+'</button>':'')+
        '</div>'+
      '</header>'+
      '<div class="rc1900-body'+(sel?' has-detail':'')+'">'+rail+
        '<div class="rc1900-list" role="list">'+
          '<div class="rc1900-list-head"><span>'+esc(tr('rc1900.colShipment'))+'</span><span>'+esc(tr('rc1900.colPickup'))+'</span><span>'+esc(tr('rc1900.colCarrier'))+'</span><span class="rc1900-cell-narrow">'+esc(tr('rc1900.colColli'))+'</span><span>'+esc(tr('rc1900.colAbd'))+'</span><span>'+esc(tr('rc1900.colStatus'))+'</span><span></span></div>'+
          rows+
        '</div>'+
        (sel?detail(sel):'')+
      '</div>';
    if(focusSearch){var s=document.getElementById('rc1900Search');if(s){s.focus();s.setSelectionRange(s.value.length,s.value.length);}}
  }

  /* Detailfenster: alle Aktionen der alten Kachel, nach Zweck gruppiert */
  function actionList(card,selector){
    return [].slice.call(card.querySelectorAll(selector)).filter(function(el){
      if(el.hidden||el.getAttribute('aria-hidden')==='true')return false;
      var st=el.style&&el.style.display;return st!=='none';
    });
  }
  function proxyButtons(item,selector,kind){
    var els=actionList(item.card,selector);
    return els.map(function(el){
      var idx=[].indexOf.call(item.card.querySelectorAll('button,label'),el);
      var cls='rc1900-btn rc1900-btn-'+(kind==='auto'?(/\bdanger\b/.test(el.className)?'danger':(/\bbtn\b/.test(el.className)&&!/\bghost\b/.test(el.className)?'primary':'ghost')):kind);
      var dis=el.disabled||/disabled/.test(el.className);
      return '<button type="button" class="'+cls+'" data-rc1900-proxy="'+idx+'"'+(dis?' disabled':'')+'>'+esc(txt(el))+'</button>';
    }).join('');
  }
  function detail(it){
    var c=it.card;
    var reminder=c.querySelector('.index236-reminder-actions');
    var reminderLabel=txt(reminder&&reminder.querySelector('.rc820-reminder-label'));
    var linkToolbars=c.querySelectorAll('.rc524-link-columns button, .rc524-link-columns label');
    var other=actionList(c,'button,label').filter(function(el){
      return !el.closest('.rc524-action-grid,.index236-reminder-actions,.rc524-dangerbar,.rc524-link-columns,.rc403-overview-note');
    });
    return '<aside class="rc1900-detail" style="--c:'+color(it.key)+'" aria-label="'+esc(tr('rc1900.shipment')+' '+it.ref)+'">'+
      '<div class="rc1900-detail-top">'+
        '<div><span class="rc1900-status">'+esc(it.status)+'</span><h2>'+esc(it.ref)+'</h2><p>'+esc(it.customer)+'</p></div>'+
        '<button type="button" class="rc1900-close" data-rc1900-close="1" data-rc739-no-loading="1" aria-label="'+esc(tr('rc1900.close'))+'">×</button>'+
      '</div>'+
      '<dl class="rc1900-facts">'+it.metas.map(function(m){return '<div><dt>'+esc(m.label)+'</dt><dd>'+esc(m.value||'–')+'</dd></div>';}).join('')+
        it.chips.map(function(ch){var p=ch.split(':');return '<div><dt>'+esc(p[0])+'</dt><dd>'+esc(p.slice(1).join(':').trim()||'–')+'</dd></div>';}).join('')+
      '</dl>'+
      '<section class="rc1900-block"><h3>'+esc(tr('rc1900.documents'))+'</h3><div class="rc1900-actions">'+proxyButtons(it,'.rc524-action-grid>button,.rc524-action-grid>label','auto')+'</div></section>'+
      (it.links.length?'<section class="rc1900-block"><h3>'+esc(tr('rc1900.evidence'))+'</h3><div class="rc1900-links">'+it.links.map(function(l){return '<div><strong>'+esc(l.title)+'</strong><span>'+esc(l.text)+'</span></div>';}).join('')+'</div>'+
        (linkToolbars.length?'<div class="rc1900-actions">'+proxyButtons(it,'.rc524-link-columns button,.rc524-link-columns label','ghost')+'</div>':'')+'</section>':'')+
      (reminder?'<section class="rc1900-block"><h3>'+esc(reminderLabel||tr('rc1900.reminder'))+'</h3><div class="rc1900-actions">'+proxyButtons(it,'.index236-reminder-actions button','soft')+'</div></section>':'')+
      (it.noteEl?'<section class="rc1900-block"><h3>'+esc(tr('rc1900.note'))+'</h3><textarea class="rc1900-note" data-rc1900-note="1" rows="3" placeholder="'+esc(it.noteEl.getAttribute('placeholder')||tr('rc1900.notePlaceholder'))+'">'+esc(it.note)+'</textarea><small class="rc1900-note-status">'+esc(txt(c.querySelector('.rc406-note-status')))+'</small></section>':'')+
      (other.length?'<section class="rc1900-block"><h3>'+esc(tr('rc1900.more'))+'</h3><div class="rc1900-actions">'+other.map(function(el){var idx=[].indexOf.call(c.querySelectorAll('button,label'),el);return '<button type="button" class="rc1900-btn rc1900-btn-ghost" data-rc1900-proxy="'+idx+'">'+esc(txt(el))+'</button>';}).join('')+'</div></section>':'')+
      '<section class="rc1900-block"><h3>'+esc(tr('rc1900.shipment'))+'</h3><div class="rc1900-actions">'+proxyButtons(it,'.rc524-dangerbar>button','auto')+'</div></section>'+
    '</aside>';
  }

  /* ---------- Bedienung ---------- */
  function selectedCard(){
    var items=collect();for(var i=0;i<items.length;i++)if(items[i].id===ui.selected)return items[i].card;return null;
  }
  function onClick(ev){
    var t=ev.target.closest('button');if(!t)return;
    if(t.hasAttribute('data-rc1900-status')){ui.status=t.getAttribute('data-rc1900-status');schedule();return;}
    if(t.hasAttribute('data-rc1900-open')){var id=t.getAttribute('data-rc1900-open');ui.selected=id;schedule();return;}
    if(t.hasAttribute('data-rc1900-close')){ui.selected='';schedule();return;}
    if(t.hasAttribute('data-rc1900-new')){var nb=pageTitle().newBtn;if(nb)nb.click();return;}
    if(t.hasAttribute('data-rc1900-classic')){document.documentElement.toggleAttribute('data-rc1900-classic');return;}
    if(t.hasAttribute('data-rc1900-proxy')){
      var card=selectedCard();if(!card)return;
      var el=card.querySelectorAll('button,label')[+t.getAttribute('data-rc1900-proxy')];
      if(!el)return;
      if(el.tagName==='LABEL'){var inp=el.querySelector('input')||(el.htmlFor&&document.getElementById(el.htmlFor));if(inp){inp.click();return;}}
      el.click();schedule();
    }
  }
  function onInput(ev){
    var t=ev.target;
    if(t.id==='rc1900Search'){ui.query=t.value;schedule();return;}
    if(t.hasAttribute('data-rc1900-note')){
      var card=selectedCard();var old=card&&card.querySelector('.rc403-overview-note textarea');
      if(old){old.value=t.value;old.dispatchEvent(new Event('input',{bubbles:true}));}
    }
  }
  function onChange(ev){
    var t=ev.target;
    if(t.hasAttribute('data-rc1900-note')){
      var card=selectedCard();var old=card&&card.querySelector('.rc403-overview-note textarea');
      if(old){old.value=t.value;old.dispatchEvent(new Event('change',{bubbles:true}));old.dispatchEvent(new Event('blur'));}
    }
  }
  function onKey(ev){if(ev.key==='Escape'&&ui.selected){ui.selected='';schedule();}}

  /* RC1934: erst nach dem Übersetzer (RC1267, ebenfalls requestAnimationFrame) lesen, sonst blitzt kurz deutscher Text auf */
  function afterTranslation(fn){var raf=window.requestAnimationFrame;if(!raf){setTimeout(fn,0);return;}raf(function(){raf(fn);});}
  function schedule(){
    if(ui.scheduled)return;ui.scheduled=true;
    afterTranslation(function(){ui.scheduled=false;
      var ae=document.activeElement;if(ae&&ae.hasAttribute&&ae.hasAttribute('data-rc1900-note'))return; // beim Tippen nicht neu zeichnen
      render();
    });
  }

  function start(){
    var content=document.getElementById('content');
    if(!content){setTimeout(start,300);return;}
    // RC1934: characterData, damit nachträglich übersetzte Texte (RC1267 setzt nodeValue) übernommen werden
    new MutationObserver(schedule).observe(content,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','data-status-key','disabled']});
    window.addEventListener('exporthub:language-changed',function(){ui.lastSig='';schedule();});
    new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-eh-layout','data-eh-newui']});
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.rc1900NeueSendungsuebersicht={render:render,state:ui};
})();
