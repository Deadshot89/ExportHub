# RC1016 Kalender und Aufgaben – Design

## Ziel

RC1016 übernimmt den fachlich bereits vorbereiteten RC1014-Aufgaben-Lifecycle und den erweiterten Abholkalender auf den aktuellen grünen RC1015-Stand, ohne die RC1015-Lieferavis-, QR-, Diagnose-, Gate41- oder Umgebungsfixes zurückzudrehen. Produktion, TESTSERVICE und Demo werden aus derselben RC1016-Buildquelle erzeugt und tragen dieselbe Versionskennung.

## Ausgangslage

- `main` steht auf RC1015 und ist grün deployt.
- Der ältere Entwicklungszweig `rc1014-tasks-final` enthält den neuen Aufgaben-Lifecycle, Aufgaben-Metadaten, Direktöffnung, Demo-Kalenderdaten und Sendungsübersichts-Metadaten.
- Der RC1014-Lifecycle und die Runtime-Integration bestehen ihre Unit-Tests.
- Der letzte RC1014-Lauf scheitert absichtlich an einem RED-Vertrag: Der Karten-Enhancer erkennt nur `.rc229-task-card.rc628-unified-task`, muss aber zusätzlich den aktiven `.task-card`-Renderer unterstützen.
- Der Chromium-Test verwendet ebenfalls nur den alten Selektor und meldet deshalb irreführend, dass keine Aufgabenkarten vorhanden seien.

## Architektur

RC1016 wird auf `a34bf4819f2c38a257f8618462fda0f461bd2aa9` (RC1015) aufgebaut. Die stabilen RC1014-Komponenten werden als fokussierte Assets übernommen; die Buildlogik wird als `.github/rc1016/build-three-env.mjs` neu angelegt und startet weiterhin mit dem bestehenden RC1013-Drei-Umgebungen-Build, der auf `main` bereits den RC1015-Lieferavis-Flow enthält. Danach ergänzt RC1016 Aufgaben, Sendungsmetadaten und Demo-Kalenderdaten und setzt die sichtbare Releasekennung auf RC1016.

Die Aufgaben-Runtime bleibt Adapter zwischen bestehendem Aufgaben-Store und dem RC1014-Lifecycle. Sie besitzt keinen zweiten Store. `prepareTasks()` normalisiert und reconciliert vorhandene Aufgaben, `enhanceTaskCards()` ergänzt sichtbare Karten um Priorität, Fälligkeit, Verantwortlichen und Öffnen-Aktion. Der Enhancer akzeptiert beide bekannten Rendererfamilien: den RC229/RC628-Renderer sowie `.task-card`.

## Aufgabenansicht

Eine sichtbare Aufgabe enthält mindestens:

- Priorität P0 bis P4,
- Fälligkeit bzw. Überfällig/Heute/Zukünftig,
- effektiven Verantwortlichen inklusive Vertretungslogik,
- eine eindeutige Öffnen-Aktion,
- Scope-Schutz für Firma und Umgebung.

Die Direktöffnung verwendet bei Pick-, POD- und ABD-Aufgaben die Sendungsreferenz. Fremde Firma oder fremde Umgebung wird nicht geöffnet.

## Kalender

Der bestehende Abholkalender bleibt die zentrale Kalenderansicht. RC1016 stellt sicher, dass:

- der Navigationspunkt in allen drei Umgebungen vorhanden ist,
- reguläre Wochenendtage nicht als Arbeitstage angeboten werden,
- feste Abholungen sichtbar sind,
- Produktion und TESTSERVICE die bestehende `/api/fixed-pickups`-Funktion verwenden,
- Demo ausschließlich isolierte lokale Demo-FIX-Daten nutzt,
- die Demo keine Produktivdaten abfragt oder verändert.

## Drei Umgebungen

Der Build erzeugt genau:

- `index.html` für Produktion,
- `TESTVERSION.html` für TESTSERVICE,
- `demo.html` für Demo.

Alle drei erhalten RC1016 als Buildversion und dieselben fachlichen Frontend-Assets. Nur Datenumgebung und Demo-Bridge unterscheiden sich. Die RC1015-Lieferavis-Maillogik muss in allen drei Builds weiterhin vorhanden sein.

## Fehlerbehandlung

Der Runtime-Enhancer darf bei unbekannten Karten keine Ausnahme werfen. Nicht zuordenbare Karten werden übersprungen. Scope-Verstöße werden blockiert und über den bestehenden ExportHUB-Statuskanal gemeldet. Persistiert wird nur, wenn der Lifecycle tatsächlich eine Änderung festgestellt hat.

## Tests und Freigabekriterien

RC1016 ist für Kalender/Aufgaben erst freigabefähig, wenn:

1. Lifecycle-Tests grün sind.
2. Runtime-Integration grün ist.
3. Der Renderer-Test beide Kartenfamilien explizit abdeckt.
4. Demo-Version semantisch auf RC1016 geprüft wird.
5. Chromium in Desktop, Tablet und Mobile Aufgaben, Sendungsübersicht und Abholkalender öffnet.
6. Mindestens eine Aufgabenkarte sichtbar und mit RC1016-Metadaten erweitert ist.
7. Der Kalender sichtbare FIX-Abholungen zeigt.
8. Keine horizontalen Layoutfehler oder Browser-/Consolefehler auftreten.
9. QR- und Lieferavis-End-to-End-Regression weiterhin grün bleibt.
10. Der finale Drei-Umgebungen-Build dieselbe RC1016-Version ausgibt.

Erst danach darf der Kalender als funktionierend und der Kalender-/Aufgabenblock als behoben bezeichnet werden.
