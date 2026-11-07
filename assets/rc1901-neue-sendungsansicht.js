/* RC1901: Neue Oberfläche "Sendungsansicht" (Design "Neu", 2026-11-07).
   Eigener Aufbau statt Umgestaltung: Kopf mit Statusfarbe, Fortschrittsleiste, Reiter und feste Seitenspalte.
   Daten kommen aus der bestehenden Sendungsansicht (#content.rc776-shipment-view), die unsichtbar im DOM bleibt.
   Knöpfe lösen die alten Knöpfe aus. Bereiche mit eigener Logik (Dateien, Versanddokumentation, Avis,
   Sendungshistorie) werden unverändert in die neue Oberfläche umgehängt, damit ihre Module weiterarbeiten.
   Wichtig: eigene Behälter sind div, nicht section oder .card. RC1071 liest bei jedem Klick den Text des nächsten
   section/.card-Behälters; ein großer Behälter mit "…speichern" würde sonst "Sendung manuell gespeichert" protokollieren. */
(function(){
  'use strict';
  if(window.__rc1901NeueSendungsansicht)return;
  window.__rc1901NeueSendungsansicht=true;

  var ROOT_ID='rc1901Shipment';
  var STATUS_COLORS={entwurf:'#64748b',erstellt:'var(--eh-p3,#6366f1)',inbearbeitung:'#0ea5e9',wartetabd:'#d97706',offen:'#ea580c',nachbearbeitung:'#e11d48',bereit:'#059669',vorbereitet:'#059669',abgeholt:'#0d9488',pod:'#8b5cf6',abgeschlossen:'#16a34a',archiviert:'#94a3b8',storniert:'#dc2626'};
  var STEP_RANK={entwurf:0,offen:0,erstellt:0,inbearbeitung:0,wartetabd:1,bereit:2,vorbereitet:2,abgeholt:3,pod:4,abgeschlossen:5,archiviert:5};
  var STEPS=['rc1901.stepCreated','rc1901.stepAbd','rc1901.stepReady','rc1901.stepPicked','rc1901.stepPod','rc1901.stepDone'];
  var TABS=[['overview','rc1901.tabOverview'],['documents','rc1901.tabDocuments'],['proof','rc1901.tabProof'],['history','rc1901.tabHistory']];
  var ui={tab:'overview',shipment:'',scheduled:false,lastSig:''};

  function content(){return document.getElementById('content');}
  function page(){var c=content();return c?c.querySelector(':scope>.rc776-page'):null;}
  function active(){
    if(!document.documentElement.hasAttribute('data-eh-newui'))return false;
    var c=content();
    return !!(c&&c.classList.contains('rc776-shipment-view')&&c.querySelector(':scope>.rc776-page>.rc776-hero'));
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
  function pending(value){return !value||/^(–|-|nein|no|aus|off|offen|open|nicht|noch nicht|not|kein)/i.test(String(value).trim());}

  /* ---------- Daten aus der alten Ansicht lesen ---------- */
  function fields(section){
    return [].slice.call(section?section.querySelectorAll('.rc776-field'):[]).map(function(f){
      return {label:txt(f.querySelector('span')),value:txt(f.querySelector('strong')),wide:f.classList.contains('rc776-wide')};
    });
  }
  function read(){
    var p=page();var hero=p.querySelector('.rc776-hero');
    var cards=[].slice.call(p.querySelectorAll(':scope>.rc776-grid>.rc776-card,:scope>.rc776-card'));
    var byFields=cards.filter(function(c){return c.querySelector(':scope>.rc776-fields');});
    var process=byFields[byFields.length-1]||null;
    var factCards=byFields.filter(function(c){return c!==process;});
    var colli=p.querySelector('.rc776-table');
    var hist=null,pod=null,reminder=p.querySelector('.rc820-reminder-card');
    cards.forEach(function(c){if(c.querySelector('.rc776-history'))hist=c;else if(!c.id&&!c.querySelector('.rc776-fields,.rc776-table,.index236-reminder-actions')&&c.querySelector('h2'))pod=c;});
    var status=txt(hero.querySelector('.rc776-status'));
    return {
      shipment:p.getAttribute('data-shipment')||'',
      crumb:p.querySelector('[data-rc784-overview]'),crumbCurrent:txt(p.querySelector('.rc784-view-context-current')),
      kicker:txt(hero.querySelector('.rc776-kicker')),ref:txt(hero.querySelector('h1')),status:status,key:statusKey(status),
      readonly:txt(hero.querySelector('.rc776-readonly')),
      heroActions:[].slice.call(hero.querySelectorAll('.rc776-hero-actions>button')),
      metrics:[].slice.call(p.querySelectorAll('.rc776-metrics>.rc776-metric')).map(function(m){return {label:txt(m.querySelector('span')),value:txt(m.querySelector('strong'))};}),
      facts:factCards.map(function(c){return {title:txt(c.querySelector('h2')),fields:fields(c)};}),
      process:process?{title:txt(process.querySelector('h2')),fields:fields(process)}:null,
      colli:colli?{title:txt(colli.closest('.rc776-card').querySelector('h2')),head:[].slice.call(colli.querySelectorAll('thead th')).map(txt),rows:[].slice.call(colli.querySelectorAll('tbody tr')).map(function(r){return [].slice.call(r.cells).map(txt);})}:null,
      reminder:reminder?{title:txt(reminder.querySelector('h2')),text:txt(reminder.querySelector('p')),buttons:[].slice.call(reminder.querySelectorAll('.index236-reminder-actions button'))}:null,
      history:hist?{title:txt(hist.querySelector('h2')),note:txt(hist.querySelector('.rc808-history-note')),rows:[].slice.call(hist.querySelectorAll('.rc776-history-row')).map(function(r){return {time:txt(r.querySelector('time')),text:txt(r.querySelector('b')),extra:txt(r.querySelector('div')).replace(txt(r.querySelector('b')),'').trim()};})}:null,
      pod:pod?{title:txt(pod.querySelector('h2')),html:pod}:null
    };
  }
  function buttonsOf(d){var p=page();return p?[].slice.call(p.querySelectorAll('button')):[];}
  function proxy(el,cls){
    if(!el)return '';
    var idx=buttonsOf().indexOf(el);if(idx<0)return '';
    var dis=el.disabled||el.getAttribute('aria-disabled')==='true';
    return '<button type="button" class="rc1901-btn '+cls+'" data-rc1901-proxy="'+idx+'"'+(dis?' disabled':'')+(el.title?' title="'+esc(el.title)+'"':'')+'>'+esc(txt(el))+'</button>';
  }

  /* ---------- Aufbau ---------- */
  function ensureRoot(shipment){
    var root=document.getElementById(ROOT_ID);
    if(root&&root.getAttribute('data-shipment')!==shipment){root.remove();root=null;}
    if(root)return root;
    var c=content();
    root=document.createElement('div');root.setAttribute('role','region');
    root.id=ROOT_ID;root.className='rc1901';root.setAttribute('data-i18n-ignore','1');root.setAttribute('data-shipment',shipment);
    root.setAttribute('aria-label',tr('rc1901.title'));
    root.innerHTML=
      '<div class="rc1901-top" data-rc1901-gen="top"></div>'+
      '<div class="rc1901-layout">'+
        '<div class="rc1901-main">'+
          '<nav class="rc1901-tabs" role="tablist" data-rc1901-gen="tabs"></nav>'+
          /* Dateikarte und Versanddokumentation müssen direkt hintereinander stehen (RC1860 prüft das), die Reiter blenden per CSS um */
          '<div class="rc1901-live" data-rc1901-slot="docs"></div>'+
          '<div class="rc1901-panel" data-rc1901-panel="overview"><div data-rc1901-gen="overview"></div></div>'+
          '<div class="rc1901-panel" data-rc1901-panel="documents"><div data-rc1901-gen="pod"></div></div>'+
          '<div class="rc1901-panel" data-rc1901-panel="history"><div data-rc1901-gen="timeline"></div><div class="rc1901-live" data-rc1901-slot="audit"></div></div>'+
        '</div>'+
        '<aside class="rc1901-side">'+
          '<div data-rc1901-gen="side"></div>'+
          '<div class="rc1901-live" data-rc1901-slot="avis"></div>'+
        '</aside>'+
      '</div>';
    c.parentNode.insertBefore(root,c);
    root.addEventListener('click',onClick);
    root.addEventListener('keydown',onKey);
    return root;
  }
  function removeRoot(){
    var root=document.getElementById(ROOT_ID);if(root)root.remove();
    document.documentElement.removeAttribute('data-rc1901-view');
  }
  function gen(root,name,html){var el=root.querySelector('[data-rc1901-gen="'+name+'"]');if(el&&el.innerHTML!==html)el.innerHTML=html;}

  /* Bereiche mit eigener Logik unverändert umhängen (gleiche Elemente, gleiche Ereignisse) */
  function adopt(root,slotName,el,after){
    var slot=root.querySelector('[data-rc1901-slot="'+slotName+'"]');
    if(!slot||!el)return;
    if(el.parentNode===slot&&(!after||el.previousElementSibling===after))return;
    if(el.id){[].slice.call(slot.querySelectorAll('#'+el.id)).forEach(function(old){
      if(old===el)return;var nx=old.nextElementSibling;if(nx&&nx.classList.contains('eh1860')&&nx!==el)nx.remove();old.remove();});}
    if(after&&after.parentNode===slot)after.insertAdjacentElement('afterend',el);else slot.appendChild(el);
  }
  function adoptLive(){
    var root=document.getElementById(ROOT_ID);if(!root||!active())return;
    var c=content();
    var files=c.querySelector('#rc786ReferenceFilesCard');
    if(files){
      var proof=files.nextElementSibling&&files.nextElementSibling.classList.contains('eh1860')?files.nextElementSibling:null;
      adopt(root,'docs',files);
      if(proof)adopt(root,'docs',proof,files);
    }
    var avis=c.querySelector('#rc845AvisReadHost');if(avis)adopt(root,'avis',avis);
    var audit=c.querySelector('#rc1071ShipmentHistory');if(audit)adopt(root,'audit',audit);
  }

  function render(){
    if(!active()){removeRoot();return;}
    document.documentElement.setAttribute('data-rc1901-view','shipment');
    var d=read();
    var root=ensureRoot(d.shipment||d.ref);
    adoptLive();
    var sig=JSON.stringify([ui.tab,d.ref,d.status,d.readonly,d.crumbCurrent,d.metrics,d.facts,d.process,d.colli,d.history,
      d.reminder&&d.reminder.buttons.map(function(b){return [txt(b),b.disabled];}),d.heroActions.map(txt),d.pod&&d.pod.html.innerHTML]);
    if(sig===ui.lastSig&&root.querySelector('.rc1901-head'))return;
    ui.lastSig=sig;
    var color=STATUS_COLORS[d.key]||'var(--eh-p3,#6366f1)';
    root.style.setProperty('--c',color);

    /* Kopf */
    var actions=d.heroActions.map(function(b,i){return proxy(b,i===d.heroActions.length-1&&/\bbtn\b/.test(b.className)?'rc1901-btn-primary':'rc1901-btn-ghost');}).join('');
    var rank=STEP_RANK.hasOwnProperty(d.key)?STEP_RANK[d.key]:-1;
    var steps='<ol class="rc1901-steps'+(rank<0?' is-off':'')+'" aria-label="'+esc(tr('rc1901.progress'))+'">'+STEPS.map(function(k,i){
      var st=rank<0?'':(i<rank||(rank===5&&i===5)?'is-done':(i===rank?'is-now':''));
      return '<li class="'+st+'"><span class="rc1901-step-dot" aria-hidden="true"></span><span>'+esc(tr(k))+'</span></li>';
    }).join('')+'</ol>';
    var kpis=d.metrics.filter(function(m){return m.value!==d.status;});
    var pickup=d.facts[1]&&d.facts[1].fields[0];if(pickup&&pickup.value&&!pending(pickup.value))kpis.unshift(pickup);
    gen(root,'top',
      '<header class="rc1901-head">'+
        '<div class="rc1901-head-main">'+
          (d.crumb?'<button type="button" class="rc1901-crumb" data-rc1901-proxy="'+buttonsOf().indexOf(d.crumb)+'">‹ '+esc(txt(d.crumb))+'</button>':'')+
          '<div class="rc1901-title"><h1>'+esc(d.ref)+'</h1><span class="rc1901-status">'+esc(d.status)+'</span>'+(d.readonly?'<span class="rc1901-tag">'+esc(d.readonly)+'</span>':'')+'</div>'+
          '<p class="rc1901-sub">'+esc(firstValue(d,0))+(firstValue(d,2)?' · '+esc(firstValue(d,2)):'')+'</p>'+
        '</div>'+
        '<div class="rc1901-head-actions">'+actions+'</div>'+
      '</header>'+
      steps+
      (kpis.length?'<dl class="rc1901-kpis">'+kpis.map(function(m){return '<div><dt>'+esc(m.label)+'</dt><dd>'+esc(m.value)+'</dd></div>';}).join('')+'</dl>':''));

    /* Reiter */
    gen(root,'tabs',TABS.map(function(t){return '<button type="button" role="tab" class="rc1901-tab'+(ui.tab===t[0]?' is-active':'')+'" aria-selected="'+(ui.tab===t[0])+'" data-rc1901-tab="'+t[0]+'">'+esc(tr(t[1]))+'</button>';}).join(''));
    root.setAttribute('data-tab',ui.tab);
    [].slice.call(root.querySelectorAll('[data-rc1901-panel]')).forEach(function(p){p.hidden=p.getAttribute('data-rc1901-panel')!==ui.tab;});

    /* Übersicht: Stammdaten und Colli */
    gen(root,'overview',
      '<div class="rc1901-facts">'+d.facts.map(function(f){
        return '<div class="rc1901-group"><h2>'+esc(f.title)+'</h2><dl>'+f.fields.map(function(x){return '<div'+(x.wide?' class="is-wide"':'')+'><dt>'+esc(x.label)+'</dt><dd'+(pending(x.value)&&/^(–|-)$/.test(x.value)?' class="is-empty"':'')+'>'+esc(x.value||'–')+'</dd></div>';}).join('')+'</dl></div>';
      }).join('')+'</div>'+
      (d.colli?'<div class="rc1901-group rc1901-colli"><h2>'+esc(d.colli.title)+'</h2><div class="rc1901-table"><table><thead><tr>'+d.colli.head.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+
        d.colli.rows.map(function(r){return '<tr>'+r.map(function(c,i){return '<td data-label="'+esc(d.colli.head[i]||'')+'">'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div></div>':''));

    /* Dokumente: POD-Hinweis der alten Ansicht */
    gen(root,'pod',d.pod?'<div class="rc1901-group rc1901-pod"><h2>'+esc(d.pod.title)+'</h2><div class="rc1901-pod-body">'+podHtml(d.pod.html)+'</div></div>':'');

    /* Historie: fachlicher Verlauf als Zeitleiste */
    gen(root,'timeline',d.history?'<div class="rc1901-group"><h2>'+esc(d.history.title)+'</h2>'+(d.history.note?'<p class="rc1901-note">'+esc(d.history.note)+'</p>':'')+
      '<ol class="rc1901-timeline">'+d.history.rows.map(function(r){return '<li><time>'+esc(r.time)+'</time><strong>'+esc(r.text)+'</strong>'+(r.extra?'<span>'+esc(r.extra)+'</span>':'')+'</li>';}).join('')+'</ol></div>':'');

    /* Seitenspalte: Prozess und Abholerinnerung */
    gen(root,'side',
      (d.process?'<div class="rc1901-card"><h2>'+esc(d.process.title)+'</h2><ul class="rc1901-checks">'+d.process.fields.filter(function(x){return x.value!==d.status;}).map(function(x){
        var open=pending(x.value);return '<li class="'+(open?'is-open':'is-ok')+'"><span class="rc1901-check" aria-hidden="true"></span><span class="rc1901-check-label">'+esc(x.label)+'</span><strong>'+esc(x.value||'–')+'</strong></li>';
      }).join('')+'</ul></div>':'')+
      (d.reminder?'<div class="rc1901-card rc1901-remind"><h2>'+esc(d.reminder.title)+'</h2>'+(d.reminder.text?'<p>'+esc(d.reminder.text)+'</p>':'')+
        '<div class="rc1901-actions">'+d.reminder.buttons.map(function(b){return proxy(b,'rc1901-btn-soft');}).join('')+'</div></div>':''));
  }
  function firstValue(d,i){var f=d.facts[0]&&d.facts[0].fields[i];return f?f.value:'';}
  /* POD-Bereich: nur Text und eigene Knöpfe (Links/Knöpfe der alten Karte werden weitergereicht) */
  function podHtml(card){
    var parts=[];
    [].slice.call(card.children).forEach(function(ch){
      if(ch.tagName==='H2')return;
      var btns=[].slice.call(ch.querySelectorAll?ch.querySelectorAll('button'):[]);
      if(ch.tagName==='BUTTON')btns=[ch];
      if(btns.length){parts.push('<div class="rc1901-actions">'+btns.map(function(b){return proxy(b,'rc1901-btn-ghost');}).join('')+'</div>');var t=txt(ch);btns.forEach(function(b){t=t.replace(txt(b),'');});t=t.trim();if(t)parts.unshift('<p>'+esc(t)+'</p>');}
      else{var tx=txt(ch);if(tx)parts.push('<p>'+esc(tx)+'</p>');}
    });
    return parts.join('');
  }

  /* ---------- Bedienung ---------- */
  function onClick(ev){
    var t=ev.target.closest('button');if(!t)return;
    if(t.hasAttribute('data-rc1901-tab')){ui.tab=t.getAttribute('data-rc1901-tab');schedule();return;}
    if(t.hasAttribute('data-rc1901-proxy')){
      var el=buttonsOf()[+t.getAttribute('data-rc1901-proxy')];
      if(el&&!el.disabled){el.click();schedule();}
    }
  }
  function onKey(ev){
    var t=ev.target;if(!t.hasAttribute||!t.hasAttribute('data-rc1901-tab'))return;
    if(ev.key!=='ArrowRight'&&ev.key!=='ArrowLeft')return;
    var keys=TABS.map(function(x){return x[0];});var i=keys.indexOf(t.getAttribute('data-rc1901-tab'));
    ui.tab=keys[(i+(ev.key==='ArrowRight'?1:keys.length-1))%keys.length];render();
    var n=document.querySelector('#'+ROOT_ID+' [data-rc1901-tab="'+ui.tab+'"]');if(n)n.focus();
  }
  function schedule(){
    if(ui.scheduled)return;ui.scheduled=true;
    (window.requestAnimationFrame||setTimeout)(function(){ui.scheduled=false;render();});
  }
  function onMutations(){
    /* Umhängen sofort, damit es nie zwei Elemente mit derselben ID gibt; Neuzeichnen gebündelt */
    var p=page();var ship=p&&p.getAttribute('data-shipment')||'';
    if(ship!==ui.shipment){ui.shipment=ship;ui.tab='overview';ui.lastSig='';}
    if(document.getElementById(ROOT_ID)&&active()){
      var root=document.getElementById(ROOT_ID);
      if(root.getAttribute('data-shipment')!==(ship||root.getAttribute('data-shipment'))){removeRoot();}
      else adoptLive();
    }
    schedule();
  }

  function start(){
    var c=content();
    if(!c){setTimeout(start,300);return;}
    new MutationObserver(onMutations).observe(c,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','disabled','data-shipment']});
    new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-eh-layout','data-eh-newui']});
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.rc1901NeueSendungsansicht={render:render,state:ui};
})();
