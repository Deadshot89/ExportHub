(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1315_LOADING_LIST_QUICK_PRINT__)return;
w.__EXPORTHUB_RC1315_LOADING_LIST_QUICK_PRINT__=true;
var lockUntil=0,timer=0,scanTimer=0,lastStatus={text:'',kind:'idle',at:0};
function q(v){return String(v==null?'':v).trim()}
function lang(){return q(d.documentElement&&d.documentElement.lang).toLowerCase().slice(0,2)||'de'}
var I18N={
 de:{title:'Schnelldruck · QR / REF',desc:'QR scannen oder 6-stellige REF eingeben und Enter drücken. Danach startet der Gesamtdruck.',placeholder:'QR scannen oder REF eingeben',button:'Alle Dokumente drucken',ready:'Bereit für QR-Scan oder REF.',printing:'Gesamtdruck für {{ref}} gestartet.',invalid:'Keine gültige 6-stellige REF erkannt.',missing:'Sendung {{ref}} wurde nicht gefunden.',noPrint:'Gesamtdruck ist für diese Sendung nicht verfügbar.'},
 en:{title:'Quick print · QR / REF',desc:'Scan the QR code or enter the 6-character REF and press Enter. The complete print job starts immediately.',placeholder:'Scan QR or enter REF',button:'Print all documents',ready:'Ready for QR scan or REF.',printing:'Complete print for {{ref}} started.',invalid:'No valid 6-character REF detected.',missing:'Shipment {{ref}} was not found.',noPrint:'Complete print is not available for this shipment.'},
 pl:{title:'Szybki wydruk · QR / REF',desc:'Zeskanuj kod QR lub wpisz 6-znakowy REF i naciśnij Enter. Zostanie uruchomiony pełny wydruk.',placeholder:'Zeskanuj QR lub wpisz REF',button:'Drukuj wszystkie dokumenty',ready:'Gotowe do skanowania QR lub REF.',printing:'Uruchomiono pełny wydruk dla {{ref}}.',invalid:'Nie wykryto prawidłowego 6-znakowego REF.',missing:'Nie znaleziono przesyłki {{ref}}.',noPrint:'Pełny wydruk nie jest dostępny dla tej przesyłki.'},
 es:{title:'Impresión rápida · QR / REF',desc:'Escanea el QR o introduce la REF de 6 caracteres y pulsa Enter. Se iniciará la impresión completa.',placeholder:'Escanear QR o introducir REF',button:'Imprimir todos los documentos',ready:'Listo para QR o REF.',printing:'Impresión completa de {{ref}} iniciada.',invalid:'No se detectó una REF válida de 6 caracteres.',missing:'No se encontró el envío {{ref}}.',noPrint:'La impresión completa no está disponible para este envío.'},
 fr:{title:'Impression rapide · QR / REF',desc:'Scannez le QR ou saisissez la REF à 6 caractères puis appuyez sur Entrée. L’impression complète démarre.',placeholder:'Scanner le QR ou saisir la REF',button:'Imprimer tous les documents',ready:'Prêt pour le QR ou la REF.',printing:'Impression complète de {{ref}} lancée.',invalid:'Aucune REF valide à 6 caractères détectée.',missing:'Envoi {{ref}} introuvable.',noPrint:'L’impression complète n’est pas disponible pour cet envoi.'},
 it:{title:'Stampa rapida · QR / REF',desc:'Scansiona il QR oppure inserisci la REF di 6 caratteri e premi Invio. Verrà avviata la stampa completa.',placeholder:'Scansiona QR o inserisci REF',button:'Stampa tutti i documenti',ready:'Pronto per QR o REF.',printing:'Stampa completa per {{ref}} avviata.',invalid:'Nessuna REF valida di 6 caratteri rilevata.',missing:'Spedizione {{ref}} non trovata.',noPrint:'La stampa completa non è disponibile per questa spedizione.'}
};
function t(key,vars){var dict=I18N[lang()]||I18N.de,out=q(dict[key]||I18N.de[key]||key);Object.keys(vars||{}).forEach(function(k){out=out.replace(new RegExp('\\{\\{'+k+'\\}\\}','g'),q(vars[k]))});return out}
function tr(key,fallback){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var v=w.ExportHUBI18n.t(key);if(v&&v!==key)return q(v)}}catch(_){}return q(fallback||key)}
function parseRef(raw){
 var s=q(raw).toUpperCase();
 if(!s)return'';
 var exact=/^(?:EHPRINT|EXPORTHUB-PRINT)\s*:\s*([A-Z0-9]{6})$/.exec(s);if(exact)return exact[1];
 try{var u=new URL(s,w.location&&w.location.href||undefined),p=q(u.searchParams.get('printRef')||u.searchParams.get('ref')).toUpperCase();if(/^[A-Z0-9]{6}$/.test(p))return p}catch(_){}
 if(/^[A-Z0-9]{6}$/.test(s))return s;
 var tagged=/(?:EHPRINT|EXPORTHUB-PRINT)\s*:\s*([A-Z0-9]{6})/i.exec(s);if(tagged)return tagged[1].toUpperCase();
 var hit=s.match(/(?:^|[^A-Z0-9])([A-Z0-9]{6})(?:[^A-Z0-9]|$)/);return hit?hit[1].toUpperCase():''
}
function panel(){return d.getElementById('rc1283LoadListSearch')}
function selectFor(p){return p&&p.__rc1283Select||Array.from(d.querySelectorAll('select')).find(function(sel){var txt=q([sel.getAttribute('aria-label'),sel.name,sel.id,sel.closest&&sel.closest('label')&&sel.closest('label').textContent].join(' '));return /sendung\s*ausw[aä]hlen|shipment\s*(?:select|choose)/i.test(txt)})||null}
function refIn(text,ref){text=q(text).toUpperCase();return text===ref||new RegExp('(?:^|[^A-Z0-9])'+ref+'(?:[^A-Z0-9]|$)').test(text)}
function findOption(sel,ref){return Array.from(sel&&sel.options||[]).find(function(opt){return refIn(opt.value,ref)||refIn(opt.textContent,ref)})||null}
function dispatchSelection(sel,opt){if(!sel||!opt)return false;sel.value=opt.value;if(sel.value!==opt.value)sel.selectedIndex=Array.from(sel.options||[]).indexOf(opt);try{sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){var ev=d.createEvent('Event');ev.initEvent('change',true,true);sel.dispatchEvent(ev)}return true}
function printAllButton(){return d.querySelector('[data-index352-action="print-all"]')||Array.from(d.querySelectorAll('button,a,[role="button"]')).find(function(el){return !el.disabled&&/Gesamtausgabe\s*drucken|Gesamtdruck|Print\s*all|Complete\s*print/i.test(q(el.textContent))})||null}
function status(text,kind){text=q(text);kind=kind||'idle';lastStatus={text:text,kind:kind,at:Date.now()};var el=d.querySelector('[data-rc1315-status]');if(!el)return;el.textContent=text;el.setAttribute('data-state',kind)}
function syncSearch(p,ref,opt){var search=p&&p.querySelector('[data-rc1283-search]');if(search){search.value=ref;try{search.dispatchEvent(new Event('input',{bubbles:true}))}catch(_){}}var result=p&&p.querySelector('[data-rc1283-result="'+String(opt&&opt.value||'').replace(/"/g,'\\"')+'"]');if(result&&typeof result.click==='function')try{result.click()}catch(_){}}
function trigger(raw){
 var ref=parseRef(raw),now=Date.now();if(!ref){status(t('invalid'),'error');return false}if(now<lockUntil)return false;
 var p=panel(),sel=selectFor(p);if(!p||!sel){status(t('missing',{ref:ref}),'error');return false}
 var opt=findOption(sel,ref);if(!opt){status(t('missing',{ref:ref}),'error');return false}
 lockUntil=now+1200;
 dispatchSelection(sel,opt);
 syncSearch(p,ref,opt);
 var btn=printAllButton();
 if(btn&&typeof btn.click==='function'){status(t('printing',{ref:ref}),'ok');btn.click();return true}
 status(t('noPrint'),'error');
 return false
}
function style(){
 if(d.getElementById('exporthub-rc1315-quick-print-style'))return;
 var s=d.createElement('style');s.id='exporthub-rc1315-quick-print-style';s.textContent=
 '.rc1315-quick-print{margin-top:14px;padding:14px;border:1px solid #bfdbfe;border-radius:14px;background:linear-gradient(135deg,#eff6ff,#f8fbff)}'+
 '.rc1315-quick-print-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.rc1315-quick-print h4{margin:0;color:#0f2942;font-size:.98rem}.rc1315-quick-print p{margin:4px 0 0;color:#475569;font-size:.82rem;line-height:1.4}'+
 '.rc1315-quick-print-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:10px}.rc1315-quick-print input{box-sizing:border-box;width:100%;min-height:46px;padding:10px 12px;border:1px solid #93c5fd;border-radius:10px;background:#fff;color:#0f172a;font-size:16px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;outline:none}.rc1315-quick-print input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.13)}'+
 '.rc1315-quick-print button{min-height:46px;padding:9px 14px;border:0;border-radius:10px;background:#1d4ed8;color:#fff;font-weight:800;cursor:pointer}.rc1315-quick-print button:hover{background:#1e40af}.rc1315-quick-print-status{margin-top:8px!important;font-weight:700!important}.rc1315-quick-print-status[data-state="ok"]{color:#166534!important}.rc1315-quick-print-status[data-state="error"]{color:#b91c1c!important}.rc1315-quick-print-tools{display:flex;justify-content:flex-end;margin-top:8px}.rc1315-direct-print-setup{font-size:.78rem;font-weight:700;color:#1d4ed8;text-decoration:none}.rc1315-direct-print-setup:hover{text-decoration:underline}'+
 '@media(max-width:680px){.rc1315-quick-print-row{grid-template-columns:1fr}.rc1315-quick-print button{width:100%}}';
 (d.head||d.documentElement).appendChild(s)
}
function install(){
 var p=panel();if(!p)return false;if(p.querySelector('[data-rc1315-quick-print]'))return true;style();
 var box=d.createElement('section');box.className='rc1315-quick-print';box.setAttribute('data-rc1315-quick-print','1');
 var head=d.createElement('div');head.className='rc1315-quick-print-head';head.innerHTML='<div><h4>'+t('title')+'</h4><p>'+t('desc')+'</p></div>';box.appendChild(head);
 var row=d.createElement('div');row.className='rc1315-quick-print-row';var input=d.createElement('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label',t('placeholder'));input.setAttribute('data-rc1315-input','1');input.placeholder=t('placeholder');var button=d.createElement('button');button.type='button';button.textContent=t('button');button.setAttribute('data-rc1315-print','1');row.appendChild(input);row.appendChild(button);box.appendChild(row);
 var s=d.createElement('p');s.className='rc1315-quick-print-status';s.setAttribute('data-rc1315-status','1');var keep=lastStatus.text&&Date.now()-lastStatus.at<8000;s.setAttribute('data-state',keep?lastStatus.kind:'idle');s.textContent=keep?lastStatus.text:t('ready');box.appendChild(s);
 var tools=d.createElement('div');tools.className='rc1315-quick-print-tools';var setup=d.createElement('a');setup.className='rc1315-direct-print-setup';setup.href='/assets/tools/ExportHUB-DirectPrint-Setup.ps1';setup.download='ExportHUB-DirectPrint-Setup.ps1';setup.setAttribute('data-rc1322-direct-print-setup','1');setup.title=tr('loadingListQuickPrint.directPrintSetupHint',t('title'));setup.textContent=tr('loadingListQuickPrint.directPrintSetup',t('title'));tools.appendChild(setup);box.appendChild(tools);
 var search=p.querySelector('[data-rc1283-search]');p.insertBefore(box,search||p.children[1]||null);
 input.addEventListener('input',function(){var raw=q(input.value).toUpperCase();if(!/^(?:EHPRINT|EXPORTHUB-PRINT)\s*:\s*[A-Z0-9]{6}$/.test(raw))return;if(scanTimer&&typeof w.clearTimeout==='function')w.clearTimeout(scanTimer);scanTimer=w.setTimeout(function(){scanTimer=0;trigger(input.value);try{input.focus();input.select()}catch(_){}},80)});
 input.addEventListener('keydown',function(e){if(e.key!=='Enter')return;e.preventDefault();if(scanTimer&&typeof w.clearTimeout==='function'){w.clearTimeout(scanTimer);scanTimer=0}trigger(input.value);input.select()});
 button.addEventListener('click',function(){trigger(input.value);input.focus();input.select()});
 if(typeof w.setTimeout==='function')w.setTimeout(function(){try{input.focus();input.select()}catch(_){}},0);
 return true
}
function schedule(){if(timer)w.clearTimeout(timer);timer=w.setTimeout(function(){timer=0;install()},30)}
w.ExportHUBRC1315QuickPrint=Object.freeze({version:'RC1322',parseRef:parseRef,trigger:trigger,install:install});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:shipment-saved'].forEach(function(name){w.addEventListener(name,schedule)});
if(w.MutationObserver&&d.documentElement)new MutationObserver(function(){schedule()}).observe(d.documentElement,{subtree:true,childList:true});
})(window,document);
