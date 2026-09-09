# RC1016 SOP-Konsolidierung und echte ExportHUB-Systembilder

## Ziel

Das aktive SOP-Handbuch wird von 75 kleinteiligen Einzeldokumenten auf 24 vollständige, zusammenhängende ExportHUB-Arbeitsabläufe verdichtet. Die 75 bisher freigegebenen SOPs bleiben revisionssicher als historischer Altbestand erhalten. Die künstlich erzeugten SVG-„Screenshots“ werden im aktiven RC1016-Katalog nicht mehr als Systembilder verwendet; stattdessen werden echte Screenshots der RC1016-Demo mit ausschließlich sicheren Fake-Daten eingebunden.

## Dokumentenlenkung

Die bisherigen 75 RC1010-SOPs bleiben unverändert als historische Version 1.0 erhalten. RC1016 legt einen neuen aktiven Katalog als Version 2.0 an. Jede konsolidierte SOP enthält:

- eine führende bestehende SOP-Nummer,
- `combinedFrom` mit allen zusammengefassten historischen SOP-Nummern,
- Version 2.0 mit Status `Freigegeben`,
- vollständige 14-teilige Pflichtstruktur,
- Prozessübersicht und detaillierte Einzelschritte,
- reale ExportHUB-Systembilder an passenden Schritten,
- Historie mit Hinweis auf die Zusammenfassung der v1.0-Dokumente,
- `legacyDocuments` mit dem vollständigen 75er-Altbestand für Audit und Nachvollziehbarkeit.

Gespeicherte echte spätere Benutzerfassungen dürfen nicht verloren gehen. Der RC1016-Reconcile übernimmt historische Versionen und Audit-Einträge der führenden SOP und ergänzt die kanonische 2.0-Fassung. Nicht mehr aktive Einzelnummern werden nicht in der täglichen SOP-Übersicht gerendert, bleiben aber in `legacyDocuments` verfügbar.

## Aktive 24 Arbeitsabläufe

1. SOP-EH-001 – Systemzugang, Navigation, Suche und Firmenkontext: 001–003, 005–006
2. SOP-EH-004 – Dashboard, Warncenter und Benachrichtigungen: 004, 007
3. SOP-EH-010 – Benutzer, Rollen, Rechte und Zugriff: 010–014
4. SOP-EH-020 – Kunden, Standorte, Kontakte und Dokumente: 020–023
5. SOP-EH-030 – Sendungen suchen, anlegen, speichern und bearbeiten: 030, 031, 035, 036
6. SOP-EH-032 – Sendungsdaten, Colli, LDM und Stauplan: 032–034
7. SOP-EH-037 – Status, Storno, Abschluss und Archivierung: 037–038
8. SOP-EH-040 – Versandkosten, Route und Versandportal: 040–042
9. SOP-EH-050 – Dokumente hochladen, prüfen und öffnen: 050, 051, 056
10. SOP-EH-052 – Versanddokumente, CMR und Gesamtausgabe: 052–055
11. SOP-EH-060 – ABD vom Bedarf bis zur Versandfreigabe: 060–062, 065
12. SOP-EH-063 – Mail vorbereiten, Anhänge, Pflicht-CC und Versandstatus: 063–064
13. SOP-EH-070 – QR-Abholung vom Erzeugen bis zum Abschluss: 070–074
14. SOP-EH-075 – POD hochladen, prüfen und Status fortführen: 075
15. SOP-EH-076 – Kunden-Lieferavis aktivieren, versenden und verwalten: 076–078
16. SOP-EH-080 – Palettenkonto buchen, scannen und korrigieren: 080–083
17. SOP-EH-090 – Aufgaben anlegen, priorisieren, wiederholen und vertreten: 090–093
18. SOP-EH-094 – Planer und Lagersteuerung: 094, 096
19. SOP-EH-095 – Abholkalender und feste Abholungen: 095
20. SOP-EH-100 – SOP-Handbuch, Fassungen, Bilder, Freigabe und Druck: 100–104
21. SOP-EH-105 – Academy-Prüfung und Prüfungsverwaltung: 105–106
22. SOP-EH-110 – Archiv, Protokolle und Audit: 110–111
23. SOP-EH-112 – Fehlerdiagnose und mobile Diagnose: 112–113
24. SOP-EH-114 – Release Center, gemeinsame Umgebungen, Demo und App: 114–116

