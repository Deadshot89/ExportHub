# ExportHUB360 Dashboard-Personalisierung – Design

## Ziel

Das bestehende ExportHUB360-Dashboard wird modernisiert und individuell anpassbar, ohne bestehende Funktionen, Kennzahlen, Berechnungen, Filter, Datenquellen, Verlinkungen, Berechtigungen oder Abläufe fachlich zu verändern.

Die Änderung ist eine UI-/Layout-Erweiterung über dem vorhandenen Dashboard. Bestehende Dashboard-Renderer und Fachlogik bleiben die Quelle der Wahrheit.

## Bestandsschutz

Vor jeder Implementierung gilt:

- vorhandene Dashboard-Kacheln erfassen
- vorhandene KPI-/Statusberechnungen erfassen
- bestehende Filter und Datenquellen erfassen
- vorhandene Navigationen und Detailpfade erfassen
- Berechtigungsprüfungen erfassen
- bestehende Aufgaben-, Warncenter-, Benachrichtigungs- und Sendungslogik erfassen
- bestehende Tests als Regression-Baseline verwenden

Bekannte fachliche Dashboard-Regeln bleiben unverändert, insbesondere:

- offene Sendungen im Dashboard sind die noch nicht abgeholten Sendungen
- persönliche Aufgaben bleiben nach Benutzer und aktueller Woche gefiltert
- Rückstand bleibt sichtbar
- vorhandene Berechtigungen bestimmen weiterhin, welche Inhalte ein Benutzer sehen darf
- Warncenter, Benachrichtigungscenter und Arbeitsfokus bleiben fachlich getrennte Bereiche

Keine neue Dashboard-Komponente darf dieselbe Kennzahl unabhängig neu berechnen, wenn die bestehende Logik bereits einen Wert liefert.

## Architektur

Die Personalisierung wird als isolierte Dashboard-Schicht umgesetzt.

Vorgesehene neue Runtime-Dateien:

- `assets/rc1371-dashboard-personalization.js`
- `assets/rc1371-dashboard-personalization.css`

Die Runtime wird über den bestehenden Drei-Umgebungen-Build eingebunden. Sie darf weder die fachlichen Dashboard-Funktionen ersetzen noch globale Kernfunktionen patchen, wenn eine DOM-/Widget-Adapter-Schicht genügt.

Die Schicht besteht aus fünf Einheiten:

1. Widget Registry
2. Layout State
3. Edit Mode
4. Widget Library
5. Detail-/Navigation Adapter

## Widget Registry

Jede personalisierbare Kachel erhält eine stabile Widget-ID.

Ein Registry-Eintrag enthält mindestens:

- `id`
- `title`
- `category`
- `defaultSize`
- `allowedSizes`
- `requiredModule` oder vorhandene Berechtigungsprüfung
- Referenz auf den vorhandenen Dashboard-Inhalt/Renderer
- optionalen Detail-/Navigationspfad

Kategorien:

- KPIs
- Produktivität
- Versand
- Aufträge
- Lager
- Bestand
- Mitarbeiter
- Qualität
- Termine
- Warnungen
- Analysen
- Diagramme
- Schnellzugriffe

Bereits verwendete Kacheln werden in der Widget-Bibliothek als aktiv gekennzeichnet.

## Persönlicher Layout State

Die persönliche Konfiguration speichert ausschließlich Darstellungszustand:

- sichtbare Kacheln
- ausgeblendete Kacheln
- Reihenfolge
- Position
- Größe
- gewählte Vorlage

Die Speicherung ist strikt benutzerbezogen. Benutzer A darf das Dashboard von Benutzer B nicht verändern.

Der Schlüssel muss aus einer stabilen Benutzeridentität und einer Schema-Version bestehen. Beispielkonzept:

`exporthub.dashboard.layout.v1.<user-id>`

Der Layout State darf keine Sendungen, Aufgaben, Dokumente, Rechte oder sonstige fachliche Teamdaten enthalten.

Fehlt eine stabile Benutzeridentität, wird keine gemeinsame oder anonyme persistente Konfiguration geschrieben; stattdessen wird die Standardansicht verwendet.

## Dashboard bearbeiten

Das Dashboard erhält eine Aktion `Dashboard bearbeiten`.

Im normalen Modus bleiben Bearbeitungssteuerelemente verborgen.

Im Bearbeitungsmodus:

- Kacheln sind verschiebbar
- Kacheln zeigen einen Drag-Handle
- Kacheln können ausgeblendet werden
- die Größe kann geändert werden
- `+ Kachel hinzufügen` ist verfügbar
- `Standard wiederherstellen` ist verfügbar
- die aktive Vorlage ist auswählbar

