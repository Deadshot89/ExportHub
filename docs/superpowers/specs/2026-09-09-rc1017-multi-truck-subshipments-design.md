# RC1017 – Automatische Mehr-LKW-Teilsendungen

## Ziel

RC1017 erweitert den bestehenden ExportHUB-Sendungsprozess um automatisch erzeugte LKW-Teilsendungen, wenn die physische Ladung nicht vollständig in das ausgewählte Fahrzeug passt. Die bestehende Sendung bleibt fachlich die Hauptsendung. Unterhalb dieser Hauptsendung entstehen genau so viele operative LKW-Teilsendungen wie für die reale Verladung benötigt werden.

Der Ein-LKW-Ablauf bleibt unverändert. Die Mehr-LKW-Ebene wird nur aktiviert, wenn die berechnete Ladekapazität eines Fahrzeugs überschritten wird.

## Leitprinzipien

1. Eine Kunden-/Export-Sendung bleibt genau eine Hauptsendung mit derselben Referenz, demselben Kunden, Empfänger, Dokumentenbestand, ABD-Kontext und Mailkontext.
2. Operative LKW-Abwicklungen werden als untergeordnete Teilsendungen geführt.
3. Jede Teilsendung besitzt eine eindeutige Identität und wird sichtbar als `Sendung 1 von 2`, `Sendung 2 von 2` usw. bezeichnet.
4. Jede Teilsendung besitzt einen eigenen QR-Code, eine eigene Ladeliste, einen eigenen Abholstatus und einen eigenen POD-/Abholnachweis.
5. Physische Colli dürfen nicht verloren gehen, doppelt zugeordnet werden oder ohne nachvollziehbare Mengenaufteilung zwischen Teilsendungen wechseln.
6. Ab der ersten abgeschlossenen oder begonnenen Abholung wird die bestehende Verteilung gesperrt und darf nicht mehr automatisch neu berechnet werden.
7. Bestehende Sicherheitsregeln für QR, PIN, Avis, POD, Firmenisolierung und Statussperren bleiben erhalten.

## Bestehende Grundlage

RC1017 baut auf dem aktuellen `main`-Stand nach RC1016 auf. Der vorhandene Sendungsbereich enthält bereits Kunde/Empfänger, Sendungsdaten, Colli/LDM, Dokumente/ABD, Stauplan, Mail und Ausgabe. Der Stauplan kennt reale Fahrzeugtypen und physische Colli mit Anzahl, Abmessungen und LDM. Die bestehende QR-Abholung ist token-/PIN-gesichert und die öffentliche Kunden-Avis-Logik ist davon getrennt.

RC1017 ersetzt diese Systeme nicht. Es ergänzt eine klar abgegrenzte Teilsendungs-Schicht zwischen Hauptsendung und den operativen Verlade-/Abholartefakten.

## Fachliches Datenmodell

### Hauptsendung

Die Hauptsendung bleibt die kanonische Quelle für:

- Kunden- und Empfängerdaten
- ExportHUB-Referenz
- Lieferschein-/Dokumentenbezug
- ABD-Status und ABD-Dateien
- Mail-/Avis-Kontext
- vollständige Colli-Gesamtmenge
- Gesamtgewicht und Gesamt-LDM
- gewählten Fahrzeugtyp für die Verladeplanung
- aggregierten Gesamtstatus

### Teilsendung

Eine Teilsendung enthält mindestens:

- stabile eigene `subShipmentId`
- laufende Nummer `1..n`
- Gesamtanzahl der Teilsendungen `n`
- sichtbare Bezeichnung `Sendung X von Y`
- Bezug zur Hauptsendung über deren stabile Identität
- zugeordnete Colli-Zeilen bzw. Teilmengen je Colli-Zeile
- eigenes Gesamtgewicht
- eigene LDM-Summe
- eigenen Stauplan / eigene Ladeanordnung
- eigenen QR-/Pickup-Token
- eigenen QR-Registrierungsstatus
- eigenen Abholstatus
- eigene tatsächliche Abholdaten/-zeiten
- eigenen POD-/Signaturnachweis
- eigenes Sperrkennzeichen nach begonnener/erfolgter Abholung

