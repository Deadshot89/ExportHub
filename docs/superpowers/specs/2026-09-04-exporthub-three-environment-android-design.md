# ExportHUB Drei-Umgebungen- und Android-Design

## Ziel
ExportHUB erhält drei klar getrennte, vollständig nutzbare Einstiege: Produktion, TESTSERVICE und Demo. Die Android-App nutzt denselben Funktionsumfang und kann beim Start bewusst zwischen allen drei Umgebungen wechseln. Mobile Menübedienung, Benachrichtigungen, Downloads, Uploads und Navigation werden für alle Umgebungen einheitlich behandelt.

## Umgebungen

### Produktion
- Einstieg bleibt die bestehende Produktions-Hauptseite `index.html`.
- Verwendet ausschließlich Produktivdaten und Produktiv-APIs.
- Erhält einen sichtbaren App-/Umgebungszugang, ohne Test- oder Demo-Daten einzublenden.
- Änderungen an Produktion werden weiterhin ausschließlich über das bestehende Release-Center-/Produktionsfreigabe-Gate veröffentlicht.
- Der aktuell veröffentlichte Produktionsmarker bleibt unverändert, bis der neue Release-Kandidat vollständig geprüft und freigegeben ist.

### TESTSERVICE
- Einstieg bleibt `TESTVERSION.html` auf dem bestehenden TESTSERVICE-Host.
- Enthält den jeweils aktuellen Release-Kandidaten und klar sichtbare TESTSERVICE-Kennzeichnung.
- Verwendet ausschließlich TESTSERVICE-Daten und TESTSERVICE-APIs.
- Erhält denselben App-/Umgebungszugang wie Produktion.

### Demo
- Neuer eigenständiger Einstieg `demo.html`.
- Demo arbeitet ausschließlich mit fest definierten Fake-Daten und darf keine Produktiv- oder TESTSERVICE-Teamstände lesen oder schreiben.
- Fake-Daten umfassen mindestens Kunden, Sendungen, Aufgaben, Benachrichtigungen und Warnungen, damit ExportHUB vorführbar ist.
- Demo kennzeichnet sich dauerhaft sichtbar als Demo.
- Demo-Aktionen bleiben innerhalb der Demo-Sandbox; kein Versand realer Mails, keine echten öffentlichen Avis-/Pickup-Tokens und kein Schreiben in echte Azure-Teamstände.
- Demo erhält denselben App-/Umgebungszugang wie Produktion und TESTSERVICE.

## Gemeinsame Web-Umgebungsnavigation
- Ein kleiner gemeinsamer Laufzeitbaustein kapselt die Erkennung der aktuellen Umgebung und rendert den Zugang zu Produktion, TESTSERVICE, Demo und Android-App.
- Der Baustein darf die bestehende ExportHUB-Fachlogik nicht duplizieren oder überschreiben.
- Auf Mobilgeräten muss der Zugang platzsparend und berührungssicher sein.
- Produktion, TESTSERVICE und Demo zeigen ihren aktuellen Kontext eindeutig, damit kein Benutzer versehentlich in der falschen Umgebung arbeitet.

## Android-App
- Es gibt eine gemeinsame Android-App, keine drei separaten APKs.
- Beim App-Start erscheint eine Auswahl: `Produktion`, `TESTSERVICE`, `Demo`.
- Die Auswahl kann später innerhalb der App wieder gewechselt werden.
- Die App darf nur die drei bekannten ExportHUB-Ziele intern im WebView öffnen; andere Links werden weiterhin extern behandelt.
- Der bisherige pauschale Produktionsblock der RC876-Test-App entfällt und wird durch eine explizite Umgebungswahl ersetzt.
- Der vorhandene Android-Menüfix bleibt erhalten: WebView fokussierbar/klickbar, Touch-/Pointer-Bindung für `ehMenuBtn`, erneute Bindung nach DOM-Renders.
- Downloads, Datei-Uploads, Drucken, Zurücknavigation und Offline-Hinweis bleiben erhalten.

