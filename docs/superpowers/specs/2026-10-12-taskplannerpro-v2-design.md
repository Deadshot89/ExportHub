# TaskPlannerPro V2 – Design-Spezifikation

**Datum:** 12.10.2026  
**Projekt:** ExportHUB360 / ExportHub  
**Status:** Review-Spezifikation  
**Entwicklungszweig:** `taskplannerpro/v2-design`

## 1. Ziel

TaskPlannerPro V2 ersetzt die gewachsene Aufgabenlogik nicht durch einen Big-Bang-Rewrite, sondern führt eine kanonische Task Engine ein, die bestehende Aufgaben, Wiederholungen, Kunden-/Sendungsverknüpfungen und manuelle Planungen verlustfrei übernimmt.

Der Zielzustand ist ein moderner, schneller, zuverlässiger und weitgehend automatisierter Aufgabenbereich, der reale Arbeitsabläufe abbildet: Aufgaben, Wiederholungen, Arbeitstage und Feiertage, Wochenplanung, Abhängigkeiten, Erinnerungen, Kundenbezug, Vorlagen, automatische Erledigung durch Website-Ereignisse, Historie, Archiv und responsive Bedienung.

`main` und Produktion bleiben während Entwicklung und TESTSERVICE-Verifikation unverändert. Ein Produktionswechsel ist ein separater, explizit geprüfter Release-Schritt.

## 2. Verbindliche Grundsätze

1. Bestehende Aufgaben, Wiederholungsregeln, Verknüpfungen, manuelle Verschiebungen und erledigte Historie dürfen nicht verloren gehen.
2. Vor einer produktiven Datenmigration wird ein vollständiger Snapshot erzeugt und die Migration gegen eine Kopie simuliert.
3. Migrationen brechen fail-closed ab, sobald Mengen, Identitäten oder Beziehungen unerwartet abweichen.
4. Bestehende funktionierende Bereiche werden nicht ohne fachlichen Grund entfernt.
5. Es gibt nach Abschluss genau eine fachliche Task Engine. Planner, Aufgabenansicht, Dashboard und Benachrichtigungen lesen dieselben kanonischen Daten.
6. UI-Aktualisierungen allein dürfen keine unnötigen Azure-Schreibvorgänge auslösen.
7. Drag & Drop bleibt optimistisch und lokal schnell; ein Move darf keinen unnötigen Vollrender erzwingen.
8. Keine D365-Integration wird für TaskPlannerPro vorausgesetzt.
9. Die Geschäftszeitzone ist `Europe/Berlin`; Datums-/Zeitlogik muss Sommer-/Winterzeit sicher behandeln.
10. Neue persistierte Task-Keys werden ausdrücklich dem bestehenden `tasks`-Rechtemodul im serverseitigen State-Write-Guard zugeordnet. Unbekannte Keys bleiben fail-closed.

## 3. Bestehender Zustand und Migrationsrisiko

Der aktuelle Aufgabenbereich verwendet `state.tasks` als zentrale Sammlung, besitzt aber mehrere historische Feldvarianten und Logiken, darunter `date`, `day`, `dueDate`, `plannedDate`, `targetDate`, verschiedene Serienkennungen sowie ältere Aufgaben-/Planner-Renderer.

Der aktuelle Planner besitzt bereits wertvolle Verträge, die erhalten bleiben:

- schnelle Drag-&-Drop-Zielerkennung über die tatsächlich getroffene Tagesfläche,
- lokaler DOM-Hotpath ohne Vollrender nach einem Move,
- Deduplizierung unter Berücksichtigung von Sendungsreferenz, Kunde und Serienidentität,
- NRW-Feiertagsberechnung,
- bestehende Aufgabenrechte und Azure-State-Synchronisierung.

Problematisch ist, dass Zeitfelder, Wiederholungsquelle, konkrete Vorkommen, Feiertagsverschiebung und Erledigt-Status heute nicht sauber getrennt sind. TaskPlannerPro V2 trennt diese Verantwortungen.

## 4. Architektur

TaskPlannerPro V2 besteht aus acht klar getrennten Bausteinen:

### 4.1 Task Model Adapter

