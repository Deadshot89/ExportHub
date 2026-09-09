# RC1014 Aufgaben – Abschlussdesign

**Status:** vom Nutzer am 09.09.2026 fachlich freigegeben  
**Basis:** RC1013 / `525592b9c0982b7ab0e52698783f8b3720f310ed`  
**Ziel:** Das vorhandene ExportHUB-Aufgabenmodul vollständig produktionsreif machen und den Release zusätzlich durch einen echten Browser-Funktions- und Designtest absichern, ohne ein zweites Aufgaben-, Rechte- oder Persistenzsystem einzuführen.

## 1. Ausgangslage

Der aktuelle Stand besitzt bereits eine stabile Aufgabenansicht mit genau fünf fachlichen Gruppen:

1. Offene Sendungen
2. Fehlende POD
3. Kunde angemeldet
4. Picks
5. Offene ABDs

Die bestehende Laufzeit enthält bereits Deduplizierung, Gruppenstatus und die aktive Aufgabenansicht. Diese Funktionen bleiben die Grundlage. RC1014 erweitert den bestehenden Aufgabenlebenszyklus um Fälligkeit, Priorität, Zuständigkeit, Vertretung, Wiederholung, automatische Erledigung, direkte Vorgangsöffnung und verlässliche Erinnerungen.

## 2. Grundprinzipien

- Kein zweites Aufgabensystem und keine parallele Aufgabenquelle.
- Die vorhandenen fünf Gruppen bleiben unverändert bestehen.
- Fachliche Aktionen in ExportHUB sind die maßgebliche Quelle für automatische Aufgaben und deren Erledigung.
- Eine Aufgabe darf nicht doppelt entstehen, wenn derselbe Vorgang bereits als offene Aufgabe vorhanden ist.
- Firmen-, Umgebungs- und Rechteisolation gelten auch für Aufgaben uneingeschränkt.
- Produktion, TESTSERVICE, Demo und Android bleiben auf demselben Release.
- Bestehende RC1001/RC1002/RC1003-Aufgabenverträge bleiben als Regression erhalten.
- Der bereits grüne CSS-/DOM-Designvertrag wird um einen echten Browser-Visualtest ergänzt; reine Quelltextprüfung gilt nicht mehr als alleiniger Designnachweis.

## 3. Einheitliches Aufgabenmodell

Jede sichtbare Aufgabe erhält mindestens folgende fachliche Felder:

- `id`: eindeutige Aufgaben-ID.
- `sourceType`: Quelle, z. B. `shipment`, `pod`, `pickup`, `abd`, `pick`, `manual`.
- `sourceId`: stabile Vorgangs-ID der Quelle.
- `sourceRef`: für den Benutzer lesbare Referenz, z. B. Sendungsreferenz.
- `group`: genau eine der fünf bestehenden Aufgabengruppen.
- `title`: kurze eindeutige Aufgabenbezeichnung.
- `status`: `open`, `done`, `cancelled`.
- `dueAt`: fachlicher Fälligkeitszeitpunkt oder Fälligkeitsdatum.
- `priority`: `P0`, `P1`, `P2`, `P3` oder `P4`.
- `originalAssignee`: ursprünglich fachlich zuständiger Benutzer.
- `effectiveAssignee`: aktuell zuständiger Benutzer nach Vertretungslogik.
- `substitutionReason`: leer oder dokumentierter Vertretungsgrund.
- `recurrence`: leer oder Wiederholungsregel.
- `completedAt`: Zeitpunkt der fachlichen Erledigung.
- `completedBy`: Benutzer oder Systemaktion, die die Aufgabe erledigt hat.
- `companyId`: verbindlicher Firmenkontext.
- `environment`: `production`, `testservice` oder `demo`.
- `createdAt` und `updatedAt`.

Bestehende ältere Aufgaben ohne alle neuen Felder werden zur Laufzeit defensiv normalisiert; sie dürfen dadurch weder verschwinden noch fremden Firmen zugeordnet werden.

