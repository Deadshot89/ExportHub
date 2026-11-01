# ExportHUB360 – Projektanweisungen

Kurzfassung. Details: [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) (Struktur) und [docs/WORK_STATUS.md](docs/WORK_STATUS.md) (aktueller Stand).

## Architektur
- Statische Web-App ohne Build-Schritt (Vanilla-JS-Module in `assets/`) plus Azure-Functions-API in `api/` (Node, je Funktion ein Ordner mit `function.json` und `index.js`, gemeinsamer Code in `api/shared/`).
- Hosting: Azure Static Web Apps (`staticwebapp.config.json`). Releases laufen über GitHub Actions in `.github/workflows/`.
- Sprachen der Oberfläche: de, en, pl, es, fr, it (`assets/i18n/`, `api/shared/i18n/`). Neue Texte in allen sechs Paketen pflegen (`npm run verify:i18n`).
- Sichtbarer Release-Stand: `release-version.json` (Feld `visibleRelease`), `RELEASE_MANIFEST.txt` ist nur ein historischer Snapshot.

## Wichtige Verzeichnisse
- `*.html` im Root: Seiteneinstiege (`index.html` Hauptapp, `pack.html`, `pickup.html`, `task.html`, `customer-avis.html`, `location.html`, `pod-notfall.html`).
- `assets/`: Frontend-Module, Dateiname trägt die RC-Nummer (`rcNNNN-…`).
- `api/`: Backend-Funktionen. `test/` und `tests/`: Node-Tests. `e2e/`: Playwright.
- `docs/`: Architektur, Runbooks, Pläne.

## Befehle
- `npm test` (mit pretest/posttest), `npm run verify:release`, `npm run verify:i18n`, `npm run test:security`.

## Arbeitsregeln
- Antworten auf Deutsch, kurz, tokensparend.
- Zuerst `docs/PROJECT_MAP.md` gezielt lesen, dann gezielte Suche (Serena-Symbolsuche, Grep). Keine Vollanalyse des Repos und keine großen Dateien komplett einlesen.
- Geschäftsregeln und KPI-Zielwerte nicht ändern. Keine vorhandenen Funktionen entfernen.
- Uncommittete Änderungen und `dist-rc1012/`, `.ai-memory/` nicht anfassen.
- Kein Merge, kein Deployment, keine Veröffentlichung auf Produktion ohne ausdrückliche Freigabe. Arbeit im Entwicklungsbranch.
- Keine Plugins, Skills, MCP-Server oder Hooks eigenständig deaktivieren.
- Keine unnötigen Subagenten.

## Dokumentation pflegen
- Nach bestätigten, größeren Änderungen `docs/WORK_STATUS.md` aktualisieren. `docs/PROJECT_MAP.md` nur bei neuen oder verschobenen Modulen.
- `docs/ARCHITECTURE.md` und `docs/CURRENT_SOURCE_BASELINE.md` beschreiben den Stand "Professional 0.2" und sind nicht aktuell.

## Eigene Projekte (nicht hier bearbeiten)
KPI-Logistik, Unterweisung, PaarApp, Investment-Radar liegen in eigenen Ordnern unter `Documents/GitHub/`.