Der Adapter liest Legacy-Aufgaben und liefert ein einheitliches V2-Modell. Während der Übergangsphase werden notwendige Legacy-Aliasfelder weiter gepflegt, damit bestehende Funktionen nicht plötzlich brechen.

Er ist der einzige Ort, der historische Feldvarianten kennen darf. Neue Fachlogik verwendet ausschließlich normalisierte V2-Felder.

### 4.2 Recurrence Engine

Die Wiederholungs-Engine verwaltet Serien und materialisiert konkrete Aufgabeninstanzen deterministisch für den benötigten Planungshorizont.

Standardhorizont: **aktuelle Woche + nächste Woche**.

### 4.3 Workday Calendar

Eine gemeinsame Kalender-Engine entscheidet, ob ein Datum ein gültiger Arbeitstag ist. Sie kennt Montag bis Freitag, gesetzliche NRW-Feiertage sowie administrative Firmenfeiertage, Betriebsruhe und Sonder-Schließtage.

### 4.4 Planner Engine

Die Planner Engine erstellt zunächst einen nicht verbindlichen Wochenplan-Entwurf. Sie berücksichtigt Priorität, Fälligkeit, Abhängigkeiten, Arbeitstage, feste Termine und geschützte manuelle Planungen. Erst `Wochenplan übernehmen` macht den Entwurf verbindlich.

### 4.5 Workflow Event Router

Website-Aktionen erzeugen strukturierte Events wie `shipment.registered`. Der Router ordnet diese Events anhand stabiler Identitäten passenden Aufgaben zu und kann eindeutig passende Aufgaben erledigen.

### 4.6 Reminder Engine

Erinnerungen werden pro Aufgabe und pro Benutzer ausgewertet. Website-Benachrichtigung und optionale E-Mail-Erinnerung sind getrennte Kanäle.

### 4.7 History & Archive

Jede relevante fachliche Änderung erzeugt einen Historieneintrag. Erledigte Aufgaben bleiben sieben Tage in der normalen Historie sichtbar und werden anschließend archiviert, nicht gelöscht.

### 4.8 UI Projection Layer

Aufgabenliste, Planner, Dashboard, Kundenansicht und Benachrichtigungscenter erhalten jeweils eine gefilterte Projektion derselben Engine. Kein Bereich führt eine eigene Wiederholungs- oder Statuslogik.

## 5. Persistenzmodell

Die vorhandene Aufgabenpersistenz bleibt migrationsfreundlich erhalten. Die V2-Struktur wird innerhalb des bestehenden Task-Moduls eingeführt:

- `state.tasks`: konkrete `TaskInstance[]`; bleibt die aktive Instanzquelle.
- `state.taskSeries`: `TaskSeries[]` für Wiederholungsregeln.
- `state.taskTemplates`: `TaskTemplate[]` für allgemeine, Prozess- und Kundenvorlagen.
- `state.taskCalendar`: administrative Firmenfeiertage, Betriebsruhe und Sonder-Schließtage.
- `state.taskSettings`: benutzerbezogene Planner-/Ansichts-/Erinnerungseinstellungen.
- `state.taskArchive`: archivierte Aufgaben in kompaktem Format; die normale Planner-Projektion lädt/verarbeitet diese Sammlung nicht.

Alle neuen Top-Level-Keys gehören serverseitig zum Rechtebereich `tasks`. Nicht berechtigte Benutzer dürfen diese Daten nicht verändern.

### 5.1 TaskInstance

Eine konkrete Aufgabe unterstützt mindestens:

- `id`
- `schemaVersion`
- `seriesId`
- `occurrenceKey`
- `templateId`
- `title`
- `description`
- `customerId`
- `customerName`
- `areaId` / `area`
- `processId`
- `workflowId`
- `shipmentId`
- `shipmentRef`
- `orderId`
- `taskType`
- `ownerId` / `owner`
- `contact`
- `priority`
- `status`
- `startAt`
- `plannedAt`
- `dueAt`
- `latestCompletionAt`
- `snoozeUntil`
- `estimatedMinutes`
- `holidayPolicy`
- `manualOverride`
- `dependencies[]`
- `checklist[]`
- `comments[]`
- `reminders[]`
- `history[]`
- `createdAt`
- `completedAt`
- `completionMode`
- `archivedAt`