## 4. Eindeutigkeit und Deduplizierung

Die bestehende Deduplizierung wird nicht ersetzt, sondern fachlich präzisiert. Für automatisch erzeugte Aufgaben gilt als stabiler Schlüssel mindestens:

`companyId + environment + group + sourceType + sourceId + occurrenceKey`

`occurrenceKey` ist bei einmaligen Aufgaben leer bzw. stabil und bei wiederkehrenden Aufgaben die konkrete Fälligkeitsperiode, z. B. `2026-W37` oder `2026-09-09`.

Dadurch dürfen zwei unterschiedliche Aufgaben derselben Sendung nicht denselben Status übernehmen. Gleichzeitig darf dieselbe fachliche Aufgabe für denselben Vorgang nicht doppelt erscheinen.

## 5. Automatische Erzeugung und Erledigung

### 5.1 Offene Sendungen

Die bestehende fachliche Erkennung offener Sendungen bleibt maßgeblich. RC1014 ergänzt Lifecycle-Metadaten und direkte Vorgangsöffnung. Wenn die Sendung fachlich abgeschlossen oder archiviert ist, wird die zugehörige offene Aufgabe automatisch erledigt. Bei Storno erhält sie den Status `cancelled` und wird nicht als erledigte operative Arbeit gezählt.

### 5.2 Fehlende POD

Sobald eine Sendung als abgeholt gilt und noch kein POD vorhanden ist, besteht eine offene POD-Aufgabe. Sobald ein gültiger POD hochgeladen bzw. der POD-Status fachlich gesetzt wurde, wird die Aufgabe automatisch erledigt. Teilabholung darf die POD-Aufgabe nicht fälschlich als vollständig erledigt behandeln, solange der zugrunde liegende Fachprozess noch offen ist.

### 5.3 Kunde angemeldet

Die vorhandene fachliche Erkennung und Abschlussbedingung dieser Gruppe bleiben autoritativ und werden vor Änderung als Regressionstest eingefroren. RC1014 ergänzt nur eindeutige Vorgangsidentität, Fälligkeit, Priorität, Zuständigkeit und direkte Öffnung. Bloßes Öffnen einer Karte darf die Aufgabe niemals erledigen.

### 5.4 Picks

Offene Picks bleiben als Aufgaben sichtbar. Ein fachlich bestätigter Pick erledigt ausschließlich die dazugehörige konkrete Pick-Aufgabe. Mehrere Picks derselben Sendung dürfen sich nicht gegenseitig als erledigt markieren.

### 5.5 Offene ABDs

Wenn die bestehende ABD-Regel eine ABD verlangt und noch keine ausreichende ABD vorliegt, besteht die Aufgabe. Sobald die erforderliche ABD fachlich vorhanden ist, wird genau diese Aufgabe automatisch erledigt. Nicht ABD-pflichtige Sendungen erzeugen keine ABD-Aufgabe.

## 6. Prioritäten

Aufgaben, die aus einer Sendung oder einem Pick entstehen, übernehmen die vorhandene fachliche Dringlichkeit des Vorgangs, soweit sie verfügbar ist. Die ExportHUB-Prioritäten bleiben P0 bis P4.

Darstellung und Sortierung:

- P0 zuerst und deutlich als kritisch/sofort sichtbar.
- Danach P1, P2, P3, P4.
- Innerhalb derselben Priorität zuerst überfällig, dann heute, dann zukünftig.
- Innerhalb derselben Fälligkeit nach fachlich stabiler Referenz bzw. Erstellzeit sortieren.

Die Priorität bestimmt nicht nur die Darstellung, sondern auch Reihenfolge und Erinnerungsauswahl.

## 7. Fälligkeit

RC1014 verwendet den vorhandenen fachlichen Termin des jeweiligen Vorgangs, statt künstliche neue Termine zu erfinden. Wo ein Abholtag oder bestehender operativer Termin vorhanden ist, bildet dieser die Fälligkeitsbasis.

