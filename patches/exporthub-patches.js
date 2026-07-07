"use strict";
/*
  PRIVATE RC271: Externe Patch-Datei fuer ExportHUB.
  Einmalig in index.html vor </body> einbinden:
  <script src="patches/exporthub-patches.js"></script>

  Enthalten:
  - RC269 Academy Fachkraft Lagerlogistik
  - RC270 Sendung Aktionsleiste + Refordner + ABD Fix
*/
(function(){
  if (window.__EXPORTHUB_RC271_EXTERNAL_PATCHES__) return;
  window.__EXPORTHUB_RC271_EXTERNAL_PATCHES__ = true;

  function addRc271Style(id, css) {
    try {
      var safeId = String(id || "rc271-style").replace(/[^a-zA-Z0-9_-]/g, "-");
      if (document.getElementById(safeId)) return;
      var style = document.createElement("style");
      style.id = safeId;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    } catch (err) {
      console.error("RC271 style konnte nicht geladen werden", err);
    }
  }

  // ===== RC269 Academy Fachkraft Lagerlogistik =====
  
  addRc271Style("rc271-style-RC269 Academy Fachkraft Lagerlogistik", ".rc269-academy-note{\n  border:1px solid #86efac!important;\n  background:#f0fdf4!important;\n  color:#166534!important;\n  border-radius:12px!important;\n  padding:9px 11px!important;\n  margin:10px 0!important;\n  font-weight:900!important;\n}");
  
  /* PRIVATE RC269: Academy/Pruefung auf Ausbildung Fachkraft fuer Lagerlogistik bereinigen */
  (function(){
    if(window.__EXPORTHUB_RC269_LAGERLOGISTIK_ACADEMY__)return;
    window.__EXPORTHUB_RC269_LAGERLOGISTIK_ACADEMY__=true;
  
    function n269(v){
      return String(v==null?'':v).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9]+/g,' ')
        .trim();
    }
    function e269(v){
      try{if(typeof esc==='function')return esc(v)}catch(err){}
      return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]});
    }
    function questionText269(q){
      if(!q)return '';
      return [q.q,q.why,q.area,q.level,q.source,q.title,q.text,q.desc,q.summary].join(' ');
    }
    function blocked269(q){
      var txt=questionText269(q);
      return /\b(Essentra|ExportHUB|ATLAS|AEB|GPZ|SharePoint|Microsoft|Azure)\b/i.test(txt) ||
        /\bunser(e|en|em|er|es)?\b/i.test(txt) ||
        /unseren\s+Prozess|unsere\s+Prozess|unser\s+System|intern(e|er|en|es)?\s+(Prozess|System)/i.test(txt);
    }
    function cleanList269(list){
      var seen={};
      return (Array.isArray(list)?list:[]).filter(function(q){
        if(blocked269(q))return false;
        var key=n269(q&&q.q);
        if(!key||seen[key])return false;
        seen[key]=true;
        return true;
      });
    }
    function q269(q,a,correct,why,area,level){
      return {q:q,a:a,correct:correct,why:why,area:area||'Fachkraft fuer Lagerlogistik',level:level||'Basis'};
    }
    var lagerQuestions269=[
      q269('Was wird bei der Warenannahme zuerst geprueft?',['Ob die Lieferung zur Bestellung passt','Ob die Ware direkt eingelagert wird','Ob der LKW gewaschen ist','Ob der Preis auf der Ware steht'],0,'Bei der Warenannahme werden Bestellung, Lieferpapiere und sichtbarer Zustand geprueft.','Warenannahme','Basis'),
      q269('Welche Angaben stehen typischerweise auf einem Lieferschein?',['Absender, Empfaenger, Artikel, Menge','Nur Zahlungsziel','Nur Personalnummer','Nur Lagerplatz'],0,'Der Lieferschein beschreibt die gelieferte Ware und Menge.','Warenannahme','Basis'),
      q269('Was bedeutet eine Sichtpruefung im Wareneingang?',['Ware auf aeussere Schaeden und Abweichungen pruefen','Ware wiegen ohne Dokumente','Ware sofort versenden','Ware ohne Kontrolle einlagern'],0,'Sichtpruefung erkennt erkennbare Transportschaeden und falsche Packstuecke.','Wareneingangskontrolle','Basis'),
      q269('Was ist bei einer Mengenabweichung zu tun?',['Abweichung dokumentieren und klaeren','Menge selbst korrigieren und ignorieren','Ware entsorgen','Lieferpapiere wegwerfen'],0,'Mengenabweichungen muessen nachvollziehbar dokumentiert und geklaert werden.','Wareneingangskontrolle','Basis'),
      q269('Was bedeutet FIFO?',['First In, First Out','Fast Internal Freight Order','First Item For Order','Free In Freight Out'],0,'Zuerst eingelagerte Ware wird zuerst entnommen.','Lagerprinzipien','Basis'),
      q269('Wann ist FEFO besonders wichtig?',['Bei Waren mit Mindesthaltbarkeit oder Verfallsdatum','Bei Schrauben ohne Datum','Nur bei leeren Paletten','Nur bei Bueromaterial'],0,'FEFO steuert die Entnahme nach Ablauf- oder Mindesthaltbarkeitsdatum.','Lagerprinzipien','Mittel'),
      q269('Was ist ein Lagerplatz?',['Ein eindeutig definierter Ort zur Lagerung von Ware','Ein beliebiger Platz im Gang','Nur ein Parkplatz fuer LKW','Ein Papierformular'],0,'Eindeutige Lagerplaetze helfen beim Finden, Buchen und Kontrollieren von Ware.','Lagerorganisation','Basis'),
      q269('Warum sind Lagerplatzkennzeichnungen wichtig?',['Damit Ware eindeutig gefunden und gebucht werden kann','Damit Regale dekoriert sind','Damit Wege laenger werden','Damit Kommissionierung langsamer wird'],0,'Klare Kennzeichnung reduziert Suchzeiten und Fehlentnahmen.','Lagerorganisation','Basis'),
      q269('Was ist ein Barcode im Lager?',['Maschinenlesbare Kennzeichnung fuer Artikel oder Packstuecke','Eine Preisverhandlung','Ein Staplerbauteil','Ein Zollformular'],0,'Barcodes unterstuetzen schnelle und fehlerarme Identifikation.','Identifikation','Basis'),
      q269('Was ist eine Charge?',['Eine zusammenhaengende Herstell- oder Liefermenge','Ein Lagerfahrzeug','Eine Versandart','Ein Kundenrabatt'],0,'Chargen dienen der Rueckverfolgbarkeit.','Rueckverfolgbarkeit','Mittel'),
      q269('Was bedeutet Kommissionieren?',['Waren nach Auftrag zusammenstellen','Ware reinigen','Regal streichen','Frachtpreis berechnen'],0,'Beim Kommissionieren werden Artikel fuer einen Auftrag entnommen und bereitgestellt.','Kommissionierung','Basis'),
      q269('Welche Fehlerquelle ist beim Kommissionieren haeufig?',['Falscher Artikel oder falsche Menge','Zu sauberer Arbeitsplatz','Zu genaue Kontrolle','Zu kurze Wege'],0,'Artikel- und Mengenfehler gehoeren zu den typischen Kommissionierfehlern.','Kommissionierung','Basis'),
      q269('Was ist eine Pickliste?',['Liste der zu entnehmenden Artikel und Mengen','Liste der Mitarbeitenden im Urlaub','Liste der LKW-Kennzeichen','Liste der Rechnungen'],0,'Die Pickliste fuehrt durch die Kommissionierung.','Kommissionierung','Basis'),
      q269('Was bedeutet beleglose Kommissionierung?',['Kommissionierung mit digitalen Hilfsmitteln statt Papierliste','Kommissionierung ohne Auftrag','Kommissionierung ohne Ware','Kommissionierung ohne Kontrolle'],0,'Beleglose Verfahren nutzen Scanner, Terminals oder Pick-by-Systeme.','Kommissionierung','Mittel'),
      q269('Was ist Pick-by-Voice?',['Kommissionierung mit Sprachfuehrung','Kommissionierung nach Farbe','Kommissionierung nur mit Papier','Kommissionierung durch Gewicht'],0,'Bei Pick-by-Voice fuehren Sprachansagen durch den Auftrag.','Kommissionierung','Mittel'),
      q269('Was ist bei der Verpackung wichtig?',['Ware vor Transportbelastungen schuetzen','Moeglichst viel Luft verpacken','Dokumente entfernen','Packstuecke unbeschriftet lassen'],0,'Verpackung muss Produkt, Transportweg und Belastung beruecksichtigen.','Verpackung','Basis'),
      q269('Was ist eine transportsichere Verpackung?',['Verpackung, die Ware vor Stoss, Druck und Verrutschen schuetzt','Eine besonders grosse Verpackung','Eine Verpackung ohne Kennzeichnung','Eine Verpackung ohne Fuellmaterial'],0,'Transportsicherung verhindert Beschaedigung und Verlust.','Verpackung','Basis'),
      q269('Warum wird Fuellmaterial eingesetzt?',['Um Hohlraeume zu fuellen und Ware zu stabilisieren','Um Gewicht kuenstlich zu erhoehen','Um Etiketten zu ersetzen','Um Paletten zu sparen'],0,'Fuellmaterial reduziert Bewegung im Karton.','Verpackung','Basis'),
      q269('Was ist bei Gefahrgut grundsaetzlich erforderlich?',['Kennzeichnung, Vorschriften und passende Verpackung beachten','Immer normal verpacken','Ohne Dokumente versenden','Nur muendlich informieren'],0,'Gefahrgut unterliegt besonderen Vorschriften fuer Lagerung und Versand.','Gefahrgut','Schwer'),
      q269('Was bedeutet Ladungssicherung?',['Ladung so sichern, dass sie nicht verrutscht, kippt oder herabfaellt','Ware moeglichst locker verladen','Nur den Lieferschein unterschreiben','LKW offen lassen'],0,'Ladungssicherung schuetzt Menschen, Ware und Fahrzeug.','Ladungssicherung','Basis'),
      q269('Welche Hilfsmittel dienen der Ladungssicherung?',['Zurrgurte, Antirutschmatten, Kantenschutz','Kugelschreiber und Lineal','Scanner und Monitor','Preisschilder'],0,'Diese Hilfsmittel sichern Packstuecke gegen Bewegung.','Ladungssicherung','Mittel'),
      q269('Warum ist Gewichtsverteilung auf dem LKW wichtig?',['Fahrstabilitaet und Achslasten muessen eingehalten werden','Damit die Ware schoener aussieht','Damit weniger Etiketten noetig sind','Damit die Tour laenger dauert'],0,'Falsche Gewichtsverteilung kann gefaehrlich und unzulaessig sein.','Ladungssicherung','Mittel'),
      q269('Was ist eine Euro-Palette?',['Standardisierte Mehrwegpalette im Format 1200 x 800 mm','Ein Kartonformat','Ein Lieferpapier','Ein Versandetikett'],0,'Die Euro-Palette ist ein genormter Ladungstraeger.','Ladungstraeger','Basis'),
      q269('Woran erkennt man eine tauschfaehige Euro-Palette grundsaetzlich?',['Sie ist intakt und entspricht den Tauschbedingungen','Sie ist gebrochen','Sie hat fehlende Kloetze','Sie ist stark verschmutzt und instabil'],0,'Nur intakte Paletten koennen sicher verwendet und getauscht werden.','Ladungstraeger','Mittel'),
      q269('Was ist ein Ladungstraeger?',['Hilfsmittel zum Lagern und Transportieren von Ware','Ein Zollcode','Eine Rechnung','Ein Mitarbeiter-Ausweis'],0,'Paletten, Gitterboxen und Behaelter sind typische Ladungstraeger.','Ladungstraeger','Basis'),
      q269('Was bedeutet Inventur?',['Bestand erfassen und mit Buchbestand vergleichen','Ware direkt verkaufen','Nur Regale reinigen','Auftraege kommissionieren'],0,'Inventur stellt Istbestand und Buchbestand gegenueber.','Inventur','Basis'),
      q269('Was ist eine permanente Inventur?',['Bestandsaufnahme verteilt ueber das Jahr','Inventur nur alle zehn Jahre','Inventur ohne Dokumentation','Inventur nur bei Warenausgang'],0,'Permanente Inventur verteilt die Bestandspruefung ueber das Jahr.','Inventur','Mittel'),
      q269('Was ist eine Stichprobeninventur?',['Bestandsermittlung mit statistischen Stichproben','Zaehlen jeder Schraube ohne Ausnahme','Nur Schaeden erfassen','Nur leere Lagerplaetze pruefen'],0,'Stichprobeninventur nutzt anerkannte statistische Verfahren.','Inventur','Schwer'),
      q269('Was ist ein Sicherheitsbestand?',['Reservebestand zur Absicherung gegen Schwankungen','Bestand in einem Tresor','Beschaedigte Ware','Nicht buchbare Ware'],0,'Sicherheitsbestand hilft bei Liefer- oder Bedarfsschwankungen.','Bestandsmanagement','Mittel'),
      q269('Was bedeutet Meldebestand?',['Bestandshoehe, bei der nachbestellt werden soll','Maximaler Lagerplatz','Anzahl der Mitarbeitenden','Gewicht einer Palette'],0,'Beim Erreichen des Meldebestands wird Nachschub ausgeloest.','Bestandsmanagement','Mittel'),
      q269('Welche Formel beschreibt den Meldebestand vereinfacht?',['Tagesverbrauch x Lieferzeit + Sicherheitsbestand','Gewicht x Volumen','Artikelnummer + Lagerplatz','Preis x Rabatt'],0,'Der Meldebestand beruecksichtigt Verbrauch, Lieferzeit und Reserve.','Bestandsmanagement','Schwer'),
      q269('Was ist der Mindestbestand?',['Bestand, der nicht unterschritten werden sollte','Bestand direkt nach Wareneingang','Menge im Versandkarton','Maximale Regalhoehe'],0,'Der Mindestbestand sichert die Lieferfaehigkeit ab.','Bestandsmanagement','Mittel'),
      q269('Was bedeutet Lagerumschlagshaeufigkeit?',['Wie oft sich der durchschnittliche Lagerbestand in einer Periode erneuert','Wie oft ein Stapler gewartet wird','Wie oft ein Tor geoeffnet wird','Wie viele Mitarbeitende im Lager arbeiten'],0,'Die Kennzahl zeigt, wie schnell Lagerbestand umgesetzt wird.','Lagerkennzahlen','Schwer'),
      q269('Was ist die durchschnittliche Lagerdauer?',['Zeit, die Ware durchschnittlich im Lager bleibt','Dauer einer Pause','Zeit zum Drucken eines Lieferscheins','Fahrzeit eines LKW'],0,'Sie zeigt Kapitalbindung und Lagergeschwindigkeit.','Lagerkennzahlen','Schwer'),
      q269('Warum sind Lagerkennzahlen wichtig?',['Sie helfen, Leistung und Wirtschaftlichkeit zu beurteilen','Sie ersetzen jede Kontrolle','Sie verhindern jede Stoerung','Sie sind nur Dekoration'],0,'Kennzahlen machen Lagerprozesse messbar.','Lagerkennzahlen','Mittel'),
      q269('Was bedeutet Ergonomie im Lager?',['Arbeitsplaetze und Bewegungen gesundheitsschonend gestalten','Moeglichst schwer heben','Wege blockieren','Sicherheitsregeln ignorieren'],0,'Ergonomie reduziert Belastung und Unfallrisiken.','Arbeitssicherheit','Basis'),
      q269('Welche persoenliche Schutzausruestung ist im Lager oft wichtig?',['Sicherheitsschuhe und Warnweste','Sandalen','Kopfhörer mit lauter Musik','Schmuck an Maschinen'],0,'PSA richtet sich nach Taetigkeit und Gefaehrdung.','Arbeitssicherheit','Basis'),
      q269('Was ist beim Fahren mit Flurfoerderzeugen wichtig?',['Berechtigung, Sicht, Geschwindigkeit und sichere Fahrweise','Immer schnell fahren','Last hoch angehoben transportieren','Personen mitnehmen'],0,'Flurfoerderzeuge duerfen nur sicher und regelkonform genutzt werden.','Flurfoerderzeuge','Basis'),
      q269('Warum wird eine Last beim Staplertransport niedrig gefuehrt?',['Fuer bessere Stabilitaet und Sicht','Damit sie besser aussieht','Damit sie leichter wird','Damit sie nicht gescannt wird'],0,'Niedrige Lastfuehrung senkt Kipp- und Unfallgefahr.','Flurfoerderzeuge','Mittel'),
      q269('Was ist die Tragfaehigkeit eines Staplers?',['Maximal zulaessige Last unter bestimmten Bedingungen','Die Geschwindigkeit im Gang','Die Batteriekapazitaet in Minuten','Die Laenge der Gabeln'],0,'Tragfaehigkeit haengt auch vom Lastschwerpunkt ab.','Flurfoerderzeuge','Schwer'),
      q269('Was ist ein Lastschwerpunkt?',['Punkt, an dem die Gewichtskraft einer Last wirkt','Ort des Lieferscheins','Name des Fahrers','Hoehe des Regals'],0,'Der Lastschwerpunkt beeinflusst die Standsicherheit.','Flurfoerderzeuge','Schwer'),
      q269('Was ist bei Regalbelastungen zu beachten?',['Zulaessige Fach- und Feldlast einhalten','Last beliebig stapeln','Nur schwere Ware oben lagern','Schilder entfernen'],0,'Regale duerfen nicht ueberlastet werden.','Lagertechnik','Mittel'),
      q269('Was ist eine Fachlast?',['Maximal zulaessige Belastung eines Regalfachs','Gewicht eines Mitarbeiters','Menge auf einem Lieferschein','Traglast eines Kartons'],0,'Die Fachlast bezieht sich auf ein einzelnes Fach.','Lagertechnik','Schwer'),
      q269('Was ist eine Feldlast?',['Maximal zulaessige Belastung eines Regalfeldes','Gewicht eines Scanners','Preis einer Palette','Anzahl der Tore'],0,'Die Feldlast betrifft ein ganzes Regalfeld.','Lagertechnik','Schwer'),
      q269('Was ist ein Hochregallager?',['Lager mit hohen Regalstrukturen fuer grosse Lagermengen','Ein Lager nur fuer kleine Kartons','Ein Bueroarchiv','Ein LKW-Parkplatz'],0,'Hochregallager nutzen Raumhoehe effizient.','Lagerarten','Mittel'),
      q269('Was ist ein Blocklager?',['Lagerung direkt auf dem Boden in Bloecken','Lagerung nur im Computer','Ein Lager ohne Ware','Ein Lager nur fuer Akten'],0,'Blocklager eignet sich fuer stapelbare, gleichartige Ware.','Lagerarten','Basis'),
      q269('Was ist ein Durchlaufregal?',['Regal, bei dem Ware auf einer Seite eingelagert und auf anderer Seite entnommen wird','Regal ohne Kennzeichnung','Regal fuer defekte Ware','Regal nur fuer Werkzeuge'],0,'Durchlaufregale unterstuetzen FIFO.','Lagerarten','Mittel'),
      q269('Was ist Cross-Docking?',['Ware wird ohne lange Lagerung direkt umgeschlagen','Ware wird dauerhaft eingelagert','Ware wird vernichtet','Ware wird ohne Auftrag bewegt'],0,'Cross-Docking reduziert Lagerzeit und Umschlagwege.','Umschlag','Schwer'),
      q269('Was bedeutet Umschlag im Lager?',['Warenbewegung zwischen Anlieferung, Lagerung und Versand','Nur das Umdrehen eines Kartons','Eine Rechnungskopie','Eine Schichtplanung'],0,'Umschlag beschreibt physische Warenbewegungen.','Umschlag','Basis'),
      q269('Was ist ein Warenausgang?',['Bereich, in dem Ware fuer den Versand bereitgestellt und kontrolliert wird','Ort der Personalakten','Ort der Reparaturwerkzeuge','Bereich nur fuer Wareneingang'],0,'Im Warenausgang werden Sendungen versandfertig gemacht.','Warenausgang','Basis'),
      q269('Was wird vor dem Versand geprueft?',['Richtige Ware, Menge, Verpackung, Kennzeichnung und Dokumente','Nur die Farbe des Kartons','Nur die Pausenzeit','Nur das Wetter'],0,'Versandkontrolle verhindert Fehl- und Falschlieferungen.','Warenausgang','Basis'),
      q269('Was ist ein Versandetikett?',['Kennzeichnung mit Empfaenger- und Transportinformationen','Ein Preisschild im Regal','Eine Inventurliste','Ein Staplerschein'],0,'Versandetiketten steuern Transport und Zustellung.','Versand','Basis'),
      q269('Warum sind saubere Stammdaten wichtig?',['Sie vermeiden Fehler bei Lagerung, Kommissionierung und Versand','Sie sind nur fuer Buchhaltung wichtig','Sie ersetzen jede Sichtpruefung','Sie verhindern jeden Schaden'],0,'Artikel-, Mengen- und Verpackungsdaten beeinflussen viele Arbeitsschritte.','Stammdaten','Mittel'),
      q269('Was ist eine Retourenbearbeitung?',['Ruecksendungen annehmen, pruefen, bewerten und buchen','Neue Ware bestellen','Ware ohne Kontrolle weglegen','Nur den Fahrer informieren'],0,'Retouren muessen eindeutig erfasst und bewertet werden.','Retouren','Mittel'),
      q269('Was ist bei beschaedigter Ware wichtig?',['Kennzeichnen, sperren, dokumentieren und klaeren','Einfach normal einlagern','Etikett entfernen','Sofort kommissionieren'],0,'Beschaedigte Ware darf nicht unkontrolliert in den Bestand.','Qualitaet','Basis'),
      q269('Was bedeutet Sperrbestand?',['Bestand, der nicht frei verwendet werden darf','Besonders schneller Bestand','Bestand ohne Lagerplatz','Ware im Warenausgang'],0,'Sperrbestand wartet auf Klaerung oder Freigabe.','Qualitaet','Mittel'),
      q269('Warum ist Ordnung und Sauberkeit im Lager wichtig?',['Sicherheit, Qualitaet und effiziente Arbeit','Nur fuer Besucher','Damit weniger Ware vorhanden ist','Damit Inventur entfaellt'],0,'Ordnung reduziert Suchzeiten, Fehler und Unfallrisiken.','Arbeitssicherheit','Basis'),
      q269('Was bedeutet 5S im Lager?',['Methode zur Ordnung, Sauberkeit und Standardisierung','Fuenf Versandarten','Fuenf Staplergroessen','Fuenf Lieferanten'],0,'5S strukturiert Arbeitsplaetze und Ablaeufe.','Arbeitsorganisation','Mittel'),
      q269('Was ist eine Tourenplanung?',['Planung der Reihenfolge und Auslastung von Transporten','Sortierung von Regaletiketten','Planung der Inventurzaehlung','Auswahl von Arbeitsschuhen'],0,'Tourenplanung hilft, Transporte wirtschaftlich und termingerecht durchzufuehren.','Transport','Mittel'),
      q269('Was bedeutet Nachhaltigkeit in der Logistik?',['Ressourcen schonen, Abfall vermeiden und Transporte effizient gestalten','Mehr Verpackung verwenden','Leere Fahrten erhoehen','Ware unkontrolliert entsorgen'],0,'Nachhaltigkeit senkt Kosten und Umweltbelastung.','Nachhaltigkeit','Basis'),
      q269('Wie kann Verpackungsabfall reduziert werden?',['Passende Verpackungsgroessen und Mehrwegloesungen nutzen','Immer groesste Kartons verwenden','Fuellmaterial verdoppeln','Etiketten weglassen'],0,'Passende Verpackung reduziert Material und Volumen.','Nachhaltigkeit','Mittel'),
      q269('Was ist bei der Lagerung schwerer Ware sinnvoll?',['Schwere Ware moeglichst unten und sicher lagern','Schwere Ware oben auf instabile Regale legen','Schwere Ware in Verkehrswege stellen','Schwere Ware ohne Kennzeichnung lagern'],0,'Tiefe Lagerung verbessert Stabilitaet und Arbeitssicherheit.','Lagertechnik','Basis'),
      q269('Was bedeutet ABC-Analyse?',['Einteilung von Artikeln nach Bedeutung oder Wertanteil','Alphabetische Sortierung aller Regale','Zaehlen von drei Kartons','Bewertung von Pausenzeiten'],0,'ABC-Analyse priorisiert wichtige Artikel.','Bestandsmanagement','Schwer'),
      q269('Was bedeutet XYZ-Analyse?',['Einteilung nach Verbrauchsverlauf oder Vorhersagbarkeit','Sortierung nach Farben','Bewertung von Verpackungen','Zaehlung von Versandetiketten'],0,'XYZ-Analyse unterscheidet regelmaessige und schwankende Verbraeuche.','Bestandsmanagement','Schwer'),
      q269('Was ist der Unterschied zwischen Brutto- und Nettogewicht?',['Brutto inklusive Verpackung, Netto ohne Verpackung','Brutto ohne Ware, Netto mit Palette','Beides ist immer gleich','Netto ist immer hoeher'],0,'Bruttogewicht enthaelt Verpackung, Nettogewicht die Ware selbst.','Versand','Basis'),
      q269('Was ist das Tara-Gewicht?',['Gewicht der Verpackung oder des Ladungstraegers','Gewicht der Ware ohne Verpackung','Gewicht des Fahrers','Gewicht des Lieferscheins'],0,'Tara wird zur Ermittlung von Netto- oder Bruttogewicht genutzt.','Versand','Mittel'),
      q269('Was ist bei zerbrechlicher Ware wichtig?',['Geeignete Schutzverpackung und Kennzeichnung','Lose auf Palette legen','Ohne Fuellmaterial versenden','Unter schwere Ware stapeln'],0,'Empfindliche Ware braucht besonderen Schutz.','Verpackung','Basis'),
      q269('Was bedeutet Rueckverfolgbarkeit?',['Nachvollziehen, woher Ware kommt und wohin sie gegangen ist','Ware schneller verpacken','Regale neu streichen','Preise vergleichen'],0,'Rueckverfolgbarkeit ist bei Qualitaet und Reklamationen wichtig.','Rueckverfolgbarkeit','Mittel'),
      q269('Was ist eine Null-Fehler-Kommissionierung als Ziel?',['Fehler bei Artikel, Menge und Auftrag vermeiden','Moeglichst schnell ohne Kontrolle arbeiten','Keine Etiketten verwenden','Nur grosse Auftraege bearbeiten'],0,'Qualitaet in der Kommissionierung senkt Reklamationen.','Kommissionierung','Mittel'),
      q269('Was ist ein Kanban-Prinzip vereinfacht?',['Nachschub wird durch Verbrauchssignal ausgeloest','Nachschub erfolgt zufaellig','Bestand wird nie ergaenzt','Ware wird ohne Kennzeichnung bewegt'],0,'Kanban steuert Materialfluss ueber Signale.','Materialfluss','Schwer'),
      q269('Was beschreibt der Materialfluss?',['Weg der Ware durch Wareneingang, Lager, Kommissionierung und Versand','Nur Geldfluss','Nur Personalplanung','Nur Druckerwartung'],0,'Materialfluss zeigt physische Warenbewegungen.','Materialfluss','Basis'),
      q269('Was ist ein Engpass im Lager?',['Stelle, die den gesamten Ablauf verlangsamt','Ein leerer Karton','Ein neuer Lagerplatz','Ein Zusatzetikett'],0,'Engpaesse begrenzen die Leistung des Gesamtprozesses.','Arbeitsorganisation','Mittel'),
      q269('Was ist bei der Arbeit im Verkehrsweg verboten?',['Verkehrswege zustellen oder blockieren','Wege freihalten','Markierungen beachten','Sichtkontakt herstellen'],0,'Freie Verkehrswege sind fuer Sicherheit und Ablauf notwendig.','Arbeitssicherheit','Basis'),
      q269('Was ist beim Heben von Lasten zu beachten?',['Ruecken schonen, Last nah am Koerper, Hilfsmittel nutzen','Mit rundem Ruecken ruckartig heben','Immer alleine heben','Last weit vom Koerper halten'],0,'Richtiges Heben reduziert Verletzungsrisiken.','Arbeitssicherheit','Basis'),
      q269('Warum sind klare Schnittstellen zwischen Wareneingang und Lager wichtig?',['Damit Verantwortlichkeiten und Warenstatus eindeutig sind','Damit Ware laenger wartet','Damit niemand dokumentiert','Damit mehr Suchaufwand entsteht'],0,'Klare Uebergaben verhindern Fehlbuchungen und Suchzeiten.','Arbeitsorganisation','Mittel')
    ];
  
    var module269={
      id:'rc269-fachkraft-lagerlogistik',
      title:'Ausbildung Fachkraft fuer Lagerlogistik',
      summary:'Neutrale Lerninhalte fuer Azubis: Warenannahme, Lagerung, Kommissionierung, Verpackung, Versand, Sicherheit und Kennzahlen.',
      lessons:[
        {title:'Wareneingang und Kontrolle',text:'Lieferpapiere, Sichtpruefung, Mengenpruefung, Abweichungen dokumentieren.'},
        {title:'Lagerung und Bestandsfuehrung',text:'Lagerplaetze, FIFO/FEFO, Bestandsarten, Inventur und Rueckverfolgbarkeit.'},
        {title:'Kommissionierung und Verpackung',text:'Pickliste, Fehlervermeidung, Packmittel, transportsichere Verpackung.'},
        {title:'Versand und Ladungssicherung',text:'Warenausgangskontrolle, Versandetiketten, Paletten, Ladungssicherung.'},
        {title:'Arbeitssicherheit und Kennzahlen',text:'PSA, Verkehrswege, Flurfoerderzeuge, Lagerumschlag und Lagerdauer.'}
      ]
    };
  
    function applyRc269(){
      try{
        if(typeof SEED==='undefined'||!SEED)return;
        SEED.quiz=cleanList269(SEED.quiz);
        var existingQuiz={};
        SEED.quiz.forEach(function(q){existingQuiz[n269(q.q)]=true});
        lagerQuestions269.forEach(function(q){if(!existingQuiz[n269(q.q)]){SEED.quiz.push(q);existingQuiz[n269(q.q)]=true}});
  
        SEED.exerciseAreas=(Array.isArray(SEED.exerciseAreas)?SEED.exerciseAreas:[]).map(function(area){
          var x=Object.assign({},area);
          x.exercises=cleanList269(x.exercises);
          return x;
        }).filter(function(area){
          return !blocked269(area)&&Array.isArray(area.exercises)&&area.exercises.length>0;
        });
        var area=SEED.exerciseAreas.find(function(a){return a.id==='rc269-lagerlogistik'});
        if(!area){
          SEED.exerciseAreas.unshift({
            id:'rc269-lagerlogistik',
            title:'Fachkraft fuer Lagerlogistik',
            source:'Ausbildung',
            exercises:[]
          });
          area=SEED.exerciseAreas[0];
        }
        var seenArea={};
        area.exercises=cleanList269(area.exercises);
        area.exercises.forEach(function(q){seenArea[n269(q.q)]=true});
        lagerQuestions269.forEach(function(q){if(!seenArea[n269(q.q)]){area.exercises.push(q);seenArea[n269(q.q)]=true}});
  
        SEED.academyModules=Array.isArray(SEED.academyModules)?SEED.academyModules:(Array.isArray(SEED.academy)?SEED.academy:[]);
        SEED.academyModules=SEED.academyModules.filter(function(m){return !blocked269(m)});
        if(!SEED.academyModules.some(function(m){return m.id===module269.id})){
          SEED.academyModules.unshift(module269);
        }
        SEED.academy=SEED.academyModules;
        SEED.rc269LagerlogistikApplied=true;
      }catch(err){}
    }
    function addNote269(){
      try{
        var s=(typeof state!=='undefined'&&state)?state:null;
        if(!s||!/(academy|quiz|practice)/i.test(String(s.view||'')))return;
        if(document.getElementById('rc269AcademyNote'))return;
        var target=document.querySelector('.page-head')||document.querySelector('#content,.main,main');
        if(!target)return;
        var div=document.createElement('div');
        div.id='rc269AcademyNote';
        div.className='rc269-academy-note';
        div.textContent='Academy Logistik: neutraler Ausbildungsfragenpool fuer Fachkraft fuer Lagerlogistik. Interne Essentra-/System-/ATLAS-Fragen wurden entfernt.';
        target.insertAdjacentElement('afterend',div);
      }catch(err){}
    }
    applyRc269();
    var baseRender=window.render || (typeof render==='function'?render:null);
    if(typeof baseRender==='function'&&!baseRender.__rc269Wrapped){
      window.render=function(){
        applyRc269();
        var r=baseRender.apply(this,arguments);
        setTimeout(addNote269,60);
        return r;
      };
      window.render.__rc269Wrapped=true;
      try{render=window.render}catch(err){}
    }
    setTimeout(function(){applyRc269();addNote269()},100);
    setTimeout(function(){applyRc269();addNote269()},900);
  })();
  
  // ===== Ende RC269 Academy Fachkraft Lagerlogistik =====
  
  // ===== RC270 Sendung Aktionsleiste Refordner ABD Fix =====
  
  addRc271Style("rc271-style-RC270 Sendung Aktionsleiste Refordner ABD Fix", "#rc270ColliActions{\n  display:flex!important;\n  gap:8px!important;\n  flex-wrap:wrap!important;\n  align-items:center!important;\n  margin:12px 0!important;\n  padding:10px!important;\n  border:1px solid #bfdbfe!important;\n  background:#eff6ff!important;\n  border-radius:12px!important;\n}\n#rc270ColliActions button{\n  display:inline-flex!important;\n  visibility:visible!important;\n  opacity:1!important;\n  min-height:38px!important;\n  align-items:center!important;\n}\n#rc270ColliActions .btn{\n  background:linear-gradient(135deg,#2563eb,#05b8ff)!important;\n  color:#fff!important;\n  border:0!important;\n}\n#rc270ColliActions .ghost{\n  background:#fff!important;\n  color:#334155!important;\n  border:1px solid #dbeafe!important;\n}\n.rc270-action-note{\n  font-size:12px!important;\n  font-weight:850!important;\n  color:#1e3a8a!important;\n}\n#rc270RefBox{\n  display:block!important;\n  border:1px solid #bfdbfe!important;\n  background:#eff6ff!important;\n  border-radius:12px!important;\n  padding:9px!important;\n  margin:8px 0 12px!important;\n}\n.rc270-ref-title{\n  font-weight:1000!important;\n  color:#08245d!important;\n  margin-bottom:7px!important;\n}\n.rc270-ref-actions{\n  display:flex!important;\n  gap:8px!important;\n  flex-wrap:wrap!important;\n}\n.rc270-ref-actions button{\n  min-height:34px!important;\n}\n.rc270-hidden{\n  display:none!important;\n}\n#rc268ColliActions,\n.rc246-ref-doc-box,\n#rc258RefUploadBar,\n#rc259RefFolderBar,\n#rc260RefFolderBar,\n#rc265RefBox{\n  display:none!important;\n}");
  
  /* PRIVATE RC270: Speicherbutton zurueck, ABD klickbar, Refordner an Lieferschein-Textfeld */
  (function(){
    if(window.__EXPORTHUB_RC270_SENDUNG_ACTION_FIX__)return;
    window.__EXPORTHUB_RC270_SENDUNG_ACTION_FIX__=true;
  
    function st270(){try{return typeof state!=='undefined'&&state?state:null}catch(err){return null}}
    function view270(){var s=st270();return String((s&&s.view)||'')}
    function e270(v){
      try{if(typeof esc==='function')return esc(v)}catch(err){}
      return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]});
    }
    function n270(v){
      return String(v==null?'':v).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9]+/g,' ')
        .trim();
    }
    function ref270(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,24)}
    function currentShipment270(){
      var s=st270();
      if(!s)return null;
      try{
        if(s.activeShipmentId&&s.activeShipmentId!=='current'){
          var found=(s.shipments||[]).find(function(x){return String(x.id)===String(s.activeShipmentId)});
          if(found)return found;
        }
      }catch(err){}
      return s.shipment||null;
    }
    function text270(el){return String((el&&el.textContent)||'').replace(/\s+/g,' ').trim()}
    function findColliCard270(){
      var heads=Array.from(document.querySelectorAll('h2,h3,h4'));
      var h=heads.find(function(x){return /Collis,\s*Ma|Collis,\s*Masse|Collis,\s*Maße/i.test(x.textContent||'')});
      if(h){
        var card=h.closest('.card,section,article,div');
        if(card)return card;
      }
      var rowBox=document.getElementById('rowsBox');
      return rowBox&&rowBox.closest('.card,section,article,div');
    }
    function findGoodsField270(){
      return Array.from(document.querySelectorAll('label.field,label,.field')).find(function(el){
        return /Warenbeschreibung\s*fuer\s*CMR\s*Feld\s*9|Warenbeschreibung\s*für\s*CMR\s*Feld\s*9/i.test(el.textContent||'');
      })||null;
    }
    function findDeliveryManual270(){
      return Array.from(document.querySelectorAll('label.field,label,.field')).find(function(el){
        return /Lieferscheine\s*\/\s*DNCs\s*manuell/i.test(el.textContent||'');
      })||null;
    }
    function removeWrongBars270(){
      Array.from(document.querySelectorAll('#rc268ColliActions,.rc246-ref-doc-box,#rc258RefUploadBar,#rc259RefFolderBar,#rc260RefFolderBar,#rc265RefBox')).forEach(function(el){
        el.classList.add('rc270-hidden');
        el.style.display='none';
      });
    }
    function hideDuplicateButtons270(){
      if(view270()!=='shipment')return;
      Array.from(document.querySelectorAll('button,a')).forEach(function(el){
        if(el.closest&&el.closest('#rc270ColliActions'))return;
        if(el.closest&&el.closest('#rc265AbdPanel'))return;
        var txt=text270(el);
        if(/^(CMR\/Ladeliste Vorschau|Ladeliste\/CMR Vorschau)$/i.test(txt) ||
           /^ABD erstellen$/i.test(txt) ||
           /^ABD Anfrage$/i.test(txt) ||
           /^ABD Anfrage an GPZ$/i.test(txt)){
          el.classList.add('rc270-hidden');
        }
        if(/Sendung speichern.*Aufgaben/i.test(txt)){
          el.classList.add('rc270-hidden');
        }
      });
    }
    function ensureActions270(){
      if(view270()!=='shipment')return;
      var card=findColliCard270();
      if(!card)return;
      var bar=document.getElementById('rc270ColliActions');
      if(!bar){
        bar=document.createElement('div');
        bar.id='rc270ColliActions';
        var anchor=card.querySelector('.summaryGrid') ||
          Array.from(card.querySelectorAll('.okbox,.badbox,.notice')).find(function(x){return /Colli-Daten|Sendungsdaten|Collis/i.test(x.textContent||'')}) ||
          card.querySelector('button');
        if(anchor)anchor.insertAdjacentElement('afterend',bar);
        else card.appendChild(bar);
      }
      bar.innerHTML=
        '<button type="button" class="btn" onclick="return rc270SaveShipment()">Sendung speichern + Aufgaben pruefen</button>'+
        '<button type="button" class="ghost" onclick="return rc270ShowCmr()">Ladeliste/CMR Vorschau</button>'+
        '<button type="button" class="ghost" onclick="return rc270OpenAbd()">ABD erstellen</button>'+
        '<span class="rc270-action-note">Aktionen fuer diese Sendung</span>';
    }
    window.rc270SaveShipment=function(){
      try{if(typeof saveShipment==='function'){saveShipment();return false}}catch(err){}
      alert('Speicherfunktion nicht gefunden.');
      return false;
    };
    window.rc270ShowCmr=function(){
      try{if(typeof showCurrentCmr==='function'){showCurrentCmr();return false}}catch(err){}
      try{if(typeof setView==='function'){setView('cmr');return false}}catch(err){}
      return false;
    };
    window.rc270OpenAbd=function(){
      try{
        if(typeof rc265OpenAbdPanel==='function'){
          rc265OpenAbdPanel();
          setTimeout(moveAbd270,80);
          setTimeout(moveAbd270,250);
          return false;
        }
      }catch(err){}
      try{
        if(typeof rc260OpenAbdRequest==='function'){
          rc260OpenAbdRequest();
          setTimeout(moveAbd270,120);
          return false;
        }
      }catch(err){}
      alert('ABD-Funktion nicht gefunden. Bitte RC265 vor RC270 einfuegen.');
      return false;
    };
    function moveAbd270(){
      if(view270()!=='shipment')return;
      var panel=document.getElementById('rc265AbdPanel') || document.querySelector('.rc265-abd-request-panel');
      var goods=findGoodsField270();
      if(panel){
        panel.classList.remove('rc270-hidden');
        panel.style.display='block';
        if(goods&&panel.previousElementSibling!==goods){
          goods.insertAdjacentElement('afterend',panel);
        }
        Array.from(panel.querySelectorAll('h3')).forEach(function(h){
          if(/ABD Anfrage/i.test(h.textContent||''))h.textContent='ABD Anfrage an GPZ';
        });
      }
    }
    window.rc270OpenReferenceFolder=function(){
      try{if(typeof rc265OpenReferenceFolder==='function')return rc265OpenReferenceFolder()}catch(err){}
      try{if(typeof rc246OpenReferenceFolder==='function')return rc246OpenReferenceFolder()}catch(err){}
      try{if(typeof rc260OpenReferenceFolder==='function')return rc260OpenReferenceFolder()}catch(err){}
      var r=ref270(currentShipment270()&&currentShipment270().ref);
      if(!r){alert('Bitte zuerst eine Referenznummer erstellen.');return false}
      window.open('https://essentra-my.sharepoint.com/:f:/r/personal/tobiaslimberg_essentra_com/Documents/003%20Export/ExportHub/Sendungen/'+encodeURIComponent(r)+'?csf=1&web=1','_blank','noopener,noreferrer');
      return false;
    };
    window.rc270ImportReferenceFolder=function(){
      try{if(typeof rc246OpenReferenceFolderPicker==='function')return rc246OpenReferenceFolderPicker()}catch(err){}
      try{if(typeof rc265ImportReferenceFolder==='function')return rc265ImportReferenceFolder()}catch(err){}
      alert('Ordneruebernahme nicht geladen. Bitte RC246 oder RC265 vor RC270 einfuegen.');
      return false;
    };
    function ensureRefBox270(){
      if(view270()!=='shipment')return;
      if(document.getElementById('rc270RefBox'))return;
      var target=findDeliveryManual270();
      if(!target)return;
      var r=ref270(currentShipment270()&&currentShipment270().ref);
      target.insertAdjacentHTML('afterend',
        '<div id="rc270RefBox">'+
        '<div class="rc270-ref-title">Referenzordner '+e270(r||'noch keine Referenz')+'</div>'+
        '<div class="rc270-ref-actions">'+
        '<button type="button" class="ghost" onclick="return rc270OpenReferenceFolder()">Ref.-Ordner oeffnen</button>'+
        '<button type="button" class="soft" onclick="return rc270ImportReferenceFolder()">Dateien aus Ref.-Ordner uebernehmen</button>'+
        '</div>'+
        '<div class="small">Diese Buttons gehoeren zu Lieferscheine / DNCs manuell.</div>'+
        '</div>');
    }
    function afterRender270(){
      removeWrongBars270();
      if(view270()==='shipment'){
        ensureActions270();
        hideDuplicateButtons270();
        ensureRefBox270();
        moveAbd270();
      }
    }
    var baseRender=window.render || (typeof render==='function'?render:null);
    if(typeof baseRender==='function'&&!baseRender.__rc270Wrapped){
      window.render=function(){
        var r=baseRender.apply(this,arguments);
        setTimeout(afterRender270,60);
        setTimeout(afterRender270,260);
        return r;
      };
      window.render.__rc270Wrapped=true;
      try{render=window.render}catch(err){}
    }
    setTimeout(afterRender270,120);
    setTimeout(afterRender270,700);
    setTimeout(afterRender270,1600);
  })();
  
  // ===== Ende RC270 Sendung Aktionsleiste Refordner ABD Fix =====
})();

