/* SOP2 Phase 1. Six-language integration labels, independent of legacy SOP translations. */
(function(root){
'use strict';
if(root.ExportHubSop2I18n)return;
const packs={
 de:{
  title:'SOP',subtitle:'Gelenkte Arbeitsanweisungen mit Version und Freigabe',
  refresh:'Aktualisieren',back:'Zur Übersicht',reader:'Lesen',editor:'Bearbeiten',
  loading:'SOP wird geladen…',missing:'Keine SOP2-Dokumentation gefunden.',
  denied:'Du hast keine Berechtigung für diese SOP.',
  disabled:'SOP2 ist noch nicht freigeschaltet. Das bisherige SOP-System bleibt erhalten.',
  unavailable:'SOP2-Daten konnten nicht geladen werden. Bitte später erneut versuchen.',
  unavailableSafe:'Die SOP2-API ist noch nicht freigegeben. Es werden keine bisherigen Handbuchdaten übernommen.',
  invalid:'Die Dokumentintegrität konnte nicht bestätigt werden.',
  editUnavailable:'Für diese SOP ist keine Bearbeitung möglich.',
  newVersion:'Neue Entwurfsversion',create:'Entwurf anlegen',
  createTitle:'Titel der neuen SOP',createArea:'Bereich',createFunction:'Funktionskennung',
  createHint:'Ein neuer Entwurf benötigt Titel, Bereich und Funktionskennung.',
  createFailed:'Der Entwurf konnte nicht gespeichert werden.',
  draftCreated:'Entwurf angelegt.',versionCreated:'Neue Version angelegt.',
  conflict:'Die SOP wurde zwischenzeitlich geändert. Bitte neu öffnen.',
  unsaved:'Es gibt ungespeicherte Änderungen. Trotzdem verlassen?',
  noEditor:'Bearbeitungsrechte erforderlich.',noDocument:'Dieses SOP2-Dokument ist nicht vorhanden.',
  readOnly:'Ansicht ohne Schreibzugriff',ready:'SOP2-Dokumentation',
  retry:'Erneut versuchen',actionError:'Die Aktion ist fehlgeschlagen.'
 },
 en:{
  title:'SOP',subtitle:'Controlled work instructions with versioning and approval',
  refresh:'Refresh',back:'Back to overview',reader:'Read',editor:'Edit',
  loading:'Loading SOP…',missing:'No SOP2 document found.',
  denied:'You are not authorized to access this SOP.',
  disabled:'SOP2 is not enabled yet. The existing SOP system remains available.',
  unavailable:'Could not load SOP2 data. Please try again later.',
  unavailableSafe:'The SOP2 API is not enabled. No legacy handbook data is imported.',
  invalid:'Document integrity could not be verified.',
  editUnavailable:'Editing is unavailable for this SOP.',
  newVersion:'New draft version',create:'Create draft',
  createTitle:'New SOP title',createArea:'Area',createFunction:'Function identifier',
  createHint:'A new draft requires a title, area and function identifier.',
  createFailed:'Could not save the draft.',
  draftCreated:'Draft created.',versionCreated:'New version created.',
  conflict:'The SOP was updated by another person. Reopen it.',
  unsaved:'There are unsaved changes. Leave anyway?',
  noEditor:'Editing permission required.',noDocument:'This SOP2 document does not exist.',
  readOnly:'Read-only view',ready:'SOP2 documentation',
  retry:'Try again',actionError:'The action failed.'
 },
 pl:{
  title:'SOP',subtitle:'Kontrolowane instrukcje pracy z wersjami i zatwierdzaniem',
  refresh:'Odśwież',back:'Wróć do przeglądu',reader:'Czytaj',editor:'Edytuj',
  loading:'Wczytywanie SOP…',missing:'Nie znaleziono dokumentu SOP2.',
  denied:'Nie masz uprawnień do tej SOP.',
  disabled:'SOP2 nie jest jeszcze włączony. Dotychczasowy system pozostaje dostępny.',
  unavailable:'Nie można pobrać danych SOP2. Spróbuj później.',
  unavailableSafe:'API SOP2 nie jest włączone. Dane ze starego podręcznika nie są importowane.',
  invalid:'Nie można potwierdzić integralności dokumentu.',
  editUnavailable:'Nie można edytować tej SOP.',
  newVersion:'Nowa wersja robocza',create:'Utwórz projekt',
  createTitle:'Tytuł nowej SOP',createArea:'Obszar',createFunction:'Identyfikator funkcji',
  createHint:'Nowy projekt wymaga tytułu, obszaru i identyfikatora funkcji.',
  createFailed:'Nie udało się zapisać projektu.',
  draftCreated:'Projekt utworzony.',versionCreated:'Nowa wersja utworzona.',
  conflict:'SOP została zmieniona. Otwórz ją ponownie.',
  unsaved:'Istnieją niezapisane zmiany. Opuścić widok?',
  noEditor:'Wymagane uprawnienia edycji.',noDocument:'Dokument SOP2 nie istnieje.',
  readOnly:'Tylko do odczytu',ready:'Dokumentacja SOP2',
  retry:'Spróbuj ponownie',actionError:'Operacja nie powiodła się.'
 },
 es:{
  title:'SOP',subtitle:'Instrucciones controladas con versiones y aprobación',
  refresh:'Actualizar',back:'Volver al resumen',reader:'Leer',editor:'Editar',
  loading:'Cargando SOP…',missing:'No se encontró el documento SOP2.',
  denied:'No tienes permiso para acceder a esta SOP.',
  disabled:'SOP2 aún no está habilitado. El sistema anterior permanece disponible.',
  unavailable:'No se pudieron cargar los datos SOP2. Inténtalo más tarde.',
  unavailableSafe:'La API SOP2 no está habilitada. No se importan datos del manual anterior.',
  invalid:'No se pudo verificar la integridad del documento.',
  editUnavailable:'No se puede editar esta SOP.',
  newVersion:'Nueva versión de borrador',create:'Crear borrador',
  createTitle:'Título de la nueva SOP',createArea:'Área',createFunction:'Identificador de función',
  createHint:'Un borrador necesita título, área e identificador de función.',
  createFailed:'No se pudo guardar el borrador.',
  draftCreated:'Borrador creado.',versionCreated:'Nueva versión creada.',
  conflict:'Otra persona modificó la SOP. Vuelve a abrirla.',
  unsaved:'Hay cambios sin guardar. ¿Salir?',
  noEditor:'Se requiere permiso de edición.',noDocument:'Este documento SOP2 no existe.',
  readOnly:'Solo lectura',ready:'Documentación SOP2',
  retry:'Reintentar',actionError:'La acción falló.'
 },
 fr:{
  title:'SOP',subtitle:'Instructions de travail contrôlées avec versions et validation',
  refresh:'Actualiser',back:'Retour à la vue générale',reader:'Lire',editor:'Modifier',
  loading:'Chargement de la SOP…',missing:'Document SOP2 introuvable.',
  denied:"Vous n'avez pas accès à cette SOP.",
  disabled:"SOP2 n'est pas encore activé. L'ancien système reste disponible.",
  unavailable:'Impossible de charger les données SOP2. Réessayez plus tard.',
  unavailableSafe:"L'API SOP2 n'est pas activée. Aucune donnée de l'ancien manuel n'est importée.",
  invalid:"L'intégrité du document n'a pas pu être vérifiée.",
  editUnavailable:'Modification indisponible pour cette SOP.',
  newVersion:'Nouvelle version brouillon',create:'Créer un brouillon',
  createTitle:'Titre de la nouvelle SOP',createArea:'Service',createFunction:'Identifiant de fonction',
  createHint:'Un brouillon exige un titre, un service et un identifiant de fonction.',
  createFailed:"Impossible d'enregistrer le brouillon.",
  draftCreated:'Brouillon créé.',versionCreated:'Nouvelle version créée.',
  conflict:'La SOP a été modifiée. Ouvrez-la à nouveau.',
  unsaved:'Des modifications ne sont pas enregistrées. Quitter quand même ?',
  noEditor:'Autorisation de modification requise.',noDocument:"Ce document SOP2 n'existe pas.",
  readOnly:'Lecture seule',ready:'Documentation SOP2',
  retry:'Réessayer',actionError:"L'action a échoué."
 },
 it:{
  title:'SOP',subtitle:'Istruzioni controllate con versioni e approvazione',
  refresh:'Aggiorna',back:'Torna alla panoramica',reader:'Leggi',editor:'Modifica',
  loading:'Caricamento SOP…',missing:'Documento SOP2 non trovato.',
  denied:'Non hai il permesso di accedere a questa SOP.',
  disabled:'SOP2 non è ancora attivo. Il sistema precedente rimane disponibile.',
  unavailable:'Impossibile caricare i dati SOP2. Riprova più tardi.',
  unavailableSafe:'L’API SOP2 non è attiva. Non vengono importati dati dal vecchio manuale.',
  invalid:'Impossibile verificare l’integrità del documento.',
  editUnavailable:'La modifica di questa SOP non è disponibile.',
  newVersion:'Nuova versione bozza',create:'Crea bozza',
  createTitle:'Titolo della nuova SOP',createArea:'Area',createFunction:'Identificativo funzione',
  createHint:'Una nuova bozza richiede titolo, area e identificativo funzione.',
  createFailed:'Impossibile salvare la bozza.',
  draftCreated:'Bozza creata.',versionCreated:'Nuova versione creata.',
  conflict:'La SOP è stata modificata. Aprila nuovamente.',
  unsaved:'Ci sono modifiche non salvate. Vuoi uscire?',
  noEditor:'È richiesto il permesso di modifica.',noDocument:'Questo documento SOP2 non esiste.',
  readOnly:'Sola lettura',ready:'Documentazione SOP2',
  retry:'Riprova',actionError:'Operazione non riuscita.'
 }
};
const languages=Object.keys(packs),keys=Object.keys(packs.de);
for(const lang of languages){
  const pack=packs[lang];
  if(keys.length!==Object.keys(pack).length||keys.some(key=>typeof pack[key]!=='string'||!pack[key].trim())){
    throw new Error('SOP2_I18N_INCOMPLETE_'+lang);
  }
  Object.freeze(pack);
}
root.ExportHubSop2I18n=Object.freeze({
  packs:Object.freeze(packs),
  languages:Object.freeze(languages),
  get(lang){
    const id=String(lang||'de').toLowerCase().slice(0,2);
    return packs[id]||packs.en;
  }
});
})(typeof window!=='undefined'?window:globalThis);