Teilsendungen dürfen keine zweite Kundenreferenz, keine zweite ABD-Logik und keinen unabhängigen Kundenstamm erzeugen.

## Mengen- und Colli-Zuordnung

Die Hauptsendung behält immer die vollständige Sollmenge. Die Teilsendungen bilden daraus eine verladefähige Partition.

Für jede physische Colli-Zeile gilt:

- Summe aller auf Teilsendungen verteilten Mengen = Menge der Hauptsendung.
- Keine Teilmenge darf negativ sein.
- Keine physische Einheit darf zwei Teilsendungen gleichzeitig zugeordnet sein.
- Bei Anzahl `1` darf die Einheit nicht künstlich geteilt werden.
- Bei Anzahl > `1` darf die Menge zwischen Teilsendungen aufgeteilt werden, jedoch nur ganzzahlig.
- Gewicht und LDM einer gesplitteten Colli-Zeile werden proportional zur Stückzahl auf die Teilsendungen verteilt, sofern die Zeile keine explizit abweichenden Einzelwerte besitzt.
- Abmessungen und Verpackungstyp bleiben identisch zur Ursprungszeile.

Damit bleibt jederzeit nachvollziehbar, welche realen Colli auf welchem LKW liegen.

## Kapazitätsentscheidung

Die Mehr-LKW-Logik verwendet denselben Fahrzeugtyp und dieselben realen Geometriedaten wie der bestehende Stauplan. Ein zweiter LKW wird nicht allein aufgrund eines frei geratenen Schwellenwerts erzeugt, sondern wenn die vorhandene Ladeplan-/Kapazitätslogik die vollständige physische Menge nicht in einem Fahrzeug unterbringen kann.

Falls die vorhandene Stauplanlogik eine eindeutige geometrische Platzierung liefert, ist diese maßgeblich. Falls für einzelne Positionen keine vollständigen Maße verfügbar sind, darf die bereits vorhandene LDM-basierte Ersatzlogik verwendet werden. RC1017 führt keine zweite konkurrierende Kapazitätsberechnung ein.

## Automatische Aufteilung

Wenn alle Colli in ein Fahrzeug passen:

- keine Teilsendungs-UI
- kein zusätzlicher QR-Code
- keine veränderte Ladeliste
- bestehender Ein-LKW-Prozess unverändert

Wenn die Ladung mehr als ein Fahrzeug benötigt:

1. ExportHUB erzeugt automatisch `n` Teilsendungen.
2. Die vorhandene Ladeplanlogik verteilt reale Colli bzw. ganzzahlige Teilmengen auf die Fahrzeuge.
3. Jede Teilsendung erhält eine stabile eigene Identität.
4. Die UI zeigt deutlich `n LKW erforderlich`.
5. Darunter werden die operativen Einheiten als `Sendung 1 von n`, `Sendung 2 von n` usw. dargestellt.
6. Jede Einheit zeigt mindestens Colli-Anzahl, Gewicht, LDM, QR-Status, Abholstatus und Zugriff auf ihre eigene Ladeliste.

Die Reihenfolge ist deterministisch: Bei unveränderten Sendungsdaten und unverändertem Fahrzeugtyp muss dieselbe Verteilung erneut entstehen.

## Neuberechnung und Sperrlogik

Eine automatische Neuberechnung ist erlaubt, solange keine Teilsendung operativ begonnen wurde.

Als operative Sperre gilt insbesondere:

- QR-Abholung wurde für eine Teilsendung begonnen und persistiert,
- eine Teilabholung wurde gespeichert,
- eine Teilsendung wurde als abgeholt markiert,
- ein POD-/Signaturnachweis wurde gespeichert.

Vor dieser Sperre dürfen Änderungen an Colli, Anzahl, Gewicht, Abmessungen, LDM oder Fahrzeugtyp die Teilsendungen vollständig neu berechnen.

Nach dieser Sperre gilt:

- bestehende Teilsendungszuordnung bleibt unverändert,
- keine automatische Verschiebung bereits zugeordneter Colli,
- keine automatische Reduzierung oder Erhöhung der Anzahl der Teilsendungen,
- fachlich widersprüchliche Änderungen an den relevanten Colli-/Fahrzeugdaten werden blockiert und mit verständlicher Meldung angezeigt.

