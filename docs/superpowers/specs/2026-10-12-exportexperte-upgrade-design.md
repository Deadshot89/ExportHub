# Exportexperte Upgrade – Design

Datum: 12.10.2026  
Status: fachlich freigegeben – technische Spezifikation  
Repository: `Deadshot89/ExportHub`

## 1. Ziel

Der bestehende Bereich **Exportexperte** wird modular erweitert. Der aktuell produktive ABD-Prozess bleibt vollständig erhalten und wird nicht neu implementiert, ersetzt oder strukturell verändert.

Der Ausbau umfasst:

1. ABD erstellen
2. Gespeicherte ABD-Anfragen
3. Rechnungsanalyse
4. Gruppierung nach HS-Code + Ursprungsland
5. PDF-/Excel-Ausgabe
6. Ausgangsvermerk (AV) und AV-Aufgaben
7. Zollwissen
8. KI-Zollexperte
9. Zoll-Updates

Leitprinzip: **Die Website wird erweitert, nicht neu erfunden.**

## 2. Nicht verhandelbarer Bestandsschutz

Der bestehende ABD-Kern ist geschützt. Folgende Funktionen bleiben in ihrer aktuellen fachlichen Bedeutung und Navigation erhalten:

- ABD manuell erstellen
- ABD aus vorhandener Sendung erstellen
- Kundensuche
- Referenznummer
- Empfängerland
- Sprache Deutsch/Englisch
- ABD-Empfänger
- Colli-Art
- Colli-Anzahl
- Gesamtgewicht je Colli-Zeile
- Colli hinzufügen/entfernen
- Colli-Gesamtzahl
- Gesamtgewicht
- Rechnung optional in ExportHUB hinterlegen
- Hinweis, dass Rechnungen/Lieferscheine für Outlook weiterhin manuell angehängt werden
- Betreff
- feste Mailvorlage
- ABD-Anfrage in Outlook öffnen
- Mailtext kopieren
- ABD-Anfrage speichern
- bestehende Sendungsdatenübernahme

Neue Funktionen dürfen diese Pfade weder verlangsamen noch bestehende Datenmodelle zerstören.

## 3. Hauptnavigation

Der Exportexperte erhält eine kompakte Unternavigation:

- **ABD erstellen**
- **Gespeicherte ABD**
- **Aufgaben**
- **Zollwissen**
- **KI-Zollexperte**
- **Zoll-Updates**

Beim Einstieg in **ABD erstellen** erscheint eine vorgeschaltete Startauswahl:

- **Manuell erstellen** → bestehender manueller ABD-Prozess
- **Aus Sendung erstellen** → bestehender Sendungsprozess
- **Rechnung analysieren** → neuer Analysepfad

Die ersten beiden Wege bleiben technisch auf den vorhandenen Komponenten und Funktionen. Die Startauswahl ist lediglich ein Router.

## 4. Bestehende Architektur als Basis

Die bestehende RC1294-Analyse wird weiterverwendet und erweitert:

- Frontend: `assets/rc1294-abd-self-service.js`
- API: `api/abd-analysis/index.js`
- Parser/Normalisierung: `api/shared/abd-analysis.js`
- Persistente ABD-Vorgänge: vorhandene Collection `abdRequests`
- Dokumentablage: bestehende Document-/Blob-Infrastruktur
- Rechte: vorhandene ABD-Modulrechte und State-Write-Guard
- Tests: bestehende RC1294-Tests und Navigation/E2E-Verträge

Es wird keine zweite parallele ABD-Datenhaltung eingeführt.

## 5. Modulgrenzen

Die Erweiterung wird in klar getrennte Verantwortlichkeiten aufgeteilt.

### 5.1 Start-Router

Verantwortung:

- Auswahl Manuell / Sendung / Rechnung
- keine fachliche Datenverarbeitung
- keine Veränderung bestehender ABD-Formulare

### 5.2 Invoice Intake