/*
  PRIVATE RC272: Layout-/Workflow-Korrektur nach RC271
  - Referenzordner in den Lieferschein-Uploadbereich verschieben
  - Standardmail unter Collis und im Kundenordner nach Kontakte platzieren
  - ABD Anfrage wieder als Mailformular unter Sendung erstellen
  - ABD Anfrage mit Referenz verknuepfen
  - Palettenkonto-Beschriftung/Datumseingang stabilisieren
  - Academy auf Ausbildung Fachkraft Lagerlogistik begrenzen
  - Eigene Rechtevorlagen ermoeglichen
  - Aufgaben-Text bereinigen und passende Aufgabe bei Sendungserstellung erledigen
*/
(function(){
  if(window.__EXPORTHUB_RC272_WORKFLOW_FIX__)return;
  window.__EXPORTHUB_RC272_WORKFLOW_FIX__=true;

  function st(){try{return typeof state!=="undefined"&&state?state:null}catch(e){return null}}
  function view(){var s=st();return String((s&&s.view)||"")}
  function txt(el){return String((el&&el.textContent)||"").replace(/\s+/g," ").trim()}
  function norm(v){return String(v==null?"":v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
  function esc(v){try{if(typeof window.esc==="function")return window.esc(v)}catch(e){}return String(v==null?"":v).replace(/[&<>'"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]})}
  function saveRender(reason){
    try{if(typeof saveState==="function")saveState()}catch(e){}
    try{if(typeof persist==="function")persist()}catch(e){}
    try{if(typeof render==="function")render()}catch(e){}
    try{if(typeof audit==="function")audit("RC272",reason||"update")}catch(e){}
  }
  function addStyle(id,css){
    if(document.getElementById(id))return;
    var s=document.createElement("style");
    s.id=id;
    s.textContent=css;
    document.head.appendChild(s);
  }

  addStyle("rc272-css",`
    #rc272RefBox{
      display:block!important;
      margin:8px 0 10px!important;
      padding:10px!important;
      border:1px solid #93c5fd!important;
      background:#eff6ff!important;
      border-radius:12px!important;
    }
    #rc272RefBox .rc272-title{font-weight:1000;color:#08245d;margin-bottom:6px}
    #rc272RefBox button,#rc272AbdPanel button,#rc272TemplateBox button{
      min-height:34px!important;
      padding:7px 11px!important;
      border-radius:9px!important;
      border:1px solid #bfdbfe!important;
      background:#fff!important;
      color:#0f172a!important;
      font-weight:850!important;
      cursor:pointer!important;
      margin:3px 6px 3px 0!important;
    }
    #rc272AbdPanel{
      border:1px solid #93c5fd!important;
      background:#f8fbff!important;
      border-radius:14px!important;
      padding:12px!important;
      margin:12px 0!important;
    }
    #rc272AbdPanel h3{margin:0 0 8px!important;color:#08245d!important}
    #rc272AbdPanel label{display:block!important;font-weight:900!important;margin:8px 0 4px!important}
    #rc272AbdPanel input,#rc272AbdPanel textarea,#rc272TemplateBox input{
      width:100%!important;
      box-sizing:border-box!important;
      border:1px solid #cbd5e1!important;
      border-radius:10px!important;
      padding:8px!important;
      background:#fff!important;
    }
    #rc272AbdPanel textarea{min-height:170px!important;white-space:pre-wrap!important}
    .rc272-hidden{display:none!important}
    .rc272-pal-note{font-size:12px!important;color:#475569!important;font-weight:800!important}
    #rc272TemplateBox{
      border:1px solid #d8b4fe!important;
      background:#faf5ff!important;
      border-radius:12px!important;
      padding:10px!important;
      margin:10px 0!important;
    }
  `);

  function currentShipment(){
    var s=st(); if(!s)return null;
    if(s.activeShipmentId&&s.activeShipmentId!=="current"){
      var found=(s.shipments||[]).find(function(x){return String(x.id)===String(s.activeShipmentId)});
      if(found)return found;
    }
    return s.shipment||null;
  }
  function customerForShipment(sh){
    var s=st(); if(!s||!sh)return null;
    var id=String(sh.customerId||sh.customerNo||sh.customerNumber||"");
    return (s.customers||[]).find(function(c){
      return String(c.id||c.no||c.number||c.customerNo||"")===id || norm(c.name)===norm(sh.customerName);
    })||null;
  }
  function refOf(sh){
    return String((sh&&(sh.ref||sh.reference||sh.referenceNumber))||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,24);
  }
  function findHeading(rx){
    return Array.from(document.querySelectorAll("h1,h2,h3,h4,label,strong,b,div")).find(function(el){return rx.test(txt(el))});
  }
  function closestBlock(el){
    return el&&(el.closest(".card,section,article,label,.field,div")||el.parentElement);
  }
  function findColliCard(){
    var h=findHeading(/Collis,\s*(Masse|Maße),\s*Gewicht,\s*Lademeter/i);
    if(h)return h.closest(".card,section,article,div");
    var rows=document.getElementById("rowsBox");
    return rows&&rows.closest(".card,section,article,div");
  }
  function findDeliveryUploadBlock(){
    var h=findHeading(/Lieferscheine\s+hochladen\s*\/\s*anhaengen|Lieferscheine\s+hochladen\s*\/\s*anhängen/i);
    if(h)return closestBlock(h);
    var inputs=Array.from(document.querySelectorAll('input[type="file"]'));
    return inputs.length?closestBlock(inputs[0]):null;
  }
  function findGoodsField(){
    var h=findHeading(/Warenbeschreibung\s+fuer\s+CMR\s+Feld\s+9|Warenbeschreibung\s+für\s+CMR\s+Feld\s+9/i);
    return h&&closestBlock(h);
  }

  window.rc272OpenReferenceFolder=function(){
    try{if(typeof rc265OpenReferenceFolder==="function")return rc265OpenReferenceFolder()}catch(e){}
    try{if(typeof rc270OpenReferenceFolder==="function")return rc270OpenReferenceFolder()}catch(e){}
    try{if(typeof rc246OpenReferenceFolder==="function")return rc246OpenReferenceFolder()}catch(e){}
    var r=refOf(currentShipment());
    if(!r){alert("Bitte zuerst eine Referenznummer erstellen.");return false}
    window.open("https://essentra-my.sharepoint.com/:f:/r/personal/tobiaslimberg_essentra_com/Documents/003%20Export/ExportHub/Sendungen/"+encodeURIComponent(r)+"?csf=1&web=1","_blank","noopener,noreferrer");
    return false;
  };
  window.rc272ImportReferenceFolder=function(){
    try{if(typeof rc265ImportReferenceFolder==="function")return rc265ImportReferenceFolder()}catch(e){}
    try{if(typeof rc270ImportReferenceFolder==="function")return rc270ImportReferenceFolder()}catch(e){}
    try{if(typeof rc246OpenReferenceFolderPicker==="function")return rc246OpenReferenceFolderPicker()}catch(e){}
    alert("Dateien aus Ref.-Ordner übernehmen ist nicht geladen.");
    return false;
  };
  function moveReferenceBox(){
    if(view()!=="shipment")return;
    var target=findDeliveryUploadBlock(); if(!target)return;
    var old=document.getElementById("rc271RefBox");
    if(old)old.classList.add("rc272-hidden");
    var box=document.getElementById("rc272RefBox");
    if(!box){
      box=document.createElement("div");
      box.id="rc272RefBox";
      box.innerHTML='<div class="rc272-title">Referenzordner</div>'+
        '<button type="button" onclick="return rc272OpenReferenceFolder()">Ref.-Ordner öffnen</button>'+
        '<button type="button" onclick="return rc272ImportReferenceFolder()">Dateien aus Ref.-Ordner übernehmen</button>';
    }
    if(target.nextElementSibling!==box)target.insertAdjacentElement("afterend",box);
  }

  function moveStandardmail(){
    var panel=document.getElementById("rc261MailPanel");
    if(!panel)return;
    Array.from(panel.querySelectorAll("label,textarea,input")).forEach(function(el){
      if(/Eigener Mailtext|Zusatztext/i.test(txt(el)))el.classList.add("rc272-hidden");
    });
    if(view()==="shipment"){
      var card=findColliCard();
      if(card&&panel.parentElement!==card)card.appendChild(panel);
    }else if(/customer|kunden/i.test(view())){
      var contact=findHeading(/3\.\s*Spedition|Spedition,\s*Ansprechpartner\s*&\s*Kontakte/i);
      var block=closestBlock(contact);
      if(block&&block.nextElementSibling!==panel)block.insertAdjacentElement("afterend",panel);
    }
  }

  function abdMailBody(sh){
    sh=sh||currentShipment()||{};
    var c=customerForShipment(sh)||{};
    var r=refOf(sh)||"(Referenz)";
    return [
      "Hallo GPZ,",
      "",
      "bitte ABD fuer folgende Sendung erstellen:",
      "",
      "Referenz: "+r,
      "Kunde: "+(sh.customerName||c.name||""),
      "Kundennummer: "+(sh.customerNo||sh.customerNumber||c.no||c.number||c.id||""),
      "Land: "+(sh.country||c.country||""),
      "Collis: "+(sh.colliTotal||sh.collis||""),
      "Gewicht kg: "+(sh.weightTotal||sh.weight||""),
      "Lademeter: "+(sh.ldmTotal||sh.ldm||""),
      "",
      "Vielen Dank.",
      "Tobias Limberg"
    ].join("\n");
  }
  window.rc272SaveAbdRequest=function(){
    var s=st(); if(!s)return false;
    var sh=currentShipment()||{};
    if(!refOf(sh)){
      try{if(typeof newReference==="function")newReference()}catch(e){}
      sh=currentShipment()||sh;
    }
    var r=refOf(sh);
    if(!r){alert("Bitte zuerst eine Referenznummer erstellen.");return false}
    s.abdRequests=Array.isArray(s.abdRequests)?s.abdRequests:[];
    var existing=s.abdRequests.find(function(x){return refOf(x)===r});
    var item=existing||{id:"ABD-"+r,ref:r,reference:r,type:"ABD Anfrage",createdAt:new Date().toISOString()};
    item.linkedShipmentRef=r;
    item.customerName=sh.customerName||item.customerName||"";
    item.customerNo=sh.customerNo||sh.customerNumber||item.customerNo||"";
    item.mailTo=(document.getElementById("rc272AbdTo")||{}).value||item.mailTo||"";
    item.mailBody=(document.getElementById("rc272AbdBody")||{}).value||abdMailBody(sh);
    item.status=item.status||"angefragt";
    if(!existing)s.abdRequests.push(item);
    saveRender("ABD Anfrage gespeichert");
    alert("ABD Anfrage mit Referenz "+r+" gespeichert.");
    return false;
  };
  window.rc272OpenAbdMail=function(){
    var to=(document.getElementById("rc272AbdTo")||{}).value||"";
    var body=(document.getElementById("rc272AbdBody")||{}).value||abdMailBody();
    var r=refOf(currentShipment());
    if(!to){alert("Bitte GPZ Mailadresse eintragen.");return false}
    window.location.href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent("ABD Anfrage "+r)+"&body="+encodeURIComponent(body);
    return false;
  };
  function ensureAbdPanel(){
    if(view()!=="shipment")return;
    var anchor=findGoodsField()||findColliCard(); if(!anchor)return;
    var sh=currentShipment()||{};
    var panel=document.getElementById("rc272AbdPanel");
    if(!panel){
      panel=document.createElement("section");
      panel.id="rc272AbdPanel";
    }
    var to="";
    try{to=localStorage.getItem("exporthub.gpzMail")||""}catch(e){}
    panel.innerHTML='<h3>ABD Anfrage an GPZ</h3>'+
      '<label>GPZ Mailadresse</label><input id="rc272AbdTo" value="'+esc(to)+'" placeholder="GPZ Mailadresse eintragen">'+
      '<label>Fertige Mail</label><textarea id="rc272AbdBody">'+esc(abdMailBody(sh))+'</textarea>'+
      '<button type="button" onclick="return rc272OpenAbdMail()">ABD Mail erstellen</button>'+
      '<button type="button" onclick="return rc272SaveAbdRequest()">ABD Anfrage mit Sendung verknüpfen</button>';
    if(anchor.nextElementSibling!==panel)anchor.insertAdjacentElement("afterend",panel);
  }

  function fixPalettenkonto(){
    if(!/palette/i.test(document.body.textContent||""))return;
    Array.from(document.querySelectorAll("label,strong,b,h3,h4,div")).forEach(function(el){
      var t=txt(el);
      if(/^Auszug$/i.test(t))el.textContent="Auszug an Kunden";
      if(/^Datum$/i.test(t)&&txt(el.parentElement||"").match(/Eingang|Buchung|Abgleich/i))el.textContent="Datumseingang";
    });
    Array.from(document.querySelectorAll("input,textarea")).forEach(function(el){
      var ph=String(el.placeholder||"");
      if(/^Auszug$/i.test(ph))el.placeholder="Auszug an Kunden";
      if(/^Datum$/i.test(ph))el.placeholder="Datumseingang";
    });
  }

  function academyCleanup(){
    if(!/academy|pruefung|prüfung|logistik/i.test(document.body.textContent||""))return;
    Array.from(document.querySelectorAll("button,a,option,h2,h3,h4,div")).forEach(function(el){
      var t=txt(el);
      if(/Export,\s*Zoll\s*&\s*ATLAS|Ladeliste\s*&\s*CMR/i.test(t))el.classList.add("rc272-hidden");
      if(/^Übungen\s*15\s*Fragen$|^Uebungen\s*15\s*Fragen$/i.test(t))el.textContent="Schneller Test";
    });
    try{
      if(typeof SEED!=="undefined"&&SEED&&Array.isArray(SEED.quiz)){
        var seen={};
        SEED.quiz=SEED.quiz.filter(function(q){
          var text=[q.q,q.area,q.why,q.title].join(" ");
          if(/Essentra|ExportHUB|ATLAS|Zoll|CMR|Ladeliste|unser|Prozess|System/i.test(text))return false;
          var k=norm(q.q);
          if(!k||seen[k])return false;
          seen[k]=true;
          return true;
        });
      }
    }catch(e){}
  }

  function ensureTemplateBuilder(){
    if(!/Benutzer\s*&\s*Rechte|Rechte/i.test(document.body.textContent||""))return;
    var anchor=findHeading(/Benutzer\s*&\s*Rechte|Rechtevorlage/i);
    var block=closestBlock(anchor)||document.body;
    var box=document.getElementById("rc272TemplateBox");
    if(!box){
      box=document.createElement("div");
      box.id="rc272TemplateBox";
      box.innerHTML='<strong>Eigene Rechtevorlage erstellen</strong>'+
        '<label>Vorlagenname<input id="rc272TemplateName" placeholder="z.B. Azubi Versand"></label>'+
        '<button type="button" onclick="return rc272SaveTemplateFromSelection()">Aktuelle Rechte als Vorlage speichern</button>';
    }
    if(!document.getElementById("rc272TemplateBox"))block.insertAdjacentElement("afterend",box);
  }
  window.rc272SaveTemplateFromSelection=function(){
    var s=st(); if(!s)return false;
    var name=(document.getElementById("rc272TemplateName")||{}).value||"";
    name=name.trim();
    if(!name){alert("Bitte Vorlagenname eintragen.");return false}
    s.rightTemplates=s.rightTemplates||{};
    var rights={};
    Array.from(document.querySelectorAll('input[type="checkbox"]')).forEach(function(cb){
      var label=txt(cb.closest("label")||cb.parentElement);
      if(label)rights[label]=!!cb.checked;
    });
    s.rightTemplates[name]={name:name,rights:rights,createdAt:new Date().toISOString()};
    saveRender("Rechtevorlage gespeichert");
    alert("Rechtevorlage gespeichert: "+name);
    return false;
  };

  function cleanupTasks(){
    if(!/aufgabe|aufgaben/i.test(document.body.textContent||""))return;
    Array.from(document.querySelectorAll("div,span,p,td,li")).forEach(function(el){
      if(/Lieferscheine und Kundenvorgaben Aus Vorwoche übernommen\. Bleibt sichtbar bis erledigt\./i.test(txt(el))){
        el.textContent=txt(el).replace(/Lieferscheine und Kundenvorgaben Aus Vorwoche übernommen\. Bleibt sichtbar bis erledigt\./i,"").trim();
      }
    });
  }
  function markMatchingTaskDone(){
    var s=st(); if(!s||!Array.isArray(s.tasks))return;
    var sh=currentShipment(); if(!sh)return;
    var keys=[sh.customerNo,sh.customerNumber,sh.customerName,sh.country].map(norm).filter(Boolean);
    if(!keys.length)return;
    var today=new Date(); today.setHours(23,59,59,999);
    var candidates=s.tasks.filter(function(t){
      if(t.done||t.completed)return false;
      var d=t.date||t.due||t.dayDate;
      if(d&&new Date(d)>today)return false;
      var hay=norm([t.title,t.name,t.customerNo,t.customerNumber,t.customerName,t.text].join(" "));
      return keys.some(function(k){return k&&hay.indexOf(k)>=0});
    }).sort(function(a,b){return String(b.date||b.createdAt||"").localeCompare(String(a.date||a.createdAt||""))});
    if(candidates[0]){
      candidates[0].done=true;
      candidates[0].completed=true;
      candidates[0].completedAt=new Date().toISOString();
    }
  }
  var baseSave=window.saveShipment;
  if(typeof baseSave==="function"&&!baseSave.__rc272Wrapped){
    window.saveShipment=function(){
      var res=baseSave.apply(this,arguments);
      try{markMatchingTaskDone();saveRender("passende Aufgabe erledigt")}catch(e){}
      return res;
    };
    window.saveShipment.__rc272Wrapped=true;
  }

  function run(){
    moveReferenceBox();
    moveStandardmail();
    ensureAbdPanel();
    fixPalettenkonto();
    academyCleanup();
    ensureTemplateBuilder();
    cleanupTasks();
  }
  setInterval(run,900);
  setTimeout(run,200);
  setTimeout(run,1200);
})();
