# RC1544 – Einheitlicher geführter SOP-Workspace

**Datum:** 15.10.2026  
**PR:** #769  
**Basis:** aktuelles `main` / SOPMaster  
**Ziel:** Alle aktiven SOPMaster-SOPs verwenden denselben geführten Arbeitsbereich. Vorhandene SOPMaster-Funktionen bleiben erhalten.

## Verbindliche Oberfläche

- linke nummerierte Schritt-Navigation
- Kopfbereich mit SOP-Titel, Nummer, Version und Fortschritt
- genau ein aktiver Arbeitsschritt im Hauptbereich
- großer vorhandener Screenshot-/Bildbereich oder expliziter fehlender-Bild-Hinweis
- rechter Kontextbereich für Voraussetzungen, Prüfungen, erwartetes Ergebnis, Risiken und Abweichungen
- fester Footer mit Zurück, Schritt erledigt und Weiter
- Pflichtschritte verhindern unzulässiges Überspringen
- optionale Schritte blockieren den nächsten Pflichtschritt nicht
- responsive Desktop-/Mobile-Darstellung ohne horizontalen Überlauf
- sechs ExportHUB-Sprachen über die bestehende i18n-Runtime

## Architektur

Der Guided Workspace ist ein additiver Wrapper über `ExportHubIsoSopUi`. Er ersetzt keine fachliche SOPMaster-Quelle und baut keinen zweiten Editor oder Tour-Unterbau.

Er verwendet weiterhin:

- `isoSops` als aktive SOP-Datenquelle
- bestehendes SOP-Schrittmodell und Step Contract
- vorhandene Visuals, Screenshots und Annotationen
- bestehende Tour-, Editor-, Training-, Prüfungs- und Coverage-Funktionen

`customSops` bleibt entsprechend der bestehenden SOPMaster-Architektur Legacy-Bestand und wird nicht stillschweigend in den aktiven ISO-SOP-Bestand gemischt.

## Release-Integration

RC1544 wird über ein wiederverwendbares Build-Modul in die drei Umgebungen integriert. Der finale Pack-/Production-Builder führt die Integration **nach** seinem letzten Auto-Update-Schritt aus, damit die Guided Assets im finalen Produktionspaket nicht verloren gehen.

Die Sprachdaten werden als `application/json` eingebettet und vor i18n-Bridge und Guided Runtime geladen.

Die HTML-Injection verwendet den realen **letzten** `</head>`- bzw. `</body>`-Endtag. Dadurch können gleichlautende Zeichenfolgen innerhalb großer Inline-JavaScript-Blöcke das Build-Dokument nicht beschädigen.

## Regressionen

Abgesichert werden mindestens:

- Legacy- und Unified-Schrittmodell ohne Textverlust
- Pflicht-/Optional-Logik
- veraltete gespeicherte Schritt-IDs
- barrierefreie Aktiv-/Erledigt-/Gesperrt-Zustände
- vollständiges HTML-Escaping
- realer `.rc1007-sop-document[data-sop-number]`-Mountpunkt
- Inline-JavaScript mit enthaltenen `</head>`-/`</body>`-Strings
- sechs Sprachen ohne hart codierte deutsche UI-Fallbacks
- finaler Production-Buildpfad
- Desktop und Mobile im Playwright-SOPMaster-Pfad
- Production Candidate, TESTSERVICE und Demo read-only

## Abschlusskriterium

RC1544 gilt erst als vollständig abgeschlossen, wenn:

1. alle aktuellen PR-Gates auf demselben Head grün sind,
2. der SOPMaster Release-Candidate-Gate inklusive Guided Browser-Test grün ist,
3. PR #769 nach `main` integriert ist,
4. der exakte freigegebene Stand über den normalen Produktionsworkflow deployed ist,
5. Produktion anschließend live verifiziert wurde.

Vor dem letzten Punkt darf der Projektstatus nicht 100 % anzeigen.
