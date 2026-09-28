# ExportHUB – aktueller Main-Stand

ExportHUB verwendet weiterhin die gemeinsame **RC1112-Releasebasis** für Produktion, TESTSERVICE, Demo und Android. Die fachlichen und technischen Korrekturen auf `main` reichen aktuell bis **RC1312**. Der technische Build-/Produktionsmarker bleibt bewusst RC1112; die sichtbare Produktversion wird getrennt geführt.

## Aktueller Release-Stand

Seit RC1223 wurden unter anderem folgende releasekritische Punkte ergänzt oder korrigiert:

- **RC1224** – Lieferavis mit buchbaren 2-Stunden-Slots zwischen 08:30 und 16:00 Uhr, maximal drei parallelen Sendungen sowie freier Slotanzeige.
- **RC1225** – Security-Runbook auf bestätigten Live-Status aktualisiert.
- **RC1226** – POD-Archivintegrität mit Read-back, SHA-256-/Größenprüfung und regelmäßiger Revalidierung abgesichert.
- **RC1227** – UPS-Zielland und komplette Sendungskosten korrigiert.
- **RC1228** – Lieferavis-Slotlogik zusätzlich im Live-Release abgesichert.
- **RC1229** – sichere AVIS-Kundenuploads melden zusätzlich an Despatch Nettetal.
- **RC1230/RC1231** – AVIS-Sicherheitsvorschriften und englische Darstellung ergänzt; falsche sichtbare RC1193-Anzeige korrigiert.
- **RC1232/RC1233** – QR-Abholung und signierte POD-Ladeliste wiederhergestellt und durch einen Production-/TESTSERVICE-Live-Gate abgesichert.
- **RC1234** – verifizierter TESTSERVICE-State-Restore-Drill mit Backup-Readback, isoliertem Restore sowie SHA-256-, Revision- und Sendungsreferenzprüfung.
- **RC1235** – fehlerhaften Pickup/POD-Live-Gate-Marker korrigiert; keine Fachlogik geändert.
- **RC1236** – unnötige Avis-Autosaves bei Navigation außerhalb der Sendungsansicht entfernt.
- **RC1237** – Ziellanderkennung auf der Hauptseite korrigiert: Standortland → Lieferadresse → Kunden-Stammland; italienische CAP-/Provinzkürzel wie `60044 Albacina-Fabriano AN` werden korrekt erkannt.
- **RC1239** – TESTSERVICE-Browser-Gate gegen View-Re-Render-Races stabilisiert; View-Inhalt wird atomar aus dem DOM gelesen.
- **RC1240** – signierte TESTSERVICE-E2E-Sitzung auf 45 Minuten erweitert; ausschließlich gültig `E2E-*`-markierte Alt-Testdaten werden vor einem neuen Lauf bereinigt.
- **RC1241** – POD-Reconcile leert den sicherungsfähigen Backlog in mehreren Batches und gilt erst bei vollständig leerem Backlog als erfolgreich.
- **RC1242** – QR-Abholung erzwingt die Reihenfolge Sendung → Collis bestätigen → Fahrer/Fahrzeug/Unterschrift/PIN; fehlende erwartete Colli-Anzahl sperrt die Abholung fail-closed.
- **RC1303** – Login-Persistenz, First-Paint und Produktionsdomain stabilisiert; Produktion verwendet `https://www.exporthub360.de/`.
- **RC1304** – Lieferavis-Refresh-Sturm behoben und Design-Switcher eingeführt.
- **RC1305** – Sendungsansicht mit Dokumentzugriff/Statushistorie sowie Ladeliste-/CMR-Suche und -Ausgabe verbessert.
- **RC1306** – echte Multi-Layout-Architektur für Classic, Modern Business, Glass und Neon Night; funktionale DOM-Knoten werden verschoben statt dupliziert.
- **RC1307** – `RC1112 Main Contract` läuft für jeden Pull Request gegen `main` und kann damit als Pre-Merge-Gate verwendet werden.
- **RC1308** – Multi-Layout-Browser-Gate explizit auf alle fünf Ziel-Viewports erweitert.
- **RC1309** – Playwright-Testtooling auf 1.63.0 aktualisiert; die zuvor gemeldeten High-Severity-Funde im reinen Testtooling sind aus den aktiven Workflows entfernt.
- **RC1310** – doppelter Layout-Rebuild beim expliziten Designwechsel beseitigt.
- **RC1311** – Login-First-Paint weiter reduziert und Browser-Tab nach Login dauerhaft auf `ExportHUB360` gehalten.
- **RC1312** – persönlicher Aufgabenplan vollständig sichtbar, Android-Aufgabenbenachrichtigungen auf reale persönliche Aufgaben begrenzt und stündliches Runtime-Monitoring für Produktion und TESTSERVICE ergänzt.

