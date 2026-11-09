/* RC1903: Neue Erfassung "Sendung erstellen/bearbeiten" (Design "Neu", 2026-11-07).
   Eigene, neu gebaute Eingabefelder für alle Blöcke der Sendungsmaske. Die bisherige Maske bleibt im DOM
   (außerhalb des Bildschirms, nie display:none) und ist die einzige Datenquelle: jede Eingabe hier wird auf das
   bestehende Feld geschrieben und dort als input/change ausgelöst, Knöpfe lösen den bestehenden Knopf aus.
   Damit laufen Speichern, Prüfungen, Sperren und Historie unverändert über die bestehende Logik.
   Werte, die die bestehende Logik ändert, werden laufend zurückgelesen.
   Eigene Behälter sind div (nicht section oder .card): RC1071 protokolliert Klicks anhand des Textes im nächsten
   section/.card-Behälter; Klicks und Eingaben in dieser Oberfläche werden deshalb beim window abgefangen. */
(function(){
  'use strict';
  if(window.__rc1903NeueErfassung)return;
  window.__rc1903NeueErfassung=true;

  var ROOT_ID='rc1903Capture';
  var HINTS={rc363BlockCustomer:'rc1903.hintCustomer',rc363BlockShipment:'rc1903.hintShipment',rc363BlockColli:'rc1903.hintColli',rc363BlockDocuments:'rc1903.hintDocuments',rc363BlockAbdDecision:'rc1903.hintAbd',rc363BlockStow:'rc1903.hintStow',rc363BlockMail:'rc1903.hintMail',rc363BlockActions:'rc1903.hintActions'};
  var ui={scheduled:false,classic:false,html:{},map:{},seq:0,keys:new WeakMap(),used:null};

  function content(){return document.getElementById('content');}
  function layout(){return document.getElementById('rc363FixedShipmentLayout');}
  function base(){
    if(!document.documentElement.hasAttribute('data-eh-newui'))return false;
    var c=content(),l=layout();
    return !!(c&&l&&c.contains(l)&&c.getAttribute('data-exporthub-rendered-view')==='shipment');
  }
  function active(){return base()&&!ui.classic;}
  function txt(el){return el?String(el.textContent||'').replace(/\s+/g,' ').trim():'';}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(key){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){var v=window.ExportHUBI18n.t(key);if(v&&v!==key)return v;}}catch(_){}return key;}
  function visible(el){return !!(el&&el.isConnected&&!el.hidden&&el.getClientRects().length);}
  function all(root,sel){return root?[].slice.call(root.querySelectorAll(sel)):[];}

  /* ---------- Zuordnung neue Felder -> bestehende Felder ---------- */
  function keyOf(el){
    if(el.id)return 'i:'+el.id;
    var k=ui.keys.get(el);if(!k){k='k'+(++ui.seq);ui.keys.set(el,k);}
    return k;
  }
  function reg(el){var k=keyOf(el);ui.map[k]=el;if(ui.used)ui.used.add(el);return k;}
  function resolve(k){
    if(!k)return null;
    if(k.indexOf('i:')===0){var byId=document.getElementById(k.slice(2));if(byId)return byId;}
    var el=ui.map[k];return el&&el.isConnected?el:null;
  }
  function ownBlock(el,b){return el.closest('.rc363-process-block')===b;}

  /* ---------- Bausteine ---------- */
  function labelText(old){
    var lbl=old.closest('label');
    if(lbl){
      var c=lbl.cloneNode(true);
      all(c,'input,select,textarea,button,datalist,.rc682-packaging-picker,script,style').forEach(function(x){x.remove();});
      var t=txt(c);if(t)return t;
    }
    return old.getAttribute('aria-label')||old.getAttribute('title')||old.placeholder||'';
  }
  function control(old,extra){
    var k=reg(old),tag=old.tagName,attrs=' data-rc1903-b="'+esc(k)+'"'+(old.disabled?' disabled':'')+(old.readOnly?' readonly':'')+(extra||'');
    ['placeholder','maxlength','min','max','step','inputmode','pattern','accept','autocomplete'].forEach(function(a){if(old.hasAttribute(a))attrs+=' '+a+'="'+esc(old.getAttribute(a))+'"';});
    if(tag==='SELECT'){
      return '<select class="rc1903-input"'+attrs+'>'+[].slice.call(old.options).map(function(o){
        return '<option value="'+esc(o.value)+'"'+(o.disabled?' disabled':'')+'>'+esc(o.textContent)+'</option>';
      }).join('')+'</select>';
    }
    if(tag==='TEXTAREA')return '<textarea class="rc1903-input" rows="3"'+attrs+'></textarea>';
    var type=(old.type||'text').toLowerCase();
    if(type==='checkbox'||type==='radio')return '<input type="'+type+'" class="rc1903-check"'+attrs+'>';
    if(old.getAttribute('list'))attrs+=' list="'+esc(old.getAttribute('list'))+'"';
    return '<input type="'+esc(type)+'" class="rc1903-input"'+attrs+'>';
  }
  function field(old,cls,label){
    if(!old)return '';
    var type=(old.type||'').toLowerCase();
    if(type==='checkbox')return '<label class="rc1903-checkline'+(cls?' '+cls:'')+'">'+control(old)+'<span>'+esc(label||labelText(old))+'</span></label>';
    return '<label class="rc1903-f'+(cls?' '+cls:'')+'"><span class="rc1903-label">'+esc(label||labelText(old))+'</span>'+control(old)+'</label>';
  }
  function btn(old,cls,label){
    if(!old||!visible(old))return '';
    var k=reg(old);
    var cl=old.classList.contains('active')||old.getAttribute('aria-pressed')==='true'?' is-active':'';
    return '<button type="button" class="rc1903-btn '+(cls||'rc1903-btn-ghost')+cl+'" data-rc1903-click="'+esc(k)+'"'+(old.disabled?' disabled':'')+(old.title?' title="'+esc(old.title)+'"':'')+'>'+esc(label||txt(old))+'</button>';
  }
  /* Statische Kopie (Anzeige) mit Knöpfen, die den bestehenden Knopf auslösen */
  function clone(el){
    if(!el)return '';
    var c=el.cloneNode(true);
    var ob=all(el,'button,a'),cb=all(c,'button,a');
    cb.forEach(function(b,i){
      var o=ob[i];if(!o)return;
      if(o.disabled||!visible(o)&&o.tagName==='BUTTON'){if(!visible(o))b.remove();else b.disabled=true;}
      var href=o.getAttribute('href')||'';
      if(o.tagName==='A'&&/^(https?:|mailto:)/i.test(href)&&!o.hasAttribute('onclick')){b.setAttribute('target','_blank');b.setAttribute('rel','noopener');return;}
      ui.used&&ui.used.add(o);
      b.setAttribute('data-rc1903-click',reg(o));
      if(b.tagName==='BUTTON')b.setAttribute('type','button');
      else{b.removeAttribute('href');b.setAttribute('role','button');b.setAttribute('tabindex','0');}
    });
    all(c,'input,select,textarea').forEach(function(x){x.disabled=true;x.setAttribute('tabindex','-1');});
    all(c,'script,style').forEach(function(x){x.remove();});
    [c].concat(all(c,'*')).forEach(function(n){
      [].slice.call(n.attributes).forEach(function(a){if(/^on/i.test(a.name)||/^(id|for|name|form|aria-live|role|data-rc\d+-sig|data-sig)$/i.test(a.name))n.removeAttribute(a.name);});
    });
    return c.outerHTML;
  }
  function boxes(scope,exclude){
    return all(scope,'.badbox,.okbox,.infobox,.warnbox,.notice').filter(function(x){
      return visible(x)&&!(exclude&&exclude(x))&&!(x.parentElement&&x.parentElement.closest('.badbox,.okbox,.infobox,.warnbox,.notice'));
    }).map(function(x){
      if(ui.used)ui.used.add(x);
      var kind=x.classList.contains('badbox')||x.classList.contains('warnbox')?'warn':x.classList.contains('okbox')?'ok':'info';
      return '<div class="rc1903-msg is-'+kind+'">'+esc(txt(x))+'</div>';
    }).join('');
  }
  /* Was ein Block-Renderer nicht kennt, wird hier trotzdem angeboten, damit keine Funktion verloren geht */
  function leftovers(b,scope){
    var items=all(scope||b,'input,select,textarea,button').filter(function(el){
      if(!ownBlock(el,b)||!visible(el)||ui.used.has(el))return false;
      if(el.type==='hidden'||el.closest('.rc682-packaging-picker,[data-rc1903-skip]'))return false;
      for(var p=el.parentElement;p&&p!==b;p=p.parentElement)if(ui.used.has(p))return false;
      return true;
    });
    if(!items.length)return '';
    return '<div class="rc1903-more"><span class="rc1903-label">'+esc(tr('rc1903.moreFields'))+'</span><div class="rc1903-grid2">'+items.map(function(el){
      if(el.tagName==='BUTTON')return btn(el);
      if((el.type||'').toLowerCase()==='file')return fileDrop(el);
      return field(el);
    }).join('')+'</div></div>';
  }
  function fileDrop(old){
    var k=reg(old);
    return '<div class="rc1903-drop" data-rc1903-drop="'+esc(k)+'">'+
      '<span class="rc1903-drop-icon" aria-hidden="true">⇪</span>'+
      '<div><strong>'+esc(labelText(old))+'</strong><span>'+esc(tr('rc1903.dropHint'))+'</span></div>'+
      '<button type="button" class="rc1903-btn rc1903-btn-ghost" data-rc1903-file="'+esc(k)+'"'+(old.disabled?' disabled':'')+'>'+esc(tr('rc1903.chooseFiles'))+'</button>'+
    '</div>';
  }

  /* ---------- Blöcke ---------- */
  function renderCustomer(b){
    var cust=b.querySelector('#shipmentCustomerSearch')||b.querySelector('.rc363-process-body input[type=text]');
    var loc=b.querySelector('#index289LocationSelect');
    var addr=b.querySelector('[data-index389-address-box]');
    var ctx=b.querySelector('#rc628CustomerContext');
    var h='<div class="rc1903-grid2">'+(cust?field(cust,'rc1903-span2 rc1903-big'):'')+(loc&&visible(loc)?field(loc,'rc1903-span2'):'')+'</div>';
    if(addr&&visible(addr)){
      ui.used.add(addr);
      var title=txt(addr.querySelector('b'))||'';
      h+='<div class="rc1903-address"><span class="rc1903-address-icon" aria-hidden="true">⌖</span><div><span class="rc1903-label">'+esc(title.replace(/:$/,''))+'</span><p>'+esc(txt(addr.querySelector('pre'))||txt(addr).replace(title,''))+'</p></div></div>';
    }
    h+=boxes(b,function(x){return x===addr;});
    if(ctx&&visible(ctx)){
      ui.used.add(ctx);
      h+='<div class="rc1903-context">'+all(ctx,':scope>article').map(function(a){
        var head=a.querySelector('h3'),body=a.cloneNode(true);
        all(body,'.rc628-customer-context-head,.rc628-customer-context-customer').forEach(function(x){x.remove();});
        var tmp=document.createElement('div');tmp.innerHTML=clone(a);var cl=tmp.firstChild;
        all(cl,'.rc628-customer-context-head,.rc628-customer-context-customer').forEach(function(x){x.remove();});
        var empty=a.querySelector('.rc628-customer-empty');
        return '<div class="rc1903-ctx'+(empty&&!txt(body).replace(txt(empty),'').trim()?' is-empty':'')+'"><span class="rc1903-label">'+esc(txt(head))+'</span><div class="rc1903-ctx-body">'+cl.innerHTML+'</div></div>';
      }).join('')+'</div>';
    }
    var acts=all(b,'#rc380CustomerActions button').map(function(x){return btn(x);}).join('');
    if(acts)h+='<div class="rc1903-actions-row">'+acts+'</div>';
    return h;
  }

  function renderShipment(b){
    var grid=b.querySelector('#rc896ShipmentFieldGrid');
    var h='';
    var status=b.querySelector('#rc573ShipmentStatus');
    if(status&&visible(status)){ui.used.add(status);var pill=status.querySelector('.rc573-status-pill');h+='<div class="rc1903-statusline"><span class="rc1903-label">'+esc(txt(status.querySelector('.rc573-status-label')))+'</span><span class="rc1903-pill">'+esc(txt(pill))+'</span></div>';}
    var fields=grid?all(grid,'input,select,textarea').filter(visible):[];
    h+='<div class="rc1903-grid2">'+fields.map(function(el){
      var wide=el.tagName==='TEXTAREA';
      return field(el,(wide?'rc1903-span2':'')+(el.getAttribute('data-rc408-shipment-field')==='ref'?' rc1903-ref':''));
    }).join('')+'</div>';
    var avis=b.querySelector('#rc897LieferavisPanel');
    if(avis&&visible(avis)){
      ui.used.add(avis);
      var on=avis.getAttribute('data-active')==='1';
      h+='<div class="rc1903-sub'+(on?' is-on':'')+'"><div class="rc1903-sub-head"><strong>'+esc(txt(avis.querySelector('.rc897-avis-head strong')))+'</strong><span>'+esc(txt(avis.querySelector('.rc897-avis-head .rc897-avis-help')))+'</span></div>'+
        '<dl class="rc1903-facts">'+all(avis,'.rc897-avis-box').map(function(x){return '<div><dt>'+esc(txt(x.querySelector('.rc897-avis-label')))+'</dt><dd>'+esc(txt(x.querySelector('.rc897-avis-value')))+'</dd></div>';}).join('')+'</dl>'+
        '<div class="rc1903-actions-row">'+all(avis,'.rc897-avis-actions button').map(function(x){return btn(x);}).join('')+'</div>'+
        all(avis,':scope>.rc897-avis-help').map(function(x){return '<p class="rc1903-help">'+esc(txt(x))+'</p>';}).join('')+'</div>';
    }
    var cont=b.querySelector('.rc1259-container-config');
    if(cont&&visible(cont)){
      ui.used.add(cont);
      h+='<div class="rc1903-sub"><div class="rc1903-sub-head"><strong>'+esc(txt(cont.querySelector('.rc1259-config-title strong')))+'</strong><span>'+esc(txt(cont.querySelector('.rc1259-config-title span')))+'</span></div>'+
        '<div class="rc1903-grid2">'+all(cont,'input,select,textarea').filter(visible).map(function(el){return field(el,el.type==='checkbox'?'rc1903-span2':'');}).join('')+'</div>'+
        all(cont,'.rc1259-config-help').map(function(x){return '<p class="rc1903-help">'+esc(txt(x))+'</p>';}).join('')+'</div>';
    }
    h+=boxes(b,function(x){return avis&&avis.contains(x)||cont&&cont.contains(x);});
    return h;
  }

  function renderColli(b){
    var rows=all(b,'.rc363-owned-row').filter(function(r){return ownBlock(r,b);});
    var names=['type','count','weight','ldm','l','w','h'];
    var head='';
    var h='<div class="rc1903-colli">';
    rows.forEach(function(r,i){
      var get=function(n){return r.querySelector('[data-rc363-field="'+n+'"] input,[data-rc363-field="'+n+'"] select');};
      if(!head)head='<div class="rc1903-colli-head" aria-hidden="true"><span>#</span>'+names.map(function(n){var el=get(n);return '<span>'+esc(el?labelText(el):'')+'</span>';}).join('')+'<span></span></div>';
      ui.used.add(r);
      h+='<div class="rc1903-colli-row" data-rc1903-row="'+i+'"><span class="rc1903-colli-num">'+(i+1)+'</span>'+names.map(function(n){
        var el=get(n);if(!el)return '<span></span>';
        if(n==='weight'){
          var k=reg(el);
          return '<label class="rc1903-f"><span class="rc1903-label">'+esc(labelText(el))+'</span><button type="button" class="rc1903-input rc1903-weight" data-rc1903-click="'+esc(k)+'"'+(el.disabled?' disabled':'')+' title="'+esc(el.title||'')+'">'+(el.value?esc(el.value)+' kg':'<span class="rc1903-placeholder">'+esc(tr('rc1903.weightEmpty'))+'</span>')+'</button></label>';
        }
        return field(el,'rc1903-c-'+n);
      }).join('')+all(r,'[data-rc363-remove-row]').map(function(x){return '<div class="rc1903-colli-remove">'+btn(x,'rc1903-btn-danger')+'</div>';}).join('')+'</div>';
    });
    if(!rows.length)h+='<p class="rc1903-empty">'+esc(tr('rc1903.noRows'))+'</p>';
    h=h.replace('<div class="rc1903-colli">','<div class="rc1903-colli">'+head)+'</div>';
    var add=all(b,'[data-rc363-add-row]').filter(visible)[0];
    if(add)h+='<div class="rc1903-actions-row">'+btn(add,'rc1903-btn-soft')+'</div>';
    var sums=all(b,'.summaryGrid>.summaryBox,.rc344-summary>.summaryBox');
    if(sums.length){sums.forEach(function(s){ui.used.add(s);});h+='<dl class="rc1903-kpis">'+sums.map(function(s){return '<div><dt>'+esc(txt(s.querySelector('span')))+'</dt><dd>'+esc(txt(s.querySelector('strong')))+'</dd></div>';}).join('')+'</dl>';}
    h+=boxes(b);
    return h;
  }

  function renderDocuments(b){
    var h='';
    var notes=all(b,'textarea,input:not([type=file]),select').filter(function(el){return ownBlock(el,b)&&visible(el);});
    h+='<div class="rc1903-grid2">'+notes.map(function(el){return field(el,'rc1903-span2');}).join('')+'</div>';
    all(b,'input[type=file]').filter(function(el){return ownBlock(el,b)&&visible(el);}).forEach(function(el){h+=fileDrop(el);});
    var list=b.querySelector('[data-rc609-delivery-list]');
    if(list&&visible(list)&&ownBlock(list,b)){ui.used.add(list);h+='<div class="rc1903-files">'+clone(list)+'</div>';}
    h+=boxes(b,function(x){return !ownBlock(x,b)||x===list;});
    return h;
  }

  function renderAbd(b){
    var area=b.querySelector('#rc543AbdDecision')||b;
    var h='<div class="rc1903-abd-top"><div><strong>'+esc(txt(area.querySelector('.rc543-head h2')))+'</strong><p class="rc1903-help">'+esc(txt(area.querySelector('.rc543-head p')))+'</p></div>'+
      all(area,'.rc543-head .pill').map(function(p){ui.used.add(p);return '<span class="rc1903-pill">'+esc(txt(p))+'</span>';}).join('')+'</div>';
    var seg=all(area,'.rc543-segments button').filter(visible);
    if(seg.length)h+='<div class="rc1903-segment" role="group">'+seg.map(function(x){return btn(x,'rc1903-seg');}).join('')+'</div>';
    var tools=all(area,'.toolbar button').filter(visible);
    if(tools.length)h+='<div class="rc1903-actions-row">'+tools.map(function(x){return btn(x);}).join('')+'</div>';
    h+=boxes(b);
    return h;
  }

  function renderStow(b){
    var plan=b.querySelector('#rc380StowPlan')||b;
    var head=plan.querySelector('.rc396-graphic-head');
    var h='';
    if(head){ui.used.add(head);h+='<div class="rc1903-stow-head"><div><strong>'+esc(txt(head.querySelector('b')))+'</strong><p class="rc1903-help">'+esc(txt(head.querySelector('.muted')))+'</p></div><div class="rc1903-pills">'+all(head,'.pill').map(function(p){return '<span class="rc1903-pill is-'+esc((/green|blue|orange|red|gray/.exec(p.className)||['gray'])[0])+'">'+esc(txt(p))+'</span>';}).join('')+'</div></div>';}
    var tb=plan.querySelector('.rc713-toolbar');
    var sel=plan.querySelector('#rc713VehicleType');
    if(tb){ui.used.add(tb);h+='<div class="rc1903-stow-tools">'+(sel?field(sel,'',txt(tb.querySelector('label'))):'')+all(tb,'.pill').map(function(p){return '<span class="rc1903-pill">'+esc(txt(p))+'</span>';}).join('')+'</div>';}
    var shell=plan.querySelector('.rc717-shell');
    if(shell){ui.used.add(shell);h+='<div class="rc1903-stow">'+clone(shell)+'</div>';}
    var legend=plan.querySelector('.rc717-legend');
    if(legend){ui.used.add(legend);h+='<div class="rc1903-legend">'+clone(legend)+'</div>';}
    var acts=all(plan,'.rc396-actions button');
    if(acts.length)h+='<div class="rc1903-actions-row">'+acts.map(function(x){return btn(x);}).join('')+'</div>';
    h+=boxes(b);
    return h;
  }

  function renderMail(b){
    var area=b.querySelector('#rc543MailArea')||b;
    var h='';
    var pills=all(area,'[data-rc543-status]');
    if(pills.length)h+='<div class="rc1903-pills">'+pills.map(function(p){ui.used.add(p);return '<span class="rc1903-pill is-'+esc((/green|blue|orange|red|gray/.exec(p.className)||['gray'])[0])+'">'+esc(txt(p))+'</span>';}).join('')+'</div>';
    var seg=all(area,'.rc543-segments button').filter(visible);
    if(seg.length)h+='<div class="rc1903-segment" role="group">'+seg.map(function(x){return btn(x,'rc1903-seg');}).join('')+'</div>';
    var ctrls=all(area,'input,select,textarea').filter(function(el){return visible(el)&&!el.closest('details');});
    var edit=ctrls.filter(function(el){return !el.readOnly&&el.tagName!=='TEXTAREA';});
    var facts=ctrls.filter(function(el){return el.readOnly&&el.tagName==='INPUT';});
    var body=ctrls.filter(function(el){return el.tagName==='TEXTAREA';});
    if(edit.length)h+='<div class="rc1903-grid2">'+edit.map(function(el){return field(el);}).join('')+'</div>';
    if(facts.length){facts.forEach(function(el){ui.used.add(el);});h+='<dl class="rc1903-facts rc1903-facts-mail">'+facts.map(function(el){return '<div><dt>'+esc(labelText(el))+'</dt><dd>'+esc(el.value||'–')+'</dd></div>';}).join('')+'</dl>';}
    /* Den Mailtext übernimmt die bestehende Logik nur aus echten Tastatureingaben (isTrusted). Deshalb hier nur
       Vorschau; "Bearbeiten" öffnet das bestehende Feld in der bisherigen Maske. */
    body.forEach(function(el){
      ui.used.add(el);
      h+='<div class="rc1903-mailbody"><span class="rc1903-label">'+esc(labelText(el))+'</span><pre>'+esc(el.value)+'</pre>'+
        (!el.readOnly&&!el.disabled?'<div class="rc1903-actions-row"><button type="button" class="rc1903-btn rc1903-btn-soft" data-rc1903-classic-focus="'+esc(reg(el))+'">'+esc(tr('rc1903.editMailText'))+'</button></div>':'')+'</div>';
    });
    var att=area.querySelector('#rc543MailAttachment');
    if(att&&visible(att)){ui.used.add(att);h+='<div class="rc1903-msg is-'+(att.classList.contains('missing')?'info':'ok')+'"><strong>'+esc(txt(att.querySelector('b')))+'</strong> '+esc(txt(att.querySelector('span')))+'</div>';}
    h+=boxes(area);
    var tools=all(area,'.toolbar button').filter(visible);
    if(tools.length)h+='<div class="rc1903-actions-row">'+tools.map(function(x,i){return btn(x,i===0?'rc1903-btn-primary':'rc1903-btn-ghost');}).join('')+'</div>';
    var hist=area.querySelector('details.rc543-history');
    if(hist&&visible(hist)){ui.used.add(hist);var t=document.createElement('div');t.innerHTML=clone(hist);var d=t.firstChild;if(d&&d.tagName==='DETAILS'){d.className='rc1903-details';if(hist.open)d.setAttribute('open','');}h+=t.innerHTML;}
    return h;
  }

  function renderActions(b){
    var h='';
    var ps=b.querySelector('#rc543PrintStatus');
    if(ps&&visible(ps)){ui.used.add(ps);h+='<div class="rc1903-printstatus"><div><span class="rc1903-label">'+esc(txt(ps.querySelector('.rc543-kicker')))+'</span><strong>'+esc(txt(ps.querySelector('h3')))+'</strong><p class="rc1903-help">'+esc(txt(ps.querySelector('p')))+'</p></div>'+all(ps,'.pill').map(function(p){return '<span class="rc1903-pill is-'+esc((/green|blue|orange|red|gray/.exec(p.className)||['gray'])[0])+'">'+esc(txt(p))+'</span>';}).join('')+'</div>';}
    var row=all(b,'.rc363-actions-buttons button').filter(visible);
    if(row.length)h+='<div class="rc1903-actions-row rc1903-actions-main">'+row.map(function(x){return btn(x,x.id==='rc363SaveShipment'?'rc1903-btn-primary':'rc1903-btn-ghost',txt(x).replace(/^▣\s*/,''));}).join('')+'</div>';
    var qr=b.querySelector('#rc363ShipmentQr');
    if(qr&&visible(qr)){ui.used.add(qr);var copy=qr.cloneNode(true);all(copy,'.toolbar,button,b').forEach(function(x){x.remove();});h+='<div class="rc1903-qr"><span class="rc1903-qr-icon" aria-hidden="true">▦</span><div><strong>'+esc(txt(qr.querySelector('b')))+'</strong><p class="rc1903-help">'+esc(txt(copy))+'</p></div>'+all(qr,'button').map(function(x){return btn(x);}).join('')+'</div>';}
    h+=boxes(b);
    return h;
  }

  function renderSaved(card){
    if(!card||!visible(card))return '';
    ui.used.add(card);
    var t=document.createElement('div');t.innerHTML=clone(card);var c=t.firstChild;
    var title=c.querySelector('h3');var titleText=title?txt(title):'';if(title)title.remove();
    return '<details class="rc1903-details rc1903-saved"><summary>'+esc(titleText)+'</summary>'+c.innerHTML+'</details>';
  }

  var RENDERERS={rc363BlockCustomer:renderCustomer,rc363BlockShipment:renderShipment,rc363BlockColli:renderColli,rc363BlockDocuments:renderDocuments,rc363BlockAbdDecision:renderAbd,rc363BlockStow:renderStow,rc363BlockMail:renderMail,rc363BlockActions:renderActions};

  function blockList(){
    var l=layout();if(!l)return [];
    return all(l,'.rc363-process-block').filter(function(b){return b.id&&b.querySelector(':scope>.rc363-process-head h2');});
  }
  function warnOf(b){
    return all(b,'.badbox,.rc363-missing,[aria-invalid="true"]').some(function(x){return ownBlock(x,b)&&visible(x);});
  }
  function sectionHtml(b){
    ui.used=new Set();
    var fn=RENDERERS[b.id];
    var body;
    try{body=fn?fn(b):'';}catch(e){body='';try{console.error('RC1903 '+b.id,e);}catch(_){}}
    body+=leftovers(b);
    if(b.id==='rc363BlockActions')body+=renderSaved(document.getElementById('rc573SavedCard'));
    ui.used=null;
    var num=txt(b.querySelector(':scope>.rc363-process-head .rc363-process-number'));
    var title=txt(b.querySelector(':scope>.rc363-process-head h2'));
    return '<div class="rc1903-sec-head"><span class="rc1903-sec-num">'+esc(num)+'</span><div><h3>'+esc(title)+'</h3>'+(HINTS[b.id]?'<p>'+esc(tr(HINTS[b.id]))+'</p>':'')+'</div>'+
      (warnOf(b)?'<span class="rc1903-sec-state is-warn">'+esc(tr('rc1903.open'))+'</span>':'<span class="rc1903-sec-state">'+esc(tr('rc1903.ok'))+'</span>')+'</div>'+
      '<div class="rc1903-sec-body">'+body+'</div>';
  }

  /* ---------- Aufbau ---------- */
  function ensureRoot(){
    var root=document.getElementById(ROOT_ID),c=content();
    if(!root){
      root=document.createElement('div');
      root.id=ROOT_ID;root.className='rc1903';
      root.setAttribute('data-i18n-ignore','1');
      root.innerHTML='<div class="rc1903-top"><button type="button" class="rc1903-link" data-rc1903-mode="toggle"></button></div><div class="rc1903-grid"></div>';
      c.parentNode.insertBefore(root,c);
    }
    if(root.nextElementSibling!==c)c.parentNode.insertBefore(root,c);
    var bar=document.getElementById('rc1902ShipmentForm');
    if(bar&&bar.parentNode===root.parentNode&&(root.compareDocumentPosition(bar)&Node.DOCUMENT_POSITION_FOLLOWING))root.parentNode.insertBefore(bar,root);
    return root;
  }
  function removeRoot(){
    var root=document.getElementById(ROOT_ID);if(root)root.remove();
    document.documentElement.removeAttribute('data-rc1903-view');
    var l=layout();if(l&&l.getAttribute('data-rc1903-hidden')){l.removeAttribute('aria-hidden');l.removeAttribute('data-rc1903-hidden');}
    ui.html={};
  }

  function render(){
    if(!base()){removeRoot();return;}
    var root=ensureRoot(),l=layout();
    var toggle=root.querySelector('[data-rc1903-mode]');
    var tl=tr(ui.classic?'rc1903.showNew':'rc1903.showClassic');if(toggle.textContent!==tl)toggle.textContent=tl;
    var grid=root.querySelector('.rc1903-grid');
    if(ui.classic){
      document.documentElement.setAttribute('data-rc1903-view','classic');
      if(l.getAttribute('data-rc1903-hidden')){l.removeAttribute('aria-hidden');l.removeAttribute('data-rc1903-hidden');}
      if(grid.firstChild){grid.innerHTML='';ui.html={};barRefresh();}
      return;
    }
    document.documentElement.setAttribute('data-rc1903-view','capture');
    if(!l.getAttribute('data-rc1903-hidden')){l.setAttribute('aria-hidden','true');l.setAttribute('data-rc1903-hidden','1');}
    var list=blockList(),ids=list.map(function(b){return b.id;});
    /* Abschnitte anlegen/entfernen in Reihenfolge der Maske */
    all(grid,':scope>[data-rc1903-section]').forEach(function(s){if(ids.indexOf(s.getAttribute('data-rc1903-section'))<0){delete ui.html[s.getAttribute('data-rc1903-section')];s.remove();}});
    var prev=null,created=false;
    list.forEach(function(b){
      var sec=grid.querySelector(':scope>[data-rc1903-section="'+b.id+'"]');
      if(!sec){sec=document.createElement('div');sec.className='rc1903-sec';sec.setAttribute('data-rc1903-section',b.id);created=true;}
      if(prev?prev.nextElementSibling!==sec:grid.firstElementChild!==sec)grid.insertBefore(sec,prev?prev.nextElementSibling:grid.firstElementChild);
      prev=sec;
      var html=sectionHtml(b);
      sec.classList.toggle('is-warn',warnOf(b));
      if(ui.html[b.id]!==html){ui.html[b.id]=html;write(sec,html);}
    });
    syncValues(root);
    if(created)barRefresh();
  }
  function barRefresh(){try{var bar=window.rc1902NeueSendungsmaske;if(bar&&typeof bar.render==='function')bar.render();}catch(_){}}
  /* Abschnitt aktualisieren: vorhandene Elemente werden angepasst statt ersetzt, damit Fokus, Cursor und die
     Bildschirmtastatur beim Tippen erhalten bleiben */
  function write(sec,html){
    var tmp=document.createElement('div');tmp.innerHTML=html;
    morphChildren(sec,tmp);
  }
  function morphChildren(from,to){
    var a=[].slice.call(from.childNodes),b=[].slice.call(to.childNodes);
    for(var i=0;i<b.length;i++){
      var x=a[i],y=b[i];
      if(!x){from.appendChild(y.cloneNode(true));continue;}
      if(x.nodeType!==y.nodeType||x.nodeName!==y.nodeName||(x.nodeType===1&&x.getAttribute('data-rc1903-b')!==y.getAttribute('data-rc1903-b'))){from.replaceChild(y.cloneNode(true),x);continue;}
      if(x.nodeType===3||x.nodeType===8){if(x.data!==y.data)x.data=y.data;continue;}
      if(x.nodeType===1){morphAttrs(x,y);if(x.tagName!=='TEXTAREA')morphChildren(x,y);}
    }
    for(var j=a.length-1;j>=b.length;j--)from.removeChild(a[j]);
  }
  function morphAttrs(x,y){
    [].slice.call(x.attributes).forEach(function(at){
      if(at.name==='open'&&x.tagName==='DETAILS')return;
      if(!y.hasAttribute(at.name))x.removeAttribute(at.name);
    });
    [].slice.call(y.attributes).forEach(function(at){if(x.getAttribute(at.name)!==at.value)x.setAttribute(at.name,at.value);});
    if(x.tagName==='INPUT'||x.tagName==='SELECT'||x.tagName==='TEXTAREA'||x.tagName==='BUTTON'){
      if(x.disabled!==y.hasAttribute('disabled'))x.disabled=y.hasAttribute('disabled');
      if(x.tagName!=='SELECT'&&x.tagName!=='BUTTON'&&x.readOnly!==y.hasAttribute('readonly'))x.readOnly=y.hasAttribute('readonly');
    }
  }
  function cssEsc(v){return window.CSS&&CSS.escape?CSS.escape(v):String(v).replace(/["\\]/g,'\\$&');}
  function setVal(mine,old){
    if(mine.type==='checkbox'||mine.type==='radio'){if(mine.checked!==old.checked)mine.checked=old.checked;}
    else if(mine.value!==old.value)mine.value=old.value;
  }
  function syncValues(root){
    all(root,'[data-rc1903-b]').forEach(function(mine){
      if(mine===document.activeElement)return;
      var old=resolve(mine.getAttribute('data-rc1903-b'));if(old)setVal(mine,old);
    });
  }

  /* ---------- Bedienung ---------- */
  function inRoot(t){var root=document.getElementById(ROOT_ID);return root&&t&&t.nodeType===1&&root.contains(t)?root:null;}
  function fire(el,type){el.dispatchEvent(new Event(type,{bubbles:true}));}
  function onClick(ev){
    if(!inRoot(ev.target))return;
    ev.stopPropagation();
    var t=ev.target.closest('[data-rc1903-click],[data-rc1903-file],[data-rc1903-mode],[data-rc1903-classic-focus]');
    if(!t)return;
    if(t.hasAttribute('data-rc1903-mode')){ui.classic=!ui.classic;ui.html={};schedule();return;}
    if(t.hasAttribute('data-rc1903-classic-focus')){
      var f=resolve(t.getAttribute('data-rc1903-classic-focus'));
      ui.classic=true;ui.html={};render();
      /* zweimal, weil sich die bisherige Maske nach dem Umschalten noch neu anordnet */
      if(f)[80,450].forEach(function(ms){setTimeout(function(){try{f.focus({preventScroll:true});var r=f.getBoundingClientRect();window.scrollTo(0,Math.max(0,r.top+window.pageYOffset-240));}catch(_){}},ms);});
      return;
    }
    if(t.disabled)return;
    var old=resolve(t.getAttribute('data-rc1903-click')||t.getAttribute('data-rc1903-file'));
    if(!old){schedule();return;}
    if(old.disabled)return;
    ev.preventDefault();
    old.click();
    schedule();
  }
  function onKey(ev){
    if(ev.key!=='Enter'&&ev.key!==' ')return;
    var t=ev.target;if(!inRoot(t)||t.tagName!=='A'||!t.hasAttribute('data-rc1903-click'))return;
    ev.preventDefault();t.click();
  }
  function forward(ev){
    var t=ev.target;if(!inRoot(t))return;
    ev.stopPropagation();
    if(!t.hasAttribute('data-rc1903-b'))return;
    var old=resolve(t.getAttribute('data-rc1903-b'));
    if(!old){schedule();return;}
    if(old.disabled||old.readOnly){setVal(t,old);return;}
    if(t.type==='checkbox'||t.type==='radio'){
      if(ev.type==='change'&&old.checked!==t.checked)old.click();
      return;
    }
    if(old.tagName==='SELECT'&&old.closest('.rc363-owned-row')&&ev.type==='change'){
      var opt=[].slice.call(old.closest('.rc363-owned-row').querySelectorAll('[data-rc682-packaging-option]')).filter(function(o){return o.getAttribute('data-rc682-packaging-option')===t.value;})[0];
      if(opt){opt.click();schedule();return;}
    }
    if(old.value!==t.value)old.value=t.value;
    if(old.tagName==='SELECT'){if(ev.type==='change'){fire(old,'input');fire(old,'change');}}
    else fire(old,ev.type);
    schedule();
  }
  function onFocusOut(ev){
    var t=ev.target;if(!inRoot(t))return;
    ev.stopPropagation();
    var old=t.hasAttribute&&t.hasAttribute('data-rc1903-b')&&resolve(t.getAttribute('data-rc1903-b'));
    if(old&&old.closest('.rc363-owned-row'))old.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
    schedule();
  }
  function onFocusIn(ev){
    var t=ev.target;
    if(inRoot(t)){ev.stopPropagation();return;}
    if(!active()||!t||!t.closest||!t.closest('#rc363FixedShipmentLayout'))return;
    var root=document.getElementById(ROOT_ID);if(!root)return;
    var mine=root.querySelector('[data-rc1903-b="'+cssEsc(keyOf(t))+'"]');
    if(mine){try{mine.focus({preventScroll:true});mine.scrollIntoView({block:'center',behavior:'smooth'});}catch(_){}}
  }
  function onDrop(ev){
    var t=ev.target;var root=inRoot(t);if(!root)return;
    var zone=t.closest('[data-rc1903-drop]');if(!zone)return;
    if(ev.type==='dragover'||ev.type==='dragenter'){ev.preventDefault();zone.classList.add('is-over');return;}
    if(ev.type==='dragleave'){zone.classList.remove('is-over');return;}
    ev.preventDefault();zone.classList.remove('is-over');
    var old=resolve(zone.getAttribute('data-rc1903-drop'));
    if(!old||old.disabled||!ev.dataTransfer||!ev.dataTransfer.files||!ev.dataTransfer.files.length)return;
    try{old.files=ev.dataTransfer.files;}catch(_){return;}
    fire(old,'change');schedule();
  }

  function schedule(){
    if(ui.scheduled)return;ui.scheduled=true;
    (window.requestAnimationFrame||setTimeout)(function(){ui.scheduled=false;try{render();}catch(e){try{console.error('RC1903',e);}catch(_){}}});
  }

  function start(){
    var c=content();
    if(!c){setTimeout(start,300);return;}
    new MutationObserver(schedule).observe(c,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','disabled','readonly','data-active','data-current-status','aria-invalid','aria-pressed','title']});
    new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-eh-layout','data-eh-newui']});
    window.addEventListener('click',onClick,true);
    window.addEventListener('keydown',onKey,true);
    window.addEventListener('input',forward,true);
    window.addEventListener('change',forward,true);
    window.addEventListener('beforeinput',function(ev){if(inRoot(ev.target))ev.stopPropagation();},true);
    window.addEventListener('focusout',onFocusOut,true);
    window.addEventListener('focusin',onFocusIn,true);
    ['dragenter','dragover','dragleave','drop'].forEach(function(n){window.addEventListener(n,onDrop,true);});
    document.addEventListener('input',function(ev){if(ev.target&&content()&&content().contains(ev.target))schedule();},true);
    document.addEventListener('change',function(ev){if(ev.target&&content()&&content().contains(ev.target))schedule();},true);
    /* Werte, die die bestehende Logik ohne DOM-Änderung setzt (z. B. el.value=…), regelmäßig zurücklesen */
    setInterval(function(){var root=document.getElementById(ROOT_ID);if(root&&active())syncValues(root);},800);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.rc1903NeueErfassung={
    render:render,state:ui,
    /* Für die Schrittnavigation der Steuerleiste (RC1902): Abschnitt der neuen Erfassung zu einem Block */
    section:function(id){if(!active())return null;var root=document.getElementById(ROOT_ID);return root&&root.querySelector('[data-rc1903-section="'+cssEsc(id)+'"]');}
  };
})();