Die Oberfläche unterscheidet mindestens:

- **Überfällig**
- **Heute**
- **Zukünftig**
- **Ohne Termin**

Fehlt für eine bestehende Altaufgabe ein belastbarer Termin, bleibt sie offen und wird als **Ohne Termin** gekennzeichnet; sie darf nicht automatisch auf heute gesetzt werden.

## 8. Verantwortlicher und Vertretung

Jede persönliche Aufgabe zeigt den fachlich Verantwortlichen. Bei einer für den Fälligkeitstag gültigen Abwesenheit gilt:

- `originalAssignee` bleibt unverändert dokumentiert.
- `effectiveAssignee` wird auf die hinterlegte Vertretung gesetzt.
- Die Aufgabe wird nicht dupliziert.
- Der Vertretungsgrund wird nachvollziehbar gespeichert bzw. angezeigt.
- Nach Ende der Abwesenheit werden bereits erledigte Aufgaben nicht zurückverschoben.
- Noch offene Aufgaben folgen wieder der fachlichen Zuständigkeitsregel, sofern keine andere aktive Vertretung greift.

Eine Vertretung darf niemals Firmen- oder Rechteisolation umgehen.

## 9. Wiederkehrende Aufgaben

Wiederkehrende Aufgaben werden nicht durch Zurücksetzen derselben Aufgabe auf `open` recycelt. Nach fachlicher Erledigung entsteht für die nächste fällige Periode eine neue Aufgabeninstanz mit neuer `id` und neuem `occurrenceKey`.

Damit bleibt die Historie nachvollziehbar und eine erledigte Vorwoche kann nicht durch die neue Woche rückwirkend wieder offen erscheinen.

## 10. Erinnerungen und Android

Die bestehenden Erinnerungszeiten bleiben verbindlich:

- 09:00 Uhr
- 12:00 Uhr
- 15:00 Uhr

Eine Erinnerung berücksichtigt ausschließlich Aufgaben, die für den aktuell angemeldeten bzw. effektiv zuständigen Benutzer sichtbar und offen sind. Priorität und Fälligkeit bestimmen die Reihenfolge.

Deduplizierung der Erinnerungen erfolgt mindestens über:

`taskId + date + reminderSlot + environment + userId`

Damit darf derselbe Erinnerungsslot nicht mehrfach dieselbe Aufgabe melden.

Android öffnet bei Tipp auf eine Aufgabenbenachrichtigung zunächst die bereits vorhandene native Detailansicht. Von dort führt **In ExportHUB öffnen** gezielt zum zugehörigen Vorgang. Der geschützte Arbeitsbereich bleibt weiterhin anmeldungs- und berechtigungspflichtig.

## 11. Direkte Vorgangsöffnung

Jede Aufgabenkarte erhält eine eindeutige primäre Aktion **Öffnen**. Diese verwendet ausschließlich bestehende ExportHUB-Navigation bzw. bestehende Detailfunktionen:

- Sendungsbezogene Aufgabe → bestehende Sendungsansicht.
- POD-Aufgabe → zugehörige Sendung/POD-Bereich.
- ABD-Aufgabe → zugehörige Sendung/ABD-Bereich.
- Pick-Aufgabe → vorhandener Pick-/Sendungskontext.

RC1014 führt keinen Parallelrouter und keine zweite Detailansicht ein.

## 12. Rechte und Mandantenisolation

- Aufgaben werden immer im serverseitig bzw. sitzungsseitig gebundenen Firmenkontext verarbeitet.
- Ein Benutzer darf niemals durch manipulierte Aufgabe, URL, Header oder gespeicherten State eine fremde Firma öffnen.
- Nicht berechtigte Funktionsbereiche werden nicht als gesperrte Kachel angezeigt, sondern bleiben unsichtbar gemäß aktuellem ExportHUB-Rechtevertrag.
- Global-Admin-Verhalten bleibt vom bestehenden Rollenmodell bestimmt.
- Demo verwendet ausschließlich Demo-Daten und darf keine Produktions- oder TESTSERVICE-Aufgaben lesen oder schreiben.