Legacy-Aliasfelder werden während der Kompatibilitätsphase weitergeführt, aber nicht mehr als primäre Fachquelle verwendet.

### 5.2 Prioritäten

Kanonische Werte:

- `P0` – Kritisch
- `P1` – Hoch
- `P2` – Normal
- `P3` – Niedrig

Zusätzliche Kennzeichnungen werden berechnet und überschreiben die gespeicherte Priorität nicht:

- Dringend
- Heute
- Blockiert
- Überfällig

Überfällig erhält die höchste effektive Sortierpriorität, ohne `priority` zu verändern.

### 5.3 Status

Kanonische Status:

- `planned`
- `open`
- `in_progress`
- `waiting`
- `waiting_feedback`
- `blocked`
- `done`
- `cancelled`

Regeln:

- Zukunft vor `startAt`: `planned`, sofern kein expliziter manueller Sonderstatus gesetzt ist.
- Start erreicht: `open`.
- Bearbeitung begonnen: `in_progress`.
- `waiting` und `waiting_feedback` dürfen `snoozeUntil` verwenden.
- Überfälligkeit ist ein berechnetes Merkmal und kein eigener Status.
- Gespeicherte produktive Aufgaben werden nicht physisch gelöscht. Fachliches Entfernen setzt `cancelled`; nur noch nicht gespeicherte Entwürfe dürfen verworfen werden.

## 6. Zeitmodell

Vier Zeitpunkte werden fachlich getrennt:

1. `startAt` – ab wann die Aufgabe relevant/offen wird.
2. `plannedAt` – wann sie bearbeitet werden soll.
3. `dueAt` – bearbeiten bis / Fälligkeit.
4. `latestCompletionAt` – spätestens abgeschlossen bis.

Fehlt bei einer Fälligkeit die Uhrzeit, wird **16:15 Uhr Europe/Berlin** gesetzt.

Ein überfälliger Task behält sein ursprüngliches `dueAt`. Er wird niemals automatisch auf heute umdatiert.

## 7. Wiederholungsmodell

`TaskSeries` ist die einzige Wiederholungsquelle. Jede materialisierte Instanz besitzt einen deterministischen `occurrenceKey = seriesId + geplanter Serienzeitpunkt`.

Damit gilt:

- dieselbe Serieninstanz kann nicht versehentlich doppelt erzeugt werden,
- eine neue Wiederholung entsteht auch dann, wenn das vorige Vorkommen offen oder überfällig ist,
- offene Vorkommen dürfen sich überschneiden,
- ein manuell verschobenes Vorkommen ändert die Serie nicht,
- abgeschlossene Vorkommen bleiben unverändert,
- Serienänderungen gelten standardmäßig nur für noch nicht abgeschlossene zukünftige Vorkommen.

Unterstützte Regeln:

- täglich,
- bestimmte Wochentage,
- wöchentlich,
- alle X Wochen,
- monatlich,
- jährlich,
- erster Arbeitstag des Monats,
- letzter Arbeitstag des Monats,
- X Arbeitstage vor Monatsende,
- X Arbeitstage nach Monatsbeginn,
- n-ter Wochentag eines Monats, insbesondere jeder zweite Dienstag,
- mehrere Wochentage gleichzeitig,
- validierte benutzerdefinierte Regeln.

Eine Wiederholungsregel darf erst gespeichert werden, wenn alle für ihren Typ notwendigen Parameter vollständig und widerspruchsfrei sind.

## 8. Arbeitstage und Feiertage

Reguläre Arbeitstage sind Montag bis Freitag.

Nicht verfügbare Tage:

- Samstag,
- Sonntag,
- gesetzliche NRW-Feiertage,
- Firmenfeiertage,
- Betriebsruhe,
- Sonder-Schließtage.

NRW-Feiertage werden algorithmisch für jedes benötigte Kalenderjahr berechnet; es gibt keine fest codierte Endjahresgrenze.

Jede Aufgabe oder Vorlage besitzt eine eigene `holidayPolicy`:

- `previous_workday`
- `next_workday`
- `manual_decision`
- `process_rule`

`manual_decision` darf niemals automatisch verschoben werden. Der Wochenplan zeigt einen Konflikt und verlangt eine Benutzerentscheidung.

