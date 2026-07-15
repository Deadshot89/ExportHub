ExportHUB Private RC440
=======================

Dieser Stand enthält den Azure-Team-Speicher aus RC439 und den verbindlichen Colli-Fix aus RC440.

Behoben in RC440:
- Palettenhöhe ist wieder manuell erfassbar und bleibt je Colli-Zeile gespeichert.
- Eine zusätzliche Colli-Zeile übernimmt ihre eigene Verpackungsart zuverlässig.
- Maße, Gewicht, LDM und Höhe werden je Zeile getrennt geführt.
- Alte konkurrierende Colli-Handler werden durch einen einzigen Abschluss-Handler übersteuert.
- Die zentrale Azure-Synchronisierung aus RC439 bleibt enthalten.

Deployment:
- Den vollständigen Inhalt des Ordners exporthub_rc440 in das GitHub-Repository übernehmen.
- Azure Workflow: app_location "/", api_location "api", output_location "".
- Anwendungseinstellung EXPORTHUB_STORAGE_CONNECTION_STRING muss weiterhin vorhanden sein.
