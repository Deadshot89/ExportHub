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

## Aktive Release- und Deploy-Pfade

Es gibt nur noch diese dauerhaft aktiven GitHub-Workflows:

- Hauptprüfung RC1002: `.github/workflows/rc1002-main-contract.yml`
- Produktion: `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml`
- TESTSERVICE: `.github/workflows/exporthub-testservice.yml`
- Android: `.github/workflows/exporthub-android-test-app.yml`

Einmalige Entwicklungs-, Materialisierungs- und Alt-Release-Workflows für RC997, RC1000, RC1001 und die RC1002-Migration sind aus `main` entfernt. Die dazugehörigen Regressionstests bleiben erhalten, soweit sie vom aktuellen RC1002-Hauptvertrag noch benötigt werden.