Damit können bereits ausgegebene QR-Codes, Ladelisten und Abholnachweise nicht nachträglich entwertet werden.

## QR-Abholung

Jede Teilsendung erhält einen eigenen Pickup-/QR-Kontext. Der bestehende Sicherheitsvertrag bleibt erhalten.

Anforderungen:

- eigener serverseitig registrierter Token je Teilsendung
- keine Wiederverwendung desselben Tokens für mehrere LKW
- PIN-/Sperrlogik bleibt identisch zur bestehenden QR-Abholung
- öffentlicher QR-Aufruf darf nur die Colli dieser Teilsendung anzeigen
- Teilabholung innerhalb einer Teilsendung bleibt möglich, sofern der bestehende Pickup-Ablauf dies zulässt
- Abschluss von `Sendung 1 von 2` darf `Sendung 2 von 2` nicht automatisch als abgeholt markieren
- nach vollständiger Abholung einer Teilsendung bleibt deren Seite gemäß bestehender Read-only-Regel lesbar

## Ladelisten und Druck

Jede Teilsendung besitzt eine eigene Ladeliste. Die Ladeliste enthält nur die auf diesen LKW zugeordneten Colli und Mengen.

Pflichtangaben:

- Hauptreferenz der Sendung
- Kennzeichnung `Sendung X von Y`
- eigener QR-Code dieser Teilsendung
- Colli/Mengen dieses LKW
- Gewicht und LDM dieses LKW
- zugehöriger Stauplan dieses LKW
- bestehende relevante Versand-/Empfängerdaten

Die Gesamtausgabe der Hauptsendung kann die Ladelisten der Teilsendungen nacheinander ausgeben. Eine gemeinsame Ladeliste mit vermischten QR-Codes ist nicht zulässig.

## POD und Abholstatus

Der Status wird zweistufig geführt.

### Teilsendungsstatus

Jede Teilsendung besitzt ihren eigenen operativen Verlauf, mindestens:

- bereit / offen
- Abholung begonnen bzw. teilweise abgeholt, sofern im bestehenden Modell vorhanden
- abgeholt
- POD vorhanden
- abgeschlossen

### Hauptsendungsstatus

Die Hauptsendung aggregiert die Teilsendungen:

- Solange mindestens eine Teilsendung offen ist, darf die Hauptsendung nicht als vollständig abgeholt gelten.
- `Abgeholt` auf Hauptsendungsebene wird erst erreicht, wenn alle Teilsendungen vollständig abgeholt sind.
- `POD vorhanden` bzw. `Abgeschlossen` auf Hauptsendungsebene wird nur erreicht, wenn die bestehenden Pflichtregeln für alle erforderlichen Teilsendungen erfüllt sind.
- Bereits abgeschlossene Teilsendungen bleiben einzeln nachvollziehbar.

## Kunden-Avis

RC1017 verändert den Kunden-Avis-Grundablauf nicht. Der Kunde bestätigt weiterhin die Abholung für die Hauptsendung.

Die operative Mehr-LKW-Aufteilung bleibt intern und für den Verlader sichtbar. Falls im Avis eine Zusammenfassung gezeigt wird, darf sie höchstens neutral auf `mehrere Fahrzeuge/Teilsendungen` hinweisen. Separate öffentliche Pickup-QR-Codes werden nicht über den Kunden-Avis zusammengeführt oder offengelegt.

## ABD und Dokumente

ABD, Lieferscheine und andere sendungsbezogene Dokumente bleiben grundsätzlich an der Hauptsendung verankert.

Eine Teilsendung erhält keine künstliche zweite ABD-Anforderung. In den jeweiligen Ladelisten und operativen Ansichten darf auf die gemeinsamen Dokumente verwiesen werden, ohne sie fachlich zu duplizieren.

POD-/Signaturnachweise sind dagegen teilsendungsbezogen und müssen getrennt gespeichert werden.

## Benutzeroberfläche

### Sendung erstellen / bearbeiten

Bei Ein-LKW-Sendungen bleibt die Oberfläche unverändert.

