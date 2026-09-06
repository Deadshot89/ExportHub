# ExportHUB – aktueller Main-Stand

Dieser Stand enthält den aktuellen RC997-Website-Kandidaten einschließlich TESTSERVICE, Demo-Build, API, aktiven Sicherheits-/Regressionstests und vollständigem Android-App-Projekt.

## Website

- `TESTVERSION.html` ist die aktuelle TESTSERVICE-Quelle.
- Die Quellmarker bleiben technisch auf `RC995 / Cache 995`, weil der RC997-Build daraus reproduzierbar die aktuellen Umgebungsseiten erzeugt.
- `index.html` bleibt der getrennte Produktionsstand und wird durch die Website-Finalisierung nicht direkt überschrieben.
- Topbar, Navigation, globale Suche, Warncenter, persönliche Benachrichtigungen und Fehlerdiagnose sind im aktuellen Kandidaten enthalten.
- Die Fehlerdiagnose bleibt ausschließlich für globale Administratoren freigegeben.
- Warncenter und persönliche Aufgaben-Benachrichtigungen bleiben getrennte Bereiche.
- TESTSERVICE-Logintexte sind bereinigt; erfolgreiche Auth-Backend-Prüfungen erzeugen keinen zusätzlichen Erfolgsbanner.
- Smartphone-Abschlussregeln für Navigation, Topbar, Benachrichtigungen und Diagnose sind enthalten.

## Android-App

Das vollständige Android-Projekt befindet sich unter `android-app/` und enthält Produktion, TESTSERVICE und Demo als auswählbare Umgebungen, WebView-Integration, Upload/Download/Druck, Zurück-Navigation sowie native Benachrichtigungskanäle für Aufgaben und Warncenter.

## Aktive Prüfungen

Die Verzeichnisse `.github/rc995/` und `.github/rc996/` bleiben absichtlich enthalten. Es handelt sich nicht um alte Release-Kopien, sondern um aktive Regressionstests, die der aktuelle RC997-Workflow weiterhin ausführt.

Der aktuelle Abschlussworkflow ist `.github/workflows/rc997-website-final.yml`.