Der Bearbeitungsmodus verändert keine fachlichen Daten.

## Drag & Drop

Desktop und Tablet unterstützen Drag & Drop.

Anforderungen:

- Position während des Ziehens sichtbar
- andere Kacheln verschieben sich deterministisch
- keine Überlagerungen
- Rasterausrichtung
- keine freien Pixelpositionen
- gespeicherte Reihenfolge nach Abschluss
- Tastatur-/barrierearme Alternative über Verschiebeaktionen oder Move-Controls

Auf Smartphone wird kein unpräzises freies Dragging erzwungen. Dort darf eine sichere Reihenfolge-Steuerung angeboten werden.

## Größenmodell

Unterstützte Größen:

- S – kompakte KPI
- M – Standardkachel
- L – große Auswertung
- XL – Tabelle, Diagramm oder volle Breite

Das Layout nutzt ein responsives Raster. Größen werden in Grid-Spans übersetzt und nicht als feste Pixelbreiten gespeichert.

Inhalte müssen bei allen erlaubten Größen lesbar bleiben. Keine abgeschnittenen Texte, Zahlen, Buttons, Tabellen oder Diagramme.

Widget-spezifisch dürfen unpassende Größen gesperrt werden.

## Dashboard-Vorlagen

Vordefinierte Ausgangslayouts:

- Standard
- Management
- Operativ
- Kompakt
- Analyse

Eine Vorlage setzt nur das persönliche Layout. Danach bleibt sie vollständig anpassbar.

`Standard wiederherstellen` löscht ausschließlich die persönliche Dashboard-Konfiguration und stellt die ExportHUB-Standardanordnung wieder her.

## Widget Library

`+ Kachel hinzufügen` öffnet eine moderne Auswahl mit:

- Suchfeld
- Kategorien
- Berechtigungsfilter
- Kennzeichnung bereits aktiver Kacheln
- kurzer Beschreibung
- vorgeschlagener Standardgröße

Eine Kachel, für die der Benutzer keine Berechtigung besitzt, wird nicht als auswählbare Möglichkeit angeboten.

Das Verstecken einer Kachel verändert keine Berechtigung.

## Schnellzugriffe

Schnellzugriff-Kacheln dürfen auf vorhandene ExportHUB-Funktionen verweisen, z. B.:

- Sendung erstellen
- Sendungsübersicht
- Aufgaben
- Reports/Analysen
- Warncenter
- Benachrichtigungen
- SOP
- ABD

Schnellzugriffe folgen denselben Layoutregeln wie andere Widgets.

## KPI-/Statusdarstellung

Bestehende KPI-Werte werden nicht neu berechnet.

Wo die vorhandenen Daten es erlauben, darf die Darstellung ergänzen:

- Ist
- Soll
- Differenz
- Trend
- Status

Statusfarben werden nie allein verwendet. Kritische Zustände erhalten zusätzlich Icon und Text:

- Kritisch
- Aufmerksamkeit erforderlich
- Beobachten
- Im Ziel
- Information

## Detailansichten

Wo bereits Daten und Navigation vorhanden sind, soll ein Klick auf eine KPI/Kachel die bestehende Detailansicht oder Liste öffnen.

Grundsatz:

`KPI → bestehende Datengrundlage → betroffene Datensätze`

Es wird keine zweite parallele Detaildatenbank oder unabhängige KPI-Logik eingeführt.

## Berechtigungen

Widget Registry und Widget Library verwenden die bestehenden ExportHUB-Modul-/Rechteprüfungen.

Ein Benutzer darf nur Widgets aktivieren, deren zugrunde liegende Daten/Funktionen er ohnehin sehen darf.

Eine gespeicherte Konfiguration mit inzwischen entzogener Berechtigung führt nicht zur Anzeige des Widgets. Die Konfiguration darf den Rechtecheck niemals überstimmen.

## Performance

Die Personalisierung darf keine nennenswerte Verlangsamung verursachen.

Regeln:

- kein neues großes UI-Framework
- keine doppelten API-Abfragen nur wegen Personalisierung
- keine doppelte KPI-Berechnung
- ausgeblendete Widgets lösen keine neuen Datenabfragen aus
- Layout-Änderungen arbeiten auf lokalem UI-State
- keine unnötigen Vollseiten-Re-Renders
- Diagramme/Tabellen erst aktualisieren, wenn ihr Widget sichtbar ist
- DOM-Beobachter auf den Dashboard-Bereich begrenzen
- keine `transition: all` auf Drag-/Resize-relevanten Elementen

## Responsive Verhalten

Desktop:

- vollständiges Raster
- Drag & Drop
- alle Größen

Tablet:

- Drag & Drop bzw. Pointer-basierte Verschiebung
- reduzierte Spaltenzahl
- Größen werden responsiv übersetzt

Smartphone:

- einspaltige bzw. sichere kompakte Darstellung
- keine horizontalen Überläufe
- Kachelreihenfolge weiterhin änderbar
- große Tabellen/Diagramme erhalten eine geeignete Detailansicht oder kontrolliertes internes Scrolling

## Design-System

Die neue Oberfläche verwendet die vorhandenen ExportHUB-Design- und Theme-Variablen und respektiert den bestehenden Theme-Switcher.

Verbessert werden dürfen:

- Kartenhierarchie
- Abstände
- Typografie
- Icons
- Schatten
- Rahmen
- Hover-/Focus-Zustände
- Tooltips

Klassisches und bestehende alternative Designs dürfen nicht durch globale neue CSS-Regeln beschädigt werden. Neue Regeln werden auf den personalisierten Dashboard-Bereich gescoped.

## Fehlerbehandlung

Ungültiger oder veralteter Layout State:

- defensiv parsen
- unbekannte Widget-IDs ignorieren
- neue Standardwidgets ergänzen, wenn fachlich vorgesehen
- unzulässige Größen auf die Widget-Standardgröße normalisieren
- bei nicht reparierbarem Zustand auf Standard zurückfallen

Fehler beim Speichern des persönlichen Layouts dürfen das fachliche Dashboard nicht blockieren.

## Tests

Neue Tests müssen vor der Implementierung fehlschlagen und danach grün werden.

Mindestens zu prüfen:

### Layout-State

- Benutzertrennung
- Speichern und Reload
- unbekannte Widget-ID
- ungültige Größe
- Standard wiederherstellen
- Vorlagenwechsel

### Widget Registry / Rechte

- berechtigtes Widget sichtbar
- nicht berechtigtes Widget nicht hinzufügbar
- Rechteentzug nach gespeicherter Konfiguration versteckt Widget

### Bedienung

- Kachel hinzufügen
- Kachel ausblenden
- Kachel verschieben
- Größe ändern
- Reihenfolge nach Reload identisch

### Regression

Bestehende Dashboard-Tests bleiben grün, insbesondere:

- offene Sendungen = noch nicht abgeholt
- persönliche Aufgaben = richtiger Benutzer
- aktuelle Woche/Rückstand
- Dashboard-Navigation
- Warncenter / Benachrichtigungscenter
- vorhandene Rechte

### Responsive / Browser

- Desktop
- Laptop
- Tablet
- Smartphone
- keine Überlagerungen
- keine horizontalen Seitenüberläufe

### Performance

- keine zusätzliche API-Abfrage nur durch Layoutänderung
- ausgeblendete Widgets verursachen keine neue Datenladung
- Edit Mode erzeugt keinen Vollseiten-Neurender bei jeder Pointerbewegung

## Release-Sicherheit

Die Änderung wird nicht direkt auf `main` entwickelt.

Ablauf:

1. Feature-Branch
2. neue Regressionstests rot
3. minimale Implementierung
4. neue Tests grün
5. vollständige bestehende Testsuite
6. Build-/Release-Vertrag prüfen
7. Browser-/Responsive-Smoke
8. Review
9. erst danach Merge/Release

Eine erfolgreiche lokale Implementierung ist kein Produktionsnachweis.

## Nicht-Ziele

Nicht Bestandteil dieses Umbaus:

- Änderung fachlicher KPI-Formeln
- Änderung von Sendungsstatuslogik
- Änderung von Aufgabenfälligkeit oder Wiederholungslogik
- Änderung von Datenquellen
- Änderung des Azure-Team-State-Modells
- Neuentwicklung von Warncenter oder Benachrichtigungscenter
- Austausch des bestehenden Theme-Systems

## Akzeptanzkriterien

Die Umsetzung ist erst fertig, wenn:

1. alle bisherigen Dashboard-Funktionen weiterhin vorhanden sind
2. bestehende KPI-/Statuswerte unverändert aus denselben Quellen kommen
3. jeder Benutzer sein Layout unabhängig speichern kann
4. Widgets hinzugefügt, verborgen, verschoben und in erlaubten Größen geändert werden können
5. Vorlagen und Standard-Wiederherstellung funktionieren
6. Rechte nicht umgangen werden können
7. Desktop, Tablet und Smartphone ohne Überlagerungen funktionieren
8. die bestehende Testsuite plus neue Dashboard-Tests grün ist
9. der ExportHUB-Release-/Buildvertrag weiterhin grün ist
10. kein Produktionsstatus behauptet wird, bevor der reale Produktions-Smoke erfolgreich war
