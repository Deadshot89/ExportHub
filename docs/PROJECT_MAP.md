# Projekt-MAP – ExportHub (schneller Einstieg für Claude Code und ChatGPT)

Diese Navigationshilfe ist **kein Quellcode-Ersatz** und keine aktuelle Releasefreigabe. Bei Abweichungen gelten der konkrete Code, die Tests und `AGENTS.md`. Für Claude: zuerst `CLAUDE.md` → diese MAP → nur die betroffenen Dateien. Keine vollständige Repositoriesuche ohne konkreten Grund.

## Wo liegt was?

| Aufgabe | Zuerst nachsehen | Anschließend gezielt prüfen |
| --- | --- | --- |
| Sendung anlegen/ändern, Dashboard, Status | `index.html`, `browser/` | Zugehörige `test/`, `tests/` und `e2e/` |
| QR-Abholung, Fahrer, POD, Unterschriften | `pickup.html`, `api/pickup-*`, `api/pod-*` | API-Berechtigungen, Belegintegrität und einschlägige Tests |
| Ladeliste, Druck, Packen | `pack.html`, `api/container-document/`, `api/pickup-container-document/` | Druck-/PDF-Tests, Vorlagen, Versionsnachweis |
| ABD, Zoll, Dokumente | `api/abd-analysis/`, `api/exporthub-document/`, `api/reference-files/` | Dateivalidierung, Mandantengrenzen, Dokumenttests |
| Kunden-AVIS / Zeitfenster | `customer-avis.html`, `api/customer-avis/`, `api/location-booking/` | `tests/rc1224-customer-avis-slots.test.cjs` und passende E2E |
| Authentifizierung, Mandant, Statusspeicher | `api/exporthub-auth/`, `api/exporthub-state/`, `api/shared/` | Serverautorisierung, Migration, Readback, Datenschutz |
| Azure, Releases, Umgebungen | `.github/workflows/`, `infra/`, `releases/`, `RELEASE_MANIFEST.txt` | `docs/agent-collaboration.md`, bestehende Sicherheits-/Release-Gates |
| Zukunftsarchitektur / Migration | `docs/ARCHITECTURE.md`, `docs/CURRENT_SOURCE_BASELINE.md`, `migration/` | Noch keine Produktionsarchitektur daraus ableiten |

## Token- und Zeitregeln

1. Für jede Aufgabe zuerst betroffenen Bereich in der Tabelle wählen. Mit gezielter Dateisuche nach **Symbol/Funktionsname** arbeiten, nicht alle Skripte in den Prompt laden.
2. Nur betroffene Quelldatei, direkt aufgerufene Schnittstellen, zugehörige Tests und den aktuellen Diff lesen. Große `dist-rc*/`-Artefakte, `TESTVERSION.html` und generierte Releases **nicht** standardmäßig einlesen.
3. Vor Änderung: maximal fünf betroffene Dateien und Risiken nennen; falls mehr nötig, begründen. Kleine PRs statt Sammeländerungen.
4. Nach Änderung: exakten Head-SHA, geänderte Dateien, getestete Befehle/Ergebnisse, offene Risiken und Fundstellen angeben. So kann ChatGPT nur den PR-Diff prüfen.
5. Diese MAP nur ändern, wenn Pfade/Verantwortlichkeiten tatsächlich geändert wurden. Keine fragilen Zeilennummern, keine automatisch behauptete Vollständigkeit.

## Review-Handoff

**Claude Code** programmiert im eigenen Branch und öffnet einen PR. **ChatGPT** prüft bei verfügbarem GitHub-Zugriff genau den PR-Diff sowie die nachgewiesenen Tests; zuerst Fehler mit Datei/Zeile/Schweregrad/Reproduktion, dann gezielte Korrektur durch Claude. Maximal zwei fehlgeschlagene Korrekturversuche. Keine kostenpflichtige automatisierte KI-Review-Schleife.

**Nie** einen PR selbst mergen, Autodeploy auslösen oder Produktion/TESTSERVICE gleichsetzen. `AGENTS.md` enthält die verbindlichen Grenzen; einzig der Eigentümer gibt konkrete Freigaben.