Bei mehreren aufeinanderfolgenden freien Tagen sucht die Workday Engine den nächsten beziehungsweise vorherigen gültigen Arbeitstag gemäß Policy.

Automatische Feiertagsverschiebungen sind zunächst Planvorschläge und werden erst mit der Wochenplan-Übernahme verbindlich.

## 9. Manuelle Planung und Drag & Drop

Ein Drag & Drop verändert standardmäßig nur die konkrete Instanz.

Die Instanz erhält:

- `manualOverride = true`
- neues `plannedAt`
- einen Historieneintrag `manual_move`

Manuelle Änderungen haben Vorrang vor späteren automatischen Planungsvorschlägen. Bei Neuplanung darf eine geschützte manuelle Änderung nur nach expliziter Warnung/Bestätigung überschrieben werden.

Der bestehende optimistische Planner-Hotpath bleibt erhalten: Karte lokal verschieben, Zähler/Übersicht gezielt abgleichen, Save entprellt anstoßen; kein unnötiger kompletter Planner-Render.

## 10. Überfällige Aufgaben

Überfällig bedeutet `dueAt < jetzt` und Status nicht `done`/`cancelled`.

Darstellung:

- separat oberhalb der normalen Aufgaben,
- ganze Aufgabenkarte eindeutig markiert,
- Anzeige `N Tage überfällig`,
- hohe Lesbarkeit, keine reine Rotfärbung des Titels.

Die nächste Serieninstanz darf unabhängig davon bereits existieren.

## 11. Erledigen, Checkliste und Archiv

Der Button `Erledigt` ist in Detailansicht und geeigneten kompakten Kontexten klar sichtbar.

Beim Abschluss kann optional ein Kommentar gespeichert werden. Mitarbeiteranzeige, Nachweisbild und Pflichtanhang sind für den normalen Abschluss nicht erforderlich.

Checklisten:

- beliebig viele Punkte,
- Reihenfolge bleibt erhalten,
- optional einzeln abhaken,
- Fortschritt nur informativ,
- Checkliste blockiert den Gesamtabschluss nicht,
- bei jeder neuen Serieninstanz startet der Checklistenfortschritt bei 0.

Erledigte Aufgaben bleiben sieben Kalendertage in der normalen Historie sichtbar. Danach werden sie nach `state.taskArchive` verschoben. Archiveinträge bleiben für Statistik, Kunde, Prozess, Serie und Audit auswertbar und werden im Planner nicht mitgerendert.

## 12. Abhängigkeiten

Eine Aufgabe kann von einer oder mehreren Aufgabeninstanzen beziehungsweise logisch von einer Serien-/Prozessstufe abhängen.

Ist eine Voraussetzung offen:

- abhängige Aufgabe wird gekennzeichnet,
- Planner zeigt den Grund,
- ein neuer Planungsvorschlag darf berechnet werden,
- bereits manuell fixierte Planung wird nicht still überschrieben.

Zyklische Abhängigkeiten werden beim Speichern abgelehnt.

## 13. Kunden, Bereiche, Prozesse und Workflows

`customerId` ist die primäre Kundenidentität. `customerName` ist Anzeige/Fallback, niemals alleinige Automatisierungsidentität.

Filter kombinieren Kunde, Bereich, Prozess, Priorität, Status, Besitzer und Zeitraum.

Nicht jeder Kunde erhält automatisch Standardaufgaben. Nur explizit konfigurierte Kundenvorlagen erzeugen Aufgaben.

Kundenansicht kann aktive Aufgaben, kommende Aufgaben und paginierte Historie desselben Kunden anzeigen.

## 14. Vorlagen

`TaskTemplate` kann enthalten:

- Titel,
- Kunde,
- Bereich/Prozess,
- Beschreibung,
- Priorität,
- Wiederholungsregel,
- Feiertagsregel,
- Bearbeitungsdauer,
- Ansprechpartner,
- Checkliste,
- Erinnerungen,
- Abhängigkeiten,
- optionale Workflow-Event-Bindungen.

Vorlagen können allgemein, kundenspezifisch oder prozessbezogen sein.

`Bestehende Aufgabe als Vorlage speichern` erzeugt eine neue Vorlage, ohne Status, Abschlussdaten, Checklistenfortschritt oder instanzspezifische Historie zu übernehmen.

