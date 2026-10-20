# ExportHUB360 SOP-Neuaufbau – Design-Spezifikation

**Datum:** 2026-10-16  
**Status:** Design freigegeben, noch nicht implementiert  
**Projekt:** ExportHUB360

## 1. Ziel

Die bestehende SOP-Handbuch-Funktion wird fachlich neu aufgebaut. Der bisherige aktive SOP-Katalog mit den alten `SOP-EH-xxx`-Arbeitsanweisungen darf in der Benutzeroberfläche nicht mehr als SOP-Handbuch erscheinen und wird nicht als sichtbarer Legacy-Bestand weitergeführt.

Die neue SOP-Funktion dient ausschließlich neu erstellten, praxisnahen Arbeitsanweisungen mit klaren Kategorien, bebilderten Einzelschritten, Prüfhinweisen und geführter Bearbeitung.

Die Git-Historie bleibt die technische Rücksicherung für alte Implementierungen; ein separater sichtbarer Altbestand ist nicht erforderlich.

## 2. Erfolgsdefinition

Die Umstellung gilt erst als vollständig, wenn:

1. der Begriff und Menüpunkt **„SOP-Handbuch“** aus der produktiven Benutzeroberfläche entfernt ist;
2. alte aktive `SOP-EH-xxx`-Inhalte nicht mehr in der neuen SOP-Liste erscheinen;
3. die neue Navigation die Bereiche **Kunden-SOPs**, **Versanddienstleister** und **Prozess-SOPs** enthält;
4. die BSH-SOP als echte produktive SOP unter `Kunden-SOPs > BSH-Gruppe` erreichbar ist;
5. DHL unter `Versanddienstleister > DHL` als eigener Bereich vorhanden ist und nur neu erstellte DHL-SOPs anzeigt;
6. die bestehende geführte SOP-Darstellung für Schritte, Bilder, Pflichtschritte, Hinweise, Prüfungen und Fortschritt weiterverwendet wird;
7. Suche, Navigation, Responsive-Verhalten und bestehende SOP-nahe Funktionen keine Regressionen zeigen;
8. Build, Unit-Tests, Browser-/E2E-Tests und Produktions-Deploy erfolgreich abgeschlossen sind.

Erst nach erfolgreichem Produktions-Deploy darf der Projektfortschritt für diese Umstellung 100 % anzeigen.

## 3. Nicht-Ziele

Diese Umstellung beinhaltet nicht:

- die automatische Neuerstellung aller zukünftigen SOP-Inhalte;
- eine Migration alter `SOP-EH-xxx`-Texte in neue SOPs;
- eine inhaltliche Übernahme des alten SOP-Handbuchs;
- eine Änderung fachfremder ExportHUB-Funktionen;
- das Entfernen der Git-Historie oder alter Commits.

## 4. Neue Informationsarchitektur

Die sichtbare SOP-Funktion wird künftig als Arbeitsanweisungsbereich strukturiert.

### 4.1 Hauptbereich

**SOP / Arbeitsanweisungen**

### 4.2 Kategorien

#### Kunden-SOPs
Kundenspezifische Arbeitsanweisungen.

Beispiel:

- BSH-Gruppe
  - Transportanmeldung BSH-Gruppe

Die BSH-Gruppe umfasst in dieser SOP die Kunden BSH, Neff und Gaggenau.

#### Versanddienstleister
Arbeitsanweisungen für Carrier und Versandplattformen.

Beispiel:

- DHL
  - künftig neu erstellte DHL-SOPs

Ein vorhandener DHL-Testdatensatz darf nicht als produktive DHL-SOP verwendet werden.

#### Prozess-SOPs
Allgemeine Arbeitsabläufe, die weder einem einzelnen Kunden noch einem Versanddienstleister zugeordnet sind.

## 5. BSH-SOP

### 5.1 Zielposition

`SOP / Arbeitsanweisungen > Kunden-SOPs > BSH-Gruppe > Transportanmeldung BSH-Gruppe`

### 5.2 Inhaltliche Grundlage

Die neue BSH-SOP basiert auf der vom Benutzer bereitgestellten und überarbeiteten Arbeitsanweisung für:

- BSH
- Neff
- Gaggenau

Die bereits optimierte bebilderte Fassung ist die fachliche Referenz für die Website-SOP.

### 5.3 Mindestinhalt

Die produktive BSH-SOP muss mindestens abbilden:

- Anmeldung im BSH-Partnerportal;
- Auswahl des richtigen Kunden/Werks;
- Merken und Weiterverwenden der Werknummer;
- Datum und Uhrzeit erfassen;
- Verpackung auswählen;
- Regel: `WPA = Einwegpalette und immer nicht stapelbar`;
- ExportHUB-Referenz eintragen;
- Lieferavis auswählen;
- alle Lieferscheine mit Menge erfassen;
- Sendungsnummer erstellen;
- Sendungsnummer in ExportHUB360 eintragen;
- Sendungsnummer in die Kundenmail übernehmen;
- erforderliche Lieferscheine an den Kunden senden;
- Abschlusskontrolle.

### 5.4 Bilder

Die Bilder werden schrittbezogen eingebunden und dürfen nicht nur als Word-Download verfügbar sein.

Anforderungen:

- einheitliche Breite und Ausrichtung;
- lesbarer Zuschnitt;
- keine unnötigen weißen Ränder;
- farbige Hervorhebungen wichtiger Felder und Buttons;
- vergrößerbare Darstellung;
- keine Überlagerungen auf Desktop, Tablet oder Smartphone;
- aussagekräftige Bildunterschrift;
- Zuordnung über `stepId` bzw. das bestehende Visual-Modell.

## 6. Neue SOP-Datenstruktur

Die bestehende Guided-SOP-Oberfläche wird weiterverwendet. Die neue fachliche Katalogschicht soll jedoch nicht mehr auf den alten aktiven RC1016-Katalog angewiesen sein.

Empfohlene Dokumentstruktur:

```js
{
  id: 'SOP-CUST-BSH-001',
  number: 'SOP-CUST-BSH-001',
  type: 'customer',
  category: 'customer',
  group: 'BSH-Gruppe',
  customerIds: ['BSH', 'NEFF', 'GAGGENAU'],
  title: 'Transportanmeldung BSH-Gruppe',
  status: 'Freigegeben',
  version: '1.0',
  sections: {
    prerequisites: [],
    steps: [],
    checks: [],
    deviations: [],
    resources: []
  },
  visuals: []
}
```

Für Versanddienstleister wird dieselbe Grundstruktur mit `type/category = carrier` verwendet.

Für allgemeine Abläufe wird `type/category = process` verwendet.

## 7. Trennung vom alten SOP-Handbuch

### 7.1 Sichtbare Oberfläche

Folgende Bezeichnungen dürfen produktiv nicht mehr als Hauptbegriff der neuen Funktion erscheinen:

- SOP-Handbuch
- alter aktiver SOP-EH-Katalog

Stattdessen lautet die Benutzerführung auf **SOP** bzw. **Arbeitsanweisungen**.

### 7.2 Alte SOP-Daten

Die 24 konsolidierten RC1016-SOPs sowie ältere 75 Einzeldokumente werden nicht in die neue aktive Liste übernommen.

Alte Daten dürfen intern nur noch dort bestehen, wo sie für historische Code-/Test-Rückverfolgbarkeit nötig sind. Sie dürfen nicht über normale Navigation, Suche oder Kategorieansicht als aktive SOP erscheinen.

### 7.3 Altverträge in Tests

Tests, die ausschließlich das alte Produktverhalten festschreiben, müssen ersetzt oder angepasst werden. Dazu gehören insbesondere Tests, die zwingend:

- `SOP-Handbuch` als sichtbaren Navigationstitel erwarten;
- eine feste `SOP-EH-060` als zentrale SOP voraussetzen;
- den alten 24-SOP-Katalog als produktiven Sollzustand erwarten.

Testabdeckung für allgemeine Guided-SOP-Funktionen bleibt erhalten und wird auf neue Testfixtures bzw. neue produktive SOP-IDs umgestellt.

## 8. UI/UX

