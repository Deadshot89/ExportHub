# ExportHUB – aktueller Main-Stand

Dieser Stand ist auf RC1002 vereinheitlicht. Produktion, TESTSERVICE und Android-App verwenden denselben Release-Kandidaten.

## Website

- `index.html` ist der aktuelle Produktionsstand RC1002.
- `TESTVERSION.html` ist der aktuelle TESTSERVICE-Stand RC1002.
- Produktion und TESTSERVICE werden aus demselben RC1002-Funktionsstand geprüft und ausgeliefert.
- Topbar, Navigation, globale Suche, Warncenter, persönliche Benachrichtigungen und Fehlerdiagnose sind enthalten.
- Die Fehlerdiagnose bleibt ausschließlich für globale Administratoren freigegeben.
- Warncenter und persönliche Aufgaben-Benachrichtigungen bleiben getrennte Bereiche.

## Aufgaben

Die aktuelle Aufgabenansicht verwendet die fachlichen Gruppen:

- Offene Sendungen
- Fehlende POD
- Kunde angemeldet
- Picks
- Offene ABDs

`Fehlende POD` gilt nur für bereits abgeholte Sendungen, bei denen der POD noch fehlt.

## Android-App

Das vollständige Android-Projekt befindet sich unter `android-app/`. Aktueller Stand: `1.0-rc1002`, `versionCode 1002`.

Der aktive Android-Build läuft über `.github/workflows/exporthub-android-test-app.yml`.

## Aktive Release- und Deploy-Pfade

- RC1002 Release-Vertrag: `.github/workflows/rc1002-release-sync.yml`
- Produktion: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`
- TESTSERVICE: `.github/workflows/rc1002-testservice-live.yml`
- Android: `.github/workflows/exporthub-android-test-app.yml`

Die Verzeichnisse `.github/rc995/` und `.github/rc996/` bleiben als Regressionstests erhalten, soweit sie vom aktuellen Teststand noch benötigt werden. Alte RC997-Release-Workflows sind nicht mehr Teil des aktiven Releasewegs.
