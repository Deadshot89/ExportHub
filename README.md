# ExportHUB – aktueller Main-Stand

ExportHUB verwendet weiterhin die gemeinsame **RC1112-Releasebasis** für Produktion, TESTSERVICE, Demo und Android. Die fachlichen und technischen Korrekturen auf `main` reichen aktuell bis **RC1237**. Der technische Build-/Produktionsmarker bleibt bewusst RC1112; die sichtbare Produktversion wird getrennt geführt.

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

Die sichtbare Produktversionsanzeige ist von der stabilen technischen RC1112-Buildkette getrennt. Dadurch können fachliche Korrekturen unabhängig vom technischen Buildmarker ausgeliefert werden.

## Website und Umgebungen

- Produktion, TESTSERVICE und Demo werden gemeinsam über den RC1112-Drei-Umgebungen-Deploy gebaut.
- TESTSERVICE wird vor Produktion durch ein echtes Playwright-Browser-Gate geprüft.
- Produktion wird erst nach grünem TESTSERVICE-Gate freigegeben.
- Nach dem Produktionsdeploy laufen zusätzliche Read-only Browser-Smokes und Live-Prüfungen.
- `index.html`, `TESTVERSION.html` und `demo.html` verwenden denselben RC1112-Funktionsstand.
- Topbar, Navigation, globale Suche, Warncenter, persönliche Benachrichtigungen, Fehlerdiagnose, Historie, Abholkalender und Sendungsübersicht sind Bestandteil des aktuellen Stands.

## POD-Sicherung und Wiederherstellung

PODs werden serverseitig zweifach gesichert:

1. Primärspeicher im bestehenden Azure-POD-Container `exporthub-pod`.
2. Zusätzliche unveränderliche Archivkopie im separaten Container `exporthub-pod-backup`.

Die Archivkopie wird content-addressed und SHA-256-geprüft gespeichert. Neue Archivkopien werden vollständig zurückgelesen und gegen Hash und Dateigröße verifiziert. Bestehende Kopien werden regelmäßig kontrolliert; fehlende oder fehlerhafte Kopien werden nicht stillschweigend als erfolgreich behandelt.

Microsoft 365 / Microsoft Graph ist für die verpflichtende Zweitsicherung nicht erforderlich und kann nur optional verwendet werden.

Der Workflow `.github/workflows/rc1144-pod-backup-reconcile.yml` prüft und vervollständigt offene POD-Sicherungen nach Deploys sowie regelmäßig per Zeitplan.

Zusätzlich enthält der aktuelle Stand einen **RC1234 TESTSERVICE-Restore-Drill**. Der Drill ist ausdrücklich auf TESTSERVICE begrenzt und stellt einen verifizierten Backup-Stand in einen isolierten Recovery-Zielblob wieder her. Dabei werden unter anderem SHA-256, Revision und Sendungsreferenz geprüft. Produktivdaten werden durch diesen Drill nicht überschrieben.

## QR-Abholung und POD-Dokumente

Die QR-Abholung und die automatisch erzeugte signierte POD-Ladeliste sind durch einen eigenen Live-Gate abgesichert. Nach einem Produktionsdeploy werden Produktion und TESTSERVICE getrennt geprüft:

- `pickup.html` erreichbar,
- Pickup-Health erreichbar,
- POD-Dokument-Viewer ausgeliefert,
- geschützter Dokument-Endpunkt ohne gültige Sitzung nicht frei zugänglich,
- tatsächlich verwendete Pickup-/POD-Runtime-Marker vorhanden.

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

Die aktuelle Aufgabenansicht verwendet unter anderem die fachlichen Gruppen:

- Offene Sendungen
- Fehlende POD
- Kunde angemeldet
- Picks
- Offene ABDs

`Fehlende POD` gilt nur für bereits abgeholte Sendungen, bei denen der POD noch fehlt.

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
