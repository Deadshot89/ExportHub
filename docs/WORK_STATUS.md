# WORK_STATUS – ExportHub

Momentaufnahme vom 2026-11-01. Branch und lokale Änderungen immer mit `git status` prüfen, PRs mit `gh pr list`. Diese Datei nur nach bestätigten größeren Änderungen aktualisieren.

## Stand main
- Letzter geprüfter Commit: `d1d57529` (RC1750, POD-Sicherung SharePoint-Kopie, #1145). Davor: #1144 Handy-Warncenter, #1143 Dashboard-Kacheln.
- `release-version.json` nennt `visibleRelease: RC1370` und `technicalBuild: RC1112`. Laut Datei ändert sich `visibleRelease` nur bei bewusst freigegebenen Produktänderungen. Der RC-Stand in Commit-Titeln ist davon unabhängig.

## Offene Pull Requests
| # | Titel | Status |
|---|---|---|
| 1110 | P0: POD-Originale aus Azure auch ohne alten QR-Token öffnen | offen |
| 1109 | P0: Aufgaben bleiben erledigt, Spanien bestätigbar, keine falschen AV-Alarme | offen |
| 1092 | P1: Packmeldung-Lieferscheine bei Formular-Neudarstellung erhalten | Draft |
| 1047 | POD-Sicherung: Original-PDF, SharePoint-Status, Nachholung | offen |
| 763 | Design: SOP & Training Center Clean Rebuild | Draft |
| 1146 | Docs (erste Fassung, veraltet, wird durch den Nachfolger ersetzt) | offen |

## Bekannte lokale Änderungen des Eigentümers (nicht anfassen)
- Branch `feat/tasks-groups`: uncommittete Änderungen an `assets/rc1570-tasks-focus.js` und `assets/i18n/rc1570-tasks-focus.js`. `main` hat diese Dateien inzwischen selbst geändert, ein Branch-Wechsel mit diesen Änderungen wird von Git abgelehnt. Vor dem Wechsel entscheiden: committen, sichern oder verwerfen.
- Ungetrackt: `dist-rc1012/`, `.ai-memory/`.

## Tests
- `npm test` bricht lokal auf `main` (`d1d57529`) schon im `pretest` ab: `scripts/rc1495-legacy-qr-persistence-hotfix.mjs` meldet "RC1498 vorhandene Builder-Patchfunktion konnte nicht sicher aktualisiert werden". Das gilt auch bei kurzem Pfad. Ursache ungeklärt (Vermutung: Hotfix passt nicht mehr zum geänderten Builder).
- Das `pretest` schreibt Hotfixes in tracked Dateien (i18n, `customer-avis.html`, `api/package.json`). Nicht im Hauptordner mit uncommitteten Änderungen ausführen, sondern nur in einem Wegwerf-Worktree und danach zurücksetzen.
- CI nutzt `npm test` nicht. `rc1002-main-contract.yml` und der Azure-Workflow starten gezielte Dateien mit `node --test` sowie `npm run test:security` und `test:accessibility`. Die zuletzt gelesenen Läufe auf `main` (2026-11-01) waren grün, u. a. RC1112 Main Contract und Security Secret Scan.
- Für einzelne Prüfungen: `node --test test/<datei>` direkt, ohne `pretest`.

## Serena
- Config `~/.serena/serena_config.yml`: fehlender Schlüssel `projects` ergänzt, Backup `serena_config.yml.bak-2026-11-01`.
- Projekt `ExportHub` registriert (Sprache typescript), Memories in `.serena/memories/`: core, tech_stack, suggested_commands, conventions, task_completion.
- GitHub-MCP meldet "does not support dynamic client registration". `gh` funktioniert.

## Nächste Schritte
1. Entscheiden, was mit den `rc1570`-Änderungen passiert.
2. P0-PRs #1110 und #1109 prüfen.
3. Tests auf dem Arbeitsbranch laufen lassen und hier eintragen.