## 15. Erinnerungen

Standard-Erinnerungszeiten:

- 09:00 Uhr
- 13:00 Uhr
- 15:30 Uhr

Pro Aufgabe wird festgelegt, welche Erinnerungen aktiv sind. Kanäle:

- Website,
- optional E-Mail.

Benutzereinstellungen dürfen Standardkanäle/Anzeige beeinflussen, aber eine ausdrücklich an der Aufgabe deaktivierte E-Mail nicht wieder aktivieren.

Erinnerungen müssen idempotent sein: dieselbe Aufgabe/Erinnerungsinstanz darf nicht durch Render-, Fokus- oder Sync-Ereignisse mehrfach ausgelöst werden.

## 16. Planner und Wochenplan

Der Planner besitzt zwei Hauptansichten:

### Arbeitswoche

Montag bis Freitag mit aktueller und nächster Woche. Aufgaben der nächsten Woche erhalten eine klar erkennbare, aber zurückhaltende andere visuelle Ebene.

### Monat

Vollständige Monatsübersicht mit Feiertagen, Betriebsruhe, Aufgabenanzahl und Statusindikatoren. Detaildaten werden erst beim Öffnen eines Tages/einer Aufgabe geladen beziehungsweise gerendert.

### Wochenplan-Entwurf

Automatische Planung berücksichtigt in dieser Reihenfolge:

1. Überfälligkeit,
2. gespeicherte Priorität,
3. `latestCompletionAt` / `dueAt`,
4. Abhängigkeiten,
5. feste/manuelle Planung,
6. Feiertage und Wochenenden,
7. geplante Bearbeitungsdauer und verfügbare gültige Tage.

Es gibt keine harte automatische Stundenobergrenze pro Tag. `Diese Woche ist überlastet` wird angezeigt, wenn Aufgaben unter Beachtung von Fälligkeiten, fixierten Tagen, Abhängigkeiten und gültigen Arbeitstagen nicht konfliktfrei innerhalb der Woche platzierbar sind.

Vor `Wochenplan übernehmen` zeigt eine Zusammenfassung mindestens:

- Anzahl geplanter Aufgaben,
- automatisch verschobene Aufgaben,
- Feiertagskonflikte,
- offene Abhängigkeiten,
- manuelle Änderungen.

Erst nach Bestätigung wird der Plan verbindlich.

Bei `Neu berechnen` bleiben manuelle Overrides standardmäßig geschützt.

## 17. Aufgabenansicht und UI

Jede Aufgabe kann kompakt oder detailliert dargestellt werden. Die Benutzerpräferenz wird pro Benutzer gespeichert.

Detailansicht zeigt:

- Titel,
- Kunde,
- Bereich/Prozess,
- Status,
- Priorität,
- Fälligkeit,
- geplantes Datum,
- ursprüngliches Seriendatum,
- Wiederholungsregel,
- Beschreibung,
- Checkliste,
- Ansprechpartner,
- Kommentare,
- Historie,
- Abhängigkeiten,
- nächste Wiederholung,
- Vorschau kommender Wiederholungen.

Desktop öffnet Aufgaben in einem rechten Sidepanel, während der Planner sichtbar bleibt.

Tablet und Mobile verwenden dieselben Daten, aber eine einspaltige beziehungsweise Agenda-orientierte Darstellung mit großen Touch-Zielen.

Die Tagesübersicht zeigt kompakt zum Beispiel `Heute: 9 Aufgaben · 2 kritisch · 1 überfällig`.

## 18. Dashboard

Der Aufgabenbereich des Dashboards wird neu geordnet statt mit weiteren Kacheln überladen.

Kennzahlen:

- Heute,
- Diese Woche,
- Überfällig,
- Kritisch,
- Erledigt,
- Wartet,
- Wochenfortschritt,
- Auslastung dieser Woche.

Wochenfortschritt zeigt erledigt/gesamt und Prozentwert mit Fortschrittsbalken.

Dashboard und Planner verwenden dieselben Engine-Projektionen; doppelte fachliche Berechnungen sind nicht zulässig.

## 19. Workflow-Event-System und automatische Erledigung

Automatische Erledigung wird als wiederverwendbares Event-System gebaut, nicht als Sondercode für einen einzelnen Prozess.