## 13. Design

Die bestehende RC990-Designbasis bleibt erhalten.

### Desktop

- Drei Aufgabenkarten pro Reihe, sofern die Inhaltsbreite dies zulässt.
- Jede Karte zeigt klar: Gruppe, Titel, Referenz, Fälligkeit, Priorität und Verantwortlichen.
- Primäraktion **Öffnen** ist eindeutig.
- Status- und Prioritätsinformation werden nicht nur über Farbe vermittelt, sondern zusätzlich als Text/Badge.

### Mittlere Breite

- Zwei Karten pro Reihe.
- Kein horizontales Abschneiden von Referenz, Fälligkeit oder Aktion.

### Smartphone

- Eine Karte pro Reihe.
- Priorität und Fälligkeit bleiben ohne horizontales Scrollen sichtbar.
- Aktionen besitzen ausreichende Touch-Fläche.
- Keine überlagernden Badges oder abgeschnittene Überschriften.

### Zustandsdarstellung

- Überfällig, heute und zukünftig sind deutlich unterscheidbar.
- P0/P1 erhalten eine stärkere visuelle Gewichtung, ohne den gesamten Bildschirm alarmrot zu färben.
- Erledigte Aufgaben verschwinden aus der offenen Arbeitsansicht und bleiben nur dort sichtbar, wo Historie fachlich vorgesehen ist.

## 14. Fehlerbehandlung

Fehler beim Laden oder Aktualisieren einer Aufgabe dürfen nicht die gesamte Aufgabenansicht zerstören. Es wird das vorhandene ExportHUB-Status-/Fehlersystem verwendet.

Ein Aufgabenfehler enthält mindestens:

- betroffene Aufgaben-ID bzw. Referenz,
- Benutzer/Firma/Umgebung,
- verständliche Meldung,
- technischen Fehlercode, soweit verfügbar.

Die RC1013-Fehlerdiagnose bleibt hierfür die zentrale Diagnosequelle; RC1014 baut kein eigenes Fehlerprotokoll.

## 15. Echter Browser-Funktions- und Designtest

Zusätzlich zur bestehenden Node-/CSS-/DOM-Regression wird RC1014 mit einem echten Headless-Browser getestet. Bevorzugt wird Chromium/Playwright im GitHub-Workflow; falls im Repository bereits ein gleichwertiger Browser-Runner vorhanden ist, wird dieser wiederverwendet.

Mindestens folgende Viewports werden geprüft:

- Desktop: 1440 × 900
- Tablet/kleiner Desktop: 1024 × 768
- Smartphone: 390 × 844

Für die wichtigsten ExportHUB-Ansichten werden Browser-Screenshots als Workflow-Artefakt erzeugt, mindestens für:

- Dashboard
- Sendungsübersicht
- Sendung erstellen/bearbeiten mit Beispielinhalt
- Aufgaben
- Abholkalender
- SOP
- Fehlerdiagnose, soweit der Testbenutzer die erforderliche Rolle besitzt

Die Browserprüfung kontrolliert zusätzlich maschinell:

- kein horizontales Seiten-Overflow,
- keine abgeschnittene Hauptüberschrift,
- keine überlagerte Topbar/Navigation,
- keine außerhalb des Viewports liegenden Hauptaktionen,
- Aufgabenraster 3/2/1 passend zum Viewport,
- keine Überlappung von Prioritäts-/Fälligkeitsbadges und Text,
- ausreichende Touch-/Buttonfläche auf Smartphone,
- sichtbare Fokuszustände der Hauptaktionen,
- keine JavaScript-Console-Errors beim Öffnen der geprüften Ansichten.

Die erzeugten Screenshots werden vor Release zusätzlich visuell geprüft. Ein grüner CSS-Quelltexttest allein reicht nicht mehr als Designfreigabe.

## 16. Tests