Jede der 75 historischen Nummern ist genau einer aktiven SOP zugeordnet.

## Zusammenführung der Inhalte

Die alten Inhalte werden nicht als kurzer Verweis versteckt. Aus jedem Quelldokument werden die operativen Schritte in der bisherigen Reihenfolge übernommen und als Teilprozess in die neue 2.0-SOP eingebettet. Der Schritttext wird mit dem Quellprozess gekennzeichnet, damit nachvollziehbar bleibt, aus welchem v1.0-Dokument er stammt. Zweck, Verantwortlichkeiten, Prüfungen, Abweichungen, Nachweise, Hilfsmittel und Querverweise werden dedupliziert zusammengeführt.

Querverweise auf eine historische SOP, die in einer anderen 2.0-SOP aufgegangen ist, werden auf die führende aktive SOP-Nummer umgebogen. Externe Abläufe bleiben als SOP-EXT-/SOP-XXXX-Verweis gekennzeichnet.

## Echte Systembilder

Quelle der Bilder ist ausschließlich der echte RC1016-Demo-Build im Chromium-Browser. Die Demo enthält nur Fake-Kunden, Fake-Sendungen und Fake-FIX-Abholungen und löst keine echten Mails, Avis-/QR-Tokens oder Produktivschreibvorgänge aus.

Mindestens die folgenden Ansichten werden als echte PNG-Systembilder gespeichert:

- Aufgabenübersicht mit Priorität, Fälligkeit, Verantwortlichem und Öffnen-Aktion,
- Sendungsübersicht mit Erfassungsdatum und Colli,
- Abholkalender mit sichtbaren FIX-Abholungen,
- Dashboard/Warncenter,
- Sendungsmaske,
- SOP-Handbuch.

Die Bilder liegen versioniert unter `assets/sop/screenshots/rc1016-*.png`. Eine aktive RC1016-SOP darf kein `data:image/svg+xml` mehr als Screenshotquelle verwenden. Prozessgrafiken bleiben SVG, weil sie bewusst Prozessgrafiken und keine Screenshots sind.

## Darstellung

Pro SOP werden Bilder den konkreten Schritten über `stepId` zugeordnet. Bei langen Abläufen können mehrere Screenshots erscheinen. Bildunterschriften nennen die gezeigte ExportHUB-Ansicht und den Zweck. Die bestehende responsive SOP-Darstellung, Druckansicht und Rechteprüfung bleiben unverändert.

## Freigabekriterien

RC1016-SOPs sind erst freigabefähig, wenn:

1. genau 24 aktive Dokumente vorhanden sind,
2. alle 75 historischen SOPs genau einmal durch `combinedFrom` abgedeckt sind,
3. der historische 75er-Katalog unverändert verfügbar bleibt,
4. alle aktiven Dokumente Version 2.0 und Status `Freigegeben` besitzen,
5. keine aktive Screenshotquelle ein generiertes Data-URI-SVG ist,
6. reale PNG-Systembilder aus dem RC1016-Demo-Browser eingebunden sind,
7. Aufgaben und Abholkalender echte RC1016-Screenshots besitzen,
8. gespeicherte historische Versionen beim Reconcile erhalten bleiben,
9. Produktion, TESTSERVICE und Demo denselben RC1016-SOP-Katalog laden,
10. die vorhandenen RC1007–RC1010-Historientests weiterhin grün bleiben.
