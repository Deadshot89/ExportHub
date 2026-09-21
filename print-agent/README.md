# ExportHUB CMR Print Agent

## Lokaler Konfigurationspfad

Der feste CMR-Drucker wird **nicht** im QR-Code und **nicht** in ExportHUB im Browser gespeichert.

Auf dem Windows-Druck-PC verwendet der Agent:

`C:\ProgramData\ExportHUB Print Agent\config.json`

Beispiel:

```json
{
  "exportHubBaseUrl": "https://wonderful-forest-0f315e310.7.azurestaticapps.net",
  "printerName": "ESSENTRA-LAGER-CMR",
  "pollIntervalSeconds": 3,
  "jobTimeoutSeconds": 60
}
```

Der Wert `printerName` muss exakt dem unter Windows installierten Druckernamen entsprechen.

## Secret

Der Agent-Key wird absichtlich **nicht** in `config.json` gespeichert.

Vorgesehene lokale Windows-Umgebungsvariable des Dienstkontos:

`EXPORTHUB_PRINT_AGENT_KEY`

Serverseitig liegt derselbe Wert als Azure Static Web Apps Environment Variable:

`EXPORTHUB_PRINT_AGENT_KEY`

## CMR-Druck-QR

Der QR wird auf dem Deckblatt der jeweiligen Sendung ausgegeben.

Der QR enthält nur einen sicheren sendungsgebundenen Print-Token. Er enthält weder den Druckernamen noch einen Dateipfad.

Ablauf:

1. Deckblatt-QR scannen.
2. ExportHUB legt genau einen CMR-Druckauftrag an.
3. Der Print Agent auf dem Lager-PC übernimmt den Auftrag.
4. Der in `config.json` konfigurierte Windows-Drucker druckt den CMR ohne Browserdialog.
5. Erfolg oder Fehler wird an ExportHUB zurückgemeldet.

Dadurch kann der Drucker später lokal geändert werden, ohne bestehende QR-Codes neu zu erzeugen.
