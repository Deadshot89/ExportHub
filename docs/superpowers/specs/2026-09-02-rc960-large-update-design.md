# RC960 Großupdate – Design

## Ziel
RC960 bündelt die noch offenen Website-Kernbereiche in einem einzigen TESTSERVICE-Release: Kernbetrieb/Stabilität, Versand/Abholung sowie Admin/Release. Es gibt genau einen gemeinsamen Freigabe- und Deploypunkt. QR-Abholscan-Sicherheitslogik und Kunden-Avis bleiben bewusst außerhalb des Pakets.

## Verbindliche Leitplanken
- Ausgangspunkt ist RC950 auf `main` (`d6c20022926813ef1d1040c0e6f466573bb09f51`).
- Produktion wird nicht direkt verändert; nur TESTSERVICE wird entwickelt und veröffentlicht.
- Kein D365-Zugriff und keine D365-Schnittstelle.
- Keine neuen Reparaturblöcke über alten Blöcken: defekte aktive Logik direkt reparieren oder sauber ersetzen und Altlogik entfernen.
- RC945 Colli-Layout, RC946 Pointer-Drag und RC950 Frame-Batching/Fokus-Erhalt bleiben erhalten.
- Benachrichtigungscenter und Warncenter bleiben getrennt.
- Ab `Abgeholt` oder vorhandenem POD ist eine Sendung schreibgeschützt: nur ansehen, drucken und herunterladen; Desktop und Smartphone, auch für veraltete geöffnete Formstände.
- Colli-Eingaben aus sichtbaren Feldern bleiben maßgeblich; Verpackung + Anzahl + Gewicht bilden eine vollständige Zeile; Maße/LDM dürfen automatisch ergänzt werden.
- ABD-Regeln, Pflichtdokumente, Mailbereich, Palettenkonto und bestehende Kunden-/Standortregeln dürfen nicht regressieren.
- Ein RC960-Squash-Commit nach `main`, danach genau ein TESTSERVICE-Deploy.

## Block A – Kernbetrieb & Stabilität
1. Speichern und Autosave prüfen: keine Endlosschleifen, keine unnötigen Teamstand-Schreibvorgänge, keine Datenverluste bei schnellem Ansichtswechsel.
2. Einheitlicher Arbeitsstatus für längere Aktionen: Speichern, Dokument öffnen/erzeugen, Drucken/PDF, Download. Bestehendes Loading-System wird wiederverwendet.
3. Navigation: jede Hauptfunktion öffnet ihre korrekte Ansicht; Zurück führt zum tatsächlichen Ursprung zurück; Wechsel dürfen keine Mehrfachlayouts rendern.
4. Sendungsübersicht/Suche: stabile Filterung, korrekte Statusanzeige, schnelle Reaktion, keine Rücksprünge in falsche Ansichten.
5. Kunden und Dokumente: zuverlässiges Laden, kein Löschen frisch gespeicherter Daten durch veraltete Teamstände, Dokumentansicht ohne leere Folgeblätter.
6. Druck/PDF/Ladeliste/CMR: identische fachliche Datenbasis; Pflichtinhalte sichtbar; Fehler werden dem Nutzer eindeutig angezeigt statt still zu hängen.
7. Performance: wiederholte Wechsel, Colli-Eingabe, Zeile hinzufügen, Kachelbewegung, Öffnen/Schließen und Druck dürfen keine synchronen Vollrender-Kaskaden erzeugen.

## Block B – Versand & Abholung
1. Versandkosten: Gate41 ohne Servicezuschlag; Zielland zuverlässig aus Sendung/Empfänger ableiten; vorhandene UPS-/Mautlogik nur korrigieren, nicht neu erfinden.
2. Abholseite: vollständige physische Colli-Gesamtzahl anzeigen und gegen genau diese Gesamtzahl bestätigen; einzelne Zeilen dürfen nicht fälschlich als Gesamtsoll verwendet werden.
3. Statuskette: `Erstellt` → `Bereit zur Abholung` → `Abgeholt` → `POD vorhanden` → `Abgeschlossen` bleibt konsistent; ABD-Sperre bleibt davor wirksam.
4. Tatsächliches Abholdatum: bei erfolgter Abholung Datum/Uhrzeit speichern und verknüpfte `Abholtag`-Aufgabe erledigen; geplantes Datum bleibt separat.
5. POD: erst nach Abholung zulässig; vorhandener POD erzeugt den richtigen Status und die Schreibsperre; mehrere POD-Dateien bleiben möglich.
6. QR/PIN-Sicherheitsmechanik wird in RC960 nicht umgebaut. Bestehende QR-Flows dürfen nur gegen Regression geschützt werden.

## Block C – Admin & Release
1. Release Center zeigt alle offenen nicht veröffentlichten Änderungen korrekt und ohne Phantomzähler.
2. Einzelbestätigung/Freigabe darf die Seite nicht nach oben scrollen; Fokus und Position bleiben erhalten.
3. Freigegebene Versionen können eingeklappt werden; aktuelle/offene Änderungen bleiben klar getrennt.
4. Benutzer/Sitzungen/Rechte: Global Admin und Funktionsadmins behalten klare Grenzen; laufende Sitzungen können durch Admin beendet werden; keine versehentliche Rechteausweitung.
5. Prüfcenter: Auswertung/Verwaltung nur für Funktionsadmin; 50 Fragen je Prüfung, 100 Punkte, Nachbesprechung/Begründungen und Datenschutzanzeige bleiben geschützt.
6. Backup/Protokolle: bestehende Ablage-, Audit- und Aufbewahrungslogik wird auf Erreichbarkeit und Fehlerbehandlung geprüft; keine neue Cloud-Architektur.
7. Deployment-Sicherheit: TESTSERVICE-Preflight, API-Smoke, Runtime- und State-Route-Probes müssen vor Live-Bestätigung erfolgreich sein.

## Fehlerbehandlung
- Aktionen müssen entweder erfolgreich abschließen oder eine konkrete sichtbare Fehlermeldung liefern.
- Netzwerk-/Azure-Fehler dürfen lokale Eingaben nicht löschen.
- Ein fehlgeschlagener Serverabgleich darf einen neueren lokalen Stand nicht mit einem älteren Teamstand überschreiben.
- Schreibsperren und Rechte werden vor Persistenz geprüft, nicht erst nach dem Speichern.

## Teststrategie
- Bestehendes `npm test` bleibt Baseline.
- RC960 erhält statische Regressionstests für Versionsmarker und verbotene Altpfade sowie gezielte Flow-Prüfungen für die drei Blöcke.
- Kritische Interaktionen werden wiederholt getestet: viele Colli-Zeilen, schnelle Navigation, Suche, Speichern, Druck, Dokumentdownload, Kachelbewegung, Versandkosten, Abholbestätigung, POD-Sperre, Release-Center-Bestätigungen und Rechte.
- TESTSERVICE wird erst deployed, wenn alle RC960-Checks und vorhandenen Tests grün sind.

## Nicht Bestandteil von RC960
- Neue QR-Token-/PIN-Sicherheitsarchitektur.
- Kunden-Avis-Linklogik oder Einmalöffnungsmechanik.
- Produktionsrelease über das Release Center.
- D365-Integration.