# RC997 – ExportHUB Website Finalisierung

## Ziel

RC997 macht die bestehende ExportHUB-Website auf Basis des vollständig grünen RC996-Standes fachlich und technisch abnahmebereit. Es ist kein Rewrite und keine Professional-Migration. Bestehende, funktionierende Bereiche und Datenflüsse bleiben erhalten. Fehler werden an den aktiven Blöcken behoben; Alt-/Reparaturblöcke werden nicht zusätzlich darübergelegt.

## Sicherheitsrahmen

- Entwicklung ausschließlich auf `rc997-website-final`.
- `main` bleibt bis zum geprüften Integrationsschritt unverändert.
- Produktion bleibt auf RC990, solange keine ausdrückliche Release-Center-Freigabe erfolgt.
- `production-version.js` darf im RC997-Entwicklungs- und TESTSERVICE-Schritt nicht auf RC997 gesetzt werden.
- TESTSERVICE und Demo bleiben von Produktion getrennt.
- Keine D365-Schnittstelle oder direkte D365-Verknüpfung.
- Bestehende RC995/RC996-Sicherheitsverträge für QR, Avis, POD, State-Merge und Android bleiben verbindlich.

## Abschlussumfang

### 1. Navigation, Rendering und Suche

- Jede Hauptfunktion öffnet genau die vorgesehene Ansicht und nicht pauschal die Sendungsansicht.
- Seitenwechsel, Zurück-Navigation, Scroll-/Fokus-Erhalt und Neurendern bleiben stabil.
- Suche findet die vorgesehenen Objekte und führt zum richtigen Treffer.
- Keine sichtbaren Doppelrender, unnötigen Vollrenders oder Bedienpausen bei normalen Aktionen.
- Smartphone-Menü ist zuverlässig mit einem Tap/Klick bedienbar.

### 2. Dashboard, Warncenter und Benachrichtigungscenter

- Dashboard zeigt die aktiven Arbeitsinformationen ohne unnötige Hohlräume oder übergroße Kacheln.
- Warncenter enthält handlungsrelevante Prozess-/Fehlerwarnungen.
- Benachrichtigungscenter enthält Ereignisse und Informationen; dieselbe Meldung erscheint nicht sinnlos doppelt in beiden Centern.
- Arbeitsfokus und zugehörige Prioritätsinformationen stehen an der vorgesehenen Stelle.

### 3. Sendung erstellen und Sendungsübersicht

- Feste Sendungsbereiche bleiben vollständig vorhanden: Kunde/Empfänger, Sendungsdaten, Colli/LDM, Dokumente/ABD, Stauplan, Mailbereich sowie Speichern/Ausgabe.
- Colli-Zeilen bleiben beim Hinzufügen stabil positioniert; Eingaben verschwinden nicht.
- Verpackung, Anzahl und Gewicht werden direkt aus sichtbaren Feldern übernommen; Maße/LDM dürfen aus Verpackungsdaten ergänzt werden.
- Referenz- und Datumslogik bleibt konsistent.
- Kunden-/Prozesshinweise bleiben lesbar und Langtextfelder wachsen passend mit dem Inhalt.
- Sendungsübersicht zeigt genau ein konsistentes Layout und öffnet die richtige Sendung.
- Gesperrte Sendungen bleiben ab Abholung/POD read-only.

### 4. Kunden, Standorte und Dokumente

- Kunden- und Dokumentbereiche laden reproduzierbar.
- Kundennummer bleibt eindeutig; Standorte sind nur dem richtigen Kunden zugeordnet.
- Kundenordner-Struktur und bestehende Mail-/Kontaktbereiche werden nicht unnötig umgebaut.
- Dokumentanzeige, Download und Direktzugriff respektieren Rollen-/Sperrregeln.

### 5. ABD und Mailbereich

- ABD-Pflichtlogik bleibt: Nicht-EU und Wert > 1.000 EUR oder Speditionsanforderung.
- Wartet-auf-ABD blockiert den Versandprozess wie vorgesehen.
- Mehrere ABD-Dateien und sechsstellige ABD-Referenz bleiben unterstützt.
- Mailbereich ist genau einmal vorhanden und enthält Kunden-/Speditions-/eigene Maildaten.
- Pflichtanhänge und bestehende CC-Regeln bleiben erhalten.

### 6. Ladeliste, CMR, PDF und Gesamtausgabe

- Druck und Download öffnen zuverlässig und ohne leere Zusatzseiten.
- Ladeliste und PDF haben dasselbe fachliche Layout; der QR-Code bleibt ausschließlich dort, wo er vorgesehen ist.
- CMR-Inhalte, Warenbeschreibung, Colli-Daten und Paletteninformationen werden vollständig übernommen.
- Gesamtausgabe liefert die vorgesehene Dokumentreihenfolge und Anzahl.
- Report-Datumsformat bleibt TT.MM.JJJJ.

