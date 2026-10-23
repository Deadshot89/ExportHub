(function(root){
'use strict';
var packs=Object.freeze({
 de:Object.freeze({
  tab:'KI-Zollexperte',title:'KI-Zollexperte',subtitle:'Beratende Zollhilfe mit geprüften Quellen und direktem Rechnungs-Kontext.',advisory:'Beratend · keine automatische Änderung an ABD, Sendung oder Aufgabe',context:'Aktueller Kontext',noContext:'Keine Rechnungsanalyse aktiv. Allgemeine Zollfragen sind trotzdem möglich.',question:'Zollfrage',placeholder:'z. B. Welche Präferenzregel muss ich für die Schweiz prüfen?',ask:'Frage prüfen',working:'Prüfe Analyse und Quellen …',answer:'Antwort',sources:'Quellen',checked:'Prüfstand',uncertain:'Prüfung erforderlich',grounded:'Belegt',analysis:'Aktuelle Rechnungsanalyse',provider:'KI-Dienst',noSources:'Keine externen Quellen zitiert.',error:'Die Zollfrage konnte nicht verarbeitet werden.',quickHs:'Welche HS-Codes sind in der Rechnung?',quickOpen:'Welche Positionen sind noch ungeklärt?',quickSum:'Stimmt die Kontrollsumme mit der Rechnungssumme?',quickOrigin:'Welche Ursprungsländer sind enthalten?',contextInvoice:'Rechnung {{number}}',contextGroups:'{{count}} HS/Ursprung',contextOpen:'{{count}} offen'
 }),
 en:Object.freeze({
  tab:'AI Customs Expert',title:'AI Customs Expert',subtitle:'Advisory customs help with reviewed sources and current invoice context.',advisory:'Advisory only · no automatic changes to export declarations, shipments or tasks',context:'Current context',noContext:'No invoice analysis is active. General customs questions are still available.',question:'Customs question',placeholder:'e.g. Which preference rule should I check for Switzerland?',ask:'Check question',working:'Checking analysis and sources …',answer:'Answer',sources:'Sources',checked:'Checked',uncertain:'Review required',grounded:'Grounded',analysis:'Current invoice analysis',provider:'AI service',noSources:'No external sources cited.',error:'The customs question could not be processed.',quickHs:'Which HS codes are in the invoice?',quickOpen:'Which positions are still unresolved?',quickSum:'Does the control total match the invoice total?',quickOrigin:'Which origin countries are included?',contextInvoice:'Invoice {{number}}',contextGroups:'{{count}} HS/origin',contextOpen:'{{count}} unresolved'
 }),
 pl:Object.freeze({
  tab:'Ekspert AI ds. ceł',title:'Ekspert AI ds. ceł',subtitle:'Doradcza pomoc celna z weryfikowanymi źródłami i kontekstem faktury.',advisory:'Tylko doradztwo · bez automatycznych zmian w zgłoszeniu, wysyłce lub zadaniu',context:'Bieżący kontekst',noContext:'Brak aktywnej analizy faktury. Nadal można zadawać ogólne pytania celne.',question:'Pytanie celne',placeholder:'np. Jaką regułę preferencji sprawdzić dla Szwajcarii?',ask:'Sprawdź pytanie',working:'Sprawdzam analizę i źródła …',answer:'Odpowiedź',sources:'Źródła',checked:'Sprawdzono',uncertain:'Wymaga sprawdzenia',grounded:'Potwierdzone',analysis:'Bieżąca analiza faktury',provider:'Usługa AI',noSources:'Brak cytowanych źródeł zewnętrznych.',error:'Nie udało się przetworzyć pytania celnego.',quickHs:'Jakie kody HS są na fakturze?',quickOpen:'Które pozycje są jeszcze niewyjaśnione?',quickSum:'Czy suma kontrolna zgadza się z sumą faktury?',quickOrigin:'Jakie kraje pochodzenia występują?',contextInvoice:'Faktura {{number}}',contextGroups:'{{count}} HS/pochodzenie',contextOpen:'{{count}} niewyjaśnione'
 }),
 es:Object.freeze({
  tab:'Experto aduanero IA',title:'Experto aduanero IA',subtitle:'Asistencia aduanera consultiva con fuentes verificadas y contexto de factura.',advisory:'Solo asesoramiento · sin cambios automáticos en declaraciones, envíos o tareas',context:'Contexto actual',noContext:'No hay un análisis de factura activo. Las preguntas aduaneras generales siguen disponibles.',question:'Pregunta aduanera',placeholder:'p. ej. ¿Qué regla preferencial debo comprobar para Suiza?',ask:'Comprobar pregunta',working:'Comprobando análisis y fuentes …',answer:'Respuesta',sources:'Fuentes',checked:'Revisado',uncertain:'Requiere revisión',grounded:'Verificado',analysis:'Análisis actual de factura',provider:'Servicio IA',noSources:'No se citaron fuentes externas.',error:'No se pudo procesar la pregunta aduanera.',quickHs:'¿Qué códigos HS contiene la factura?',quickOpen:'¿Qué posiciones siguen sin resolver?',quickSum:'¿Coincide la suma de control con el total de factura?',quickOrigin:'¿Qué países de origen aparecen?',contextInvoice:'Factura {{number}}',contextGroups:'{{count}} HS/origen',contextOpen:'{{count}} sin resolver'
 }),
 fr:Object.freeze({
  tab:'Expert douane IA',title:'Expert douane IA',subtitle:'Aide douanière consultative avec sources vérifiées et contexte de facture.',advisory:'Conseil uniquement · aucune modification automatique des déclarations, expéditions ou tâches',context:'Contexte actuel',noContext:'Aucune analyse de facture active. Les questions douanières générales restent possibles.',question:'Question douanière',placeholder:'ex. Quelle règle préférentielle vérifier pour la Suisse ?',ask:'Vérifier la question',working:'Vérification de l’analyse et des sources …',answer:'Réponse',sources:'Sources',checked:'Vérifié',uncertain:'Vérification requise',grounded:'Étaye',analysis:'Analyse actuelle de facture',provider:'Service IA',noSources:'Aucune source externe citée.',error:'La question douanière n’a pas pu être traitée.',quickHs:'Quels codes SH figurent sur la facture ?',quickOpen:'Quelles positions restent non résolues ?',quickSum:'Le total de contrôle correspond-il au total de facture ?',quickOrigin:'Quels pays d’origine sont présents ?',contextInvoice:'Facture {{number}}',contextGroups:'{{count}} SH/origine',contextOpen:'{{count}} non résolue(s)'
 }),
 it:Object.freeze({
  tab:'Esperto doganale IA',title:'Esperto doganale IA',subtitle:'Assistenza doganale consultiva con fonti verificate e contesto fattura.',advisory:'Solo consulenza · nessuna modifica automatica a dichiarazioni, spedizioni o attività',context:'Contesto attuale',noContext:'Nessuna analisi fattura attiva. È comunque possibile porre domande doganali generali.',question:'Domanda doganale',placeholder:'es. Quale regola preferenziale devo verificare per la Svizzera?',ask:'Verifica domanda',working:'Verifica di analisi e fonti …',answer:'Risposta',sources:'Fonti',checked:'Verificato',uncertain:'Verifica necessaria',grounded:'Supportato',analysis:'Analisi fattura attuale',provider:'Servizio IA',noSources:'Nessuna fonte esterna citata.',error:'Impossibile elaborare la domanda doganale.',quickHs:'Quali codici HS sono presenti in fattura?',quickOpen:'Quali posizioni sono ancora irrisolte?',quickSum:'Il totale di controllo coincide con il totale fattura?',quickOrigin:'Quali paesi di origine sono presenti?',contextInvoice:'Fattura {{number}}',contextGroups:'{{count}} HS/origine',contextOpen:'{{count}} irrisolte'
 })
});
function normalize(value){
 var lang=String(value==null?'':value).trim().toLowerCase().replace('_','-').slice(0,2);
 return Object.prototype.hasOwnProperty.call(packs,lang)?lang:'de'
}
function language(){
 try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.language==='function')return normalize(root.ExportHUBI18n.language())}catch(_){}
 try{return normalize(root.navigator&&(root.navigator.language||(root.navigator.languages&&root.navigator.languages[0])))}catch(_){return'de'}
}
function interpolate(value,vars){
 return String(value==null?'':value).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,function(_m,key){return vars&&vars[key]!=null?String(vars[key]):''})
}
function t(key,lang,vars){
 var selected=normalize(lang||language()),pack=packs[selected]||packs.de,value=pack[key]||packs.de[key]||String(key||'');
 return interpolate(value,vars)
}
root.ExportHUBRC1532I18n=Object.freeze({packs:packs,normalize:normalize,language:language,t:t});
})(typeof window!=='undefined'?window:globalThis);