## Android-Systembenachrichtigungen
- Ab Android 13 wird `POST_NOTIFICATIONS` sauber angefordert.
- Benachrichtigungscenter und Warncenter bleiben fachlich getrennt:
  - Benachrichtigungscenter: persönliche offene Aufgaben und Erinnerungen um 09:00, 12:00 und 15:00 Uhr.
  - Warncenter: operative Sendungsprobleme wie fehlender POD, Dokumente oder Abholung.
- Die App zeigt native Systembenachrichtigungen nur für die aktuell gewählte Umgebung.
- Produktion darf keine Test-/Demo-Meldungen erzeugen; Demo darf keine Produktivmeldungen erzeugen.
- Benachrichtigungen müssen dedupliziert werden, damit derselbe fachliche Hinweis nicht mehrfach hintereinander als Android-Systemmeldung erscheint.
- Das Öffnen einer Systembenachrichtigung führt in die passende ExportHUB-Umgebung und, soweit technisch verfügbar, in den zugehörigen Bereich.

## Demo-Datenschutz und Isolation
- Demo enthält keine echten Namen, Kundennummern, E-Mail-Adressen, Telefonnummern, Referenzen oder Dokumente aus Produktion/TESTSERVICE.
- Demo besitzt eigene Speicher-Schlüssel und darf vorhandene produktive lokale Browserdaten nicht übernehmen.
- Jede Netzwerkfunktion, die eine reale Außenwirkung hätte, wird in Demo blockiert oder durch eine sichtbare Demo-Simulation ersetzt.

## Versions- und Release-Strategie
- Der neue Gesamtblock wird als neuer Release-Kandidat nach RC995 geführt, da er Web-Einstiege, Demo und Android gemeinsam verändert.
- TESTSERVICE und Demo werden zuerst vollständig geprüft.
- Produktion wird erst danach über das bestehende Release Center veröffentlicht.
- Android-Build und Web-Release verwenden denselben freigegebenen Umgebungsvertrag.

## Tests und Abnahmekriterien

### Web
- Produktion zeigt App-/Umgebungszugang ohne Test-/Demo-Datenzugriff.
- TESTSERVICE zeigt App-/Umgebungszugang und bleibt vollständig vom Produktiv-Teamstand getrennt.
- Demo ist direkt aufrufbar, sichtbar als Demo gekennzeichnet und funktioniert ausschließlich mit Fake-Daten.
- Kein horizontaler Seitenüberstand bei 320, 360, 390, 412, 480, 768 Pixel Breite.
- Smartphone-Menü öffnet mit einem Tap und bleibt nach Navigation/Render erneut bedienbar.
- Benachrichtigungscenter und Warncenter zeigen weiterhin ihre getrennten fachlichen Inhalte.

### Android
- App baut erfolgreich als Debug-/Test-APK.
- Startauswahl bietet exakt Produktion, TESTSERVICE und Demo.
- Jede Umgebung öffnet den richtigen Host/Pfad.
- Menü reagiert mit einem Tap.
- Datei-Upload, Download, Drucken und Android-Zurücknavigation funktionieren weiterhin.
- Android-13+-Benachrichtigungsrecht wird korrekt behandelt.
- Native Benachrichtigungen öffnen die richtige Umgebung und werden dedupliziert.

### Sicherheit
- Demo kann keine Produktiv- oder TESTSERVICE-Daten lesen oder schreiben.
- Produktion und TESTSERVICE bleiben getrennt.
- Externe URLs verlassen weiterhin den WebView.
- HTTPS bleibt Pflicht; Cleartext bleibt deaktiviert.

## Nicht-Ziele
- Keine D365-Integration.
- Keine drei getrennten Android-Apps.
- Keine produktive Veröffentlichung ohne Release-Center-Freigabe.
- Keine echten Push-Cloud-Dienste wie Firebase als Voraussetzung für die erste Ausbaustufe; die erste native Benachrichtigungsstufe nutzt den vorhandenen ExportHUB-Zustand und Android-seitige Planung/Abfrage, solange die App bzw. der zulässige Hintergrundmechanismus verfügbar ist.
