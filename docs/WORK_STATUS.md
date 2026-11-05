# WORK_STATUS – ExportHub

Momentaufnahme vom 2026-11-05. Branch und lokale Änderungen immer mit `git status` prüfen, PRs mit `gh pr list`. Diese Datei nur nach bestätigten größeren Änderungen aktualisieren.

## Stand main
- Letzter geprüfter Commit: `9b9939fa` (Urgent Order: E-Mail-Adressen lokal merken, #1218).
- `release-version.json` nennt `visibleRelease: RC1370` und `technicalBuild: RC1112`. Laut Datei ändert sich `visibleRelease` nur bei bewusst freigegebenen Produktänderungen. Der RC-Stand in Commit-Titeln ist davon unabhängig.

## Offene Pull Requests
| # | Titel | Status |
|---|---|---|
| 1219 | Aufgaben: Gruppen "Aufträge kontrollieren" und "Zusatzaufgaben", Limit je Gruppe | offen, mergebar, einige `verify`-Checks liefen beim letzten Lesen noch |
| 1148 | Packmeldung: unterschiedliche Collis und Paletten je Meldung | offen |
| 1047 | POD-Sicherung: Original-PDF, SharePoint-Status, Nachholung | offen |

## Lokal
- Ungetrackt, nicht committen: `dist-rc1012/`, `.ai-memory/`, `.playwright-mcp/`.
- Ältere uncommittete Aufgaben-Änderungen (Gruppen wie im Planer) sind gesichert unter `C:\Temp\rc1574-wip*`. Den nutzbaren Teil enthält PR #1219.
- Veraltete lokale Branches, löschbar nach den Merges: `docs/project-map-serena`, `docs/work-status-serena`, `feat/tasks-groups`, `feat/tasks-groups-rebased`.

## Tests
- `npm test` bricht lokal auf `main` schon im `pretest` ab: `scripts/rc1495-legacy-qr-persistence-hotfix.mjs` meldet "RC1498 vorhandene Builder-Patchfunktion konnte nicht sicher aktualisiert werden". Das gilt auch bei kurzem Pfad. Ursache ungeklärt (Vermutung: Hotfix passt nicht mehr zum geänderten Builder).
- Das `pretest` schreibt Hotfixes in tracked Dateien (i18n, `customer-avis.html`, `api/package.json`). Nicht im Hauptordner mit uncommitteten Änderungen ausführen, sondern nur in einem Wegwerf-Worktree und danach zurücksetzen.
- CI nutzt `npm test` nicht. `rc1002-main-contract.yml` und der Azure-Workflow starten gezielte Dateien mit `node --test` sowie `npm run test:security` und `test:accessibility`.
- Für einzelne Prüfungen: `node --test test/<datei>` direkt, ohne `pretest`.

## Serena
- Config `~/.serena/serena_config.yml`: fehlender Schlüssel `projects` ergänzt, Backup `serena_config.yml.bak-2026-11-01`.
- Projekt `ExportHub` registriert (Sprache typescript), Memories in `.serena/memories/`: core, tech_stack, suggested_commands, conventions, task_completion.
- GitHub-MCP meldet "does not support dynamic client registration". `gh` funktioniert.

## Nächste Schritte
1. PR #1219 nach grünen Checks prüfen und mergen (Eigentümer).
2. Offene PRs #1148 und #1047 prüfen.
3. Alte lokale Branches und Arbeitsverzeichnisse aufräumen.
