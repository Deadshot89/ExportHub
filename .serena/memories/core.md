# ExportHub core
Statische Web-App (Vanilla JS, kein Build-Schritt) + Azure-Functions-API. Menschenlesbare Karte: `docs/PROJECT_MAP.md`, Stand/PRs: `docs/WORK_STATUS.md`, Regeln: `CLAUDE.md` (alle im Repo lesen, nicht duplizieren).
- Frontend: `assets/rcNNNN-*.js` (RC-Nummer im Dateinamen), Seiten im Root (`index.html`, `pack.html`, `pickup.html`, `task.html`, ...). Module sind IIFEs mit Guard `w.__EXPORTHUB_RCNNNN_...__`.
- Backend: `api/<funktion>/{function.json,index.js}` (CommonJS), Logik in `api/shared/`. Alle `authLevel: anonymous`, Rechte serverseitig im Code.
- Sprachen: de, en, pl, es, fr, it in `assets/i18n/` und `api/shared/i18n/`. Details: `mem:tech_stack`, `mem:conventions`.
- Befehle/Abschluss: `mem:suggested_commands`, `mem:task_completion`.
- Invarianten: Geschaeftsregeln und KPI-Zielwerte nicht aendern; kein Merge/Deploy ohne Freigabe; `release-version.json` (visibleRelease) ist nicht automatisch der Commit-RC-Stand; `RELEASE_MANIFEST.txt` ist historisch.
- Eigene Projekte (nie hier bearbeiten): KPI-Logistik, Unterweisung, PaarApp, Investment-Radar.