Die Umsetzung erfolgt strikt RED → GREEN.

Mindestens folgende neue RC1014-Verträge werden vor Produktivcode als fehlgeschlagene Tests angelegt:

1. Aufgabenmodell enthält stabile Identität, Fälligkeit, Priorität und Zuständigkeit.
2. Zwei unterschiedliche Aufgaben derselben Sendung teilen niemals ungewollt denselben Status.
3. POD-Upload erledigt exakt die zugehörige POD-Aufgabe.
4. ABD-Erstellung erledigt exakt die zugehörige ABD-Aufgabe.
5. Pick-Abschluss erledigt exakt die konkrete Pick-Aufgabe.
6. Wiederkehrende Aufgabe erzeugt eine neue Folgeinstanz statt Status-Recycling.
7. Aktive Abwesenheit setzt `effectiveAssignee`, erhält aber `originalAssignee`.
8. Fremdfirmen-Aufgaben bleiben unsichtbar und nicht direkt aufrufbar.
9. Erinnerungen sind pro Benutzer, Umgebung, Tag und Slot dedupliziert.
10. 09:00/12:00/15:00 bleiben die einzigen regulären Aufgaben-Erinnerungsslots.
11. Aufgabenkarte öffnet über den bestehenden ExportHUB-Pfad den richtigen Vorgang.
12. Desktop/Mittel/Smartphone erfüllen das 3-2-1-Raster und zeigen neue Pflichtinformationen ohne horizontales Überlaufen.
13. Browser-Smoke-Test öffnet die wichtigsten Ansichten ohne Console-Error.
14. Browser-Layouttest meldet Overflow, Überlagerungen und abgeschnittene Hauptaktionen als Fehler.
15. Screenshot-Artefakte werden für Desktop, Tablet und Smartphone erzeugt.
16. Bestehende RC1001/RC1002/RC1003-Aufgabenverträge bleiben grün.
17. Vollständige Node-Regression bleibt grün.
18. Drei-Umgebungen-Build erzeugt denselben RC1014-Stand für Produktion, TESTSERVICE und Demo.
19. Android-App trägt denselben RC1014-Release und ihre Aufgabenbenachrichtigungen bleiben direkt öffnungsfähig.

## 17. Release und Verifikation

RC1014 wird auf einem isolierten Branch umgesetzt und erst nach vollständiger Prüfung nach `main` gemergt.

Freigabereihenfolge:

1. neue RC1014-RED-Tests nachweisbar rot,
2. minimale Implementierung bis GREEN,
3. Aufgaben-Zieltests grün,
4. bestehende Aufgabenregression grün,
5. vollständige Node-Regression grün,
6. Design-/Render-/Rechte-/Mandantentests grün,
7. Browser-Funktions- und Layouttest in allen drei Viewports grün,
8. Screenshot-Artefakte erzeugt und visuell ohne Release-Blocker geprüft,
9. Drei-Umgebungen-Build grün,
10. Android-Build grün,
11. Code-Review ohne kritischen oder wichtigen offenen Befund,
12. Merge nach `main`,
13. frischer Main-Contract,
14. gemeinsamer Deploy von Produktion und TESTSERVICE mit Demo im gemeinsamen Build,
15. Live-Verifikation aller drei Umgebungen auf exakt RC1014,
16. frischer Android-Artefaktbuild vom finalen Main-SHA.

Erst nach Punkt 16 gilt RC1014 als abgeschlossen.

## 18. Nicht im RC1014-Scope

- Keine neuen Aufgabengruppen außerhalb der fünf bestehenden Gruppen.
- Kein separates Projektmanagement-/Kanban-System.
- Keine neue Datenbank nur für Aufgaben, sofern die vorhandene ExportHUB-Persistenz den erweiterten Datensatz tragen kann.
- Keine Änderung der freigegebenen QR-, Lieferavis-, Gate41-, SOP- oder Abholkalender-Fachregeln.
- Keine Aufweichung von Login, Firmenisolation oder Rollenrechten.
