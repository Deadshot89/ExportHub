(function(root){
'use strict';
if(!root||root.ExportHUBRC1532CustomsAI)return;

var d=root.document,observer=null,timer=0,busy=false;
var I18N={
 de:{tab:'KI-Zollexperte',title:'KI-Zollexperte',subtitle:'Beratende Zollhilfe mit geprüften Quellen und direktem Rechnungs-Kontext.',advisory:'Beratend · keine automatische Änderung an ABD, Sendung oder Aufgabe',context:'Aktueller Kontext',noContext:'Keine Rechnungsanalyse aktiv. Allgemeine Zollfragen sind trotzdem möglich.',question:'Zollfrage',placeholder:'z. B. Welche Präferenzregel muss ich für die Schweiz prüfen?',ask:'Frage prüfen',working:'Prüfe Analyse und Quellen …',answer:'Antwort',sources:'Quellen',checked:'Prüfstand',uncertain:'Prüfung erforderlich',grounded:'Belegt',analysis:'Aktuelle Rechnungsanalyse',provider:'KI-Dienst',noSources:'Keine externen Quellen zitiert.',error:'Die Zollfrage konnte nicht verarbeitet werden.',quickHs:'Welche HS-Codes sind in der Rechnung?',quickOpen:'Welche Positionen sind noch ungeklärt?',quickSum:'Stimmt die Kontrollsumme mit der Rechnungssumme?',quickOrigin:'Welche Ursprungsländer sind enthalten?'},
 en:{tab:'AI Customs Expert',title:'AI Customs Expert',subtitle:'Advisory customs help with reviewed sources and current invoice context.',advisory:'Advisory only · no automatic changes to export declarations, shipments or tasks',context:'Current context',noContext:'No invoice analysis is active. General customs questions are still available.',question:'Customs question',placeholder:'e.g. Which preference rule should I check for Switzerland?',ask:'Check question',working:'Checking analysis and sources …',answer:'Answer',sources:'Sources',checked:'Checked',uncertain:'Review required',grounded:'Grounded',analysis:'Current invoice analysis',provider:'AI service',noSources:'No external sources cited.',error:'The customs question could not be processed.',quickHs:'Which HS codes are in the invoice?',quickOpen:'Which positions are still unresolved?',quickSum:'Does the control total match the invoice total?',quickOrigin:'Which origin countries are included?'},
 pl:{tab:'Ekspert AI ds. ceł',title:'Ekspert AI ds. ceł',subtitle:'Doradcza pomoc celna z weryfikowanymi źródłami i kontekstem faktury.',advisory:'Tylko doradztwo · bez automatycznych zmian w zgłoszeniu, wysyłce lub zadaniu',context:'Bieżący kontekst',noContext:'Brak aktywnej analizy faktury. Nadal można zadawać ogólne pytania celne.',question:'Pytanie celne',placeholder:'np. Jaką regułę preferencji sprawdzić dla Szwajcarii?',ask:'Sprawdź pytanie',working:'Sprawdzam analizę i źródła …',answer:'Odpowiedź',sources:'Źródła',checked:'Sprawdzono',uncertain:'Wymaga sprawdzenia',grounded:'Potwierdzone',analysis:'Bieżąca analiza faktury',provider:'Usługa AI',noSources:'Brak cytowanych źródeł zewnętrznych.',error:'Nie udało się przetworzyć pytania celnego.',quickHs:'Jakie kody HS są na fakturze?',quickOpen:'Które pozycje są jeszcze niewyjaśnione?',quickSum:'Czy suma kontrolna zgadza się z sumą faktury?',quickOrigin:'Jakie kraje pochodzenia występują?'},
 es:{tab:'Experto aduanero IA',title:'Experto aduanero IA',subtitle:'Asistencia aduanera consultiva con fuentes verificadas y contexto de factura.',advisory:'Solo asesoramiento · sin cambios automáticos en declaraciones, envíos o tareas',context:'Contexto actual',noContext:'No hay un análisis de factura activo. Las preguntas aduaneras generales siguen disponibles.',question:'Pregunta aduanera',placeholder:'p. ej. ¿Qué regla preferencial debo comprobar para Suiza?',ask:'Comprobar pregunta',working:'Comprobando análisis y fuentes …',answer:'Respuesta',sources:'Fuentes',checked:'Revisado',uncertain:'Requiere revisión',grounded:'Verificado',analysis:'Análisis actual de factura',provider:'Servicio IA',noSources:'No se citaron fuentes externas.',error:'No se pudo procesar la pregunta aduanera.',quickHs:'¿Qué códigos HS contiene la factura?',quickOpen:'¿Qué posiciones siguen sin resolver?',quickSum:'¿Coincide la suma de control con el total de factura?',quickOrigin:'¿Qué países de origen aparecen?'},
 fr:{tab:'Expert douane IA',title:'Expert douane IA',subtitle:'Aide douanière consultative avec sources vérifiées et contexte de facture.',advisory:'Conseil uniquement · aucune modification automatique des déclarations, expéditions ou tâches',context:'Contexte actuel',noContext:'Aucune analyse de facture active. Les questions douanières générales restent possibles.',question:'Question douanière',placeholder:'ex. Quelle règle préférentielle vérifier pour la Suisse ?',ask:'Vérifier la question',working:'Vérification de l’analyse et des sources …',answer:'Réponse',sources:'Sources',checked:'Vérifié',uncertain:'Vérification requise',grounded:'Étaye',analysis:'Analyse actuelle de facture',provider:'Service IA',noSources:'Aucune source externe citée.',error:'La question douanière n’a pas pu être traitée.',quickHs:'Quels codes SH figurent sur la facture ?',quickOpen:'Quelles positions restent non résolues ?',quickSum:'Le total de contrôle correspond-il au total de facture ?',quickOrigin:'Quels pays d’origine sont présents ?'},
 it:{tab:'Esperto doganale IA',title:'Esperto doganale IA',subtitle:'Assistenza doganale consultiva con fonti verificate e contesto fattura.',advisory:'Solo consulenza · nessuna modifica automatica a dichiarazioni, spedizioni o attività',context:'Contesto attuale',noContext:'Nessuna analisi fattura attiva. È comunque possibile porre domande doganali generali.',question:'Domanda doganale',placeholder:'es. Quale regola preferenziale devo verificare per la Svizzera?',ask:'Verifica domanda',working:'Verifica di analisi e fonti …',answer:'Risposta',sources:'Fonti',checked:'Verificato',uncertain:'Verifica necessaria',grounded:'Supportato',analysis:'Analisi fattura attuale',provider:'Servizio IA',noSources:'Nessuna fonte esterna citata.',error:'Impossibile elaborare la domanda doganale.',quickHs:'Quali codici HS sono presenti in fattura?',quickOpen:'Quali posizioni sono ancora irrisolte?',quickSum:'Il totale di controllo coincide con il totale fattura?',quickOrigin:'Quali paesi di origine sono presenti?'}
};
function q(value){return String(value==null?'':value).trim()}
function lang(){try{var raw=root.ExportHUBI18n&&root.ExportHUBI18n.language?root.ExportHUBI18n.language():'de';raw=q(raw).toLowerCase().slice(0,2);return I18N[raw]?raw:'de'}catch(_){return'de'}}
function tr(key){var dict=I18N[lang()]||I18N.de;return dict[key]||I18N.de[key]||key}
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
function el(tag,className,text){var node=d.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node}
function clear(node){while(node&&node.firstChild)node.removeChild(node.firstChild)}
function formatContext(snapshot){
 var header=snapshot&&snapshot.header||{},review=snapshot&&snapshot.review||{},groups=Array.isArray(snapshot&&snapshot.groups)?snapshot.groups:[],parts=[];
 if(q(header.invoiceNumber))parts.push('Invoice '+q(header.invoiceNumber));
 if(q(header.destinationCountry))parts.push(q(header.destinationCountry));
 if(groups.length)parts.push(groups.length+' HS/Ursprung');
 if(Number(review.unassignedCount)>0)parts.push(Number(review.unassignedCount)+' offen');
 return parts.join(' · ')
}
function refreshContext(){var box=d.querySelector('[data-rc1532-context]');if(!box)return;var snapshot=latestSnapshot(),value=formatContext(snapshot);box.textContent=value||tr('noContext');box.classList.toggle('is-empty',!value)}
function renderSources(host,result){
 clear(host);var sources=Array.isArray(result&&result.sources)?result.sources:[];
 if(result&&result.evidence==='invoice-analysis'){var local=el('div','rc1532-source rc1532-source-local');local.appendChild(el('strong','',tr('analysis')));host.appendChild(local)}
 sources.forEach(function(source){
  var card=el('div','rc1532-source'),link=el('a','',q(source.title)||q(source.sourceName)||source.id||tr('sources'));
  link.href=q(source.sourceUrl)||'#';link.target='_blank';link.rel='noopener noreferrer';
  card.appendChild(link);
  var meta=[];if(q(source.sourceName))meta.push(q(source.sourceName));if(q(source.checkedAt))meta.push(tr('checked')+': '+q(source.checkedAt));
  if(meta.length)card.appendChild(el('div','rc1532-source-meta',meta.join(' · ')));
  host.appendChild(card)
 });
 if(!sources.length&&!(result&&result.evidence==='invoice-analysis'))host.appendChild(el('div','rc1532-source-empty',tr('noSources')))
}
function renderResult(result){
 var answer=d.querySelector('[data-rc1532-answer]'),sourceBox=d.querySelector('[data-rc1532-sources]'),badge=d.querySelector('[data-rc1532-badge]'),checked=d.querySelector('[data-rc1532-checked]');if(!answer||!sourceBox)return;
 answer.textContent=q(result&&result.answer)||tr('error');
 var uncertain=!!(result&&result.uncertainty);badge.textContent=uncertain?tr('uncertain'):tr('grounded');badge.className='rc1532-badge '+(uncertain?'is-warning':'is-ok');
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
  if(!response.ok&&!body.answer)body.answer='HTTP '+response.status;
  renderResult(body);if(status){status.hidden=true;status.textContent=''}
 }catch(error){renderResult({ok:false,uncertainty:true,answer:q(error&&error.message)||tr('error'),sources:[]});if(status){status.hidden=true;status.textContent=''}}
 finally{busy=false;if(button)button.disabled=false;refreshContext()}
}
function show(active){var ai=d.querySelector('[data-rc1532-ai-panel]');if(ai)ai.hidden=!active;if(active)refreshContext()}
function bindModes(host,button){
 button.addEventListener('click',function(){try{var api=root.ExportHUBRC1294ABDAnalysis;if(api&&typeof api.setMode==='function')api.setMode('ai')}catch(_){}show(true)});
 var others=host.querySelectorAll('[data-rc1294-mode]');for(var i=0;i<others.length;i++){if(others[i]===button)continue;others[i].addEventListener('click',function(){show(false)})}
}
function mount(){
 if(!d)return false;var host=panel();if(!host)return false;var router=host.querySelector('.rc1294-router');if(!router)return false;
 var button=host.querySelector('[data-rc1532-ai-tab]');
 if(!button){button=d.createElement('button');button.type='button';button.setAttribute('data-rc1294-mode','ai');button.setAttribute('data-rc1532-ai-tab','');button.setAttribute('aria-pressed','false');button.textContent=tr('tab');router.appendChild(button)}else button.textContent=tr('tab');
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
root.ExportHUBRC1532CustomsAI=Object.freeze({mount:mount,ask:ask,latestSnapshot:latestSnapshot});
mount();observe();
if(typeof root.addEventListener==='function')['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:language-changed'].forEach(function(name){root.addEventListener(name,remount)});
})(typeof window!=='undefined'?window:globalThis);
