/* RC1902: Neue Oberfläche "Sendung erstellen/bearbeiten" (Design "Neu", 2026-11-07).
   Neue Steuerleiste über der Maske: Referenz, Kunde, Status, Kennzahlen, Schrittnavigation mit Hinweis auf offene
   Pflichtangaben und dauerhaft sichtbares "Sendung speichern". Die Eingabefelder selbst bleiben die bestehenden
   (Kundensuche, Colli-Editor, Stauplan, Mailbereich, ABD), weil darin die ganze Speicher- und Prüflogik steckt;
   sie werden nur neu angeordnet und gestaltet. Knöpfe der Leiste lösen die bestehenden Knöpfe aus.
   Eigene Behälter sind div (nicht section oder .card): RC1071 protokolliert Klicks anhand des Textes im nächsten
   section/.card-Behälter. */
(function(){
  'use strict';
  if(window.__rc1902NeueSendungsmaske)return;
  window.__rc1902NeueSendungsmaske=true;

  var ROOT_ID='rc1902ShipmentForm';
  var STATUS_COLORS={entwurf:'#64748b',erstellt:'#6366f1',inbearbeitung:'#0ea5e9',wartetabd:'#d97706',offen:'#ea580c',nachbearbeitung:'#e11d48',bereit:'#059669',vorbereitet:'#059669',abgeholt:'#0d9488',pod:'#8b5cf6',abgeschlossen:'#16a34a',archiviert:'#94a3b8',storniert:'#dc2626'};
  var ui={scheduled:false,lastSig:'',current:'',observer:null};

  function content(){return document.getElementById('content');}
  function layout(){return document.getElementById('rc363FixedShipmentLayout');}
  function active(){
    if(document.documentElement.getAttribute('data-eh-layout')!=='top')return false;
    var c=content(),l=layout();
    return !!(c&&l&&c.contains(l)&&c.getAttribute('data-exporthub-rendered-view')==='shipment');
  }
  function txt(el){return el?String(el.textContent||'').replace(/\s+/g,' ').trim():'';}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(key){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){var v=window.ExportHUBI18n.t(key);if(v&&v!==key)return v;}}catch(_){}return key;}
  function statusKey(label){
    var v=String(label||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if(/storn|cancel/.test(v))return 'storniert';if(/nachbearbeit|rework/.test(v))return 'nachbearbeitung';if(/archiv/.test(v))return 'archiviert';
    if(/abgeschlossen|completed|erledigt|done/.test(v))return 'abgeschlossen';if(/pod/.test(v))return 'pod';if(/abgeholt|picked|pickup.*bestat/.test(v))return 'abgeholt';
    if(/vorbereit|prepared/.test(v))return 'vorbereitet';if(/bereit.*abhol|ready.*pickup/.test(v))return 'bereit';if(/wartet.*abd|abd.*wart|zoll.*wart/.test(v))return 'wartetabd';
    if(/in bearbeitung|processing|bearbeit/.test(v))return 'inbearbeitung';if(/erstellt|created/.test(v))return 'erstellt';if(/entwurf|draft/.test(v))return 'entwurf';return 'offen';
  }
  function visible(el){return !!(el&&!el.hidden&&el.getClientRects().length);}

  /* ---------- Daten aus der bestehenden Maske ---------- */
  function blocks(){
    var l=layout();if(!l)return [];
    return [].slice.call(l.querySelectorAll('.rc363-process-block')).filter(function(b){return b.id&&b.querySelector(':scope>.rc363-process-head h2');}).map(function(b){
      var warn=[].slice.call(b.querySelectorAll('.badbox,.rc363-missing,[aria-invalid="true"]')).filter(function(x){
        var own=x.closest('.rc363-process-block');return own===b&&visible(x);
      }).length;
      return {id:b.id,el:b,num:txt(b.querySelector(':scope>.rc363-process-head .rc363-process-number')),title:txt(b.querySelector(':scope>.rc363-process-head h2')),warn:warn};
    });
  }
  function read(){
    var c=content();
    var head=c.querySelector(':scope>.page-head h2');
    var refInput=c.querySelector('[data-rc408-shipment-field="ref"]')||c.querySelector('#rc896ShipmentFieldGrid input');
    var custInput=c.querySelector('#rc363BlockCustomer .rc363-process-body input');
    var status=txt(c.querySelector('#rc573ShipmentStatus .rc573-status-pill'));
    var kpis=[].slice.call(c.querySelectorAll('#rc573ColliCard .summaryGrid>.summaryBox')).map(function(b){return {label:txt(b.querySelector('span')),value:txt(b.querySelector('strong'))};});
    return {
      title:txt(head).replace(/^[^\p{L}\p{N}]+/u,'')||tr('rc1902.title'),
      ref:refInput?refInput.value.trim():'',
      customer:custInput?custInput.value.trim():'',
      status:status,key:statusKey(status),
      kpis:kpis.slice(0,3),
      save:document.getElementById('rc363SaveShipment'),
      docs:document.getElementById('rc363OpenDocuments'),
      blocks:blocks()
    };
  }

  /* ---------- Aufbau ---------- */
  function ensureRoot(){
    var root=document.getElementById(ROOT_ID);if(root)return root;
    var c=content();
    root=document.createElement('div');
    root.id=ROOT_ID;root.className='rc1902';root.setAttribute('role','region');
    root.setAttribute('data-i18n-ignore','1');root.setAttribute('aria-label',tr('rc1902.title'));
    c.parentNode.insertBefore(root,c);
    return root;
  }
  function removeRoot(){
    var root=document.getElementById(ROOT_ID);if(root)root.remove();
    document.documentElement.removeAttribute('data-rc1902-view');
    if(ui.observer){ui.observer.disconnect();ui.observer=null;}
  }

  function render(){
    if(!active()){removeRoot();return;}
    document.documentElement.setAttribute('data-rc1902-view','form');
    var d=read();var root=ensureRoot();
    watchSections(d.blocks);
    var sig=JSON.stringify([d.title,d.ref,d.customer,d.status,d.kpis,d.blocks.map(function(b){return [b.id,b.num,b.title,b.warn];}),ui.current,!!d.save,d.save&&d.save.disabled,!!d.docs,txt(d.save),txt(d.docs)]);
    if(sig===ui.lastSig&&root.firstChild)return;
    ui.lastSig=sig;
    root.style.setProperty('--c',STATUS_COLORS[d.key]||'#6366f1');
    var open=d.blocks.filter(function(b){return b.warn;}).length;
    root.innerHTML=
      '<div class="rc1902-bar">'+
        '<div class="rc1902-id">'+
          '<span class="rc1902-kicker">'+esc(d.title)+'</span>'+
          '<div class="rc1902-ref"><strong>'+esc(d.ref||'–')+'</strong>'+(d.status?'<span class="rc1902-status">'+esc(d.status)+'</span>':'')+'</div>'+
          '<span class="rc1902-customer">'+esc(d.customer||tr('rc1902.noCustomer'))+'</span>'+
        '</div>'+
        (d.kpis.length?'<dl class="rc1902-kpis">'+d.kpis.map(function(k){return '<div><dt>'+esc(k.label)+'</dt><dd>'+esc(k.value)+'</dd></div>';}).join('')+'</dl>':'')+
        '<div class="rc1902-actions">'+
          (d.docs?'<button type="button" class="rc1902-btn rc1902-btn-ghost" data-rc1902-proxy="docs">'+esc(txt(d.docs))+'</button>':'')+
          (d.save?'<button type="button" class="rc1902-btn rc1902-btn-primary" data-rc1902-proxy="save"'+(d.save.disabled?' disabled':'')+'>'+esc(txt(d.save))+'</button>':'')+
        '</div>'+
      '</div>'+
      '<nav class="rc1902-steps" aria-label="'+esc(tr('rc1902.steps'))+'">'+
        d.blocks.map(function(b){
          return '<button type="button" class="rc1902-step'+(b.warn?' is-warn':' is-ok')+(ui.current===b.id?' is-current':'')+'" data-rc1902-goto="'+esc(b.id)+'"'+(b.warn?' title="'+esc(tr('rc1902.stepOpen'))+'"':'')+'>'+
            '<span class="rc1902-step-num">'+esc(b.num)+'</span><span class="rc1902-step-title">'+esc(b.title)+'</span>'+
            '<span class="rc1902-step-state" aria-hidden="true"></span>'+
          '</button>';
        }).join('')+
        '<span class="rc1902-summary'+(open?' is-warn':'')+'">'+esc(open===1?tr('rc1902.openStep'):open?tr('rc1902.openSteps').replace('{n}',open):tr('rc1902.allComplete'))+'</span>'+
      '</nav>';
  }

  /* Ist die neue Erfassung (RC1903) aktiv, springen die Schritte zu deren Abschnitten */
  function target(id){
    var api=window.rc1903NeueErfassung,sec=api&&typeof api.section==='function'?api.section(id):null;
    return sec||document.getElementById(id);
  }
  /* Aktueller Schritt beim Scrollen */
  function watchSections(list){
    if(!('IntersectionObserver' in window))return;
    var key=list.map(function(b){var el=target(b.id);return b.id+(el&&el!==b.el?'+':'');}).join('|');
    if(ui.observer&&ui.observer.__key===key)return;
    if(ui.observer)ui.observer.disconnect();
    ui.observer=new IntersectionObserver(function(entries){
      var best=null;entries.forEach(function(e){if(e.isIntersecting&&(!best||e.boundingClientRect.top<best.boundingClientRect.top))best=e;});
      var id=best&&(best.target.getAttribute('data-rc1903-section')||best.target.id);
      if(id&&id!==ui.current){ui.current=id;schedule();}
    },{rootMargin:'-180px 0px -55% 0px',threshold:0});
    ui.observer.__key=key;
    list.forEach(function(b){var el=target(b.id);if(el)ui.observer.observe(el);});
  }

  /* ---------- Bedienung ---------- */
  /* Klicks auf die Leiste werden schon beim window (Capture) abgefangen und nicht weitergereicht: globale Klick-
     Protokolle (z. B. RC1071 Sendungshistorie) sollen nur den Klick auf den bestehenden Knopf sehen, sonst entsteht
     ein zusätzlicher Eintrag "Sendung manuell gespeichert". */
  function onClick(ev){
    var root=document.getElementById(ROOT_ID);
    var t=ev.target&&ev.target.closest&&ev.target.closest('button');
    if(!root||!t||!root.contains(t))return;
    ev.stopPropagation();
    if(t.hasAttribute('data-rc1902-goto')){
      var id=t.getAttribute('data-rc1902-goto'),el=target(id);
      if(el){ui.current=id;el.scrollIntoView({behavior:'smooth',block:'start'});var f=el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea');if(f&&f.focus)setTimeout(function(){try{f.focus({preventScroll:true});}catch(_){}},400);schedule();}
      return;
    }
    if(t.hasAttribute('data-rc1902-proxy')){
      var which=t.getAttribute('data-rc1902-proxy');
      var target=which==='save'?document.getElementById('rc363SaveShipment'):document.getElementById('rc363OpenDocuments');
      if(target&&!target.disabled){target.click();schedule();}
    }
  }
  function schedule(){
    if(ui.scheduled)return;ui.scheduled=true;
    (window.requestAnimationFrame||setTimeout)(function(){ui.scheduled=false;render();});
  }

  function start(){
    var c=content();
    if(!c){setTimeout(start,300);return;}
    new MutationObserver(schedule).observe(c,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','disabled','data-current-status','aria-invalid']});
    new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-eh-layout']});
    window.addEventListener('click',onClick,true);
    document.addEventListener('input',function(ev){if(ev.target&&content()&&content().contains(ev.target))schedule();},true);
    document.addEventListener('change',function(ev){if(ev.target&&content()&&content().contains(ev.target))schedule();},true);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.rc1902NeueSendungsmaske={render:render,state:ui};
})();
