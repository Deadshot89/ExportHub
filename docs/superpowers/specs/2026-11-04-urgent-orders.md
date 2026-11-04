# ExportHUB360 – Urgent Order (CS → Logistik)

Stand 04.11.2026 · Prüfzweig feature/urgent-orders-cs-workflow · keine Produktionsfreigabe

## Erfassung
- SO-Nummer (SO3002), Lieferart DRP oder DIRECT, P1–P4, CS-E-Mail, DE/EN.
- Mehrere Lines oder Artikel je SO mit individueller Menge.
- Je Position manuell prüfen: pickbarer Bestand, weder Don't Process noch Credit Hold, bei Minibag zehn Tage Leadtime.
- Nicht bestandene Prüfungen nur mit Begründung melden; sichtbar als „Prüfung erforderlich“. Es findet keine D365-Live-Abfrage statt.
- Bereits gemeldete SOs werden nicht still überschrieben.

## Logistikübersicht
- Pro Auftrag eine ausklappbare Zeile mit Positionen.
- Jede Position hat einen eigenen Status: Open, Waved, In Progress, Loaded, Shipped, Invoiced.
- Suche und Filter nach SO, Line, Artikel, E-Mail, Priorität, Lieferart und Status.
- Die Logistik sieht alle Aufträge, CS nur eigene Meldungen. Rechte über bestehenden ExportHUB-Benutzer und shipmentoverview/tasks-Bearbeitungsrecht.

## E-Mail
- Aktionen „Problem melden“ und „Versandbestätigung“ erzeugen einen DE-/EN-Entwurf.
- Versandbestätigung nur, wenn alle Positionen mindestens Shipped sind.
- Mailto-Übergabe an Standard-Mailprogramm; kein automatischer Versand, kein irreführender „gesendet“-Status.
- Gespeicherte CS-E-Mail wird einer authentifizierten Benutzer-ID zugeordnet, ist bei freier Eingabe aber noch nicht verifiziert.

## Sicherheit und Speicher
- Separate Azure-Blobs urgent-orders/v1.json und testservice/urgent-orders/v1.json.
- Authentifizierung serverseitig zwingend, Schreibrechte serverseitig geprüft.
- Optimistische ETag-Speicherung, keine angeblich erfolgreiche Speicherung ohne ETag.
- Keine Änderungen am D365, Team-State, vorhandenen Sendungen, POD, QR und keine neuen kostenpflichtigen Dienste.

## Abnahme
1. Alle Pflichtfelder und negativen Prüffälle serverseitig validieren.
2. Zwei Positionen unabhängig im Status aktualisieren und auf-/zuklappen.
3. CS darf fremde SO nicht sehen oder verändern; Logistik darf Status ändern.
4. E-Mail nach erneutem Login im eigenen Profil anzeigen.
5. E-Mails in Deutsch und Englisch und Versandstatus-Sperre prüfen.
6. Isolation zwischen TESTSERVICE und Produktion im Browser/API überprüfen.
7. Bestehende Release-, Sicherheits-, Druck- und Packmeldung-Tests grün.

## Offene Erweiterungen
- CS-Benutzerzugänge und verifizierte E-Mail-Zuordnung.
- Optionale D365-Prüfungen, Nachmeldungen zu einer bestehenden SO und dokumentierter direkter Microsoft-Graph-Mailversand.
- Manuelle Testservice-Abnahme und gesonderte Produktionsfreigabe.