Unterstützte Eventtypen beginnen mit:

- `shipment.created`
- `shipment.picked`
- `shipment.registered`
- `shipment.dispatched`
- `document.created`
- `document.approved`
- `customer.process.completed`

Ein Event enthält mindestens:

- `eventId`
- `type`
- `occurredAt`
- `customerId`
- optional `shipmentId`
- optional `shipmentRef`
- optional `orderId`
- optional `processId`
- optional `workflowId`
- optional `taskType`

### Matching-Regel

Automatische Erledigung verlangt eine eindeutige strukturierte Zuordnung. Reiner Kundenname-/Titel-Textvergleich reicht niemals aus.

Ein Kandidat muss die für seine Workflow-Bindung vorgesehenen Identitäten erfüllen. Werden null Kandidaten gefunden, passiert nichts. Werden mehrere nicht eindeutig auflösbare Kandidaten gefunden, wird nichts erledigt und ein Hinweis `Zuordnung prüfen` erzeugt.

Bei eindeutiger Übereinstimmung:

1. Aufgabe auf `done`,
2. `completionMode = automatic`,
3. Event-ID in Historie,
4. idempotente Verarbeitung markieren,
5. Aufgabenansicht, Planner, Dashboard, Überfällig, Wochenfortschritt und Kundenansicht ereignisbasiert aktualisieren.

Ein bereits verarbeitetes `eventId` darf dieselbe Aufgabe nicht erneut mutieren.

## 20. Sofortige Synchronisierung

Task Engine erzeugt nach tatsächlicher Fachänderung ein einziges kanonisches Ereignis `exporthub:tasks-updated` mit Änderungsart und betroffenen IDs.

Konsumenten aktualisieren nur ihre betroffene Projektion. Kein manueller Reload ist erforderlich.

Server-Speicherung bleibt entprellt und idempotent. UI-Render, Filterwechsel und reine Detailpanel-Navigation lösen keinen Save aus.

## 21. Historie

Historieneinträge enthalten mindestens:

- Aktion,
- Zeitpunkt,
- Quelle `manual | recurrence | planner | holiday | workflow | migration`,
- vorher/nachher nur für tatsächlich geänderte Fachwerte,
- optionale `eventId`,
- optionalen Kommentar/Grund.

Mindestens protokolliert werden:

- erstellt,
- Wiederholung geändert,
- Priorität geändert,
- Datum verschoben,
- Feiertagsplanung angepasst,
- manuell verschoben,
- Status geändert,
- erledigt,
- erneut geöffnet,
- archiviert.

Historie ist für Instanz, Serie und Kunde filterbar.

## 22. Sichere öffentliche Read-only-Aufgabenlinks

Öffentliche Links verwenden kryptografisch zufällige, nicht erratbare Tokens. Der Server speichert/prüft nur eine sichere Token-Repräsentation und unterstützt Widerruf.

Ohne Login gilt:

- ausschließlich read-only,
- keine Statusänderung,
- kein Erledigen,
- keine Kommentare,
- keine Verwaltungsfunktionen.

Die öffentliche Antwort verwendet eine explizite Whitelist. Standardmäßig sichtbar sind nur Titel, freigegebene Beschreibung, freigegebener Termin/Status und explizit öffentlich markierte Checklisteninformationen. Interne IDs, interne Kommentare, Historie, Workflow-IDs, Ansprechpartnerdaten und nicht ausdrücklich freigegebene Kundendaten werden nicht ausgegeben.

Erledigen, Bestätigen oder Ändern erfordert Anmeldung und Task-Berechtigung.

## 23. Statistikgrundlagen

Aus aktiven und archivierten Aufgaben werden mindestens auswertbar:

- pünktlich erledigt,
- verspätet erledigt,
- offen,
- überfällig,
- durchschnittliche Bearbeitungszeit,
- Aufgaben pro Kunde,
- Aufgaben pro Prozess,
- wiederkehrende Aufgaben,
- automatische vs. manuelle Erledigung.

Planner und Tagesansicht berechnen Statistiken nicht über den gesamten Archivbestand. Archiv-/Statistikansichten verwenden gefilterte, paginierte Projektionen.

## 24. Performance-Design