Die sichtbare Produktversionsanzeige ist von der stabilen technischen RC1112-Buildkette getrennt. Die autoritative sichtbare Version steht in `release-version.json`; reine Dokumentations- oder Testcommits erhöhen sie nicht automatisch. Dadurch können fachliche Korrekturen unabhängig vom technischen Buildmarker ausgeliefert werden.

## Website und Umgebungen

- Produktion, TESTSERVICE und Demo werden gemeinsam über den RC1112-Drei-Umgebungen-Deploy gebaut.
- TESTSERVICE wird vor Produktion durch ein echtes Playwright-Browser-Gate geprüft.
- Produktion wird erst nach grünem TESTSERVICE-Gate freigegeben.
- Nach dem Produktionsdeploy laufen zusätzliche Read-only Browser-Smokes und Live-Prüfungen.
- Der TESTSERVICE-E2E-Fixture verwendet ausschließlich signierte, TESTSERVICE-isolierte 45-Minuten-Sitzungen; vor jedem Lauf werden nur eindeutig `E2E-*`-markierte Alt-Testdaten bereinigt.
- `index.html`, `TESTVERSION.html` und `demo.html` verwenden denselben RC1112-Funktionsstand.
- Topbar, Navigation, globale Suche, Warncenter, persönliche Benachrichtigungen, Fehlerdiagnose, Historie, Abholkalender und Sendungsübersicht sind Bestandteil des aktuellen Stands.

## Design und responsive Viewports

ExportHUB unterstützt vier vollständig unterschiedliche Layouts: **Classic**, **Modern Business**, **Glass** und **Neon Night**. Der Wechsel betrifft die Informationsarchitektur und Geometrie der Oberfläche, nicht nur Farben oder Hintergründe.

Das RC1306/RC1308 Browser-Gate prüft alle vier Designs in Chromium auf allen fünf verbindlichen Zielgrößen:

- Smartphone klein: **360×800**
- Smartphone Standard: **390×844**
- Tablet: **768×1024**
- Laptop: **1366×768**
- Desktop: **1920×1080**

Die responsive Logik stapelt Modern Business und Neon unterhalb 1120 px bewusst vertikal; Glass reduziert sein Raster bei Tabletbreite und wird auf Smartphone einspaltig. Alle Varianten prüfen zusätzlich auf horizontales Overflow, doppelte Funktionsblöcke und Runtime-Fehler.

## POD-Sicherung und Wiederherstellung

PODs werden serverseitig zweifach gesichert:

1. Primärspeicher im bestehenden Azure-POD-Container `exporthub-pod`.
2. Zusätzliche unveränderliche Archivkopie im separaten Container `exporthub-pod-backup`.

Die Archivkopie wird content-addressed und SHA-256-geprüft gespeichert. Neue Archivkopien werden vollständig zurückgelesen und gegen Hash und Dateigröße verifiziert. Bestehende Kopien werden regelmäßig kontrolliert; fehlende oder fehlerhafte Kopien werden nicht stillschweigend als erfolgreich behandelt.

Microsoft 365 / Microsoft Graph ist für die verpflichtende Zweitsicherung nicht erforderlich und kann nur optional verwendet werden.