Verantwortung:

- sichere Dateiauswahl
- Dateitypprüfung
- Größenprüfung
- Upload in vorhandene Quarantäne
- Malware-Prüfung
- Übergabe an Analyse

### 5.3 Invoice Extraction

Verantwortung:

- Kopfdaten erkennen
- Rechnungspositionen erkennen
- vorhandene Daten normalisieren
- fehlende/unsichere Werte markieren
- niemals HS-Code oder Ursprung als sicher erfinden

### 5.4 ABD Grouping Engine

Verantwortung:

- ausschließlich bestätigbare Positionen gruppieren
- Schlüssel: `HS-Code + Ursprungsland`
- Warenwerte gruppenweise addieren
- Originalpositionen referenzierbar behalten
- Kontrollsumme erzeugen
- ungeklärte Positionen separat halten

### 5.5 Review UI

Verantwortung:

- Zusammenfassung anzeigen
- Gruppen bearbeiten
- unsichere Felder bestätigen/korrigieren
- Originalpositionen nur bei Bedarf aufklappen
- keine Einzelartikel als primäre ABD-Liste darstellen

### 5.6 Export Layer

Verantwortung:

- PDF aus demselben gruppierten Datenmodell erzeugen
- Excel aus demselben gruppierten Datenmodell erzeugen
- Detailanhang/Detailblatt optional ergänzen
- keine abweichende Berechnungslogik zwischen UI/PDF/Excel

### 5.7 ABD Persistence Extension

Verantwortung:

- bestehende `abdRequests` rückwärtskompatibel erweitern
- Analyseergebnis optional am Vorgang speichern
- vorhandene Vorgänge ohne neue Felder weiterhin vollständig lesbar halten

### 5.8 AV Lifecycle

Verantwortung:

- AV-Dokument zuordnen
- AV-Status darstellen
- fehlenden AV als idempotente Aufgabe erzeugen
- Aufgabe beim Hinterlegen des AV automatisch schließen

### 5.9 Customs Knowledge

Verantwortung:

- strukturierte Fachartikel
- Quellen und Prüfdatum
- keine ungeprüften erfundenen Zollinformationen

### 5.10 AI Customs Expert

Verantwortung:

- Fachfragen beantworten
- aktuellen ABD-Vorgang oder aktuelle Rechnungsanalyse als Lesekontext verwenden
- Quellen/Informationsstand anzeigen
- keine Geschäftsobjekte eigenständig verändern

### 5.11 Customs Updates

Verantwortung:

- geprüfte Änderungen anzeigen
- Quelle, Veröffentlichungsdatum, Prüfdatum, Link und Themenbereich speichern
- gelesen/ungelesen unterstützen

## 6. Rechnungsanalyse – unterstützte Formate

Verbindlich:

- PDF
- gescannte PDF
- JPG
- PNG

Zusätzlich:

- XLSX
- CSV

Die bereits vorhandene Server-Unterstützung für PDF/XLSX/CSV bleibt bestehen. JPG/PNG werden über denselben sicheren Uploadpfad ergänzt und anschließend über einen OCR-/Bildextraktionsschritt analysiert.

Maximalgrößen und Dateimengen werden serverseitig begrenzt. Clientseitige Prüfungen dienen nur der UX und ersetzen niemals die Servervalidierung.

## 7. Sicherheitsfluss für Dateien

1. Benutzer benötigt ABD-Bearbeitungsrecht.
2. Dateityp und Dateigröße werden serverseitig validiert.
3. Datei wird in die bestehende quarantänisierte Blob-Ablage geschrieben.
4. Malware-Scan muss erfolgreich abgeschlossen sein.
5. Nur saubere Dateien werden analysiert.
6. Blockierte/fehlerhafte Dateien werden nicht verarbeitet.
7. Temporäre Analyseuploads werden nach Auswertung gelöscht.
8. Dauerhafte Speicherung erfolgt nur, wenn das Dokument bewusst einem Vorgang zugeordnet wird.
9. Keine öffentlich erreichbaren direkten Dokumentlinks.
10. Änderungen und sicherheitsrelevante Fehler werden protokolliert.

