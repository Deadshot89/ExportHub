# PROJECT_MAP – ExportHUB360

Stand: 2026-11-01. Nur aus Ordnerlisten, `function.json`, `package.json` und Konfigdateien abgeleitet. Bei Bedarf gezielt weiter in den Code schauen.

## Einstiegspunkte (Root-HTML)
| Datei | Zweck (aus Dateiname/Skripten) |
|---|---|
| `index.html` | Hauptapp. Lädt u. a. `rc1017-multi-truck`, `sop/*`, `rc1027-lieferavis-immediate`, `rc1037-…timing-diagnostics`, `rc1049-abd-avis-policy`, `rc1059-document-blob`. Weitere Module werden von diesen oder von `production-version.js` nachgeladen. |
| `pack.html` | Packmeldungen (8 Skripte) |
| `pickup.html` | Abholung / QR-Bestätigung |
| `task.html` | öffentliche Aufgaben-Ansicht |
| `customer-avis.html` | Kunden-Lieferavis |
| `location.html` | Standort-/Terminbuchung |
| `pod-notfall.html` | POD-Notfallseite |
| `infra/production-loader.html`, `infra/test-loader.html` | Loader für Produktion/Test |
| `TESTVERSION.html`, `test-loader.html`, `migration*.html` | Test- und Migrationsseiten |

Routing und Header: `staticwebapp.config.json` (Produktion), `staticwebapp.testservice.config.json` (Testservice). Version: `production-version.js`, `release-version.json` (`visibleRelease`, `technicalBuild`).

## Frontend (`assets/`, ca. 115 Dateien + Unterordner)
Dateinamen tragen die RC-Nummer. Gruppen nach Namen:
- **Aufgaben:** `taskplanner-v2-*` (core, planner, projections, recurrence, runtime-bridge, ui, workflow), `rc1014-task-*`, `rc1537-taskplanner-canonical-source`, `rc1570-tasks-focus` (+ `i18n/rc1570-tasks-focus.js`), `task-public-read`.
- **Packmeldungen:** `pack*`, `pack-notification-*`, `pack-station-admin`, `rc1096-packaging-groups`.
- **Verpackung:** `packaging*`, `rc1555-packaging-*`.
- **Lieferavis / ABD / Kunden:** `rc1015-lieferavis-mail-flow`, `rc1027/1037`, `rc1049-abd-avis-policy`, `rc1133/1166/1454/1460`, `rc1294-abd-self-service`, `rc1499-abd-export`, `rc1077/1080/1092/1126/1160` (Kundenbereich).
- **Sendungen / Ladeliste:** `rc1014-shipment-overview`, `rc1071-shipment-history`, `rc1283/1305/1315` (Ladeliste), `rc1017/1328` (Multi-Truck), `rc1113-stowplan-persist`, `rc1176-shipment-location`.
- **POD / Dokumente:** `rc1059-document-blob`, `rc1061-document-migration-admin`, `rc1063`, `rc1165-pod-backup-status`, `document-*-normalizer`, `rc1203-deckblatt-print`.
- **Abholungen:** `abholkalender`, `rc1012-abholkalender-runtime`, `rc1546-pickup-control`.
- **Dashboard / Navigation / Layout:** `rc1371-dashboard-personalization`, `rc1558-dashboard-overview`, `rc1016-mobile-navigation`, `rc1306-layout-engine`, `rc1560-full-width`, `rc1304-theme-switcher`.
- **Sprache:** `rc1267-i18n`, `rc1018-public-language`, `i18n/` (de, en, pl, es, fr, it JSON; gleiche Sprachen in `api/shared/i18n/`).
- **Weiteres:** `sop/` (SOP/Training), `rc1532-customs-ai`, `rc1488-auto-update`, `rc1013-diagnostics`, `tools/`.

