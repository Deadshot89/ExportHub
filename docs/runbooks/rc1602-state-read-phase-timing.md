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


## RC1614 · Offline-Zuordnung der produktiven State-Datenmenge

Produktionslauf [RC1137 #39660410670](https://github.com/Deadshot89/ExportHub/actions/runs/39660410670)
protokolliert `beforeBytes=58944805`, `afterBytes=58944805`, `savedBytes=0`
und danach `teamStateBytes=58945066`. Die bestehende Kompaktierung war also
nicht mehr anwendbar. Ein echter authentifizierter TESTSERVICE-Read lieferte
zuvor rund 29,5 Millionen Textbytes. Diese Zahlen sind **nicht** austauschbar
und belegen noch keine Ursache des 15-%-Startstillstands im Produktionsbrowser.

Zur Analyse **einer autorisiert und unverändert lokal gesicherten** Team-State-JSON
gibt es ein strikt offline/read-only Werkzeug:

```bash
node scripts/rc1614-state-startup-size-audit.mjs --input /secure/team-state-backup.json
```

Es ordnet ausschließlich numerische Serialisierungsgrößen den fest definierten
Bereichen `shipments`, `savedShipments`, `customers`, `tasks`, `abdRequests`
und `other` zu. Überlange Strings und eingebettete `data:*;base64`-Inhalte
werden nur **gezählt**, nie ausgegeben. Andere Feldnamen, Dateipfade,
Sendungsreferenzen, Dokumentbytes und Kundenangaben erscheinen nicht im Report.
SHA-256 des ursprünglichen Snapshot-Inputs belegt, welche unveränderte Datei
ausgewertet wurde. Ein Fehler liefert nur einen technischen Fehlercode.

Die Einzelsummen sind **ungefähre JSON-Serialisierungszuordnungen**, keine
Byte-exakte Zerlegung des HTTP-Payloads; Serverantworten können Metadaten,
Encoding und zusätzliche Felder enthalten.

**Datenschutz:** Team-State-Backups und detaillierte Auswertungen gehören
ausschließlich in die berechtigte geschützte Umgebung, niemals in öffentliche
GitHub-Issues, PRs, Chatprotokolle oder CI-Artefakte. Es erfolgen weder Netz-
noch Azure-Schreibzugriffe.

Regression: `node --test test/rc1614-state-startup-size-audit.test.mjs`.

Erst nach Vorliegen einer echten lokalen Größenverteilung darf entschieden
werden, ob große eingebettete Dokumente, History-/Snapshot-Felder oder die
Übertragung/Client-Hydration optimiert werden. **Keine** automatische Löschung,
kein blindes Entfernen von Dokumentfeldern und kein Ändern des produktiven
Speicherformats ohne echte Backups und vollständige regressions-/livegeprüfte
Abnahme. Issue #836 bleibt bis zur realen produktiven Start-/Save-/Reload-Abnahme offen.