## 8. Datenmodell der Rechnungsanalyse

Das Analyseergebnis wird logisch in vier Ebenen getrennt.

```js
{
  header: {
    invoiceNumber,
    invoiceDate,
    customer,
    recipient,
    destinationCountry,
    invoiceTotal,
    currency
  },
  positions: [],
  groups: [],
  unassigned: [],
  totals: {
    invoiceTotal,
    groupedTotal,
    difference
  },
  review: {
    readyCount,
    reviewCount,
    missingHsCount,
    missingOriginCount,
    missingValueCount
  }
}
```

Fehlende Kopfdaten bleiben leer und werden nicht erfunden.

## 9. Interne Rechnungsposition

Die interne Position bleibt positionsgenau und kann mindestens enthalten:

```js
{
  position,
  itemNumber,
  description,
  commodityCode,
  originCountry,
  quantity,
  netMassKg,
  grossMassKg,
  value,
  currency,
  invoiceNumber,
  sourceFile,
  sourceRow,
  confidence,
  missing,
  warnings,
  confirmed
}
```

Diese Positionen sind die Nachweis- und Detailbasis. Sie sind **nicht** die primäre ABD-Ausgabe.

## 10. Gruppierungsregel

Eine ABD-Gruppe wird ausschließlich aus der eindeutigen Kombination erzeugt:

`normalizedCommodityCode + normalizedOriginCountry`

Beispiele:

- `39269097 + DE` → eine Gruppe
- `39269097 + CN` → eigene Gruppe
- `73181595 + DE` → eigene Gruppe

Damit gilt:

- gleicher HS-Code + gleiches Ursprungsland → zusammenfassen
- gleicher HS-Code + anderes Ursprungsland → getrennt
- anderer HS-Code + gleiches Ursprungsland → getrennt

Der Warenwert aller zugeordneten Rechnungspositionen wird mathematisch addiert.

## 11. Nicht gruppierbare Positionen

Eine Position wird nicht automatisch gruppiert, wenn mindestens eines dieser Felder fehlt oder nicht ausreichend bestätigt ist:

- HS-Code
- Ursprungsland
- Warenwert

Sie landet in `unassigned` und erhält einen klaren Prüfstatus.

Beispiel:

**⚠ Gruppierung nicht möglich – HS-Code oder Ursprungsland fehlt**

Die Gruppierung darf niemals fehlende Werte durch Annahmen vervollständigen.

## 12. Prüfstatus

Fachkritische Informationen erhalten einen Status:

- **✓ erkannt**
- **⚠ prüfen**
- **✕ fehlt**

Wenn eine KI oder Heuristik einen HS-Code nur vorschlägt, muss der Vorschlag als solcher dargestellt werden, inklusive Konfidenz und erforderlicher manueller Bestätigung.

Unsichere Angaben dürfen niemals automatisch freigegeben werden.

## 13. Kontrollsumme

Nach jeder Änderung an HS-Code, Ursprungsland oder Warenwert wird die Kontrollsumme neu berechnet:

`Summe aller ABD-Gruppen = Rechnungswert`

Darstellung:

- Rechnungswert
- Summe ABD-Gruppen
- Differenz

Bei Abweichung:

**⚠ Warenwert stimmt nicht mit Rechnungswert überein**

Eine Abweichung verhindert eine irreführende Darstellung als vollständig geprüft.

## 14. Prüfansicht

Die primäre Ergebnisansicht zeigt nicht die Artikelliste, sondern:

- Anzahl erkannter Rechnungspositionen
- Anzahl daraus erzeugter ABD-Gruppen
- Anzahl vollständiger Gruppen
- Anzahl zu prüfender Gruppen
- Anzahl ungeklärter Positionen
- Rechnungswert
- Summe ABD-Gruppen
- Differenz