### 7. QR-Abholung, PIN, POD und Kunden-Avis

- QR-Abholung bleibt token-/PIN-geschützt und kann nicht beliebig extern wiederverwendet werden.
- Erfolgreiche Abholung setzt Status sowie tatsächliches Datum/Uhrzeit korrekt.
- POD ist erst nach Abholung zulässig und wird getrennt von Ladeliste/CMR behandelt.
- Kunden-Avis bleibt ein separater sicherer externer Flow und erscheint nicht als normaler Bereich der internen Website.
- Avis zeigt nur freigegebene Sendungsdaten/Dokumente.
- Bestehende RC995-Sicherheitsverträge dürfen nicht abgeschwächt werden.

### 8. Aufgaben, Planer und Lager

- Aufgabenstatus bleibt pro Aufgabe eindeutig, auch bei mehreren Aufgaben derselben Sendung.
- Wiederholte Aufgaben erzeugen neue Aufgaben für den nächsten Zeitraum statt erledigte Instanzen wiederzuverwenden.
- Prioritäten bleiben änderbar.
- Drag-and-Drop in Aufgabenplaner und Lager bleibt performant und löst keine unnötigen Vollrenders aus.
- Lagerkacheln, Zielflächen und Statusfarben bleiben konsistent.

### 9. Release Center

- Release Center zeigt offene Änderungen nachvollziehbar und konsistent.
- Freigaben verändern Scrollposition/Fokus nicht unnötig.
- Produktionsfreigabe bleibt ein expliziter, separater Schritt.
- RC997 darf niemals allein durch TESTSERVICE-Deploy Produktion verändern.

### 10. Demo und Android-Weboberfläche

- Demo verwendet ausschließlich Fake-Daten und blockiert echte ExportHUB-API-Aufrufe.
- Demo bleibt extern vorzeigbar und klar von TESTSERVICE/Produktion getrennt.
- Gemeinsame Android-App behält Umgebungswahl, Menübedienung und Benachrichtigungsintegration.
- RC997-Websiteänderungen dürfen Android-Webansicht und APK-Build nicht brechen.

## Technische Strategie

1. RC996 wird als Baseline eingefroren und durch neue RC997-Abschlussverträge geschützt.
2. Zuerst werden aktive Restfehler durch statische Verträge und vorhandene Regressionstests materialisiert.
3. Für jeden bestätigten Defekt gilt RED -> minimale aktive Reparatur -> GREEN.
4. Keine neuen Reparaturblöcke über alten Blöcken; der aktive defekte Block wird korrigiert oder ersetzt und veralteter Ersatz entfernt.
5. Änderungen werden nach Funktionsclustern gebündelt, damit RC997 ein großer Abschluss-RC bleibt und nicht in viele Produkt-RCs zerfällt.
6. TESTSERVICE wird aus dem geprüften Kandidaten gebaut und live gegen Root, Hauptseite, Demo und API geprüft.
7. Produktion bleibt unverändert, bis der Release-Center-Schritt separat freigegeben wird.

## Verifikation

RC997 gilt erst als TESTSERVICE-fertig, wenn alle folgenden Gates frisch grün sind:

- JavaScript-/Node-Syntax der geänderten aktiven Dateien.
- Bestehende `npm test` Regressionen.
- RC995-Sicherheitsvertrag.
- RC996 Drei-Umgebungen-, Aufgaben-, State-Merge- und Android-Verträge.
- Neue RC997-Abschlussverträge für die konkret behobenen Website-Flows.
- Generierte TESTSERVICE- und Demo-Seiten enthalten den richtigen Umgebungsmarker.
- Android-Debug-APK wird erfolgreich gebaut und als Artefakt erzeugt.
- Sicherer Deploy ausschließlich in die benannte Umgebung `testservice`.
- Live-Check: TESTSERVICE Root, Testseite, Demo und Auth-API erfolgreich; statische Redirects nur begrenzt verfolgt, API ohne Redirect-Following.
- `production-version.js` bleibt RC990 und enthält keinen RC997-Produktionsmarker.

## Abnahmekriterium

RC997 ist fachlich abnahmebereit, wenn die oben genannten Website-Flows ohne bekannte Blocker funktionieren, alle automatisierten Gates grün sind und TESTSERVICE/Demo live verifiziert wurden. Eine Produktionsfreigabe ist ausdrücklich nicht Teil dieses Abschlusses und erfolgt anschließend ausschließlich über das Release Center.

## Nicht Bestandteil von RC997

- ExportHUB Professional 0.3+ Migration/Cutover.
- Neue persistente Datenbank oder neuer Blob-Dokumentenspeicher.
- Komplett-Neuschreibung der Hauptseite.
- Direkte D365-Integration.
- Produktivfreigabe ohne Release Center.