1. Beim Planner-Render werden nur aktive relevante Aufgaben des sichtbaren Zeitfensters indexiert.
2. Archivierte Aufgaben sind nicht Bestandteil des normalen Planner-Indexes.
3. Wiederholungsberechnung materialisiert nur den notwendigen Horizont plus kleine Vorschau, nicht die unbegrenzte Zukunft.
4. Feiertage werden jahresweise gecacht und bei Kalenderänderungen gezielt invalidiert.
5. Filter werden auf vorbereiteten Indizes nach Datum, Kunde, Status, Priorität, Serie und Prozess ausgeführt.
6. Monatsansicht rendert Tageszusammenfassungen; Detailkarten werden lazy erzeugt.
7. Drag & Drop patcht lokal statt Fullrender.
8. Speichern wird nur durch echte persistente Änderungen ausgelöst.
9. Mehrfach eintreffende Sync-/Render-Ereignisse werden dedupliziert/debounced.
10. Performance-Regressions prüfen Renderzahl, Save-Anzahl und Duplikat-Events, nicht nur reine Laufzeit.

## 25. Migration

Die Migration erfolgt in kontrollierten Schritten:

1. aktuellen `main`-Stand und Team-State inventarisieren,
2. Snapshot/Backup des Aufgabenbestands erstellen,
3. Legacy-Feldvarianten und Serienkennungen zählen,
4. Migration auf Kopie simulieren,
5. V2-IDs/Serien/OccurrenceKeys erzeugen,
6. Beziehungen zu Kunde, Sendung, Auftrag und Prozess validieren,
7. Vorher-/Nachher-Mengen und Identitäten vergleichen,
8. Kompatibilitätsaliasfelder erzeugen,
9. TESTSERVICE mit Dual-Read-/V2-Write-Modus testen,
10. erst nach grüner Regression V2 als kanonische Leselogik aktivieren.

Abbruchkriterien:

- Aufgabe verschwindet,
- zwei Legacy-Aufgaben kollabieren unerwartet zu einer,
- neue Dublette entsteht,
- Serienzuordnung ist mehrdeutig,
- Kunden-/Sendungsverknüpfung geht verloren,
- erledigte Historie wird verändert,
- manuelle Planung wird ohne Grund überschrieben.

Bei einem Abbruch bleibt der Ausgangsstand unverändert.

## 26. Fehlerbehandlung

TaskPlannerPro arbeitet bei Mehrdeutigkeit fail-closed:

- unvollständige Wiederholungsregel → Speichern blockieren,
- zyklische Abhängigkeit → Speichern blockieren,
- mehrdeutige Workflow-Zuordnung → keine automatische Erledigung,
- ungültiger öffentlicher Token → keine Daten ausgeben,
- Migrationsdifferenz → Migration abbrechen,
- Save-Konflikt → aktuellen Teamstand neu lesen, fachlich erneut mergen und nur autorisierte Task-Bereiche schreiben,
- Feiertagsregel `manual_decision` → niemals automatisch verbindlich verschieben.

Fehler sollen verständlich im UI erscheinen; technische Details bleiben in Diagnose/Audit.

## 27. Teststrategie

TDD ist für jede Implementierungsphase verbindlich: RED → minimaler Fix → GREEN → Regression.

### Funktionsverträge

- Aufgabe erstellen/ändern/stornieren/erledigen,
- Statusautomatik,
- Überfällig ohne Umterminierung,
- Checkliste blockiert Abschluss nicht,
- Vorlagen,
- Abhängigkeiten,
- Erinnerungen,
- Archiv nach sieben Tagen.

### Wiederholungsverträge

Explizit testen:

- täglich,
- Montag + Donnerstag,
- jeden zweiten Dienstag,
- erster Arbeitstag,
- letzter Arbeitstag,
- drei Arbeitstage vor Monatsende,
- alle zwei Wochen mittwochs,
- Monatswechsel,
- Jahreswechsel,
- offene Vorinstanz + neue Instanz,
- Serienänderung nur zukünftig,
- Verschiebung nur eines Vorkommens.

### Feiertage

- NRW-Feiertage verschiedener Jahre,
- Wochenende,
- Firmenfeiertag,
- Betriebsruhe,
- mehrere freie Tage hintereinander,
- previous/next/manual/process policy.