Darunter folgen kompakte ABD-Gruppen.

Beispiel:

```text
ABD-Position 1
HS-Code: 39269097
Ursprungsland: DE
Warenwert: 4.850,00 EUR
Enthaltene Rechnungspositionen: 12
Status: ✓ vollständig
```

Aktionen:

- HS-Code kopieren
- Ursprungsland kopieren
- Warenwert kopieren
- Details anzeigen
- Gruppe bearbeiten

`Details anzeigen` öffnet ausschließlich die zugeordneten Originalpositionen.

## 15. Verbindung zum bestehenden ABD-Prozess

Nach erfolgreich geprüfter Rechnungsanalyse kann der Benutzer wählen:

**Neue ABD-Anfrage mit diesen Daten vorbereiten**

Dabei werden nur geeignete Informationen in den bestehenden ABD-Kontext übernommen bzw. daran angehängt.

Nicht ersetzt werden:

- Grunddaten
- Collis
- Anhänge
- Mailvorgang
- bestehender Speicherprozess

Die Rechnungsanalyse bleibt optional.

## 16. Persistenz in `abdRequests`

Neue Felder werden optional und rückwärtskompatibel ergänzt. Bestehende Datensätze ohne diese Felder bleiben gültig.

Mögliche Erweiterung:

```js
{
  invoiceAnalysis: {
    header,
    groups,
    review,
    totals,
    analyzedAt,
    analyzedBy
  },
  invoiceFiles: [],
  avFiles: [],
  avStatus,
  avUpdatedAt,
  customsReviewStatus
}
```

Große Binärinhalte werden weiterhin über die bestehende Dokument-/Blob-Infrastruktur gespeichert und nicht unnötig inline im State vervielfältigt.

## 17. Gespeicherte ABD-Anfragen

Die bisherige Darstellung wird zu einer kompakten, responsiven Tabelle weiterentwickelt.

Primärspalten:

- ABD/MRN
- Datum
- Referenz
- Kunde
- Rechnung
- Land
- Wert
- Status
- AV
- Aktion

Optional einblendbar:

- Ersteller
- Versanddatum
- Anzahl ABD-Positionen
- Sprache
- ABD-Empfänger

Mobile Darstellung nutzt horizontales Scrollen bzw. eine kompakte Detailzeile, ohne Daten zu verlieren.

## 18. Suche und Filter

Suche mindestens nach:

- ABD/MRN
- Referenznummer
- Rechnungsnummer
- Kunde
- Empfänger
- Land
- HS-Code

Filter:

- Zeitraum
- Kunde
- Empfängerland
- Status
- AV vorhanden
- AV fehlt

Aktion:

- Filter zurücksetzen

Suche und Filter arbeiten auf vorbereiteten normalisierten Suchwerten und dürfen die Hauptansicht nicht bei jedem Tastendruck vollständig neu aufbauen.

## 19. Ausgangsvermerk (AV)

Jeder ABD-Anfrage kann mindestens ein PDF als Ausgangsvermerk zugeordnet werden.

Status:

- **✓ AV vorhanden**
- **⚠ AV fehlt**

Aktionen:

- AV hinzufügen
- AV öffnen
- AV anzeigen
- AV herunterladen

Der AV wird über die bestehende sichere Dokumentablage angebunden.

## 20. Fehlender AV als Aufgabe

Wenn ein Vorgang fachlich abgeschlossen/ausgeführt ist, aber noch kein AV existiert, entsteht genau eine Systemaufgabe.

Idempotenzschlüssel logisch:

`missing-av:<abdRequestId>`

Die Aufgabe enthält:

- MRN
- Kunde
- Referenz
- Versanddatum
- AV-Status

Aktionen:

- AV hinzufügen
- ABD öffnen
- Aufgabe bearbeiten

Beim erfolgreichen Hinterlegen eines AV wird die zugehörige offene Aufgabe automatisch als erledigt markiert.