Bei Mehr-LKW-Sendungen erscheint im Stauplan-/Ausgabebereich eine kompakte Mehr-LKW-Zusammenfassung:

- Hinweis `2 LKW erforderlich` bzw. entsprechende Anzahl
- Karten/Zeilen `Sendung 1 von 2`, `Sendung 2 von 2`, ...
- je Karte: Colli, Gewicht, LDM, QR-Status, Abholstatus
- Aktionen: Stauplan ansehen, Ladeliste öffnen/drucken, QR anzeigen/erzeugen

Die Teilsendungen sind operative Untereinheiten und werden nicht als neue unabhängige Sendungen in der normalen Sendungsübersicht vervielfacht.

### Sendungsübersicht

Die Hauptsendung erscheint weiterhin genau einmal. Bei Mehr-LKW-Sendungen zeigt sie zusätzlich einen kompakten Hinweis wie `2 Teilsendungen / 1 von 2 abgeholt`.

Beim Öffnen der Hauptsendung sind die Teilsendungen einzeln erreichbar.

## Persistenz und Merge-Regeln

Teilsendungen werden als Bestandteil der kanonischen Hauptsendung gespeichert. Sie dürfen nicht nur im Browserzustand existieren.

Der bestehende serverseitige State-/Merge-Mechanismus muss Teilsendungsdaten so behandeln, dass:

- bereits registrierte QR-Tokens nicht durch ältere Browserstände entfernt werden,
- Abhol-/POD-Daten nicht durch stale Clients zurückgesetzt werden,
- gesperrte Teilsendungszuordnungen nicht durch eine ältere automatische Berechnung überschrieben werden,
- tatsächlich neuere erlaubte Änderungen vor der Sperre weiterhin gespeichert werden können.

Die RC1016-Regel, serverseitig neuere externe/operative Daten gegen stale Client-Überschreibung zu schützen, ist auch auf Teilsendungsdaten anzuwenden.

## Fehlerbehandlung

ExportHUB muss einen Mehr-LKW-Zustand sichtbar ablehnen statt stillschweigend inkonsistent zu speichern, wenn mindestens einer dieser Fälle eintritt:

- Mengenpartition stimmt nicht mit Hauptsendung überein
- dieselbe physische Einheit ist mehrfach zugeordnet
- gesperrte Teilsendung würde durch Neuberechnung verändert
- QR-Token ist nicht eindeutig
- Teilsendung verweist auf eine andere Hauptsendung
- Hauptstatus behauptet vollständige Abholung, obwohl noch eine Teilsendung offen ist

Fehlermeldungen sollen fachlich verständlich sein und in die vorhandene Fehlerdiagnose integrierbar bleiben.

## Technische Architektur

RC1017 wird in klar getrennte Einheiten aufgeteilt:

1. **Partitionierungs-/Kapazitätsmodell** – nimmt kanonische Colli plus ausgewählten Fahrzeugtyp und erzeugt eine deterministische Liste von Teilsendungs-Zuordnungen.
2. **Teilsendungs-Persistenzmodell** – normalisiert Identitäten, Mengen, Status und Sperrkennzeichen innerhalb der Hauptsendung.
3. **Statusaggregation** – berechnet den Hauptstatus ausschließlich aus den gespeicherten Teilsendungszuständen.
4. **QR-/Pickup-Adapter** – nutzt den bestehenden Pickup-Mechanismus mit einer zusätzlichen stabilen Teilsendungsidentität statt ein zweites QR-System zu bauen.
5. **Ladelisten-/Druckadapter** – filtert die bestehenden Druckdaten je Teilsendung und ergänzt `Sendung X von Y`.
6. **UI-Adapter** – zeigt die Mehr-LKW-Zusammenfassung nur dann, wenn mehr als eine Teilsendung vorhanden ist.

Keine dieser Einheiten darf eine parallele Kunden-, ABD-, Mail- oder Dokumentenverwaltung erzeugen.

## Rückwärtskompatibilität

Alte gespeicherte Sendungen ohne Teilsendungsdaten bleiben gültig.

Beim Laden gilt:

- passt die Sendung in einen LKW, bleibt sie im bisherigen Modell ohne persistierte künstliche Teilsendung
- benötigt eine noch nicht operativ begonnene Sendung mehrere LKW, kann RC1017 die Teilsendungen beim nächsten zulässigen Berechnungs-/Speichervorgang erzeugen
- bereits abgeholte Alt-Sendungen werden nicht nachträglich in Teilsendungen migriert

## Teststrategie

RC1017 wird testgetrieben umgesetzt. Vor Produktionscode werden Regressionstests erstellt, die auf dem aktuellen RC1016-Stand fehlschlagen.

Pflichttests:

1. Ein-LKW-Sendung bleibt vollständig unverändert.
2. Überkapazität erzeugt exakt die benötigte Anzahl Teilsendungen.
3. Jede Teilsendung hat stabile eindeutige ID und Bezeichnung `Sendung X von Y`.
4. Summe der Teilsendungs-Colli entspricht exakt der Hauptsendung.
5. Keine Colli-Menge wird doppelt zugeordnet.
6. Einzelstück mit Menge 1 wird niemals zwischen zwei LKW geteilt.
7. Mehrstück-Zeile wird nur ganzzahlig verteilt.
8. Unveränderte Daten erzeugen deterministisch dieselbe Verteilung.
9. Vor erster Abholung führt Colli-Änderung zu zulässiger Neuberechnung.
10. Nach erster operativer Abholung ist Neuberechnung gesperrt.
11. Jede Teilsendung erhält einen anderen QR-Token.
12. QR-Aufruf einer Teilsendung zeigt ausschließlich deren Colli.
13. Abholung von Teilsendung 1 verändert Teilsendung 2 nicht.
14. Hauptsendung wird erst nach vollständiger Abholung aller Teilsendungen als abgeholt geführt.
15. POD-/Signaturnachweise bleiben je Teilsendung getrennt.
16. Ladeliste 1 enthält nur Colli von LKW 1; Ladeliste 2 nur Colli von LKW 2.
17. Jede Ladeliste trägt `Sendung X von Y` und den richtigen eigenen QR-Code.
18. Stale Client kann serverseitig neuere Teilsendungs-Abholdaten nicht zurücksetzen.
19. Firmen-/Umgebungsisolierung gilt auch für Teilsendungen.
20. Bestehende QR-, Avis-, POD-, RC1016-Persistenz- und Gesamttests bleiben grün.

## Release- und Umgebungsregel

Die Entwicklung erfolgt ausschließlich auf `rc1017-multi-truck-subshipments`.

Produktion, TESTSERVICE und Demo werden gemäß der bestehenden Projektregel nur gemeinsam auf denselben freigegebenen Versionsstand gebracht. Während Entwicklung und RED/GREEN-Phasen wird `main` nicht direkt verändert. Erst nach vollständigen Regressionstests, Review und freigegebenem Integrationsschritt darf RC1017 in `main` übernommen und über den gemeinsamen Drei-Umgebungen-Deploy veröffentlicht werden.

## Abnahmekriterien

RC1017 ist fachlich fertig, wenn:

- eine Sendung automatisch und verlustfrei auf mehrere LKW verteilt wird,
- jeder LKW eine eigene Ladeliste und einen eigenen sicheren QR-Code besitzt,
- jede Teilsendung unabhängig abgeholt und nachgewiesen werden kann,
- die Hauptsendung den Gesamtfortschritt korrekt aggregiert,
- nach begonnener Abholung keine automatische Umverteilung mehr möglich ist,
- Ein-LKW-Sendungen unverändert funktionieren,
- alle neuen und bestehenden Regressionstests grün sind,
- Produktion, TESTSERVICE und Demo nach Freigabe gemeinsam aus demselben Stand gebaut und live geprüft werden.

## Nicht Bestandteil von RC1017

- separate Kunden-/Auftragsreferenz je LKW
- separate ABD-Anforderung je LKW
- neues paralleles QR-System
- automatische Speditionsbuchung je Teilsendung
- freie manuelle Verschiebung abgeholter Colli zwischen LKW
- nachträgliche Aufteilung bereits abgeschlossener Alt-Sendungen
- grundlegender Neuaufbau des bestehenden Stauplans