### Planner

- aktuelle Woche,
- nächste Woche,
- Monatsansicht,
- Wochenplan-Entwurf,
- Übernahme,
- Neuplanung,
- Schutz manueller Moves,
- Überlastwarnung,
- Drag-&-Drop ohne Vollrender.

### Automatisierung

Bei eindeutigem `shipment.registered` werden nur Aufgaben derselben strukturierten Prozessinstanz erledigt. Aufgabe eines anderen Kunden, anderer Sendung, anderen Datums oder anderen Workflows bleibt unverändert. Mehrdeutigkeit erzeugt `Zuordnung prüfen` und keine Erledigung.

### UI

Desktop, Tablet, Smartphone, kompakt/detailliert, Sidepanel, lange Titel, große Checklisten, Tastaturfokus, ausreichend große Touch-Ziele und keine horizontalen Überläufe.

### Regression

Bestehende Aufgaben-/Planner-, Rechte-, State-Merge-, Navigation-, Dashboard- und Performanceverträge bleiben grün. Gesamttest `npm test`, relevante Security-/Accessibility-Tests und TESTSERVICE-Live-Smokes sind vor Integration Pflicht.

## 28. Implementierungszerlegung

Die Architektur bleibt ein Gesamtsystem, wird aber in überprüfbare Lieferpakete zerlegt:

1. **V2-Kern + Migrationsadapter:** Datenmodell, Normalisierung, Backup-/Migrationsprüfung, Rechtezuordnung.
2. **Recurrence + Workday Calendar:** Serien, Materialisierung, NRW-/Firmenkalender, Feiertagspolicies.
3. **Planner V2:** Arbeitswoche, Monat, Wochenplan-Entwurf, Übernahme, Neuplanung, Drag & Drop.
4. **Task Detail + Templates + Dependencies + Reminders:** Detailpanel, Checkliste, Historie, Vorlagen, Wiedervorlage.
5. **Workflow Events + automatische Erledigung:** strukturiertes Matching, Idempotenz, `Zuordnung prüfen`.
6. **Dashboard + Kundenansicht + Archiv/Statistik + Mobile:** gemeinsame Projektionen, Wochenfortschritt, Archiv, Responsive.
7. **Release-Hardening:** Performance, vollständige Regression, TESTSERVICE, Datenintegritätsvergleich, Release-Center.

Jedes Paket muss einzeln testbar sein und darf `main`/Produktion nicht vorzeitig verändern.

## 29. Abnahmekriterien

TaskPlannerPro V2 ist erst abnahmebereit, wenn:

- bestehende Aufgaben nach der Migration vollständig erhalten sind,
- keine unerklärten Dubletten/Verluste bestehen,
- aktuelle + nächste Woche korrekt materialisiert werden,
- alle geforderten Wiederholungsmuster funktionieren,
- NRW- und Firmenkalender korrekt berücksichtigt werden,
- manuelle Feiertagsentscheidungen nicht automatisch überschrieben werden,
- überfällige Aufgaben ihr ursprüngliches Fälligkeitsdatum behalten,
- Wochenplan-Entwurf und Übernahme getrennt funktionieren,
- manuelle Planung bei Neuplanung geschützt bleibt,
- Workflow-Events ausschließlich eindeutig passende Aufgaben erledigen,
- öffentliche Task-Links strikt read-only/minimal sind,
- Dashboard/Planner/Aufgaben/Kunde ohne Reload synchron bleiben,
- Desktop/Tablet/Mobile stabil sind,
- Planner keine historischen Vollbestände rendert,
- vorhandene Regressionen und neue TaskPlannerPro-Verträge grün sind,
- TESTSERVICE live geprüft wurde,
- Produktion erst danach separat freigegeben wird.

## 30. Nicht-Ziele

- keine direkte D365-Integration,
- keine Komplett-Neuschreibung der gesamten ExportHUB-Anwendung,
- keine Änderung produktiver Sendungs-, QR-, POD-, Avis- oder Dokumentprozesse, sofern sie nicht für ein eindeutig definiertes Task-Event angebunden werden,
- keine automatische Kapazitätsplanung anhand persönlicher Arbeits-/Pausenzeiten,
- keine physische Löschung historischer erledigter Aufgaben als Standardprozess.
