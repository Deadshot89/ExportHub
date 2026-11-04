# ExportHUB360 – Urgent Order (CS → Logistik)

UI-Pfad: /assets/urgent-orders.html (über den bestehenden assets-Deploy).

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
- Die Logistik sieht alle Aufträge, CS nur eigene Meldungen. Rechte über bestehenden ExportHUB-Benutzer und shipmentoverview-Bearbeitungsrecht.

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


## Erweiterung 04.11.2026 – Direktumschlag und öffentliche Meldung
- Neue Auftragsart DIRECT_OUTBOUND zusätzlich zu STANDARD, bei der Ware erst eintrifft und direkt per Express oder Sondertransport weitergeht.
- Pflichtfelder: geplante Ankunft (Europe/Berlin), Eingangstransportart, Anlieferdienstleister, Ausgangsversandart; optionale Anlieferreferenz und gewünschter Versandtermin.
- Manuelle Checks für Direktumschlag: Lieferschein vorhanden, ASN funktioniert, weder Don't Process noch Credit Hold. Bei neuen Artikeln zusätzlich Artikelstammdaten korrekt und Prozess eingehalten; Minibag-Leadtime weiterhin nur bei Minibag.
- Pickbarer aktueller Bestand ist bei noch nicht angelieferter Ware ausdrücklich keine Pflichtprüfung. Negative Ergebnisse müssen mit Begründung erfasst werden.
- Status Problem hinzugefügt. Statusfarben: Open grau, Waved blau, In Progress gelb, Problem rot, Loaded violett, Shipped türkis, Invoiced grün.
- Offen: mindestens eine Position ist nicht Invoiced. Geschlossen: alle Positionen Invoiced.
- Öffentlicher Melde-Link /urgent-order, ohne ExportHUB-Login, mit eigener Seite im Stil Packmeldung.
- Bei erstmaliger Meldung entsteht ein persönlicher 256-Bit-Überwachungslink (URL-Fragment). Der zugehörige Schlüssel wird nicht im Klartext im Azure-Blob gespeichert, sondern nur als SHA-256-Hash.
- Nur Anfragen mit passendem individuellen Melder-Token sind in der öffentlichen Übersicht sichtbar. Wer den Link besitzt, kann diese Anfragen lesen; niemand darf ihn weitergeben. Öffentliche API hat ausschließlich create/list, kein edit/status/mail.
- Derselbe Link kann weitere Anfragen derselben E-Mail unter derselben Meldersicht erzeugen. E-Mail-Adresse allein ist kein Authentisierungsnachweis. Ohne persönlichen Link kein Rückgriff auf frühere Anfragen.
- Schutz: Eingabelimit, serverseitige Datenvalidierung, begrenzte Meldemenge, in-memory Rate-Limit; vor Produktion ist zusätzlich ein persistenter/globaler Missbrauchsschutz zu prüfen. Kein öffentliches Verzeichnis aller SOs.
- Interne Logistik sieht die zusammengeführten öffentlichen und internen Urgent Orders über ihre eigene authentifizierte Oberfläche.
- TESTSERVICE/Produktion bleiben getrennt. Kein Merge/Deployment ohne eigenständige Freigabe.


## Deepfix – Sicherheit und Testabnahme
- Das öffentliche Formular erzeugt 256-Bit-Token und hält im Storage nur ihren SHA-256-Hash vor; die API stellt ausschließlich tokengebundene Lese- und neue Melderequests bereit.
- Das temporäre pro-IP-Limit ist nicht die einzige Schranke: zusätzlich gilt eine **atomare, per Azure Blob-ETag geschützte Tagesobergrenze von 200 anonymen Neumeldungen pro Umgebung**. Die Schranke gilt über mehrere Azure-Instanzen hinweg.
- Unbekannte Host- oder widersprüchliche Azure-Umgebungsangaben werden für diesen Endpunkt fail-closed zurückgewiesen; ein frei manipulierbarer Origin-Header allein reicht nicht zum Auswählen eines Storage-Namespace.
- Neue Artikel ohne Artikelnummer werden bereits in der Modellvalidierung zurückgewiesen.
- Der Status Problem ist für jede Position separat möglich und in der internen Auswahl sowie im öffentlichen Verlauf farbig sichtbar.
- Neues Verhaltenstestmodul: `test/rc1802-urgent-public-behavior.test.mjs` (getrennte Melder, linkgebundene Einsicht, fehlender/falscher Link, keine öffentlichen Statusmutationen, Weitergabe des internen Problemstatus, tägliche Obergrenze, Umgebungs-Mismatch).
- Die Seite bindet die zentrale sechssprachige i18n-Runtime ein; die Quellprüfung der neuen UI-Dateien ergibt nach der Sprachpaketregistrierung keine neuen unregistrierten deutschen Literale.
- **Vor Livegang:** GitHub-CI vollständig grün, Testservice-E2E mit echtem Azure-Blob-Speichern/Lesen und Link aus anderem Browser testen; Test- und Produktionsisolation auf realen Host-Headern bestätigen; prüfen, ob der 200/Tag-Cap fachlich passt. Bis dahin bleibt PR #1183 Draft, kein Deployment.