Der Workflow `.github/workflows/rc1144-pod-backup-reconcile.yml` prüft und vervollständigt offene POD-Sicherungen nach Deploys sowie regelmäßig per Zeitplan. Im vollständigen Drain-Modus verarbeitet er bis zu zehn Batches à 25 Einträge und gilt erst dann als erfolgreich, wenn kein sicherungsfähiger Backlog mehr übrig ist; Pending- oder Fehlerzustände bleiben harte Fehler.

Zusätzlich enthält der aktuelle Stand einen **RC1234 TESTSERVICE-Restore-Drill**. Der Drill ist ausdrücklich auf TESTSERVICE begrenzt und stellt einen verifizierten Backup-Stand in einen isolierten Recovery-Zielblob wieder her. Dabei werden unter anderem SHA-256, Revision und Sendungsreferenz geprüft. Produktivdaten werden durch diesen Drill nicht überschrieben.

## QR-Abholung und POD-Dokumente

Die QR-Abholung und die automatisch erzeugte signierte POD-Ladeliste sind durch einen eigenen Live-Gate abgesichert. Nach einem Produktionsdeploy werden Produktion und TESTSERVICE getrennt geprüft:

- `pickup.html` erreichbar,
- Pickup-Health erreichbar,
- POD-Dokument-Viewer ausgeliefert,
- geschützter Dokument-Endpunkt ohne gültige Sitzung nicht frei zugänglich,
- tatsächlich verwendete Pickup-/POD-Runtime-Marker vorhanden.

Der operative Abholablauf ist auf der öffentlichen QR-Seite verbindlich gestuft:

1. Sendungsinformationen prüfen,
2. Collis bestätigen,
3. Fahrer-/Fahrzeugdaten, Unterschrift und persönlichen Verlader-PIN erfassen.

Ändert sich die Colli-Anzahl, wird der Fahrer-Schritt wieder gesperrt. Fehlt die erwartete Colli-Anzahl in den Sendungsdaten, bleibt die Abholung fail-closed gesperrt.

## Versandkosten und Zielland

Die Versandkostenlogik berücksichtigt für das Zielland folgende Reihenfolge:

1. explizites Land des ausgewählten Standorts,
2. erkannte Lieferadresse,
3. Kunden-Stammland als Fallback.

Italienische Adressen mit CAP und Provinzkürzel werden ausdrücklich unterstützt. Die Erkennung schützt gleichzeitig vor Fehlinterpretationen deutscher Orts-/Kennzeichenbestandteile wie `MG`.

Für UPS wird der Endpreis als Preis der **kompletten Lieferung** ausgewiesen; die Länderlogik ist Bestandteil der Regressionstests.

## Lieferavis

Der aktuelle Lieferavis-Stand umfasst unter anderem:

- Buchung innerhalb 08:30–16:00 Uhr,
- 2-Stunden-Zeitfenster,
- maximal drei gleichzeitig belegte Sendungen,
- freie Slotanzeige nach Auswahl des Tages,
- serverseitigen Schutz gegen parallele Überbuchung,
- Sicherheitsvorschriften in Deutsch und Englisch,
- Referenznummer bei Abholung,
- sichere Dokumentuploads,
- zusätzliche interne Benachrichtigung nach erfolgreichem Kundenupload,
- Live-Gate für die Slotlogik.

## Aufgaben

Die Aufgabenansicht zeigt den vollständigen persönlichen Wochenplan direkt unter **„Meine hinterlegten Aufgaben“**. Für Tobias sind aktuell hinterlegt:

- Montag: Spanien, Gaggenau bis 13:00, FAURECIA
- Dienstag: Würth Industrie, BMP
- Mittwoch: Italien, BSH bis 13:00, O’Hare bis 12:00, Essentra Schweden, Contitech ABD
- Donnerstag: Würth Industrie, Spanien, Polen
- Freitag: Italien, Frankreich, Neff bis 13:00
- Referenzbereich: Schweizer Kunden prüfen

