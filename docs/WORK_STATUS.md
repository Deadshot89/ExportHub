# WORK_STATUS – ExportHUB360

Stand: 2026-11-01 (Momentaufnahme, bei Bedarf mit `git status` und `gh pr list` abgleichen).

## Branch
- Aktuell: `feat/tasks-groups`, 1 Commit vor `main`, 0 dahinter.
- Letzte Commits auf dem Stand: RC1572 (#832 Packmeldungen-Menü, Dashboard-Listen), RC1570 (#830 Aufgaben-Fokusansicht), RC1571 (#829 Navigation), RC1567 (#826 Sprachen), RC1569 (#828 Dashboard-Kacheln).

## Offene Änderungen (nicht committen ohne Freigabe)
- Geändert: `assets/rc1570-tasks-focus.js`, `assets/i18n/rc1570-tasks-focus.js`.
- Ungetrackt: `dist-rc1012/`, `.ai-memory/` (Handoff-Notizen vom 31.10.).

## Offene Pull Requests (Stand gh, 2026-11-01)
| # | Titel | Status |
|---|---|---|
| 1110 | P0: POD-Originale aus Azure auch ohne alten QR-Token öffnen | offen |
| 1109 | P0: Aufgaben bleiben erledigt, Spanien bestätigbar, keine falschen AV-Alarme | offen |
| 1092 | P1: Packmeldung-Lieferscheine bei Formular-Neudarstellung erhalten | Draft |
| 1047 | POD-Sicherung: Original-PDF, SharePoint-Status, Nachholung | offen |
| 763 | Design: SOP & Training Center Clean Rebuild | Draft |

## Tests
- Teststand: nicht geprüft (in dieser Sitzung wurde kein Test ausgeführt).

## Bekannte Probleme
- `docs/ARCHITECTURE.md` und `docs/CURRENT_SOURCE_BASELINE.md` sind veraltet (Stand "Professional 0.2").
- `release-version.json` nennt `visibleRelease: RC1370`, die Commits tragen RC1572. Ob das gewollt ist, ist ungeklärt.
- Serena war nicht korrekt eingerichtet (siehe unten).

## Serena
- `~/.serena/serena_config.yml`: fehlender Schlüssel `projects` ergänzt, Backup `serena_config.yml.bak-2026-11-01`.
- ExportHub ist registriert (Sprache typescript), Onboarding erledigt, Memories: core, tech_stack, suggested_commands, conventions, task_completion. Projektdateien liegen in `.serena/` (ungetrackt).

## Nächste Schritte
1. Entscheiden, was mit den geänderten `rc1570-tasks-focus`-Dateien passiert (committen oder verwerfen).
3. Offene PRs priorisieren (P0: #1110, #1109).
4. Tests auf dem Branch laufen lassen und Ergebnis hier eintragen.