Es dürfen keine doppelten AV-Aufgaben erzeugt werden.

## 21. PDF-Ausgabe

Button:

**ABD-Daten als PDF**

Hauptreport:

- Rechnungsnummer
- Rechnungsdatum
- Kunde
- Empfänger
- Empfängerland
- Gesamtwarenwert
- Anzahl Rechnungspositionen
- Anzahl ABD-Gruppen

Tabelle:

- ABD-Position
- HS-Code
- Ursprungsland
- kumulierter Warenwert
- Anzahl Rechnungspositionen
- Prüfstatus

Abschluss:

- Rechnungswert
- Summe ABD-Gruppen
- Differenz

Optionaler Detailanhang:

- Originalpositionen je ABD-Gruppe

Keine abgeschnittenen Tabellen oder überlappenden Druckelemente.

## 22. Excel-Ausgabe

Button:

**ABD-Daten als Excel**

### Tabellenblatt 1 – ABD-Auswertung

Eine Zeile pro `HS-Code + Ursprungsland`:

- ABD-Pos.
- HS-Code
- Ursprungsland
- Warenwert
- Währung
- Anzahl Rechnungspositionen
- Prüfstatus

### Tabellenblatt 2 – Rechnungsdetails

Original erkannte Rechnungspositionen inklusive Zuordnung zur ABD-Gruppe.

UI, PDF und Excel verwenden denselben Gruppierungsdatensatz. Es gibt keine eigene Exportberechnung.

## 23. Zollwissen

Der Bereich wird als strukturierte Wissensbasis ausgebaut.

Themen mindestens:

- ABD
- Ausfuhranmeldung
- Ausgangsvermerk
- MRN
- HS-Code
- Zolltarifnummer
- Warenursprung
- Präferenzursprung
- Nichtpräferenzieller Ursprung
- Lieferantenerklärung
- Ursprungszeugnis
- Handelsrechnung
- Proforma-Rechnung
- Incoterms
- EORI
- ATLAS
- AES
- Ausfuhrbegleitdokument
- Zollwert
- Warenwert
- Dual-Use
- Sanktionen
- Embargos
- Länderinformationen
- Schweiz
- Großbritannien
- USA
- Türkei
- China
- EU/Drittland
- typische Fehler bei Ausfuhren

Jeder größere Artikel enthält möglichst:

- Was ist das?
- Wann benötige ich das?
- Welche Informationen brauche ich?
- Was muss ich beachten?
- Praxisbeispiel
- Typische Fehler
- Quellen
- Stand der letzten fachlichen Prüfung

## 24. Zoll-Updates

Der Bereich zeigt geprüfte Änderungen in Kategorien:

- Wichtig
- Zollrecht
- ATLAS
- AES
- Zolltarif
- Sanktionen
- Embargos
- Länder
- Verfahren

Jeder Eintrag speichert:

- Titel
- Kurzfassung
- Kategorie
- Quelle
- Veröffentlichungsdatum
- Prüfdatum
- Link
- betroffenen Bereich
- gelesen/ungelesen

Zolländerungen werden niemals ohne belastbare Quelle erzeugt.

Bevorzugte Quellen:

- deutsche Zollverwaltung
- Europäische Institutionen
- TARIC
- offizielle Behörden
- offizielle Rechtsquellen

## 25. KI-Zollexperte

Der KI-Assistent unterstützt freie Fragen und kontextbezogene Prüfungen.

Er darf lesen:

- Wissensartikel
- geprüfte Zoll-Updates
- geöffneten ABD-Vorgang
- aktuelle Rechnungsanalyse

Er darf nicht selbstständig:

- ABD-Daten speichern
- HS-Codes bestätigen
- Ursprungsland bestätigen
- AV hochladen
- Aufgaben schließen
- bestehenden Mailprozess verändern

Antworten zu Fachthemen enthalten:

- Antwort
- Unsicherheitskennzeichnung, falls erforderlich
- Quellen
- Informationsstand
- Hinweis auf manuelle Prüfung, wenn notwendig

## 26. KI-Kontext bei Rechnungsanalysen

Unterstützte Fragestellungen umfassen mindestens:

- Welche HS-Codes kommen vor?
- Welche Ursprungsländer kommen vor?
- Welche Gruppen müssen geprüft werden?
- Warenwert für HS-Code X + Ursprung Y?
- Warenwert aller Positionen mit Ursprung X?
- Welche Positionen sind nicht zugeordnet?
- Stimmt die Gruppensumme mit dem Rechnungswert überein?

Die Antworten werden aus dem tatsächlich analysierten Datenobjekt berechnet und nicht aus Freitext geraten.

## 27. UI/UX-Grundsätze

- kompakte Informationsdichte
- klare Hierarchie
- Desktop, Tablet und Smartphone
- keine unnötig großen Karten
- Tabellen mit sticky Headern auf Desktop
- klare Prüfstatus-Chips
- kritische Abweichungen visuell hervorheben
- Details progressiv aufklappen
- keine horizontale Überbreite des gesamten Layouts
- große Tabellen innerhalb eines kontrollierten Scrollcontainers
- Tastaturbedienung und sichtbare Fokuszustände
- Buttons mit eindeutigen Lade-/Fehler-/Erfolgszuständen
- keine Datenverluste bei Navigation

## 28. Fehlerbehandlung

Fehlerklassen werden klar getrennt:

- Dateityp ungültig
- Datei zu groß
- Malware erkannt
- Scan ausstehend
- OCR/Extraktion fehlgeschlagen
- keine verwertbaren Positionen
- HS-Code fehlt
- Ursprung fehlt
- Warenwert fehlt
- Kontrollsumme abweichend
- Speichern fehlgeschlagen
- Export fehlgeschlagen
- keine Berechtigung

Fehler dürfen bestehende manuelle ABD-Funktionen nicht blockieren.

## 29. Performance

Zu prüfen und zu optimieren:

- Ladezeit des Exportexperten
- Initialisierung der Rechnungsanalyse
- Dokumentupload
- OCR/Extraktion
- Gruppierungsberechnung
- Tabellenrendering
- Suche/Filter
- PDF-Erstellung
- Excel-Erstellung
- Laden gespeicherter ABD-Anfragen
- KI-Anfragen

Die neuen Module werden nur geladen/aktiviert, wenn der Benutzer die entsprechende Funktion öffnet. Der manuelle ABD-Weg darf nicht durch unnötige KI-/OCR-Runtimes belastet werden.

## 30. Teststrategie

### 30.1 Bestandsschutz – manuelles ABD

Pflichttest:

1. ABD manuell öffnen
2. Kunde suchen
3. Referenz eingeben
4. Empfängerland auswählen
5. Sprache auswählen
6. ABD-Empfänger auswählen
7. Colli hinzufügen
8. Anzahl eingeben
9. Gewicht eingeben
10. weitere Colli hinzufügen
11. Rechnung optional hinterlegen
12. Betreff erzeugen
13. feste Mailvorlage prüfen
14. Outlook öffnen
15. Mailtext kopieren
16. ABD-Anfrage speichern

Alle Schritte müssen unverändert funktionieren.

### 30.2 Bestandsschutz – aus Sendung

Pflichttest:

- Sendung auswählen
- ABD aus Sendung erzeugen
- Datenübernahme
- Grunddaten
- Collis
- Mailvorgang
- Speichern

### 30.3 Rechnungsanalyse

Testfälle:

- digitale PDF
- gescannte PDF
- JPG
- PNG
- XLSX
- CSV
- mehrseitige Rechnung
- eine Position
- viele Positionen
- mehrere Rechnungen
- verschiedene Währungen
- Dezimalwerte
- große Rechnung innerhalb der Grenzwerte
- ungültiger Dateityp
- zu große Datei
- Malware-Blockierung

