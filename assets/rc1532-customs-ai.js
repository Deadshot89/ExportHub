(function(root){
'use strict';
if(!root||root.ExportHUBRC1532CustomsAI)return;

var d=root.document,observer=null,timer=0,busy=false;
function q(value){return String(value==null?'':value).trim()}
function featureI18n(){try{return root.ExportHUBRC1532I18n&&typeof root.ExportHUBRC1532I18n.t==='function'?root.ExportHUBRC1532I18n:null}catch(_){return null}}
function lang(){
 try{var i=featureI18n();if(i&&typeof i.language==='function')return i.language()}catch(_){}
 try{var raw=root.ExportHUBI18n&&root.ExportHUBI18n.language?root.ExportHUBI18n.language():'de';raw=q(raw).toLowerCase().slice(0,2);return /^(?:de|en|pl|es|fr|it)$/.test(raw)?raw:'de'}catch(_){return'de'}
}
function tr(key,vars){try{var i=featureI18n();if(i)return i.t(key,lang(),vars)}catch(_){}return String(key||'')}
function ensureFeatureI18n(){
 if(featureI18n())return true;
 if(!d||!d.createElement)return false;
 if(d.getElementById('exporthub-rc1532-i18n'))return false;
 try{
  var s=d.createElement('script');s.id='exporthub-rc1532-i18n';s.src='/assets/i18n/rc1532-customs-ai.js?v=1532';s.defer=true;
  s.addEventListener('load',schedule,{once:true});
  s.addEventListener('error',function(){try{s.remove()}catch(_){}},{once:true});
  (d.head||d.documentElement).appendChild(s);return false
 }catch(_){return false}
}
function authToken(){
 try{var rt=root.ExportHUBClean&&root.ExportHUBClean.runtime||{},token=q(rt.authToken||rt.sessionToken);if(token)return token}catch(_){}
 try{for(var i=0;root.sessionStorage&&i<root.sessionStorage.length;i++){var raw=root.sessionStorage.getItem(root.sessionStorage.key(i));if(!raw||raw.charAt(0)!=='{')continue;var parsed=JSON.parse(raw);if(parsed&&parsed.token)return q(parsed.token)}}catch(_){}
 return''
}
function environment(){try{return /-testservice\./i.test(String(root.location&&root.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
function headers(){var token=authToken(),out={'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Environment':environment(),'X-ExportHUB-Language':lang()};if(token){out['X-ExportHUB-Token']=token;out['X-ExportHUB-Session']=token;out.Authorization='Bearer '+token}return out}
function panel(){return d&&d.getElementById&&d.getElementById('rc1294AbdAnalysis')}
function latestSnapshot(){
 try{
  var api=root.ExportHUBRC1294ABDAnalysis;if(!api||typeof api.snapshot!=='function')return null;
  var results=d&&d.querySelector&&d.querySelector('[data-rc1294-results]'),docs=results&&results.querySelectorAll?results.querySelectorAll('.rc1294-document'):[],last=null;
  if(docs&&docs.length){for(var i=0;i<docs.length;i++){var item=api.snapshot(i);if(item)last=item}return last}
  for(var index=0;index<50;index++){var snapshot=api.snapshot(index);if(!snapshot)break;last=snapshot}
  return last
 }catch(_){return null}
}
/* Nur bei echter Änderung schreiben: jeder textContent-Schreibvorgang ist eine childList-Mutation und weckt den eigenen Observer erneut. */
function setText(node,text){text=String(text==null?'':text);if(node.textContent!==text)node.textContent=text}
function el(tag,className,text){var node=d.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node}
function clear(node){while(node&&node.firstChild)node.removeChild(node.firstChild)}
function formatContext(snapshot){
 var header=snapshot&&snapshot.header||{},review=snapshot&&snapshot.review||{},groups=Array.isArray(snapshot&&snapshot.groups)?snapshot.groups:[],parts=[];
 if(q(header.invoiceNumber))parts.push(tr('contextInvoice',{number:q(header.invoiceNumber)}));
 if(q(header.destinationCountry))parts.push(q(header.destinationCountry));
 if(groups.length)parts.push(tr('contextGroups',{count:groups.length}));
 if(Number(review.unassignedCount)>0)parts.push(tr('contextOpen',{count:Number(review.unassignedCount)}));
 return parts.join(' · ')
}
function refreshContext(){var box=d.querySelector('[data-rc1532-context]');if(!box)return;var snapshot=latestSnapshot(),value=formatContext(snapshot);setText(box,value||tr('noContext'));if(box.classList.contains('is-empty')!==!value)box.classList.toggle('is-empty',!value)}
function renderSources(host,result){
 clear(host);var sources=Array.isArray(result&&result.sources)?result.sources:[];
 if(result&&result.evidence==='invoice-analysis'){var local=el('div','rc1532-source rc1532-source-local');local.appendChild(el('strong','',tr('analysis')));host.appendChild(local)}
 sources.forEach(function(source,index){
  var card=el('div','rc1532-source'),link=el('a','',q(source.title)||q(source.sourceName)||source.id||tr('sources'));
  card.id=sourceAnchorId(source.id);
  link.href=q(source.sourceUrl)||'#';link.target='_blank';link.rel='noopener noreferrer';
  card.appendChild(el('span','rc1532-source-index','['+(index+1)+']'));card.appendChild(link);
  var meta=[];if(q(source.sourceName))meta.push(q(source.sourceName));if(q(source.checkedAt))meta.push(tr('checked')+': '+q(source.checkedAt));
  if(meta.length)card.appendChild(el('div','rc1532-source-meta',meta.join(' · ')));
  host.appendChild(card)
 });
 if(!sources.length&&!(result&&result.evidence==='invoice-analysis'))host.appendChild(el('div','rc1532-source-empty',tr('noSources')))
}
/* Sicheres Rendering: nur DOM-Textknoten und begrenzte Markdown-Abschnitte, niemals Modell-HTML. */
/* Zitierverweise verlinken nur bereits serverseitig validierte Quellen; kein Modell-HTML. */
function sourceAnchorId(id){return 'rc1532-cite-'+String(id||'').replace(/[^A-Za-z0-9_-]/g,'-')}
function appendAnswerInline(node,line,citations){
 var parts=String(line||'').split(/(\*\*[^*\n]+\*\*|\[\[[A-Za-z0-9._:-]{1,48}\]\])/g);
 for(var i=0;i<parts.length;i++){
  var part=parts[i];if(!part)continue;
  if(/^\*\*[^*]+\*\*$/.test(part)){node.appendChild(el('strong','',part.slice(2,-2)));continue}
  var marker=part.match(/^\[\[([A-Za-z0-9._:-]{1,48})\]\]$/),source=marker&&citations[marker[1]];
  if(marker){
   if(source){var link=el('a','rc1532-citation','['+source.number+']');link.href='#'+source.id;link.setAttribute('aria-label',tr('sources')+' '+source.number);node.appendChild(link)}
   else node.appendChild(d.createTextNode('[?]'));
   continue
  }
  node.appendChild(d.createTextNode(part))
 }
}
function renderAnswer(host,raw,sources){
 clear(host);
 var citations=Object.create(null),rows=Array.isArray(sources)?sources:[];
 for(var j=0;j<rows.length;j++){var source=rows[j]||{},id=q(source.id);if(id)citations[id]={number:j+1,id:sourceAnchorId(id)}}
 var lines=String(raw||'').replace(/\r\n?/g,'\n').split('\n'),paragraph=null,list=null,listType='';
 for(var i=0;i<lines.length;i++){
  var line=q(lines[i]);if(!line){paragraph=null;list=null;listType='';continue}
  var heading=line.match(/^#{1,3}\s+(.+)$/);
  if(heading){
   paragraph=null;list=null;listType='';
   var h=el('h6','rc1532-answer-section');appendAnswerInline(h,heading[1],citations);host.appendChild(h);continue
  }
  var bullet=line.match(/^(?:[-*]\s+|\d+[.)]\s+)(.+)$/);
  if(bullet){
   paragraph=null;
   var kind=/^\d+[.)]\s+/.test(line)?'ol':'ul';
   if(!list||kind!==listType){list=d.createElement(kind);list.className='rc1532-answer-list';host.appendChild(list);listType=kind}
   var li=d.createElement('li');appendAnswerInline(li,bullet[1],citations);list.appendChild(li);continue
  }
  list=null;listType='';
  if(!paragraph){paragraph=el('p','rc1532-answer-paragraph');host.appendChild(paragraph)}
  else paragraph.appendChild(d.createTextNode(' '));
  appendAnswerInline(paragraph,line,citations)
 }
}
function renderResult(result){
 var answer=d.querySelector('[data-rc1532-answer]'),sourceBox=d.querySelector('[data-rc1532-sources]'),badge=d.querySelector('[data-rc1532-badge]'),checked=d.querySelector('[data-rc1532-checked]');if(!answer||!sourceBox)return;
 renderAnswer(answer,q(result&&result.answer)||tr('error'),result&&result.sources);
 var uncertain=!!(result&&(result.uncertainty||result.ok===false));badge.textContent=uncertain?tr('uncertain'):tr('grounded');badge.className='rc1532-badge '+(uncertain?'is-warning':'is-ok');
 checked.textContent=q(result&&result.checkedAt)?tr('checked')+': '+q(result.checkedAt):'';
 renderSources(sourceBox,result||{});
 answer.parentNode.hidden=false
}
async function ask(question){
 if(busy)return;question=q(question);if(!question)return;
 busy=true;var button=d.querySelector('[data-rc1532-ask]'),status=d.querySelector('[data-rc1532-status]');if(button)button.disabled=true;if(status){status.hidden=false;status.textContent=tr('working');status.className='rc1532-status'};
 try{
  var snapshot=latestSnapshot(),header=snapshot&&snapshot.header||{},payload={question:question,reference:q(header.reference||header.ref),destinationCountry:q(header.destinationCountry),invoiceAnalysis:snapshot||{}};
  var response=await root.fetch('/api/customs-ai',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify(payload)}),raw=await response.text(),body={};
  try{body=raw?JSON.parse(raw):{}}catch(_){body={ok:false,answer:raw}}
  if(!response.ok){body.ok=false;if(!body.answer)body.answer='HTTP '+response.status}
  renderResult(body);if(status){status.hidden=true;status.textContent=''}
 }catch(error){renderResult({ok:false,uncertainty:true,answer:q(error&&error.message)||tr('error'),sources:[]});if(status){status.hidden=true;status.textContent=''}}
 finally{busy=false;if(button)button.disabled=false;refreshContext()}
}
/* Der historische Tab „Zollwissen → KI fragen“ ist ein reiner Offline-Suchassistent.
 * Nur kuratierte Incoterms-Fälle werden hier übersteuert. Keine zusätzlichen Provider-Aufrufe.
 * Andere Fragen bleiben am bisherigen Offline-Handler. */
function legacyIncotermsAnswer(raw){
 var question=q(raw),lower=question.toLowerCase(),matches=lower.match(/\b(?:exw|fca|dap|ddp)\b/g)||[],types=Array.from(new Set(matches));
 if(/\bab\s*werk\b/.test(lower)&&!types.includes('exw'))types.push('exw');
 if(!types.length)return null;
 var type=types[0];
 var labels={
  exw:{name:'EXW (Ab Werk)',organization:'Der Käufer organisiert und bezahlt grundsätzlich die Ausfuhrformalitäten.',cost:'Grundsätzlich Käufer, soweit nichts Abweichendes vereinbart wurde.',check:'Klären, wer die Ausfuhranmeldung veranlasst und welcher EU-ansässige Beteiligte rechtlich Ausführer sein kann.'},
  fca:{name:'FCA (Frei Frachtführer)',organization:'Der Verkäufer organisiert und bezahlt grundsätzlich die Ausfuhrfreimachung.',cost:'Grundsätzlich Verkäufer für die Ausfuhrformalitäten; der Käufer trägt die Einfuhrabwicklung.',check:'Zulässigen EU-Ausführer und Anmelder/Vertreter sowie den benannten FCA-Lieferort prüfen.'},
  dap:{name:'DAP (Geliefert benannter Ort)',organization:'Der Verkäufer organisiert die Ausfuhrformalitäten; der Käufer übernimmt die Einfuhrabfertigung.',cost:'Verkäufer für die Ausfuhr, Käufer für Einfuhrformalitäten und Einfuhrabgaben.',check:'Ausfuhrfreigabe, benannten Bestimmungsort und Zuständigkeit für die Einfuhr prüfen.'},
  ddp:{name:'DDP (Geliefert verzollt)',organization:'Der Verkäufer übernimmt vertraglich sowohl Ausfuhr- als auch Einfuhrformalitäten.',cost:'Grundsätzlich Verkäufer einschließlich Einfuhrabgaben.',check:'Besonders prüfen, ob der Verkäufer im Bestimmungsland rechtlich die Einfuhrabfertigung vornehmen lassen darf.'}
 };
 var item=labels[type],icc='legacy-incoterms-icc',eu='legacy-incoterms-eu',decl='legacy-incoterms-anmelder';
 if(types.length>1){
  var compared=['## Kurzantwort','Die genannten Incoterms unterscheiden sich bei den Zollformalitäten:'];
  types.forEach(function(code){var rule=labels[code];compared.push('- **'+rule.name+':** '+rule.organization+' [['+icc+']].')});
  compared.push('','## Was gilt unabhängig von der Klausel?','- **EU-Ausführer:** Die zollrechtlich zulässige Person muss gesondert geprüft werden. [['+eu+']].','- **Anmelder:** Anmeldung durch den Anmelder oder einen Zollvertreter; Kosten nach der vereinbarten Klausel und ergänzenden Abreden. [['+decl+']].','', '## Vorgehen im Warenausgang','1. Vereinbarte Incoterms-Klausel und benannten Ort verbindlich feststellen.','2. EU-Ausführer, Anmelder und mögliche Zollvertretung bestimmen.','3. Erforderliche Zollüberlassung und Dokumente vor Versand prüfen.');
  return{ok:true,mode:'offline-rule',answer:compared.join('\n'),uncertainty:true,checkedAt:'2026-11-04',sources:[
    {id:icc,title:'ICC – Incoterms 2020 / Export Clearance',sourceName:'International Chamber of Commerce',sourceUrl:'https://iccwbo.org/wp-content/uploads/sites/3/2025/04/2025.04_Using_Incoterms_to-Manage_Tariff_Risks.pdf',checkedAt:'2026-11-04'},
    {id:eu,title:'EU-Kommission – Wer ist Ausführer?',sourceName:'Europäische Kommission',sourceUrl:'https://taxation-customs.ec.europa.eu/document/download/5943739d-85d5-4e82-b2bd-fe1b8f7a8403_en',checkedAt:'2026-11-04'},
    {id:decl,title:'AEAT – Wer gibt die Ausfuhranmeldung ab?',sourceName:'Spanische Zollverwaltung (EU-Rechtsgrundlagen)',sourceUrl:'https://sede.agenciatributaria.gob.es/Sede/en_gb/aduanas/entrada-salida-mercancias/exportacion/sistema-electronico-exportacion-aes-p1.html?faqId=751cb74473cb7810VgnVCM100000dc381e0aRCRD',checkedAt:'2026-11-04'}]}
 }
 var answer=[
  '## Kurzantwort',
  'Bei **'+item.name+'** gilt: '+item.organization+' [['+icc+']].',
  '',
  '## Wer macht was?',
  '- **Organisation und Kosten:** '+item.cost+' [['+icc+']].',
  '- **Zollrechtlicher EU-Ausführer:** Unabhängig vom Incoterm anhand der EU-Regeln festlegen; allein der deutsche Versender ist nicht automatisch Ausführer. [['+eu+']].',
  '- **Anmelder/Vertreter:** Die elektronische Zollanmeldung kann der zuständige Anmelder oder ein beauftragter Zollvertreter abgeben. [['+decl+']].',
  '',
  '## Vorgehen im Warenausgang',
  '1. '+item.check,
  '2. Prüfen, ob für diese Sendung eine elektronische Ausfuhranmeldung erforderlich ist.',
  '3. Falls erforderlich: Überlassung zur Ausfuhr und zugehörige MRN/ABD vor Freigabe kontrollieren; Ausgangsnachweis später sichern.',
  '',
  '## Noch zu klären',
  '- Wer ist als EU-Ausführer zulässig, wer beauftragt die Zollagentur und welche Vertragsabreden gelten?'
 ].join('\n');
 return{ok:true,mode:'offline-rule',answer:answer,uncertainty:true,checkedAt:'2026-11-04',
  sources:[
   {id:icc,title:'ICC – Incoterms 2020 / Export Clearance',sourceName:'International Chamber of Commerce',sourceUrl:'https://iccwbo.org/wp-content/uploads/sites/3/2025/04/2025.04_Using_Incoterms_to-Manage_Tariff_Risks.pdf',checkedAt:'2026-11-04'},
   {id:eu,title:'EU-Kommission – Wer ist Ausführer?',sourceName:'Europäische Kommission',sourceUrl:'https://taxation-customs.ec.europa.eu/document/download/5943739d-85d5-4e82-b2bd-fe1b8f7a8403_en',checkedAt:'2026-11-04'},
    {id:decl,title:'AEAT – Wer gibt die Ausfuhranmeldung ab?',sourceName:'Spanische Zollverwaltung (EU-Rechtsgrundlagen)',sourceUrl:'https://sede.agenciatributaria.gob.es/Sede/en_gb/aduanas/entrada-salida-mercancias/exportacion/sistema-electronico-exportacion-aes-p1.html?faqId=751cb74473cb7810VgnVCM100000dc381e0aRCRD',checkedAt:'2026-11-04'}
  ]}
}
function legacyCustomsIntercept(event){
 var target=event&&event.target,button=target&&target.closest&&target.closest('#rc821ZollBody button[onclick="askZollAi()"]');
 if(!button)return;
 var area=d.getElementById('zollAiQuestion'),host=d.getElementById('zollAiAnswer'),result=legacyIncotermsAnswer(area&&area.value);
 if(!host||!result)return;
 event.preventDefault();event.stopImmediatePropagation();
 clear(host);host.classList.add('rc1532-legacy-answer');
 host.appendChild(el('div','rc1532-legacy-notice','Offline-Schnellhilfe aus geprüften Quellen · keine Live-Zollfreigabe'));
 var answer=el('div','rc1532-answer');renderAnswer(answer,result.answer,result.sources);host.appendChild(answer);
 host.appendChild(el('h6','rc1532-legacy-sources-heading',tr('sources')));
 var sources=el('div','rc1532-sources');renderSources(sources,result);host.appendChild(sources)
}
function show(active){var ai=d.querySelector('[data-rc1532-ai-panel]');if(ai)ai.hidden=!active;if(active)refreshContext()}
function bindModes(host,button){
 if(button.__rc1532Bound)return;button.__rc1532Bound=true;
 button.addEventListener('click',function(){try{var api=root.ExportHUBRC1294ABDAnalysis;if(api&&typeof api.setMode==='function')api.setMode('ai')}catch(_){}show(true)});
 var others=host.querySelectorAll('[data-rc1294-mode]');for(var i=0;i<others.length;i++){if(others[i]===button||others[i].__rc1532HideBound)continue;others[i].__rc1532HideBound=true;others[i].addEventListener('click',function(){show(false)})}
}
function mount(){
 if(!d)return false;if(!featureI18n()){ensureFeatureI18n();return false}
 var host=panel();if(!host)return false;var router=host.querySelector('.rc1294-router');if(!router)return false;
 var button=host.querySelector('[data-rc1532-ai-tab]');
 if(!button){button=d.createElement('button');button.type='button';button.setAttribute('data-rc1294-mode','ai');button.setAttribute('data-rc1532-ai-tab','');button.setAttribute('aria-pressed','false');button.textContent=tr('tab');router.appendChild(button)}else setText(button,tr('tab'));
 var ai=host.querySelector('[data-rc1532-ai-panel]');
 if(!ai){
  ai=el('section','rc1532-ai');ai.setAttribute('data-rc1532-ai-panel','');ai.hidden=true;
  var head=el('div','rc1532-ai-head'),copy=el('div','rc1532-ai-copy');copy.appendChild(el('h4','',tr('title')));copy.appendChild(el('p','',tr('subtitle')));head.appendChild(copy);head.appendChild(el('span','rc1532-advisory',tr('advisory')));ai.appendChild(head);
  var contextCard=el('div','rc1532-context-card');contextCard.appendChild(el('span','rc1532-label',tr('context')));var contextValue=el('strong','rc1532-context-value');contextValue.setAttribute('data-rc1532-context','');contextCard.appendChild(contextValue);ai.appendChild(contextCard);
  var form=el('div','rc1532-form'),label=el('label','rc1532-label',tr('question')),textarea=d.createElement('textarea');textarea.rows=4;textarea.maxLength=2000;textarea.placeholder=tr('placeholder');textarea.setAttribute('data-rc1532-question','');label.appendChild(textarea);form.appendChild(label);
  var quick=el('div','rc1532-quick');['quickHs','quickOpen','quickSum','quickOrigin'].forEach(function(key){var chip=el('button','rc1532-chip',tr(key));chip.type='button';chip.addEventListener('click',function(){textarea.value=tr(key);textarea.focus()});quick.appendChild(chip)});form.appendChild(quick);
  var askButton=el('button','rc1532-ask',tr('ask'));askButton.type='button';askButton.setAttribute('data-rc1532-ask','');askButton.addEventListener('click',function(){ask(textarea.value)});textarea.addEventListener('keydown',function(event){if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();ask(textarea.value)}});form.appendChild(askButton);ai.appendChild(form);
  var status=el('div','rc1532-status');status.setAttribute('data-rc1532-status','');status.setAttribute('role','status');status.hidden=true;ai.appendChild(status);
  var result=el('div','rc1532-result');result.hidden=true;var resultHead=el('div','rc1532-result-head');resultHead.appendChild(el('h5','',tr('answer')));var meta=el('div','rc1532-result-meta'),badge=el('span','rc1532-badge');badge.setAttribute('data-rc1532-badge','');meta.appendChild(badge);var checked=el('span','rc1532-checked');checked.setAttribute('data-rc1532-checked','');meta.appendChild(checked);resultHead.appendChild(meta);result.appendChild(resultHead);var answer=el('div','rc1532-answer');answer.setAttribute('data-rc1532-answer','');answer.setAttribute('aria-live','polite');result.appendChild(answer);result.appendChild(el('h6','',tr('sources')));var sources=el('div','rc1532-sources');sources.setAttribute('data-rc1532-sources','');result.appendChild(sources);ai.appendChild(result);
  var invoicePanel=host.querySelector('[data-rc1294-invoice-panel]');if(invoicePanel&&invoicePanel.parentNode)invoicePanel.parentNode.insertBefore(ai,invoicePanel.nextSibling);else host.appendChild(ai)
 }
 bindModes(host,button);refreshContext();return true
}
function schedule(){if(timer)return;timer=root.setTimeout?root.setTimeout(function(){timer=0;mount()},0):0;if(!root.setTimeout)mount()}
function observe(){if(!d||!root.MutationObserver)return;var host=d.getElementById('rc626Abd')||d.body;if(!host)return;try{if(observer)observer.disconnect();observer=new root.MutationObserver(schedule);observer.observe(host,{childList:true,subtree:true})}catch(_){}}
function remount(){schedule();observe()}
function remountLanguage(){try{var ai=d&&d.querySelector&&d.querySelector('[data-rc1532-ai-panel]');if(ai&&ai.parentNode)ai.parentNode.removeChild(ai)}catch(_){}schedule()}
if(d&&typeof d.addEventListener==='function')d.addEventListener('click',legacyCustomsIntercept,true);
root.ExportHUBRC1532CustomsAI=Object.freeze({mount:mount,ask:ask,latestSnapshot:latestSnapshot});
ensureFeatureI18n();mount();observe();
if(typeof root.addEventListener==='function'){
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(name){root.addEventListener(name,remount)});
 root.addEventListener('exporthub:language-changed',remountLanguage)
}
})(typeof window!=='undefined'?window:globalThis);
