# RC1602 – Phasenmessung des authentifizierten TESTSERVICE-Team-State-Reads (P0 #836)

Die bisherigen Produktions-Health-Proben sind **read-only und erfolgreich**, beweisen jedoch keinen vollständigen Start im Browser. Aktuell liegt der unkomprimierte Team-State bei ca. 59 MB. Der markierte Fortschrittswert 15 % wird vor Abschluss des authentifizierten \`stateCall('read')\` angezeigt.

## Ergänzung

Die bereits vorhandene \`e2e/helpers/testservice-readiness.mjs\` wird um eine getrennte Phasenmessung des tatsächlich verwendeten **GET \`/api/exporthub-state?mode=read&full=1\` mit E2E-TESTSERVICE-Sitzung** erweitert. Es gibt keinen zusätzlichen API-Aufruf, kein neues Recht und keinen Schreibpfad.

| Feld | Aussage |
|---|---|
| \`headerMs\` | Zeit bis Response-Header zurück sind |
| \`bodyMs\` | Download/Decoding des HTTP-Response-Texts |
| \`parseMs\` | Zeit für JSON.parse des Response-Texts |
| \`bodyBytes\` | Byteanzahl des zur JSON-Verarbeitung vorliegenden Texts |
| \`serverMs\`, \`authMs\`, \`teamMs\` | Serverseitige Diagnosewerte aus den bestehenden Antwort-Headern |

**Sicherheit:** Die Rohantwort wird ausschließlich im Prozessspeicher verarbeitet; niemals in CI-Logs ausgegeben. Der Reporter enthält ausschließlich eine feste numerische Allowlist. Session-Token, Kunden, Sendungen, Namen und Original-PODs werden nicht protokolliert oder geändert. Fehler bleiben kontrolliert, bei nicht lesbarem JSON greift die bereits vorhandene TESTSERVICE-Readiness-Sperre.

## Nachweis und Grenzen

Ausgeführt wird die Messung automatisch im bestehenden TESTSERVICE-Live-Playwright-Setup, **sofern** die dortige E2E-Session-Konfiguration vorhanden ist (\`EXPORTHUB_E2E_LIVE=1\`, \`EXPORTHUB_E2E_PUBLIC_ENV=testservice\`). Sie ändert die Anwendung selbst nicht. Zusätzlich separate Node-Tests.

Die Phasenmessung belegt nur den **TESTSERVICE**-State-Read auf dem GitHub-Runner, nicht das Laden im produktiven Mitarbeiterbrowser. Die Ursachenklärung für #836 benötigt danach weiterhin den zugehörigen echten Produktiv-Browser-Trace, die Session-/Netzwerkbedingungen und die sichtbare Dashboard-Abnahme.

Eine Optimierung von Datenlieferung oder kompakterem Start darf danach nur bei unverändert erhaltenen Originaldaten und vollständigen Regressions- und Live-Abnahmen erfolgen.