Statusfolge: **offen → in Bearbeitung → erledigt**. Wiederkehrende Aufgaben erzeugen danach die nächste planmäßige Ausführung. Die Android-Erinnerungsslots bleiben **09:00 / 12:00 / 15:00**; Referenzbereiche erzeugen keine Handy-Erinnerung, und ohne gültigen persönlichen Snapshot werden keine generischen Aufgaben erfunden.

## Android-App

Das Android-Projekt befindet sich unter `android-app/`.

Aktueller technischer Releasevertrag:

- `versionCode = 1112`
- `versionName = "1.0-rc1112"`
- `compileSdk = 36`
- `targetSdk = 36`

Der Build-Workflow erzeugt ein geprüftes Debug-APK-Artefakt für die RC1112-Basis.

## Aktive Release- und Deploy-Pfade

Die zentralen dauerhaft aktiven Pfade sind:

- Hauptprüfung: `.github/workflows/rc1002-main-contract.yml`  
  Workflow-Name: **RC1112 Main Contract**
- Gemeinsamer Produktion / TESTSERVICE / Demo Deploy: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`  
  Workflow-Name: **ExportHUB RC1112 Drei-Umgebungen Deploy**
- TESTSERVICE Einzel-Deploy nur als ausdrücklich bestätigte Ausnahme: `.github/workflows/exporthub-testservice.yml`
- Android: `.github/workflows/exporthub-android-test-app.yml`
- POD-Backup-Nachholung: `.github/workflows/rc1144-pod-backup-reconcile.yml`
- Multi-Layout Browser Gate: `.github/workflows/rc1306-layout-browser.yml`
- Stündliches Runtime-Monitoring: `.github/workflows/rc1050-storage-probe.yml`

Historische RC-Regressionstests bleiben bewusst erhalten und werden vom aktuellen Releasevertrag weiter ausgeführt, damit frühere Funktionen nicht unbemerkt regressieren.

## Release-Sicherheit

Ein Produktionsstand gilt erst als freigegeben, wenn die vorgesehenen Vertrags-, Node-, Build-, TESTSERVICE-, Browser- und Production-Live-Gates erfolgreich sind.

Der Main Contract prüft unter anderem:

- Security,
- Accessibility und responsive Basis,
- historische Release-Regressionen,
- QR- und Lieferavis-End-to-End-Verträge,
- Android-Regression,
- Aufgaben-Verträge,
- Diagnose-Verträge,
- Mehr-LKW-Vertrag,
- Mail- und Sprachbasis,
- gesamte Node-Regression,
- reproduzierbaren Drei-Umgebungen-Build.

Für die POD-Sicherung gilt zusätzlich: offene Sicherungen dürfen im Production-Reconcile weder `pendingCount > 0` noch `errorCount > 0` hinterlassen.

## Runtime-Monitoring

Der RC1050-Workflow läuft **stündlich** und prüft ohne zusätzlichen Cloud-Dienst:

- `https://www.exporthub360.de/`
- den Azure-Production-Origin,
- TESTSERVICE,
- Health,
- Auth,
- Storage-Readiness.

Damit bleiben Erreichbarkeit und zentrale Backend-Abhängigkeiten regelmäßig sichtbar, auch zwischen Deployments.

## Bekannte externe Admin-Blocker

Zwei Punkte sind technisch vorbereitet, können aber nicht allein durch Repository-Code abgeschlossen werden:

- **Microsoft Graph `Mail.Send`**: Der echte RC1255 TESTSERVICE-AVIS-/Reminder-Mailtest bleibt blockiert, solange die verwendete Entra-App die Application Permission `Mail.Send` nicht mit Admin-Consent besitzt. Der Deploy weist darauf ausdrücklich hin und behandelt den bekannten Permission-Blocker nicht als Codefehler.
- **GitHub Branch Protection**: `RC1112 Main Contract` läuft bereits für jeden Pull Request gegen `main`, aber **Branch Protection** ist auf `main` derzeit nicht aktiviert. Für eine echte erzwungene Merge-Sperre muss die Repository-Admin-Konfiguration zusätzlich „Änderungen nur via PR“, den Required Check `RC1112 Main Contract / verify`, Force-Push-Sperre und Löschsperre aktivieren.
