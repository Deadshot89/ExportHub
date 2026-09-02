# RC950 Large Update Design

## Ziel
RC950 bündelt die nächsten offenen ExportHUB-Verbesserungen als ein einziges großes TESTSERVICE-Release. Fokus sind Stabilität, Reaktionsgeschwindigkeit, belastbares Layout, sichere Navigation, Datenerhalt und ein umfassender Regressionstest.

## Umfang
1. Performance: unnötige Render-, Resize-, Speicher- und Wiederholungsarbeit im aktiven TESTVERSION-Pfad reduzieren. Eingaben, Ansichtswechsel und Kachelbewegungen müssen unmittelbar reagieren.
2. Speichern/Drucken: sichtbare Arbeitszustände für längere Speichern-, PDF- und Druckaktionen; keine zusätzlichen fachlichen Speicherzyklen nur für UI-Feedback.
3. Dashboard/Layout: Hohlräume und springende Kacheln verhindern, ohne bestehende fachliche Bereiche wie Arbeitsfokus, Warncenter und Benachrichtigungscenter neu zu definieren.
4. Sendung erstellen: Kunde/Empfänger, Sendungsdaten, Colli/LDM, Dokumente/ABD, Stauplan, Mail und Ausgabe als zusammenhängenden Layout- und Datenerhaltspfad prüfen. Colli-Zeilen dürfen beim Hinzufügen keine starken Layoutsprünge auslösen.
5. Navigation: Ansichten dürfen sich nicht gegenseitig überschreiben; Menüwechsel, Zurück-Navigation und erneutes Öffnen einer Funktion müssen stabil bleiben.
6. Aufgaben/Lager: RC946-Pointer-Drag bleibt Grundlage; mehrere schnelle Verschiebungen hintereinander müssen stabil bleiben.
7. Suche/Datenerhalt: Suche muss im aktiven View-Pfad funktionieren. Kunden-, Such- und Sendungseingaben dürfen durch Render/Sync nicht verschwinden.
8. Desktop/Mobil: dieselben Kernfunktionen müssen auf Desktop und Smartphone funktionieren; mobile Darstellung darf keine Desktop-Regression erzeugen.
9. Regression: ein RC950-Gesamttest deckt Marker, Navigation, Suche, Datenerhalt, Colli, Task-/Warehouse-Drag, Speichern-/Druckstatus sowie wesentliche bestehende Sperr- und Statusregeln ab.

## Nicht im Umfang
- QR-Abholung fachlich verändern oder neu gestalten.
- Kunden-Avis fachlich verändern oder neu gestalten.
- Produktionsdateien direkt aktualisieren.
- D365-Integration.
- Benachrichtigungscenter/Warncenter neu aufteilen; deren RC918-Trennung bleibt erhalten.

## Architektur
RC950 repariert ausschließlich aktive Codepfade. Historische oder überdeckte Reparaturgenerationen werden nicht erneut überschrieben; wenn ein aktiver Defekt gefunden wird, wird der aktive Block direkt ersetzt bzw. bereinigt. Bestehende fachliche Funktionen wie `moveTask(...)` und `moveShipmentKey(...)` bleiben die Persistenzschnittstellen, während UI-Interaktion und Rendering davor optimiert werden.

Da `TESTVERSION.html` weiterhin die große integrierte Testservice-Anwendung enthält, wird RC950 keine riskante Komplettzerlegung dieses Files erzwingen. Stattdessen werden die tatsächlich berührten Verantwortlichkeiten klar markiert, dedupliziert und mit Regressionstests abgesichert. Produktionsdateien bleiben unangetastet.

## Daten- und Speicherregeln
- Keine Eingabe darf durch einen reinen Re-Render oder View-Wechsel verloren gehen.
- Speichern bleibt teamstand-/Azure-basiert wie im vorhandenen aktiven Pfad; UI-Feedback darf keine zusätzliche Speicherung auslösen.
- Ab `Abgeholt` oder vorhandener POD bleibt die Sendung gesperrt: ansehen/drucken/downloaden ja, bearbeiten/speichern nein.
- Colli-Daten werden aus den sichtbaren Eingabefeldern übernommen. Verpackung, Anzahl und Gewicht bilden die Mindestvollständigkeit; Maße/LDM dürfen automatisch ergänzt werden.

## UI-Verhalten
- Aktionen mit echter längerer Verarbeitung zeigen einen eindeutigen Busy-Zustand; kurze lokale Interaktionen bleiben ohne störenden Overlay-Flash.
- Grid-/Masonry-Neuberechnung wird gebündelt statt mehrfach direkt hintereinander ausgelöst.
- Colli-Zeilen besitzen stabile Höhen/Spaltenbreiten und verändern umliegende Bereiche beim Hinzufügen nur um die tatsächlich benötigte Zeilenhöhe.
- Drag & Drop reagiert weiterhin nach minimaler Pointer-Bewegung und blockiert Buttons, Inputs und Links nicht.

## Fehlerbehandlung
- Netzwerk-/Speicherfehler dürfen lokale Eingaben nicht verwerfen.
- Ein fehlgeschlagener Persistenzvorgang zeigt einen klaren Fehlerstatus und lässt den lokalen Stand für einen erneuten Versuch erhalten, sofern die bestehende fachliche Logik dies bereits vorsieht.
- Navigation oder Suche dürfen bei Fehlern nicht pauschal auf die Sendungsansicht zurückfallen.

## Teststrategie
1. Vor jeder Reparatur ein gezielter RED-Test oder Audit-Nachweis des aktiven Defekts.
2. Nach jeder zusammengehörigen Änderung gezielte GREEN-Prüfung.
3. Abschließend ein RC950-Gesamttest mit statischen Assertions und den bestehenden Node-/Runtime-Tests.
4. TESTSERVICE-Deployment erst, wenn alle RC950-Prüfungen grün sind.
5. Nach Deployment Live-Verifikation von `/TESTVERSION.html` und `/test` auf RC950.

## Release-Regeln
- RC950 ist ein einziges gebündeltes Anwendungsrelease.
- Zwischenstände bleiben auf dem RC950-Entwicklungszweig und werden nicht als neue RC-Versionen veröffentlicht.
- Erst nach erfolgreichem Gesamttest wird RC950 in den TESTSERVICE-Hauptstand übernommen und deployed.
