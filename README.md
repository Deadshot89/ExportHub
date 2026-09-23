# ExportHUB – aktueller Main-Stand

ExportHUB verwendet aktuell die gemeinsame **RC1112-Releasebasis** für Produktion, TESTSERVICE, Demo und Android. Die zuletzt produktiv ausgerollten Korrekturen reichen bis **RC1222**; der gemeinsame Produktionsmarker bleibt bewusst RC1112, damit alle drei Umgebungen über denselben geprüften Releasevertrag gebaut und ausgeliefert werden.

## Website und Umgebungen

- Produktion, TESTSERVICE und Demo werden gemeinsam über den RC1112-Drei-Umgebungen-Deploy gebaut.
- TESTSERVICE wird vor Produktion durch ein echtes Playwright-Browser-Gate geprüft.
- Produktion wird erst nach grünem TESTSERVICE-Gate freigegeben.
- Nach dem Produktionsdeploy laufen zusätzliche Read-only Browser-Smokes und Live-Prüfungen.
- `index.html`, `TESTVERSION.html` und `demo.html` verwenden denselben RC1112-Funktionsstand.
- Topbar, Navigation, globale Suche, Warncenter, persönliche Benachrichtigungen, Fehlerdiagnose, Historie, Abholkalender und Sendungsübersicht sind Bestandteil des aktuellen Stands.

## POD-Sicherung

PODs werden serverseitig zweifach gesichert:

1. Primärspeicher im bestehenden Azure-POD-Container `exporthub-pod`.
2. Zusätzliche unveränderliche Archivkopie im separaten Container `exporthub-pod-backup`.

Die Archivkopie wird content-addressed und SHA-256-geprüft gespeichert. Bestehende Archivdateien werden nicht überschrieben; bei einem Konflikt werden Hash und Dateigröße geprüft. Microsoft 365 / Microsoft Graph ist für die verpflichtende Zweitsicherung nicht mehr erforderlich und kann nur noch optional verwendet werden.

Der Workflow `.github/workflows/rc1144-pod-backup-reconcile.yml` prüft und vervollständigt offene POD-Sicherungen nach Deploys sowie regelmäßig per Zeitplan.

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

Aktueller Releasevertrag:

- `versionCode = 1112`
- `versionName = "1.0-rc1112"`
- `compileSdk = 36`
- `targetSdk = 36`

Der Build-Workflow erzeugt ein geprüftes Debug-APK-Artefakt für RC1112.

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

Ein Produktionsstand gilt erst als freigegeben, wenn die vorgesehenen Vertrags-, Node-, Build- und Browser-Gates erfolgreich sind. Für die POD-Sicherung gilt zusätzlich: offene Sicherungen dürfen im Production-Reconcile weder `pendingCount > 0` noch `errorCount > 0` hinterlassen.