### 30.4 Gruppierung

Pflichttests:

- gleicher HS-Code + gleiches Land wird exakt einmal gruppiert
- gleicher HS-Code + anderes Land bleibt getrennt
- anderer HS-Code + gleiches Land bleibt getrennt
- Warenwerte werden korrekt addiert
- fehlender HS-Code bleibt ungeklärt
- fehlender Ursprung bleibt ungeklärt
- fehlender Warenwert bleibt ungeklärt
- Kontrollsumme 0,00 Differenz
- Kontrollsumme mit Abweichung
- manuelle Korrektur triggert Neuberechnung

### 30.5 Persistenz

- alte `abdRequests` ohne neue Felder laden
- neue Analyse speichern
- vorhandene Felder nicht überschreiben
- Dokumentreferenzen erhalten
- State-Write-Guard respektieren
- fehlgeschlagenes Speichern nicht als Erfolg darstellen

### 30.6 AV

- AV hinzufügen
- AV öffnen
- AV herunterladen
- fehlender AV erzeugt genau eine Aufgabe
- wiederholte Prüfung erzeugt keine Duplikate
- AV-Upload erledigt passende Aufgabe

### 30.7 PDF/Excel

- Gruppensummen identisch mit UI
- Detailzuordnung korrekt
- keine abgeschnittenen PDF-Tabellen
- Excel-Blatt 1 gruppiert
- Excel-Blatt 2 positionsgenau

### 30.8 E2E

- Navigation Exportexperte
- alle sechs Untermodule erreichbar
- Browser Zurück/Vor
- Reload
- keine Source-Leaks
- keine unkontrollierte horizontale Seitenüberbreite
- Rechtefälle View/Edit/Admin

## 31. Release-Schutz

Die Implementierung wird nicht direkt als erfolgreich oder produktionsreif bezeichnet, solange nicht alle relevanten Tests grün sind.

Freigabekriterien:

- manueller ABD-Prozess grün
- ABD aus Sendung grün
- Rechnungsanalyse grün
- Gruppierungslogik grün
- Kontrollsumme grün
- PDF/Excel grün
- gespeicherte ABD grün
- AV-Aufgaben grün
- Rechte/Sicherheit grün
- Navigation/E2E grün
- Build grün
- keine bekannte P0/P1-Regression

## 32. Umsetzung in Phasen

Die Architektur bleibt modular, damit jede Phase isoliert getestet werden kann.

1. Bestandsschutz-Verträge festschreiben
2. Gruppierungs-Engine und Kontrollsumme
3. Review-UI für gruppierte ABD-Positionen
4. JPG/PNG-OCR ergänzen
5. Übergabe in bestehenden ABD-Prozess
6. PDF/Excel
7. gespeicherte ABD-Tabelle und Suche
8. AV-Lifecycle und Aufgaben
9. Zollwissen
10. Zoll-Updates
11. KI-Zollexperte und Kontext
12. vollständige Regression/Performance/Release-Gates

## 33. Erfolgsdefinition

Das Upgrade ist fachlich erfolgreich, wenn:

- kein bestehender ABD-Kernprozess verloren geht,
- Rechnungen sicher analysiert werden,
- die Hauptansicht nicht artikelweise arbeitet,
- jede eindeutige Kombination aus HS-Code + Ursprungsland genau eine ABD-Gruppe bildet,
- Warenwerte korrekt summiert werden,
- die Kontrollsumme transparent ist,
- unsichere Zolldaten nicht automatisch freigegeben werden,
- PDF/Excel dieselben geprüften Gruppen verwenden,
- AVs sauber nachverfolgt werden,
- Zollwissen/Updates nachvollziehbare Quellen besitzen,
- der KI-Zollexperte ausschließlich beratend arbeitet,
- und alle Bestandsschutz- sowie Release-Regressionen bestanden sind.
