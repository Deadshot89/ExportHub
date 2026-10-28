# ExportHUB – aktueller Main-Stand

ExportHUB verwendet weiterhin die gemeinsame **RC1112-Buildbasis** für Production-Candidate, TESTSERVICE, Demo und Android. Seit **RC1505** ist der Releaseweg jedoch bewusst getrennt: normale `main`-Integration verifiziert und aktualisiert ausschließlich TESTSERVICE; ein Production-Deploy ist nur noch über einen ausdrücklich bestätigten manuellen Production-Release möglich. Die fachlichen und technischen Korrekturen auf `main` reichen aktuell bis **RC1370**. Der technische Build-/Produktionsmarker bleibt bewusst RC1112; die sichtbare Produktversion wird getrennt geführt.

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
- **RC1319** – P0 für Sendung speichern, Statusfinalisierung und QR-Registrierung behoben und per mutierendem TESTSERVICE-E2E bis Reload verifiziert.
- **RC1320** – Mehr-LKW-Ablauf mit getrennten Teilabholungen und Statusaggregation als mutierender TESTSERVICE-E2E in das Release-Gate aufgenommen.
- **RC1322** – PC-Direktdruck vorbereitet: Edge ≥144 kann per offizieller Silent-Printing-Policy ohne Druckdialog auf den Windows-Standarddrucker drucken; Setup ist direkt im Schnelldruck verlinkt.
- **RC1370** – Sendungsansicht unterstützt eine interne manuelle Abholterminbuchung als Alternative zum Kunden-AVIS. Sie verwendet dieselben 2-Stunden-Slots und Kapazitätsgrenzen, speichert Abholdatum/-zeit, Spedition, Sendungsnummer und optional Kennzeichen und setzt den Status nicht vorzeitig auf `Abgeholt`.
- **RC1505** – Release-Architektur getrennt: `main` führt Main Verification und TESTSERVICE-Deploy aus; Production erfordert einen manuellen `ExportHUB Production Release` mit vollständigem Main-SHA, erfolgreicher Main Verification für exakt diesen SHA und der Bestätigung `PRODUCTION FREIGEBEN`.

Die sichtbare Produktversionsanzeige ist von der stabilen technischen RC1112-Buildkette getrennt. Die autoritative sichtbare Version steht in `release-version.json`; reine Dokumentations- oder Testcommits erhöhen sie nicht automatisch. Dadurch können fachliche Korrekturen unabhängig vom technischen Buildmarker ausgeliefert werden.

## Website und Umgebungen

- Die gemeinsame RC1112-Buildbasis erzeugt weiterhin Production-Candidate, TESTSERVICE und Demo aus demselben Funktionsstand; **Buildbasis und Deploy-Freigabe sind seit RC1505 getrennte Verträge**.
- Normale `main`-Integration läuft über **ExportHUB RC1112 Main Verification** und darf ausschließlich TESTSERVICE aktualisieren. Production-Secrets und Production-Upload sind aus diesem Main-Pfad entfernt.
- Die Main Verification führt vor bzw. um den TESTSERVICE-Deploy die vorgesehenen Vertrags-, Node-, Build-, Playwright-, mutierenden TESTSERVICE-E2E- und Readiness-Prüfungen aus.
- Production wird ausschließlich über **ExportHUB Production Release** freigegeben. Der Workflow ist manuell, verlangt einen vollständigen 40-stelligen `release_sha` aus `main`, die exakte Bestätigung `PRODUCTION FREIGEBEN` und einen erfolgreichen Main-Verification-Push-Lauf für denselben SHA.
- Checkout, Build und Pre-Deploy-Prüfung des Production-Releases bleiben auf exakt diesem freigegebenen SHA fixiert; ein normaler Merge nach `main` darf dadurch keinen Production-Deploy auslösen.
- Nach einem ausdrücklich gestarteten Production-Deploy laufen zusätzliche Read-only Browser-Smokes, Readiness- und Production-Live-Prüfungen.
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

Die POD-Sicherung besteht aus getrennten Nachweisen:

1. **Azure-Primärspeicher** im bestehenden Container `exporthub-pod`.
2. **Technische Azure-Archivkopie** im separaten Container `exporthub-pod-backup`.
3. **Vereinbarte unabhängige SharePoint-Notfallsicherung** über Microsoft Graph.

Die Azure-Archivkopie wird content-addressed und SHA-256-geprüft gespeichert. Neue Archivkopien werden vollständig zurückgelesen und gegen Hash und Dateigröße verifiziert. Bestehende Kopien werden regelmäßig kontrolliert; fehlende oder fehlerhafte Kopien werden nicht stillschweigend als erfolgreich behandelt.

**`archiveSaved=true` ist kein Nachweis einer SharePoint-Kopie.** Die unabhängige Microsoft-365-Sicherung gilt erst nach erfolgreichem Graph-Upload und SHA-256-geprüftem Readback mit bestätigter Datei-ID als erledigt (`driveSaved=true`, `driveVerifiedHash`, `driveVerifiedAt`). Bei einem SharePoint-Fehler bleibt das unterschriebene Original in Azure geschützt, die vereinbarte Zusatzsicherung wird jedoch ausdrücklich als unvollständig ausgewiesen.

Der Workflow `.github/workflows/rc1144-pod-backup-reconcile.yml` prüft und vervollständigt offene POD-Sicherungen nach Deploys sowie per Zeitplan. Der aktuelle Scan kann bis zu 200 Batch-Anfragen abarbeiten; offene oder zurückgestellte Azure- und SharePoint-Arbeiten werden getrennt ausgewiesen. Ein fehlerfreies Azure-Archiv allein ist **keine** fachliche Freigabe der vollständigen SharePoint-Notfallsicherung.

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

Die Aufgabenansicht zeigt unter **„Meine hinterlegten Aufgaben“** nur den aktuell freigegebenen persönlichen Aufgabenstamm.

- Mittwoch: **Essentra Schweden anmelden**

Die früher hinterlegten Wochenaufgaben sind nicht mehr aktiv und werden nicht mehr automatisch erzeugt. Sie bleiben im Code ausschließlich als historisches Archiv erhalten. Manuelle Aufgaben sowie echte Systemaufgaben für Sendungen, POD, ABD und Picks werden durch diese Bereinigung nicht entfernt.

Statusfolge: **offen → in Bearbeitung → erledigt**. Wiederkehrende Aufgaben erzeugen danach die nächste planmäßige Ausführung. Die Android-Erinnerungsslots bleiben **09:00 / 12:00 / 15:00**; Referenzbereiche erzeugen keine Handy-Erinnerung, und ohne gültigen persönlichen Snapshot werden keine generischen Aufgaben erfunden.

## Direktdruck-Arbeitsplatz

Der QR-/REF-Schnelldruck verwendet weiterhin exakt den vorhandenen ExportHUB-Gesamtdruck. Für einen verwalteten Windows-Druckarbeitsplatz kann zusätzlich `assets/tools/ExportHUB-DirectPrint-Setup.ps1` einmalig als Administrator ausgeführt werden. Das Skript:

- verlangt Microsoft Edge **144 oder neuer**,
- prüft, dass Windows einen Standarddrucker besitzt,
- aktiviert Edge `SilentPrintingEnabled`,
- aktiviert `PrintPreviewUseSystemDefaultPrinter`,
- kann mit `-Disable` vollständig zurückgesetzt werden.

Ohne diese verwaltete Edge-Konfiguration bleibt das normale Browser-Druckfenster erhalten. Es wird bewusst kein lokaler HTTP-/WebSocket-Druckserver geöffnet.

## Android-App

Das Android-Projekt befindet sich unter `android-app/`.

Aktueller technischer Releasevertrag:

- `versionCode = 1112`
- `versionName = "1.0-rc1112"`
- `compileSdk = 36`
- `targetSdk = 36`

Der Build-Workflow erzeugt ein geprüftes Debug-APK-Artefakt für die RC1112-Basis.

## Selbst korrigieren (IT-Bereich)

Global-Admins finden im IT-Bereich den Reiter **Selbst korrigieren** (`assets/rc1630-self-correct.js`). Nichts davon ändert Production direkt:

- **Text korrigieren:** Texte und Übersetzungen aus `assets/i18n/{de,en,pl,es,fr,it}.json` suchen und ändern (höchstens 20 pro Vorgang, mit Begründung). `/api/self-correct` legt einen Auftrag an und startet `.github/workflows/self-correct.yml`. Der Workflow holt den Auftrag per GitHub-OIDC ab, prüft jede Änderung erneut (`api/shared/self-correct.js`: nur vorhandene Schlüssel, gleiche Platzhalter, kein HTML, deutsche Texte, die fest im Seitenquelltext stehen, bleiben gesperrt), ändert ausschließlich `assets/i18n/*.json`, führt `npm run verify:i18n` und `npm test` aus und öffnet einen Pull Request.
- **Fehler beschreiben (KI):** freie Fehlerbeschreibung → `/api/diagnostic-autofix` (`request-manual`) → bestehender Diagnose-Autofix mit getestetem Pull Request.
- **Verlauf / Rückgängig:** Status jedes Auftrags mit PR-Link. Für gemergte Textkorrekturen erstellt „Rückgängig machen“ einen Revert-Pull-Request auf demselben Weg.

Nach dem Merge aktualisiert die Main Verification nur TESTSERVICE; Production bleibt der manuelle `ExportHUB Production Release`. Voraussetzungen: `EXPORTHUB_GITHUB_AUTOFIX_TOKEN` (Actions: write, Pull requests: read); `EXPORTHUB_SELF_CORRECT_ENABLED=false` schaltet die Textkorrektur ab; die KI-Variante braucht zusätzlich `EXPORTHUB_AUTOFIX_ENABLED`.

## Aktive Release- und Deploy-Pfade

Die zentralen dauerhaft aktiven Pfade sind:

- PR-/Pre-Merge-Prüfung: `.github/workflows/rc1002-main-contract.yml`  
  Workflow-Name: **RC1112 Main Contract**
- Main Verification und regulärer TESTSERVICE-Deploy: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`  
  Workflow-Name: **ExportHUB RC1112 Main Verification**
- Manueller Production-Release: `.github/workflows/exporthub-production-release.yml`  
  Workflow-Name: **ExportHUB Production Release**
- TESTSERVICE Einzel-Deploy nur als ausdrücklich bestätigte Ausnahme: `.github/workflows/exporthub-testservice.yml`
- Android: `.github/workflows/exporthub-android-test-app.yml`
- POD-Backup-Nachholung: `.github/workflows/rc1144-pod-backup-reconcile.yml`
- Multi-Layout Browser Gate: `.github/workflows/rc1306-layout-browser.yml`
- Stündliches Runtime-Monitoring: `.github/workflows/rc1050-storage-probe.yml`

Historische RC-Regressionstests bleiben bewusst erhalten und werden vom aktuellen Releasevertrag weiter ausgeführt, damit frühere Funktionen nicht unbemerkt regressieren. Historische Verträge, die früher einen gemeinsamen Production-/TESTSERVICE-Deploy voraussetzten, prüfen seit RC1505 die getrennten Main-Verification-, Build- und Production-Live-Verträge, ohne Production wieder an `main` zu koppeln.

## Release-Sicherheit

Ein Production-Deploy ist seit RC1505 **nie die automatische Folge eines normalen `main`-Laufs**. Vor einer manuellen Production-Freigabe müssen die vorgesehenen Vertrags-, Node-, Build-, TESTSERVICE-, Browser- und Readiness-Gates erfolgreich sein; zusätzlich muss der freizugebende 40-stellige SHA auf `main` liegen und für exakt diesen SHA ein erfolgreicher **ExportHUB RC1112 Main Verification**-Push-Lauf existieren. Der manuelle Workflow akzeptiert die Freigabe nur mit der exakten Bestätigung `PRODUCTION FREIGEBEN`.

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
- reproduzierbare gemeinsame RC1112-Buildbasis.

Der manuelle Production-Release baut RC1112 und Packmeldungen auf demselben freigegebenen SHA und führt die vorgesehenen Production-Readiness-, read-only Browser- und Live-Verträge erst im ausdrücklich gestarteten Production-Pfad aus. Production-Secrets werden nicht im normalen Main-Verification-Pfad verwendet.

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
