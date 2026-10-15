(function(root){
'use strict';
if(root.ExportHubSopGuidedI18n)return;
const dictionary={
  de:{
    'sop.guided.steps':'SOP-Schritte','sop.guided.catalog':'SOP-Auswahl','sop.guided.details':'Details','sop.guided.search':'Schritt suchen','sop.guided.searchPlaceholder':'z. B. MRN, Zahler, Dokument','sop.guided.back':'← Zurück','sop.guided.complete':'Schritt erledigt','sop.guided.next':'Weiter →','sop.guided.required':'Pflicht','sop.guided.missingImage':'Bild für diesen Schritt noch nicht hinterlegt.','sop.guided.requiredInfo':'Benötigte Informationen','sop.guided.risk':'Hinweis / Risiko','sop.guided.context':'Informationen zum Arbeitsschritt','sop.guided.check':'Prüfen','sop.guided.completionCheck':'Abschlusskontrolle','sop.guided.deviations':'Abweichungen / Klärung','sop.guided.stepOf':'Schritt {{current}} von {{total}}'
  },
  en:{
    'sop.guided.steps':'SOP steps','sop.guided.catalog':'SOP selection','sop.guided.details':'Details','sop.guided.search':'Search step','sop.guided.searchPlaceholder':'e.g. MRN, payer, document','sop.guided.back':'← Back','sop.guided.complete':'Complete step','sop.guided.next':'Next →','sop.guided.required':'Required','sop.guided.missingImage':'No image has been added for this step yet.','sop.guided.requiredInfo':'Required information','sop.guided.risk':'Note / risk','sop.guided.context':'Step information','sop.guided.check':'Check','sop.guided.completionCheck':'Final check','sop.guided.deviations':'Deviations / clarification','sop.guided.stepOf':'Step {{current}} of {{total}}'
  },
  pl:{
    'sop.guided.steps':'Kroki SOP','sop.guided.catalog':'Wybór SOP','sop.guided.details':'Szczegóły','sop.guided.search':'Szukaj kroku','sop.guided.searchPlaceholder':'np. MRN, płatnik, dokument','sop.guided.back':'← Wstecz','sop.guided.complete':'Zakończ krok','sop.guided.next':'Dalej →','sop.guided.required':'Wymagane','sop.guided.missingImage':'Dla tego kroku nie dodano jeszcze obrazu.','sop.guided.requiredInfo':'Wymagane informacje','sop.guided.risk':'Wskazówka / ryzyko','sop.guided.context':'Informacje o kroku','sop.guided.check':'Sprawdź','sop.guided.completionCheck':'Kontrola końcowa','sop.guided.deviations':'Odchylenia / wyjaśnienie','sop.guided.stepOf':'Krok {{current}} z {{total}}'
  },
  es:{
    'sop.guided.steps':'Pasos de la SOP','sop.guided.catalog':'Selección de SOP','sop.guided.details':'Detalles','sop.guided.search':'Buscar paso','sop.guided.searchPlaceholder':'p. ej., MRN, pagador, documento','sop.guided.back':'← Atrás','sop.guided.complete':'Completar paso','sop.guided.next':'Siguiente →','sop.guided.required':'Obligatorio','sop.guided.missingImage':'Todavía no se ha añadido una imagen para este paso.','sop.guided.requiredInfo':'Información necesaria','sop.guided.risk':'Nota / riesgo','sop.guided.context':'Información del paso','sop.guided.check':'Comprobar','sop.guided.completionCheck':'Comprobación final','sop.guided.deviations':'Desviaciones / aclaración','sop.guided.stepOf':'Paso {{current}} de {{total}}'
  },
  fr:{
    'sop.guided.steps':'Étapes de la SOP','sop.guided.catalog':'Sélection de la SOP','sop.guided.details':'Détails','sop.guided.search':'Rechercher une étape','sop.guided.searchPlaceholder':'p. ex. MRN, payeur, document','sop.guided.back':'← Retour','sop.guided.complete':'Terminer l’étape','sop.guided.next':'Suivant →','sop.guided.required':'Obligatoire','sop.guided.missingImage':'Aucune image n’a encore été ajoutée pour cette étape.','sop.guided.requiredInfo':'Informations nécessaires','sop.guided.risk':'Remarque / risque','sop.guided.context':'Informations sur l’étape','sop.guided.check':'Vérifier','sop.guided.completionCheck':'Contrôle final','sop.guided.deviations':'Écarts / clarification','sop.guided.stepOf':'Étape {{current}} sur {{total}}'
  },
  it:{
    'sop.guided.steps':'Passaggi SOP','sop.guided.catalog':'Selezione SOP','sop.guided.details':'Dettagli','sop.guided.search':'Cerca passaggio','sop.guided.searchPlaceholder':'ad es. MRN, pagatore, documento','sop.guided.back':'← Indietro','sop.guided.complete':'Completa passaggio','sop.guided.next':'Avanti →','sop.guided.required':'Obbligatorio','sop.guided.missingImage':'Non è ancora stata aggiunta un’immagine per questo passaggio.','sop.guided.requiredInfo':'Informazioni necessarie','sop.guided.risk':'Nota / rischio','sop.guided.context':'Informazioni sul passaggio','sop.guided.check':'Controlla','sop.guided.completionCheck':'Controllo finale','sop.guided.deviations':'Scostamenti / chiarimento','sop.guided.stepOf':'Passaggio {{current}} di {{total}}'
  }
};
const frozen=Object.freeze(Object.fromEntries(Object.entries(dictionary).map(([lang,values])=>[lang,Object.freeze({...values})])));
root.ExportHubSopGuidedI18n=frozen;

let attempts=0;
function format(value,vars){let out=String(value==null?'':value);for(const [key,replacement] of Object.entries(vars||{}))out=out.replaceAll(`{{${key}}}`,String(replacement));return out;}
function install(){
  const base=root.ExportHUBI18n;
  if(!base||typeof base.t!=='function'){
    attempts+=1;if(attempts<120&&typeof root.setTimeout==='function')root.setTimeout(install,25);return false;
  }
  if(base.__rc1544GuidedI18n)return true;
  const language=()=>{try{return typeof base.language==='function'?String(base.language()||'de').toLowerCase().slice(0,2):'de';}catch(_){return'de';}};
  const wrapped=Object.freeze(Object.assign({},base,{__rc1544GuidedI18n:true,t(key,vars){
    let value='';try{value=base.t(key,vars);}catch(_){}
    if(value&&value!==key)return value;
    const lang=language(),local=frozen[lang]||frozen.de;return Object.prototype.hasOwnProperty.call(local,key)?format(local[key],vars):(value||key);
  }}));
  root.ExportHUBI18n=wrapped;return true;
}
install();
})(typeof globalThis!=='undefined'?globalThis:this);
