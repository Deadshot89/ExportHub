# RC995 QR-Abholung + Kunden-Avis – Design

**Status:** vom Nutzer am 04.09.2026 freigegeben  
**Ausgangsbasis:** `main` nach RC994 (`676881bf157cb4fafec5cb1012965242d248909a`)  
**Produktionsanker:** `production-version.js` bleibt unverändert auf RC990.

## Ziel

RC995 vereinheitlicht die beiden öffentlichen ExportHUB-Zugänge **QR-Abholung** und **Kunden-Avis**, ohne interne ExportHUB-Rechte zu öffnen und ohne Produktion freizugeben.

## Sicherheitsarchitektur

1. Öffentliche Tokens werden kryptografisch zufällig serverseitig erzeugt.
2. Der Roh-Token wird nur bei der Ausstellung an den internen ExportHUB-Client zurückgegeben. Gespeichert wird ausschließlich ein HMAC/SHA-256-Ableitungswert.
3. Zugriffsdaten liegen in einem separaten, umgebungsgetrennten Public-Access-Speicher (`production` / `testservice`) und **nicht** im normalen Team-State.
4. Der Team-State-Server entfernt bekannte QR-/Avis-Geheimfelder zusätzlich defensiv, falls alte UI-Logik sie noch sendet.
5. Öffentliche Antworten enthalten nur freigegebene Felder. Interne Benutzer, Rechte, Audit-Interna, Auth-Sitzungen und Zugriffstokens werden nie ausgeliefert.
6. Fehlversuche werden pro Zugriff protokolliert. Nach wiederholten falschen Referenz-/PIN-Eingaben wird der Zugriff temporär gesperrt.
7. TESTSERVICE und Produktion verwenden getrennte Zugriffspfade und Datenspeicher. Ein Testservice-Token darf nie Produktionsdaten adressieren und umgekehrt.

## QR-Abholung

- Der interne Pickup-Init benötigt eine gültige ExportHUB-Sitzung und erzeugt einen neuen serverseitigen Zugriff.
- Der QR-Link ist zeitlich begrenzt und wird nach erfolgreicher Abholung verbraucht.
- Vor Abschluss werden persönliche vierstellige Verlader-PIN, Spedition, Kennzeichen, gezählte Colli und digitale Unterschrift geprüft.
- Soll-Colli werden aus den physischen Colli-Zeilen summiert; keine einzelne Zeile und kein veralteter Fallback darf die Summe überschreiben.
- Die öffentliche Abholseite zeigt die tatsächlich zur Sendung gehörende Empfänger-/Lieferadresse, nicht pauschal eine Hauptadresse.
- Erfolgreiche Bestätigung setzt serverseitig `Abgeholt`, tatsächliches Datum/Uhrzeit und erledigt die verknüpfte Aufgabe `Abholtag`.
- POD darf erst nach bestätigter Abholung gespeichert/abgerufen werden.
- Wiederverwendung eines bereits verbrauchten oder abgelaufenen Links wird mit HTTP 410 abgewiesen.

## Kunden-Avis

- Avis aktivieren erzeugt einen **eigenen** serverseitigen Einmal-Link; Pickup- und Avis-Token sind niemals identisch.
- Avis deaktivieren/reissuen invalidiert ältere Zugriffe und Sitzungen.
- Der Roh-Link kann genau einmal autorisiert werden. Nach korrekter Referenzprüfung wird er verbraucht und durch eine kurzlebige signierte Avis-Sitzung ersetzt.
- Die Avis-Sitzung erlaubt ausschließlich die freigegebenen Sendungsdaten, freigegebenen Dokumente und die Avis-Bestätigung/Terminmeldung.
- Kundenbestätigung findet nur auf `customer-avis.html` statt; im normalen Bereich „Sendung erstellen“ gibt es keine Kundenbestätigung.
- Dokumentdownloads laufen nur über die aktive Avis-Sitzung und eine serverseitige Whitelist.
- Nach Abholung bleibt die Ansicht gemäß bestehender Fachlogik nur noch als geschlossene Abholinformation/POD-Ansicht verfügbar; der Link kann zusätzlich automatisch deaktiviert werden.

## Druck / PDF

- QR-Code erscheint ausschließlich auf der **ersten gedruckten Ladeliste**.
- Der Druck-QR wird kompakter formatiert.
- Der QR-Code ist nie Bestandteil einer erzeugten PDF-Datei und nie auf einer zweiten Ladelisten-Seite.
- QR-/Avis-Geheimnisse erscheinen nicht in normalen ExportHUB-Ansichten, Debug-Ausgaben, Dateinamen oder PDF-Inhalten.

## Kompatibilität

- Bestehende öffentliche URLs (`pickup.html`, `customer-avis.html`) bleiben erhalten.
- Bestehende Pickup-/Avis-API-Pfade bleiben als Vertrag bestehen; intern werden sie auf den gemeinsamen Zugriffsspeicher umgestellt.
- Alte unsichere Tokens werden nicht still weiterverwendet. Bei Bedarf muss der interne Client einen neuen RC995-Link ausstellen.

## Release-Grenze

RC995 wird ausschließlich als TESTSERVICE-Stand gebaut und geprüft. `production-version.js` darf in keinem RC995-Commit verändert werden; dadurch darf der Produktions-Deploy-Workflow nicht ausgelöst werden.