### 8.1 Startansicht

Die neue SOP-Startansicht zeigt:

- Suchfeld;
- Kategorien;
- zuletzt/gebräuchlich genutzte SOPs, sofern bereits technisch vorhanden und ohne zusätzliche Komplexität nutzbar;
- Karten oder kompakte Listen mit Titel, Kategorie, Version und Status.

### 8.2 Kategorieansicht

Beispiel Kunden-SOPs:

- BSH-Gruppe
- weitere Kunden später

Beispiel Versanddienstleister:

- DHL
- weitere Carrier später

### 8.3 Einzel-SOP

Die bestehende Guided-Workspace-Darstellung bleibt Grundlage:

- Schritt-Navigation links bzw. mobil oben;
- aktueller Arbeitsschritt zentral;
- Bild direkt beim Schritt;
- Pflicht-/Prüfhinweise;
- erwartetes Ergebnis;
- Warnungen/Fehlerhinweise;
- Fortschritt;
- Zurück/Weiter/Schritt erledigt.

## 9. Suche und Filter

Die Suche muss mindestens finden können nach:

- SOP-Titel;
- Kunde/Kundengruppe;
- Versanddienstleister;
- Stichworten;
- SOP-Nummer.

Die alte SOP-EH-Liste darf dabei nicht als normaler Suchbestand zurückkehren.

## 10. Berechtigungen

Bestehende Rechte für Lesen/Bearbeiten/Freigeben werden soweit möglich weiterverwendet.

Mindestens erforderlich:

- Benutzer mit Leserecht können freigegebene SOPs öffnen;
- Bearbeitungsrechte bleiben getrennt von Leserechten;
- Entwürfe dürfen normalen Lesern nicht als freigegebene Arbeitsanweisung erscheinen;
- das Entfernen des alten Katalogs darf keine Rechteprüfung umgehen.

## 11. Versionierung

Neue SOPs starten mit einer eigenen Versionierung, z. B. `1.0`.

Änderungen an einer neuen SOP erzeugen eine neue Fassung statt alte SOP-EH-Versionen fortzuführen.

Der alte RC1016-Versionierungsstand wird nicht als Version der neuen BSH- oder DHL-SOP übernommen.

## 12. Technische Komponenten

Voraussichtlich betroffen:

- SOP-Katalog-/Datenquelle;
- SOP-Navigation und Bezeichnungen;
- Kategorisierung/Filterung;
- Guided Workspace nur dort, wo Anpassungen zur neuen Datenquelle nötig sind;
- Visual-/Screenshot-Zuordnung;
- Unit-Tests für SOP-Katalog und Guided Workspace;
- E2E-/Navigationstests;
- Build-/Injection-Tests;
- Produktions-Build.

Nicht vorgesehen ist ein vollständiges Rewrite des bereits funktionierenden Guided Workspace.

## 13. Kompatibilitätsstrategie

Die Umstellung erfolgt über eine neue aktive SOP-Datenquelle mit eindeutigem Katalogvertrag.

Lesende Komponenten sollen neue Dokumenttypen verarbeiten, ohne auf feste `SOP-EH-xxx`-Nummern angewiesen zu sein.

Bestehende generische Funktionen wie:

- Schritt-Normalisierung;
- Bildzuordnung;
- Fortschrittsstatus;
- Pflichtschritt-Sperre;
- Kontext-/Hinweisbereich

werden erhalten.

## 14. Fehlerfälle

Die UI muss sauber reagieren, wenn:

- eine SOP keine Bilder hat;
- ein Bild nicht geladen werden kann;
- eine Kategorie leer ist;
- eine SOP-ID nicht existiert;
- ein alter Direktlink auf eine entfernte SOP zeigt;
- ein Entwurf nicht freigegeben ist.

Für alte Direktlinks soll eine klare Meldung statt einer leeren oder kaputten Seite erscheinen. Eine automatische Weiterleitung auf fachlich andere SOPs ist nicht erlaubt.

## 15. Tests

### 15.1 Unit-Tests

Mindestens:

- neuer Katalog enthält nur neue aktive SOPs;
- BSH-SOP ist der Kategorie Kunden-SOPs / BSH-Gruppe zugeordnet;
- DHL-Testfixture wird nicht als produktive DHL-SOP gewertet;
- alte `SOP-EH-xxx` sind nicht in der aktiven Liste;
- Guided Workspace verarbeitet neue IDs und Kategorien;
- Visuals werden dem richtigen Schritt zugeordnet;
- Pflichtschritte und Fortschritt funktionieren weiter.

### 15.2 Browser-/E2E-Tests

Mindestens Desktop und Smartphone:

- SOP-Navigation öffnet die neue Startansicht;
- Text `SOP-Handbuch` ist in der normalen SOP-Navigation nicht mehr vorhanden;
- `Kunden-SOPs > BSH-Gruppe > Transportanmeldung BSH-Gruppe` ist erreichbar;
- Bilder sind sichtbar und vergrößerbar;
- kein horizontaler Overflow;
- Schrittfolge funktioniert;
- Suche findet BSH;
- alte SOP-EH-Dokumente erscheinen nicht in Suche oder Listen;
- DHL-Bereich ist vorhanden, zeigt aber nur tatsächlich freigegebene neue DHL-SOPs.

### 15.3 Regression

Andere Hauptbereiche von ExportHUB360 müssen unverändert erreichbar bleiben.

## 16. Deployment

Reihenfolge:

1. Implementierung auf Entwicklungsbranch;
2. Unit-Tests;
3. Browser-/E2E-Tests;
4. vollständiger Build;
5. Release-Gates;
6. Merge in den Produktionszweig;
7. Produktions-Deploy;
8. Live-Prüfung der SOP-Navigation, BSH-SOP und Bilder;
9. erst danach Status 100 %.

## 17. Migrationsentscheidung

Es gibt keine fachliche Migration des alten SOP-Handbuchs.

Der neue Bestand startet bewusst sauber. Bestehende alte SOP-Inhalte werden bei Bedarf später einzeln neu erstellt und fachlich geprüft, bevor sie als neue Kunden-, Carrier- oder Prozess-SOP veröffentlicht werden.

## 18. Erste produktive Inhalte

### Sofort

1. **Kunden-SOPs > BSH-Gruppe > Transportanmeldung BSH-Gruppe**
   - vollständiger Inhalt aus der freigegebenen bebilderten BSH-Arbeitsanweisung;
   - alle optimierten Bilder schrittbezogen auf der Website.

2. **Versanddienstleister > DHL**
   - Kategorie/Gruppe wird angelegt;
   - noch keine Test-SOP als produktiv markieren;
   - neue DHL-SOPs werden erst nach fachlicher Erstellung veröffentlicht.

## 19. Abnahmekriterien

Die Implementierung ist abgenommen, wenn alle folgenden Punkte gleichzeitig erfüllt sind:

- kein sichtbares altes SOP-Handbuch;
- keine alten aktiven SOP-EH-Dokumente in normaler Navigation/Suche;
- neue Kategorien vorhanden;
- BSH-SOP produktiv auffindbar und vollständig;
- Bilder korrekt zugeordnet, lesbar und responsiv;
- Guided Workspace funktionsfähig;
- DHL als Bereich vorhanden, ohne Testdaten als echte SOP;
- Tests grün;
- Build grün;
- Produktions-Deploy erfolgreich;
- Live-Test erfolgreich.

## 20. Projektfortschritt

Der Fortschritt wird künftig so bewertet:

- 20 %: Analyse und Design abgeschlossen;
- 35 %: neue Datenstruktur/Katalog implementiert;
- 50 %: neue Navigation/Kategorien implementiert;
- 65 %: BSH-SOP samt Bildern integriert;
- 75 %: alte aktive SOP-Handbuch-Inhalte aus UI/Suche entfernt;
- 85 %: Unit-/E2E-Tests erfolgreich;
- 95 %: Build/Release-Gates erfolgreich;
- 100 %: Produktions-Deploy und Live-Test erfolgreich.

**100 % ist vor erfolgreichem Produktions-Deploy ausdrücklich unzulässig.**