## Backend (`api/`, Azure Functions, alle `authLevel: anonymous`)
Konfiguration: `api/host.json`, `api/package.json`, `local.settings.example.json`. Gemeinsame Logik: `api/shared/` (u. a. `auth-store`, `blob-rest`, `document-blob-store`, `graph-mail`, `graph-drive`, `customs-ai-*`, `abd-*`, `customer-avis-*`, `fixed-pickup-store`, `i18n*`).
Funktionsordner nach Bereich:
- **Zustand / Auth:** `exporthub-state`, `exporthub-auth`, `exporthub-auth-probe`, `exporthub-health`, `exporthub-release`, `state-maintenance`, `production-version-check`.
- **Dokumente / POD:** `exporthub-document`, `exporthub-document-migrate`, `container-document`, `pickup-container-document`, `pod-backup`, `pod-backup-reconcile`, `pickup-pod`, `reference-files`.
- **Abholung:** `pickup-init`, `pickup-status`, `pickup-confirm`, `pickup-confirm-v2`, `manual-pickup-confirm`, `pickup-disable`, `pickup-health`, `fixed-pickups`, `location-booking`.
- **Avis / Kundenportal:** `customer-avis`, `customer-portal-credentials`, `customer-portal-readiness`, `avis-reminder-mail`, `avis-upload-mail-readiness`, `rc1453-mail-cleanup`.
- **Packmeldungen / Verpackung:** `pack-notification`, `pack-stations-admin`, `packaging-admin`, `packaging-public-state`.
- **Aufgaben:** `task-public`, `taskplanner-v2-rehearsal-state`.
- **Analyse / KI:** `abd-analysis`, `abd-analysis-export`, `customs-ai`.
- **Admin / Diagnose:** `loader-pins-admin`, `diagnostic-autofix`, `e2e-test-fixture`.

## Abhängigkeiten
- Frontend ruft die Funktionen unter `/api/<route>` (Route aus `function.json`).
- Mail/Dateiablage über Microsoft Graph (`api/shared/graph-*.js`), Dokumente über Azure Blob (`blob-rest.js`).
- Secrets liegen in App-Settings, nicht im Repo (siehe `docs/runbooks/azure-security-app-settings.md`, `npm run test:security`).

## Tests
- Unit/Vertrag: `test/*.test.mjs` (ca. 664 Dateien) und `tests/*.test.cjs` (12). Aufruf `npm test` mit `scripts/rc1462-pretest.mjs` davor und `scripts/rc1520-posttest-release-isolation.mjs` danach.
- Gezielt: `test:contracts`, `test:security`, `test:accessibility`, `test:smoke`, `verify:release`, `verify:i18n`, `i18n:audit(:strict)`.
- E2E: `e2e/specs/*.spec.mjs` (Playwright, `playwright.config.mjs`). Browser-Skripte: `browser/`.

## GitHub-Workflows (`.github/workflows/`, ca. 90 Dateien)
- Release/Bereitstellung: `azure-static-web-apps-wonderful-forest-0f315e310.yml` (Drei-Umgebungen-Vertrag, gebaut über `.github/rc1112/build-three-env.mjs`), `exporthub-production-release.yml`, `exporthub-testservice.yml`, `packmeldungen-production.yml`, `packmeldungen-testservice.yml`, `exporthub-android-test-app.yml`.
- Gates/Verify: `rc1002-main-contract`, `rc1003-main-integration`, `packmeldungen-branch-gate`, `taskplanner-v2-ci`, `rc1267-i18n-verify`, `rc1564-language-verify`, `security-secret-scan`, `sopmaster-*`, weitere `rc*-verify`.
- Notfall/Betrieb (nur mit Freigabe anfassen): `emergency-production-mfa-off`, `emergency-xg4ynn-pod-rescue`, `rc1267-state-backup`, `rc1491-state-backup-restore-watchdog`, `diagnostic-autofix`.
- Weitere Hilfsordner: `.github/rc1000` … `rc1473`, `.github/packmeldungen`, `.github/taskplanner-v2-rehearsal-trigger`.

## Weitere Ordner
- `android-app/` (Gradle), `migration/`, `releases/` (RC504–508 HTML), `scripts/` (23 Hotfix-/Prüfskripte), `docs/` (ARCHITECTURE, ROADMAP, MIGRATION_SAFETY, runbooks, superpowers/specs+plans).
