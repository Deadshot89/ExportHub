/* ExportHUB360 – Texte der Seite „Fehler & Verbesserungen“ (qualitaet.html) in de, en, pl, es, fr, it.
   Schlüssel ist der deutsche Text. Gespeicherte Falltexte werden nie übersetzt. Sprache: ?lang=, danach localStorage „exporthub.language“. */
(function(w,d){
'use strict';
if(w.ExportHUBQualityI18n)return;
var LANGS=['de','en','pl','es','fr','it'];
// [de, en, pl, es, fr, it]
var T=[
['Qualitätsmanagement · Fehler & Verbesserungen','Quality management · Errors & improvements','Zarządzanie jakością · Błędy i usprawnienia','Gestión de calidad · Errores y mejoras','Gestion de la qualité · Erreurs et améliorations','Gestione della qualità · Errori e miglioramenti'],
['← Zur Hauptseite','← To main page','← Do strony głównej','← A la página principal','← Vers la page principale','← Alla pagina principale'],
['Fehler & Verbesserungen','Errors & improvements','Błędy i usprawnienia','Errores y mejoras','Erreurs et améliorations','Errori e miglioramenti'],
['Abweichungen erfassen, Ursachen beheben und Wirksamkeit nachweisen.','Record deviations, fix causes and prove effectiveness.','Rejestruj odchylenia, usuwaj przyczyny i potwierdzaj skuteczność.','Registrar desviaciones, corregir causas y demostrar la eficacia.','Enregistrer les écarts, corriger les causes et prouver l’efficacité.','Registrare le deviazioni, eliminare le cause e dimostrare l’efficacia.'],
['+ Fehler dokumentieren','+ Document an error','+ Udokumentuj błąd','+ Documentar un error','+ Documenter une erreur','+ Documentare un errore'],
['Fall drucken','Print case','Drukuj sprawę','Imprimir caso','Imprimer le cas','Stampa caso'],
['Offene Fälle','Open cases','Otwarte sprawy','Casos abiertos','Cas ouverts','Casi aperti'],
['Überfällige Maßnahmen','Overdue actions','Zaległe działania','Medidas vencidas','Mesures en retard','Misure scadute'],
['Wirksamkeit prüfen','Verify effectiveness','Sprawdź skuteczność','Verificar eficacia','Vérifier l’efficacité','Verificare l’efficacia'],
['Abgeschlossen','Closed','Zamknięte','Cerrado','Clôturé','Chiuso'],
['Fehlerprotokoll','Error log','Rejestr błędów','Registro de errores','Journal des erreurs','Registro errori'],
['Alle Status','All statuses','Wszystkie statusy','Todos los estados','Tous les statuts','Tutti gli stati'],
['Offen','Open','Otwarte','Abierto','Ouvert','Aperto'],
['Ursachenanalyse','Root cause analysis','Analiza przyczyn','Análisis de causas','Analyse des causes','Analisi delle cause'],
['Maßnahme','Action','Działanie','Medida','Mesure','Misura'],
['Alle Bereiche','All areas','Wszystkie obszary','Todas las áreas','Tous les domaines','Tutte le aree'],
['Versand','Shipping','Wysyłka','Envío','Expédition','Spedizione'],
['Verladung','Loading','Załadunek','Carga','Chargement','Carico'],
['Dokumente','Documents','Dokumenty','Documentos','Documents','Documenti'],
['Zoll','Customs','Cło','Aduana','Douane','Dogana'],
['Kunde','Customer','Klient','Cliente','Client','Cliente'],
['Qualität','Quality','Jakość','Calidad','Qualité','Qualità'],
['Umwelt','Environment','Środowisko','Medio ambiente','Environnement','Ambiente'],
['Arbeitsschutz','Occupational safety','BHP','Seguridad laboral','Sécurité au travail','Sicurezza sul lavoro'],
['Sonstiges','Other','Inne','Otros','Autre','Altro'],
['Neuer Fehler','New error','Nowy błąd','Nuevo error','Nouvelle erreur','Nuovo errore'],
['Jeder Fehler erhält eine eindeutige Nummer und einen Änderungsverlauf.','Every error gets a unique number and a change history.','Każdy błąd otrzymuje unikalny numer i historię zmian.','Cada error recibe un número único y un historial de cambios.','Chaque erreur reçoit un numéro unique et un historique des modifications.','Ogni errore riceve un numero univoco e una cronologia delle modifiche.'],
['01 · Was ist passiert?','01 · What happened?','01 · Co się stało?','01 · ¿Qué ha pasado?','01 · Que s’est-il passé ?','01 · Che cosa è successo?'],
['Fehlertitel *','Error title *','Tytuł błędu *','Título del error *','Titre de l’erreur *','Titolo dell’errore *'],
['Kategorie','Category','Kategoria','Categoría','Catégorie','Categoria'],
['Kundenkommunikation','Customer communication','Komunikacja z klientem','Comunicación con el cliente','Communication client','Comunicazione con il cliente'],
['Schweregrad','Severity','Waga','Gravedad','Gravité','Gravità'],
['Niedrig','Low','Niska','Baja','Faible','Bassa'],
['Mittel','Medium','Średnia','Media','Moyenne','Media'],
['Hoch','High','Wysoka','Alta','Élevée','Alta'],
['Kritisch','Critical','Krytyczna','Crítica','Critique','Critica'],
['niedrig','low','niska','baja','faible','bassa'],
['mittel','medium','średnia','media','moyenne','media'],
['hoch','high','wysoka','alta','élevée','alta'],
['kritisch','critical','krytyczna','crítica','critique','critica'],
['Fehlerdatum','Date of error','Data błędu','Fecha del error','Date de l’erreur','Data dell’errore'],
['Arbeitsbereich','Work area','Obszar pracy','Área de trabajo','Zone de travail','Area di lavoro'],
['Sendungsreferenz / Bezug','Shipment reference / link','Referencja przesyłki / powiązanie','Referencia del envío / vínculo','Référence d’envoi / lien','Riferimento spedizione / collegamento'],
['Was genau ist passiert? *','What exactly happened? *','Co dokładnie się stało? *','¿Qué ha ocurrido exactamente? *','Que s’est-il passé exactement ? *','Che cosa è successo esattamente? *'],
['Welche Folgen hatte der Fehler?','What were the consequences of the error?','Jakie były skutki błędu?','¿Qué consecuencias tuvo el error?','Quelles ont été les conséquences de l’erreur ?','Quali conseguenze ha avuto l’errore?'],
['Was wurde sofort unternommen?','What was done immediately?','Co zrobiono natychmiast?','¿Qué se hizo de inmediato?','Qu’a-t-on fait immédiatement ?','Che cosa è stato fatto subito?'],
['02 · Ursache und dauerhafte Lösung','02 · Cause and lasting solution','02 · Przyczyna i trwałe rozwiązanie','02 · Causa y solución duradera','02 · Cause et solution durable','02 · Causa e soluzione duratura'],
['Was war die tatsächliche Ursache?','What was the actual cause?','Jaka była rzeczywista przyczyna?','¿Cuál fue la causa real?','Quelle était la cause réelle ?','Qual è stata la causa effettiva?'],
['Abstellmaßnahme','Corrective action','Działanie korygujące','Medida correctiva','Mesure corrective','Misura correttiva'],
['Vorbeugende Verbesserung / SOP','Preventive improvement / SOP','Usprawnienie zapobiegawcze / SOP','Mejora preventiva / SOP','Amélioration préventive / SOP','Miglioramento preventivo / SOP'],
['Verantwortlich','Responsible','Odpowiedzialny','Responsable','Responsable','Responsabile'],
['Frist','Due date','Termin','Plazo','Échéance','Scadenza'],
['Bearbeitungsstand','Processing status','Stan realizacji','Estado de tramitación','État du traitement','Stato di lavorazione'],
['Maßnahme wird umgesetzt','Action in progress','Działanie w realizacji','Medida en curso','Mesure en cours','Misura in corso'],
['Abgeschlossen (nur mit Prüfung)','Closed (only after verification)','Zamknięte (tylko po weryfikacji)','Cerrado (solo con verificación)','Clôturé (uniquement après vérification)','Chiuso (solo dopo verifica)'],
['Nachweis / Dokumentreferenz','Evidence / document reference','Dowód / odnośnik do dokumentu','Prueba / referencia del documento','Preuve / référence du document','Prova / riferimento al documento'],
['Anhänge (Fotos, PDF – max. 15 MB, höchstens 10 je Fall)','Attachments (photos, PDF – max. 15 MB, up to 10 per case)','Załączniki (zdjęcia, PDF – maks. 15 MB, do 10 na sprawę)','Adjuntos (fotos, PDF – máx. 15 MB, hasta 10 por caso)','Pièces jointes (photos, PDF – max. 15 Mo, 10 au plus par cas)','Allegati (foto, PDF – max 15 MB, fino a 10 per caso)'],
['Noch kein Anhang','No attachment yet','Brak załączników','Aún sin adjuntos','Aucune pièce jointe','Nessun allegato'],
['03 · War die Maßnahme erfolgreich?','03 · Was the action successful?','03 · Czy działanie się powiodło?','03 · ¿Fue eficaz la medida?','03 · La mesure a-t-elle été efficace ?','03 · La misura ha avuto successo?'],
['Bewertung','Assessment','Ocena','Valoración','Évaluation','Valutazione'],
['Noch nicht geprüft','Not verified yet','Jeszcze nie sprawdzono','Aún sin verificar','Pas encore vérifié','Non ancora verificato'],
['Prüfung offen','Verification pending','Weryfikacja otwarta','Verificación pendiente','Vérification en attente','Verifica aperta'],
['Wirksam','Effective','Skuteczne','Eficaz','Efficace','Efficace'],
['Nicht wirksam','Not effective','Nieskuteczne','No eficaz','Non efficace','Non efficace'],
['Prüfdatum','Verification date','Data weryfikacji','Fecha de verificación','Date de vérification','Data di verifica'],
['Wie wurde die Wirkung nachgewiesen?','How was the effect proven?','Jak potwierdzono skutek?','¿Cómo se demostró el efecto?','Comment l’effet a-t-il été prouvé ?','Come è stato dimostrato l’effetto?'],
['Fall speichern','Save case','Zapisz sprawę','Guardar caso','Enregistrer le cas','Salva caso'],
['Verbesserungsvorschläge','Improvement suggestions','Propozycje usprawnień','Sugerencias de mejora','Suggestions d’amélioration','Suggerimenti di miglioramento'],
['Wirksamkeit bestätigen & schließen','Confirm effectiveness & close','Potwierdź skuteczność i zamknij','Confirmar eficacia y cerrar','Confirmer l’efficacité et clôturer','Conferma efficacia e chiudi'],
['Wieder öffnen','Reopen','Otwórz ponownie','Reabrir','Rouvrir','Riapri'],
['Nicht gespeichert','Not saved','Niezapisane','Sin guardar','Non enregistré','Non salvato'],
['Noch nicht gespeichert','Not saved yet','Jeszcze nie zapisano','Aún sin guardar','Pas encore enregistré','Non ancora salvato'],
['Gespeichert','Saved','Zapisano','Guardado','Enregistré','Salvato'],
['Änderungsverlauf','Change history','Historia zmian','Historial de cambios','Historique des modifications','Cronologia delle modifiche'],
['Fallübersicht','Case overview','Przegląd spraw','Resumen de casos','Aperçu des cas','Panoramica dei casi'],
['Erfasste Abweichungen','Recorded deviations','Zarejestrowane odchylenia','Desviaciones registradas','Écarts enregistrés','Deviazioni registrate'],
['Suche: Fehler, REF, Ursache …','Search: error, REF, cause …','Szukaj: błąd, REF, przyczyna …','Buscar: error, REF, causa …','Recherche : erreur, REF, cause …','Cerca: errore, REF, causa …'],
['Fehler suchen','Search errors','Szukaj błędów','Buscar errores','Rechercher des erreurs','Cerca errori'],
['Status filtern','Filter by status','Filtruj według statusu','Filtrar por estado','Filtrer par statut','Filtra per stato'],
['Kategorie filtern','Filter by category','Filtruj według kategorii','Filtrar por categoría','Filtrer par catégorie','Filtra per categoria'],
['Fall bearbeiten','Edit case','Edytuj sprawę','Editar caso','Modifier le cas','Modifica caso'],
['z. B. Falsche Palette für Sendung bereitgestellt','e.g. Wrong pallet staged for shipment','np. Przygotowano złą paletę dla przesyłki','p. ej. Palé equivocado preparado para el envío','p. ex. Mauvaise palette préparée pour l’envoi','es. Pallet errato preparato per la spedizione'],
['z. B. Warenausgang','e.g. Goods issue','np. Wydanie towaru','p. ej. Salida de mercancías','p. ex. Expédition des marchandises','es. Uscita merci'],
['Optional: REF, Auftrag, Versandnummer','Optional: REF, order, shipping number','Opcjonalnie: REF, zlecenie, numer wysyłki','Opcional: REF, pedido, número de envío','Facultatif : REF, commande, numéro d’expédition','Facoltativo: REF, ordine, numero di spedizione'],
['Beschreibe den tatsächlichen Ablauf in einfachen Worten.','Describe what actually happened in plain words.','Opisz faktyczny przebieg prostymi słowami.','Describe lo ocurrido con palabras sencillas.','Décrivez le déroulement réel en termes simples.','Descrivi lo svolgimento reale con parole semplici.'],
['Kunde, Kosten, Nacharbeit, Umwelt oder Sicherheit','Customer, costs, rework, environment or safety','Klient, koszty, poprawki, środowisko lub bezpieczeństwo','Cliente, costes, repetición de trabajo, medio ambiente o seguridad','Client, coûts, reprise, environnement ou sécurité','Cliente, costi, rilavorazione, ambiente o sicurezza'],
['z. B. Verladung gestoppt, Spedition angerufen','e.g. Loading stopped, carrier called','np. Wstrzymano załadunek, zadzwoniono do spedytora','p. ej. Carga detenida, transportista avisado','p. ex. Chargement arrêté, transporteur appelé','es. Carico fermato, spedizioniere chiamato'],
['5 Warum: Warum konnte der Fehler entstehen?','5 Whys: Why could the error occur?','5 x Dlaczego: Dlaczego mógł powstać błąd?','5 porqués: ¿Por qué pudo producirse el error?','5 pourquoi : Pourquoi l’erreur a-t-elle pu se produire ?','5 perché: Perché è potuto accadere l’errore?'],
['Konkrete Änderung, die den Fehler künftig verhindert','Concrete change that prevents the error in future','Konkretna zmiana, która zapobiegnie błędowi w przyszłości','Cambio concreto que evitará el error en el futuro','Changement concret qui évitera l’erreur à l’avenir','Modifica concreta che evita l’errore in futuro'],
['Prüfschritt, Schulung, SOP oder Systemanpassung','Check step, training, SOP or system change','Etap kontroli, szkolenie, SOP lub zmiana systemu','Paso de control, formación, SOP o ajuste del sistema','Étape de contrôle, formation, SOP ou adaptation du système','Fase di controllo, formazione, SOP o adeguamento del sistema'],
['Name oder Team','Name or team','Imię i nazwisko lub zespół','Nombre o equipo','Nom ou équipe','Nome o team'],
['z. B. Prüfprotokoll, Foto-/Dateiname oder Referenzordner','e.g. inspection record, photo/file name or reference folder','np. protokół kontroli, nazwa zdjęcia/pliku lub folder referencyjny','p. ej. acta de control, nombre de foto/archivo o carpeta de referencia','p. ex. procès-verbal de contrôle, nom de photo/fichier ou dossier de référence','es. verbale di controllo, nome di foto/file o cartella di riferimento'],
['z. B. zehn weitere Verladungen ohne gleiche Abweichung geprüft','e.g. ten further loadings checked without the same deviation','np. sprawdzono dziesięć kolejnych załadunków bez tego samego odchylenia','p. ej. diez cargas más revisadas sin la misma desviación','p. ex. dix chargements supplémentaires contrôlés sans le même écart','es. altri dieci carichi controllati senza la stessa deviazione'],
['Druckbericht Qualitätsabweichung','Print report quality deviation','Raport wydruku odchylenia jakości','Informe impreso de desviación de calidad','Rapport imprimé d’écart qualité','Rapporto stampato deviazione di qualità'],
['Verlauf nicht integer','History not intact','Historia niespójna','Historial no íntegro','Historique non intègre','Cronologia non integra'],
['Die Sitzung wurde umgeleitet. Bitte in ExportHUB360 erneut anmelden.','The session was redirected. Please sign in to ExportHUB360 again.','Sesja została przekierowana. Zaloguj się ponownie w ExportHUB360.','La sesión se redirigió. Vuelva a iniciar sesión en ExportHUB360.','La session a été redirigée. Reconnectez-vous à ExportHUB360.','La sessione è stata reindirizzata. Accedere di nuovo a ExportHUB360.'],
['Bitte den Fall zuerst speichern, danach Anhänge hinzufügen.','Please save the case first, then add attachments.','Najpierw zapisz sprawę, potem dodaj załączniki.','Guarde primero el caso y añada después los adjuntos.','Veuillez d’abord enregistrer le cas, puis ajouter des pièces jointes.','Salvare prima il caso, poi aggiungere gli allegati.'],
['größer als 15 MB','larger than 15 MB','większy niż 15 MB','mayor de 15 MB','supérieur à 15 Mo','più grande di 15 MB'],
['Nicht gespeicherte Änderungen verwerfen?','Discard unsaved changes?','Odrzucić niezapisane zmiany?','¿Descartar los cambios sin guardar?','Abandonner les modifications non enregistrées ?','Scartare le modifiche non salvate?'],
['Maßnahme oder Ursache geändert: Die bisherige Wirksamkeitsprüfung ist ungültig. Bitte erneut prüfen und dokumentieren.','Action or cause changed: the previous effectiveness check is no longer valid. Please verify and document again.','Zmieniono działanie lub przyczynę: dotychczasowa weryfikacja skuteczności jest nieważna. Sprawdź i udokumentuj ponownie.','Medida o causa modificada: la verificación de eficacia anterior ya no es válida. Verifique y documente de nuevo.','Mesure ou cause modifiée : la vérification d’efficacité précédente n’est plus valable. Vérifiez et documentez à nouveau.','Misura o causa modificata: la precedente verifica di efficacia non è più valida. Verificare e documentare di nuovo.'],
['Änderungen zentral gespeichert.','Changes saved centrally.','Zmiany zapisano centralnie.','Cambios guardados de forma centralizada.','Modifications enregistrées de façon centralisée.','Modifiche salvate centralmente.'],
['[Vorschlag – vor Umsetzung prüfen] ','[Suggestion – check before implementing] ','[Propozycja – sprawdź przed wdrożeniem] ','[Sugerencia – revisar antes de aplicar] ','[Suggestion – à vérifier avant mise en œuvre] ','[Suggerimento – verificare prima dell’attuazione] '],
['Der Vorschlag steht bereits in den Maßnahmen.','The suggestion is already in the actions.','Propozycja jest już w działaniach.','La sugerencia ya está en las medidas.','La suggestion figure déjà dans les mesures.','Il suggerimento è già nelle misure.'],
['Vorschlag noch nicht gespeichert','Suggestion not saved yet','Propozycja jeszcze niezapisana','Sugerencia aún sin guardar','Suggestion pas encore enregistrée','Suggerimento non ancora salvato'],
['Vorschlag in „Abstellmaßnahme“ eingefügt. Bitte prüfen und anschließend speichern.','Suggestion inserted into “Corrective action”. Please check and then save.','Propozycję wstawiono do „Działanie korygujące”. Sprawdź, a następnie zapisz.','Sugerencia insertada en «Medida correctiva». Revise y guarde.','Suggestion insérée dans « Mesure corrective ». Vérifiez puis enregistrez.','Suggerimento inserito in «Misura correttiva». Verificare e poi salvare.'],
['Warum soll der abgeschlossene Fehlerfall wieder geöffnet werden?','Why should the closed error case be reopened?','Dlaczego zamknięta sprawa błędu ma zostać otwarta ponownie?','¿Por qué debe reabrirse el caso de error cerrado?','Pourquoi le cas d’erreur clôturé doit-il être rouvert ?','Perché il caso di errore chiuso deve essere riaperto?'],
['Fall wieder geöffnet.','Case reopened.','Sprawę otwarto ponownie.','Caso reabierto.','Cas rouvert.','Caso riaperto.'],
['Verbesserungsvorschläge','Improvement suggestions','Propozycje usprawnień','Sugerencias de mejora','Suggestions d’amélioration','Suggerimenti di miglioramento'],
['Ähnliche frühere Fehler','Similar earlier errors','Podobne wcześniejsze błędy','Errores anteriores similares','Erreurs antérieures similaires','Errori precedenti simili'],
['Als Maßnahme vorschlagen','Suggest as action','Zaproponuj jako działanie','Proponer como medida','Proposer comme mesure','Proponi come misura'],
['Regelbasierte Analyse – keine generative KI. Maßnahmen fachlich prüfen.','Rule-based analysis – no generative AI. Check actions for suitability.','Analiza oparta na regułach – bez generatywnej AI. Sprawdź działania merytorycznie.','Análisis basado en reglas, sin IA generativa. Revise las medidas técnicamente.','Analyse basée sur des règles, sans IA générative. Vérifiez les mesures sur le fond.','Analisi basata su regole, senza IA generativa. Verificare le misure dal punto di vista tecnico.'],
['01 · Fehler und unmittelbare Folgen','01 · Error and immediate consequences','01 · Błąd i bezpośrednie skutki','01 · Error y consecuencias inmediatas','01 · Erreur et conséquences immédiates','01 · Errore e conseguenze immediate'],
['Sofortmaßnahme','Immediate action','Działanie natychmiastowe','Medida inmediata','Mesure immédiate','Misura immediata'],
['02 · Ursachenanalyse und Abstellmaßnahmen','02 · Root cause analysis and corrective actions','02 · Analiza przyczyn i działania korygujące','02 · Análisis de causas y medidas correctivas','02 · Analyse des causes et mesures correctives','02 · Analisi delle cause e misure correttive'],
['Festgestellte Ursache','Identified cause','Ustalona przyczyna','Causa determinada','Cause constatée','Causa accertata'],
['03 · Wirksamkeitsprüfung und Abschluss','03 · Effectiveness check and closure','03 · Weryfikacja skuteczności i zamknięcie','03 · Verificación de eficacia y cierre','03 · Vérification d’efficacité et clôture','03 · Verifica di efficacia e chiusura'],
['Wie wurde die Wirksamkeit nachgewiesen?','How was the effectiveness proven?','Jak potwierdzono skuteczność?','¿Cómo se demostró la eficacia?','Comment l’efficacité a-t-elle été prouvée ?','Come è stata dimostrata l’efficacia?'],
['Freigegeben durch','Approved by','Zatwierdzone przez','Aprobado por','Approuvé par','Approvato da'],
['Erstellt am','Created on','Utworzono dnia','Creado el','Créé le','Creato il'],
['Gemeldet durch','Reported by','Zgłoszone przez','Notificado por','Signalé par','Segnalato da'],
['Bericht erstellt am','Report created on','Raport utworzono dnia','Informe creado el','Rapport créé le','Rapporto creato il'],
['ENTWURF – NICHT ALS FREIGEGEBEN VERWENDEN','DRAFT – DO NOT USE AS APPROVED','PROJEKT – NIE UŻYWAĆ JAKO ZATWIERDZONEGO','BORRADOR – NO USAR COMO APROBADO','BROUILLON – NE PAS UTILISER COMME APPROUVÉ','BOZZA – NON USARE COME APPROVATO'],
['Gespeicherter Fallstand','Saved case status','Zapisany stan sprawy','Estado guardado del caso','État enregistré du cas','Stato salvato del caso'],
['Fehler ohne Titel','Error without title','Błąd bez tytułu','Error sin título','Erreur sans titre','Errore senza titolo'],
['Kein Zugriff auf das Qualitätsprotokoll: ','No access to the quality log: ','Brak dostępu do rejestru jakości: ','Sin acceso al registro de calidad: ','Pas d’accès au journal qualité : ','Nessun accesso al registro qualità: '],
[' Bitte in ExportHUB360 anmelden und die SOP-Berechtigung prüfen.',' Please sign in to ExportHUB360 and check the SOP permission.',' Zaloguj się w ExportHUB360 i sprawdź uprawnienie SOP.',' Inicie sesión en ExportHUB360 y compruebe el permiso SOP.',' Connectez-vous à ExportHUB360 et vérifiez l’autorisation SOP.',' Accedere a ExportHUB360 e verificare l’autorizzazione SOP.'],
['Verlauf geprüft: lückenlos verkettet','History checked: complete chain','Historia sprawdzona: łańcuch bez luk','Historial comprobado: cadena completa','Historique vérifié : chaîne complète','Cronologia verificata: catena completa'],
['{n} Anhänge gespeichert','{n} attachment(s) saved','Zapisano załączniki: {n}','{n} adjunto(s) guardado(s)','{n} pièce(s) jointe(s) enregistrée(s)','{n} allegato/i salvato/i'],
['Fehlgeschlagen','Failed','Niepowodzenie','Fallido','Échec','Non riuscito'],
['erstellt','created','utworzono','creado','créé','creato'],
['Version','Version','Wersja','Versión','Version','Versione'],
['Neue Abweichung mit eindeutiger Nummer erfassen','Record a new deviation with a unique number','Zarejestruj nowe odchylenie z unikalnym numerem','Registrar una nueva desviación con número único','Enregistrer un nouvel écart avec un numéro unique','Registrare una nuova deviazione con numero univoco'],
['Sprache','Language','Język','Idioma','Langue','Lingua'],
['Google hat Schlüssel oder Modell abgelehnt. Bitte Schlüssel und Modell-ID prüfen.','Google rejected the key or model. Please check the key and model ID.','Google odrzucił klucz lub model. Sprawdź klucz i identyfikator modelu.','Google rechazó la clave o el modelo. Compruebe la clave y el ID del modelo.','Google a refusé la clé ou le modèle. Vérifiez la clé et l’ID du modèle.','Google ha rifiutato la chiave o il modello. Verificare la chiave e l’ID del modello.'],
['Das kostenlose Google-Kontingent ist gerade erschöpft. Es werden die Regeln verwendet.','The free Google quota is currently exhausted. The rules are used instead.','Bezpłatny limit Google jest chwilowo wyczerpany. Używane są reguły.','La cuota gratuita de Google está agotada por ahora. Se usan las reglas.','Le quota gratuit de Google est actuellement épuisé. Les règles sont utilisées.','La quota gratuita di Google è al momento esaurita. Vengono usate le regole.'],
['Die KI hat zu lange gebraucht. Es werden die Regeln verwendet.','The AI took too long. The rules are used instead.','AI odpowiadało zbyt długo. Używane są reguły.','La IA tardó demasiado. Se usan las reglas.','L’IA a mis trop de temps. Les règles sont utilisées.','L’IA ha impiegato troppo tempo. Vengono usate le regole.'],
['KI-Vorschlag','AI suggestion','Propozycja AI','Sugerencia de IA','Suggestion de l’IA','Suggerimento IA'],
['KI-Vorschlag – fachlich prüfen. Gesendet wurden nur anonymisierte Fachfelder.','AI suggestion – check for suitability. Only anonymised technical fields were sent.','Propozycja AI – sprawdź merytorycznie. Wysłano tylko zanonimizowane pola merytoryczne.','Sugerencia de IA: revíselo técnicamente. Solo se enviaron campos técnicos anonimizados.','Suggestion de l’IA – à vérifier sur le fond. Seuls des champs techniques anonymisés ont été envoyés.','Suggerimento IA: verificare dal punto di vista tecnico. Sono stati inviati solo campi tecnici anonimizzati.'],
['Bitte keine Namen in Freitexte eintragen.','Please do not enter names in free-text fields.','Nie wpisuj imion i nazwisk w polach tekstowych.','No introduzca nombres en los campos de texto libre.','Veuillez ne pas saisir de noms dans les champs libres.','Non inserire nomi nei campi di testo libero.'],
['Bitte den Fall zuerst speichern, um einen KI-Vorschlag zu erhalten.','Please save the case first to get an AI suggestion.','Najpierw zapisz sprawę, aby otrzymać propozycję AI.','Guarde primero el caso para obtener una sugerencia de IA.','Veuillez d’abord enregistrer le cas pour obtenir une suggestion de l’IA.','Salvare prima il caso per ottenere un suggerimento IA.'],
['Heute genutzt: {used} von {limit}','Used today: {used} of {limit}','Wykorzystano dziś: {used} z {limit}','Usado hoy: {used} de {limit}','Utilisé aujourd’hui : {used} sur {limit}','Usato oggi: {used} su {limit}'],
['Die KI ist nicht eingerichtet, es werden die Regeln verwendet.','The AI is not set up; the rules are used instead.','AI nie jest skonfigurowana, używane są reguły.','La IA no está configurada; se usan las reglas.','L’IA n’est pas configurée ; les règles sont utilisées.','L’IA non è configurata; vengono usate le regole.'],
['Tageslimit der KI erreicht, es werden die Regeln verwendet.','Daily AI limit reached; the rules are used instead.','Osiągnięto dzienny limit AI, używane są reguły.','Se alcanzó el límite diario de IA; se usan las reglas.','Limite quotidienne de l’IA atteinte ; les règles sont utilisées.','Raggiunto il limite giornaliero dell’IA; vengono usate le regole.'],
['Regelbasierte Entscheidungshilfe – die KI ist gerade nicht verfügbar.','Rule-based decision aid – the AI is currently unavailable.','Pomoc oparta na regułach – AI jest obecnie niedostępna.','Ayuda basada en reglas: la IA no está disponible ahora.','Aide basée sur des règles – l’IA est actuellement indisponible.','Supporto basato su regole: l’IA al momento non è disponibile.'],
['Fehler melden','Report an error','Zgłoś błąd','Notificar un error','Signaler une erreur','Segnala un errore'],
['Sie haben keine Leseberechtigung für das Fehlerprotokoll. Sie können einen Fehler melden, die Leitung bearbeitet ihn.','You do not have permission to read the error log. You can report an error; management will process it.','Nie masz uprawnień do odczytu rejestru błędów. Możesz zgłosić błąd, a kierownictwo go obsłuży.','No tiene permiso para leer el registro de errores. Puede notificar un error y la dirección lo tramitará.','Vous n’avez pas le droit de lire le journal des erreurs. Vous pouvez signaler une erreur, la direction la traitera.','Non hai il permesso di leggere il registro errori. Puoi segnalare un errore, la direzione lo gestirà.'],
['Meldung gesendet. Nummer: {id}','Report sent. Number: {id}','Zgłoszenie wysłane. Numer: {id}','Notificación enviada. Número: {id}','Signalement envoyé. Numéro : {id}','Segnalazione inviata. Numero: {id}'],
['Senden fehlgeschlagen','Sending failed','Wysyłanie nie powiodło się','Error al enviar','Échec de l’envoi','Invio non riuscito'],
['(die ersten {n} Einträge stammen aus der Zeit vor der Verkettung)','(the first {n} entries date from before the chaining)','(pierwszych {n} wpisów pochodzi sprzed powiązania łańcuchowego)','(las primeras {n} entradas son anteriores al encadenamiento)','(les {n} premières entrées datent d’avant le chaînage)','(le prime {n} voci risalgono a prima del concatenamento)'],
['ab Eintrag {n}. Der Fall ist für Änderungen gesperrt und muss von der Leitung geprüft werden.','from entry {n}. The case is locked for changes and must be reviewed by management.','od wpisu {n}. Sprawa jest zablokowana do zmian i musi zostać sprawdzona przez kierownictwo.','desde la entrada {n}. El caso está bloqueado para cambios y debe revisarlo la dirección.','à partir de l’entrée {n}. Le cas est verrouillé et doit être contrôlé par la direction.','dalla voce {n}. Il caso è bloccato per modifiche e deve essere verificato dalla direzione.'],
['ANGELEGT','CREATED','UTWORZONO','CREADO','CRÉÉ','CREATO'],
['GEMELDET','REPORTED','ZGŁOSZONO','NOTIFICADO','SIGNALÉ','SEGNALATO'],
['AKTUALISIERT','UPDATED','ZAKTUALIZOWANO','ACTUALIZADO','MIS À JOUR','AGGIORNATO'],
['ERGAENZT','SUPPLEMENTED','UZUPEŁNIONO','COMPLETADO','COMPLÉTÉ','INTEGRATO'],
['ANHANG','ATTACHMENT','ZAŁĄCZNIK','ADJUNTO','PIÈCE JOINTE','ALLEGATO'],
['ABGESCHLOSSEN','CLOSED','ZAMKNIĘTO','CERRADO','CLÔTURÉ','CHIUSO'],
['WIEDEREROEFFNET','REOPENED','OTWARTO PONOWNIE','REABIERTO','ROUVERT','RIAPERTO']
];
var MAPS={};
LANGS.forEach(function(l,i){if(l==='de')return;var m={};T.forEach(function(row){m[row[0]]=row[i]});MAPS[l]=m});
function q(v){return String(v==null?'':v)}
function current(){
  var l='de';
  try{var p=new URL(w.location.href).searchParams.get('lang');if(p)l=p.toLowerCase()}catch(_){/* ohne URL-Parameter */}
  if(l==='de'){try{var s=w.localStorage.getItem('exporthub.language');if(s)l=s.toLowerCase()}catch(_){/* Speicher gesperrt */}}
  l=l.slice(0,2);return LANGS.indexOf(l)>=0?l:'de'
}
var lang=current();
function t(text,vars){
  var s=q(text),m=MAPS[lang],out=m&&m[s]!=null?m[s]:s;
  if(vars)Object.keys(vars).forEach(function(k){out=out.split('{'+k+'}').join(q(vars[k]))});
  return out
}
function translateText(node){
  var raw=node.nodeValue,trim=raw.trim();if(!trim)return;
  var m=MAPS[lang];if(!m||m[trim]==null)return;
  var next=raw.replace(trim,m[trim]);if(next!==raw)node.nodeValue=next
}
function translateAttrs(el){
  var m=MAPS[lang];if(!m||!el.getAttribute)return;
  ['placeholder','title','aria-label'].forEach(function(a){var v=el.getAttribute(a);if(v&&m[v]!=null&&m[v]!==v)el.setAttribute(a,m[v])})
}
function walk(root){
  if(!root||lang==='de')return;
  if(root.nodeType===3){translateText(root);return}
  if(root.nodeType!==1||/^(SCRIPT|STYLE|TEXTAREA)$/i.test(root.tagName))return;
  translateAttrs(root);
  for(var n=root.firstChild;n;n=n.nextSibling)walk(n)
}
function install(){
  d.documentElement.setAttribute('lang',lang);
  if(lang==='de'||!d.body)return;
  walk(d.body);
  if(w.MutationObserver)new MutationObserver(function(list){
    list.forEach(function(r){
      if(r.type==='characterData'){walk(r.target);return}
      Array.prototype.forEach.call(r.addedNodes,walk)
    })
  }).observe(d.body,{childList:true,subtree:true,characterData:true})
}
function setLanguage(l){
  l=LANGS.indexOf(l)>=0?l:'de';
  try{w.localStorage.setItem('exporthub.language',l)}catch(_){/* Speicher gesperrt */}
  var u=new URL(w.location.href);u.searchParams.set('lang',l);w.location.href=u.toString()
}
w.ExportHUBQualityI18n=Object.freeze({languages:LANGS.slice(),language:function(){return lang},t:t,setLanguage:setLanguage,walk:walk,entries:T});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window,document);
