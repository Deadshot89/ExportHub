# RC1601 – Produktions-Startup bei 15 %: sichere Read-only-Diagnose (P0 #836)

Dieses Werkzeug kontrolliert zwei **bestehende** API-Routen von der GitHub-Actions-Laufzeit aus, weil DNS/Netzwerkzugriffe der Entwicklungsumgebung den produktiven Azure-Host nicht direkt erreichen.

- `GET /api/exporthub-state?mode=ping`: prüft **nur die API-Erreichbarkeit**, ausdrücklich **nicht** die Team-State-Lesbarkeit.
- `GET /api/exporthub-state?mode=health`: misst einen echten Lesezugriff auf Azure-Authentifizierungs- und Team-State-Speicher. Auf Produktion ist dieser Codepfad ohne Datenmutation. Die mögliche Testservice-Initialisierung wird **nicht** aufgerufen.
- Fest hinterlegter Azure-Produktionshost, keine Zugangsdaten, Cookies, POSTs, Änderungen, automatischen Wiederholungen oder vollständigen JSON-Ausgaben. Der HTTP-Request wird nach 30 Sekunden abgebrochen.
- Output nur aus explizit freigegebenen Feldern: HTTP-Status, Laufzeit, bereinigte Boolean-Readiness, `authReadMs`, `teamReadMs`, `totalMs`, `teamStateBytes`, Anzahl alter Inline-Dokumente und API-Version. Namen, Dateipfade, Referenzen und Kundendaten werden nie ausgegeben.
- Ein fehlgeschlagener Live-Lesezugriff erscheint als **GitHub-Warnung**, nicht als falscher Erfolg der Website.

## Verwendung

In GitHub: **Actions → RC1601 Read-only Startup Health → Run workflow**. Zusätzlich läuft die Diagnose auf dem Pull Request, der das Skript/den Workflow erstellt oder ändert.

Lokal nur mit Node.js 22 und freier Netzwerkerreichbarkeit:

```bash
node --test test/rc1601-state-startup-readonly-health.test.mjs
node scripts/rc1601-state-startup-readonly-health.mjs
```

## Auswertung und Abgrenzung

- `ping.ok=true` bei `health.ok=false`: Azure Functions Route ist erreichbar, aber Storage-Health schlägt fehl oder dauert zu lange.
- `health.errorCode=TIMEOUT`: kein bestätigter Storage-Zustand; längerer Aufruf ist innerhalb 30 Sekunden nicht beendet, möglicherweise Ursache des 15-%-Hängers.
- `health.teamReadMs` und `health.teamStateBytes` helfen, Azure-/Datenmengenprobleme von Browser-Rendering-Problemen zu unterscheiden.
- `inlinePayloadCount > 0` ist lediglich ein Prüfhinweis und autorisiert **keine** Dokumentmigration.

**Wichtig:** Selbst ein erfolgreiches Health-Resultat bestätigt *nicht* den echten Login- und Dashboard-Start eines Mitarbeiters. Dafür sind Browser-Network-Logs, tatsächlich erfolgreicher Session-/Team-State-Read, sichtbare Oberfläche sowie Save/Reload weiterhin getrennt live zu prüfen. Bis dahin bleibt Issue #836 offen.
